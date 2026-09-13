import * as T from 'three';
import * as B from '@babylonjs/core';
import { BAY, HEIGHT } from '../lib/game/physics.ts';
type Section = {
  bounds: T.Box3;
  query: WebGLQuery | null;
  hidden: boolean;
  tested: boolean;
};
type Batch = {
  source: T.InstancedMesh;
  matrix: T.InstancedBufferAttribute;
  count: number;
  indices: string[];
  filtered: T.InstancedBufferAttribute;
  revision: number;
  filteredCount: number;
};
/** Conservative stationary-camera experiment. Uses Babylon query APIs, with a
 * custom log-depth proxy: its standard linear-depth bounding box is incompatible
 * with this world's logarithmic depth buffer. No queries or lighting rays block. */
export class SectionOcclusion {
  enabled = false;
  hiddenSections = 0;
  removedInstances = 0;
  queryDraws = 0;
  private sections = new Map<string, Section>();
  private batches: Batch[] = [];
  private signature = '';
  private view = new T.Matrix4();
  private projection = new T.Matrix4();
  private stable = 0;
  private cursor = 0;
  private revision = 0;
  private proxy: B.Mesh;
  private material: B.ShaderMaterial;
  constructor(private scene: B.Scene) {
    this.proxy = B.MeshBuilder.CreateBox('occlusion-proxy', {}, scene);
    this.proxy.setEnabled(false);
    this.proxy.alwaysSelectAsActiveMesh = true;
    this.material = new B.ShaderMaterial(
      'log-depth-query',
      scene,
      {
        vertexSource: `precision highp float;attribute vec3 position;uniform mat4 boxMatrix,viewProjection,viewMatrix;varying float d;void main(){vec4 p=boxMatrix*vec4(position,1.0);gl_Position=viewProjection*p;d=1.0-(viewMatrix*p).z;}`,
        fragmentSource: `precision highp float;varying float d;uniform float logDepthBufFC;void main(){gl_FragDepth=log2(max(d,.000001))*logDepthBufFC*.5;gl_FragColor=vec4(0.0);}`,
      },
      {
        attributes: ['position'],
        uniforms: [
          'boxMatrix',
          'viewProjection',
          'viewMatrix',
          'logDepthBufFC',
        ],
      },
    );
    this.material.disableDepthWrite = true;
    this.material.disableColorWrite = true;
    this.material.backFaceCulling = false;
    this.material.depthFunction = B.Constants.LEQUAL;
    this.proxy.material = this.material;
  }
  private clearQueries() {
    const engine = this.scene.getEngine();
    for (const s of this.sections.values()) {
      if (s.query) engine.deleteQuery(s.query);
      s.query = null;
      s.hidden = false;
      s.tested = false;
    }
    this.stable = 0;
    this.revision++;
  }
  begin(source: T.Scene, camera: T.PerspectiveCamera) {
    this.removedInstances = 0;
    this.hiddenSections = 0;
    this.queryDraws = 0;
    if (!this.enabled) {
      if (this.stable) this.clearQueries();
      return;
    }
    const near = source.children[0];
    const meshes: T.InstancedMesh[] = [];
    for (const group of source.children)
      if (group === near || group.name === 'stair-visible-chunks')
        group.traverseVisible((o) => {
          if (o instanceof T.InstancedMesh) meshes.push(o);
        });
    const signature = meshes
      .map(
        (m) =>
          `${m.id}:${m.count}:${m.instanceMatrix.version}:${m.matrixWorld.elements.join(',')}`,
      )
      .join('|');
    if (signature !== this.signature) {
      this.clearQueries();
      this.sections.clear();
      this.batches = [];
      this.signature = signature;
      const instance = new T.Matrix4(),
        box = new T.Box3();
      for (const m of meshes) {
        m.geometry.computeBoundingBox();
        const indices: string[] = [];
        for (let i = 0; i < m.count; i++) {
          m.getMatrixAt(i, instance);
          instance.premultiply(m.matrixWorld);
          box.copy(m.geometry.boundingBox!).applyMatrix4(instance);
          const center = box.getCenter(new T.Vector3());
          const key = `${Math.floor(center.x / (BAY * 4))}:${Math.floor(center.y / (HEIGHT * 4))}:${Math.sign(center.z)}`;
          indices.push(key);
          let s = this.sections.get(key);
          if (!s) {
            s = {
              bounds: new T.Box3(),
              query: null,
              hidden: false,
              tested: false,
            };
            this.sections.set(key, s);
          }
          s.bounds.union(box);
        }
        this.batches.push({
          source: m,
          matrix: m.instanceMatrix,
          count: m.count,
          indices,
          filtered: new T.InstancedBufferAttribute(
            new Float32Array(m.instanceMatrix.array.length),
            16,
          ),
          revision: -1,
          filteredCount: m.count,
        });
      }
      // Expansion prevents coplanar surfaces from occluding their own proxy.
      for (const s of this.sections.values()) s.bounds.expandByScalar(0.03);
    }
    if (
      !this.view.equals(camera.matrixWorld) ||
      !this.projection.equals(camera.projectionMatrix)
    ) {
      this.clearQueries();
      this.view.copy(camera.matrixWorld);
      this.projection.copy(camera.projectionMatrix);
    } else this.stable++;
    const engine = this.scene.getEngine();
    for (const s of this.sections.values()) {
      if (s.query && engine.isQueryResultAvailable(s.query)) {
        const hidden =
          engine.getQueryResult(s.query) === 0 &&
          s.bounds.distanceToPoint(camera.position) >= camera.near + 0.03;
        if (hidden !== s.hidden) {
          s.hidden = hidden;
          this.revision++;
        }
        engine.deleteQuery(s.query);
        s.query = null;
      }
      if (s.hidden) this.hiddenSections++;
    }
    if (this.hiddenSections === 0) return;
    for (const b of this.batches) {
      if (b.revision !== this.revision) {
        let count = 0;
        for (let i = 0; i < b.count; i++)
          if (!this.sections.get(b.indices[i])!.hidden) {
            b.filtered.array.set(
              b.matrix.array.subarray(i * 16, i * 16 + 16),
              count * 16,
            );
            count++;
          }
        b.filtered.needsUpdate = true;
        b.filteredCount = count;
        b.revision = this.revision;
      }
      b.source.instanceMatrix = b.filtered;
      b.source.count = b.filteredCount;
      this.removedInstances += b.count - b.source.count;
    }
  }
  end(camera: T.PerspectiveCamera) {
    for (const b of this.batches) {
      b.source.instanceMatrix = b.matrix;
      b.source.count = b.count;
    }
    if (!this.enabled || this.stable < 2) return;
    const engine = this.scene.getEngine();
    const entries = [...this.sections.values()];
    if (!entries.length) return;
    this.material.setMatrix(
      'viewProjection',
      B.Matrix.FromArray(
        new T.Matrix4().multiplyMatrices(
          camera.projectionMatrix,
          camera.matrixWorldInverse,
        ).elements,
      ),
    );
    this.material.setMatrix(
      'viewMatrix',
      B.Matrix.FromArray(camera.matrixWorldInverse.elements),
    );
    this.material.setFloat('logDepthBufFC', 2 / Math.log2(camera.far + 1));
    if (!this.material.isReady(this.proxy)) return;
    const frustum = new T.Frustum().setFromProjectionMatrix(
      new T.Matrix4().multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse,
      ),
    );
    for (let i = 0; i < Math.min(24, entries.length); i++) {
      const s = entries[this.cursor++ % entries.length];
      if (
        s.query ||
        s.tested ||
        !frustum.intersectsBox(s.bounds) ||
        s.bounds.distanceToPoint(camera.position) < camera.near + 0.03
      )
        continue;
      const size = s.bounds.getSize(new T.Vector3()),
        center = s.bounds.getCenter(new T.Vector3());
      const matrix = new T.Matrix4().compose(center, new T.Quaternion(), size);
      this.material.setMatrix('boxMatrix', B.Matrix.FromArray(matrix.elements));
      this.scene.resetCachedMaterial();
      s.query = engine.createQuery();
      if (!s.query) continue;
      s.tested = true;
      engine.beginOcclusionQuery(
        B.AbstractMesh.OCCLUSION_ALGORITHM_TYPE_CONSERVATIVE,
        s.query,
      );
      this.proxy.setEnabled(true);
      this.proxy.render(this.proxy.subMeshes[0], false);
      this.proxy.setEnabled(false);
      engine.endOcclusionQuery(
        B.AbstractMesh.OCCLUSION_ALGORITHM_TYPE_CONSERVATIVE,
      );
      this.queryDraws++;
    }
  }
}

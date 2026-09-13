/** Prototype adapter: shared scene recipes, independently rendered Babylon GPU scene. */
import * as T from 'three';
import * as B from '@babylonjs/core';
import type { WorldLimits } from '../lib/game/physics.ts';

const chunks = T.ShaderChunk as Record<string, string>;
function expand(source: string): string {
  return source.replace(/#include <(\w+)>/g, (_, name) =>
    expand(chunks[name] ?? ''),
  );
}
const common = `precision highp float; precision highp int; precision highp sampler3D;
uniform mat4 modelMatrix,modelViewMatrix,projectionMatrix,viewMatrix;
uniform mat3 normalMatrix; uniform vec3 cameraPosition; uniform bool isOrthographic;
#define NUM_CLIPPING_PLANES 0
#define UNION_CLIPPING_PLANES 0
`;
const transfer = `${chunks.tonemapping_pars_fragment}
vec3 toneMapping(vec3 c){return ACESFilmicToneMapping(c);}
${chunks.colorspace_pars_fragment}
vec4 linearToOutputTexel(vec4 c){return sRGBTransferOETF(c);}
`;
type SourceMesh = T.Mesh<T.BufferGeometry, T.Material>;
type Uniforms = Record<string, T.IUniform>;
export class BabylonBridge {
  readonly engine: B.Engine;
  readonly scene: B.Scene;
  readonly errors: string[] = [];
  private entries = new Map<
    number,
    {
      source: SourceMesh;
      mesh: B.Mesh;
      material: B.ShaderMaterial;
      uniforms: Uniforms;
      version: number;
    }
  >();
  private parts = new Map<number, SourceMesh[]>();
  private textures = new Map<T.Texture, B.BaseTexture>();
  private geometry = new Map<T.BufferGeometry, B.VertexData>();
  private frustum = new T.Frustum();
  private matrix = new T.Matrix4();
  limits: WorldLimits = {};
  draws = 0;
  triangles = 0;
  constructor(
    canvas: HTMLCanvasElement,
    private reference: T.WebGLRenderer,
  ) {
    this.engine = new B.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: false,
      disableWebGL2Support: false,
    });
    if (this.engine.webGLVersion !== 2)
      throw new Error('The comparison requires WebGL2.');
    this.scene = new B.Scene(this.engine);
    this.scene.useRightHandedSystem = true;
    this.scene.clearColor = new B.Color4(0.125, 0.157, 0.145, 1);
    const camera = new B.FreeCamera(
      'comparison-camera',
      B.Vector3.Zero(),
      this.scene,
    );
    camera.minZ = 0.1;
    camera.maxZ = 16000;
    this.scene.activeCamera = camera;
    this.scene.autoClear = true;
    // Match Three's opaque material ordering and transparent back-to-front ordering.
    this.scene.setRenderingOrder(
      0,
      (a, b) => {
        const x = a.getMesh(),
          y = b.getMesh();
        return (
          x.alphaIndex - y.alphaIndex ||
          x.metadata.material - y.metadata.material ||
          x.metadata.depth - y.metadata.depth ||
          x.metadata.order - y.metadata.order
        );
      },
      undefined,
      (a, b) => {
        const x = a.getMesh(),
          y = b.getMesh();
        return (
          x.alphaIndex - y.alphaIndex ||
          y.metadata.depth - x.metadata.depth ||
          x.metadata.order - y.metadata.order
        );
      },
    );
  }
  private texture(source: T.Texture): B.BaseTexture {
    const cached = this.textures.get(source);
    if (cached) return cached;
    const im = source.image as {
      data?: ArrayBufferView;
      width: number;
      height: number;
      depth: number;
    };
    let data: ArrayBufferView, width: number, height: number;
    if (im.data) {
      data = im.data;
      width = im.width;
      height = im.height;
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = im.width;
      canvas.height = im.height;
      const c = canvas.getContext('2d')!;
      c.drawImage(im as unknown as CanvasImageSource, 0, 0);
      data = c.getImageData(0, 0, im.width, im.height).data;
      width = im.width;
      height = im.height;
    }
    const type =
      source.type === T.HalfFloatType
        ? B.Constants.TEXTURETYPE_HALF_FLOAT
        : source.type === T.FloatType
          ? B.Constants.TEXTURETYPE_FLOAT
          : B.Constants.TEXTURETYPE_UNSIGNED_BYTE;
    const sampling =
      source.minFilter === T.NearestFilter
        ? B.Texture.NEAREST_SAMPLINGMODE
        : source.generateMipmaps
          ? B.Texture.TRILINEAR_SAMPLINGMODE
          : B.Texture.BILINEAR_SAMPLINGMODE;
    const texture =
      source instanceof T.Data3DTexture
        ? new B.RawTexture3D(
            data,
            width,
            height,
            im.depth,
            B.Constants.TEXTUREFORMAT_RGBA,
            this.scene,
            false,
            false,
            sampling,
            type,
          )
        : new B.RawTexture(
            data,
            width,
            height,
            B.Constants.TEXTUREFORMAT_RGBA,
            this.scene,
            source.generateMipmaps,
            source.flipY,
            sampling,
            type,
            0,
            source.colorSpace === T.SRGBColorSpace,
          );
    texture.wrapU =
      source.wrapS === T.RepeatWrapping
        ? B.Texture.WRAP_ADDRESSMODE
        : B.Texture.CLAMP_ADDRESSMODE;
    texture.wrapV =
      source.wrapT === T.RepeatWrapping
        ? B.Texture.WRAP_ADDRESSMODE
        : B.Texture.CLAMP_ADDRESSMODE;
    texture.wrapR =
      source instanceof T.Data3DTexture && source.wrapR === T.RepeatWrapping
        ? B.Texture.WRAP_ADDRESSMODE
        : B.Texture.CLAMP_ADDRESSMODE;
    texture.anisotropicFilteringLevel = source.anisotropy;
    this.textures.set(source, texture);
    source.addEventListener('dispose', () => {
      texture.dispose();
      this.textures.delete(source);
    });
    return texture;
  }
  private create(source: SourceMesh) {
    const sm = source.material;
    if (
      !(sm instanceof T.MeshBasicMaterial) &&
      !(sm instanceof T.ShaderMaterial)
    )
      throw new Error(`Unsupported material ${sm.type}`);
    const instanced = source instanceof T.InstancedMesh;
    let vertex: string, fragment: string, uniforms: Uniforms;
    if (sm instanceof T.ShaderMaterial) {
      vertex = sm.vertexShader;
      fragment = sm.fragmentShader;
      uniforms = sm.uniforms;
    } else {
      const shader = {
        vertexShader: T.ShaderLib.basic.vertexShader,
        fragmentShader: T.ShaderLib.basic.fragmentShader,
        uniforms: T.UniformsUtils.clone(T.ShaderLib.basic.uniforms),
      };
      sm.onBeforeCompile(
        shader as Parameters<typeof sm.onBeforeCompile>[0],
        this.reference,
      );
      ({ vertexShader: vertex, fragmentShader: fragment, uniforms } = shader);
      vertex =
        'varying vec3 clipWorld;\n' +
        vertex.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
      vec4 cp=vec4(position,1.0);
      #ifdef USE_INSTANCING
      cp=instanceMatrix*cp;
      #endif
      clipWorld=(modelMatrix*cp).xyz;`,
        );
      fragment =
        'varying vec3 clipWorld; uniform vec4 prototypeBounds;\n' +
        fragment.replace(
          '#include <clipping_planes_fragment>',
          `#include <clipping_planes_fragment>
      if(clipWorld.x<prototypeBounds.x||clipWorld.x>prototypeBounds.y||clipWorld.y<prototypeBounds.z||clipWorld.y>prototypeBounds.w)discard;`,
        );
    }
    const defines = ['#define USE_LOGARITHMIC_DEPTH_BUFFER'];
    if (sm.toneMapped) defines.push('#define TONE_MAPPING');
    if (sm instanceof T.MeshBasicMaterial && sm.map)
      defines.push('#define USE_MAP', '#define MAP_UV uv');
    if (sm.vertexColors && source.geometry.hasAttribute('color'))
      defines.push('#define USE_COLOR');
    if (instanced) {
      defines.push('#define USE_INSTANCING');
      if (source.instanceColor) defines.push('#define USE_INSTANCING_COLOR');
    }
    const attributes = ['position', 'normal', 'uv'];
    if (sm.vertexColors && source.geometry.hasAttribute('color'))
      attributes.push('color');
    let vp = 'attribute vec3 position,normal; attribute vec2 uv;\n';
    if (attributes.includes('color')) vp += 'attribute vec3 color;\n';
    if (instanced) {
      vp +=
        'attribute vec4 world0,world1,world2,world3;\n#define instanceMatrix mat4(world0,world1,world2,world3)\n';
      if (source.instanceColor) {
        attributes.push('instanceColor');
        vp += 'attribute vec3 instanceColor;\n';
      }
    }
    vertex = common + defines.join('\n') + '\n' + vp + expand(vertex);
    fragment = common + defines.join('\n') + '\n' + transfer + expand(fragment);
    const samplers: string[] = [];
    for (const [key, u] of Object.entries(uniforms))
      if (u.value instanceof T.Texture) samplers.push(key);
    if (
      sm instanceof T.MeshBasicMaterial &&
      sm.map &&
      !samplers.includes('map')
    )
      samplers.push('map');
    const material = new B.ShaderMaterial(
      sm.name || sm.type,
      this.scene,
      { vertexSource: vertex, fragmentSource: fragment },
      {
        attributes,
        uniforms: [
          ...Object.keys(uniforms),
          'modelMatrix',
          'modelViewMatrix',
          'projectionMatrix',
          'viewMatrix',
          'normalMatrix',
          'cameraPosition',
          'isOrthographic',
          'logDepthBufFC',
          'toneMappingExposure',
          'prototypeBounds',
          'diffuse',
          'opacity',
          'mapTransform',
        ],
        samplers,
        needAlphaBlending: sm.transparent,
        useClipPlane: false,
      },
    );
    material.backFaceCulling = sm.side !== T.DoubleSide;
    material.sideOrientation = B.Material.CounterClockWiseSideOrientation;
    material.disableDepthWrite = !sm.depthWrite;
    material.depthFunction = sm.depthTest
      ? B.Constants.LEQUAL
      : B.Constants.ALWAYS;
    material.onError = (_effect, error) => {
      this.errors.push(error);
      console.error(error);
    };
    const mesh = new B.Mesh(source.name || String(source.id), this.scene);
    mesh.alwaysSelectAsActiveMesh = true;
    let geometry = this.geometry.get(source.geometry);
    if (!geometry) {
      const vd = new B.VertexData();
      vd.positions = Array.from(source.geometry.getAttribute('position').array);
      const n = source.geometry.getAttribute('normal');
      if (n) vd.normals = Array.from(n.array);
      const uv = source.geometry.getAttribute('uv');
      if (uv) vd.uvs = Array.from(uv.array);
      const c = source.geometry.getAttribute('color');
      if (c) vd.colors = Array.from(c.array);
      vd.indices = source.geometry.index
        ? Array.from(source.geometry.index.array)
        : Array.from({ length: vd.positions.length / 3 }, (_, i) => i);
      geometry = vd;
      this.geometry.set(source.geometry, geometry);
      const original = source.geometry;
      original.addEventListener('dispose', () =>
        this.geometry.delete(original),
      );
    }
    geometry.applyToMesh(mesh);
    mesh.material = material;
    mesh.renderingGroupId = 0;
    mesh.alphaIndex = source.renderOrder;
    if (instanced) {
      mesh.thinInstanceSetBuffer(
        'matrix',
        source.instanceMatrix.array as Float32Array,
        16,
        false,
      );
      if (source.instanceColor)
        mesh.thinInstanceSetBuffer(
          'instanceColor',
          source.instanceColor.array as Float32Array,
          3,
          true,
        );
    }
    const entry = { source, mesh, material, uniforms, version: -1 };
    this.entries.set(source.id, entry);
    return entry;
  }
  private bindUniform(material: B.ShaderMaterial, key: string, v: unknown) {
    if (v instanceof T.Texture) material.setTexture(key, this.texture(v));
    else if (v instanceof T.Color)
      material.setColor3(key, new B.Color3(v.r, v.g, v.b));
    else if (v instanceof T.Matrix4)
      material.setMatrix(key, B.Matrix.FromArray(v.elements));
    else if (v instanceof T.Matrix3) material.setMatrix3x3(key, v.elements);
    else if (v instanceof T.Vector4)
      material.setVector4(key, new B.Vector4(v.x, v.y, v.z, v.w));
    else if (v instanceof T.Vector3)
      material.setVector3(key, new B.Vector3(v.x, v.y, v.z));
    else if (v instanceof T.Vector2)
      material.setVector2(key, new B.Vector2(v.x, v.y));
    else if (typeof v === 'number') material.setFloat(key, v);
    else if (typeof v === 'boolean') material.setInt(key, Number(v));
  }
  private frustumMatrix(camera: T.Camera) {
    return new T.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
  }
  render(sourceScene: T.Scene, camera: T.PerspectiveCamera) {
    sourceScene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    this.frustum.setFromProjectionMatrix(
      this.matrix.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse,
      ),
    );
    const alive = new Set<number>();
    this.draws = 0;
    this.triangles = 0;
    for (const e of this.entries.values()) e.mesh.setEnabled(false);
    sourceScene.traverse((o) => {
      if (o instanceof T.Mesh) {
        alive.add(o.id);
        for (const part of this.parts.get(o.id) ?? []) alive.add(part.id);
      }
    });
    const renderMesh = (o: T.Mesh) => {
      const source = o as SourceMesh;
      if (source.frustumCulled && !this.frustum.intersectsObject(source))
        return;
      if (source instanceof T.InstancedMesh && source.count === 0) return;
      const e = this.entries.get(source.id) ?? this.create(source);
      e.mesh.setEnabled(true);
      const center =
        source instanceof T.InstancedMesh
          ? source.boundingSphere?.center
          : source.geometry.boundingSphere?.center;
      const depth = (center?.clone() ?? new T.Vector3())
        .applyMatrix4(source.matrixWorld)
        .applyMatrix4(this.frustumMatrix(camera)).z;
      e.mesh.metadata = {
        material: source.material.id,
        depth,
        order: source.id,
      };
      if (source instanceof T.InstancedMesh) {
        if (e.version !== source.instanceMatrix.version) {
          e.mesh.thinInstanceSetBuffer(
            'matrix',
            source.instanceMatrix.array as Float32Array,
            16,
            false,
          );
          e.version = source.instanceMatrix.version;
        }
        e.mesh.thinInstanceCount = source.count;
      }
      const m = e.material;
      for (const [key, u] of Object.entries(e.uniforms))
        this.bindUniform(m, key, u.value);
      const sm = source.material;
      if (sm instanceof T.MeshBasicMaterial) {
        this.bindUniform(m, 'diffuse', sm.color);
        m.setFloat('opacity', sm.opacity);
        if (sm.map) {
          sm.map.updateMatrix();
          m.setTexture('map', this.texture(sm.map));
          m.setMatrix3x3('mapTransform', sm.map.matrix.elements);
        }
      }
      this.bindUniform(m, 'modelMatrix', source.matrixWorld);
      this.bindUniform(
        m,
        'modelViewMatrix',
        this.matrix.multiplyMatrices(
          camera.matrixWorldInverse,
          source.matrixWorld,
        ),
      );
      this.bindUniform(m, 'projectionMatrix', camera.projectionMatrix);
      this.bindUniform(m, 'viewMatrix', camera.matrixWorldInverse);
      this.bindUniform(m, 'cameraPosition', camera.position);
      m.setFloat('logDepthBufFC', 2 / Math.log2(camera.far + 1));
      m.setFloat('toneMappingExposure', 1.25);
      m.setInt('isOrthographic', 0);
      m.setVector4(
        'prototypeBounds',
        new B.Vector4(
          this.limits.minX ?? -1e20,
          this.limits.maxX ?? 1e20,
          (this.limits.minY ?? -1e20) - 0.36,
          (this.limits.maxY ?? 1e20) + 0.36,
        ),
      );
      this.draws++;
      this.triangles +=
        ((source.geometry.index?.count ??
          source.geometry.getAttribute('position').count) /
          3) *
        (source instanceof T.InstancedMesh ? source.count : 1);
    };
    sourceScene.traverseVisible((o) => {
      if (!(o instanceof T.Mesh)) return;
      if (!Array.isArray(o.material)) {
        renderMesh(o);
        return;
      }
      let parts = this.parts.get(o.id);
      if (!parts) {
        parts = (o.geometry as T.BufferGeometry).groups.map((group) => {
          const geometry = o.geometry.clone();
          geometry.clearGroups();
          const indices = o.geometry.index!.array.slice(
            group.start,
            group.start + group.count,
          );
          geometry.setIndex(new T.BufferAttribute(indices, 1));
          const part =
            o instanceof T.InstancedMesh
              ? new T.InstancedMesh(
                  geometry,
                  o.material[group.materialIndex ?? 0],
                  o.count,
                )
              : new T.Mesh(geometry, o.material[group.materialIndex ?? 0]);
          part.frustumCulled = o.frustumCulled;
          part.renderOrder = o.renderOrder;
          return part as SourceMesh;
        });
        this.parts.set(o.id, parts);
      }
      for (const part of parts) {
        alive.add(part.id);
        part.matrixWorld.copy(o.matrixWorld);
        if (part instanceof T.InstancedMesh && o instanceof T.InstancedMesh) {
          part.instanceMatrix = o.instanceMatrix;
          part.instanceColor = o.instanceColor;
          part.count = o.count;
          part.boundingSphere = o.boundingSphere;
        }
        renderMesh(part);
      }
    });
    for (const [id, parts] of this.parts)
      if (!alive.has(id)) {
        for (const part of parts) {
          alive.delete(part.id);
          part.geometry.dispose();
        }
        this.parts.delete(id);
      }
    for (const [id, e] of this.entries)
      if (!alive.has(id)) {
        e.mesh.dispose();
        e.material.dispose();
        this.entries.delete(id);
      }
    this.scene.render();
  }
}

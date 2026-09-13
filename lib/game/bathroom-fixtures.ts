import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
export type BathroomPlacement = {
  x: number;
  y: number;
  z: number;
  side: number;
};
/** Contact bounds relative to bathroom centre; last axis points away from gallery. */
export const BATHROOM_CONTACTS = [
  [-2, 0.45, 2.001, 0.52, 0.9, 0.82],
  [-1.25, 1.085, 1.6, 0.1, 2.13, 1.7],
  [2, 1.125, 0, 2, 2.21, 0.1],
  [-0.4, 0.79, -1.73, 1.1, 0.17, 0.58],
  [-0.4, 1.87, -1.958, 1.06, 1.37, 0.065],
  [-1.39, 0.95, 1.8, 0.17, 0.23, 0.29],
  [1.95, 0.0275, -1.025, 1.9, 0.055, 1.95],
  [1.95, 0.0275, 1.225, 1.9, 0.055, 2.35],
];
/** Reflect a shared mesh with correct front-face winding; never negative instance scales. */
export function mirrorBathroomGeometry(source: T.BufferGeometry) {
  const g = source.clone().applyMatrix4(new T.Matrix4().makeScale(1, 1, -1));
  if (!g.index) {
    const n = g.getAttribute('position').count;
    g.setIndex(Array.from({ length: n }, (_, i) => i));
  }
  const index = g.index!;
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    index.setX(i, index.getX(i + 2));
    index.setX(i + 2, a);
  }
  return g;
}
export function createBathroomFixtures(
  scene: T.Scene,
  material: (p: T.MeshStandardMaterialParameters) => T.MeshBasicMaterial,
  url?: string,
) {
  const root = new T.Group();
  root.name = 'bathroom-fixtures';
  scene.add(root);
  type Part = {
    geometry: T.BufferGeometry;
    material: T.MeshBasicMaterial;
    side: number;
    high: boolean;
  };
  const parts: Part[] = [],
    meshes: T.InstancedMesh[] = [],
    textures = new Set<T.Texture>();
  let places: BathroomPlacement[] = [],
    dirty = true,
    disposed = false,
    loaded = false,
    lastKey = '';
  const eyeLast = new T.Vector3(Infinity, Infinity, Infinity),
    dummy = new T.Object3D();
  let shiftLast = Infinity;
  function part(
    geometry: T.BufferGeometry,
    m: T.MeshBasicMaterial,
    high: boolean,
  ) {
    parts.push(
      { geometry, material: m, side: -1, high },
      {
        geometry: mirrorBathroomGeometry(geometry),
        material: m,
        side: 1,
        high,
      },
    );
  }
  function coarse(color: string, boxes: number[][]) {
    const gs = boxes.map(([x, y, z, w, h, d]) =>
      new T.BoxGeometry(w, h, d).translate(x, y, -z),
    );
    part(mergeGeometries(gs)!, material({ color }), false);
    gs.forEach((g) => g.dispose());
  }
  coarse('#c6cbc1', [
    [-2, 0.25, 2.001, 0.32, 0.5, 0.5],
    [-2, 0.5, 1.926, 0.51, 0.1, 0.67],
    [-2, 0.65, 2.279, 0.43, 0.44, 0.23],
    [-0.4, 0.79, -1.73, 1.1, 0.17, 0.58],
    [1.95, 0.0275, -1.025, 1.9, 0.055, 1.95],
    [1.95, 0.0275, 1.225, 1.9, 0.055, 2.35],
    [-1.39, 0.95, 1.8, 0.17, 0.23, 0.29],
  ]);
  coarse('#a6b0a6', [
    [-1.25, 1.085, 1.6, 0.1, 2.13, 1.7],
    [2, 1.125, 0, 2, 2.21, 0.1],
  ]);
  coarse('#a0b0aa', [
    [-0.4, 1.87, -1.958, 1.06, 1.37, 0.065],
    [-0.4, 0.99, -1.94, 0.04, 0.22, 0.04],
    ...[-1.25, 1.25].flatMap((z) => [
      [2.78, 1.75, z, 0.036, 1.3, 0.036],
      [2.42, 2.37, z, 0.29, 0.035, 0.29],
      [2.73, 1.1, z, 0.074, 0.074, 0.3],
    ]),
  ]);
  function release() {
    meshes.forEach((m) => {
      root.remove(m);
      m.dispose();
    });
    meshes.length = 0;
  }
  function rebuild() {
    release();
    for (const p of parts) {
      const m = new T.InstancedMesh(
        p.geometry,
        p.material,
        Math.max(places.length, 1),
      );
      m.name = p.high ? 'bathroom-detail' : 'bathroom-low';
      m.count = 0;
      m.instanceMatrix.setUsage(T.DynamicDrawUsage);
      meshes.push(m);
      root.add(m);
    }
    dirty = true;
  }
  if (url)
    void new GLTFLoader()
      .loadAsync(url)
      .then((gltf) => {
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse((o) => {
          if (!(o instanceof T.Mesh)) return;
          const src = o.material as T.MeshStandardMaterial;
          if (!disposed) {
            const m = material({ color: src.color, map: src.map });
            m.name = `bathroom ${src.name}`;
            part(o.geometry.clone().applyMatrix4(o.matrixWorld), m, true);
            if (src.map) textures.add(src.map);
          } else {
            (src.map?.source.data as ImageBitmap)?.close?.();
            src.map?.dispose();
          }
          o.geometry.dispose();
          src.dispose();
        });
        if (!disposed) {
          loaded = true;
          rebuild();
        }
      })
      .catch((error) => {
        if (!disposed)
          console.warn(
            'Detailed bathroom unavailable; using lightweight fixtures.',
            error,
          );
      });
  return {
    set(next: BathroomPlacement[]) {
      places = next;
      rebuild();
    },
    update(eye: T.Vector3, shift: number) {
      root.position.y = shift;
      if (
        !dirty &&
        shift === shiftLast &&
        eyeLast.distanceToSquared(eye) < 0.25
      )
        return;
      eyeLast.copy(eye);
      shiftLast = shift;
      const near = places.map(
        (p) =>
          loaded &&
          (p.x - eye.x) ** 2 +
            (p.y + 1 + shift - eye.y) ** 2 +
            (p.z - eye.z) ** 2 <
            14 ** 2,
      );
      const key = near
        .map((n, i) => (n ? i : -1))
        .filter((i) => i >= 0)
        .join(',');
      if (!dirty && key === lastKey) return;
      dirty = false;
      lastKey = key;
      parts.forEach((part, i) => {
        const m = meshes[i];
        let n = 0;
        places.forEach((p, j) => {
          if (p.side !== part.side || near[j] !== part.high) return;
          dummy.position.set(p.x, p.y, p.z);
          dummy.updateMatrix();
          m.setMatrixAt(n++, dummy.matrix);
        });
        m.count = n;
        m.instanceMatrix.needsUpdate = true;
        m.computeBoundingSphere();
      });
    },
    dispose() {
      disposed = true;
      release();
      scene.remove(root);
      parts.forEach((p) => p.geometry.dispose());
      new Set(parts.map((p) => p.material)).forEach((m) => m.dispose());
      textures.forEach((t) => {
        (t.source.data as ImageBitmap)?.close?.();
        t.dispose();
      });
    },
  };
}

import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
export type BedPlacement = { x: number; y: number; z: number; side: number };
const RADIUS = 14;
/** Spatial LOD: includes adjacent floors and respects the translated world window. */
export function detailedBed(p: BedPlacement, eye: T.Vector3, shiftY: number) {
  return (
    (p.x - eye.x) ** 2 +
      (p.y + 0.5 + shiftY - eye.y) ** 2 +
      (p.z - eye.z) ** 2 <
    RADIUS ** 2
  );
}
export function createFurniture(
  scene: T.Scene,
  material: (p: T.MeshStandardMaterialParameters) => T.MeshBasicMaterial,
  assetUrl?: string,
  kind: 'bed' | 'return' | 'bbq' = 'bed',
) {
  const group = new T.Group();
  group.name = kind === 'bed' ? 'dormitory-beds' : `library-${kind}`;
  scene.add(group);
  type Part = { geometry: T.BufferGeometry; material: T.MeshBasicMaterial };
  const low: Part[] = [],
    high: Part[] = [];
  const meshes: T.InstancedMesh[] = [];
  const maps = new Set<T.Texture>();
  let placements: BedPlacement[] = [],
    disposed = false,
    dirty = true,
    lastShift = Infinity;
  let membership = '';
  const lastEye = new T.Vector3(Infinity, Infinity, Infinity);
  const dummy = new T.Object3D();
  function coarse(color: string, boxes: number[][]) {
    const pieces = boxes.map(([x, y, z, w, h, d]) =>
      new T.BoxGeometry(w, h, d).translate(x, y, z),
    );
    const geometry = mergeGeometries(pieces)!;
    pieces.forEach((g) => g.dispose());
    low.push({ geometry, material: material({ color }) });
  }
  if (kind === 'return') {
    coarse('#63766a', [[0, 0.62, 0, 0.5, 1.24, 0.44]]);
    coarse('#29312d', [[0, 0.97, 0.235, 0.414, 0.155, 0.02]]);
    coarse('#adb3ac', [[0, 1.067, 0.252, 0.47, 0.045, 0.094]]);
  } else if (kind === 'bbq') {
    coarse('#85877e', [[0, 0.46, 0, 0.74, 0.85, 0.87]]);
    coarse('#adb3ac', [[0, 0.94, 0, 0.9, 0.08, 1.1]]);
    coarse('#29312d', [[0, 0.984, 0, 0.68, 0.014, 0.78]]);
  } else {
    // Head is -Z in glTF; rotate the whole model to face consistently on either gallery.
    coarse('#a07a4a', [
      [-0.473, 0.335, 0, 0.054, 0.16, 1.7],
      [0.473, 0.335, 0, 0.054, 0.16, 1.7],
      [0, 0.335, -0.868, 0.946, 0.16, 0.064],
      [0, 0.335, 0.868, 0.946, 0.16, 0.064],
      ...[-0.435, 0.435].flatMap((x) =>
        [-0.785, 0.785].map((z) => [x, 0.185, z, 0.065, 0.37, 0.065]),
      ),
      [0, 0.79, -0.855, 0.94, 0.32, 0.055],
    ]);
    coarse('#ccc4ad', [
      [0, 0.515, 0, 0.922, 0.215, 1.688],
      [0, 0.69, -0.57, 0.68, 0.12, 0.384],
    ]);
    coarse('#4e6155', [
      [0, 0.645, 0.28, 0.96, 0.04, 1.23],
      [0, 0.6, 0.875, 0.96, 0.13, 0.02],
      [-0.478, 0.6, 0.28, 0.02, 0.13, 1.23],
      [0.478, 0.6, 0.28, 0.02, 0.13, 1.23],
    ]);
  }
  function releaseMeshes() {
    for (const mesh of meshes) {
      group.remove(mesh);
      mesh.dispose();
    }
    meshes.length = 0;
  }
  function rebuildMeshes() {
    releaseMeshes();
    for (const [kind, parts] of [
      ['low', low],
      ['high', high],
    ] as const)
      for (const part of parts) {
        const mesh = new T.InstancedMesh(
          part.geometry,
          part.material,
          Math.max(1, placements.length),
        );
        mesh.name = `${group.name}-${kind}`;
        mesh.userData.bedLod = kind;
        mesh.count = 0;
        mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
        meshes.push(mesh);
        group.add(mesh);
      }
    dirty = true;
  }
  // Keep low beds visible during loading or if the asset cannot be fetched.
  if (assetUrl)
    void new GLTFLoader()
      .loadAsync(assetUrl)
      .then((gltf) => {
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse((o) => {
          if (!(o instanceof T.Mesh)) return;
          const source = o.material as T.MeshStandardMaterial;
          if (disposed) {
            o.geometry.dispose();
            source.map?.dispose();
            source.dispose();
            return;
          }
          const geometry = o.geometry.clone().applyMatrix4(o.matrixWorld);
          const m = material({ color: source.color, map: source.map });
          m.name = `${kind} ${source.name}`;
          if (source.map) maps.add(source.map);
          high.push({ geometry, material: m });
          o.geometry.dispose();
          source.dispose();
        });
        if (!disposed) rebuildMeshes();
      })
      .catch((error) => {
        if (!disposed)
          console.warn(
            `Detailed ${kind} unavailable; using the lightweight model.`,
            error,
          );
      });
  function update(eye: T.Vector3, shiftY: number) {
    group.position.y = shiftY;
    if (!dirty && shiftY === lastShift && lastEye.distanceToSquared(eye) < 0.25)
      return;
    const rebuilt = dirty;
    dirty = false;
    lastEye.copy(eye);
    lastShift = shiftY;
    const near: BedPlacement[] = [],
      far: BedPlacement[] = [];
    const indices: number[] = [];
    placements.forEach((p, i) => {
      if (high.length && detailedBed(p, eye, shiftY)) {
        near.push(p);
        indices.push(i);
      } else far.push(p);
    });
    const nextMembership = indices.join(',');
    if (!rebuilt && membership === nextMembership) return;
    membership = nextMembership;
    for (const mesh of meshes) {
      const items = mesh.userData.bedLod === 'high' ? near : far;
      items.forEach((p, i) => {
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(0, p.side > 0 ? Math.PI : 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.count = items.length;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }
  return {
    set(next: BedPlacement[]) {
      placements = next;
      rebuildMeshes();
    },
    update,
    dispose() {
      disposed = true;
      releaseMeshes();
      scene.remove(group);
      for (const part of [...low, ...high]) {
        part.geometry.dispose();
        part.material.dispose();
      }
      maps.forEach((t) => {
        (t.source.data as ImageBitmap)?.close?.();
        t.dispose();
      });
    },
  };
}

/** Retain the bed API while sharing spatial instancing with other furnishings. */
export const createBeds = createFurniture;

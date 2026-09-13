import {ROOM_VOLUME} from './room-layout.ts';
import * as T from 'three';
import { HEIGHT, OUTER } from './physics.ts';
const NX = 60,
  NY = 24,
  NZ = 16,
  DEPTH = ROOM_VOLUME.depth,
  RADIUS = 0.75,
  SAMPLES = 32;
/** Conservative room geometry in canonical coordinates, independent of spawn/rebase. */
export function roomOccluders(
  boxes: readonly (readonly number[])[],
  origin: T.Vector3,
) {
  const volume = new T.Box3(
    new T.Vector3(0, -RADIUS, -RADIUS),
    new T.Vector3(ROOM_VOLUME.width, HEIGHT + RADIUS, DEPTH + RADIUS),
  );
  const result: T.Box3[] = [];
  for (const [x, y, z, w, h, d] of boxes) {
    if (Math.max(w, h, d) < 0.12) continue;
    const b = new T.Box3().setFromCenterAndSize(
      new T.Vector3(x - origin.x, y - origin.y, z - OUTER),
      new T.Vector3(w, h, d),
    );
    // Normalize arithmetic roundoff before boundary containment tests. Capture
    // authoring coordinates before float32 GPU instance transforms lose precision.
    for (const v of [b.min, b.max])
      for (const axis of ['x', 'y', 'z'] as const)
        v[axis] = Math.round(v[axis] * 1e6) / 1e6;
    if (b.intersectsBox(volume)) result.push(b);
  }
  return result;
}
/** One-time short-range spherical visibility against furniture/wall bounds. */
export function bakeRoomAO(bounds: readonly T.Box3[]) {
  const dirs = Array.from({ length: SAMPLES }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / SAMPLES,
      a = i * 2.399963229728653;
    return new T.Vector3(
      Math.sqrt(1 - y * y) * Math.cos(a),
      y,
      Math.sqrt(1 - y * y) * Math.sin(a),
    );
  });
  const data = new Uint8Array(NX * NY * NZ),
    p = new T.Vector3(),
    hit = new T.Vector3(),
    ray = new T.Ray();
  for (let z = 0; z < NZ; z++)
    for (let y = 0; y < NY; y++)
      for (let x = 0; x < NX; x++) {
        p.set(
          (x / (NX - 1)) * ROOM_VOLUME.width,
          (y / (NY - 1)) * HEIGHT,
          (z / (NZ - 1)) * DEPTH,
        );
        const nearby = bounds.filter(
          (b) => b.distanceToPoint(p) < RADIUS && !b.containsPoint(p),
        );
        let blocked = 0;
        for (const d of dirs) {
          ray.set(p, d);
          let nearest = RADIUS;
          for (const b of nearby) {
            if (ray.intersectBox(b, hit))
              nearest = Math.min(nearest, p.distanceTo(hit));
          }
          blocked += 1 - nearest / RADIUS;
        }
        data[(z * NY + y) * NX + x] = Math.round(255 * (1 - blocked / SAMPLES));
      }
  return data;
}
/** Modulate the existing irradiance in place: no new GPU textures or shader work. */
export function applyRoomAO(texture: T.Data3DTexture, ao: Uint8Array) {
  const { width, height, depth, data } = texture.image;
  const pixels = data as Uint8Array,
    visibility = ao;
  for (let z = 0; z < depth; z++)
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const ax = (x / (width - 1)) * (NX - 1),
          ay = (y / (height - 1)) * (NY - 1),
          az = (z / (depth - 1)) * (NZ - 1),
          ix = Math.floor(ax),
          iy = Math.floor(ay),
          iz = Math.floor(az);
        let v = 0;
        for (let dz = 0; dz < 2; dz++)
          for (let dy = 0; dy < 2; dy++)
            for (let dx = 0; dx < 2; dx++)
              v +=
                (visibility[
                  (Math.min(NZ - 1, iz + dz) * NY + Math.min(NY - 1, iy + dy)) *
                    NX +
                    Math.min(NX - 1, ix + dx)
                ] *
                  (dx ? ax - ix : 1 - ax + ix) *
                  (dy ? ay - iy : 1 - ay + iy) *
                  (dz ? az - iz : 1 - az + iz)) /
                255;
        const factor = 1 - 0.4 * (1 - v),
          offset = ((z * height + y) * width + x) * 4;
        for (let c = 0; c < 3; c++)
          pixels[offset + c] = Math.round(pixels[offset + c] * factor);
      }
  texture.needsUpdate = true;
}

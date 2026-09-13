import * as T from 'three';
import { HEIGHT, OUTER } from '../lib/game/physics.ts';
const NX = 60,
  NY = 24,
  NZ = 16,
  DEPTH = 5.5,
  RADIUS = 0.75,
  SAMPLES = 32;
/** Short-range static visibility bake against conservative room furniture bounds.
 * Applied gently to existing irradiance; no per-frame rays or screen-space pass. */
export class BakedRoomAO {
  enabled = { value: 0 };
  private bindings = new Map<
    T.Data3DTexture,
    {
      top: boolean;
      baked?: T.Data3DTexture;
      uniform: T.IUniform<T.Data3DTexture>;
    }
  >();
  private originals = new WeakMap<T.Data3DTexture, T.Data3DTexture>();
  private attached = new WeakSet<T.Material>();
  private cache = new Map<boolean, T.Data3DTexture>();
  bakeMs = 0;
  prepare(scene: T.Scene, top: boolean) {
    if (!this.cache.has(top)) {
      const start = performance.now(),
        bounds: T.Box3[] = [];
      const matrix = new T.Matrix4();
      const volume = new T.Box3(
        new T.Vector3(0, -RADIUS, OUTER - RADIUS),
        new T.Vector3(30, HEIGHT + RADIUS, OUTER + DEPTH + RADIUS),
      );
      scene.children[0].traverse((o) => {
        if (!(o instanceof T.InstancedMesh)) return;
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        if (materials.some((m) => m.transparent)) return;
        o.geometry.computeBoundingBox();
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, matrix);
          matrix.premultiply(o.matrixWorld);
          const b = o.geometry.boundingBox!.clone().applyMatrix4(matrix);
          if (!b.intersectsBox(volume)) continue;
          const size = b.getSize(new T.Vector3());
          if (Math.max(size.x, size.y, size.z) < 0.12) continue;
          bounds.push(b);
        }
      });
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
              (x / (NX - 1)) * 30,
              (y / (NY - 1)) * HEIGHT,
              OUTER + (z / (NZ - 1)) * DEPTH,
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
            data[(z * NY + y) * NX + x] = Math.round(
              255 * (1 - blocked / SAMPLES),
            );
          }
      const t = new T.Data3DTexture(data, NX, NY, NZ);
      t.format = T.RedFormat;
      t.type = T.UnsignedByteType;
      t.minFilter = t.magFilter = T.LinearFilter;
      t.unpackAlignment = 1;
      t.needsUpdate = true;
      this.cache.set(top, t);
      this.bakeMs = performance.now() - start;
    }
    for (const [original, binding] of this.bindings)
      this.updateBinding(original, binding);
    scene.traverse((o) => {
      if (!(o instanceof T.Mesh)) return;
      if (
        o.parent !== scene.children[0] &&
        o.parent?.name !== 'stair-visible-chunks'
      )
        return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (this.attached.has(m) || !(m instanceof T.MeshBasicMaterial))
          continue;
        this.attached.add(m);
        const previous = m.onBeforeCompile.bind(m),
          key = m.customProgramCacheKey.bind(m);
        m.onBeforeCompile = (shader, renderer) => {
          previous(shader, renderer);
          for (const name of [
            'roomPositive',
            'roomNegative',
            'topRoomPositive',
            'topRoomNegative',
          ]) {
            const value = shader.uniforms[name]?.value;
            if (!(value instanceof T.Data3DTexture)) continue;
            const original = this.originals.get(value) ?? value;
            let binding = this.bindings.get(original);
            if (!binding) {
              binding = {
                top: name.startsWith('top'),
                uniform: { value: original },
              };
              this.bindings.set(original, binding);
            }
            this.updateBinding(original, binding);
            shader.uniforms[name] = binding.uniform;
          }
        };
        m.customProgramCacheKey = () => key() + '-static-ao-volume';
        m.needsUpdate = true;
      }
    });
  }
  private updateBinding(
    original: T.Data3DTexture,
    binding: {
      top: boolean;
      baked?: T.Data3DTexture;
      uniform: T.IUniform<T.Data3DTexture>;
    },
  ) {
    const ao = this.cache.get(binding.top);
    if (ao && !binding.baked) {
      const { width, height, depth, data } = original.image;
      const pixels = new Uint8Array(data as Uint8Array),
        visibility = ao.image.data as Uint8Array;
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
                      (Math.min(NZ - 1, iz + dz) * NY +
                        Math.min(NY - 1, iy + dy)) *
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
      const baked = original.clone();
      // Texture.clone shares its Source; detach so the comparison retains the original bake.
      baked.source = new T.Source({ data: pixels, width, height, depth });
      baked.needsUpdate = true;
      binding.baked = baked;
      this.originals.set(baked, original);
    }
    binding.uniform.value =
      this.enabled.value && binding.baked ? binding.baked : original;
  }
}

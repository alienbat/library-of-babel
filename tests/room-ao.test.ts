import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import { applyRoomAO, bakeRoomAO, roomOccluders } from '../lib/game/room-ao.ts';
import { HEIGHT, OUTER, PERIOD } from '../lib/game/physics.ts';
void test('room AO is translation invariant and only darkens irradiance RGB', () => {
  const near = roomOccluders(
    [[15, -0.1, OUTER + 2.75, 30, 0.2, 5.5]],
    new T.Vector3(),
  );
  const far = roomOccluders(
    [[15 + PERIOD * 20, -0.1 + HEIGHT * 50, OUTER + 2.75, 30, 0.2, 5.5]],
    new T.Vector3(PERIOD * 20, HEIGHT * 50, 0),
  );
  assert.deepEqual(far, near, 'floating origins cannot change the bake');
  const ao = bakeRoomAO(near),
    empty = bakeRoomAO([]);
  assert.ok(
    empty.every((v) => v === 255),
    'empty space is unoccluded',
  );
  assert.ok(
    ao.some((v) => v < 255),
    'floor creates contact occlusion',
  );
  const pixels = new Uint8Array(2 * 24 * 2 * 4).fill(200);
  for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255;
  const texture = new T.Data3DTexture(pixels, 2, 24, 2);
  applyRoomAO(texture, empty);
  assert.ok(pixels.every((v, i) => v === (i % 4 === 3 ? 255 : 200)));
  applyRoomAO(texture, ao);
  assert.ok(pixels.some((v, i) => i % 4 !== 3 && v < 200));
  assert.ok(pixels.every((v, i) => (i % 4 === 3 ? v === 255 : v <= 200)));
  texture.dispose();
});

void test('world contact bake survives shifted starts and is not applied twice', async () => {
  const { createWorld } = await import('../lib/game/world.ts');
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const context = new Proxy({}, { get: () => () => {}, set: () => true });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement: () => ({ width: 0, height: 0, getContext: () => context }),
    },
  });
  const capture = (x: number, y: number, top: boolean, bottom = false) => {
    const scene = new T.Scene(),
      world = createWorld(scene);
    try {
      if (top) world.setLimits({ maxY: y + HEIGHT - 0.34 });
      if (bottom) world.setLimits({ minY: y });
      world.update(x, y);
      const read = () => {
        let result: Uint8Array | undefined;
        scene.children[0].traverse((o) => {
          if (result || !(o instanceof T.Mesh)) return;
          for (const m of Array.isArray(o.material)
            ? o.material
            : [o.material]) {
            const shader = {
              uniforms: {},
              vertexShader: T.ShaderLib.basic.vertexShader,
              fragmentShader: T.ShaderLib.basic.fragmentShader,
            } as T.WebGLProgramParametersWithUniforms;
            m.onBeforeCompile(shader, {} as T.WebGLRenderer);
            const t = shader.uniforms[top ? 'topRoomPositive' : 'roomPositive']
              ?.value as T.Data3DTexture | undefined;
            if (t) {
              result = new Uint8Array(t.image.data as Uint8Array);
              break;
            }
          }
        });
        assert.ok(result);
        return result;
      };
      const initial = read();
      world.update(x + PERIOD, y);
      assert.ok(
        Buffer.from(read()).equals(Buffer.from(initial)),
        'rebuild cannot double-darken the bake',
      );
      return initial;
    } finally {
      world.dispose();
    }
  };
  try {
    assert.ok(
      Buffer.from(capture(0, 0, false, true)).equals(
        Buffer.from(capture(0, 0, false)),
      ),
      'bottom start must not change the normal bake',
    );
    assert.ok(
      Buffer.from(capture(0, 0, false)).equals(
        Buffer.from(capture(PERIOD * 3, HEIGHT * 10, false)),
      ),
      'normal bake must match translated start',
    );
    assert.ok(
      Buffer.from(capture(0, 0, true)).equals(
        Buffer.from(capture(PERIOD * 3, HEIGHT * 10, true)),
      ),
      'top bake must match translated start',
    );
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'document', descriptor);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BAY, OUTER, PERIOD, allowed } from '../lib/game/physics.ts';
import { ROWS, BOOKS_PER_ROW } from '../lib/game/books.ts';
async function asset(name: string) {
  const b = readFileSync(
    new URL(
      `../models/blender/library-furnishings/${name}.glb`,
      import.meta.url,
    ),
  );
  return new GLTFLoader().parseAsync(
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
    '',
  );
}
void test('Blender shelf boards preserve the exact existing book capacity and support envelope', async () => {
  assert.equal(BAY, 22.86);
  assert.equal(ROWS, 8);
  assert.equal(BOOKS_PER_ROW, 570);
  for (const [name, expected] of [
    ['ShelfBoard', [BAY, 0.04, 0.5]],
    ['ShelfUpright', [0.055, 3.25, 0.46]],
  ] as const) {
    const gltf = await asset(name),
      bounds = new T.Box3().setFromObject(gltf.scene),
      size = bounds.getSize(new T.Vector3()),
      center = bounds.getCenter(new T.Vector3());
    expected.forEach((v, i) =>
      assert.ok(Math.abs(size.getComponent(i) - v) < 0.00001),
    );
    assert.ok(center.length() < 0.00001);
    if (name === 'ShelfBoard')
      for (let row = 0; row < ROWS; row++)
        assert.ok(
          Math.abs(
            0.11 + row * 0.39 + bounds.max.y - (0.3 + row * 0.39 - 0.34 / 2),
          ) < 0.00001,
          'books rest on unchanged support heights',
        );
  }
});
void test('furnishings remain compact shared meshes with no runtime lights or external resources', async () => {
  for (const name of ['BBQ', 'Return']) {
    const gltf = await asset(name);
    let triangles = 0,
      meshes = 0;
    gltf.scene.traverse((o) => {
      assert.ok(!(o instanceof T.Light));
      if (o instanceof T.Mesh) {
        meshes++;
        triangles +=
          (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
      }
    });
    assert.ok(meshes <= 5);
    assert.ok(triangles < 5000);
    const bounds = new T.Box3().setFromObject(gltf.scene),
      size = bounds.getSize(new T.Vector3());
    assert.ok(size.x <= (name === 'BBQ' ? 0.90001 : 0.50001));
    assert.ok(size.z <= (name === 'BBQ' ? 1.10001 : 0.52001));
  }
});

void test('book returns block their footprint without obstructing the gallery aisle on either side', () => {
  for (const side of [-1, 1])
    for (const offset of [-PERIOD, 0, PERIOD]) {
      assert.equal(allowed(offset + 21.43, side * (OUTER - 0.4)), false);
      assert.equal(allowed(offset + 21.43, side * (OUTER - 1)), true);
      assert.equal(allowed(offset + 20.6, side * (OUTER - 0.4)), true);
    }
});

void test('wall-side food dispenser leaves its former rail-side footprint and bedroom entrance clear',()=>{
  for(const side of [-1,1])for(const offset of [-PERIOD,0,PERIOD]){
    assert.equal(allowed(offset+17,side*(OUTER-.8)),false);
    assert.equal(allowed(offset+17,side*(OUTER-1.5)),true);
    assert.equal(allowed(offset+17.85,side*16),true);
    assert.equal(allowed(offset+19,side*(OUTER-.3)),true);
    assert.equal(allowed(offset+20.6,side*(OUTER-.3)),true);
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as T from 'three';
import {
  mirrorBathroomGeometry,
  createBathroomFixtures,
} from '../lib/game/bathroom-fixtures.ts';
import { showerFloorHeight } from '../lib/game/room-layout.ts';
import {
  floorAt,
  supportBelow,
  fallStep,
  move,
  OUTER,
  HEIGHT,
  PERIOD,
} from '../lib/game/physics.ts';
void test('mirrored bathroom meshes preserve outward normals and winding', () => {
  const original = new T.BoxGeometry(1, 2, 3).translate(2, 1, -1),
    g = mirrorBathroomGeometry(original);
  const p = g.getAttribute('position'),
    n = g.getAttribute('normal'),
    idx = g.index!;
  for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i),
      b = idx.getX(i + 1),
      c = idx.getX(i + 2);
    const va = new T.Vector3().fromBufferAttribute(p, a),
      vb = new T.Vector3().fromBufferAttribute(p, b),
      vc = new T.Vector3().fromBufferAttribute(p, c);
    assert.ok(
      vb
        .sub(va)
        .cross(vc.sub(va))
        .dot(new T.Vector3().fromBufferAttribute(n, a)) > 0,
    );
  }
  g.dispose();
  original.dispose();
  const scene = new T.Scene(),
    fixtures = createBathroomFixtures(
      scene,
      (p) => new T.MeshBasicMaterial({ color: p.color }),
    );
  fixtures.set([
    { x: 27, y: 0, z: OUTER + 2.5, side: 1 },
    { x: 27, y: 0, z: -OUTER - 2.5, side: -1 },
  ]);
  fixtures.update(new T.Vector3(27, 1, OUTER + 2), 0);
  assert.equal(scene.children[0].children.length, 6);
  for (const m of scene.children[0].children)
    assert.equal((m as T.InstancedMesh).count, 1);
  fixtures.dispose();
  assert.equal(scene.children.length, 0);
});
void test('shower recess supports walking and falling on either gallery and shifted floors', () => {
  assert.ok(showerFloorHeight(29.18, 1.25) > showerFloorHeight(29.1, 1.25));
  assert.ok(showerFloorHeight(29.1, 1.25) > showerFloorHeight(29, 1.25));
  assert.equal(showerFloorHeight(27, 1.25), 0);
  for (const side of [-1, 1])
    for (const offset of [-PERIOD, 0, PERIOD])
      for (const level of [-HEIGHT, 0, HEIGHT]) {
        const p = { x: 29 + offset, y: level + 1, z: side * (OUTER + 1.25) },
          height = level + showerFloorHeight(29, 1.25);
        assert.ok(Math.abs(floorAt(p.x, p.z, level) - height) < 1e-8);
        assert.ok(Math.abs(supportBelow(p)! - height) < 1e-8);
        const result = fallStep(p, 0, 1);
        assert.equal(result.landed, true);
        assert.ok(Math.abs(result.position.y - height) < 1e-8);
        const walked = move({ x: 28 + offset, y: level, z: p.z }, 1, 0);
        assert.ok(
          Math.abs(walked.x - p.x) < 1e-6 && Math.abs(walked.y - height) < 1e-6,
        );
      }
});
void test('bathroom export has shared materials and embedded spray texture without studio objects', () => {
  const b = readFileSync(
    new URL('../models/blender/bathroom/bathroom.glb', import.meta.url),
  );
  const g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
  assert.equal(g.meshes.length, 7);
  assert.equal(g.materials.length, 7);
  assert.ok(
    g.images.every(
      (i: { bufferView?: number; uri?: string }) =>
        i.bufferView !== undefined && !i.uri,
    ),
  );
  assert.ok(!g.cameras && !g.extensions?.KHR_lights_punctual);
});

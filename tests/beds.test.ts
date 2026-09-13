import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as T from 'three';
import { createBeds, detailedBed } from '../lib/game/beds.ts';
void test('bed detail uses spatial distance across floors and translated windows', () => {
  const p = { x: 0, y: 0, z: 0, side: 1 };
  assert.ok(detailedBed(p, new T.Vector3(0, 4.5, 0), 0));
  assert.ok(detailedBed(p, new T.Vector3(0, 400.5, 0), 400));
  assert.equal(detailedBed(p, new T.Vector3(0, 20, 0), 0), false);
  const scene = new T.Scene(),
    beds = createBeds(
      scene,
      (p) => new T.MeshBasicMaterial({ color: p.color }),
    );
  beds.set([p, { ...p, x: 20, side: -1 }]);
  beds.update(new T.Vector3(0, 1, 0), 0);
  assert.equal(
    scene.children[0].children.length,
    3,
    'fallback has only three shared material batches',
  );
  for (const o of scene.children[0].children)
    assert.equal((o as T.InstancedMesh).count, 2);
  beds.update(new T.Vector3(0, 401, 0), 400);
  assert.equal(scene.children[0].position.y, 400);
  beds.dispose();
  assert.equal(scene.children.length, 0);
});
void test('bed GLB remains self-contained with bounded shared mesh batches', () => {
  const b = readFileSync(
    new URL('../models/blender/bed/bed.glb', import.meta.url),
  );
  assert.equal(b.toString('ascii', 0, 4), 'glTF');
  const g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
  assert.equal(g.meshes.length, 6);
  assert.equal(g.materials.length, 6);
  assert.ok(
    g.images.every(
      (i: { bufferView?: number; uri?: string }) =>
        i.bufferView !== undefined && !i.uri,
    ),
  );
  assert.ok(!g.cameras && !g.extensions?.KHR_lights_punctual);
  const triangles = g.meshes
    .flatMap((m: { primitives: { indices: number }[] }) => m.primitives)
    .reduce(
      (n: number, p: { indices: number }) =>
        n + g.accessors[p.indices].count / 3,
      0,
    );
  assert.ok(triangles < 11000);
});

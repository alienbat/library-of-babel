import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
void test('Cycles prototype exports self-contained baked surfaces without runtime AO or lights',()=>{
  const buffer=readFileSync(new URL('../public/raytrace-prototype/room.glb',import.meta.url));
  assert.equal(buffer.toString('utf8',0,4),'glTF');assert.equal(buffer.readUInt32LE(8),buffer.length);
  const gltf=JSON.parse(buffer.toString('utf8',20,20+buffer.readUInt32LE(12)));
  assert.ok(!gltf.extensions?.KHR_lights_punctual);
  assert.ok(gltf.materials.every((m:{occlusionTexture?:unknown})=>!m.occlusionTexture));
  assert.equal(gltf.images.length,3,'architecture, beds and shelves have separate baked atlases');
  assert.ok(gltf.images.every((image:{bufferView?:number;uri?:string})=>Number.isInteger(image.bufferView)&&!image.uri));
  assert.ok(gltf.meshes.every((mesh:{primitives:{attributes:Record<string,number>}[]})=>mesh.primitives.every(p=>Number.isInteger(p.attributes.POSITION)&&Number.isInteger(p.attributes.TEXCOORD_0))));
  const info=JSON.parse(readFileSync(new URL('../public/raytrace-prototype/bake-info.json',import.meta.url),'utf8'));
  assert.equal(info.worldStrength,0);assert.equal(info.ao,false);assert.ok(info.diffuseBounces>1);assert.ok(info.denoised);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadLightField,type LightField} from '../lib/game/baked-light-field.ts';
import {bakeGalleryLighting} from '../lib/game/lighting.ts';
import {createBoundaryLighting} from '../lib/game/boundary-lighting.ts';
import * as T from 'three';
void test('all Cycles assets contain complete finite transport data without an added AO pass',()=>{
 for(const name of ['gallery','rooms','top','final','bottom','boundaryFloor','boundaryCeiling','boundaryWall']){
  const field=JSON.parse(readFileSync(new URL(`../lib/game/baked/${name}.json`,import.meta.url),'utf8')) as LightField;
  assert.equal(field.engine,'Blender Cycles');assert.equal(field.diffuseBounces,6);assert.equal(field.extraAO,false);assert.ok(field.samples>=768);
  const bake=loadLightField(field);
  for(const texture of [bake.positive,bake.negative]){
   const data=texture.image.data!;assert.equal(data.length,field.grid.reduce((a,b)=>a*b,4));
   let energy=0;for(let i=0;i<data.length;i++)if(i%4===3)assert.equal(data[i],255);else energy+=Number(data[i]);
   assert.ok(energy>0,`${name} contains light transport`);
  }
  bake.dispose();
 }
});
void test('zero source strength adds no ambient energy in gallery or terminal fields',()=>{
 const bake=bakeGalleryLighting(0),boundary=createBoundaryLighting(new T.Texture(),0);
 for(const t of [bake.positive,bake.negative,boundary.uniforms.boundaryLight.value]){
  const data=t.image.data!;for(let i=0;i<data.length;i++)if(i%4<3)assert.equal(data[i],0);
 }
 assert.deepEqual(boundary.uniforms.boundaryLightMean.value.toArray(),[0,0,0]);
 bake.dispose();boundary.dispose();
});

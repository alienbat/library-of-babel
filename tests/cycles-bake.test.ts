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
void test('gallery fixtures align with shelf units and retain half-length diffusers',async()=>{
 const {GALLERY_LIGHT_COUNT:count,GALLERY_LIGHT_LENGTH:length,GALLERY_LIGHT_PERIOD:period}=await import('../lib/game/gallery-fixtures.ts');
 assert.equal(count,8);assert.equal(length,.8);assert.equal(period*count,22.86);
});
void test('shelf-front lighting has no black top or base sampling strips',()=>{
 const field=JSON.parse(readFileSync(new URL('../lib/game/baked/gallery.json',import.meta.url),'utf8')) as LightField;
 const [nx,ny,nz]=field.grid,data=Buffer.from(field.negative,'base64');
 // Every shelf-front sample through the crown height must receive illumination.
 for(let y=0;y/(ny-1)*3.96<=3.33;y++)for(let x=0;x<nx;x++)
  assert.ok(data[(((nz-1)*ny+y)*nx+x)*4+2]>8,'a probe must not be buried in the opaque shelf proxy');
});

void test('boundary fields use corridor periods and cannot wrap across the chasm',()=>{
 for(const name of ['boundaryFloor','boundaryCeiling','boundaryWall']){
  const f=JSON.parse(readFileSync(new URL(`../lib/game/baked/${name}.json`,import.meta.url),'utf8'));
  assert.equal(f.boundaryFixtures,false);
  assert.equal(f.repeatPeriod,name==='boundaryWall'?3.96:2.8575);
  assert.ok(Math.abs(f.transverseSpan-(name==='boundaryWall'?18.8376:15.24))<1e-8);
  assert.deepEqual(f.grid,[32,1,128]);
 }
 const bake=createBoundaryLighting(new T.Texture());
 assert.equal(bake.uniforms.boundaryLight.value.wrapS,T.RepeatWrapping);
 assert.equal(bake.uniforms.boundaryLight.value.wrapT,T.ClampToEdgeWrapping);
 bake.dispose();
});

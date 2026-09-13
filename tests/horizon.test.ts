import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {createInfiniteHorizon,withHorizonFade,HORIZON_BLEND_START,HORIZON_BLEND_END} from '../lib/game/horizon.ts';
void test('infinite background is one camera-aligned triangle, fills only uncovered pixels and disposes cleanly',()=>{
  const scene=new T.Scene(),spines=new T.Texture(),volume=new T.Data3DTexture();
  const horizon=createInfiniteHorizon(scene,spines,volume);
  const mesh=scene.children[0] as T.Mesh<T.BufferGeometry,T.ShaderMaterial>;
  assert.equal(mesh.geometry.attributes.position.count,3);assert.equal(mesh.frustumCulled,false);
  assert.equal(mesh.material.depthWrite,false);assert.equal(mesh.material.depthTest,true);
  assert.ok(mesh.renderOrder>0);
  const camera=new T.PerspectiveCamera(90,2,.1,16000);camera.position.set(-800,2000,0);camera.rotation.x=Math.PI/2;camera.updateMatrixWorld();horizon.update(camera);
  assert.deepEqual(mesh.material.uniforms.cameraWorld.value,camera.matrixWorld);
  assert.deepEqual(mesh.material.uniforms.inverseProjection.value,camera.projectionMatrixInverse);
  assert.ok(mesh.material.fragmentShader.includes('dFdx(ray)'));
  assert.ok(!mesh.material.fragmentShader.includes('min(1.e7'));
  assert.ok(!mesh.material.fragmentShader.includes('discard'));
  horizon.dispose();assert.equal(scene.children.length,0);spines.dispose();volume.dispose();
});
void test('distant handoff preserves source shading and reaches background before the geometry boundary',()=>{
  const source=new T.MeshBasicMaterial();source.onBeforeCompile=shader=>{shader.uniforms.original={value:1};};
  const fade=withHorizonFade(source);
  const shader={uniforms:{},vertexShader:T.ShaderLib.basic.vertexShader,fragmentShader:T.ShaderLib.basic.fragmentShader} as T.WebGLProgramParametersWithUniforms;
  fade.onBeforeCompile(shader,{} as T.WebGLRenderer);
  assert.equal(shader.uniforms.original.value,1);
  assert.ok(shader.fragmentShader.includes('length(delta)'));
  assert.ok(shader.fragmentShader.includes('discard'));
  assert.ok(HORIZON_BLEND_START>400&&HORIZON_BLEND_END<9000);
  assert.ok(!source.customProgramCacheKey().includes('infinite-handoff'));
  fade.dispose();source.dispose();
});

void test('horizon averages energy in linear light and grazing decks occlude shelves',async()=>{
  const {linearPixelMean,horizontalCoverage,galleryAverages}=await import('../lib/game/horizon-average.ts');
  const {bakeGalleryLighting}=await import('../lib/game/lighting.ts');
  const {HEIGHT}=await import('../lib/game/physics.ts');
  const mean=linearPixelMean([0,0,0,255,255,255,255,255]);
  assert.equal(mean.r,.5);assert.equal(mean.g,.5);assert.equal(mean.b,.5);
  assert.equal(horizontalCoverage(0,1),0);
  assert.equal(horizontalCoverage(1,0),1-.34/HEIGHT);
  assert.equal(horizontalCoverage(-1,0),horizontalCoverage(1,0));
  const bake=bakeGalleryLighting(),averages=galleryAverages(new T.Texture(),bake.negative,bake.positive);
  for(const value of Object.values(averages))assert.ok([value.r,value.g,value.b].every(v=>Number.isFinite(v)&&v>=0));
  assert.notDeepEqual(averages.ceiling,averages.floor);
  bake.dispose();
});

void test('fresh arrival has the same unbounded horizon as returning from a corner',()=>{
  const scene=new T.Scene(),spines=new T.Texture(),volume=new T.Data3DTexture();
  const horizon=createInfiniteHorizon(scene,spines,volume);
  const material=(scene.children[0] as T.Mesh<T.BufferGeometry,T.ShaderMaterial>).material;
  const initial=material.uniforms.corner.value.clone() as T.Vector4;
  horizon.setLimits({minX:0,minY:0});
  assert.deepEqual(material.uniforms.corner.value.toArray(),[0,0,1,1]);
  horizon.setLimits({});
  assert.deepEqual(initial.toArray(),material.uniforms.corner.value.toArray());
  assert.deepEqual(initial.toArray(),[0,0,0,0]);
  horizon.dispose();spines.dispose();volume.dispose();
});

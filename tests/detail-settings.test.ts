import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {detailRadius,detailCells,shelfLod} from '../lib/game/shelf-lod.ts';
import {createCeilingLights} from '../lib/game/ceiling-lights.ts';
import {OUTER} from '../lib/game/physics.ts';
void test('Low and High select 32/100 metre book windows and update the shader without recompiling',()=>{
  assert.equal(detailRadius('low'),32);assert.equal(detailRadius('high'),100);
  const eye=new T.Vector3(35,75,OUTER-1);
  assert.ok(!detailCells(eye,{},32).some(c=>c.level===0));
  assert.ok(detailCells(eye,{},100).some(c=>c.level===0));
  const radius={value:32},m=shelfLod(new T.MeshBasicMaterial(),{value:eye},radius);
  const shader={uniforms:{},vertexShader:T.ShaderLib.basic.vertexShader,fragmentShader:T.ShaderLib.basic.fragmentShader} as T.WebGLProgramParametersWithUniforms;
  m.onBeforeCompile(shader,{} as T.WebGLRenderer);radius.value=100;
  assert.equal(shader.uniforms.bookDetailRadius.value,100);m.dispose();
});
void test('ceiling light exports preserve emitter bounds; distant model has exactly 12 triangles',async()=>{
  for(const name of ['ceiling-light','ceiling-light-low']){
    const b=readFileSync(new URL(`../models/blender/ceiling-light/${name}.glb`,import.meta.url));
    const gltf=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
    const size=new T.Box3().setFromObject(gltf.scene).getSize(new T.Vector3());
    [1.6,.035,.28].forEach((v,i)=>assert.ok(Math.abs(size.getComponent(i)-v)<1e-5));
    let triangles=0;gltf.scene.traverse(o=>{assert.ok(!(o instanceof T.Light));if(o instanceof T.Mesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});
    if(name.endsWith('low'))assert.equal(triangles,12);else assert.ok(triangles>12&&triangles<500);
  }
});
void test('light loading fallback is instanced and follows rebased floors',()=>{
  const scene=new T.Scene(),material=new T.MeshBasicMaterial(),lights=createCeilingLights(scene,material);
  lights.set([[0,3.58,0,1.6,.035,.28],[0,103.58,0,1.6,.035,.28]]);
  lights.update(new T.Vector3(),1000,100);
  const group=scene.getObjectByName('ceiling-light-lods')!;
  assert.equal(group.position.y,1000);assert.equal((group.children[0] as T.InstancedMesh).count,2);
  lights.dispose();assert.equal(scene.children.length,0);material.dispose();
});

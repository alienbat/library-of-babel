import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {createWorld} from '../lib/game/world.ts';

void test('distant cache survives movement, with unchanged book detail and conservative culling',()=>{
  // Exercise scene construction only; this is not a WebGL or browser visual test.
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'document');
  const context=new Proxy({}, {get:()=>()=>{},set:()=>true});
  Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({width:0,height:0,getContext:()=>context})}});
  const scene=new T.Scene();const world=createWorld(scene);
  try {
    const camera=new T.PerspectiveCamera(75,16/9,.1,16000);
    camera.position.set(30,1.68,16.94);
    world.update(30,0,camera);
    const horizon=scene.children[1],cached=horizon.children.slice();
    let books=0;
    scene.traverse(object=>{
      if(object instanceof T.InstancedMesh&&Array.isArray(object.material)&&object.material.length===2){
        const gold=object.material[1] as T.MeshStandardMaterial;
        if(gold.metalness===.35){
          books+=object.count;
          assert.deepEqual(object.geometry.groups.map((g:{count:number})=>g.count),[24,12]);
          const index=object.geometry.index!,normal=object.geometry.attributes.normal;
          for(let i=24;i<36;i++)assert.equal(Math.abs(normal.getY(index.getX(i))),1);
        }
      }
    });
    assert.equal(books,36480,'nearby individual book geometry must remain intact');
    const hidden=cached.filter(m=>!m.visible).length;
    assert.ok(hidden>cached.length/2,'looking across the chasm should cull out-of-view floor bands');
    const disposed:string[]=[];
    for(const m of cached)if(m instanceof T.Mesh){m.geometry.addEventListener('dispose',()=>disposed.push(m.uuid));}
    camera.position.set(54,5.64,16.94);world.update(54,3.96,camera);
    assert.deepEqual(horizon.children,cached,'crossing a bay must reuse the distant meshes');
    assert.equal(horizon.position.x,45.72);assert.equal(horizon.position.y,3.96);
    assert.deepEqual(disposed,[],'cached geometry must remain live');
    let optimized=0;
    for(const mesh of cached)if(mesh instanceof T.Mesh){
      for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
        if(material.customProgramCacheKey()==='distant-without-local-point-lights-v1'){
          const shader={fragmentShader:'#include <lights_fragment_begin>'} as T.WebGLProgramParametersWithUniforms;
          material.onBeforeCompile(shader,{} as T.WebGLRenderer);
          assert.ok(shader.fragmentShader.includes('#if 0'));
          assert.ok(shader.fragmentShader.includes('NUM_DIR_LIGHTS'));
          optimized++;
        }
      }
    }
    assert.ok(optimized>0);
  } finally {
    world.dispose();
    if(descriptor)Object.defineProperty(globalThis,'document',descriptor);else Reflect.deleteProperty(globalThis,'document');
  }
});

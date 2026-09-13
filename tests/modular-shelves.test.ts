import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
const read=(name:string)=>readFileSync(new URL(`../models/blender/shelves/${name}.glb`,import.meta.url));
void test('modular Blender frames retain support heights, seamless pitch and economical geometry',async()=>{
  for(const name of ['ShelfModule','ShelfModuleStart','ShelfBoard','ShelfUpright']){
    const b=read(name),gltf=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
    const bounds=new T.Box3().setFromObject(gltf.scene);let triangles=0;
    gltf.scene.traverse(o=>{assert.ok(!(o instanceof T.Light));if(o instanceof T.Mesh){triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
    assert.ok(triangles<800,'one low-poly frame, not book geometry embedded per export');
    if(name==='ShelfBoard'){
      assert.ok(Math.abs(bounds.max.x-22.86/2)<1e-5);assert.ok(Math.abs(bounds.min.x+22.86/2)<1e-5);
      assert.ok(Math.abs(bounds.max.y-.02)<1e-5);
    }
    if(name==='ShelfModuleStart')assert.ok(Math.abs(bounds.min.x+22.86/2)<1e-5,'no duplicated left support');
    assert.ok(Math.abs(bounds.max.z-.25)<1e-5&&Math.abs(bounds.min.z+.25)<1e-5,'all timber shares front/back planes');
  }
});
void test('rounded book retains exact envelope with only twenty triangles',()=>{
  const b=read('ShelfBook'),length=b.readUInt32LE(12),json=JSON.parse(b.subarray(20,20+length).toString());
  let triangles=0;
  for(const m of json.meshes)for(const p of m.primitives){triangles+=json.accessors[p.indices].count/3;const a=json.accessors[p.attributes.POSITION];
    for(let i=0;i<3;i++)assert.ok(a.min[i]>=-[.037,.34,.3][i]/2-1e-6&&a.max[i]<=[.037,.34,.3][i]/2+1e-6);
  }
  assert.equal(triangles,20);
});

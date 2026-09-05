import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {bookId} from '../lib/game/books.ts';
import {OUTER} from '../lib/game/physics.ts';
import {createWorld} from '../lib/game/world.ts';

void test('distant cache survives movement, with unchanged book detail and conservative culling',()=>{
  // Exercise scene construction only; this is not a WebGL or browser visual test.
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'document');
  const context=new Proxy({}, {get:()=>()=>{},set:()=>true});
  Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({width:0,height:0,getContext:()=>context})}});
  const scene=new T.Scene(),opened=new Set<string>();const world=createWorld(scene,opened);
  try {
    const camera=new T.PerspectiveCamera(75,16/9,.1,16000);
    camera.position.set(30,1.68,16.94);
    world.update(30,0,camera);
    // Check the actual rendered bed bounds against every nearby wall and bed.
    const beds:T.Box3[]=[],walls:T.Box3[]=[],matrix=new T.Matrix4();
    const position=new T.Vector3(),scale=new T.Vector3(),rotation=new T.Quaternion();
    scene.children[0].traverse(object=>{
      if(!(object instanceof T.InstancedMesh)||Array.isArray(object.material))return;
      const color=(object.material as T.MeshStandardMaterial).color.getHexString();
      if(color!=='854a3d'&&color!=='a8a69a')return;
      for(let i=0;i<object.count;i++){
        object.getMatrixAt(i,matrix);matrix.decompose(position,rotation,scale);
        if(position.x<15||position.x>29||position.y<0||position.y>3.6)continue;
        const bounds=new T.Box3().setFromCenterAndSize(position,scale);
        if(color==='a8a69a')walls.push(bounds);
        else if(Math.abs(scale.x-1)<.001&&Math.abs(scale.y-.14)<.001)beds.push(bounds);
      }
    });
    assert.equal(beds.length,14,'retain seven beds on each side');
    beds.forEach((bed,i)=>{
      for(const wall of walls)assert.equal(bed.intersectsBox(wall),false,'bed must clear every wall');
      for(const other of beds.slice(i+1))assert.equal(bed.intersectsBox(other),false,'beds need separate space');
    });
    for(const side of [-1,1]){
      let floorSurfaces=0,liningDepth=0,shelfDepth=0;
      scene.children[0].traverse(object=>{
        if(!(object instanceof T.InstancedMesh))return;
        const material=Array.isArray(object.material)?object.material[0]:object.material;
        const standard=material as T.MeshStandardMaterial;
        for(let i=0;i<object.count;i++){
          object.getMatrixAt(i,matrix);matrix.decompose(position,rotation,scale);
          if(position.z*side<0)continue;
          const depth=Math.abs(position.z)-OUTER;
          if(Math.abs(position.x-25)<scale.x/2&&Math.abs(depth-2.8)<scale.z/2&&Math.abs(position.y+scale.y/2)<1e-5)floorSurfaces++;
          if(Math.abs(position.y-1.8)<.001&&Math.abs(position.x-25)<.001&&depth<1&&standard.color.getHexString()==='a8a69a')liningDepth=depth+scale.z/2;
          if(Math.abs(position.y-1.62)<.001&&position.x-scale.x/2<28&&position.x+scale.x/2>23&&(standard.map?.image as {width?:number}|undefined)?.width===2048)shelfDepth=Math.max(shelfDepth,depth+scale.z/2);
        }
      });
      assert.equal(floorSurfaces,1,'bathroom has exactly one exposed floor surface, including the ceiling below');
      assert.ok(shelfDepth>0&&liningDepth>shelfDepth+.05,'solid inner wall conceals the gallery shelf backs');
    }
    const readLocation={level:0,side:1 as const,bay:1,row:3,book:120};
    const coloredCount=()=>{
      let count=0;const color=new T.Color();
      scene.children[0].traverse(object=>{if(object instanceof T.InstancedMesh&&object.instanceColor)for(let i=0;i<object.count;i++){object.getColorAt(i,color);if(color.r<.9)count++;}});
      return count;
    };
    assert.equal(coloredCount(),0);
    opened.add(bookId(readLocation));world.markOpened(readLocation);
    assert.equal(coloredCount(),1,'only the opened book changes color');
    const horizon=scene.children[1],cached=horizon.children.slice();
    let books=0;
    scene.traverse(object=>{
      if(object instanceof T.InstancedMesh&&Array.isArray(object.material)&&object.material.length===2){
        const gold=object.material[1] as T.MeshStandardMaterial;
        if(gold.name==='book-edges'){
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
    assert.equal(coloredCount(),0,'another floor must not inherit read colors');
    assert.equal(horizon.position.x,45.72);assert.equal(horizon.position.y,3.96);
    assert.deepEqual(disposed,[],'cached geometry must remain live');
    const nearMeshes=scene.children[0].children.slice();
    world.update(54,3.96*60,camera);
    assert.deepEqual(scene.children[0].children,nearMeshes,'vertical flight must reuse detailed geometry');
    assert.equal(scene.children[0].position.y,3.96*59);
    assert.equal(horizon.position.y,3.96*60);
    let baked=0;
    scene.traverse(object=>{if(object instanceof T.Mesh)for(const material of Array.isArray(object.material)?object.material:[object.material]){
      assert.ok(material instanceof T.MeshBasicMaterial||object.name==='infinite-gallery-horizon','scene uses unlit materials');
      if(material.customProgramCacheKey()==='baked-gallery-volume-v1'){
        const shader={uniforms:{},vertexShader:T.ShaderLib.basic.vertexShader,fragmentShader:T.ShaderLib.basic.fragmentShader} as T.WebGLProgramParametersWithUniforms;
        material.onBeforeCompile(shader,{} as T.WebGLRenderer);
        assert.ok(shader.fragmentShader.includes('texture(bakedPositive,uvw)'));
        assert.ok(!shader.fragmentShader.includes('lights_fragment_begin'));
        assert.ok(shader.vertexShader.includes('vBakedNormal'));
        baked++;
      }
    }});
    assert.ok(baked>0);
    world.update(30,0,camera);assert.equal(coloredCount(),1,'read color returns after leaving the geometry window');
  } finally {
    world.dispose();
    if(descriptor)Object.defineProperty(globalThis,'document',descriptor);else Reflect.deleteProperty(globalThis,'document');
  }
});

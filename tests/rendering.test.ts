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
    assert.ok(scene.children[0].children.every(object=>object instanceof T.InstancedMesh),'writing and clock use existing wall batches, without separate sign meshes');
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

      }
    });
    const bedBatch=scene.getObjectByName('dormitory-beds')!.children[0] as T.InstancedMesh;
    for(let i=0;i<bedBatch.count;i++){
      bedBatch.getMatrixAt(i,matrix);position.setFromMatrixPosition(matrix);
      if(position.x<15||position.x>29||Math.abs(position.y)>.001)continue;
      beds.push(new T.Box3(new T.Vector3(-.5,0,-.9),new T.Vector3(.5,.985,.9)).applyMatrix4(matrix));
    }
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
          if(Math.abs(position.x-27)<scale.x/2&&Math.abs(depth-2.8)<scale.z/2&&Math.abs(position.y+scale.y/2)<1e-5)floorSurfaces++;
          if(Math.abs(position.y-1.81)<.001&&Math.abs(position.x-27)<.001&&depth<1&&standard.color.getHexString()==='a8a69a')liningDepth=depth+scale.z/2;
          if(Math.abs(position.y-1.62)<.001&&position.x-scale.x/2<30&&position.x+scale.x/2>25&&(standard.name==='shelf-backing'||standard.name==='shelf-facade'))shelfDepth=Math.max(shelfDepth,depth+scale.z/2);
        }
      });
      assert.equal(floorSurfaces,1,'bathroom has exactly one exposed floor surface, including the ceiling below');
      assert.ok(shelfDepth>0&&liningDepth>shelfDepth+.05,'solid inner wall conceals the gallery shelf backs');
    }
    for(const side of [-1,1]){
      let sealedHeader=false;
      scene.children[0].traverse(object=>{
        if(!(object instanceof T.InstancedMesh)||Array.isArray(object.material))return;
        if((object.material as T.MeshBasicMaterial).color.getHexString()!=='a8a69a')return;
        for(let i=0;i<object.count;i++){
          object.getMatrixAt(i,matrix);matrix.decompose(position,rotation,scale);
          if(position.z*side<0||Math.abs(position.x-34.29)>.001)continue;
          if(Math.abs(position.y-scale.y/2-3.33)<.001){
            assert.ok(Math.abs(position.y+scale.y/2-3.62)<.001);
            assert.ok(Math.abs(Math.abs(position.z)-scale.z/2-OUTER)<.001);
            sealedHeader=true;
          }
        }
      });
      assert.ok(sealedHeader,'opaque white shelf header reaches the ceiling on both galleries');
    }
    let uprights=0,facades=0;
    scene.children[0].traverse(object=>{
      if(!(object instanceof T.InstancedMesh)||Array.isArray(object.material))return;
      const material=object.material as T.MeshStandardMaterial;
      for(let i=0;i<object.count;i++){
        object.getMatrixAt(i,matrix);matrix.decompose(position,rotation,scale);
        if(Math.abs(scale.x-.055)<1e-5&&Math.abs(scale.y-3.25)<1e-5)uprights++;
        if(material.name==='shelf-facade'){
          facades++;
          assert.ok(Math.abs(Math.abs(position.z)-scale.z/2-(OUTER-.29))<1e-5,'LOD face aligns with the front of the solid timber end');
        }
      }
    });
    assert.ok(uprights>0&&uprights<1000,'only exposed shelf-run ends have permanent timber panels');
    assert.ok(facades>3000,'other shelves use the shared board-and-book facade');
    const readLocation={level:0,side:1 as const,bay:1,row:3,book:120};
    const coloredCount=()=>{
      let count=0;const color=new T.Color();
      scene.getObjectByName('nearby-shelf-details')!.traverse(object=>{if(object instanceof T.InstancedMesh&&object.instanceColor)for(let i=0;i<object.count;i++){object.getColorAt(i,color);if(color.r<.9)count++;}});
      return count;
    };
    assert.equal(coloredCount(),0);
    opened.add(bookId(readLocation));world.markOpened(readLocation);
    assert.equal(coloredCount(),1,'only the opened book changes color');
    const colouredMeshes=scene.getObjectByName('nearby-shelf-details')!.children.filter((o):o is T.InstancedMesh=>o instanceof T.InstancedMesh&&!!o.instanceColor);
    const versions=new Map(colouredMeshes.map(m=>[m,m.instanceColor!.version]));
    // Simulate completed uploads before a single status change.
    for(const mesh of colouredMeshes)mesh.instanceColor!.clearUpdateRanges();
    world.markOpened(readLocation,false);
    assert.equal(coloredCount(),0);
    const changed=colouredMeshes.filter(m=>m.instanceColor!.version!==versions.get(m));
    assert.equal(changed.length,1,'a status change touches only its shelf buffer');
    assert.deepEqual(changed[0].instanceColor!.updateRanges,[{start:(readLocation.row*570+readLocation.book)*3,count:3}]);
    world.markOpened(readLocation);
    assert.equal(coloredCount(),1);
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
    assert.ok(books>0&&books<200000,'nearby book detail is bounded');
    const detail=scene.getObjectByName('nearby-shelf-details')!;
    const detailLevels=new Set<number>();
    detail.traverse(object=>{if(object instanceof T.InstancedMesh&&object.instanceColor){object.getMatrixAt(0,matrix);detailLevels.add(Math.round((matrix.elements[13]-.30)/3.96));}});
    assert.ok(detailLevels.size>1,'nearby floors also receive real book volumes');
    const hidden=cached.filter(m=>!m.visible).length;
    assert.ok(hidden>cached.length/2,'looking across the chasm should cull out-of-view floor bands');
    const disposed:string[]=[];
    for(const m of cached)if(m instanceof T.Mesh){m.geometry.addEventListener('dispose',()=>disposed.push(m.uuid));}
    camera.position.set(54,5.64,16.94);world.update(54,3.96,camera);
    assert.deepEqual(horizon.children,cached,'crossing a bay must reuse the distant meshes');
    assert.equal(coloredCount(),0,'opened tint disappears beyond 24 m even while detailed books remain');
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
    camera.position.set(30,1.68,16.94);world.update(30,0,camera);assert.equal(coloredCount(),1,'read color returns after leaving the geometry window');
    world.setLimits({minX:0,minY:0});world.update(30,0,camera);
    const boundaries=scene.getObjectByName('corner-boundaries')!;
    const cap=boundaries.children[1] as T.Mesh<T.PlaneGeometry,T.MeshBasicMaterial>;
    assert.equal(cap.material.name,'boundary-floor');
    const checkBoundaryHandoff=(material:T.MeshBasicMaterial)=>{
      const shader={uniforms:{},vertexShader:T.ShaderLib.basic.vertexShader,fragmentShader:T.ShaderLib.basic.fragmentShader} as T.WebGLProgramParametersWithUniforms;
      material.onBeforeCompile(shader,{} as T.WebGLRenderer);
      assert.ok(shader.uniforms.boundaryLight,'handoff preserves the boundary light bake');
      assert.ok(shader.fragmentShader.includes('floorPixels'),'boundary uses the same projected-size handoff as galleries');
      assert.ok(shader.fragmentShader.includes('discard'),'opaque wall depth cannot block the analytical horizon');
    };
    checkBoundaryHandoff(cap.material);
    checkBoundaryHandoff((boundaries.children[0] as T.Mesh<T.PlaneGeometry,T.MeshBasicMaterial>).material);
    assert.ok(cap.geometry.parameters.height<30.48,'cap does not overlap gallery decks');
    assert.ok(cap.position.y>0&&cap.position.y<.01);
    const fixtureFrames=boundaries.children[2] as T.InstancedMesh;
    assert.ok(fixtureFrames.count>0&&fixtureFrames.count<=108,'bounded instanced fixture window');
    const wall=(scene.children[0].children.find(object=>object instanceof T.InstancedMesh&&!Array.isArray(object.material)&&object.material.customProgramCacheKey()==='baked-wall-writing-v2') as T.InstancedMesh).material as T.MeshBasicMaterial;
    const writtenShader={uniforms:{},vertexShader:T.ShaderLib.basic.vertexShader,fragmentShader:T.ShaderLib.basic.fragmentShader} as T.WebGLProgramParametersWithUniforms;
    wall.onBeforeCompile(writtenShader,{} as T.WebGLRenderer);
    assert.equal(writtenShader.uniforms.writingBottom.value,0);
    assert.ok(writtenShader.uniforms.roomPositive.value instanceof T.Data3DTexture);
    assert.ok(writtenShader.fragmentShader.indexOf('diffuseColor.rgb=mix(diffuseColor.rgb,ink.rgb,ink.a)')<writtenShader.fragmentShader.indexOf('diffuseColor.rgb*=irradiance'),'wall ink receives the same baked lighting as its surface');
    world.setLimits({maxX:45.72,maxY:3.62});world.update(30,0,camera);
    assert.ok(Math.abs(writtenShader.uniforms.writingTop.value)<1e-8,'top-floor atlas switches to downstairs only');
    assert.equal(cap.material.name,'boundary-ceiling');assert.ok(cap.position.y<3.62);checkBoundaryHandoff(cap.material);
    world.setLimits({});world.update(30,0,camera);
    assert.equal(cap.visible,false);assert.equal(fixtureFrames.count,0);

  } finally {
    world.dispose();
    if(descriptor)Object.defineProperty(globalThis,'document',descriptor);else Reflect.deleteProperty(globalThis,'document');
  }
});

void test('top-floor ceilings seal both galleries and amenity rooms',()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'document');
  const context=new Proxy({}, {get:()=>()=>{},set:()=>true});
  Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({width:0,height:0,getContext:()=>context})}});
  const scene=new T.Scene(),world=createWorld(scene);
  try{
    world.setLimits({maxY:3.62});world.update(17,0);scene.updateMatrixWorld(true);
    for(const side of [-1,1])for(const [x,z] of [[17,OUTER-1.5],[35,OUTER-1.5],[8,OUTER+2],[19,OUTER+3.4],[17,OUTER+5.8],[23,OUTER+5.8],[27,OUTER+2.5]]){
      const ray=new T.Raycaster(new T.Vector3(x,2,side*z),new T.Vector3(0,1,0),0,3);
      const hits=ray.intersectObject(scene.children[0],true);
      assert.ok(hits.some(hit=>Math.abs(hit.point.y-3.62)<.03),'roof must exist above every top-floor room and gallery');
    }
  }finally{world.dispose();if(descriptor)Object.defineProperty(globalThis,'document',descriptor);else Reflect.deleteProperty(globalThis,'document');}
});

void test('opened tint has the same 24 m range at High and Low detail',()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'document');
  const context=new Proxy({}, {get:()=>()=>{},set:()=>true});
  Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({getContext:()=>context})}});
  const location={level:0,side:1 as const,bay:1,row:0,book:120};
  const scene=new T.Scene(),world=createWorld(scene,new Set([bookId(location)]));
  const camera=new T.PerspectiveCamera(),color=new T.Color();
  function tinted(){let count=0;scene.getObjectByName('nearby-shelf-details')!.traverse(o=>{
    if(o instanceof T.InstancedMesh&&o.instanceColor)for(let i=0;i<o.count;i++){o.getColorAt(i,color);if(color.r<.9)count++;}
  });return count;}
  try{
    for(const quality of ['low','high']){
      world.setDetail(quality);
      for(const [x,expected] of [[30,1],[60,0],[30,1]]){
        camera.position.set(x,1.68,16.94);world.update(x,0,camera);
        assert.equal(tinted(),expected,quality+' tint must clear and return with distance');
      }
      if(quality==='high'){
        const root=scene.getObjectByName('nearby-shelf-details')!;
        const far=root.children.filter(o=>o instanceof T.InstancedMesh&&o.count===4560&&!o.instanceColor);
        assert.ok(far.length>100,'far detailed books do not allocate colour buffers');
        world.refreshBookColors();
        assert.ok(far.every(o=>!(o as T.InstancedMesh).instanceColor),'history refresh does not colour distant books');
      }
    }
  }finally{world.dispose();if(descriptor)Object.defineProperty(globalThis,'document',descriptor);else Reflect.deleteProperty(globalThis,'document');}
});

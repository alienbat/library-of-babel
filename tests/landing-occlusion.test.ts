import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {landingOccluder,hiddenByLanding,createStairCulling} from '../lib/game/landing-occlusion.ts';
import {staircase} from '../lib/game/stairs.ts';
import {HEIGHT,INNER,OUTER,PERIOD,type WorldLimits} from '../lib/game/physics.ts';
void test('landing occlusion rectangles lie wholly on real ceiling surfaces',()=>{
  for(const side of [-1,1])for(const x of [-PERIOD,0,PERIOD])for(const landing of [2.5,13.5])for(const limits of [{},{maxY:HEIGHT-.34},{minY:0}] as WorldLimits[]){
    const roof=landingOccluder({x:x+landing,y:1.68,z:side*(OUTER+.6)},limits)!;
    assert.ok(roof);assert.equal(roof.y,HEIGHT-.34);
    // Top floor supplies its own cap; ordinary floors use the landing above.
    const floors=staircase(x,limits.maxY===undefined?HEIGHT:0,side,limits).floors;
    for(const u of [0,.25,.5,.75,1])for(const v of [0,.25,.5,.75,1]){
      const px=roof.minX+u*(roof.maxX-roof.minX),pz=roof.minZ+v*(roof.maxZ-roof.minZ);
      const gallery=Math.abs(pz)>=INNER&&Math.abs(pz)<=OUTER;
      const stair=floors.some(b=>Math.abs(b[1]-b[4]/2-roof.y)<1e-6&&Math.abs(px-b[0])<=b[3]/2&&Math.abs(pz-b[2])<=b[5]/2);
      assert.ok(gallery||stair,'every point used to hide geometry must have a physical ceiling');
    }
  }
});
void test('occlusion is disabled away from stair entrances and outside valid ceilings',()=>{
  for(const eye of [{x:30,y:1.68,z:16.94},{x:2.5,y:1.68,z:0},{x:19,y:1.68,z:OUTER+2}])assert.equal(landingOccluder(eye),null);
  assert.equal(landingOccluder({x:2.5,y:HEIGHT+1,z:OUTER},{maxY:HEIGHT-.34}),null);
  const roof=landingOccluder({x:2.5,y:1.68,z:OUTER},{minX:2,maxX:3})!;
  assert.ok(roof.minX>2&&roof.maxX<3);
});

void test('only fully covered bounds are occluded; visible batches restore when looking away',()=>{
  const eye={x:2.5,y:1.68,z:OUTER+1},roof=landingOccluder(eye)!;
  const hidden=new T.Box3(new T.Vector3(2,8,OUTER+.8),new T.Vector3(3,9,OUTER+1.2));
  assert.equal(hiddenByLanding(hidden,eye,roof),true);
  assert.equal(hiddenByLanding(new T.Box3(new T.Vector3(-100,8,OUTER),new T.Vector3(100,9,OUTER+2)),eye,roof),false);
  const scene=new T.Scene(),source=new T.Group();scene.add(source);
  const geometry=new T.BoxGeometry(.2,.2,.2),material=new T.MeshBasicMaterial(),mesh=new T.InstancedMesh(geometry,material,2);
  mesh.setMatrixAt(0,new T.Matrix4().makeTranslation(2.5,3,OUTER+1));mesh.setMatrixAt(1,new T.Matrix4().makeTranslation(2.5,8,OUTER+1));source.add(mesh);
  const culler=createStairCulling(scene),camera=new T.PerspectiveCamera(65,1,.1,100);
  const frustum=new T.Frustum(),matrix=new T.Matrix4();
  const update=()=>{camera.updateMatrixWorld();frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));culler.update(source,camera,frustum,{});};
  try{
    camera.position.set(eye.x,eye.y,eye.z);camera.lookAt(2.5,10,OUTER+1);update();
    assert.equal(source.visible,false);
    const alternate=scene.getObjectByName('stair-visible-chunks')!;
    assert.equal((alternate.children[0] as T.InstancedMesh).count,1);
    update();assert.equal((alternate.children[0] as T.InstancedMesh).count,1,'stationary frames reuse selection');
    source.position.y=HEIGHT;camera.position.y+=HEIGHT;camera.lookAt(2.5,14,OUTER+1);update();
    assert.equal((alternate.children[0] as T.InstancedMesh).count,1,'floating-origin translation keeps bounds aligned');
    camera.lookAt(100,camera.position.y,OUTER+1);update();
    assert.equal(source.visible,true);assert.equal(scene.getObjectByName('stair-visible-chunks'),undefined,'normal views incur no alternate scene traversal');
  }finally{culler.dispose();mesh.dispose();geometry.dispose();material.dispose();}
});

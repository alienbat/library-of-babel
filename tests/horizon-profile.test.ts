import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {traceProfile,bakeProfile,profileSlope,PROFILE_SIZE} from '../lib/game/horizon-profile.ts';
import {HEIGHT} from '../lib/game/physics.ts';
void test('periodic profile preserves first-hit occlusion and actual rail normals',()=>{
  assert.equal(traceProfile(1.68,0).kind,'shelf');
  assert.equal(traceProfile(HEIGHT-.17,0).kind,'deck');
  const rail=traceProfile(.56,0);assert.equal(rail.kind,'rail');
  assert.ok(Math.abs(rail.ny)>.1&&Math.abs(rail.nz)>.1,'faceted pipe retains its oblique normal');
  assert.ok(Math.abs(rail.ny**2+rail.nz**2-1)<1e-12);
  for(const slope of [-65535,-100,-5,0,5,100,65535])for(const phase of [.123,.555,1.7,3.81]){
    const a=traceProfile(phase,slope),b=traceProfile(phase+HEIGHT*10,slope);
    assert.equal(a.kind,b.kind);assert.ok(Math.abs(a.z-b.z)<1e-8);
    assert.ok(a.z>=15.204-1e-8&&a.z<=18.8976);
  }
});
void test('small directional lookup agrees with a denser phase integration',()=>{
  const shade=(hit:ReturnType<typeof traceProfile>)=>new T.Color().setRGB(hit.kind==='rail'?1:0,hit.kind==='deck'?1:0,hit.kind==='shelf'?1:0);
  const lut=bakeProfile(shade),data=lut.image.data as Uint16Array;
  assert.equal(data.byteLength,PROFILE_SIZE*8);
  for(const index of [0,70,160,240,256,280,352,440,512]){
    const mean=new T.Color(0,0,0),slope=profileSlope(index);
    for(let i=0;i<8192;i++)mean.add(shade(traceProfile((i+.37)/8192*HEIGHT,slope)));
    mean.multiplyScalar(1/8192);
    for(const [channel,wanted] of [mean.r,mean.g,mean.b].entries())assert.ok(Math.abs(T.DataUtils.fromHalfFloat(data[index*4+channel])-wanted)<.012);
  }
  lut.dispose();
});
void test('periodic solver agrees with actual Three.js deck and six-sided rail intersections',()=>{
  const shapes:T.Mesh[]=[],geometries:T.BufferGeometry[]=[],material=new T.MeshBasicMaterial();
  const deck=new T.BoxGeometry(30,.34,3.6576),pipe=new T.CylinderGeometry(.036,.036,30,6);pipe.rotateZ(Math.PI/2);geometries.push(deck,pipe);
  for(let f=-8;f<=8;f++){
    const slab=new T.Mesh(deck,material);slab.position.set(0,f*HEIGHT-.17,15.24+3.6576/2);slab.name='deck';shapes.push(slab);
    for(const y of [.55,1.2192]){const rail=new T.Mesh(pipe,material);rail.position.set(0,f*HEIGHT+y,15.24);rail.name='rail';shapes.push(rail);}
  }
  shapes.forEach(m=>m.updateMatrixWorld());const caster=new T.Raycaster();
  for(const slope of [-1000,-100,-10,-1,0,1,10,100,1000])for(let i=0;i<40;i++){
    const phase=(i+.317)/40*HEIGHT,actual=traceProfile(phase,slope);
    caster.set(new T.Vector3(0,phase,15.204),new T.Vector3(0,slope,1).normalize());
    const reference=caster.intersectObjects(shapes,false)[0];
    assert.equal(actual.kind,reference?.object.name??'shelf');
    if(reference){assert.ok(Math.abs(actual.z-reference.point.z)<2e-5,`depth at slope ${slope}`);assert.ok(Math.abs(actual.ny-reference.face!.normal.y)<1e-5);}
  }
  geometries.forEach(g=>g.dispose());material.dispose();
});

import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {bakeGalleryLighting} from '../lib/game/lighting.ts';
void test('baked volume is bounded, filtered, periodic and brighter beneath fixtures',()=>{
  const bake=bakeGalleryLighting();
  try{
    const {data,width,height,depth}=bake.positive.image;
    assert.ok(data);assert.ok(bake.negative.image.data);
    assert.equal(data.byteLength+bake.negative.image.data.byteLength,192*1024);
    assert.equal(bake.positive.wrapS,T.RepeatWrapping);
    assert.equal(bake.positive.minFilter,T.LinearFilter);
    const sample=(x:number,y:number,z:number,axis:number)=>data[((z*height+y)*width+x)*4+axis];
    assert.ok(sample(width/2,0,depth/2,1)>sample(0,0,depth/2,1),'ceiling fixture creates a stable floor light pool');
    for(let y=0;y<height;y++)for(let z=0;z<depth;z++)for(let axis=0;axis<3;axis++)assert.ok(Math.abs(sample(0,y,z,axis)-sample(width-1,y,z,axis))<12,'repeat boundary is smooth');
    const material=bake.material({color:'#987953'});
    const shader={uniforms:{},vertexShader:T.ShaderLib.basic.vertexShader,fragmentShader:T.ShaderLib.basic.fragmentShader} as T.WebGLProgramParametersWithUniforms;
    material.onBeforeCompile(shader,{} as T.WebGLRenderer);
    assert.equal(shader.uniforms.bakedPositive.value,bake.positive);
    assert.ok(shader.fragmentShader.includes('#include <fog_fragment>'));
    assert.ok(shader.fragmentShader.includes('#include <color_fragment>'));
    assert.ok(shader.vertexShader.includes('modelMatrix*bakedPoint'));
    material.dispose();
  }finally{bake.dispose();}
});

void test('room bake has localized pools of light and is applied to existing materials',async()=>{
  const {bakeRoomLighting,ROOM_GRID,ROOM_WIDTH,ROOM_DEPTH}=await import('../lib/game/room-lighting.ts');
  const bake=bakeRoomLighting();
  try{
    const [nx,ny,nz]=ROOM_GRID,data=bake.positive.image.data!;
    const sample=(px:number,py:number,pz:number)=>{
      const x=Math.round(px/ROOM_WIDTH*(nx-1)),y=Math.round(py/3.96*(ny-1)),z=Math.round(pz/ROOM_DEPTH*(nz-1));
      return data[((z*ny+y)*nx+x)*4+1];
    };
    assert.ok(sample(27,0,2.5)>sample(24.5,0,.6),'bathroom fixture creates a visible floor light pool');
    assert.ok(sample(13.5,0,2.1)>40,'upper stair landing receives its own overhead light');
    assert.ok(sample(18,0,3.15)>sample(16.25,0,.5),'bedroom light softens toward room corners');
  }finally{bake.dispose();}
});

void test('top stair bake omits the imaginary flight and its contact shadow',async()=>{
  const {bakeRoomLighting,ROOM_GRID,ROOM_WIDTH,ROOM_DEPTH,ROOM_LIGHTS}=await import('../lib/game/room-lighting.ts');
  assert.equal(ROOM_LIGHTS.filter(l=>l.room===0).length,2);
  assert.ok(ROOM_LIGHTS.every(l=>l.y<3.96),'no luminaire under a sloping flight');
  const normal=bakeRoomLighting(),top=bakeRoomLighting(true);
  try{
    const [nx,ny,nz]=ROOM_GRID;
    const sample=(b:typeof top,px:number,py:number)=>{
      const x=Math.round(px/ROOM_WIDTH*(nx-1)),y=Math.round(py/3.96*(ny-1)),z=Math.round(2.1/ROOM_DEPTH*(nz-1));
      return b.positive.image.data![((z*ny+y)*nx+x)*4+1];
    };
    assert.notDeepEqual(top.positive.image.data,normal.positive.image.data,'top shaft uses a distinct lighting field without the repeating ramp');
    assert.equal(sample(top,25,1),sample(normal,25,1),'bathroom bake stays unchanged');
  }finally{normal.dispose();top.dispose();}
});

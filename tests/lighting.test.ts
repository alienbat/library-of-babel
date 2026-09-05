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

import * as T from 'three';
import {HEIGHT,OUTER,PERIOD,type WorldLimits} from './physics.ts';
/** One reusable atlas, projected onto existing wall faces; no separate sign meshes. */
export function createWallWriting(){
  const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=1024;
  const c=canvas.getContext('2d')!;
  const labels=['STAIRS\nUP →     ← DOWN','STAIRS\nUP ONLY','STAIRS\nDOWN ONLY','REST AREA\n7 BEDS · BATH →','LIBRARY\nExplore the shelves.\nChoose your own search.','BATHROOM\nSHOWERS · WC','← EAST     WEST →','← WEST     EAST →'];
  labels.forEach((label,i)=>{
    c.save();c.translate((i%4)*512,Math.floor(i/4)*512);c.scale(1,2);
    c.fillStyle='#dad8c7';c.fillRect(0,0,512,256);c.strokeStyle='#7b7667';c.lineWidth=5;c.strokeRect(10,10,492,236);
    c.fillStyle='#353b36';c.textAlign='center';c.font=i>=6?'bold 38px sans-serif':'22px sans-serif';label.split('\n').forEach((line,row)=>c.fillText(line,256,i>=6?140:62+row*44));c.restore();
  });
  const atlas=new T.CanvasTexture(canvas);atlas.colorSpace=T.SRGBColorSpace;atlas.anisotropy=4;
  const uniforms={wallWriting:{value:atlas},writingBottom:{value:-1e20},writingTop:{value:1e20}};
  function apply(material:T.MeshBasicMaterial){
    const light=material.onBeforeCompile.bind(material);
    material.onBeforeCompile=(shader,renderer)=>{
      light(shader,renderer);Object.assign(shader.uniforms,uniforms);
      shader.fragmentShader=`uniform sampler2D wallWriting;
        uniform float writingBottom,writingTop;
        vec4 writingSample(vec2 p,vec2 center,vec2 size,float tile){
          vec2 uv=(p-center)/size+.5;
          if(any(lessThan(uv,vec2(0.0)))||any(greaterThan(uv,vec2(1.0))))return vec4(0.0);
          // Canvas rows run downwards, texture UVs upwards. Inset prevents tile bleed.
          vec2 cell=vec2(mod(tile,4.0),1.0-floor(tile/4.0));
          return texture2D(wallWriting,(cell+clamp(uv,vec2(.002),vec2(.998)))/vec2(4.0,2.0));
        }
      `+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        float wx=mod(vBakedPosition.x,${PERIOD});
        float wy=mod(vBakedPosition.y,${HEIGHT});
        float wz=abs(vBakedPosition.z)-${OUTER};
        float facing=vBakedNormal.z*sign(vBakedPosition.z);
        vec2 p=vec2(wx,wy);vec4 ink=vec4(0.0);
        // Reverse the horizontal atlas direction on the opposite gallery.
        float orientation=-sign(vBakedPosition.z);
        if(facing<-.9){
          if(abs(wz-.4)<.012){
            float floorY=vBakedPosition.y-wy;
            float tile=abs(floorY-writingTop)<.01?2.0:abs(floorY-writingBottom)<.01?1.0:0.0;
            ink=writingSample(vec2(8.0+(wx-8.0)*orientation,wy),vec2(8.0,2.2),vec2(2.6,1.3),tile);
          }
          if(abs(wz-.07)<.012){
            if(wx<18.0){
              ink=writingSample(vec2(17.0+(wx-17.0)*orientation,wy),vec2(17.0,2.2),vec2(1.2,.6),3.0);
              vec4 compass=writingSample(vec2(17.0+(wx-17.0)*orientation,wy),vec2(17.0,3.0),vec2(1.6,.5),vBakedPosition.z>0.0?6.0:7.0);
              ink=mix(ink,compass,compass.a);
            }else ink=writingSample(vec2(21.0+(wx-21.0)*orientation,wy),vec2(21.0,2.1),vec2(1.5,.75),4.0);
          }
        }else if(facing>.9&&abs(wz-.5)<.012){
          ink=writingSample(vec2(24.6-(wx-24.6)*orientation,wy),vec2(24.6,2.8),vec2(1.5,.75),5.0);
        }
        diffuseColor.rgb=mix(diffuseColor.rgb,ink.rgb,ink.a);
      `);
    };
    material.customProgramCacheKey=()=> 'baked-wall-writing-v1';
  }
  return {apply,setLimits(limits:WorldLimits){uniforms.writingBottom.value=limits.minY??-1e20;uniforms.writingTop.value=limits.maxY===undefined?1e20:limits.maxY-HEIGHT+.34;},dispose(){atlas.dispose();}};
}

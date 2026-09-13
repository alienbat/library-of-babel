import {bakeBouncePatches} from './bounce-lighting.ts';
import * as T from 'three';
import {BAY,HEIGHT,INNER,OUTER} from './physics.ts';
export const BOUNDARY_LIGHT_SPACING=15.24,WALL_LIGHT_SPACING=HEIGHT*4;
export const BOUNDARY_GLSL=`
 uniform sampler2D boundaryCarpet,boundaryLight;
 uniform float boundaryLightMean;
 uniform vec3 boundaryFloorColor,boundaryCeilingColor,boundaryWallColor;
 float boundaryBand(float p,float width,float footprint){
   // Periodic averaging must not subtract huge, almost equal world coordinates.
   p=fract(p);
   float w=clamp(footprint,.00001,1.0),a=p-w*.5,b=p+w*.5;
   float coverage=((floor(b)*width+min(fract(b),width))-(floor(a)*width+min(fract(a),width)))/w;
   return mix(clamp(coverage,0.0,1.0),width,smoothstep(.4,1.0,w));
 }
 vec3 boundaryShade(vec3 p,float kind){
   vec2 cell=kind>1.5?p.yz/vec2(${WALL_LIGHT_SPACING},${BOUNDARY_LIGHT_SPACING}):p.xz/${BOUNDARY_LIGHT_SPACING};
   vec2 footprint=fwidth(cell);
   float light=texture2D(boundaryLight,vec2(cell.x,abs(p.z)/${BOUNDARY_LIGHT_SPACING})).r*2.0;
   light=mix(light,boundaryLightMean,smoothstep(.2,1.0,max(footprint.x,footprint.y)));
   vec3 base=kind>1.5?boundaryWallColor:boundaryCeilingColor;
   if(kind<.5)base=boundaryFloorColor*texture2D(boundaryCarpet,vec2(p.x/${BAY}*12.0,p.z/${OUTER-INNER}*2.0)).rgb;
   vec3 result=base*light*vec3(1.0,.97,.89);
   // Recessed frame and lens remain visible after physical fixtures leave the local window.
   float period=kind>1.5?${WALL_LIGHT_SPACING}:${BOUNDARY_LIGHT_SPACING};
   float frame=boundaryBand(cell.x-.5+1.8/(period*2.0),1.8/period,footprint.x)*boundaryBand(cell.y-.5+.38/${BOUNDARY_LIGHT_SPACING*2},.38/${BOUNDARY_LIGHT_SPACING},footprint.y);
   float lens=boundaryBand(cell.x-.5+1.6/(period*2.0),1.6/period,footprint.x)*boundaryBand(cell.y-.5+.20/${BOUNDARY_LIGHT_SPACING*2},.20/${BOUNDARY_LIGHT_SPACING},footprint.y);
   result=mix(result,vec3(.07,.08,.075)*light,frame);
   return mix(result,vec3(2.0,1.8,1.35),lens);
 }
`;
export function createBoundaryLighting(carpet:T.Texture,lightStrength=1){
  const size=64,data=new Uint8Array(size*size*4);
  // Side galleries reflect the boundary fixtures back onto the terminal plane.
  // Mirror the sampled half-chasm in the shader so both galleries match.
  const bounce=bakeBouncePatches({left:0,right:BOUNDARY_LIGHT_SPACING,front:-INNER,back:INNER,floor:()=>0,ceiling:()=>WALL_LIGHT_SPACING,floorReflectance:0,wallReflectance:.32,periodic:BOUNDARY_LIGHT_SPACING},
    [-1,0,1].flatMap(i=>[-.5,.5].map(z=>({x:(i+.5)*BOUNDARY_LIGHT_SPACING,y:.05,z:z*BOUNDARY_LIGHT_SPACING,power:lightStrength*3.2,falloff:.35,softening:.16}))));
  let lightSum=0;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const dx=((x+.5)/size-.5)*BOUNDARY_LIGHT_SPACING,dz=((y+.5)/size-.5)*BOUNDARY_LIGHT_SPACING;
    const reflected=[0,0,0,0,0,0];bounce(reflected,(x+.5)/size*BOUNDARY_LIGHT_SPACING,.015,(y+.5)/size*BOUNDARY_LIGHT_SPACING);
    const light=lightStrength*.70*Math.exp(-(dx*dx*.35+dz*dz*.7))+reflected[1];
    const i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=Math.round(light/2*255);data[i+3]=255;lightSum+=data[i]/255*2;
  }
  const light=new T.DataTexture(data,size,size);light.wrapS=light.wrapT=T.RepeatWrapping;light.minFilter=T.LinearMipmapLinearFilter;light.magFilter=T.LinearFilter;light.generateMipmaps=true;light.needsUpdate=true;
  const uniforms={boundaryLightMean:{value:lightSum/(size*size)},boundaryCarpet:{value:carpet},boundaryLight:{value:light},boundaryFloorColor:{value:new T.Color('#b1b1a7')},boundaryCeilingColor:{value:new T.Color('#aaa99c')},boundaryWallColor:{value:new T.Color('#a8a69a')}};
  function material(kind:number){
    const m=new T.MeshBasicMaterial({side:T.DoubleSide});m.name=['boundary-floor','boundary-ceiling','boundary-wall'][kind];
    m.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms);
      shader.vertexShader='varying vec3 boundaryWorld;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\n boundaryWorld=(modelMatrix*vec4(position,1.0)).xyz;`);
      shader.fragmentShader='varying vec3 boundaryWorld;\n'+BOUNDARY_GLSL+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\n diffuseColor.rgb=boundaryShade(boundaryWorld,${kind}.0);`);
    };
    m.customProgramCacheKey=()=>`boundary-baked-v1-${kind}`;return m;
  }
  // Frames sit directly in the local fixture pool; lenses remain emissive.
  const frame=new T.MeshBasicMaterial({color:new T.Color('#353c38').multiplyScalar(lightStrength*.70)});
  const floor=material(0),ceiling=material(1),wall=material(2);
  return {uniforms,floor,ceiling,wall,frame,dispose(){frame.dispose();light.dispose();floor.dispose();ceiling.dispose();wall.dispose();}};
}
export const BOUNDARY_SPAN=INNER*2-.004;

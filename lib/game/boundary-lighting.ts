import * as T from 'three';
import {BAY,HEIGHT,INNER,OUTER} from './physics.ts';
export const BOUNDARY_LIGHT_SPACING=15.24,WALL_LIGHT_SPACING=HEIGHT*4;
export const BOUNDARY_GLSL=`
 uniform sampler2D boundaryCarpet,boundaryLight;
 uniform vec3 boundaryFloorColor,boundaryCeilingColor,boundaryWallColor;
 float boundaryBand(float p,float width,float footprint){
   float w=max(footprint,.00001),a=p-w*.5,b=p+w*.5;
   float coverage=((floor(b)*width+min(fract(b),width))-(floor(a)*width+min(fract(a),width)))/w;
   return mix(clamp(coverage,0.0,1.0),width,smoothstep(.4,1.0,w));
 }
 vec3 boundaryShade(vec3 p,float kind){
   vec2 cell=kind>1.5?p.yz/vec2(${WALL_LIGHT_SPACING},${BOUNDARY_LIGHT_SPACING}):p.xz/${BOUNDARY_LIGHT_SPACING};
   vec2 footprint=fwidth(cell);
   float light=texture2D(boundaryLight,cell).r*2.0;
   light=mix(light,.78,smoothstep(.2,1.0,max(footprint.x,footprint.y)));
   vec3 base=kind>1.5?boundaryWallColor:boundaryCeilingColor;
   if(kind<.5)base=boundaryFloorColor*texture2D(boundaryCarpet,vec2(p.x/${BAY}*12.0,p.z/${OUTER-INNER}*2.0)).rgb;
   vec3 result=base*light*vec3(1.0,.97,.89);
   // Recessed frame and lens remain visible after physical fixtures leave the local window.
   float period=kind>1.5?${WALL_LIGHT_SPACING}:${BOUNDARY_LIGHT_SPACING};
   float frame=boundaryBand(cell.x-.5+1.8/(period*2.0),1.8/period,footprint.x)*boundaryBand(cell.y-.5+.38/${BOUNDARY_LIGHT_SPACING*2},.38/${BOUNDARY_LIGHT_SPACING},footprint.y);
   float lens=boundaryBand(cell.x-.5+1.6/(period*2.0),1.6/period,footprint.x)*boundaryBand(cell.y-.5+.20/${BOUNDARY_LIGHT_SPACING*2},.20/${BOUNDARY_LIGHT_SPACING},footprint.y);
   result=mix(result,vec3(.07,.08,.075),frame);
   return mix(result,vec3(2.0,1.8,1.35),lens);
 }
`;
export function createBoundaryLighting(carpet:T.Texture){
  const size=64,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const dx=((x+.5)/size-.5)*BOUNDARY_LIGHT_SPACING,dz=((y+.5)/size-.5)*BOUNDARY_LIGHT_SPACING;
    const light=.76+.70*Math.exp(-(dx*dx*.35+dz*dz*.7));
    const i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=Math.round(light/2*255);data[i+3]=255;
  }
  const light=new T.DataTexture(data,size,size);light.wrapS=light.wrapT=T.RepeatWrapping;light.minFilter=T.LinearMipmapLinearFilter;light.magFilter=T.LinearFilter;light.generateMipmaps=true;light.needsUpdate=true;
  const uniforms={boundaryCarpet:{value:carpet},boundaryLight:{value:light},boundaryFloorColor:{value:new T.Color('#b1b1a7')},boundaryCeilingColor:{value:new T.Color('#aaa99c')},boundaryWallColor:{value:new T.Color('#a8a69a')}};
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
  const floor=material(0),ceiling=material(1),wall=material(2);
  return {uniforms,floor,ceiling,wall,dispose(){light.dispose();floor.dispose();ceiling.dispose();wall.dispose();}};
}
export const BOUNDARY_SPAN=INNER*2-.004;

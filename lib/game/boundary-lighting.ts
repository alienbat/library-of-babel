import floorField from './baked/boundaryFloor.json' with {type:'json'};
import ceilingField from './baked/boundaryCeiling.json' with {type:'json'};
import wallField from './baked/boundaryWall.json' with {type:'json'};
import * as T from 'three';
import {BAY,HEIGHT,INNER,OUTER} from './physics.ts';
import {GALLERY_LIGHT_PERIOD} from './gallery-fixtures.ts';
export const BOUNDARY_GLSL=`
 uniform sampler2D boundaryCarpet,boundaryLight;
 uniform vec3 boundaryLightMean;
 uniform vec3 boundaryFloorColor,boundaryCeilingColor,boundaryWallColor;
 vec3 boundaryShade(vec3 p,float kind){
   vec2 cell=kind>1.5?vec2(p.y/${HEIGHT},abs(p.z)/${INNER}):vec2(p.x/${GALLERY_LIGHT_PERIOD},abs(p.z)/${INNER});
   vec2 footprint=fwidth(cell);
   vec3 illumination=texture2D(boundaryLight,vec2(cell.x,(clamp(cell.y,0.0,1.0)*31.0+.5)/32.0)).rgb*4.0;
   illumination=mix(illumination,boundaryLightMean,smoothstep(.2,1.0,max(footprint.x,footprint.y)));
   float light=kind>1.5?illumination.b:kind<.5?illumination.r:illumination.g;
   vec3 base=kind>1.5?boundaryWallColor:boundaryCeilingColor;
   if(kind<.5)base=boundaryFloorColor*texture2D(boundaryCarpet,vec2(p.x/${BAY}*12.0,p.z/${OUTER-INNER}*2.0)).rgb;
   vec3 result=base*light*vec3(1.0,.97,.89);
   return result;
 }
`;
export function createBoundaryLighting(carpet:T.Texture,lightStrength=1){
  const size=32,data=new Uint8Array(size*size*4),mean=new T.Vector3();
  const fields=[floorField,ceilingField,wallField];
  fields.forEach((field,c)=>{
    const bytes=atob(c===1?field.negative:field.positive),axis=c===2?0:1;
    let sum=0;
    for(let i=0;i<size*size;i++){const value=Math.min(255,Math.round(bytes.charCodeAt(i*4+axis)*Math.max(0,lightStrength)));data[i*4+c]=value;data[i*4+3]=255;sum+=value*4/255;}
    mean.setComponent(c,sum/(size*size));
  });
  const light=new T.DataTexture(data,size,size);light.wrapS=T.RepeatWrapping;light.wrapT=T.ClampToEdgeWrapping;light.minFilter=T.LinearMipmapLinearFilter;light.magFilter=T.LinearFilter;light.generateMipmaps=true;light.needsUpdate=true;
  const uniforms={boundaryLightMean:{value:mean},boundaryCarpet:{value:carpet},boundaryLight:{value:light},boundaryFloorColor:{value:new T.Color('#b1b1a7')},boundaryCeilingColor:{value:new T.Color('#aaa99c')},boundaryWallColor:{value:new T.Color('#a8a69a')}};
  function material(kind:number){
    const m=new T.MeshBasicMaterial({side:T.DoubleSide});m.name=['boundary-floor','boundary-ceiling','boundary-wall'][kind];
    m.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms);
      shader.vertexShader='varying vec3 boundaryWorld;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\n boundaryWorld=(modelMatrix*vec4(position,1.0)).xyz;`);
      shader.fragmentShader='varying vec3 boundaryWorld;\n'+BOUNDARY_GLSL+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\n diffuseColor.rgb=boundaryShade(boundaryWorld,${kind}.0);`);
    };
    m.customProgramCacheKey=()=>`boundary-corridor-v2-${kind}`;return m;
  }
  const floor=material(0),ceiling=material(1),wall=material(2);
  return {uniforms,floor,ceiling,wall,dispose(){light.dispose();floor.dispose();ceiling.dispose();wall.dispose();}};
}
export const BOUNDARY_SPAN=INNER*2-.004;

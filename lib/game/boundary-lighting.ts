import floorField from './baked/boundaryFloor.json' with {type:'json'};
import ceilingField from './baked/boundaryCeiling.json' with {type:'json'};
import wallField from './baked/boundaryWall.json' with {type:'json'};
import * as T from 'three';
import {BAY,HEIGHT,INNER,OUTER} from './physics.ts';
import {GALLERY_TRANSPORT_PERIOD} from './gallery-fixtures.ts';
export const BOUNDARY_GLSL=`
 uniform sampler2D boundaryCarpet,boundaryLight;
 uniform vec3 boundaryLightMean;
 uniform vec3 boundaryFloorColor,boundaryCeilingColor,boundaryWallColor;
 vec3 boundaryShade(vec3 p,float kind){
   vec2 cell=kind>1.5?vec2(p.y/${HEIGHT},abs(p.z)/${OUTER-.06}):vec2(p.x/${GALLERY_TRANSPORT_PERIOD},abs(p.z)/${INNER});
   vec2 footprint=fwidth(cell);
   vec3 illumination=texture2D(boundaryLight,vec2(cell.x,(clamp(cell.y,0.0,1.0)*127.0+.5)/128.0)).rgb*4.0;
   illumination=mix(illumination,boundaryLightMean,smoothstep(.2,1.0,max(footprint.x,footprint.y)));
   float light=kind>1.5?illumination.b:kind<.5?illumination.r:illumination.g;
   vec3 base=kind>1.5?boundaryWallColor:boundaryCeilingColor;
   if(kind<.5)base=boundaryFloorColor*texture2D(boundaryCarpet,vec2(p.x/${BAY}*12.0,p.z/${OUTER-INNER}*2.0)).rgb;
   vec3 result=base*light*vec3(1.0,.97,.89);
   return result;
 }
`;
export function createBoundaryLighting(carpet:T.Texture,lightStrength=1){
  const width=floorField.grid[0],height=128,data=new Uint8Array(width*height*4),mean=new T.Vector3();
  const fields=[floorField,ceilingField,wallField];
  fields.forEach((field,c)=>{
    const bytes=atob(c===1?field.negative:field.positive),axis=c===2?0:1;
    let sum=0;
    // Wall transport retains its vertical period and original resolution.
    // Resample at cell centers when packing beside the wider floor fields.
    const sourceWidth=field.grid[0];
    for(let z=0;z<height;z++)for(let x=0;x<width;x++){
      const u=(x+.5)*sourceWidth/width-.5,lo=Math.floor(u),t=u-lo;
      const sample=(j:number)=>bytes.charCodeAt((z*sourceWidth+(j+sourceWidth)%sourceWidth)*4+axis);
      const value=Math.min(255,Math.round((sample(lo)*(1-t)+sample(lo+1)*t)*Math.max(0,lightStrength)));
      const i=z*width+x;data[i*4+c]=value;data[i*4+3]=255;sum+=value*4/255;
    }
    mean.setComponent(c,sum/(width*height));
  });
  const light=new T.DataTexture(data,width,height);light.wrapS=T.RepeatWrapping;light.wrapT=T.ClampToEdgeWrapping;light.minFilter=T.LinearMipmapLinearFilter;light.magFilter=T.LinearFilter;light.generateMipmaps=true;light.needsUpdate=true;
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
    m.customProgramCacheKey=()=>`boundary-corridor-v3-${kind}`;return m;
  }
  const floor=material(0),ceiling=material(1),wall=material(2);
  return {uniforms,floor,ceiling,wall,dispose(){light.dispose();floor.dispose();ceiling.dispose();wall.dispose();}};
}
export const BOUNDARY_SPAN=INNER*2-.004;

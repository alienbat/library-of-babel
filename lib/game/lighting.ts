import {bakeRoomLighting,ROOM_WIDTH,ROOM_DEPTH,ROOM_GRID} from './room-lighting.ts';
import * as T from 'three';
import {HEIGHT,INNER,OUTER,PERIOD} from './physics.ts';
export const LIGHT_PERIOD=7.62;
const NX=48,NY=32,NZ=16,RANGE=4;
/** Bake six directional diffuse irradiance lobes once for one repeating gallery cell. */
export function bakeGalleryLighting(){
  const positive=new Uint8Array(NX*NY*NZ*4),negative=new Uint8Array(positive.length);
  for(let z=0;z<NZ;z++)for(let y=0;y<NY;y++)for(let x=0;x<NX;x++){
    const px=(x+.5)/NX*LIGHT_PERIOD,py=y/(NY-1)*HEIGHT,pz=INNER+z/(NZ-1)*(OUTER-INNER);
    const lobes=[.66,1.05,.72,.66,.40,.72];
    for(let lamp=-3;lamp<=3;lamp++){
      const dx=lamp*LIGHT_PERIOD+3.81-px,dy=HEIGHT-.38-py,dz=INNER+1.8288-pz;
      const r=Math.sqrt(dx*dx+dy*dy+dz*dz+.16),energy=3.2/(1+r*r*.32);
      for(let axis=0;axis<3;axis++){
        const direction=[dx,dy,dz][axis]/r;
        lobes[axis]+=energy*Math.max(0,direction);
        lobes[axis+3]+=energy*Math.max(0,-direction);
      }
    }
    // Soft contact darkening at the shelf base, identical on every floor.
    const contact=1-.16*Math.exp(-py*3)*Math.pow(z/(NZ-1),4);
    const offset=((z*NY+y)*NX+x)*4;
    for(let axis=0;axis<3;axis++){
      positive[offset+axis]=Math.round(Math.min(RANGE,lobes[axis]*contact)/RANGE*255);
      negative[offset+axis]=Math.round(Math.min(RANGE,lobes[axis+3]*contact)/RANGE*255);
    }
    positive[offset+3]=negative[offset+3]=255;
  }
  const texture=(data:Uint8Array)=>{
    const t=new T.Data3DTexture(data,NX,NY,NZ);t.format=T.RGBAFormat;t.type=T.UnsignedByteType;
    t.minFilter=t.magFilter=T.LinearFilter;t.wrapS=T.RepeatWrapping;t.wrapT=t.wrapR=T.ClampToEdgeWrapping;t.unpackAlignment=1;t.needsUpdate=true;return t;
  };
  const pos=texture(positive),neg=texture(negative),rooms=bakeRoomLighting();
  function material(params:T.MeshStandardMaterialParameters){
    const m=new T.MeshBasicMaterial({color:params.color??0xffffff,map:params.map??null,transparent:params.transparent??false,opacity:params.opacity??1});
    const luminous=(params.emissiveIntensity??0)>.5;
    if(luminous){m.color.multiplyScalar(1+(params.emissiveIntensity??0));return m;}
    m.onBeforeCompile=shader=>{
      shader.uniforms.roomPositive={value:rooms.positive};shader.uniforms.roomNegative={value:rooms.negative};
      shader.uniforms.bakedPositive={value:pos};shader.uniforms.bakedNegative={value:neg};
      shader.vertexShader='varying vec3 vBakedPosition;\nvarying vec3 vBakedNormal;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        vec4 bakedPoint=vec4(position,1.0);
        vec3 bakedNormal=normal;
        #ifdef USE_INSTANCING
          bakedPoint=instanceMatrix*bakedPoint;
          bakedNormal=mat3(instanceMatrix)*(bakedNormal/vec3(dot(instanceMatrix[0].xyz,instanceMatrix[0].xyz),dot(instanceMatrix[1].xyz,instanceMatrix[1].xyz),dot(instanceMatrix[2].xyz,instanceMatrix[2].xyz)));
        #endif
        vBakedPosition=(modelMatrix*bakedPoint).xyz;
        vBakedNormal=normalize(mat3(modelMatrix)*bakedNormal);
      `);
      shader.fragmentShader='uniform highp sampler3D roomPositive,roomNegative;\n uniform highp sampler3D bakedPositive;\nuniform highp sampler3D bakedNegative;\nvarying vec3 vBakedPosition;\nvarying vec3 vBakedNormal;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float cellY=mod(vBakedPosition.y,${HEIGHT});
        // Choose the cell on the visible side of a floor/ceiling boundary.
        if(abs(vBakedNormal.y)>.5)cellY=mod(vBakedPosition.y+sign(vBakedNormal.y)*.002,${HEIGHT});
        vec3 uvw=vec3(vBakedPosition.x/${LIGHT_PERIOD},(cellY/${HEIGHT}*${NY-1}.0+.5)/${NY}.0,((clamp(abs(vBakedPosition.z)-${INNER},0.0,${OUTER-INNER})/${OUTER-INNER})*${NZ-1}.0+.5)/${NZ}.0);
        vec3 n=normalize(vBakedNormal);n.z*=sign(vBakedPosition.z);
        vec3 positive,negative;
        float roomX=mod(vBakedPosition.x,${PERIOD});
        bool inRoom=abs(vBakedPosition.z)>${OUTER+.4};
        if(inRoom){
          vec3 roomUv=(vec3(clamp(roomX/${ROOM_WIDTH},0.0,1.0),cellY/${HEIGHT},clamp((abs(vBakedPosition.z)-${OUTER})/${ROOM_DEPTH},0.0,1.0))*vec3(${ROOM_GRID[0]-1}.0,${ROOM_GRID[1]-1}.0,${ROOM_GRID[2]-1}.0)+.5)/vec3(${ROOM_GRID[0]}.0,${ROOM_GRID[1]}.0,${ROOM_GRID[2]}.0);
          positive=texture(roomPositive,roomUv).rgb*${RANGE}.0;
          negative=texture(roomNegative,roomUv).rgb*${RANGE}.0;
        }else{
          positive=texture(bakedPositive,uvw).rgb*${RANGE}.0;
          negative=texture(bakedNegative,uvw).rgb*${RANGE}.0;
        }
        float irradiance=dot(n*n,mix(negative,positive,step(vec3(0.0),n)));
        if(inRoom&&roomX>22.0)diffuseColor.rgb*=vec3(.96,1.01,1.12);
        diffuseColor.rgb*=irradiance*vec3(1.0,.97,.89);
      `);
    };
    m.customProgramCacheKey=()=> 'baked-gallery-volume-v1';return m;
  }
  return {material,positive:pos,negative:neg,dispose(){pos.dispose();neg.dispose();rooms.dispose();}};
}

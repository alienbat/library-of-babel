import {DORM} from './room-layout.ts';
import {bakeRoomAO,applyRoomAO} from './room-ao.ts';
import {bakeRoomLighting,ROOM_WIDTH,ROOM_DEPTH,ROOM_GRID} from './room-lighting.ts';
import * as T from 'three';
import {HEIGHT,INNER,OUTER,PERIOD,type WorldLimits} from './physics.ts';
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
  const pos=texture(positive),neg=texture(negative),rooms=bakeRoomLighting(),topRooms=bakeRoomLighting(true),finalRooms=bakeRoomLighting(false,true);
  const roomTop={value:1e20};
  const aoBaked=new Set<boolean|string>();
  function bakeRoomContacts(occluders:()=>T.Box3[],top:boolean|'final'=false){
    if(aoBaked.has(top))return;
    const ao=bakeRoomAO(occluders());
    const target=top==='final'?finalRooms:top?topRooms:rooms;
    applyRoomAO(target.positive,ao);applyRoomAO(target.negative,ao);
    aoBaked.add(top);
  }
  function material(params:T.MeshStandardMaterialParameters){
    const m=new T.MeshBasicMaterial({color:params.color??0xffffff,map:params.map??null,transparent:params.transparent??false,opacity:params.opacity??1});
    const luminous=(params.emissiveIntensity??0)>.5;
    if(luminous){m.color.multiplyScalar(1+(params.emissiveIntensity??0));return m;}
    m.onBeforeCompile=shader=>{
      shader.uniforms.finalRoomPositive={value:finalRooms.positive};shader.uniforms.finalRoomNegative={value:finalRooms.negative};
      shader.uniforms.roomTop=roomTop;shader.uniforms.topRoomPositive={value:topRooms.positive};shader.uniforms.topRoomNegative={value:topRooms.negative};
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
      shader.fragmentShader='uniform highp sampler3D finalRoomPositive,finalRoomNegative;\nuniform float roomTop;\nuniform highp sampler3D topRoomPositive,topRoomNegative;\nuniform highp sampler3D roomPositive,roomNegative;\n uniform highp sampler3D bakedPositive;\nuniform highp sampler3D bakedNegative;\nvarying vec3 vBakedPosition;\nvarying vec3 vBakedNormal;\n'+shader.fragmentShader;
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
          vec3 roomUv=(vec3(clamp(roomX/${ROOM_WIDTH.toFixed(1)},0.0,1.0),cellY/${HEIGHT},clamp((abs(vBakedPosition.z)-${OUTER})/${ROOM_DEPTH},0.0,1.0))*vec3(${ROOM_GRID[0]-1}.0,${ROOM_GRID[1]-1}.0,${ROOM_GRID[2]-1}.0)+.5)/vec3(${ROOM_GRID[0]}.0,${ROOM_GRID[1]}.0,${ROOM_GRID[2]}.0);
          bool topRoom=vBakedPosition.y>=roomTop-.001;
          positive=(topRoom?texture(topRoomPositive,roomUv):texture(roomPositive,roomUv)).rgb*${RANGE}.0;
          negative=(topRoom?texture(topRoomNegative,roomUv):texture(roomNegative,roomUv)).rgb*${RANGE}.0;
          // The final flight opens into the top room: its light is one storey
          // above, and the removed left landing no longer supports a fixture.
          float finalFloor=roomTop-${HEIGHT};
          float stairRise=clamp((roomX-4.0)/8.0,0.0,1.0)*${HEIGHT};
          if(roomX<15.5&&!topRoom&&vBakedPosition.y>=finalFloor+stairRise-.002){
            positive=texture(finalRoomPositive,roomUv).rgb*${RANGE}.0;
            negative=texture(finalRoomNegative,roomUv).rgb*${RANGE}.0;
          }
        }else{
          positive=texture(bakedPositive,uvw).rgb*${RANGE}.0;
          negative=texture(bakedNegative,uvw).rgb*${RANGE}.0;
        }
        float irradiance=dot(n*n,mix(negative,positive,step(vec3(0.0),n)));
        if(inRoom&&roomX>${DORM.right.toFixed(1)})diffuseColor.rgb*=vec3(.96,1.01,1.12);
        diffuseColor.rgb*=irradiance*vec3(1.0,.97,.89);
      `);
    };
    m.customProgramCacheKey=()=> 'baked-gallery-volume-v1';return m;
  }
  return {material,bakeRoomContacts,positive:pos,negative:neg,setLimits(limits:WorldLimits){roomTop.value=limits.maxY===undefined?1e20:limits.maxY-HEIGHT+.34;},dispose(){pos.dispose();neg.dispose();rooms.dispose();topRooms.dispose();finalRooms.dispose();}};
}

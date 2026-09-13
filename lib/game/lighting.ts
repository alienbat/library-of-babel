import {loadLightField} from './baked-light-field.ts';
import galleryField from './baked/gallery.json' with {type:'json'};
import {DORM} from './room-layout.ts';
import {bakeBottomRoomLighting,bakeRoomLighting,ROOM_WIDTH,ROOM_DEPTH,ROOM_GRID} from './room-lighting.ts';
import * as T from 'three';
import {HEIGHT,INNER,OUTER,PERIOD,type WorldLimits} from './physics.ts';
export const LIGHT_PERIOD=7.62;
const [,NY,NZ]=galleryField.grid,RANGE=4;
/** Load the offline Cycles irradiance fields for the repeating library. */
export function bakeGalleryLighting(lightStrength=1){
  const gallery=loadLightField(galleryField,lightStrength,true);
  const pos=gallery.positive,neg=gallery.negative;
  const rooms=bakeRoomLighting(false,false,lightStrength),topRooms=bakeRoomLighting(true,false,lightStrength),finalRooms=bakeRoomLighting(false,true,lightStrength),bottomRooms=bakeBottomRoomLighting(lightStrength);
  const roomTop={value:1e20},roomBottom={value:-1e20};
  function material(params:T.MeshStandardMaterialParameters){
    const m=new T.MeshBasicMaterial({color:params.color??0xffffff,map:params.map??null,transparent:params.transparent??false,opacity:params.opacity??1});
    const luminous=(params.emissiveIntensity??0)>.5;
    if(luminous){m.color.multiplyScalar(1+(params.emissiveIntensity??0));return m;}
    m.onBeforeCompile=shader=>{
      shader.uniforms.finalRoomPositive={value:finalRooms.positive};shader.uniforms.finalRoomNegative={value:finalRooms.negative};
      shader.uniforms.roomBottom=roomBottom;shader.uniforms.bottomRoomPositive={value:bottomRooms.positive};shader.uniforms.bottomRoomNegative={value:bottomRooms.negative};
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
      shader.fragmentShader='uniform float roomBottom;\nuniform highp sampler3D bottomRoomPositive,bottomRoomNegative;\nuniform highp sampler3D finalRoomPositive,finalRoomNegative;\nuniform float roomTop;\nuniform highp sampler3D topRoomPositive,topRoomNegative;\nuniform highp sampler3D roomPositive,roomNegative;\n uniform highp sampler3D bakedPositive;\nuniform highp sampler3D bakedNegative;\nvarying vec3 vBakedPosition;\nvarying vec3 vBakedNormal;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float cellY=mod(vBakedPosition.y,${HEIGHT});
        // Choose the cell on the visible side of a floor/ceiling boundary.
        if(abs(vBakedNormal.y)>.5)cellY=mod(vBakedPosition.y+sign(vBakedNormal.y)*.002,${HEIGHT});
        vec3 uvw=vec3(vBakedPosition.x/${LIGHT_PERIOD},(cellY/${HEIGHT}*${NY-1}.0+.5)/${NY}.0,((clamp(abs(vBakedPosition.z)-${INNER},0.0,${OUTER-INNER})/${OUTER-INNER})*${NZ-1}.0+.5)/${NZ}.0);
        vec3 n=normalize(vBakedNormal);n.z*=sign(vBakedPosition.z);
        vec3 positive,negative;
        float roomX=mod(vBakedPosition.x,${PERIOD});
        // The inward face of the thin stair frontage also belongs to the room.
        bool inRoom=abs(vBakedPosition.z)>${OUTER+.4}||(roomX<${ROOM_WIDTH.toFixed(1)}&&abs(vBakedPosition.z)>${OUTER+.01}&&vBakedNormal.z*sign(vBakedPosition.z)>.5);
        if(inRoom){
          vec3 roomUv=(vec3(clamp(roomX/${ROOM_WIDTH.toFixed(1)},0.0,1.0),cellY/${HEIGHT},clamp((abs(vBakedPosition.z)-${OUTER})/${ROOM_DEPTH},0.0,1.0))*vec3(${ROOM_GRID[0]-1}.0,${ROOM_GRID[1]-1}.0,${ROOM_GRID[2]-1}.0)+.5)/vec3(${ROOM_GRID[0]}.0,${ROOM_GRID[1]}.0,${ROOM_GRID[2]}.0);
          bool topRoom=vBakedPosition.y>=roomTop-.001;
          positive=(topRoom?texture(topRoomPositive,roomUv):texture(roomPositive,roomUv)).rgb*${RANGE}.0;
          negative=(topRoom?texture(topRoomNegative,roomUv):texture(roomNegative,roomUv)).rgb*${RANGE}.0;
          if(vBakedPosition.y<roomBottom+${HEIGHT}-.001){
            positive=texture(bottomRoomPositive,roomUv).rgb*${RANGE}.0;
            negative=texture(bottomRoomNegative,roomUv).rgb*${RANGE}.0;
          }
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
    m.customProgramCacheKey=()=> 'cycles-directional-field-v1';return m;
  }
  return {material,positive:pos,negative:neg,setLimits(limits:WorldLimits){roomBottom.value=limits.minY??-1e20;roomTop.value=limits.maxY===undefined?1e20:limits.maxY-HEIGHT+.34;},dispose(){pos.dispose();neg.dispose();rooms.dispose();topRooms.dispose();finalRooms.dispose();bottomRooms.dispose();}};
}

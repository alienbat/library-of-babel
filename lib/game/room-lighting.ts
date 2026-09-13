import {loadLightField} from './baked-light-field.ts';
import roomField from './baked/rooms.json' with {type:'json'};
import topField from './baked/top.json' with {type:'json'};
import finalField from './baked/final.json' with {type:'json'};
import bottomField from './baked/bottom.json' with {type:'json'};
import {DORM,BATH_SHIFT,ROOM_VOLUME} from './room-layout.ts';
import {HEIGHT} from './physics.ts';
export const ROOM_WIDTH=ROOM_VOLUME.width,ROOM_DEPTH=ROOM_VOLUME.depth;
export const ROOM_LIGHTS=[
  {x:2.5,y:HEIGHT-.43,z:2.1,room:0},
  {x:13.5,y:HEIGHT-.43,z:2.1,room:0},
  {x:18,y:HEIGHT-.43,z:DORM.depth/2,room:1},
  {x:22,y:HEIGHT-.43,z:DORM.depth/2,room:1},
  // Center of the bathroom interior: x 24.1–29.9, depth .5–4.9.
  {x:25+BATH_SHIFT,y:HEIGHT-.43,z:2.7,room:2},
];
export function roomLights(top=false,bottom=false,belowTop=false){
  if(top)return [...ROOM_LIGHTS.filter(l=>l.room!==0),...[2.5,13.5].map(x=>({x,y:HEIGHT-.34-.035/2,z:2.1,room:0}))];
  return ROOM_LIGHTS.filter(l=>(!bottom||l.x!==13.5)&&(!belowTop||l.x!==2.5));
}
export const ROOM_GRID:readonly number[]=roomField.grid;
/** Cycles bakes include visibility and six diffuse bounces. No additional AO. */
export function bakeRoomLighting(top=false,finalFlight=false,lightStrength=1){
  return loadLightField(finalFlight?finalField:top?topField:roomField,lightStrength);
}
export function bakeBottomRoomLighting(lightStrength=1){return loadLightField(bottomField,lightStrength);}

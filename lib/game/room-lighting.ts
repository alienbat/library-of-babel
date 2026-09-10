import * as T from 'three';
import {HEIGHT} from './physics.ts';
export const ROOM_WIDTH=30,ROOM_DEPTH=5.5;
export const ROOM_LIGHTS=[
  {x:2.5,y:HEIGHT-.43,z:2.1,room:0},
  {x:13.5,y:HEIGHT-.43,z:2.1,room:0},
  {x:17.5,y:HEIGHT-.43,z:2.65,room:1},
  {x:20.5,y:HEIGHT-.43,z:2.65,room:1},
  {x:25,y:HEIGHT-.43,z:2.5,room:2},
  {x:27,y:HEIGHT-.43,z:3.75,room:2},
];
export const ROOM_GRID=[120,32,24] as const;
const RANGE=4;
const ramp=(x:number)=>x<=4?0:x>=12?HEIGHT:(x-4)/8*HEIGHT;
/** Room-specific diffuse irradiance, baked once. Walls isolate each room's lights. */
export function bakeRoomLighting(top=false){
  const [nx,ny,nz]=ROOM_GRID;
  const positive=new Uint8Array(nx*ny*nz*4),negative=new Uint8Array(positive.length);
  for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
    const px=x/(nx-1)*ROOM_WIDTH,py=y/(ny-1)*HEIGHT,pz=z/(nz-1)*ROOM_DEPTH;
    const room=px<15.5?0:px<22?1:2;
    const floor=room===0&&!top?Math.floor((py-ramp(px)+.001)/HEIGHT)*HEIGHT:0;
    const lobes=[.18,.36,.20,.18,.14,.20];
    for(const lamp of ROOM_LIGHTS){
      if(lamp.room!==room)continue;
      // Landings belong to the same stair passage as the sampled step.
      const ly=lamp.y+(room===0&&!top?floor+(lamp.x>=12?HEIGHT:0):0);
      for(const end of [-.5,.5]){
        const dx=lamp.x+end-px,dy=ly-py,dz=lamp.z-pz;
        const r=Math.sqrt(dx*dx+dy*dy+dz*dz+.12),energy=2.4/(1+r*r*.42);
        for(let axis=0;axis<3;axis++){
          const d=[dx,dy,dz][axis]/r;
          lobes[axis]+=energy*Math.max(0,d);lobes[axis+3]+=energy*Math.max(0,-d);
        }
      }
    }
    // Baked contact shade along walls and floor junctions, not a live shadow map.
    const floorY=room===0?py-(top?(px>4&&px<12?ramp(px)-HEIGHT:0):floor+ramp(px)):py;
    const wallDistance=Math.min(Math.max(0,pz-.5),Math.max(0,(room===0?3.7:5)-pz));
    const contact=1-.28*Math.exp(-Math.max(0,floorY)*3)*Math.exp(-wallDistance*2);
    const offset=((z*ny+y)*nx+x)*4;
    for(let axis=0;axis<3;axis++){
      positive[offset+axis]=Math.round(Math.min(RANGE,lobes[axis]*contact)/RANGE*255);
      negative[offset+axis]=Math.round(Math.min(RANGE,lobes[axis+3]*contact)/RANGE*255);
    }
    positive[offset+3]=negative[offset+3]=255;
  }
  const texture=(data:Uint8Array)=>{
    const t=new T.Data3DTexture(data,nx,ny,nz);t.format=T.RGBAFormat;t.type=T.UnsignedByteType;
    t.minFilter=t.magFilter=T.LinearFilter;t.unpackAlignment=1;t.needsUpdate=true;return t;
  };
  const pos=texture(positive),neg=texture(negative);
  return {positive:pos,negative:neg,dispose(){pos.dispose();neg.dispose();}};
}

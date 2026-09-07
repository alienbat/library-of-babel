import * as T from 'three';
import {HEIGHT,INNER,OUTER} from './physics.ts';
export type ProfileHit={kind:'rail'|'deck'|'shelf';y:number;z:number;ny:number;nz:number};
const R=.036,DEPTH=OUTER-INNER;
/** First visible face of an infinitely repeated gallery cross-section.
 * Rails match CylinderGeometry(1,1,1,6), including their sloped normals.
 * Periodic edge intersections are solved algebraically, never by walking floors.
 */
export function traceProfile(phase:number,slope:number):ProfileHit{
  let best=R+DEPTH;
  let hit:ProfileHit={kind:'shelf',y:phase+slope*best,z:OUTER,ny:0,nz:-1};
  function edge(z0:number,y0:number,z1:number,y1:number,kind:ProfileHit['kind'],ny:number,nz:number){
    if(nz+slope*ny>=0)return;
    if(z1<z0){[z0,z1]=[z1,z0];[y0,y1]=[y1,y0];}
    const q0=phase+slope*z0-y0,q1=phase+slope*z1-y1;
    if(Math.abs(q1-q0)<1e-12)return;
    const n=q1>q0?Math.ceil(q0/HEIGHT):Math.floor(q0/HEIGHT);
    const u=(n*HEIGHT-q0)/(q1-q0);
    if(u<0||u>1)return;
    const z=z0+(z1-z0)*u;
    if(z>=0&&z<best){best=z;hit={kind,y:phase+slope*z,z:INNER-R+z,ny,nz};}
  }
  edge(R,-.34,R,0,'deck',0,-1);
  edge(R,0,R+DEPTH,0,'deck',1,0);
  edge(R,-.34,R+DEPTH,-.34,'deck',-1,0);
  for(const center of [.55,1.2192])for(let i=0;i<6;i++){
    const a=i*Math.PI/3,b=(i+1)*Math.PI/3,m=(a+b)/2;
    edge(R+R*Math.cos(a),center+R*Math.sin(a),R+R*Math.cos(b),center+R*Math.sin(b),'rail',Math.sin(m),Math.cos(m));
  }
  return hit;
}
export const PROFILE_SIZE=513,PROFILE_LOG=16;
export const profileSlope=(index:number)=>{const t=(index/(PROFILE_SIZE-1)*2-1)*PROFILE_LOG;return Math.sign(t)*(2**Math.abs(t)-1);};
export function bakeProfile(shade:(hit:ProfileHit)=>T.Color,samples=512){
  const data=new Uint16Array(PROFILE_SIZE*4);
  for(let i=0;i<PROFILE_SIZE;i++){
    const sum=new T.Color(0,0,0),slope=profileSlope(i);
    for(let p=0;p<samples;p++)sum.add(shade(traceProfile((p+.5)/samples*HEIGHT,slope)));
    sum.multiplyScalar(1/samples);
    data.set([T.DataUtils.toHalfFloat(sum.r),T.DataUtils.toHalfFloat(sum.g),T.DataUtils.toHalfFloat(sum.b),T.DataUtils.toHalfFloat(1)],i*4);
  }
  const texture=new T.DataTexture(data,PROFILE_SIZE,1,T.RGBAFormat,T.HalfFloatType);
  texture.minFilter=texture.magFilter=T.LinearFilter;texture.needsUpdate=true;return texture;
}

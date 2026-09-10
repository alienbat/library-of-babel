import {CHARACTER_COUNT,permuteDigits} from './global-books.ts';
import {EYE,type Position} from './physics.ts';
export const MAX_PREFIX=3200;
export type SearchAddress={floorHex:string;sectionHex:string;side:-1|1;row:number;book:number};
export type NavigationAnchor={direction:[number,number,number];logMeters:number;localTarget?:[number,number,number]};
export type NavigationHint={angle:number;direction:string;distance:string};
export function matchingContent(prefix:string){
  if(!prefix.length||prefix.length>MAX_PREFIX)throw new RangeError(`Enter between 1 and ${MAX_PREFIX} characters.`);
  if(!/^[\x20-\x7e]+$/.test(prefix))throw new RangeError('Use printable ASCII letters, numbers, spaces and punctuation. Line breaks and accented characters are not in these books.');
  const content=new Uint8Array(CHARACTER_COUNT);
  let state=2166136261;
  for(let i=0;i<prefix.length;i++){content[i]=prefix.charCodeAt(i)-32;state=Math.imul(state^prefix.charCodeAt(i),16777619)>>>0;}
  state=state||1;
  for(let i=prefix.length;i<content.length;i++){state^=state<<13;state^=state>>>17;state^=state<<5;state>>>=0;content[i]=state%95;}
  return content;
}
export const matchingOrdinalDigits=(prefix:string)=>permuteDigits(matchingContent(prefix),true);
/** Convert bounded chunks only; never create a Safari-sized native BigInt. */
export function packDigits(data:Uint8Array,start:number,count:number):bigint{
  if(count>8192)throw new RangeError('Native radix conversion chunk is too large');
  if(count<=7){let value=0;for(let i=start+count-1;i>=start;i--)value=value*95+data[i];return BigInt(value);}
  const low=Math.floor(count/2);
  return packDigits(data,start,low)+packDigits(data,start+low,count-low)*(95n**BigInt(low));
}
export function coarseNavigation(anchor:NavigationAnchor,p:Position,yaw:number,pitch:number):NavigationHint{
  let [x,y,z]=anchor.direction,logMeters=anchor.logMeters;
  if(anchor.localTarget){
    x=anchor.localTarget[0]-p.x;y=anchor.localTarget[1]-p.y-EYE;z=anchor.localTarget[2]-p.z;
    const distance=Math.hypot(x,y,z);logMeters=Math.log10(Math.max(distance,1e-10));
    if(distance){x/=distance;y/=distance;z/=distance;}
  }
  const right=x*Math.cos(yaw)-z*Math.sin(yaw);
  const forward=-x*Math.sin(yaw)*Math.cos(pitch)+y*Math.sin(pitch)-z*Math.cos(yaw)*Math.cos(pitch);
  const up=x*Math.sin(yaw)*Math.sin(pitch)+y*Math.cos(pitch)+z*Math.cos(yaw)*Math.sin(pitch);
  const direction=[forward<-.15?'Behind you':forward>.15?'Ahead':right<0?'To your left':'To your right',up>.2?'above your view':up<-.2?'below your view':''].filter(Boolean).join(' · ');
  const logLy=logMeters-Math.log10(9460730472580800),exponent=Math.floor(logLy);
  const mantissa=Math.pow(10,logLy-exponent);
  // Avoid rounding a mantissa to 10 without carrying its exponent.
  const rounded=Number(mantissa.toPrecision(2));
  const power=rounded>=10?exponent+1:exponent;
  const scientific=`${rounded>=10?'1.0':rounded.toPrecision(2)}${power===0?'':` × 10^${power}`}`;
  const distance=logMeters<3?`${Math.round(10**logMeters)} metres`:logLy<0?`${(10**(logMeters-3)).toLocaleString('en',{maximumSignificantDigits:3})} km`:`${scientific} light years`;
  return {angle:Math.atan2(right,forward)*180/Math.PI,direction,distance};
}

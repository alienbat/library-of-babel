import type {GlobalFrame} from './global-books.ts';
import type {Position,TravelMode,WorldLimits} from './physics.ts';
export const JOURNEY_STORAGE='babel-journey-v1';
export const WALK_YEARS=['1','1000','1000000','1000000000'] as const;
export type WalkDirection='Up'|'Down'|'East'|'West';
export const WALK_DIRECTIONS:WalkDirection[]=['Up','Down','East','West'];
export const YEAR_MS=31536000000n, YEAR_WALK_CM=2233800000n;
export type Journey={version:1;journeySeed?:string;limits?:WorldLimits;frame:GlobalFrame;position:Position;yaw:number;pitch:number;mode:TravelMode;fallSpeed:number;distanceMm:string;artificialMs:string;startedAt:number;savedAt:number};
export type WalkResult={frame:GlobalFrame;position:Position;distanceCm:string;elapsedMs:string;stoppedAtEdge:boolean;limits:WorldLimits};
export function newJourneySeed(){const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');}
export function readJourney(storage:Pick<Storage,'getItem'>):Journey|null{
  const raw=storage.getItem(JOURNEY_STORAGE);if(!raw)return null;
  const j=JSON.parse(raw) as Journey;
  if(j.version!==1||!j.frame||!['arrival','bottom-left','bottom-right','top-left','top-right'].includes(j.frame.destination)||
    ![j.frame.floorOffset,j.frame.sectionOffset].every(s=>typeof s==='string'&&/^-?\d+$/.test(s)&&s.length<=10000)||
    (j.journeySeed!==undefined&&!/^[a-f0-9]{64}$/.test(j.journeySeed))||
    (j.limits!==undefined&&Object.values(j.limits).some(n=>typeof n!=='number'||!Number.isFinite(n)))||
    (j.frame.originSearch!==undefined&&(typeof j.frame.originSearch!=='string'||!j.frame.originSearch.length||j.frame.originSearch.length>3200||!/^[\x20-\x7e]+$/.test(j.frame.originSearch)))||
    (j.frame.originSeed!==undefined&&!/^[a-f0-9]{64}$/.test(j.frame.originSeed))||
    ![j.position?.x,j.position?.y,j.position?.z,j.yaw,j.pitch,j.fallSpeed].every(n=>typeof n==='number'&&Number.isFinite(n))||
    Math.abs(j.position.x)>10000||Math.abs(j.position.y)>10000||Math.abs(j.position.z)>100||Math.abs(j.pitch)>1.6||j.fallSpeed<0||j.fallSpeed>60||
    !['walking','flying','falling'].includes(j.mode)||![j.distanceMm,j.artificialMs].every(s=>typeof s==='string'&&/^\d+$/.test(s)&&s.length<=10000)||
    ![j.startedAt,j.savedAt].every(n=>Number.isSafeInteger(n)&&n>0))throw new Error('Saved progress could not be read.');
  return j;
}
export function bigCount(n:bigint):string{if(n<0n)return '-'+bigCount(-n);const s=n.toString();return s.length<=15?n.toLocaleString('en'):`${s[0]}.${s.slice(1,3).padEnd(2,'0')} × 10^${s.length-1}`;}
export function libraryTime(startedAt:number,artificialMs:string,now=Date.now()){
  let seconds=(BigInt(Math.max(0,Math.floor(now-startedAt)))+BigInt(artificialMs))/1000n;
  const days=seconds/86400n,years=days/365n;let remaining=Number(days%365n),months=0;
  const lengths=[31,28,31,30,31,30,31,31,30,31,30,31];
  while(remaining>=lengths[months]){remaining-=lengths[months++];}
  seconds%=86400n;const hh=(seconds/3600n).toString().padStart(2,'0'),mm=(seconds/60n%60n).toString().padStart(2,'0'),ss=(seconds%60n).toString().padStart(2,'0');
  return {days:bigCount(days),clock:`${bigCount(years)} years · ${months} months · ${remaining} days · ${hh}:${mm}:${ss}`};
}

export function walkDistanceLabel(years:string){return bigCount(BigInt(years)*YEAR_WALK_CM/100n);}

import {BAY,HEIGHT,OUTER,mod,type Position} from './physics.ts';
export const PAGE_COUNT=410,LINES_PER_PAGE=40,CHARS_PER_LINE=80,BOOKS_PER_ROW=570,ROWS=8;
import type {GlobalFrame} from './global-books.ts';
export type BookLocation={frame?:GlobalFrame;level:number;side:-1|1;bay:number;row:number;book:number};
export function localBookId(b:BookLocation){return `v1/L${b.level}/${b.side===1?'N':'S'}/S${b.bay*ROWS+b.row}/B${b.book+1}`;}
export function bookId(b:BookLocation){
  if(!b.frame)return localBookId(b);
  return `v2/${b.frame.destination}${b.frame.originRef?`@${b.frame.originRef}`:''}${b.frame.originExact!==undefined?`=${encodeURIComponent(b.frame.originExact)}`:''}${b.frame.originSearch!==undefined?`!${encodeURIComponent(b.frame.originSearch)}`:b.frame.originSeed?`~${b.frame.originSeed}`:''}/F${BigInt(b.frame.floorOffset)+BigInt(b.level)}/S${BigInt(b.frame.sectionOffset)+BigInt(b.bay)}/${b.side===1?'N':'S'}/R${b.row+1}/B${b.book+1}`;
}
/** Display only: the full identity remains available to storage and book generation. */
export function bookDisplayId(b:BookLocation){const id=bookId(b);return id.length>120?`${id.slice(0,28)}…${id.slice(-80)} (abbreviated)`:id;}
export function bookCenter(b:BookLocation):Position{return {x:b.bay*BAY+(b.book+.5)*BAY/BOOKS_PER_ROW,y:b.level*HEIGHT+.30+b.row*.39,z:b.side*(OUTER-.08)};}
export function turnPage(page:number,delta:number){return Math.max(0,Math.min(PAGE_COUNT-1,page+delta));}
/** Constant-time picking on the exposed book spines, including gaps and trim. */
export function pickBook(origin:Position,direction:Position,level:number,reach=2.2):BookLocation|null {
  const side=origin.z>=0?1:-1;
  if(direction.z*side<=1e-8||Math.abs(origin.z)>OUTER-.21)return null;
  // The existing walking collider allows the eye 1 cm inside the spine face.
  const distance=Math.max(0,(side*(OUTER-.23)-origin.z)/direction.z);
  if(distance<0||distance>reach)return null;
  const x=origin.x+direction.x*distance,y=origin.y+direction.y*distance;
  const bay=Math.floor(x/BAY);if(mod(bay,12)===0)return null;
  const local=x-bay*BAY,book=Math.floor(local/BAY*BOOKS_PER_ROW);
  const row=Math.round((y-level*HEIGHT-.30)/.39);
  if(row<0||row>=ROWS||book<0||book>=BOOKS_PER_ROW)return null;
  const candidate:BookLocation={level,side,bay,row,book},center=bookCenter(candidate);
  if(Math.abs(x-center.x)>.037/2||Math.abs(y-center.y)>.34/2)return null;
  // Uprights protrude beyond the spines; do not select through them.
  if(Math.abs(local-Math.round(local/(BAY/8))*(BAY/8))<.055/2)return null;
  return candidate;
}
export const OPENED_STORAGE_KEY='babel-opened-books-v1';
export function loadOpened(storage:Pick<Storage,'getItem'>):Set<string>{
  try{const data:unknown=JSON.parse(storage.getItem(OPENED_STORAGE_KEY)||'[]');return new Set(Array.isArray(data)?data.filter((id):id is string=>typeof id==='string'&&/^v1\/L-?\d+\/[NS]\/S-?\d+\/B\d+$/.test(id)):[]);}catch{return new Set();}
}

/** Running title always comes from the opening of page one. */
export function bookOpeningTitle(opening:string){const first=opening.slice(0,40),period=first.indexOf('.');return period===0?'.':period>0?first.slice(0,period):first;}

/** Diff the worker's local history without scanning shelf instances. */
export function openedChanges(previous:ReadonlySet<string>,next:ReadonlySet<string>){
  const changes:{location:BookLocation;opened:boolean}[]=[];
  function add(id:string,opened:boolean){
    const match=/^v1\/L(-?\d+)\/([NS])\/S(-?\d+)\/B(\d+)$/.exec(id);if(!match)return;
    const level=Number(match[1]),shelf=Number(match[3]),book=Number(match[4])-1;
    if(!Number.isSafeInteger(level)||!Number.isSafeInteger(shelf)||!Number.isInteger(book)||book<0||book>=BOOKS_PER_ROW)return;
    changes.push({location:{level,side:match[2]==='N'?1:-1,bay:Math.floor(shelf/ROWS),row:mod(shelf,ROWS),book},opened});
  }
  for(const id of previous)if(!next.has(id))add(id,false);
  for(const id of next)if(!previous.has(id))add(id,true);
  return changes;
}

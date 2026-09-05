import {BAY,HEIGHT,OUTER,mod,type Position} from './physics.ts';
export const PAGE_COUNT=410,LINES_PER_PAGE=40,CHARS_PER_LINE=80,BOOKS_PER_ROW=570,ROWS=8;
export type BookLocation={level:number;side:-1|1;bay:number;row:number;book:number};
export function bookId(b:BookLocation){return `v1/L${b.level}/${b.side===1?'N':'S'}/S${b.bay*ROWS+b.row}/B${b.book+1}`;}
export function bookCenter(b:BookLocation):Position{return {x:b.bay*BAY+(b.book+.5)*BAY/BOOKS_PER_ROW,y:b.level*HEIGHT+.30+b.row*.39,z:b.side*(OUTER-.08)};}
export function turnPage(page:number,delta:number){return Math.max(0,Math.min(PAGE_COUNT-1,page+delta));}
/** Versioned, page-addressable 128-bit seeded PRNG. Never depends on visit order. */
export function generatePage(book:BookLocation,page:number):string {
  if(!Number.isInteger(page)||page<0||page>=PAGE_COUNT)throw new RangeError('Invalid page');
  const seed=`${bookId(book)}/P${page}`;
  let a=0x9e3779b9,b=0x243f6a88,c=0xb7e15162,d=0xdeadbeef;
  for(let i=0;i<seed.length;i++){
    const v=seed.charCodeAt(i);
    a=Math.imul(a^v,0x85ebca6b);b=Math.imul(b^v,0xc2b2ae35);
    c=Math.imul(c^v,0x27d4eb2f);d=Math.imul(d^v,0x165667b1);
  }
  const next=()=>{a|=0;b|=0;c|=0;d|=0;const t=((a+b|0)+d|0)>>>0;d=d+1|0;a=b^b>>>9;b=c+(c<<3)|0;c=(c<<21|c>>>11)+t|0;return t;};
  for(let i=0;i<20;i++)next();
  const lines:string[]=[];
  for(let line=0;line<LINES_PER_PAGE;line++){
    let text='';for(let col=0;col<CHARS_PER_LINE;col++){
      // Rejection avoids modulo bias across the 95 printable ASCII symbols.
      let n=next();while(n>=4294967290)n=next();
      text+=String.fromCharCode(32+n%95);
    }lines.push(text);
  }
  return lines.join('\n');
}
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

import {resolveLocation} from './location-store.ts';
import {BOOKS_PER_ROW,ROWS,PAGE_COUNT,LINES_PER_PAGE,CHARS_PER_LINE,type BookLocation} from './books.ts';
import {matchingOrdinalDigits,exactOrdinalDigits,packDigits} from './search.ts';
import {destinationState,type Destination} from './destinations.ts';
import {BAY,HEIGHT} from './physics.ts';
export const CHARACTER_COUNT=PAGE_COUNT*LINES_PER_PAGE*CHARS_PER_LINE;
export type GlobalFrame={originRef?:string;originExact?:string;originSearch?:string;originSeed?:string;destination:Destination;floorOffset:string;sectionOffset:string};
export type GlobalBook={frame:GlobalFrame;level:number;bay:number;side:-1|1;row:number;book:number};
export const newFrame=(destination:Destination='arrival'):GlobalFrame=>({destination,floorOffset:'0',sectionOffset:'0'});
let dimensions:ReturnType<typeof computeDimensions>|undefined;
function computeDimensions(){
  const root=95n**BigInt(CHARACTER_COUNT/2),total=root*root;
  // Nearly square physical dimensions; every twelfth section contains amenities.
  const sections=12n*(root/2640n),perFloor=(sections/12n)*11n*BigInt(2*ROWS*BOOKS_PER_ROW);
  const floors=(total+perFloor-1n)/perFloor;
  return {total,sections,floors,perFloor,partialFloor:floors/3n};
}
export function libraryDimensions(){return dimensions??=computeDimensions();}
export function shiftFrame(frame:GlobalFrame,sections:number,floors:number):GlobalFrame{
  if(!Number.isSafeInteger(sections)||!Number.isSafeInteger(floors))throw new RangeError('Invalid local shift');
  return {...frame,sectionOffset:(BigInt(frame.sectionOffset)+BigInt(sections)).toString(),floorOffset:(BigInt(frame.floorOffset)+BigInt(floors)).toString()};
}
export function frameLimits(frame:GlobalFrame){
  if(frame.originRef||frame.originSeed||frame.originSearch||frame.originExact!==undefined)return {};
  const limits={...destinationState(frame.destination).limits};
  const sections=BigInt(frame.sectionOffset),floors=BigInt(frame.floorOffset),near=1000000n;
  if(sections>near||sections< -near){delete limits.minX;delete limits.maxX;}
  else{const dx=Number(sections)*BAY;if(limits.minX!==undefined)limits.minX-=dx;if(limits.maxX!==undefined)limits.maxX-=dx;}
  if(floors>near||floors< -near){delete limits.minY;delete limits.maxY;}
  else{const dy=Number(floors)*HEIGHT;if(limits.minY!==undefined)limits.minY-=dy;if(limits.maxY!==undefined)limits.maxY-=dy;}
  return limits;
}
export function frameOrigin(frame:GlobalFrame){
  if(!['arrival','bottom-left','bottom-right','top-left','top-right'].includes(frame.destination))throw new RangeError('Invalid frame');
  const d=libraryDimensions(),name=frame.destination;
  if(frame.originRef){const a=resolveLocation(frame.originRef);return {floor:BigInt('0x'+a.floorHex)+BigInt(frame.floorOffset),section:BigInt('0x'+a.sectionHex)+BigInt(frame.sectionOffset)};}
  if(frame.originSearch!==undefined||frame.originExact!==undefined){
    const data=frame.originExact!==undefined?exactOrdinalDigits(frame.originExact):matchingOrdinalDigits(frame.originSearch!);
    const pack=(start:number,count:number):bigint=>{if(count<=8192)return packDigits(data,start,count);const low=Math.floor(count/2);return pack(start,low)+pack(start+low,count-low)*95n**BigInt(low);};
    const ordinal=pack(0,data.length),storage=ordinal/d.perFloor,remainder=ordinal%d.perFloor;
    const floor=storage===d.floors-1n?d.partialFloor:storage>=d.partialFloor?storage+1n:storage;
    const occupied=remainder/BigInt(2*ROWS*BOOKS_PER_ROW);
    return {floor:floor+BigInt(frame.floorOffset),section:(occupied/11n)*12n+BigInt(frame.sectionOffset)};
  }
  if(frame.originSeed){
    const seed=frame.originSeed;if(!/^[a-f0-9]{64}$/.test(seed))throw new RangeError('Invalid origin seed');
    let floor=BigInt('0x'+seed.slice(0,32))*d.floors/(1n<<128n);
    if(floor===d.partialFloor)floor++;
    return {floor:floor+BigInt(frame.floorOffset),section:BigInt('0x'+seed.slice(32))*(d.sections/12n)/(1n<<128n)*12n+BigInt(frame.sectionOffset)};
  }
  return {floor:(name==='arrival'?d.floors/2n:name.startsWith('top')?d.floors-1n:0n)+BigInt(frame.floorOffset),
    section:(name==='arrival'?(d.sections/24n)*12n:name.endsWith('right')?d.sections-12n:0n)+BigInt(frame.sectionOffset)};
}
export function absoluteBook(book:GlobalBook){
  const origin=frameOrigin(book.frame);return {floor:origin.floor+BigInt(book.level),section:origin.section+BigInt(book.bay)};
}
export function bookOrdinal(book:GlobalBook):bigint{
  if(![book.level,book.bay,book.row,book.book].every(Number.isSafeInteger)||book.row<0||book.row>=ROWS||book.book<0||book.book>=BOOKS_PER_ROW||![-1,1].includes(book.side))throw new RangeError('Invalid book location');
  const d=libraryDimensions(),{floor,section}=absoluteBook(book);
  if(floor<0n||floor>=d.floors||section<0n||section>=d.sections||section%12n===0n)throw new RangeError('No book at this location');
  // The single partially occupied floor is inside the library, leaving both end floors complete.
  const storageFloor=floor===d.partialFloor?d.floors-1n:floor>d.partialFloor?floor-1n:floor;
  const occupiedSection=section/12n*11n+section%12n-1n;
  const slot=BigInt(((book.side===1?0:1)*ROWS+book.row)*BOOKS_PER_ROW+book.book);
  const index=storageFloor*d.perFloor+occupiedSection*BigInt(2*ROWS*BOOKS_PER_ROW)+slot;
  if(index>=d.total)throw new RangeError('This slot is empty on the partial floor');return index;
}
const powers=new Map<number,bigint>();
function power(n:number){let p=powers.get(n);if(p===undefined){p=95n**BigInt(n);powers.set(n,p);}return p;}
/** Divide-and-conquer radix conversion avoids a million giant sequential divisions. */
export function ordinalDigits(index:bigint,length=CHARACTER_COUNT){
  if(index<0n||index>=power(length))throw new RangeError('Index outside book space');
  const digits=new Uint8Array(length);
  function fill(n:bigint,start:number,count:number){
    if(n===0n)return;
    if(count<=7){let value=Number(n);for(let i=0;i<count;i++){digits[start+i]=value%95;value=Math.floor(value/95);}return;}
    const low=Math.floor(count/2),divisor=power(low),high=n/divisor;
    fill(n-high*divisor,start,low);fill(high,start+low,count-low);
  }
  fill(index,0,length);return digits;
}
const multipliers=[2,3,7,11],inverses=[48,32,68,26];
/** Two triangular bijections over base-95 digits. No hash or finite seed determines identity. */
export function permuteDigits(data:Uint8Array,decode=false){
  function pass(reverse:boolean,invert:boolean){
    let state=reverse?0x7f4a7c15:0x9e3779b9;
    for(let step=0;step<data.length;step++){
      const i=reverse?data.length-1-step:step;
      state^=state<<13;state^=state>>>17;state^=state<<5;state>>>=0;
      const which=state&3,shift=(state>>>2)%95,current=data[i];
      const output=invert?((current-shift+95)*inverses[which])%95:(current*multipliers[which]+shift)%95;
      data[i]=output;
      state=(Math.imul(state^(invert?current:output)^step,1664525)+1013904223)>>>0;
    }
  }
  if(decode){pass(true,true);pass(false,true);}else{pass(false,false);pass(true,false);}return data;
}
export function uniqueBook(book:GlobalBook){return permuteDigits(ordinalDigits(bookOrdinal(book)));}
export function textPage(data:Uint8Array,page:number){
  if(!Number.isInteger(page)||page<0||page>=PAGE_COUNT)throw new RangeError('Invalid page');
  const lines:string[]=[];let offset=page*LINES_PER_PAGE*CHARS_PER_LINE;
  for(let row=0;row<LINES_PER_PAGE;row++){let line='';for(let col=0;col<CHARS_PER_LINE;col++)line+=String.fromCharCode(32+data[offset++]);lines.push(line);}return lines.join('\n');
}
export function globalBook(local:BookLocation,frame:GlobalFrame):GlobalBook{return {frame:{...frame},level:local.level,bay:local.bay,side:local.side,row:local.row,book:local.book};}
export function projectBook(book:GlobalBook,frame:GlobalFrame):BookLocation|null{
  const absolute=absoluteBook(book),origin=frameOrigin(frame),level=absolute.floor-origin.floor,bay=absolute.section-origin.section;
  const safe=BigInt(Number.MAX_SAFE_INTEGER);
  if(level>safe||level< -safe||bay>safe||bay< -safe)return null;
  return {level:Number(level),bay:Number(bay),side:book.side,row:book.row,book:book.book};
}

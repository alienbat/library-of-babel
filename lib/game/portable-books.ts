import {WALK_YEARS,WALK_DIRECTIONS,YEAR_WALK_CM,YEAR_MS,type WalkDirection,type WalkResult} from './journey.ts';
import {packDigits,type SearchAddress,type NavigationAnchor} from './search.ts';
import {BAY,HEIGHT,OUTER,INNER,type Position} from './physics.ts';
import {init} from 'gmp-wasm/dist/mini.esm.js';
import {BOOKS_PER_ROW,ROWS,type BookLocation} from './books.ts';
import {CHARACTER_COUNT,ordinalDigits,type GlobalBook,type GlobalFrame} from './global-books.ts';

/** GMP uses WebAssembly memory, avoiding Safari's one-million-bit BigInt ceiling.
 * Keep the v2 layout and radix mapping identical to the native reference implementation.
 * Every request owns a context so temporary integers are freed, including on errors.
 */
export async function createPortableBookMath(){
  const gmp=await init();
  return {
    withContext<T>(run:(math:ReturnType<typeof contextMath>)=>T):T{
      const ctx=gmp.getContext();
      try{return run(contextMath(ctx.Integer));}finally{ctx.destroy();}
    },
  };
}
// The package's recursive Integer declaration predates current TypeScript.
// Describe only the integer operations used here (all return immutable values).
interface IntegerValue {
  add(n:IntegerValue|number):IntegerValue;sub(n:IntegerValue|number):IntegerValue;
  mul(n:IntegerValue|number):IntegerValue;div(n:IntegerValue|number,mode:number):IntegerValue;
  pow(n:number):IntegerValue;abs():IntegerValue;
  isEqual(n:IntegerValue|number):boolean;lessThan(n:IntegerValue|number):boolean;
  greaterThan(n:IntegerValue|number):boolean;greaterOrEqual(n:IntegerValue|number):boolean;
  toNumber():number;toString(radix?:number):string;
}
function contextMath(factory:import('gmp-wasm').CalculateType['Integer']){
  const Integer=factory as unknown as (n:number|string,radix?:number)=>IntegerValue;
  const powers=new Map<number,IntegerValue>();
  function power(n:number){let p=powers.get(n);if(!p){p=Integer(95).pow(n);powers.set(n,p);}return p;}
  let dimensions:ReturnType<typeof computeDimensions>|undefined;
  function computeDimensions(){
    const root=power(CHARACTER_COUNT/2),total=root.mul(root);
    const sections=root.div(2640,2).mul(12),perFloor=sections.div(12,2).mul(11*2*ROWS*BOOKS_PER_ROW);
    const floors=total.add(perFloor).sub(1).div(perFloor,2),partialFloor=floors.div(3,2);
    return {total,sections,perFloor,floors,partialFloor};
  }
  const library=()=>dimensions??=computeDimensions();
  // String conversion prevents the library's int32 fast paths from truncating local integers.
  const integer=(n:number|string)=>Integer(String(n));
  function origin(frame:GlobalFrame){
    const name=frame.destination;
    const {floors,sections}=library();
    if(!['arrival','bottom-left','bottom-right','top-left','top-right'].includes(name))throw new RangeError('Invalid frame');
    if(frame.originSeed){
      const seed=frame.originSeed;if(!/^[a-f0-9]{64}$/.test(seed))throw new RangeError('Invalid origin seed');
      const divisor=Integer(2).pow(128);
      let floor=Integer(seed.slice(0,32),16).mul(floors).div(divisor,2);
      if(floor.isEqual(library().partialFloor))floor=floor.add(1);
      return {floor:floor.add(integer(frame.floorOffset)),section:Integer(seed.slice(32),16).mul(sections.div(12,2)).div(divisor,2).mul(12).add(integer(frame.sectionOffset))};
    }
    return {
      floor:(name==='arrival'?floors.div(2,2):name.startsWith('top')?floors.sub(1):Integer(0)).add(integer(frame.floorOffset)),
      section:(name==='arrival'?sections.div(24,2).mul(12):name.endsWith('right')?sections.sub(12):Integer(0)).add(integer(frame.sectionOffset)),
    };
  }
  function absolute(book:GlobalBook){const base=origin(book.frame);return {floor:base.floor.add(integer(book.level)),section:base.section.add(integer(book.bay))};}
  function bookOrdinal(book:GlobalBook){
    if(![book.level,book.bay,book.row,book.book].every(Number.isSafeInteger)||book.row<0||book.row>=ROWS||book.book<0||book.book>=BOOKS_PER_ROW||![-1,1].includes(book.side))throw new RangeError('Invalid book location');
    const {floors,sections,partialFloor,perFloor,total}=library();
    const {floor,section}=absolute(book),block=section.div(12,2),remainder=section.sub(block.mul(12));
    if(floor.lessThan(0)||floor.greaterOrEqual(floors)||section.lessThan(0)||section.greaterOrEqual(sections)||remainder.isEqual(0))throw new RangeError('No book at this location');
    const storageFloor=floor.isEqual(partialFloor)?floors.sub(1):floor.greaterThan(partialFloor)?floor.sub(1):floor;
    const occupiedSection=block.mul(11).add(remainder).sub(1);
    const slot=((book.side===1?0:1)*ROWS+book.row)*BOOKS_PER_ROW+book.book;
    const index=storageFloor.mul(perFloor).add(occupiedSection.mul(2*ROWS*BOOKS_PER_ROW)).add(slot);
    if(index.greaterOrEqual(total))throw new RangeError('This slot is empty on the partial floor');
    return index;
  }
  function walk(frame:GlobalFrame,p:Position,direction:WalkDirection,years:string):WalkResult{
    if(!WALK_DIRECTIONS.includes(direction)||!WALK_YEARS.includes(years as typeof WALK_YEARS[number]))throw new RangeError('Invalid walk selection');
    const base=origin(frame),d=library(),vertical=direction==='Up'||direction==='Down',sign=direction==='Up'||direction==='East'?1:-1;
    const budget=integer(years).mul(integer(YEAR_WALK_CM.toString()));
    const x=base.section.mul(2286).add(integer(Math.round(p.x*100))),y=base.floor.mul(396).add(integer(Math.round(p.y*100)));
    const current=vertical?y:x,maximum=vertical?d.floors.sub(1).mul(396):d.sections.mul(2286).sub(30),minimum=integer(vertical?0:30);
    let target=current.add(budget.mul(sign));
    if(target.lessThan(minimum))target=minimum;if(target.greaterThan(maximum))target=maximum;
    const travelled=target.sub(current).abs();
    const actual=travelled.greaterThan(budget)?integer(0):travelled;
    const stopped=actual.lessThan(budget);
    const nextX=vertical?x:target,nextY=vertical?target:y;
    const block=nextX.div(27432,2),floor=nextY.div(396,2);
    const initial=origin({...frame,floorOffset:'0',sectionOffset:'0'});
    const limits:import('./physics.ts').WorldLimits={};
    const left=block.mul(27432),right=d.sections.mul(2286).sub(left),bottom=floor.mul(396),top=d.floors.sub(1).sub(floor).mul(396);
    if(left.lessThan(100000000))limits.minX=left.isEqual(0)?0:-left.toNumber()/100;
    if(right.lessThan(100000000))limits.maxX=right.toNumber()/100;
    if(bottom.lessThan(100000000))limits.minY=bottom.isEqual(0)?0:-bottom.toNumber()/100;
    if(top.lessThan(100000000))limits.maxY=top.toNumber()/100+HEIGHT-.34;
    const elapsed=stopped?actual.mul(240).div(17,2):integer(years).mul(integer(YEAR_MS.toString()));
    return {frame:{...frame,sectionOffset:block.mul(12).sub(initial.section).toString(),floorOffset:floor.sub(initial.floor).toString()},
      position:{x:nextX.sub(block.mul(27432)).toNumber()/100,y:0,z:(p.z<0?-1:1)*(INNER+1.7)},distanceCm:actual.toString(),elapsedMs:elapsed.toString(),stoppedAtEdge:stopped,limits};
  }
  function digits(index:IntegerValue){
    const result=new Uint8Array(CHARACTER_COUNT);
    function fill(n:IntegerValue,start:number,count:number){
      if(n.isEqual(0))return;
      // At most 54,000 bits enter native BigInt, well below WebKit's limit.
      if(count<=8192){result.set(ordinalDigits(BigInt('0x'+n.toString(16)),count),start);return;}
      const low=Math.floor(count/2),divisor=power(low),high=n.div(divisor,2);
      fill(n.sub(high.mul(divisor)),start,low);fill(high,start+low,count-low);
    }
    fill(index,0,CHARACTER_COUNT);return result;
  }
  function projectBook(book:GlobalBook,frame:GlobalFrame):BookLocation|null{
    const a=absolute(book),o=origin(frame),level=a.floor.sub(o.floor),bay=a.section.sub(o.section);
    const safe=integer(Number.MAX_SAFE_INTEGER);
    if(level.abs().greaterThan(safe)||bay.abs().greaterThan(safe))return null;
    return {level:level.toNumber(),bay:bay.toNumber(),side:book.side,row:book.row,book:book.book};
  }
  function fromDigits(data:Uint8Array){
    if(data.length!==CHARACTER_COUNT||data.some(d=>d>=95))throw new RangeError('Invalid book digits');
    function pack(start:number,count:number):IntegerValue{
      if(count<=8192)return Integer(packDigits(data,start,count).toString(16),16);
      const low=Math.floor(count/2);
      return pack(start,low).add(pack(start+low,count-low).mul(power(low)));
    }
    return pack(0,data.length);
  }
  function addressFromOrdinal(index:IntegerValue):SearchAddress{
    const {floors,perFloor,partialFloor,total}=library();
    if(index.lessThan(0)||index.greaterOrEqual(total))throw new RangeError('Invalid ordinal');
    const storage=index.div(perFloor,2),remainder=index.sub(storage.mul(perFloor));
    const floor=storage.isEqual(floors.sub(1))?partialFloor:storage.greaterOrEqual(partialFloor)?storage.add(1):storage;
    const occupied=remainder.div(2*ROWS*BOOKS_PER_ROW,2),block=occupied.div(11,2);
    const section=block.mul(12).add(occupied.sub(block.mul(11))).add(1);
    const slot=remainder.sub(occupied.mul(2*ROWS*BOOKS_PER_ROW)).toNumber();
    return {floorHex:floor.toString(16),sectionHex:section.toString(16),side:slot<ROWS*BOOKS_PER_ROW?1:-1,row:Math.floor(slot/BOOKS_PER_ROW)%ROWS,book:slot%BOOKS_PER_ROW};
  }
  function navigation(address:SearchAddress,frame:GlobalFrame):NavigationAnchor{
    const base=origin(frame);
    const dx=Integer(address.sectionHex,16).sub(base.section),dy=Integer(address.floorHex,16).sub(base.floor);
    const safe=integer(1000000000);
    const z=address.side*(OUTER-.08),offsetX=(address.book+.5)*BAY/BOOKS_PER_ROW,offsetY=.3+address.row*.39;
    if(dx.abs().lessThan(safe)&&dy.abs().lessThan(safe)){
      const localTarget:[number,number,number]=[dx.toNumber()*BAY+offsetX,dy.toNumber()*HEIGHT+offsetY,z];
      return {direction:[0,0,0],logMeters:0,localTarget};
    }
    function magnitude(n:IntegerValue,scale:number){
      if(n.isEqual(0))return {log:-Infinity,sign:0};
      const hex=n.abs().toString(16),head=hex.slice(0,13);
      return {log:Math.log10(parseInt(head,16))+(hex.length-head.length)*Math.log10(16)+Math.log10(scale),sign:n.lessThan(0)?-1:1};
    }
    const ax=magnitude(dx,BAY),ay=magnitude(dy,HEIGHT),largest=Math.max(ax.log,ay.log);
    const x=ax.sign*10**(ax.log-largest),y=ay.sign*10**(ay.log-largest),length=Math.hypot(x,y);
    return {direction:[x/length,y/length,0],logMeters:largest+Math.log10(length)};
  }
  return {walk,bookOrdinal,digits,projectBook,fromDigits,addressFromOrdinal,navigation};
}

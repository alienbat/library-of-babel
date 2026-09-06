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
  const Integer=factory as unknown as (n:number|string)=>IntegerValue;
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
  return {bookOrdinal,digits,projectBook};
}

import assert from 'node:assert/strict';
import test from 'node:test';
import {matchingContent,matchingOrdinalDigits,coarseNavigation,MAX_PREFIX,type SearchAddress} from '../lib/game/search.ts';
import {createPortableBookMath} from '../lib/game/portable-books.ts';
import {bookOrdinal,libraryDimensions,newFrame,shiftFrame,permuteDigits,textPage,ordinalDigits} from '../lib/game/global-books.ts';
import {BAY,HEIGHT,EYE} from '../lib/game/physics.ts';

function location(a:SearchAddress){return {frame:{destination:'bottom-left' as const,floorOffset:BigInt('0x'+a.floorHex).toString(),sectionOffset:BigInt('0x'+a.sectionHex).toString()},level:0,bay:0,side:a.side,row:a.row,book:a.book};}
void test('prefix search finds an existing book whose complete contents regenerate unchanged',async()=>{
  const prefix='My name is Soren',expected=matchingContent(prefix),portable=await createPortableBookMath();
  assert.deepEqual(matchingContent(prefix),expected);
  portable.withContext(math=>{
    const index=math.fromDigits(matchingOrdinalDigits(prefix)),address=math.addressFromOrdinal(index);
    assert.equal(bookOrdinal(location(address)).toString(16),index.toString(16));
    const regenerated=permuteDigits(math.digits(index));
    assert.deepEqual(regenerated,expected);
    assert.ok(textPage(regenerated,0).startsWith(prefix));
    const bottom=math.navigation(address,newFrame('bottom-left')),top=math.navigation(address,newFrame('top-right'));
    assert.ok(bottom.direction[0]>0&&bottom.direction[1]>0);
    assert.ok(top.direction[0]<0&&top.direction[1]<0);
    for(const anchor of [bottom,top,math.navigation(address,newFrame())]){
      assert.ok(Number.isFinite(anchor.logMeters));
      assert.ok(Math.abs(Math.hypot(...anchor.direction)-1)<1e-10);
      assert.match(coarseNavigation(anchor,{x:0,y:0,z:0},0,0).distance,/× 10\^\d+ light years/);
    }
  });
});
void test('inverse shelf layout covers boundary books and the relocated partial floor',async()=>{
  const portable=await createPortableBookMath(),d=libraryDimensions();
  portable.withContext(math=>{
    for(const rank of [0n,9119n,9120n,d.partialFloor*d.perFloor-1n,d.partialFloor*d.perFloor,(d.floors-1n)*d.perFloor,d.total-1n]){
      const address=math.addressFromOrdinal(math.fromDigits(ordinalDigits(rank)));
      assert.equal(bookOrdinal(location(address)),rank);
    }
  });
});
void test('matching preserves spaces and case and rejects characters outside the book alphabet',()=>{
  const content=matchingContent(' AbC ');
  assert.equal(String.fromCharCode(...content.slice(0,5).map(x=>x+32)),' AbC ');
  for(const prefix of ['', 'a\nb', 'Søren','x'.repeat(MAX_PREFIX+1)])assert.throws(()=>matchingContent(prefix),RangeError);
  assert.equal(matchingContent('x'.repeat(MAX_PREFIX)).length,1312000);
});
void test('nearby navigation tracks movement, camera bearing and floating-origin rebasing',async()=>{
  const portable=await createPortableBookMath();
  portable.withContext(math=>{
    const frame=newFrame('bottom-left'),book={frame,level:2,bay:1,side:1 as const,row:2,book:200};
    const address=math.addressFromOrdinal(math.bookOrdinal(book));
    const first=math.navigation(address,frame),shifted=math.navigation(address,shiftFrame(frame,1200,1000));
    const p={x:10,y:2,z:0};
    const before=coarseNavigation(first,p,0,0),after=coarseNavigation(shifted,{x:p.x-1200*BAY,y:p.y-1000*HEIGHT,z:0},0,0);
    assert.equal(before.direction,after.direction);assert.equal(before.distance,after.distance);assert.ok(Math.abs(before.angle-after.angle)<1e-8);
  });
  const anchor={direction:[0,0,0] as [number,number,number],logMeters:0,localTarget:[0,EYE,-100] as [number,number,number]};
  assert.equal(coarseNavigation(anchor,{x:0,y:0,z:0},0,0).direction,'Ahead');
  assert.equal(coarseNavigation(anchor,{x:0,y:0,z:0},Math.PI,0).direction,'Behind you');
  assert.equal(coarseNavigation(anchor,{x:0,y:0,z:-50},0,0).distance,'50 metres');
  assert.equal(coarseNavigation({...anchor,localTarget:[0,100+EYE,0]},{x:0,y:0,z:0},0,Math.PI/2).direction,'Ahead');
});

void test('navigation distance uses metres, kilometres, then light years at their boundaries',()=>{
  const distance=(metres:number)=>coarseNavigation({direction:[1,0,0],logMeters:Math.log10(metres)},{x:0,y:0,z:0},0,0).distance;
  assert.equal(distance(999),'999 metres');
  assert.equal(distance(1000),'1 km');
  assert.equal(distance(1250),'1.25 km');
  assert.equal(distance(12345678),'12,300 km');
  assert.match(distance(9460730472580800*.999),/ km$/);
  assert.equal(distance(9460730472580800),'1.0 light years');
  assert.equal(distance(9460730472580800*1.1),'1.1 light years');
  assert.equal(distance(9460730472580800*100),'1.0 × 10^2 light years');
});

void test('target teleport lands at the exact searched book and survives a saved frame',async()=>{
  const {readJourney}=await import('../lib/game/journey.ts');
  const {bookId}=await import('../lib/game/books.ts');
  const prefix='My name is Soren',portable=await createPortableBookMath();
  let savedFrame:ReturnType<typeof newFrame>;
  let address:SearchAddress;
  portable.withContext(math=>{
    const index=math.fromDigits(matchingOrdinalDigits(prefix));address=math.addressFromOrdinal(index);
    const landing=math.targetLanding(address,{...newFrame(),originSearch:prefix});savedFrame=landing.frame;
    assert.ok(JSON.stringify(savedFrame).length<200,'search anchors persist without million-digit coordinates');
    const nearby=math.navigation(address,landing.frame).localTarget!;
    assert.equal(nearby[0],landing.position.x);assert.ok(Math.abs(nearby[2]-landing.position.z)<1.2);
    const book={frame:landing.frame,level:0,bay:Math.floor(landing.position.x/BAY),side:address.side,row:address.row,book:address.book};
    assert.equal(math.bookOrdinal(book).toString(16),index.toString(16));
    assert.equal(bookOrdinal(book).toString(16),index.toString(16),'native reference agrees with the search frame');
    assert.notEqual(bookId(book),bookId({...book,frame:newFrame()}));
    assert.equal(landing.position.y,0);
    const bookmarkLanding=math.targetLanding(address,landing.frame);
    assert.deepEqual(bookmarkLanding,landing,'bookmark and search teleport to the same shelf');
  });
  const saved={version:1,frame:savedFrame!,position:{x:30,y:0,z:16.94},yaw:0,pitch:0,mode:'walking',fallSpeed:0,distanceMm:'1234',artificialMs:'0',startedAt:1700000000000,savedAt:1700000000001};
  const restored=readJourney({getItem:()=>JSON.stringify(saved)})!;
  const reloaded=await createPortableBookMath();
  reloaded.withContext(math=>assert.ok(math.navigation(address!,restored.frame).localTarget,'search origin regenerates after reload'));
});
void test('target teleport retains corner boundary clipping on both galleries',async()=>{
  const portable=await createPortableBookMath();
  portable.withContext(math=>{
    for(const destination of ['bottom-left','top-right'] as const)for(const side of [-1,1] as const){
      const frame=newFrame(destination),book={frame,level:0,bay:1,side,row:7,book:569};
      const address=math.addressFromOrdinal(math.bookOrdinal(book)),landing=math.targetLanding(address,frame);
      assert.ok(destination==='bottom-left'?landing.limits.minY===0:landing.limits.maxY===HEIGHT-.34);
      assert.equal(Math.sign(landing.position.z),side);
      assert.ok(math.navigation(address,landing.frame).localTarget);
    }
  });
});

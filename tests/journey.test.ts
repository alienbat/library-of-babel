import assert from 'node:assert/strict';
import test from 'node:test';
import {createPortableBookMath} from '../lib/game/portable-books.ts';
import {newFrame,frameOrigin,globalBook} from '../lib/game/global-books.ts';
import {bookId} from '../lib/game/books.ts';
import {libraryTime,readJourney,YEAR_MS,YEAR_WALK_CM,type Journey} from '../lib/game/journey.ts';
void test('journey clock adds offline and artificial time while retaining small units',()=>{
  const start=1700000000000,extra=1000000000n*YEAR_MS+31n*86400000n;
  const clock=libraryTime(start,extra.toString(),start+86400000+3661000);
  assert.equal(clock.clock,'1,000,000,000 years · 1 months · 1 days · 01:01:01');
  const enormous=libraryTime(start,(10n**30n*YEAR_MS+32n*86400000n+3661000n).toString(),start);
  assert.match(enormous.clock,/1.00 × 10\^30 years · 1 months · 1 days · 01:01:01/);
});
void test('random origin is deterministic, separates identities and agrees with portable arithmetic',async()=>{
  const portable=await createPortableBookMath();
  const frame={...newFrame(),originSeed:'1234567890abcdef'.repeat(4)},book=globalBook({level:0,bay:1,side:1,row:0,book:0},frame);
  const origin=frameOrigin(frame);
  assert.notEqual(bookId(book),bookId({...book,frame:newFrame()}));
  portable.withContext(math=>{
    const address=math.addressFromOrdinal(math.bookOrdinal(book));
    assert.equal(address.floorHex,origin.floor.toString(16));assert.equal(address.sectionHex,(origin.section+1n).toString(16));
  });
});
void test('billion-year walks preserve exact distance, frame and boundary limits',async()=>{
  const portable=await createPortableBookMath(),frame={...newFrame(),originSeed:'456789abcdef0123'.repeat(4)},position={x:30,y:0,z:16.94};
  portable.withContext(math=>{
    for(const direction of ['East','West','Up','Down'] as const){
      const result=math.walk(frame,position,direction,'1000000000');
      assert.equal(result.distanceCm,(YEAR_WALK_CM*1000000000n).toString());assert.equal(result.elapsedMs,(YEAR_MS*1000000000n).toString());
      const a=frameOrigin(frame),b=frameOrigin(result.frame),sign=direction==='East'||direction==='Up'?1n:-1n;
      if(direction==='East'||direction==='West')assert.equal((b.section-a.section)*2286n+BigInt(Math.round(result.position.x*100))-3000n,sign*YEAR_WALK_CM*1000000000n);
      else {const error=(b.floor-a.floor)*396n-sign*YEAR_WALK_CM*1000000000n;assert.ok(error<=0n&&error> -396n,'vertical destination is the floor below the ideal endpoint');}
      assert.equal(result.position.y,0);assert.equal(result.stoppedAtEdge,false);
    }
    const blocked=math.walk(newFrame('bottom-left'),{x:30,y:0,z:16.94},'Down','1');
    assert.equal(blocked.distanceCm,'0');assert.equal(blocked.elapsedMs,'0');assert.equal(blocked.limits.minY,0);
    const west=math.walk(newFrame('bottom-left'),position,'West','1');
    assert.equal(west.distanceCm,'2970');assert.equal(west.position.x,.3);assert.equal(west.stoppedAtEdge,true);
    assert.throws(()=>math.walk(frame,position,'East','3'));
  });
});
void test('save roundtrip retains flight, coordinates and integer ledgers; malformed saves fail',()=>{
  const j:Journey={version:1,frame:{...newFrame(),originSeed:'1234567890abcdef'.repeat(4)},position:{x:30,y:5,z:0},yaw:1,pitch:.4,mode:'falling',fallSpeed:42,distanceMm:'22338000000000000000',artificialMs:(1000000000n*YEAR_MS).toString(),startedAt:1700000000000,savedAt:1700000001000};
  assert.deepEqual(readJourney({getItem:()=>JSON.stringify(j)}),j);
  assert.equal(readJourney({getItem:()=>null}),null);
  assert.throws(()=>readJourney({getItem:()=>JSON.stringify({...j,distanceMm:'NaN'})}));
});

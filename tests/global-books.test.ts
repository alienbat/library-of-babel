import assert from 'node:assert/strict';
import test from 'node:test';
import {bookId} from '../lib/game/books.ts';
import {DESTINATIONS} from '../lib/game/destinations.ts';
import {libraryDimensions,frameOrigin,newFrame,shiftFrame,frameLimits,globalBook,bookOrdinal,projectBook,ordinalDigits,permuteDigits,uniqueBook,textPage} from '../lib/game/global-books.ts';
const local={level:0,bay:1,side:1 as const,row:3,book:120};
void test('exact layout covers the full book space, with one partial interior floor',()=>{
  const d=libraryDimensions();assert.equal(d.sections%12n,0n);
  assert.ok((d.floors-1n)*d.perFloor<d.total&&d.floors*d.perFloor>=d.total);
  assert.ok(d.partialFloor>0n&&d.partialFloor<d.floors-1n);
  const ranks=DESTINATIONS.map(destination=>bookOrdinal(globalBook({...local,bay:destination.endsWith('right')?11:1},newFrame(destination))));
  assert.equal(new Set(ranks).size,5);assert.ok(ranks.every(rank=>rank>=0n&&rank<d.total));
  assert.throws(()=>bookOrdinal(globalBook({...local,bay:0},newFrame('bottom-left'))),RangeError);
});
void test('rebasing preserves global identity, contents and projected opened-book location',()=>{
  const original=globalBook(local,newFrame('arrival'));
  const shifted=shiftFrame(original.frame,1200,-1000);
  const rebased={...original,frame:shifted,bay:local.bay-1200,level:1000};
  assert.equal(bookOrdinal(original),bookOrdinal(rebased));assert.equal(bookId(original),bookId(rebased));
  assert.deepEqual(projectBook(original,shifted),{...local,bay:local.bay-1200,level:1000});
  assert.equal(projectBook(original,newFrame('top-right')),null);
  // An alternative anchor expression for exactly the same physical address must alias the same book.
  const atOrigin=frameOrigin(original.frame);
  const equivalent={...original,frame:{destination:'bottom-left' as const,floorOffset:atOrigin.floor.toString(),sectionOffset:atOrigin.section.toString()}};
  assert.equal(bookOrdinal(original),bookOrdinal(equivalent));
  assert.deepEqual(projectBook(equivalent,newFrame()),local);
});
void test('base-95 conversion and reversible permutation are bijective, exhaustively for two digits',()=>{
  const seen=new Set<string>();
  for(let index=0;index<95*95;index++){
    const raw=ordinalDigits(BigInt(index),2),scrambled=permuteDigits(raw.slice());
    seen.add(scrambled.join(','));assert.deepEqual(permuteDigits(scrambled.slice(),true),raw);
  }
  assert.equal(seen.size,95*95);
  const longer=Uint8Array.from({length:4096},(_,i)=>i%95);
  assert.deepEqual(permuteDigits(permuteDigits(longer.slice()),true),longer);
});
void test('full books repeat exactly, while global destinations change the contents',()=>{
  const bottom=globalBook(local,newFrame('bottom-left'));
  const content=uniqueBook(bottom);assert.deepEqual(content,uniqueBook(bottom));assert.deepEqual(content.slice(0,8),Uint8Array.from([16,28,93,15,40,45,11,67]));
  const top=uniqueBook(globalBook({...local,bay:11},newFrame('top-right')));
  assert.notDeepEqual(content,top);assert.notEqual(textPage(content,0),textPage(top,0));
  assert.equal(content.length,1312000);
});

void test('corner limits recover exactly after arbitrarily large frame offsets',()=>{
  const frame=newFrame('bottom-left');
  const far={...frame,sectionOffset:'1'+'0'.repeat(400),floorOffset:'1'+'0'.repeat(400)};
  assert.deepEqual(frameLimits(far),{});
  assert.deepEqual(frameLimits({...far,sectionOffset:'0',floorOffset:'0'}),frameLimits(frame));
});

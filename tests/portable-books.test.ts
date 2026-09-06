import assert from 'node:assert/strict';
import test from 'node:test';
import {createPortableBookMath} from '../lib/game/portable-books.ts';
import {DESTINATIONS} from '../lib/game/destinations.ts';
import {globalBook,newFrame,shiftFrame,bookOrdinal,ordinalDigits,frameOrigin} from '../lib/game/global-books.ts';

void test('portable arithmetic preserves every v2 digit at all five destinations',async()=>{
  const portable=await createPortableBookMath();
  for(const destination of DESTINATIONS){
    const book=globalBook({level:0,bay:destination.endsWith('right')?11:1,side:1,row:3,book:120},newFrame(destination));
    const expected=bookOrdinal(book);
    portable.withContext(math=>{
      const ordinal=math.bookOrdinal(book);
      assert.equal(ordinal.toString(16),expected.toString(16));
      assert.deepEqual(math.digits(ordinal),ordinalDigits(expected));
      const frame=shiftFrame(book.frame,1200,-1000);
      assert.deepEqual(math.projectBook(book,frame),{level:1000,bay:book.bay-1200,side:1,row:3,book:120});
      const rebased={...book,frame,level:1000,bay:book.bay-1200};
      assert.ok(math.bookOrdinal(rebased).isEqual(ordinal));
    });
  }
});
void test('portable history recognizes equivalent anchors and rejects empty slots',async()=>{
  const portable=await createPortableBookMath();
  const book=globalBook({level:0,bay:1,side:-1,row:7,book:569},newFrame());
  const origin=frameOrigin(book.frame);
  const equivalent={...book,frame:{destination:'bottom-left' as const,floorOffset:origin.floor.toString(),sectionOffset:origin.section.toString()}};
  portable.withContext(math=>{
    assert.ok(math.bookOrdinal(book).isEqual(math.bookOrdinal(equivalent)));
    assert.deepEqual(math.projectBook(equivalent,newFrame()),{level:0,bay:1,side:-1,row:7,book:569});
    assert.equal(math.projectBook(book,newFrame('top-right')),null);
    assert.throws(()=>math.bookOrdinal({...book,bay:0}),RangeError);
  });
});

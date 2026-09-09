import assert from 'node:assert/strict';
import test from 'node:test';
import {bookmarkName,bookmarkPage,upsertBookmark,type Bookmark} from '../lib/game/bookmarks.ts';
import {createPortableBookMath} from '../lib/game/portable-books.ts';
import {globalBook,newFrame,shiftFrame,frameOrigin} from '../lib/game/global-books.ts';
void test('bookmarks require a name and valid page, and update one canonical book across frames',async()=>{
  const portable=await createPortableBookMath(),records:Bookmark[]=[];
  const book=globalBook({level:0,bay:1,side:1,row:3,book:120},newFrame());
  const base=frameOrigin(book.frame);
  const rebased={...book,frame:shiftFrame(book.frame,12,100),bay:-11,level:-100};
  const corner={...book,frame:{destination:'bottom-left' as const,sectionOffset:base.section.toString(),floorOffset:base.floor.toString()}};
  portable.withContext(math=>{
    const equal=(a:typeof book,b:typeof book)=>math.bookOrdinal(a).isEqual(math.bookOrdinal(b));
    assert.throws(()=>upsertBookmark(records,book,'  ',0,equal,'a'),/name/);assert.equal(records.length,0);
    const saved=upsertBookmark(records,book,' First book ',17,equal,'a');
    assert.equal(saved.name,'First book');assert.equal(saved.page,17);
    upsertBookmark(records,rebased,'Renamed',409,equal,'b');
    assert.equal(records.length,1);assert.equal(records[0].id,'a');assert.equal(records[0].page,409);
    upsertBookmark(records,corner,'Across anchors',55,equal,'c');assert.equal(records.length,1);
    upsertBookmark(records,{...book,book:121},'Second',0,equal,'d');assert.equal(records.length,2);
    const target=math.addressFromOrdinal(math.bookOrdinal(saved.book));
    assert.ok(math.navigation(target,newFrame()).localTarget);
    assert.ok(math.navigation(target,newFrame('top-right')).logMeters>1000);
    const restored=JSON.parse(JSON.stringify(records)) as Bookmark[];
    assert.ok(equal(restored[0].book,corner));assert.equal(restored[0].page,55);
  });
  assert.throws(()=>bookmarkName('x'.repeat(121)));assert.throws(()=>bookmarkPage(-1));assert.throws(()=>bookmarkPage(410));
});

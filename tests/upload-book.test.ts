import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {uploadedContent,exactOrdinalDigits} from '../lib/game/search.ts';
import {CHARACTER_COUNT,permuteDigits} from '../lib/game/global-books.ts';
import {createPortableBookMath} from '../lib/game/portable-books.ts';
import {BAY} from '../lib/game/physics.ts';
void test('upload conversion validates before cutoff and pads empty input',()=>{
  assert.equal(uploadedContent(''), ' '.repeat(CHARACTER_COUNT));
  assert.equal(uploadedContent('A\tB\r\nC\rD\nE').slice(0,320),['AB','C','D','E'].map(s=>s.padEnd(80)).join(''));
  assert.equal(uploadedContent('A'.repeat(CHARACTER_COUNT+10)),'A'.repeat(CHARACTER_COUNT));
  assert.throws(()=>uploadedContent('A'.repeat(CHARACTER_COUNT)+'é'),/Unsupported/);
  assert.throws(()=>uploadedContent('\0'),/Unsupported/);
});
void test('uploaded test books and empty book resolve to exact content after target teleport',async()=>{
  const portable=await createPortableBookMath();
  for(const input of ['',readFileSync(new URL('../test_book/all_A.txt',import.meta.url),'utf8'),readFileSync(new URL('../test_book/all_work_and_no_play.txt',import.meta.url),'utf8')]){
    const text=uploadedContent(input);
    portable.withContext(math=>{
      const index=math.fromDigits(exactOrdinalDigits(text)),address=math.addressFromOrdinal(index);
      const source=math.frameForAddress(address);
      assert.ok(JSON.stringify(source).length<200);assert.equal(source.originExact,undefined);
      assert.equal(math.frameForAddress(address).originRef,source.originRef);
      const legacy={destination:'arrival' as const,sectionOffset:'0',floorOffset:'0',originExact:text.trimEnd()};
      assert.deepEqual(math.referenceFrame(legacy),source);
      const landing=math.targetLanding(address,source);
      const book={frame:landing.frame,level:0,bay:Math.floor(landing.position.x/BAY),side:address.side,row:address.row,book:address.book};
      const resolved=math.bookOrdinal(book);assert.ok(resolved.isEqual(index));
      const actual=permuteDigits(math.digits(resolved));
      for(let i=0;i<actual.length;i++)assert.equal(actual[i]+32,text.charCodeAt(i));
      const navigation=math.navigation(address,landing.frame);assert.ok(navigation.localTarget);
    });
  }
});

void test('source lines wrap, preserve blank lines and cross page boundaries',()=>{
 assert.equal(uploadedContent('A'.repeat(80)+'\nB')[80],'B');
 assert.equal(uploadedContent('A'.repeat(81)+'\nB')[160],'B');
 assert.equal(uploadedContent('A\n\nB').slice(0,161),'A'.padEnd(160)+'B');
 assert.equal(uploadedContent('\t\nB').slice(0,81),' '.repeat(80)+'B');
 assert.equal(uploadedContent(('A\n').repeat(40)+'B')[3200],'B');
 const source=readFileSync(new URL('../test_book/all_work_and_no_play.txt',import.meta.url),'utf8');
 assert.equal(uploadedContent(source),'All work and no play makes Jack a dull boy.'.padEnd(80).repeat(410*40));
});

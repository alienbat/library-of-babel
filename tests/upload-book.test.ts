import test from 'node:test';
import assert from 'node:assert/strict';
import {uploadedContent,exactOrdinalDigits} from '../lib/game/search.ts';
import {CHARACTER_COUNT,permuteDigits} from '../lib/game/global-books.ts';
import {createPortableBookMath} from '../lib/game/portable-books.ts';
import {BAY} from '../lib/game/physics.ts';
void test('upload conversion validates before cutoff and pads empty input',()=>{
  assert.equal(uploadedContent(''), ' '.repeat(CHARACTER_COUNT));
  assert.equal(uploadedContent('A\tB\r\nC\rD\nE').slice(0,10),'AB C D E  ');
  assert.equal(uploadedContent('A'.repeat(CHARACTER_COUNT+10)),'A'.repeat(CHARACTER_COUNT));
  assert.throws(()=>uploadedContent('A'.repeat(CHARACTER_COUNT)+'é'),/Unsupported/);
  assert.throws(()=>uploadedContent('\0'),/Unsupported/);
});
void test('uploaded test books and empty book resolve to exact content after target teleport',async()=>{
  const portable=await createPortableBookMath();
  for(const input of ['','A'.repeat(CHARACTER_COUNT),'All work and no play makes Jack a dull boy. '.repeat(Math.ceil(CHARACTER_COUNT/42)).slice(0,CHARACTER_COUNT)]){
    const text=uploadedContent(input);
    portable.withContext(math=>{
      const index=math.fromDigits(exactOrdinalDigits(text)),address=math.addressFromOrdinal(index);
      const source={destination:'arrival' as const,sectionOffset:'0',floorOffset:'0',originExact:text.trimEnd()};
      const landing=math.targetLanding(address,source);
      const book={frame:landing.frame,level:0,bay:Math.floor(landing.position.x/BAY),side:address.side,row:address.row,book:address.book};
      const resolved=math.bookOrdinal(book);assert.ok(resolved.isEqual(index));
      const actual=permuteDigits(math.digits(resolved));
      for(let i=0;i<actual.length;i++)assert.equal(actual[i]+32,text.charCodeAt(i));
      const navigation=math.navigation(address,landing.frame);assert.ok(navigation.localTarget);
    });
  }
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {rawBookBytes,bookDownloadName} from '../lib/game/book-download.ts';

void test('export preserves every ASCII character and trailing space without display separators',()=>{
  const digits=Uint8Array.from({length:1_312_000},(_,i)=>i%95);
  digits[digits.length-1]=0;
  const bytes=rawBookBytes(digits);
  assert.equal(bytes.length,1_312_000);
  for(let i=0;i<bytes.length;i++)assert.equal(bytes[i],digits[i]+32);
  assert.equal(bytes.at(-1),32);
  assert.equal(bytes.includes(10),false);
  assert.equal(bytes.includes(13),false);
});
void test('unnamed export uses SHA-1 of the exact file bytes',async()=>{
  const bytes=rawBookBytes(new Uint8Array(1_312_000));
  assert.equal(await bookDownloadName(bytes),createHash('sha1').update(bytes).digest('hex')+'.txt');
});
void test('named export preserves the title and neutralizes path separators',async()=>{
  const bytes=new Uint8Array();
  assert.equal(await bookDownloadName(bytes,'My library book'),'My library book.txt');
  assert.equal(await bookDownloadName(bytes,'A/B:C\\D'),'A_B_C_D.txt');
});

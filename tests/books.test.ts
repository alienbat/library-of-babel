import assert from 'node:assert/strict';
import test from 'node:test';
import {bookId,bookCenter,pickBook,turnPage,loadOpened,OPENED_STORAGE_KEY,type BookLocation} from '../lib/game/books.ts';
import {uniqueBook,textPage,globalBook,newFrame} from '../lib/game/global-books.ts';
import {BAY,HEIGHT,OUTER} from '../lib/game/physics.ts';
const book:BookLocation={level:0,side:1,bay:1,row:3,book:120};
void test('every book page has 40 lines of 80 printable characters',()=>{
  const content=uniqueBook(globalBook(book,newFrame('bottom-left')));
  for(let page=0;page<410;page++){
    const text=textPage(content,page),lines=text.split('\n');
    assert.equal(lines.length,40);for(const line of lines){assert.equal(line.length,80);assert.match(line,/^[\x20-\x7e]{80}$/);}
  }
});
void test('page bounds and navigation are clamped',()=>{
  const content=uniqueBook(globalBook(book,newFrame('bottom-left')));
  assert.throws(()=>textPage(content,-1),RangeError);assert.throws(()=>textPage(content,410),RangeError);
  assert.equal(turnPage(0,-1),0);assert.equal(turnPage(409,1),409);assert.equal(turnPage(12,1),13);assert.equal(turnPage(12,-1),11);
});
void test('picking resolves actual spines on both sides and negative floors and bays',()=>{
  for(const side of [-1,1] as const)for(const bay of [-13,1,13])for(const level of [-2,0,2]){
    const expected={...book,side,bay,level},center=bookCenter(expected);
    const origin={...center,z:side*(OUTER-1)},direction={x:0,y:0,z:side};
    assert.deepEqual(pickBook(origin,direction,level),expected);
    assert.deepEqual(pickBook({...origin,z:side*(OUTER-.22)},direction,level),expected);
    assert.equal(pickBook({...origin,z:side*(OUTER-4)},direction,level),null);
    assert.equal(pickBook({...origin,z:side*(OUTER+1)},direction,level),null);
    assert.equal(pickBook(origin,{x:0,y:0,z:-side},level),null);
    assert.equal(pickBook({...origin,y:level*HEIGHT+.105},direction,level),null);
    assert.equal(pickBook({...origin,x:bay*BAY+BAY/570*121},direction,level),null);
    assert.equal(pickBook({...origin,x:bay*BAY+BAY/8},direction,level),null);
  }
  assert.equal(pickBook({x:10,y:1.68,z:OUTER-1},{x:0,y:0,z:1},0),null);
});
void test('opened history survives reload, filters corrupt data and tolerates blocked storage',()=>{
  const id=bookId(book),serialized=JSON.stringify([id,id,null,7,'bad']);
  const loaded=loadOpened({getItem:key=>{assert.equal(key,OPENED_STORAGE_KEY);return serialized;}});
  assert.deepEqual([...loaded],[id]);
  assert.equal(loadOpened({getItem:()=>'{broken'}).size,0);
  assert.equal(loadOpened({getItem:()=>{throw new Error('blocked');}}).size,0);
});

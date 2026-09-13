import assert from 'node:assert/strict';
import test from 'node:test';
import {openedChanges,localBookId} from '../lib/game/books.ts';
void test('history replies update only changed books, including negative shelf coordinates',()=>{
  const a={level:-9,side:-1 as const,bay:-3,row:7,book:569};
  const b={level:2,side:1 as const,bay:4,row:0,book:0};
  const previous=new Set([localBookId(a)]);
  assert.deepEqual(openedChanges(previous,new Set(previous)),[]);
  assert.deepEqual(openedChanges(previous,new Set([localBookId(b)])),[{location:a,opened:false},{location:b,opened:true}]);
  assert.deepEqual(openedChanges(new Set(),new Set(['bad','v1/L0/N/S0/B9999'])),[]);
});

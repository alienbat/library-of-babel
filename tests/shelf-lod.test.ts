import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {detailCells,shelfDistanceSquared,BOOK_DETAIL_RADIUS,SHELF_RELIEF_RADIUS} from '../lib/game/shelf-lod.ts';
import {OUTER,HEIGHT} from '../lib/game/physics.ts';
void test('shelf detail uses spatial distance on either side of a floor boundary',()=>{
  for(const y of [HEIGHT-.1,HEIGHT+.1,-.1,.1]){
    const eye=new T.Vector3(35,y,OUTER-1),cells=detailCells(eye,{});
    assert.ok(cells.some(c=>c.level===0));assert.ok(cells.some(c=>c.level===1));
    assert.ok(cells.some(c=>c.level<0));
    for(const cell of cells)assert.ok(shelfDistanceSquared(eye,cell)<=BOOK_DETAIL_RADIUS**2);
    assert.ok(cells.every(c=>c.side===1),'opposite wall is outside near-book radius');
  }
  const cells=detailCells(new T.Vector3(35,0,OUTER-1),{minX:0,minY:0});
  assert.ok(cells.every(c=>c.level>=0&&c.bay>=0));
  assert.equal(SHELF_RELIEF_RADIUS,500);
});

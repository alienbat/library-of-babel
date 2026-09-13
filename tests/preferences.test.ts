import test from 'node:test';
import assert from 'node:assert/strict';
import {readDetail,clearAppStorage,DETAIL_STORAGE} from '../lib/game/preferences.ts';
import {fallSpeedLabel} from '../lib/game/fall-display.ts';
import {TERMINAL_SPEED} from '../lib/game/physics.ts';
void test('detail defaults to Low, restores High and rejects unknown settings',()=>{
  for(const [value,expected] of [[null,'low'],['high','high'],['low','low'],['invalid','low']])assert.equal(readDetail({getItem:key=>{assert.equal(key,DETAIL_STORAGE);return value;}}),expected);
});
void test('Start Over removes all app keys without touching other apps on the origin',()=>{
  const items=new Map([['babel-detail-v1','high'],['babel-journey-v1','saved'],['babel-legacy','saved'],['another-app','keep']]);
  clearAppStorage({get length(){return items.size;},key:i=>[...items.keys()][i]??null,removeItem:key=>{items.delete(key);}});
  assert.deepEqual([...items],[['another-app','keep']]);
});
void test('fall speed uses km/h and indicates effectively reached terminal velocity',()=>{
  assert.equal(fallSpeedLabel(10),'FALLING · 36.0 km/h');
  assert.ok(!fallSpeedLabel(TERMINAL_SPEED*.998).includes('TERMINAL'));
  assert.equal(fallSpeedLabel(TERMINAL_SPEED),'FALLING · 193.1 km/h · TERMINAL VELOCITY');
});

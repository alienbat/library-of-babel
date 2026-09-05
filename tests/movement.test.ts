import assert from 'node:assert/strict';
import test from 'node:test';
import {HEIGHT,INNER,OUTER,PERIOD,move,allowed,type Position} from '../lib/game/physics.ts';
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<.025,`${a} differs from ${b}`);
void test('rail and books block a fast movement without tunnelling',()=>{
  let p={x:35,y:0,z:INNER+1.5};
  p=move(p,0,-100);assert.ok(p.z>=INNER+.22);
  p=move(p,0,100);assert.ok(p.z<=OUTER-.22+.001);
});
void test('walking along shelves works in both directions beyond repeated blocks',()=>{
  for(const side of [-1,1]) {let p={x:35,y:0,z:side*(INNER+2)};p=move(p,PERIOD*3,0);near(p.x,35+PERIOD*3);p=move(p,-PERIOD*6,0);near(p.x,35-PERIOD*3);}
});
void test('walk from gallery up stairs and back out on next level, then descend',()=>{
  for(const offset of [-PERIOD,0,PERIOD])for(const side of [-1,1]){
    let p:Position={x:offset+2.5,y:0,z:side*(INNER+2)};
    p=move(p,0,side*(OUTER+2-Math.abs(p.z)));
    p=move(p,11,0);near(p.y,HEIGHT);near(p.x,offset+13.5);
    p=move(p,0,side*(INNER+2-Math.abs(p.z)));near(p.y,HEIGHT);near(Math.abs(p.z),INNER+2);
    p=move(p,0,side*(OUTER+2-Math.abs(p.z)));p=move(p,-11,0);near(p.y,0);
    p=move(p,0,side*(INNER+2-Math.abs(p.z)));near(Math.abs(p.z),INNER+2);
  }
});
void test('stair side wall prevents a mid-flight exit into a floor slab',()=>{
  let p={x:8,y:HEIGHT/2,z:OUTER+2};p=move(p,0,-4);assert.ok(p.z>OUTER+.5);near(p.y,HEIGHT/2);
});
void test('dormitory doorway is accessible and bed furniture blocks walking',()=>{
  for(const side of [-1,1]){
    let p={x:19,y:0,z:side*(INNER+2)};p=move(p,0,side*(OUTER+2.4-Math.abs(p.z)));near(Math.abs(p.z),OUTER+2.4);
    assert.equal(allowed(16.8,side*(OUTER+3.7)),false);
  }
});
void test('food kiosk is solid and can be passed on the shelf side',()=>{
  assert.equal(allowed(17.8,INNER+.7),false);assert.equal(allowed(17.8,INNER+2),true);
});

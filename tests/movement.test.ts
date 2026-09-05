import assert from 'node:assert/strict';
import test from 'node:test';
import {HEIGHT,INNER,OUTER,PERIOD,move,allowed,fallStep,type Position} from '../lib/game/physics.ts';
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

void test('bathrooms connect to dormitories on both sides and repeated floors',()=>{
  for(const offset of [-PERIOD,0,PERIOD])for(const side of [-1,1])for(const level of [-HEIGHT,0,HEIGHT]){
    let p={x:offset+19,y:level,z:side*(INNER+2)};
    p=move(p,0,side*(OUTER+2.4-Math.abs(p.z)));
    p=move(p,6,0);near(p.x,offset+25);near(p.y,level);
    // Enter both shower trays via the open central aisle.
    for(const depth of [1.25,3.75]){
      let shower=move(p,0,side*(depth-2.4));shower=move(shower,2,0);
      near(shower.x,offset+27);near(Math.abs(shower.z),OUTER+depth);
    }
    const landing=fallStep({...p,y:level+1},0,1);assert.equal(landing.landed,true);near(landing.position.y,level);
    p=move(p,-6,0);p=move(p,0,side*(INNER+2-Math.abs(p.z)));
    near(p.x,offset+19);near(Math.abs(p.z),INNER+2);
    for(const [x,z] of [[28,2.4],[25,.1],[25,5],[24.6,.65],[23,4.25],[23.75,4],[27,2.5],[22,1]])
      assert.equal(allowed(offset+x,side*(OUTER+z)),false,`solid fixture or wall at ${x},${z}`);
  }
});

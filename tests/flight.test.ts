import assert from 'node:assert/strict';
import test from 'node:test';
import {flightVector,flyMove,fallStep,supportBelow,INNER,OUTER,HEIGHT,TERMINAL_SPEED,type Position} from '../lib/game/physics.ts';
const near=(a:number,b:number,epsilon=1e-7)=>assert.ok(Math.abs(a-b)<epsilon,`${a} differs from ${b}`);
void test('flight follows pitch, supports reversing, and normalizes diagonals',()=>{
  const forward=flightVector(0,Math.PI/4,1,0),back=flightVector(0,Math.PI/4,-1,0);
  assert.ok(forward.y>0&&forward.z<0);near(back.y,-forward.y);near(back.z,-forward.z);
  const strafe=flightVector(.9,1,0,1);near(strafe.y,0);
  const diagonal=flightVector(.9,1,1,1);near(Math.hypot(diagonal.x,diagonal.y,diagonal.z),1);
});
void test('flight clears the rail but does not pass through floors, ceilings, or shelves',()=>{
  const p={x:30,y:1.4,z:INNER+1.7};
  const over=flyMove(p,0,0,-5);assert.ok(over.z<INNER-1);
  const blocked=flyMove({...p,y:0},0,0,-5);assert.ok(blocked.z>INNER);
  const ceiling=flyMove(p,0,8,0);assert.ok(ceiling.y<HEIGHT-2);
  const floor=flyMove(p,0,-10,0);assert.ok(floor.y>=0);
  const shelves=flyMove(p,0,0,8);assert.ok(shelves.z<OUTER);
});
void test('turning gravity on above a gallery lands on that floor, with no upward snap',()=>{
  const p={x:30,y:1.5,z:INNER+1.7};
  const first=fallStep(p,0,.1);assert.ok(first.position.y<p.y&&first.position.y>0);assert.equal(first.landed,false);
  const result=fallStep(p,0,3);near(result.position.y,0);near(result.speed,0);assert.equal(result.landed,true);
});
void test('the chasm accelerates smoothly to the book’s 120 mph limit, never landing',()=>{
  let p:Position={x:30,y:1.5,z:0},speed=0,lastSpeed=0;
  for(let i=0;i<1200;i++){
    const next=fallStep(p,speed,1/60);assert.equal(next.landed,false);assert.ok(next.speed>=lastSpeed&&next.speed<=TERMINAL_SPEED);
    p=next.position;speed=next.speed;lastSpeed=speed;
  }
  assert.ok(speed>TERMINAL_SPEED*.998);assert.ok(p.y< -800);assert.equal(supportBelow(p),null);
  const terminal=fallStep(p,TERMINAL_SPEED,1);near(p.y-terminal.position.y,TERMINAL_SPEED);
});
void test('fall integration is independent of frame subdivision',()=>{
  const start={x:30,y:100,z:0};const one=fallStep(start,0,2);
  let p=start,speed=0;
  for(let i=0;i<120;i++){const next=fallStep(p,speed,1/60);p=next.position;speed=next.speed;}
  near(one.position.y,p.y);near(one.speed,speed);
});
void test('high-speed descent catches a gallery and negative floors correctly',()=>{
  const result=fallStep({x:30,y:-HEIGHT+1.5,z:INNER+1.7},TERMINAL_SPEED,.1);
  near(result.position.y,-HEIGHT);assert.equal(result.landed,true);
  const stairs=fallStep({x:8,y:HEIGHT/2+.4,z:OUTER+2},0,1);
  near(stairs.position.y,HEIGHT/2);assert.equal(stairs.landed,true);
});

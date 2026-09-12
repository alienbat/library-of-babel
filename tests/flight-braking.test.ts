import test from 'node:test';
import assert from 'node:assert/strict';
import {brakeFallStep,GRAVITY,TERMINAL_SPEED,flyMove,INNER} from '../lib/game/physics.ts';
void test('flight arrests terminal fall at exactly 5G without reversing velocity',()=>{
  const p={x:30,y:100,z:0},a=5*GRAVITY;
  const first=brakeFallStep(p,TERMINAL_SPEED,.1);
  assert.ok(Math.abs(first.speed-(TERMINAL_SPEED-a*.1))<1e-10);
  const stopped=brakeFallStep(p,TERMINAL_SPEED,5);
  assert.equal(stopped.speed,0);
  assert.ok(Math.abs(stopped.position.y-(100-TERMINAL_SPEED**2/(2*a)))<1e-10);
  let stepped={position:p,speed:TERMINAL_SPEED,landed:false};
  for(let i=0;i<100;i++)stepped=brakeFallStep(stepped.position,stepped.speed,.05);
  assert.ok(Math.abs(stepped.position.y-stopped.position.y)<1e-9);
});
void test('braking cannot pass through a floor and flight lift respects the ceiling',()=>{
  const ground=brakeFallStep({x:30,y:2,z:INNER+2},50,.1);
  assert.equal(ground.position.y,0);assert.equal(ground.speed,0);assert.equal(ground.landed,true);
  const bottom=brakeFallStep({x:30,y:2,z:0},50,.1,{minY:0});assert.equal(bottom.position.y,0);
  const p={x:30,y:0,z:INNER+2};assert.ok(Math.abs(flyMove(p,0,.3,0).y-.3)<1e-9);
  assert.ok(flyMove(p,0,.3,0,{maxY:1.9}).y<=.1);
});

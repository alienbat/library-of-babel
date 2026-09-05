import assert from 'node:assert/strict';
import test from 'node:test';
import {DESTINATIONS,destinationState} from '../lib/game/destinations.ts';
import {HEIGHT,INNER,RADIUS,BODY_HEIGHT,move,flyMove,fallStep,withinLimits} from '../lib/game/physics.ts';
void test('all destinations begin at relative level zero and original arrival removes corner limits',()=>{
  for(const destination of DESTINATIONS){
    const state=destinationState(destination);
    assert.equal(state.position.y,0);assert.ok(withinLimits(state.position,state.limits));
    if(destination==='arrival'){assert.deepEqual(state.limits,{});assert.equal(state.yaw,-.88);assert.equal(state.pitch,-.04);continue;}
    assert.equal(Object.keys(state.limits).length,2);
    assert.equal(state.limits.minY===0,destination.startsWith('bottom'));
    assert.equal(state.limits.maxY===HEIGHT-.34,destination.startsWith('top'));
    assert.equal(state.limits.minX===0,destination.endsWith('left'));
  }
});
void test('corner end walls block both walking and fast flight',()=>{
  for(const destination of DESTINATIONS.filter(d=>d!=='arrival')){
    const {position,limits}=destinationState(destination),dx=destination.endsWith('left')?-100:100;
    for(const p of [move(position,dx,0,limits),flyMove({...position,z:0,y:1},dx,0,0,limits)]){
      assert.ok(p.x>=(limits.minX??-Infinity)+RADIUS-1e-6);
      assert.ok(p.x<=(limits.maxX??Infinity)-RADIUS+1e-6);
    }
  }
});
void test('bottom chasm floor catches falls and supports walking; top ceiling blocks flight',()=>{
  const bottom=destinationState('bottom-left').limits;
  const fallen=fallStep({x:30,y:2,z:0},50,1,bottom);
  assert.equal(fallen.landed,true);assert.equal(fallen.position.y,0);
  const walked=move(fallen.position,3,2,bottom);assert.ok(Math.abs(walked.x-33)<1e-6);assert.ok(Math.abs(walked.z-2)<1e-6);
  assert.ok(flyMove({x:30,y:1,z:0},0,-100,0,bottom).y>=0);
  const top=destinationState('top-right').limits;
  assert.ok(flyMove({x:30,y:1,z:0},0,100,0,top).y+BODY_HEIGHT<=HEIGHT-.34+1e-6);
  assert.equal(fallStep({x:30,y:0,z:0},50,1,top).landed,false);
  assert.equal(fallStep({x:30,y:0,z:0},50,1,{}).landed,false);
  assert.ok(move({x:30,y:0,z:INNER+2},-60,0,{}).x<0,'arrival restores travel beyond the former end wall');
});

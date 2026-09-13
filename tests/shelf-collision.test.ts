import test from 'node:test';
import assert from 'node:assert/strict';
import {allowed,flyMove,OUTER,RADIUS,BAY,PERIOD} from '../lib/game/physics.ts';
void test('shelf collision includes board fronts on both galleries and run ends',()=>{
  for(const side of [-1,1])for(const offset of [-PERIOD,0,PERIOD]){
    const front=OUTER-.29-RADIUS;
    assert.ok(allowed(offset+30,side*(front-.001)));
    assert.ok(!allowed(offset+30,side*(front+.001)));
    assert.ok(!allowed(offset+BAY-.1,side*(OUTER-.3)),'end panel blocks sideways entry');
    const result=flyMove({x:offset+30,y:.2,z:side*(OUTER-1)},0,0,side*2);
    assert.ok(Math.abs(result.z)<=front);
    assert.ok(allowed(offset+19,side*(OUTER-.25)),'bedroom entrance remains open');
  }
});

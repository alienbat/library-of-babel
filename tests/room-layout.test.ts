import test from 'node:test';
import assert from 'node:assert/strict';
import {DORM,DORM_BEDS} from '../lib/game/room-layout.ts';
import {move,OUTER,PERIOD,INNER,HEIGHT} from '../lib/game/physics.ts';
void test('both sides of all seven beds are reachable from the gallery',()=>{
 assert.equal(DORM_BEDS.length,7);
 for(const offset of [-PERIOD,0,PERIOD])for(const side of [-1,1])for(const bed of DORM_BEDS)for(const edge of [-1,1]){
  let p={x:offset+19,y:HEIGHT,z:side*(INNER+2)};
  p=move(p,0,side*(OUTER+3.4-Math.abs(p.z)));
  const target=offset+bed.x+edge*.8;
  p=move(p,target-p.x,0);
  p=move(p,0,side*(OUTER+bed.depth-Math.abs(p.z)));
  assert.ok(Math.abs(p.x-target)<.025&&Math.abs(Math.abs(p.z)-OUTER-bed.depth)<.025,`unreachable bed side ${bed.x},${bed.depth},${edge}`);
  assert.equal(p.y,HEIGHT);
 }
 for(const bed of DORM_BEDS){
  assert.ok(bed.x-.5>DORM.left+.1&&bed.x+.5<DORM.right-.1);
  assert.ok(bed.depth-.9>.37&&bed.depth+.9<DORM.depth-.1);
 }
});

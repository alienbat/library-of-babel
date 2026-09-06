import assert from 'node:assert/strict';
import test from 'node:test';
import {staircase} from '../lib/game/stairs.ts';
import {HEIGHT,OUTER,PERIOD,move,flyMove} from '../lib/game/physics.ts';

void test('stairwell shells meet adjacent decks and steps seal against both side walls',()=>{
  for(const side of [-1,1])for(const y of [-HEIGHT,0,HEIGHT]){
    const model=staircase(0,y,side);
    assert.equal(model.steps.length,24);
    for(const wall of model.walls.slice(0,4)){
      assert.ok(Math.abs(wall[1]-wall[4]/2-(y-.34))<1e-8);
      assert.ok(Math.abs(wall[1]+wall[4]/2-(y+HEIGHT-.34))<1e-8);
    }
    for(const step of model.steps){
      assert.ok(Math.abs(step[2])-step[5]/2<=OUTER+.56);
      assert.ok(Math.abs(step[2])+step[5]/2>=OUTER+3.7);
    }
  }
});
void test('terminal models cap the shaft and omit stairs beyond the library',()=>{
  const top=staircase(0,0,1,{maxY:HEIGHT-.34});
  assert.equal(top.steps.length,0);assert.match(top.label,/DOWN ONLY/);
  assert.ok(top.floors.some(b=>b[3]===14&&Math.abs(b[1]-b[4]/2-(HEIGHT-.34))<1e-8));
  const bottom=staircase(0,0,1,{minY:0});
  assert.equal(bottom.steps.length,24);assert.match(bottom.label,/UP ONLY/);
  assert.ok(bottom.floors.some(b=>b[3]===8&&Math.abs(b[1]+b[4]/2)<1e-8));
  assert.equal(staircase(0,-HEIGHT,1,{maxY:HEIGHT-.34}).steps.length,24);
});
void test('end landings block nonexistent flights while retaining the valid return route',()=>{
  for(const side of [-1,1])for(const x of [0,PERIOD]){
    const z=side*(OUTER+2),bottom={minY:0},top={maxY:HEIGHT-.34};
    assert.ok(move({x:x+13.5,y:0,z},-3,0,bottom).x>x+12.2);
    assert.ok(move({x:x+2.5,y:0,z},3,0,top).x<x+3.8);
    assert.ok(flyMove({x:x+13.5,y:.2,z},-3,0,0,bottom).x>x+12.2);
    assert.ok(flyMove({x:x+2.5,y:.2,z},3,0,0,top).x<x+3.8);
    const up=move({x:x+2.5,y:0,z},11,0,bottom);
    assert.ok(Math.abs(up.y-HEIGHT)<.001);
    assert.ok(Math.abs(move(up,-11,0,bottom).y)<.001);
    const down=move({x:x+13.5,y:0,z},-11,0,top);
    assert.ok(Math.abs(down.y+HEIGHT)<.001);
    assert.ok(Math.abs(move(down,11,0,top).y)<.001);
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {staircase} from '../lib/game/stairs.ts';
import {HEIGHT,OUTER,PERIOD,move,flyMove,supportBelow} from '../lib/game/physics.ts';

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
    for(const [limits,door] of [[bottom,13.5],[top,2.5]] as const){
      const start={x:x+door,y:0,z:side*(OUTER-1)};
      assert.ok(Math.abs(move(start,0,side*3,limits).z)<OUTER);
      assert.ok(Math.abs(flyMove({...start,y:.2},0,0,side*3,limits).z)<OUTER);
    }
    const up=move({x:x+2.5,y:0,z},11,0,bottom);
    assert.ok(Math.abs(up.y-HEIGHT)<.001);
    assert.ok(Math.abs(move(up,-11,0,bottom).y)<.001);
    const down=move({x:x+13.5,y:0,z},-11,0,top);
    assert.ok(Math.abs(down.y+HEIGHT)<.001);
    assert.ok(Math.abs(move(down,11,0,top).y)<.001);
  }
});

void test('stair frontage and lintels are flush with the gallery wall and meet its ceiling',()=>{
  for(const side of [-1,1]){
    const model=staircase(0,0,side);
    for(const box of [model.walls[0],...model.walls.slice(4,6)]){
      assert.ok(Math.abs(Math.abs(box[2])-box[5]/2-OUTER)<1e-8);
      assert.ok(Math.abs(box[1]+box[4]/2-(HEIGHT-.34))<1e-8);
    }
  }
});

void test('terminal stairwell alcoves are removed, with ceiling-mounted top light',async()=>{
  const {roomLights}=await import('../lib/game/room-lighting.ts');
  for(const [limits,door] of [[{maxY:HEIGHT-.34},2.5],[{minY:0},13.5]] as const){
    const model=staircase(0,0,1,limits);
    assert.ok(model.walls.some(b=>b[0]===door&&b[3]===3&&b[4]===HEIGHT));
    assert.ok(!model.floors.some(b=>b[0]===door&&b[1]<0));
    assert.ok(!model.walls.some(b=>b[3]===.16),'no redundant interior partition');
  }
  const topLights=roomLights(true).filter(l=>l.room===0);
  assert.equal(topLights.length,1);assert.equal(topLights[0].x,8);
  assert.ok(Math.abs(topLights[0].y+.035/2-(HEIGHT-.34))<1e-8);
  assert.ok(!roomLights(false,true).some(l=>l.x===13.5));
  assert.ok(Math.abs(supportBelow({x:2.5,y:.2,z:OUTER+2},{maxY:HEIGHT-.34})!+HEIGHT)<1e-8);
});

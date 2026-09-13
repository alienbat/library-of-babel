import {DORM,DORM_BEDS,BATH_SHIFT} from './room-layout.ts';
// Project dimensions in metres; see README.md for literary inspiration and choices.
export const GAP = 30.48;
export const INNER = GAP / 2;
export const OUTER = INNER + 3.6576;
export const HEIGHT = 3.96;
export const BAY = 22.86;
export const PERIOD = BAY * 12;
export const EYE = 1.68;
export const RADIUS = 0.22;
export type Position = { x: number; y: number; z: number };
export const mod = (n: number, d: number) => ((n % d) + d) % d;
export function floorAt(x: number, z: number, previousY: number): number {
  const t = mod(x, PERIOD);
  if (Math.abs(z) > OUTER + 0.48 && t >= 4 && t <= 12) {
    const ramp = (t - 4) / 8 * HEIGHT;
    return Math.round((previousY - ramp) / HEIGHT) * HEIGHT + ramp;
  }
  return Math.round(previousY / HEIGHT) * HEIGHT;
}
export function allowed(x: number, z: number): boolean {
  const a = Math.abs(z), t = mod(x, PERIOD);
  if (a < INNER + RADIUS || a > OUTER + DORM.depth - .1 - RADIUS) return false;
  // Stairs sit behind the shelves. Their side wall prevents stepping off mid-flight.
  if (a <= OUTER - RADIUS) {
    // Food kiosk, set back from the rail.
    return !(t > 17.4 - RADIUS && t < 18.3 + RADIUS && a < INNER + 1.3 + RADIUS);
  }
  if (t > 1 + RADIUS && t < 15 - RADIUS) {
    if (a > OUTER + 3.7 - RADIUS) return false;
    if (t > 4 && t < 12 && a < OUTER + 0.5 + RADIUS) return false;
    return true;
  }
  // Bathroom doorway and fixtures use the same translated layout as the meshes.
  const bathroomX=t-BATH_SHIFT;
  if (t >= DORM.right - .1 - RADIUS && t <= DORM.right + .1 + RADIUS) {
    return a > OUTER + DORM.bathDoorStart + RADIUS && a < OUTER + DORM.bathDoorEnd - RADIUS;
  }
  if (bathroomX > 22 + RADIUS + .1 && bathroomX < 28 - .1 - RADIUS) {
    const d=a-OUTER;
    if(d < .5+RADIUS || d > 4.9-RADIUS)return false;
    if(bathroomX>24.05-RADIUS&&bathroomX<25.15+RADIUS&&d<.975+RADIUS)return false;
    if(bathroomX<23.3+RADIUS&&d>3.86-RADIUS)return false;
    if(Math.abs(bathroomX-23.75)<.05+RADIUS&&d>3.25-RADIUS)return false;
    if(bathroomX>26-RADIUS&&Math.abs(d-2.5)<.05+RADIUS)return false;
    return true;
  }
  if (t > DORM.left + .1 + RADIUS && t < DORM.right - .1 - RADIUS) {
    const d=a-OUTER;
    if (d < .37+RADIUS && !(t>DORM.doorLeft+RADIUS&&t<DORM.doorRight-RADIUS))return false;
    for(const bed of DORM_BEDS)
      if(Math.abs(t-bed.x)<.5+RADIUS&&Math.abs(d-bed.depth)<.9+RADIUS)return false;
    return true;
  }
  return false;
}
export type WorldLimits={minX?:number;maxX?:number;minY?:number;maxY?:number};
export function withinLimits(p:Position,limits:WorldLimits={}){
  return p.x>=(limits.minX??-Infinity)+RADIUS&&p.x<=(limits.maxX??Infinity)-RADIUS&&p.y>=(limits.minY??-Infinity)&&p.y+EYE+.12<=(limits.maxY??Infinity);
}
function terminalStairWall(p:Position,limits:WorldLimits){
  const a=Math.abs(p.z),t=mod(p.x,PERIOD);
  if(a<OUTER+.3-RADIUS||a>OUTER+3.8+RADIUS)return false;
  const top=limits.maxY===undefined?undefined:limits.maxY-HEIGHT+.34;
  return [[top,4],[limits.minY,12]].some(([floor,x])=>floor!==undefined&&x!==undefined&&Math.abs(t-x)<.08+RADIUS&&p.y+EYE+.12>floor-.34&&p.y<floor+HEIGHT-.34);
}
function walkable(x:number,z:number,y:number,limits:WorldLimits){
  return !terminalStairWall({x,y,z},limits)&&(allowed(x,z)||(limits.minY!==undefined&&Math.abs(y-limits.minY)<.001&&Math.abs(z)<INNER-RADIUS-.04));
}
export function move(p: Position, dx: number, dz: number,limits:WorldLimits={}): Position {
  let { x, y, z } = p;
  // Substeps prevent tunnelling through shelves at low frame rates.
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.08));
  for (let i = 0; i < steps; i++) {
    const nx = x + dx / steps;
    if (walkable(nx,z,y,limits)) {
      const ny = floorAt(nx, z, y);
      if (Math.abs(ny - y) < 0.18&&withinLimits({x:nx,y:ny,z},limits)) { x = nx; y = ny; }
    }
    const nz = z + dz / steps;
    if (walkable(x,nz,y,limits)) {
      const ny = floorAt(x, nz, y);
      if (Math.abs(ny - y) < 0.18&&withinLimits({x,y:ny,z:nz},limits)) { z = nz; y = ny; }
    }
  }
  return { x, y, z };
}

export type TravelMode = 'walking' | 'flying' | 'falling';
export const BODY_HEIGHT = EYE + 0.12;
export const GRAVITY = 9.81;
// Adopted falling-speed limit: 120 mph. See README.md for model assumptions.
export const TERMINAL_SPEED = 120 * 0.44704;

/** A camera-relative flight vector, with normalized diagonal movement. */
export function flightVector(yaw:number,pitch:number,forward:number,right:number):Position {
  const length=Math.hypot(forward,right);
  if(!length)return {x:0,y:0,z:0};
  forward/=length;right/=length;
  return {
    x:-Math.sin(yaw)*Math.cos(pitch)*forward+Math.cos(yaw)*right,
    y:Math.sin(pitch)*forward,
    z:-Math.cos(yaw)*Math.cos(pitch)*forward-Math.sin(yaw)*right,
  };
}

/** Highest actual walking surface below the feet; the chasm has no support. */
export function supportBelow(p:Position):number|null {
  if(!allowed(p.x,p.z))return null;
  const t=mod(p.x,PERIOD);
  const ramp=Math.abs(p.z)>OUTER+.48&&t>=4&&t<=12?(t-4)/8*HEIGHT:0;
  return Math.floor((p.y-ramp+1e-8)/HEIGHT)*HEIGHT+ramp;
}

export function airClear(p:Position):boolean {
  const a=Math.abs(p.z);
  if(a<INNER-RADIUS-.04)return true;
  const inRail=a<INNER+RADIUS+.04;
  if(!inRail&&!allowed(p.x,p.z))return false;
  const t=mod(p.x,PERIOD);
  const ramp=a>OUTER+.48&&t>=4&&t<=12?(t-4)/8*HEIGHT:0;
  const level=Math.floor((p.y-ramp+1e-8)/HEIGHT)*HEIGHT+ramp;
  const height=p.y-level;
  const inDoor=(t>1&&t<4)||(t>12&&t<15);
  if(inDoor&&a>OUTER+.4-RADIUS&&a<OUTER+.56+RADIUS&&height+BODY_HEIGHT>2.6)return false;
  // A full body must fit between the deck and the ceiling. Crossing above the
  // 4-foot rail is possible, but passing through a deck or shelving is not.
  if(height< -1e-7||height+BODY_HEIGHT>HEIGHT-.34)return false;
  if(inRail&&height<1.2192+.04)return false;
  return true;
}

export function flyMove(p:Position,dx:number,dy:number,dz:number,limits:WorldLimits={}):Position {
  const next={...p};
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy,dz)/.06));
  for(let i=0;i<steps;i++) {
    for(const axis of ['y','x','z'] as const) {
      const amount=(axis==='x'?dx:axis==='y'?dy:dz)/steps;
      const candidate={...next,[axis]:next[axis]+amount};
      if(withinLimits(candidate,limits)&&!terminalStairWall(candidate,limits)&&airClear(candidate))next[axis]=candidate[axis];
    }
  }
  return next;
}

/** Exact quadratic-drag integration: acceleration eases smoothly to terminal speed. */
export function fallStep(p:Position,speed:number,dt:number,limits:WorldLimits={}) {
  if(dt<=0)return {position:{...p},speed,landed:false};
  const v=Math.max(0,Math.min(speed,TERMINAL_SPEED));
  let nextSpeed:number,drop:number;
  if(v>=TERMINAL_SPEED*(1-1e-10)) {
    nextSpeed=TERMINAL_SPEED;drop=TERMINAL_SPEED*dt;
  } else {
    const a=Math.atanh(v/TERMINAL_SPEED),b=a+GRAVITY*dt/TERMINAL_SPEED;
    nextSpeed=TERMINAL_SPEED*Math.tanh(b);
    const logCosh=(x:number)=>x+Math.log1p(Math.exp(-2*x))-Math.LN2;
    drop=TERMINAL_SPEED**2/GRAVITY*(logCosh(b)-logCosh(a));
  }
  const support=supportBelow(p);
  const surface=limits.minY===undefined?support:Math.max(support??-Infinity,limits.minY);
  if(surface!==null&&p.y-drop<=surface)return {position:{...p,y:surface},speed:0,landed:true};
  return {position:{...p,y:p.y-drop},speed:nextSpeed,landed:false};
}

/** Net upward braking acceleration; integrate only until downward speed reaches zero. */
export function brakeFallStep(p:Position,speed:number,dt:number,limits:WorldLimits={}) {
  const v=Math.max(0,speed),a=5*GRAVITY,t=Math.min(Math.max(0,dt),v/a);
  const drop=v*t-.5*a*t*t;
  const support=supportBelow(p);
  const surface=limits.minY===undefined?support:Math.max(support??-Infinity,limits.minY);
  if(surface!==null&&p.y-drop<=surface)return {position:{...p,y:surface},speed:0,landed:true};
  return {position:{...p,y:p.y-drop},speed:Math.max(0,v-a*t),landed:false};
}

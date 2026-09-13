import {TERMINAL_SPEED} from './physics.ts';
/** Drag approaches terminal speed asymptotically; consider 99.9% settled. */
export function fallSpeedLabel(speed:number){
  const terminal=speed>=TERMINAL_SPEED*.999;
  return `FALLING · ${(Math.max(0,speed)*3.6).toFixed(1)} km/h${terminal?' · TERMINAL VELOCITY':''}`;
}

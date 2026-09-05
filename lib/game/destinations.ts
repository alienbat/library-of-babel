import {BAY,HEIGHT,INNER,type Position,type WorldLimits} from './physics.ts';
export const DESTINATIONS=['bottom-left','bottom-right','top-left','top-right','arrival'] as const;
export type Destination=typeof DESTINATIONS[number];
export const DESTINATION_LABELS:Record<Destination,string>={'bottom-left':'Bottom-left','bottom-right':'Bottom-right','top-left':'Top-left','top-right':'Top-right',arrival:'Original arrival'};
export function destinationState(destination:Destination):{position:Position;limits:WorldLimits;yaw:number;pitch:number}{
  const limits:WorldLimits={};
  if(destination!=='arrival'){
    if(destination.endsWith('left'))limits.minX=0;else limits.maxX=2*BAY;
    if(destination.startsWith('bottom'))limits.minY=0;else limits.maxY=HEIGHT-.34;
  }
  return {position:{x:30,y:0,z:INNER+1.7},limits,yaw:destination.endsWith('left')?.8:destination.endsWith('right')?-.8:-.88,pitch:destination==='arrival'?-.04:destination.startsWith('top')?.18:-.12};
}

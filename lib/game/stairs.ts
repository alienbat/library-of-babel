import {HEIGHT,OUTER,type WorldLimits} from './physics.ts';
export type StairBox=[number,number,number,number,number,number];
/** Closed stairwell shell. Flights belong to their lower floor. */
export function staircase(x:number,y:number,side:number,limits:WorldLimits={}){
  const bottom=limits.minY!==undefined&&Math.abs(y-limits.minY)<.001;
  const top=limits.maxY!==undefined&&Math.abs(y+HEIGHT-.34-limits.maxY)<.001;
  const walls:StairBox[]=[],floors:StairBox[]=[],steps:StairBox[]=[];
  const wallY=y+(HEIGHT-.34)/2-.17;
  // Meet the next deck's underside, and extend through this deck to close seams.
  walls.push([x+8,wallY,side*(OUTER+.15),8,HEIGHT,.3],
    [x+8,wallY,side*(OUTER+3.8),14.2,HEIGHT,.2],
    [x+1,wallY,side*(OUTER+1.95),.2,HEIGHT,3.9],
    [x+15,wallY,side*(OUTER+1.95),.2,HEIGHT,3.9]);
  // Lintels above the two gallery doors close the remaining front-wall gaps.
  const lintelHeight=HEIGHT-.34-2.6;
  for(const landing of [2.5,13.5]){
    const closed=(top&&landing===2.5)||(bottom&&landing===13.5);
    if(closed)walls.push([x+landing,wallY,side*(OUTER+.15),3,HEIGHT,.3]);
    else{
      walls.push([x+landing,y+2.6+lintelHeight/2,side*(OUTER+.15),3,lintelHeight,.3]);
      floors.push([x+landing,y-.17,side*(OUTER+1.9),3,.34,3.8]);
    }
  }
  if(!top)for(let s=0;s<24;s++)steps.push([x+4+(s+.5)/3,y+(s+1)*HEIGHT/24-.09,side*(OUTER+2.13),1/3,.18,3.24]);
  // Cap only the footprint behind the gallery; no coplanar overlap with its deck.
  if(bottom){
    floors.push([x+8,y-.17,side*(OUTER+1.9),8,.34,3.8]);

  }
  if(top){
    floors.push([x+8,y+HEIGHT-.17,side*(OUTER+1.9),14,.34,3.8]);

  }
  return {walls,floors,steps,label:top?'STAIRS\nDOWN ONLY':bottom?'STAIRS\nUP ONLY':'STAIRS\nUP →     ← DOWN'};
}

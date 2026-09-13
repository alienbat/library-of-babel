import * as T from 'three';
import {BAY,HEIGHT,OUTER,mod,type WorldLimits} from './physics.ts';
export const BOOK_DETAIL_RADIUS=32,SHELF_RELIEF_RADIUS=500;
export const detailRadius=(quality:string)=>quality==='high'?100:BOOK_DETAIL_RADIUS;
export type ShelfCell={bay:number;level:number;side:-1|1};
export function shelfDistanceSquared(eye:T.Vector3,cell:ShelfCell){
  const x=cell.bay*BAY,y=cell.level*HEIGHT,z=cell.side*(OUTER+.035);
  const dx=Math.max(x-eye.x,0,eye.x-x-BAY),dy=Math.max(y-eye.y,0,eye.y-y-3.33),dz=Math.max(Math.abs(eye.z-z)-.325,0);
  return dx*dx+dy*dy+dz*dz;
}
export function detailCells(eye:T.Vector3,limits:WorldLimits,radius=BOOK_DETAIL_RADIUS){
  const cells:ShelfCell[]=[];
  for(let level=Math.floor((eye.y-radius-3.33)/HEIGHT);level<=Math.ceil((eye.y+radius)/HEIGHT);level++){
    if(level*HEIGHT<(limits.minY??-Infinity)-.001||level*HEIGHT>(limits.maxY??Infinity)+.001)continue;
    for(let bay=Math.floor((eye.x-radius)/BAY);bay<=Math.floor((eye.x+radius)/BAY);bay++){
      if(mod(bay,12)===0||(bay+1)*BAY<=(limits.minX??-Infinity)||bay*BAY>=(limits.maxX??Infinity))continue;
      for(const side of [-1,1] as const){const cell={bay,level,side};if(shelfDistanceSquared(eye,cell)<=radius**2)cells.push(cell);}
    }
  }
  return cells;
}
/** Shared shader LOD: near bays yield to real books; medium faces get cheap relief. */
export function shelfLod(material:T.MeshBasicMaterial,eye:T.IUniform<T.Vector3>,radius:T.IUniform<number>={value:BOOK_DETAIL_RADIUS}){
  const shade=material.onBeforeCompile.bind(material),key=material.customProgramCacheKey();
  material.onBeforeCompile=(shader,renderer)=>{
    shade(shader,renderer);shader.uniforms.shelfDetailEye=eye;shader.uniforms.bookDetailRadius=radius;
    shader.fragmentShader='uniform vec3 shelfDetailEye;uniform float bookDetailRadius;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      float shelfBay=floor(vBakedPosition.x/${BAY});
      float shelfLevel=floor((vBakedPosition.y+.001)/${HEIGHT});
      vec3 cellMin=vec3(shelfBay*${BAY},shelfLevel*${HEIGHT},sign(vBakedPosition.z)*${OUTER+.035});
      vec3 shelfDelta=max(abs(shelfDetailEye-(cellMin+vec3(${BAY/2},1.665,0.0)))-vec3(${BAY/2},1.665,.325),vec3(0.0));
      if(dot(shelfDelta,shelfDelta)<=bookDetailRadius*bookDetailRadius)discard;
      // A 3 cm relief layer: boards in front, book spines behind. Check the
      // swept ray against periodic board strips rather than marching geometry.
      float relief=1.0-smoothstep(450.0,${SHELF_RELIEF_RADIUS}.0,length(vBakedPosition-cameraPosition));
      // Filter each board direction independently. A foreshortened horizontal
      // edge must not erase the vertical timber's silhouette (or vice versa).
      if(relief>0.0&&abs(vBakedNormal.z)>.5){
        vec3 ray=vBakedPosition-cameraPosition;
        vec2 shift=ray.xy/max(abs(ray.z),.0001)*.03;
        vec2 p=vec2(vBakedPosition.x,vBakedPosition.y-shelfLevel*${HEIGHT});
        vec2 q=p+shift;
        vec2 period=vec2(${BAY/8},.39),width=vec2(.055,.04);
        vec2 start=vec2(-.0275,.09);
        vec2 footprint=max(fwidth(p),vec2(.00001));
        vec2 swept=abs(q-p);
        vec2 coverageWidth=min(width+swept,period);
        vec2 centre=start+width*.5-(q-p)*.5;
        vec2 distanceToBoard=abs(mod(p-centre+period*.5,period)-period*.5);
        vec2 coverage=clamp((coverageWidth*.5+footprint*.5-distanceToBoard)/footprint,0.0,1.0);
        // At minification converge to actual area coverage rather than dropping boards.
        coverage=mix(coverage,coverageWidth/period,smoothstep(period*.5,period,footprint));
        coverage.y*=1.0-step(2.86,min(p.y,q.y));
        float wood=max(coverage.x,coverage.y);
        wood=max(wood,1.0-smoothstep(.09-footprint.y*.5,.09+footprint.y*.5,min(p.y,q.y)));
        // Derivatives from continuous coordinates avoid false coarse mip levels
        // at bay boundaries. The texture itself supplies RepeatWrapping.
        vec2 uv=vec2((vBakedPosition.z>0.0?-q.x:q.x)/${BAY},(q.y-.03)/3.18);
        vec3 reliefColor=mix(texture2D(map,uv).rgb,vec3(${new T.Color('#544b3d').toArray().join(',')}),wood);
        diffuseColor.rgb=mix(diffuseColor.rgb,reliefColor,relief);
      }
    `);
  };
  material.customProgramCacheKey=()=>key+'-shelf-distance-relief-v2';return material;
}

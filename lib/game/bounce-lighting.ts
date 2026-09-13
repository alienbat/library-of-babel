/** Coarse diffuse surface patches, evaluated only while baking the light volumes.
 * Reflected energy comes from fixtures; no constant ambient term is added.
 * The existing six-lobe texture stores luminance, so reflectance is scalar.
 */
export type BakeLamp={x:number;y:number;z:number;power:number;falloff:number;softening:number};
type Patch={x:number;y:number;z:number;nx:number;ny:number;nz:number;area:number;radiance:number};
type RoomShell={left:number;right:number;front:number;back:number;floor:(x:number)=>number;ceiling:(x:number)=>number;floorReflectance:number;wallReflectance:number;openFront?:boolean;periodic?:number;occlude?:boolean};
export function bakeBouncePatches(shell:RoomShell,lamps:readonly BakeLamp[]){
  const patches:Patch[]=[];
  // Sample geometric visibility in the coarse stair shell, including both bends.
  const visible=(ax:number,ay:number,bx:number,by:number)=>{
    if(!shell.occlude)return true;
    for(const t of [.25,.5,.75,...[4,12].map(x=>(x-ax)/(bx-ax))]){
      if(!(t>0&&t<1))continue;
      const x=ax+(bx-ax)*t,y=ay+(by-ay)*t;
      if(y<shell.floor(x)-.04||y>shell.ceiling(x)+.04)return false;
    }
    return true;
  };
  function patch(x:number,y:number,z:number,nx:number,ny:number,nz:number,area:number,reflectance:number){
    let incident=0;
    for(const lamp of lamps){
      if(!visible(x,y,lamp.x,lamp.y))continue;
      const dx=lamp.x-x,dy=lamp.y-y,dz=lamp.z-z,r2=dx*dx+dy*dy+dz*dz+lamp.softening;
      incident+=lamp.power/(1+r2*lamp.falloff)*Math.max(0,(nx*dx+ny*dy+nz*dz)/Math.sqrt(r2));
    }
    patches.push({x,y,z,nx,ny,nz,area,radiance:incident*reflectance/Math.PI});
  }
  const width=shell.right-shell.left,depth=shell.back-shell.front,nx=Math.ceil(width/1.9),nz=Math.ceil(depth/1.8),dx=width/nx,dz=depth/nz;
  for(let i=0;i<nx;i++){
    const x=shell.left+(i+.5)*dx,bottom=shell.floor(x),top=shell.ceiling(x);
    const slope=(shell.floor(x+.001)-shell.floor(x-.001))/.002,norm=Math.sqrt(1+slope*slope);
    const ceilingSlope=(shell.ceiling(x+.001)-shell.ceiling(x-.001))/.002,ceilingNorm=Math.sqrt(1+ceilingSlope*ceilingSlope);
    for(let k=0;k<nz;k++){
      const z=shell.front+(k+.5)*dz;
      patch(x,bottom+.015,z,-slope/norm,1/norm,0,dx*dz*norm,shell.floorReflectance);
      patch(x,top-.015,z,ceilingSlope/ceilingNorm,-1/ceilingNorm,0,dx*dz*ceilingNorm,shell.wallReflectance);
    }
    const ny=Math.ceil((top-bottom)/1.4),dy=(top-bottom)/ny;
    for(let j=0;j<ny;j++){
      const y=bottom+(j+.5)*dy;
      patch(x,y,shell.back-.015,0,0,-1,dx*dy,shell.wallReflectance);
      if(!shell.openFront)patch(x,y,shell.front+.015,0,0,1,dx*dy,shell.wallReflectance);
    }
  }
  if(!shell.periodic)for(const x of [shell.left,shell.right]){
    const bottom=shell.floor(x),top=shell.ceiling(x),ny=Math.ceil((top-bottom)/1.4),dy=(top-bottom)/ny;
    for(let j=0;j<ny;j++)for(let k=0;k<nz;k++)patch(x===shell.left?x+.015:x-.015,bottom+(j+.5)*dy,shell.front+(k+.5)*dz,x===shell.left?1:-1,0,0,dy*dz,shell.wallReflectance);
  }
  return (lobes:number[],x:number,y:number,z:number)=>{
    for(const p of patches){
      if(p.radiance===0)continue;
      let dx=p.x-x;
      if(shell.periodic)dx-=Math.round(dx/shell.periodic)*shell.periodic;
      const dy=p.y-y,dz=p.z-z,r2=dx*dx+dy*dy+dz*dz,r=Math.sqrt(r2+.0001);
      const cosine=Math.max(0,-(p.nx*dx+p.ny*dy+p.nz*dz)/r);
      if(cosine===0||!visible(x,y,p.x,p.y))continue;
      // Finite patch area regularizes the near field and avoids point hotspots.
      const energy=p.radiance*p.area*cosine/(r2+p.area/Math.PI);
      lobes[dx>=0?0:3]+=energy*Math.abs(dx)/r;
      lobes[dy>=0?1:4]+=energy*Math.abs(dy)/r;
      lobes[dz>=0?2:5]+=energy*Math.abs(dz)/r;
    }
  };
}

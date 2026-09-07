import * as T from 'three';
import {bakeProfile} from './horizon-profile.ts';
import {HEIGHT,INNER,OUTER} from './physics.ts';
/** Average in linear light, before exposure/tone mapping. Computed once at startup. */
export function linearPixelMean(data:ArrayLike<number>){
  const sum=new T.Color(0,0,0),sample=new T.Color();
  for(let i=0;i<data.length;i+=4){sample.setRGB(data[i]/255,data[i+1]/255,data[i+2]/255,T.SRGBColorSpace);sum.add(sample);}
  return sum.multiplyScalar(4/data.length);
}
export function textureMean(texture:T.Texture,fallback:string){
  const canvas=texture.image as HTMLCanvasElement|undefined;
  const context=canvas?.getContext?.('2d');
  const pixels=context?.getImageData(0,0,canvas!.width,canvas!.height)?.data;
  return pixels?.length?linearPixelMean(pixels):new T.Color(fallback);
}
export function galleryAverages(spines:T.Texture,negative:T.Data3DTexture,positive?:T.Data3DTexture,carpet?:T.Texture){
  function irradiance(volume:T.Data3DTexture|undefined,axis:number,y0:number,y1:number,z0:number,z1:number,fallback:number){
    const image=volume?.image;if(!image?.data)return fallback;
    const {width:nx,height:ny,depth:nz,data}=image;let sum=0,count=0;
    for(let z=0;z<nz;z++)for(let y=0;y<ny;y++){
      const fy=y/(ny-1),fz=z/(nz-1);if(fy<y0||fy>y1||fz<z0||fz>z1)continue;
      for(let x=0;x<nx;x++){sum+=Number(data[((z*ny+y)*nx+x)*4+axis])*4/255;count++;}
    }
    return count?sum/count:fallback;
  }
  const tint=new T.Color().setRGB(1,.97,.89),shelf=textureMean(spines,'#806849');
  const lit=(color:T.Color,light:number)=>color.clone().multiply(tint).multiplyScalar(light);
  const shelfLight=irradiance(negative,2,0,3.21/HEIGHT,1,1,.85);
  const edge=lit(new T.Color('#aaa99c'),irradiance(negative,2,(HEIGHT-.34)/HEIGHT,1,0,0,.72));
  const ceiling=lit(new T.Color('#aaa99c'),irradiance(negative,1,(HEIGHT-.40)/HEIGHT,(HEIGHT-.30)/HEIGHT,0,1,.4));
  const floor=lit(new T.Color('#b1b1a7').multiply(carpet?textureMean(carpet,'#6b6c66'):new T.Color('#6b6c66')),irradiance(positive,1,0,0,0,1,1.05));
  // Real underside fixture area, not a glowing screen-space horizon stripe.
  const lampArea=1.6*.28/(7.62*(OUTER-INNER));
  ceiling.lerp(new T.Color().setRGB(2,1.8,1.35),lampArea);
  const face=new T.Color().setRGB(.07,.073,.064).multiplyScalar(1-3.18/HEIGHT-.34/HEIGHT);
  face.add(lit(shelf,shelfLight).multiplyScalar(3.18/HEIGHT)).add(edge.clone().multiplyScalar(.34/HEIGHT));
  const rail=new T.Color('#854a3d');
  const railFront=lit(rail,irradiance(negative,2,.5/HEIGHT,1.3/HEIGHT,0,0,.72));
  const railUp=lit(rail,irradiance(negative,1,.5/HEIGHT,1.3/HEIGHT,0,0,.4));
  const railDown=lit(rail,irradiance(positive,1,.5/HEIGHT,1.3/HEIGHT,0,0,1.05));
  return {shelf,face,edge,ceiling,floor,railFront,railUp,railDown};
}
/** Projected first-hit coverage of repeating opaque decks at grazing incidence. */
export function horizontalCoverage(y:number,z:number){return Math.min(Math.abs(y)*(OUTER-INNER)/(Math.max(Math.abs(z),1e-20)*HEIGHT),1-.34/HEIGHT);}

/** Measured first-hit radiance, averaged over the vertical phase and baked light period. */
export function galleryProfile(spines:T.Texture,negative:T.Data3DTexture,positive?:T.Data3DTexture,carpet?:T.Texture){
  const shelf=textureMean(spines,'#806849'),floor=new T.Color('#b1b1a7').multiply(carpet?textureMean(carpet,'#6b6c66'):new T.Color('#6b6c66'));
  const slab=new T.Color('#aaa99c'),rail=new T.Color('#854a3d'),tint=new T.Color().setRGB(1,.97,.89);
  // Collapse only the horizontal lighting period. Keep height/depth and face normals.
  function field(volume:T.Data3DTexture|undefined){
    const image=volume?.image;if(!image?.data)return null;
    const {width,height,depth,data}=image,out=new Float64Array(height*depth*3);
    for(let z=0;z<depth;z++)for(let y=0;y<height;y++)for(let c=0;c<3;c++){
      let sum=0;for(let x=0;x<width;x++)sum+=Number(data[((z*height+y)*width+x)*4+c])*4/255;
      out[(z*height+y)*3+c]=sum/width;
    }
    return {out,height,depth};
  }
  const pos=field(positive),neg=field(negative);
  function sample(f:ReturnType<typeof field>,y:number,z:number,c:number,fallback:number){
    if(!f)return fallback;
    const fy=Math.max(0,Math.min(f.height-1,y/HEIGHT*(f.height-1))),fz=Math.max(0,Math.min(f.depth-1,(z-INNER)/(OUTER-INNER)*(f.depth-1)));
    const iy=Math.floor(fy),iz=Math.floor(fz),ty=fy-iy,tz=fz-iz;
    const at=(dy:number,dz:number)=>f.out[(Math.min(f.depth-1,iz+dz)*f.height+Math.min(f.height-1,iy+dy))*3+c];
    return (at(0,0)*(1-ty)+at(1,0)*ty)*(1-tz)+(at(0,1)*(1-ty)+at(1,1)*ty)*tz;
  }
  return bakeProfile(hit=>{
    const y=((hit.y+(hit.kind==='deck'?hit.ny*.002:0))%HEIGHT+HEIGHT)%HEIGHT;
    const light=hit.ny*hit.ny*sample(hit.ny>0?pos:neg,y,hit.z,1,hit.ny>0?1.05:.4)+hit.nz*hit.nz*sample(neg,y,hit.z,2,.72);
    const base=hit.kind==='rail'?rail:hit.kind==='deck'?(hit.ny>0?floor:slab):shelf;
    const color=base.clone().multiply(tint).multiplyScalar(light);
    // Unresolved ceiling luminaires retain their true plan-area contribution.
    if(hit.kind==='deck'&&hit.ny<0)color.lerp(new T.Color().setRGB(2,1.8,1.35),1.6*.28/(7.62*(OUTER-INNER)));
    return color;
  });
}

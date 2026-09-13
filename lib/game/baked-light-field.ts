import * as T from 'three';
export interface LightField {grid:number[];range:number;positive:string;negative:string;engine:string;samples:number;diffuseBounces:number;extraAO:boolean}
/** Decode offline linear irradiance. No tracing, scene traversal, or AO at startup. */
export function loadLightField(field:LightField,strength=1,repeat=false){
 const [nx,ny,nz]=field.grid;
 const texture=(encoded:string)=>{
  const raw=atob(encoded),data=Uint8Array.from(raw,c=>c.charCodeAt(0));
  if(data.length!==nx*ny*nz*4||field.range!==4)throw new Error('Invalid baked light-field layout');
  if(strength!==1)for(let i=0;i<data.length;i++)if(i%4<3)data[i]=Math.min(255,Math.round(data[i]*Math.max(0,strength)));
  const t=new T.Data3DTexture(data,nx,ny,nz);t.format=T.RGBAFormat;t.type=T.UnsignedByteType;
  t.minFilter=t.magFilter=T.LinearFilter;t.wrapS=repeat?T.RepeatWrapping:T.ClampToEdgeWrapping;t.wrapT=t.wrapR=T.ClampToEdgeWrapping;t.unpackAlignment=1;t.needsUpdate=true;return t;
 };
 const positive=texture(field.positive),negative=texture(field.negative);
 return {positive,negative,dispose(){positive.dispose();negative.dispose();}};
}

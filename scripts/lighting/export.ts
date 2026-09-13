/** Export actual repeating architecture and fixture transforms for offline Cycles. */
import * as T from 'three';
import {writeFileSync,mkdirSync} from 'node:fs';
import {createWorld} from '../../lib/game/world.ts';
import {HEIGHT} from '../../lib/game/physics.ts';
const context=new Proxy({}, {get:()=>()=>{},set:()=>true});
Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({width:0,height:0,getContext:()=>context})}});
mkdirSync('scripts/lighting/generated',{recursive:true});
for(const variant of ['normal','top','bottom']){
 const scene=new T.Scene(),world=createWorld(scene);
 if(variant==='top')world.setLimits({maxY:HEIGHT-.34});
 if(variant==='bottom')world.setLimits({minY:0});
 const camera=new T.PerspectiveCamera(75,1,.1,16000);camera.position.set(22,1.68,16.94);world.update(22,0,camera);scene.updateMatrixWorld(true);
 const meshes:unknown[]=[],lights:number[][]=[];
 const matrix=new T.Matrix4(),p=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3();
 for(const root of [scene.children[0],...['dormitory-beds','bathroom-fixtures','library-return','library-bbq','ceiling-light-lods'].map(name=>scene.getObjectByName(name)!)])root.traverse(o=>{
  if(!(o instanceof T.InstancedMesh))return;
  const mats=Array.isArray(o.material)?o.material:[o.material];
  const positions=Array.from(o.geometry.attributes.position.array),indices=o.geometry.index?Array.from(o.geometry.index.array):positions.map((_,i)=>i).filter(i=>i<positions.length/3);
  const transforms:number[][]=[];
  for(let i=0;i<o.count;i++){
   o.getMatrixAt(i,matrix);matrix.premultiply(o.matrixWorld);matrix.decompose(p,q,s);
   if(p.x < -46||p.x>69||p.y< -12||p.y>16||Math.abs(p.z)>26)continue;
   if(root.name==='ceiling-light-lods'){lights.push([p.x,p.y,p.z,s.x,s.z]);continue;}
   transforms.push(matrix.toArray());
  }
  if(transforms.length)meshes.push({positions,indices,groups:o.geometry.groups,transforms,materials:mats.map(m=>{
   const b=m as T.MeshBasicMaterial;
   // Canvas textures are represented by their mean diffuse reflectance for transport.
   const color=b.map?(b.name==='shelf-facade'?[.25,.18,.09]:b.color.getHexString()==='ffffff'?[.5,.51,.46]:b.color.clone().multiplyScalar(.75).toArray()):b.color.toArray();
   return {color,name:m.name};
  })});
 });
 writeFileSync(`scripts/lighting/generated/${variant}.json`,JSON.stringify({meshes,lights}));world.dispose();
}

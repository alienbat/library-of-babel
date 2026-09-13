import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
type Box=[number,number,number,number,number,number];
/** Shared emitter geometry; lighting itself remains baked and independent of LOD. */
export function createCeilingLights(scene:T.Scene,material:T.Material,url?:string){
  const group=new T.Group();group.name='ceiling-light-lods';scene.add(group);
  const low=new T.BoxGeometry(),high=new T.BoxGeometry();
  let disposed=false,loaded=false,dirty=true,items:Box[]=[],meshes:T.InstancedMesh[]=[],membership='';
  const dummy=new T.Object3D(),lastEye=new T.Vector3(Infinity,Infinity,Infinity);let lastRadius=0,lastShift=Infinity;
  if(url)void new GLTFLoader().loadAsync(url).then(gltf=>{
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(o=>{if(!(o instanceof T.Mesh))return;
      if(!disposed){const g=o.geometry.clone().applyMatrix4(o.matrixWorld);g.scale(1/1.6,1/.035,1/.28);high.dispose();high.copy(g);g.dispose();loaded=true;dirty=true;}
      o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();
    });
  }).catch(e=>{if(!disposed)console.warn('Rounded ceiling light unavailable; keeping box LOD.',e);});
  function clear(){for(const m of meshes){group.remove(m);m.dispose();}meshes=[];}
  return {
    set(next:Box[]){items=next;clear();for(const g of [low,high]){const m=new T.InstancedMesh(g,material,Math.max(1,items.length));m.count=0;meshes.push(m);group.add(m);}dirty=true;},
    update(eye:T.Vector3,shift:number,radius:number){
      group.position.y=shift;
      if(!dirty&&lastRadius===radius&&lastShift===shift&&lastEye.distanceToSquared(eye)<.25)return;
      lastEye.copy(eye);lastRadius=radius;lastShift=shift;
      const near:number[]=[],far:number[]=[];
      items.forEach(([x,y,z],i)=>{((loaded&&(x-eye.x)**2+(y+shift-eye.y)**2+(z-eye.z)**2<=radius**2)?near:far).push(i);});
      const key=near.join(',');if(!dirty&&key===membership)return;membership=key;dirty=false;
      [far,near].forEach((indices,lod)=>{const m=meshes[lod];if(!m)return;
        indices.forEach((index,i)=>{const [x,y,z,w,h,d]=items[index];dummy.position.set(x,y,z);dummy.scale.set(w,h,d);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);});
        m.count=indices.length;m.instanceMatrix.needsUpdate=true;m.computeBoundingSphere();
      });
    },
    dispose(){disposed=true;clear();low.dispose();high.dispose();scene.remove(group);}
  };
}

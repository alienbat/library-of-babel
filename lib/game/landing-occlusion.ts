import * as T from 'three';
import {BAY,HEIGHT,INNER,OUTER,PERIOD,mod,type WorldLimits,type Position} from './physics.ts';
/** An actual opaque landing ceiling, joined to the coplanar gallery deck.
 * Inset edges conservatively: never hide a pixel visible through a doorway.
 */
export function landingOccluder(eye:Position,limits:WorldLimits={}){
  const local=mod(eye.x,PERIOD),landing=Math.abs(local-2.5)<Math.abs(local-13.5)?2.5:13.5;
  if(Math.abs(local-landing)>3||Math.abs(Math.abs(eye.z)-OUTER)>4)return null;
  const y=(Math.floor((eye.y+.34)/HEIGHT)+1)*HEIGHT-.34;
  if(y>(limits.maxY??Infinity)+.001||y<(limits.minY??-Infinity)||y-eye.y<.04)return null;
  const x=eye.x-local+landing,side=Math.sign(eye.z);
  const minX=Math.max(x-1.5,limits.minX??-Infinity)+.015,maxX=Math.min(x+1.5,limits.maxX??Infinity)-.015;
  if(minX>=maxX)return null;
  return {y,minX,maxX,minZ:side>0?INNER+.015:-OUTER-3.8+.015,maxZ:side>0?OUTER+3.8-.015:-INNER-.015};
}

export function hiddenByLanding(box:T.Box3,eye:Position,roof:NonNullable<ReturnType<typeof landingOccluder>>){
  if(box.min.y<=roof.y+.03)return false;
  const distance=roof.y-eye.y,t0=distance/(box.max.y-eye.y),t1=distance/(box.min.y-eye.y);
  const minX=eye.x+Math.min((box.min.x-eye.x)*t0,(box.min.x-eye.x)*t1);
  const maxX=eye.x+Math.max((box.max.x-eye.x)*t0,(box.max.x-eye.x)*t1);
  const minZ=eye.z+Math.min((box.min.z-eye.z)*t0,(box.min.z-eye.z)*t1);
  const maxZ=eye.z+Math.max((box.max.z-eye.z)*t0,(box.max.z-eye.z)*t1);
  return minX>roof.minX&&maxX<roof.maxX&&minZ>roof.minZ&&maxZ<roof.maxZ;
}
/** Split the oversized near batches only for enclosed upward stair views.
 * Geometry/materials are shared; ordinary gallery views keep their low draw count.
 */
export function createStairCulling(scene:T.Scene){
  const group=new T.Group();group.name='stair-visible-chunks';
  let sourceFirst:T.Object3D|undefined,cached=false;
  const view=new T.Matrix4(),projection=new T.Matrix4(),offset=new T.Vector3();
  const batches:{mesh:T.InstancedMesh;original:T.InstancedMesh;chunks:{indices:number[];bounds:T.Box3}[]}[]=[];
  const matrix=new T.Matrix4(),box=new T.Box3(),worldBox=new T.Box3(),direction=new T.Vector3();
  function clear(){for(const {mesh} of batches){group.remove(mesh);mesh.dispose();}batches.length=0;sourceFirst=undefined;cached=false;}
  function build(source:T.Group){
    clear();sourceFirst=source.children[0];
    for(const original of source.children){
      if(!(original instanceof T.InstancedMesh))continue;
      original.geometry.computeBoundingBox();
      const buckets=new Map<string,{indices:number[];bounds:T.Box3}>();
      for(let i=0;i<original.count;i++){
        original.getMatrixAt(i,matrix);
        const key=`${Math.floor(matrix.elements[12]/BAY)}:${Math.floor(matrix.elements[13]/HEIGHT)}:${Math.sign(matrix.elements[14])}`;
        let bucket=buckets.get(key);if(!bucket){bucket={indices:[],bounds:new T.Box3()};buckets.set(key,bucket);}
        bucket.indices.push(i);box.copy(original.geometry.boundingBox!).applyMatrix4(matrix);bucket.bounds.union(box);
      }
      const mesh=new T.InstancedMesh(original.geometry,original.material,original.count);
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;group.add(mesh);
      batches.push({mesh,original,chunks:[...buckets.values()]});
    }
  }
  return {
    update(source:T.Group,camera:T.Camera,frustum:T.Frustum,limits:WorldLimits,enabled=true){
      const roof=enabled?landingOccluder(camera.position,limits):null;camera.getWorldDirection(direction);
      const active=!!roof&&direction.y>.35;
      source.visible=!active;
      if(!active){scene.remove(group);return;}
      if(!group.parent)scene.add(group);
      if(sourceFirst!==source.children[0])build(source);
      if(cached&&view.equals(camera.matrixWorld)&&projection.equals(camera.projectionMatrix)&&offset.equals(source.position))return;
      cached=true;view.copy(camera.matrixWorld);projection.copy(camera.projectionMatrix);offset.copy(source.position);group.position.copy(source.position);
      const bx=Math.floor(camera.position.x/BAY)*BAY,side=Math.sign(camera.position.z);
      const gallery={y:roof!.y,minX:Math.max(bx-14*BAY,limits.minX??-Infinity)+.015,maxX:Math.min(bx+15*BAY,limits.maxX??Infinity)-.015,minZ:side>0?INNER+.015:-OUTER+.015,maxZ:side>0?OUTER-.015:-INNER-.015};
      for(const {mesh,original,chunks} of batches){
        let count=0;const from=original.instanceMatrix.array,to=mesh.instanceMatrix.array;
        for(const chunk of chunks){
          worldBox.copy(chunk.bounds).translate(source.position);
          if(!frustum.intersectsBox(worldBox)||hiddenByLanding(worldBox,camera.position,roof!)||hiddenByLanding(worldBox,camera.position,gallery))continue;
          for(const index of chunk.indices){for(let k=0;k<16;k++)to[count*16+k]=from[index*16+k];count++;}
        }
        mesh.count=count;mesh.visible=count>0;mesh.instanceMatrix.clearUpdateRanges();
        if(count){mesh.instanceMatrix.addUpdateRange(0,count*16);mesh.instanceMatrix.needsUpdate=true;}
      }
    },
    dispose(){clear();scene.remove(group);},
  };
}

import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(window.devicePixelRatio||1);renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.NoToneMapping;
document.body.appendChild(renderer.domElement);
const scene=new T.Scene();scene.background=new T.Color('#070908');
const camera=new T.PerspectiveCamera(65,innerWidth/innerHeight,.05,300);
let yaw=0,pitch=0;const keys=new Set<string>();const status=document.querySelector('#status')!;
function view(name:string){
  const views:Record<string,number[]>={Bedroom:[20,1.68,-2.4,22,1,-5.2],Doorway:[19,1.68,2.5,20,1.5,-4],Gallery:[21,1.68,2,36,1.6,.1],Beds:[22.6,1.4,-3.6,21,.6,-5.1]};
  const [x,y,z,tx,ty,tz]=views[name];camera.position.set(x,y,z);camera.lookAt(tx,ty,tz);camera.rotation.order='YXZ';yaw=camera.rotation.y;pitch=camera.rotation.x;
}
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-view]'))button.onclick=()=>view(button.dataset.view!);
view('Bedroom');
new GLTFLoader().load('./room.glb',gltf=>{
  let count=0;gltf.scene.traverse(o=>{if(o instanceof T.Mesh){
    const materials=Array.isArray(o.material)?o.material:[o.material];
    const baked=materials.map(m=>{const basic=new T.MeshBasicMaterial({map:m.map??m.emissiveMap,color:m.map?0xffffff:m.emissive??m.color});basic.toneMapped=false;return basic;});o.material=Array.isArray(o.material)?baked:baked[0];count++;
  }});
  scene.add(gltf.scene);status.textContent=`Cycles bake loaded · ${count} meshes · no live lighting or AO`;
},undefined,error=>{status.textContent='Could not load the bake.';console.error(error);});
renderer.domElement.addEventListener('click',()=>renderer.domElement.requestPointerLock());
document.addEventListener('mousemove',e=>{if(document.pointerLockElement){yaw-=e.movementX*.002;pitch=T.MathUtils.clamp(pitch-e.movementY*.002,-1.5,1.5);camera.rotation.set(pitch,yaw,0,'YXZ');}});
document.addEventListener('keydown',e=>{if(!['INPUT','TEXTAREA'].includes((e.target as HTMLElement).tagName)){keys.add(e.code);if(['Space','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();}});document.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>keys.clear());document.addEventListener('pointerlockchange',()=>keys.clear());
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(devicePixelRatio||1);});
let last=performance.now();const forward=new T.Vector3(),right=new T.Vector3();
renderer.setAnimationLoop(now=>{const dt=Math.min((now-last)/1000,.05);last=now;camera.getWorldDirection(forward);forward.y=0;forward.normalize();right.crossVectors(forward,camera.up);const speed=(keys.has('ShiftLeft')?5:2)*dt;
 if(keys.has('KeyW'))camera.position.addScaledVector(forward,speed);if(keys.has('KeyS'))camera.position.addScaledVector(forward,-speed);if(keys.has('KeyD'))camera.position.addScaledVector(right,speed);if(keys.has('KeyA'))camera.position.addScaledVector(right,-speed);
 if(keys.has('Space'))camera.position.y+=speed;if(keys.has('KeyC'))camera.position.y-=speed;
 renderer.render(scene,camera);
});

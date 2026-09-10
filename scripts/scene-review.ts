import * as T from 'three';
import {createWorld} from '../lib/game/world.ts';
import {OUTER,HEIGHT} from '../lib/game/physics.ts';
const renderer=new T.WebGLRenderer({antialias:true,logarithmicDepthBuffer:true});
renderer.setSize(1100,720);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
document.body.appendChild(renderer.domElement);
const scene=new T.Scene();scene.background=new T.Color('#202825');
const world=createWorld(scene),camera=new T.PerspectiveCamera(65,1100/720,.1,16000);
let errors=0;
renderer.debug.onShaderError=(gl,program,vs,fs)=>{errors++;console.error(gl.getProgramInfoLog(program),gl.getShaderInfoLog(vs),gl.getShaderInfoLog(fs));};
const views={
 FloatingNearFloor:{p:[35,4.1,OUTER-1.5],at:[38,5.4,OUTER],limits:{}},
 ShelfTransition:{p:[84,1.68,OUTER-1.6],at:[100,1.68,OUTER-.23],limits:{}},
 ShelfDetail:{p:[31,1.68,OUTER-1.4],at:[30,1.5,OUTER],limits:{}},
 FreshArrival:{p:[30,5.64,0],at:[130,5.64,0],limits:{}},
 BottomLeftUp:{p:[25,1.68,0],at:[20,100,0],limits:{minX:0,minY:0}},
 BottomRightUp:{p:[-25,1.68,0],at:[-20,100,0],limits:{maxX:0,minY:0}},
 TopLeftDown:{p:[25,1.68,0],at:[20,-100,0],limits:{minX:0,maxY:HEIGHT-.34}},
 TopRightDown:{p:[-25,1.68,0],at:[-20,-100,0],limits:{maxX:0,maxY:HEIGHT-.34}},
 ChasmLeft:{p:[30,1.68,0],at:[-100,1.68,0],limits:{}},
 ChasmRight:{p:[30,1.68,0],at:[100,1.68,0],limits:{}},
 ChasmUp:{p:[30,1.68,0],at:[30,100,0],limits:{}},
 ChasmDown:{p:[30,1.68,0],at:[30,-100,0],limits:{}},
 ChasmOblique:{p:[30,1.68,0],at:[100,65,.015],limits:{}},
 Gallery:{p:[30,1.68,16.94],at:[40,1.6,0],limits:{}},
 CompassOpposite:{p:[17,2.5,-OUTER+2.5],at:[17,3,-OUTER-.1],limits:{}},
 Writing:{p:[17,1.7,OUTER-2.5],at:[17,2.7,OUTER+.1],limits:{}},
 Stairs:{p:[2.5,1.68,OUTER+2.1],at:[10,3.4,OUTER+2.1],limits:{}},
 Bedroom:{p:[19,1.68,OUTER+2.6],at:[20.5,1.2,OUTER+4.5],limits:{}},
 Bathroom:{p:[23,1.68,OUTER+2.7],at:[27,1.6,OUTER+3.4],limits:{}},
 Bottom:{p:[25,1.68,0],at:[1,.5,0],limits:{minX:0,minY:0}},
 Top:{p:[2.5,1.68,OUTER+2.1],at:[8,2.4,OUTER+2.1],limits:{maxY:HEIGHT-.34}},
};
for(const [name,view] of Object.entries(views)){
 const button=document.createElement('button');button.textContent=name;document.querySelector('#buttons')!.appendChild(button);
 button.onclick=()=>{
  if(name!=='FreshArrival')world.setLimits(view.limits);world.update(view.p[0],0);camera.position.set(...view.p as [number,number,number]);camera.lookAt(...view.at as [number,number,number]);
  renderer.clippingPlanes=[];const l=view.limits as {minX?:number;maxX?:number;minY?:number;maxY?:number};
  if(l.minX!==undefined)renderer.clippingPlanes.push(new T.Plane(new T.Vector3(1,0,0),-l.minX));
  if(l.maxX!==undefined)renderer.clippingPlanes.push(new T.Plane(new T.Vector3(-1,0,0),l.maxX));
  if(l.minY!==undefined)renderer.clippingPlanes.push(new T.Plane(new T.Vector3(0,1,0),-l.minY+.36));
  if(l.maxY!==undefined)renderer.clippingPlanes.push(new T.Plane(new T.Vector3(0,-1,0),l.maxY+.36));
  world.update(view.p[0],0,camera);renderer.render(scene,camera);
  document.querySelector('#status')!.textContent=`${name}: ${errors===0?'PASS':'FAIL'} — ${errors} shader errors`;
 };
}
(document.querySelector('button') as HTMLButtonElement).click();

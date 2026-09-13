import * as T from 'three';
import {createWorld} from '../lib/game/world.ts';
import {OUTER,INNER,HEIGHT,PERIOD} from '../lib/game/physics.ts';
const renderer=new T.WebGLRenderer({antialias:true,logarithmicDepthBuffer:true});
renderer.setSize(1100,720);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
document.body.appendChild(renderer.domElement);
const scene=new T.Scene();scene.background=new T.Color('#202825');
const world=createWorld(scene,new Set(),'/models/blender/bed/bed.glb','/models/blender/bathroom/bathroom.glb',{module:'/models/blender/shelves/ShelfModule.glb',start:'/models/blender/shelves/ShelfModuleStart.glb',book:'/models/blender/shelves/ShelfBook.glb',board:'/models/blender/shelves/ShelfBoard.glb',upright:'/models/blender/shelves/ShelfUpright.glb',returns:'/models/blender/library-furnishings/Return.glb',bbq:'/models/blender/library-furnishings/BBQ.glb',light:'/models/blender/ceiling-light/ceiling-light.glb'}),camera=new T.PerspectiveCamera(65,1100/720,.1,16000);
let errors=0;
renderer.debug.onShaderError=(gl,program,vs,fs)=>{errors++;console.error(gl.getProgramInfoLog(program),gl.getShaderInfoLog(vs),gl.getShaderInfoLog(fs));};
const views={
 BedroomFrontWall:{p:[20,1.68,OUTER+3.5],at:[23,2.3,OUTER+.4],limits:{}},
 BedroomFrontWallOpposite:{p:[20,1.68,-OUTER-3.5],at:[23,2.3,-OUTER-.4],limits:{}},
 BedroomLight:{p:[18,2,OUTER+3.15],at:[18,3.53,OUTER+3.15],limits:{}},
 BathroomLight:{p:[27,2,OUTER+2.7],at:[27,3.53,OUTER+2.7],limits:{}},
 StairLight:{p:[2.5,2,OUTER+2.1],at:[2.5,3.53,OUTER+2.1],limits:{}},
 CeilingLight:{p:[3.81,2,17.1],at:[3.81,3.58,17.0688],limits:{}},
 TopClosedEntry:{p:[2.5,1.68,OUTER-2],at:[2.5,1.8,OUTER+1],limits:{minX:0,maxY:HEIGHT-.34}},
 BottomClosedEntry:{p:[13.5,1.68,OUTER-2],at:[13.5,1.8,OUTER+1],limits:{minX:0,minY:0}},
 TopStairCeiling:{p:[10,1.2,OUTER+2],at:[6,3.6,OUTER+2],limits:{minX:0,maxY:HEIGHT-.34}},
 ShelfBookClose:{p:[30,1.45,OUTER-.62],at:[30,1.45,OUTER],limits:{}},
 ShelfModuleJoin:{p:[45,1.68,OUTER-1.1],at:[45.72,2,OUTER],limits:{}},
 ShelfBookOpposite:{p:[30,1.45,-OUTER+.62],at:[30,1.45,-OUTER],limits:{}},
 ShelfEndFlush:{p:[24,1.68,OUTER-1],at:[22.86,2.6,OUTER-.2],limits:{}},
 RailFooting:{p:[33,1.68,INNER+1],at:[34,0,INNER+.05],limits:{}},
 ShelfRunStart:{p:[9,1.68,OUTER-1.7],at:[26,1.8,OUTER-.15],limits:{}},
 ShelfRunEnd:{p:[PERIOD+9,1.68,OUTER-1.7],at:[PERIOD-3,1.8,OUTER-.15],limits:{}},
 AmenitySigns:{p:[20,1.68,OUTER-5],at:[20,1.7,OUTER],limits:{}},
 AmenitySignsOpposite:{p:[20,1.68,-OUTER+5],at:[20,1.7,-OUTER],limits:{}},
 BookReturn:{p:[21.5,1.68,OUTER-1.5],at:[21.43,.9,OUTER-.2],limits:{}},
 ParkDispenser:{p:[18,1.68,OUTER-2],at:[17,.8,OUTER-.49],limits:{}},
 ReturnOpposite:{p:[21.5,1.68,-OUTER+1.5],at:[21.43,.9,-OUTER+.2],limits:{}},
 BBQOpposite:{p:[18,1.68,-OUTER+2],at:[17,.8,-OUTER+.49],limits:{}},
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
 StairUpLookUp:{p:[2.5,1.68,OUTER+.6],at:[2.5,12,OUTER+.8],limits:{}},
 StairEdgeLookUp:{p:[3.8,1.68,OUTER+.1],at:[4.1,12,OUTER-.1],limits:{}},
 StairOppositeLookUp:{p:[13.5,1.68,-OUTER-.6],at:[13.5,12,-OUTER-.8],limits:{}},
 StairTopLookUp:{p:[13.5,1.68,OUTER+.6],at:[13.5,12,OUTER+.8],limits:{maxY:HEIGHT-.34}},
 StairBottomLookUp:{p:[2.5,1.68,OUTER+.6],at:[2.5,12,OUTER+.8],limits:{minY:0}},
 StairDownLookUp:{p:[13.5,1.68,OUTER+.6],at:[13.5,12,OUTER+.8],limits:{}},
 Stairs:{p:[2.5,1.68,OUTER+2.1],at:[10,3.4,OUTER+2.1],limits:{}},
 BedroomEntrance:{p:[19,1.68,OUTER-.5],at:[20,.85,OUTER+4.2],limits:{}},
 BedroomOpposite:{p:[19,1.68,-OUTER-3.4],at:[21,.6,-OUTER-5.1],limits:{}},
 BedroomTop:{p:[19,1.68,OUTER+3.4],at:[21,.6,OUTER+5.1],limits:{maxY:HEIGHT-.34}},
 Bedroom:{p:[19,1.68,OUTER+3.4],at:[21,.6,OUTER+5.1],limits:{}},
 Basin:{p:[26.6,1.55,OUTER+2],at:[26.6,1.3,OUTER+.6],limits:{}},
 Toilet:{p:[24.7,1.35,OUTER+3.15],at:[25,.55,OUTER+4.25],limits:{}},
 ShowerDrain:{p:[28,1.4,OUTER+1.25],at:[29,.01,OUTER+1.25],limits:{}},
 BathroomOpposite:{p:[27,1.68,-OUTER-2.9],at:[29,1.3,-OUTER-3.75],limits:{}},
 Bathroom:{p:[25,1.68,OUTER+2.9],at:[29,1.6,OUTER+3.4],limits:{}},
 Bottom:{p:[25,1.68,0],at:[1,.5,0],limits:{minX:0,minY:0}},
 TopGallery:{p:[17,1.68,16.94],at:[45,3.3,18],limits:{maxY:HEIGHT-.34}},
 TopDescending:{p:[13.5,1.68,OUTER+2.1],at:[5,2.6,OUTER+2.1],limits:{maxY:HEIGHT-.34}},
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

const benchmark=document.createElement('button');benchmark.textContent='Benchmark view';document.querySelector('#buttons')!.appendChild(benchmark);
benchmark.onclick=async()=>{
 benchmark.disabled=true;const samples:number[]=[],gpu:number[]=[],gl=renderer.getContext() as WebGL2RenderingContext,ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
 for(let i=0;i<45;i++){
  await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
  const query=ext?gl.createQuery():null;if(query)gl.beginQuery(ext.TIME_ELAPSED_EXT,query);
  const start=performance.now();world.update(camera.position.x,camera.position.y-1.68,camera);renderer.render(scene,camera);renderer.getContext().finish();if(query)gl.endQuery(ext.TIME_ELAPSED_EXT);
  if(i>=10)samples.push(performance.now()-start);
  if(query){while(!gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE))await new Promise<void>(r=>requestAnimationFrame(()=>r()));if(i>=10&&!gl.getParameter(ext.GPU_DISJOINT_EXT))gpu.push(gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6);gl.deleteQuery(query);}
 }
 samples.sort((a,b)=>a-b);gpu.sort((a,b)=>a-b);
 document.querySelector('#status')!.textContent+=` | render submission: median ${samples[17].toFixed(2)} ms, p90 ${samples[31].toFixed(2)} ms; ${renderer.info.render.calls} draws, ${renderer.info.render.triangles} triangles; GPU ${gpu.length?gpu[Math.floor(gpu.length/2)].toFixed(2)+' ms':'timer unavailable'}`;
 benchmark.disabled=false;
};

const resolution=document.createElement('button');resolution.textContent='High resolution';document.querySelector('#buttons')!.appendChild(resolution);
resolution.onclick=()=>{renderer.setSize(2200,1440,false);renderer.domElement.style.width='1100px';renderer.domElement.style.height='720px';renderer.render(scene,camera);};

let occlusion=true;
const toggle=document.createElement('button');toggle.textContent='Occlusion on';document.querySelector('#buttons')!.appendChild(toggle);
toggle.onclick=()=>{occlusion=!occlusion;world.setOcclusionEnabled(occlusion);world.update(camera.position.x,camera.position.y-1.68,camera);renderer.render(scene,camera);toggle.textContent=occlusion?'Occlusion on':'Occlusion off';};
const compare=document.createElement('button');compare.textContent='Compare pixels';document.querySelector('#buttons')!.appendChild(compare);
compare.onclick=()=>{
 const gl=renderer.getContext(),a=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4),b=new Uint8Array(a.length);
 const read=(enabled:boolean,data:Uint8Array)=>{world.setOcclusionEnabled(enabled);world.update(camera.position.x,camera.position.y-1.68,camera);renderer.render(scene,camera);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,data);};
 read(false,a);read(true,b);let different=0,max=0;for(let i=0;i<a.length;i++){const delta=Math.abs(a[i]-b[i]);if(delta)different++;max=Math.max(max,delta);}
 document.querySelector('#status')!.textContent+=` | pixel comparison: ${different} changed channels, max delta ${max}`;
 world.setOcclusionEnabled(occlusion);
};
const inventory=document.createElement('button');inventory.textContent='Draw inventory';document.querySelector('#buttons')!.appendChild(inventory);
inventory.onclick=()=>{
 const rows:{group:string;material:string;instances:number;triangles:number}[]=[];
 scene.traverse(o=>{if(o instanceof T.Mesh)o.onAfterRender=(_r,_s,_c,g,m,group)=>{const count=o instanceof T.InstancedMesh?o.count:1;rows.push({group:o.parent===scene.children[0]?'near':o.parent===scene.children[1]?'distant':o.parent?.name||'other',material:m.name||((m as T.MeshBasicMaterial).color?.getHexString()??m.type),instances:count,triangles:(group?.count??g.index?.count??g.getAttribute('position').count)/3*count});};});
 renderer.render(scene,camera);rows.sort((a,b)=>b.triangles-a.triangles);
 document.querySelector('#status')!.textContent=JSON.stringify(rows.slice(0,15));scene.traverse(o=>{if(o instanceof T.Mesh)o.onAfterRender=()=>{};});
};
const validate=document.createElement('button');validate.textContent='Validate stair views';document.querySelector('#buttons')!.appendChild(validate);
validate.onclick=async()=>{
 validate.disabled=true;const results:string[]=[];
 for(const name of ['StairUpLookUp','StairDownLookUp','StairEdgeLookUp','StairOppositeLookUp','StairTopLookUp','StairBottomLookUp','Stairs','Top','TopDescending','TopGallery','Gallery','ChasmUp']){
  const button=[...document.querySelectorAll('button')].find(b=>b.textContent===name)!;button.click();compare.click();results.push(document.querySelector('#status')!.textContent!);
  await new Promise<void>(r=>requestAnimationFrame(()=>r()));
 }
 document.querySelector('#status')!.textContent=results.join('\n');validate.disabled=false;
};

for(const quality of ['low','high']){const b=document.createElement('button');b.textContent=quality+' detail';document.querySelector('#buttons')!.appendChild(b);b.onclick=()=>{world.setDetail(quality);world.update(camera.position.x,camera.position.y-1.68,camera);renderer.render(scene,camera);};}

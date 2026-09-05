import * as T from 'three';
import { createWorld } from './world';
import { EYE, HEIGHT, INNER, move, flightVector, flyMove, fallStep, type Position, type TravelMode,type WorldLimits } from './physics';

import {bookId,bookCenter,pickBook,loadOpened,OPENED_STORAGE_KEY,type BookLocation} from './books';

import {destinationState,type Destination} from './destinations';

type Settings={sound:boolean;motion:boolean;fov:number;sensitivity:number;quality:string};
export type GameStats={floor:number;distance:number;mode:TravelMode;fallSpeed:number};
type Callbacks={onPause:()=>void;onStats:(s:GameStats)=>void;onFallback:()=>void;onError:(s:string)=>void;onTarget:(b:BookLocation|null)=>void;onBook:(b:BookLocation|null)=>void;onPage:(delta:number)=>void;onStorageWarning:()=>void;onTeleportMenu:(open:boolean)=>void;onDestination:(destination:Destination)=>void};
export type GameHandle=ReturnType<typeof createGame>;
export function createGame(host:HTMLDivElement, callbacks:Callbacks) {
  const renderer=new T.WebGLRenderer({antialias:true,logarithmicDepthBuffer:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(host.clientWidth,host.clientHeight);
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
  const canvas=renderer.domElement;host.appendChild(canvas);
  const scene=new T.Scene();scene.background=new T.Color('#202825');scene.fog=null;
  const camera=new T.PerspectiveCamera(75,host.clientWidth/host.clientHeight,.1,16000);camera.rotation.order='YXZ';
  let opened=new Set<string>();
  try{opened=loadOpened(localStorage);}catch{/* Session history still works without storage. */}
  const world=createWorld(scene,opened);
  const highlightGeometry=new T.BoxGeometry(.043,.352,.31);
  const highlightEdges=new T.EdgesGeometry(highlightGeometry);
  const highlightMaterial=new T.LineBasicMaterial({color:'#fff3a8',toneMapped:false});
  const highlight=new T.LineSegments(highlightEdges,highlightMaterial);highlight.visible=false;scene.add(highlight);
  const aimDirection=new T.Vector3();
  let target:BookLocation|null=null,reading:BookLocation|null=null;
  let teleportMenu=false,limits:WorldLimits={};
  function closeTeleport(resume=true){teleportMenu=false;clearKeys();callbacks.onTeleportMenu(false);if(resume&&active)start();}
  function toggleTeleport(){
    if(!active)return;
    if(teleportMenu){closeTeleport();return;}
    closeBook(false);teleportMenu=true;clearKeys();dragId=null;setTarget(null);callbacks.onTeleportMenu(true);
    if(document.pointerLockElement===canvas)document.exitPointerLock();
  }
  function teleport(destination:Destination){
    const next=destinationState(destination);p=next.position;limits=next.limits;yaw=next.yaw;pitch=next.pitch;
    renderer.clippingPlanes=[];
    if(limits.minX!==undefined)renderer.clippingPlanes.push(new T.Plane(new T.Vector3(1,0,0),-limits.minX));
    if(limits.maxX!==undefined)renderer.clippingPlanes.push(new T.Plane(new T.Vector3(-1,0,0),limits.maxX));
    if(limits.minY!==undefined)renderer.clippingPlanes.push(new T.Plane(new T.Vector3(0,1,0),-limits.minY+.36));
    if(limits.maxY!==undefined)renderer.clippingPlanes.push(new T.Plane(new T.Vector3(0,-1,0),limits.maxY+.36));
    world.setLimits(limits);totalDistance=0;mode='walking';fallSpeed=0;stepDistance=0;bob=0;
    closeBook(false);setTarget(null);callbacks.onDestination(destination);emitStats();closeTeleport();
  }
  function setTarget(next:BookLocation|null){
    if((next?bookId(next):null)!==(target?bookId(target):null)){target=next;callbacks.onTarget(next);}
    highlight.visible=!!next;
    if(next){const c=bookCenter(next);highlight.position.set(c.x,c.y,c.z);}
  }
  function openBook(){
    if(!active||reading||teleportMenu||!target)return;
    reading=target;clearKeys();dragId=null;
    opened.add(bookId(reading));world.markOpened(reading);
    try{localStorage.setItem(OPENED_STORAGE_KEY,JSON.stringify([...opened]));}catch{callbacks.onStorageWarning();}
    callbacks.onBook(reading);setTarget(null);
    if(document.pointerLockElement===canvas)document.exitPointerLock();
  }
  function closeBook(resume=true){if(!reading)return;reading=null;clearKeys();callbacks.onBook(null);if(resume&&active)start();}

  let p:Position={x:30,y:0,z:INNER+1.7},yaw=-.88,pitch=-.04,active=false,disposed=false,fallback=false;
  let mode:TravelMode='walking',fallSpeed=0;
  let config:Settings={sound:true,motion:false,fov:75,sensitivity:1,quality:'high'};
  const keys=new Set<string>();let totalDistance=0,lastStats=0,lastTime=performance.now(),frame=0,stepDistance=0,bob=0;
  let audio:AudioContext|undefined,master:GainNode|undefined;
  function soundStart(){
    if(!audio){try{
      audio=new AudioContext();master=audio.createGain();master.gain.value=config.sound?.13:0;master.connect(audio.destination);
      const hum=audio.createOscillator(),gain=audio.createGain();hum.type='sine';hum.frequency.value=58;gain.gain.value=.045;hum.connect(gain);gain.connect(master);hum.start();
      const overtone=audio.createOscillator(),g=audio.createGain();overtone.frequency.value=116;g.gain.value=.014;overtone.connect(g);g.connect(master);overtone.start();
    }catch{ /* Walking works without audio support. */ }}
    void audio?.resume().catch(()=>{});
  }
  function footstep(){if(!audio||!master||!config.sound)return;const size=audio.sampleRate*.13;const b=audio.createBuffer(1,size,audio.sampleRate),a=b.getChannelData(0);for(let i=0;i<size;i++)a[i]=(Math.random()*2-1)*Math.exp(-i/(size*.2));const src=audio.createBufferSource();src.buffer=b;const filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=420;const gain=audio.createGain();gain.gain.value=.25;src.connect(filter);filter.connect(gain);gain.connect(master);src.start();src.onended=()=>{src.disconnect();filter.disconnect();gain.disconnect();};}
  const clearKeys=()=>keys.clear();
  function pause(){active=false;closeTeleport(false);closeBook(false);clearKeys();if(document.pointerLockElement===canvas)document.exitPointerLock();if(master&&audio)master.gain.setTargetAtTime(0,audio.currentTime,.1);callbacks.onPause();}
  function start(){active=true;clearKeys();soundStart();if(master&&audio)master.gain.setTargetAtTime(config.sound?.13:0,audio.currentTime,.1);
    if(!matchMedia('(pointer: coarse)').matches){
      if(!canvas.requestPointerLock){fallback=true;callbacks.onFallback();return;}
      try{const result=canvas.requestPointerLock();if(result&&typeof result.catch==='function')void result.catch(()=>{fallback=true;callbacks.onFallback();});}catch{fallback=true;callbacks.onFallback();}
    }
  }
  const emitStats=()=>callbacks.onStats({floor:Math.round(p.y/HEIGHT),distance:Math.floor(totalDistance),mode,fallSpeed});
  function toggleFlight(){if(reading||teleportMenu)return;mode=mode==='flying'?'falling':'flying';fallSpeed=0;stepDistance=0;emitStats();}
  const keydown=(e:KeyboardEvent)=>{if(!active)return;if(e.code==='KeyT'){e.preventDefault();if(!e.repeat)toggleTeleport();return;}if(teleportMenu){if(e.code==='Escape'){e.preventDefault();closeTeleport();}return;}if(reading){if(['ArrowLeft','ArrowRight','Escape','Space','KeyW','KeyA','KeyS','KeyD'].includes(e.code))e.preventDefault();if(e.code==='ArrowRight')callbacks.onPage(1);else if(e.code==='ArrowLeft')callbacks.onPage(-1);else if(e.code==='Escape')closeBook();return;}if(e.code==='Escape'){pause();return;}if(e.code==='Space'){e.preventDefault();if(!e.repeat)toggleFlight();return;}if(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code)){e.preventDefault();keys.add(e.code);}};
  const keyup=(e:KeyboardEvent)=>{keys.delete(e.code);};
  function look(dx:number,dy:number){yaw-=dx*.0018*config.sensitivity;pitch=T.MathUtils.clamp(pitch-dy*.0018*config.sensitivity,-1.48,1.48);}
  const mousemove=(e:MouseEvent)=>{if(active&&!reading&&!teleportMenu&&document.pointerLockElement===canvas)look(e.movementX,e.movementY);};
  let dragId:number|null=null,dragX=0,dragY=0,dragDistance=0;
  const pointerdown=(e:PointerEvent)=>{if(!active||reading||teleportMenu||e.button!==0)return;if(document.pointerLockElement===canvas){openBook();return;}if(!fallback&&e.pointerType==='mouse')return;dragDistance=0;dragId=e.pointerId;dragX=e.clientX;dragY=e.clientY;canvas.setPointerCapture(e.pointerId);};
  const pointermove=(e:PointerEvent)=>{if(active&&!reading&&!teleportMenu&&dragId===e.pointerId){dragDistance+=Math.hypot(e.clientX-dragX,e.clientY-dragY);look(e.clientX-dragX,e.clientY-dragY);dragX=e.clientX;dragY=e.clientY;}};
  const pointerup=(e:PointerEvent)=>{const tap=dragId===e.pointerId&&dragDistance<5;dragId=null;if(e.type==='pointerup'&&tap)openBook();};
  const rightClick=(e:MouseEvent)=>{if(active&&reading&&e.button===2){e.preventDefault();closeBook();}};
  const contextmenu=(e:Event)=>{if(active)e.preventDefault();};
  const lockchange=()=>{if(!document.pointerLockElement&&!fallback&&active&&!reading&&!teleportMenu)pause();};
  const lockerror=()=>{fallback=true;callbacks.onFallback();};
  const visibility=()=>{if(document.hidden)pause();};
  const lost=(e:Event)=>{e.preventDefault();pause();callbacks.onError('Graphics were interrupted. Refresh the page to return to the library.');};
  const resize=()=>{camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight);};
  const events:[EventTarget,string,EventListener][]=[
    [window,'mousedown',rightClick as EventListener],[window,'contextmenu',contextmenu],
    [window,'keydown',keydown as EventListener],[window,'keyup',keyup as EventListener],[window,'blur',pause],
    [document,'mousemove',mousemove as EventListener],[document,'pointerlockchange',lockchange],[document,'pointerlockerror',lockerror],[document,'visibilitychange',visibility],
    [canvas,'pointerdown',pointerdown as EventListener],[canvas,'pointermove',pointermove as EventListener],[canvas,'pointerup',pointerup as EventListener],[canvas,'pointercancel',pointerup as EventListener],[canvas,'webglcontextlost',lost],
  ];events.forEach(([target,name,listener])=>target.addEventListener(name,listener));
  const observer=new ResizeObserver(resize);observer.observe(host);
  function animate(now:number){
    if(disposed)return;frame=requestAnimationFrame(animate);const dt=Math.min((now-lastTime)/1000,.05);lastTime=now;
    if(reading||teleportMenu)return; // The reader freezes the world; no hidden scene renders are needed.
    if(active&&!reading){
      if(keys.has('ArrowLeft'))yaw+=dt*1.4;if(keys.has('ArrowRight'))yaw-=dt*1.4;if(keys.has('ArrowUp'))pitch=Math.min(1.48,pitch+dt);if(keys.has('ArrowDown'))pitch=Math.max(-1.48,pitch-dt);
      let forward=Number(keys.has('KeyW'))-Number(keys.has('KeyS')),right=Number(keys.has('KeyD'))-Number(keys.has('KeyA'));
      const norm=Math.hypot(forward,right);
      const previous=p;
      const fast=keys.has('ShiftLeft')||keys.has('ShiftRight');
      if(mode==='flying') {
        const direction=flightVector(yaw,pitch,forward,right),speed=fast?24:8;
        p=flyMove(p,direction.x*speed*dt,direction.y*speed*dt,direction.z*speed*dt,limits);
      } else if(mode==='falling') {
        if(norm){const direction=flightVector(yaw,0,forward,right);p=flyMove(p,direction.x*2.4*dt,0,direction.z*2.4*dt,limits);}
        const result=fallStep(p,fallSpeed,dt,limits);p=result.position;fallSpeed=result.speed;
        if(result.landed){mode='walking';stepDistance=0;emitStats();}
      } else if(norm) {
        forward/=norm;right/=norm;const speed=fast?3.4:1.7;
        p=move(p,(-Math.sin(yaw)*forward+Math.cos(yaw)*right)*speed*dt,(-Math.cos(yaw)*forward-Math.sin(yaw)*right)*speed*dt,limits);
        const distance=Math.hypot(p.x-previous.x,p.y-previous.y,p.z-previous.z);
        stepDistance+=distance;bob+=distance*8;if(stepDistance>.78){footstep();stepDistance=0;}
      }
      totalDistance+=Math.hypot(p.x-previous.x,p.y-previous.y,p.z-previous.z);
    }
    camera.position.set(p.x,p.y+EYE+(config.motion&&active&&mode==='walking'?Math.sin(bob)*.018:0),p.z);camera.rotation.set(pitch,yaw,0,'YXZ');
    world.update(p.x,p.y,camera);
    if(active&&!reading){camera.getWorldDirection(aimDirection);const candidate=pickBook(camera.position,aimDirection,Math.round(p.y/HEIGHT));const x=candidate?bookCenter(candidate).x:0;setTarget(candidate&&x>=(limits.minX??-Infinity)&&x<=(limits.maxX??Infinity)?candidate:null);}else setTarget(null);
    renderer.render(scene,camera);
    if(now-lastStats>300){lastStats=now;emitStats();}
  }
  frame=requestAnimationFrame(animate);
  const lifecycle=new AbortController();
  const handle = {
    start,pause,toggleFlight,openBook,closeBook,toggleTeleport,teleport,closeTeleport,
    reset(){teleport('arrival');},
    touchMove(direction:string,pressed:boolean){const code=({forward:'KeyW',back:'KeyS',left:'KeyA',right:'KeyD'} as Record<string,string>)[direction];if(pressed)keys.add(code);else keys.delete(code);},
    configure(next:Settings){config=next;camera.fov=next.fov;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,next.quality==='low'?1:1.7));renderer.setSize(host.clientWidth,host.clientHeight);if(master&&audio)master.gain.setTargetAtTime(next.sound&&active?.13:0,audio.currentTime,.1);},
    dispose(){lifecycle.abort();disposed=true;cancelAnimationFrame(frame);observer.disconnect();events.forEach(([target,name,listener])=>target.removeEventListener(name,listener));if(document.pointerLockElement===canvas)document.exitPointerLock();void audio?.close();world.dispose();highlightGeometry.dispose();highlightEdges.dispose();highlightMaterial.dispose();renderer.dispose();canvas.remove();},
  };
  type ModelContext={registerTool:(tool:{name:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean};execute:(input:unknown)=>unknown},options:{signal:AbortSignal})=>void|Promise<void>};
  const context=(document as Document & {modelContext?:ModelContext}).modelContext;
  if(context?.registerTool){
    const state=()=>({floor:Math.round(p.y/HEIGHT),distance:Math.floor(totalDistance),walking:active&&mode==='walking',mode,fallSpeed});
    const tools=[
      {name:'read_walk_state',description:'Read the current relative library floor, walked distance, and pause state.',readOnly:true,action:state},
      {name:'pause_walk',description:'Pause the library walk and release mouse capture.',readOnly:false,action:()=>{pause();return state();}},
      {name:'reset_walk',description:'Return the walker to the arrival point, as with the visible Return to starting point control.',readOnly:false,action:()=>{handle.reset();return state();}},
    ];
    for(const tool of tools){try{void Promise.resolve(context.registerTool({name:tool.name,description:tool.description,inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:tool.readOnly},execute(input){if(typeof input!=='object'||input===null||Array.isArray(input)||Object.keys(input).length)throw new Error('This action expects an empty object.');return tool.action();}},{signal:lifecycle.signal})).catch(()=>{});}catch{/* Optional browser capability. */}}
  }
  return handle;
}

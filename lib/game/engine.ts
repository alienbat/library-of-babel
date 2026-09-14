// oxlint-disable-next-line import/default
import shelfModule from '../../models/blender/shelves/ShelfModule.glb?url';
// oxlint-disable-next-line import/default
import shelfStart from '../../models/blender/shelves/ShelfModuleStart.glb?url';
// oxlint-disable-next-line import/default
import shelfBook from '../../models/blender/shelves/ShelfBook.glb?url';
import {clearAppStorage} from './preferences';
// oxlint-disable-next-line import/default
import light from '../../models/blender/ceiling-light/ceiling-light.glb?url';
// oxlint-disable-next-line import/default
import board from '../../models/blender/shelves/ShelfBoard.glb?url';
// oxlint-disable-next-line import/default
import upright from '../../models/blender/shelves/ShelfUpright.glb?url';
// oxlint-disable-next-line import/default
import returns from '../../models/blender/library-furnishings/Return.glb?url';
// oxlint-disable-next-line import/default
import bbq from '../../models/blender/library-furnishings/BBQ.glb?url';
import {clearLocationStorage} from './location-store';
import {readJourney,newJourneySeed,JOURNEY_STORAGE,libraryTime,bigCount,type Journey,type WalkDirection} from './journey';
import {type Bookmark} from './bookmarks';
import {coarseNavigation,type NavigationAnchor,type NavigationHint} from './search';
import * as T from 'three';
// oxlint-disable-next-line import/default -- Vite generates the URL export for worker queries.
import bookWorkerUrl from './book-worker?worker&url';
// oxlint-disable-next-line import/default -- Vite generates the bundled asset URL.
import bedAssetUrl from '../../models/blender/bed/bed.glb?url';
// oxlint-disable-next-line import/default -- Vite emits the static model asset.
import bathroomAssetUrl from '../../models/blender/bathroom/bathroom.glb?url';
import { createWorld } from './world';
import { EYE, HEIGHT, INNER,BAY,PERIOD, move, flightVector, flyMove, fallStep, brakeFallStep, type Position, type TravelMode,type WorldLimits } from './physics';

import {bookId,localBookId,openedChanges,bookSlot,bookCenter,pickBook,loadOpened,type BookLocation} from './books';

import {createBookClient} from './book-client';
import {newFrame,shiftFrame,frameLimits,type GlobalFrame} from './global-books';
import {destinationState,type Destination} from './destinations';

type Settings={showYearsLater:boolean;cheat:boolean;sound:boolean;motion:boolean;fov:number;sensitivity:number;quality:string};
export type GameStats={navigation?:NavigationHint|null;floor:string;distance:string;libraryClock?:string;libraryDays?:string;savedAt?:number;mode:TravelMode;fallSpeed:number};
type Callbacks={onWalkComplete?:(years:string)=>void;onDebugMenu:(open:boolean)=>void;onBookmarks:(records:Bookmark[])=>void;onPause:()=>void;onStats:(s:GameStats)=>void;onFallback:()=>void;onError:(s:string)=>void;onTarget:(b:BookLocation|null)=>void;onBook:(b:BookLocation|null)=>void;onPage:(delta:number)=>void;onStorageWarning:()=>void;onGameMenu:(open:boolean)=>void;onDestination:(destination:Destination)=>void};
export type GameHandle=ReturnType<typeof createGame>;
export function createGame(host:HTMLDivElement, callbacks:Callbacks) {
  let renderer:T.WebGLRenderer;
  try{renderer=new T.WebGLRenderer({antialias:true,logarithmicDepthBuffer:true,powerPreference:'high-performance'});}
  catch(error){throw new Error(`WebGL initialization failed: ${error instanceof Error?error.message:String(error)}. Check that hardware acceleration is enabled.`);}
  renderer.setPixelRatio(window.devicePixelRatio||1);renderer.setSize(host.clientWidth,host.clientHeight);
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
  const canvas=renderer.domElement;host.appendChild(canvas);
  const scene=new T.Scene();scene.background=new T.Color('#202825');scene.fog=null;
  const camera=new T.PerspectiveCamera(75,host.clientWidth/host.clientHeight,.1,16000);camera.rotation.order='YXZ';
  let opened=new Set<string>();
  try{opened=loadOpened(localStorage);}catch{/* Session history still works without storage. */}
  const world=createWorld(scene,opened,bedAssetUrl,bathroomAssetUrl,{board,upright,returns,bbq,light,module:shelfModule,start:shelfStart,book:shelfBook});
  let restored:Journey|null=null;
  try{restored=readJourney(localStorage);}catch{callbacks.onStorageWarning();}
  const journeySeed=restored?.journeySeed??restored?.frame.originSeed??newJourneySeed();
  let globalFrame:GlobalFrame=restored?.frame??{...newFrame(),originSeed:journeySeed};
  let navigationAnchor:NavigationAnchor|null=null;
  const books=createBookClient(ids=>{const next=new Set(ids),changes=openedChanges(opened,next);opened.clear();next.forEach(id=>opened.add(id));for(const change of changes)world.markOpened(change.location,change.opened);},callbacks.onStorageWarning,bookWorkerUrl,anchor=>{navigationAnchor=anchor;emitStats();},callbacks.onBookmarks);
  const highlightGeometry=new T.BoxGeometry(.043,.352,.31);
  const highlightEdges=new T.EdgesGeometry(highlightGeometry);
  const highlightMaterial=new T.LineBasicMaterial({color:'#fff3a8',toneMapped:false});
  const highlight=new T.LineSegments(highlightEdges,highlightMaterial);highlight.visible=false;scene.add(highlight);
  const aimDirection=new T.Vector3();
  let target:BookLocation|null=null,reading:BookLocation|null=null;
  let gameMenu=false,menuKind:'game'|'debug'='game',walkBusy=false,limits:WorldLimits=restored?.limits??frameLimits(globalFrame);
  function closeMenu(resume=true){if(walkBusy&&resume)return;gameMenu=false;callbacks.onDebugMenu(false);clearKeys();callbacks.onGameMenu(false);if(resume&&active)start();}
  function toggleMenu(kind:'game'|'debug'='game'){
    if(!active||walkBusy||(kind==='debug'&&!config.cheat))return;
    if(gameMenu&&menuKind===kind){closeMenu();return;}
    closeBook(false);gameMenu=true;menuKind=kind;clearKeys();dragId=null;setTarget(null);callbacks.onGameMenu(kind==='game');callbacks.onDebugMenu(kind==='debug');
    if(document.pointerLockElement===canvas)document.exitPointerLock();
  }
  function teleport(destination:Destination){
    if(walkBusy)return;
    globalFrame=destination==='arrival'?{...newFrame(),originSeed:journeySeed}:newFrame(destination);books.setFrame(globalFrame);
    const next=destinationState(destination);p=next.position;limits=next.limits;yaw=next.yaw;pitch=next.pitch;
    applyLimits();takeoffTime=0;mode='walking';fallSpeed=0;stepDistance=0;bob=0;
    closeBook(false);setTarget(null);callbacks.onDestination(destination);emitStats();closeMenu();
  }
  function applyLimits(){
    renderer.clippingPlanes=[];
    if(limits.minX!==undefined)renderer.clippingPlanes.push(new T.Plane(new T.Vector3(1,0,0),-limits.minX));
    if(limits.maxX!==undefined)renderer.clippingPlanes.push(new T.Plane(new T.Vector3(-1,0,0),limits.maxX));
    if(limits.minY!==undefined)renderer.clippingPlanes.push(new T.Plane(new T.Vector3(0,1,0),-limits.minY+.36));
    if(limits.maxY!==undefined)renderer.clippingPlanes.push(new T.Plane(new T.Vector3(0,-1,0),limits.maxY+.36));
    world.setLimits(limits);
  }
  function rebase(){
    const sx=Math.abs(p.x)>PERIOD*16?Math.trunc(p.x/PERIOD)*12:0;
    const sy=Math.abs(p.y)>HEIGHT*512?Math.trunc(p.y/HEIGHT):0;
    if(!sx&&!sy)return;
    const dx=sx*BAY,dy=sy*HEIGHT;p={...p,x:p.x-dx,y:p.y-dy};
    globalFrame=shiftFrame(globalFrame,sx,sy);
    for(const key of ['minX','maxX','minY','maxY'] as const)if(limits[key]!==undefined)limits[key]-=key.endsWith('X')?dx:dy;
    books.setFrame(globalFrame);applyLimits();setTarget(null);
  }
  function setTarget(next:BookLocation|null){
    if((next?bookId(next):null)!==(target?bookId(target):null)){target=next;callbacks.onTarget(next);}
    highlight.visible=!!next;
    if(next){const c=bookCenter(next);highlight.position.set(c.x,c.y,c.z);highlight.scale.x=(bookSlot(next.book).width+.004)/.043;}
  }
  function openBook(){
    if(!active||reading||gameMenu||!target)return;
    reading=target;clearKeys();dragId=null;
    opened.add(localBookId(reading));world.markOpened(reading);
    callbacks.onBook(reading);setTarget(null);
    if(document.pointerLockElement===canvas)document.exitPointerLock();
  }
  function closeBook(resume=true){if(!reading)return;reading=null;clearKeys();callbacks.onBook(null);if(resume&&active)start();}

  let p:Position=restored?.position??{x:30,y:0,z:INNER+1.7},yaw=restored?.yaw??-.88,pitch=restored?.pitch??-.04,active=false,disposed=false,fallback=false;
  let takeoffTime=0;
  let mode:TravelMode=restored?.mode??'walking',fallSpeed=restored?.fallSpeed??0;
  let distanceMm=BigInt(restored?.distanceMm??'0'),distanceRemainder=0,artificialMs=restored?.artificialMs??'0',startedAt=restored?.startedAt??0,savedAt=restored?.savedAt??0;
  let config:Settings={showYearsLater:true,cheat:false,sound:true,motion:false,fov:75,sensitivity:1,quality:'low'};
  const keys=new Set<string>();let lastStats=0,lastTime=performance.now(),frame=0,stepDistance=0,bob=0;
  let audio:AudioContext|undefined,master:GainNode|undefined,windGain:GainNode|undefined,windFilter:BiquadFilterNode|undefined,stepBuffer:AudioBuffer|undefined;
  function soundStart(){
    if(!audio){try{
      audio=new AudioContext();master=audio.createGain();master.gain.value=config.sound?.13:0;master.connect(audio.destination);
      const noise=audio.createBuffer(1,audio.sampleRate*2,audio.sampleRate),samples=noise.getChannelData(0);
      for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
      stepBuffer=noise;
      const wind=audio.createBufferSource();wind.buffer=noise;wind.loop=true;
      windFilter=audio.createBiquadFilter();windFilter.type='lowpass';windFilter.frequency.value=200;
      windGain=audio.createGain();windGain.gain.value=0;
      wind.connect(windFilter);windFilter.connect(windGain);windGain.connect(master);wind.start();
      const hum=audio.createOscillator(),gain=audio.createGain();hum.type='sine';hum.frequency.value=58;gain.gain.value=.045;hum.connect(gain);gain.connect(master);hum.start();
      const overtone=audio.createOscillator(),g=audio.createGain();overtone.frequency.value=116;g.gain.value=.014;overtone.connect(g);g.connect(master);overtone.start();
    }catch{ /* Walking works without audio support. */ }}
    void audio?.resume().catch(()=>{});
  }
  function windSound(speed:number){if(!audio||!windGain||!windFilter)return;const strength=Math.min(1,Math.max(0,speed)/53.6448);windGain.gain.setTargetAtTime(strength*strength*1.5,audio.currentTime,.12);windFilter.frequency.setTargetAtTime(180+strength*2200,audio.currentTime,.12);}
  function footstep(running:boolean){
    if(!audio||!master||!stepBuffer||!config.sound)return;
    const now=audio.currentTime,duration=running?.16:.13,src=audio.createBufferSource();src.buffer=stepBuffer;
    const filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=running?850:550;
    const gain=audio.createGain();gain.gain.setValueAtTime(.001,now);gain.gain.linearRampToValueAtTime(running?1.4:1,now+.008);gain.gain.exponentialRampToValueAtTime(.001,now+duration);
    src.connect(filter);filter.connect(gain);gain.connect(master);src.start(now,Math.random(),duration);
    const heel=audio.createOscillator(),thud=audio.createGain();heel.frequency.setValueAtTime(running?130:105,now);heel.frequency.exponentialRampToValueAtTime(45,now+.09);thud.gain.setValueAtTime(running?.55:.35,now);thud.gain.exponentialRampToValueAtTime(.001,now+.12);heel.connect(thud);thud.connect(master);heel.start(now);heel.stop(now+.13);
    src.onended=()=>{src.disconnect();filter.disconnect();gain.disconnect();};heel.onended=()=>{heel.disconnect();thud.disconnect();};
  }
  const clearKeys=()=>keys.clear();
  function pause(){active=false;closeMenu(false);closeBook(false);clearKeys();if(document.pointerLockElement===canvas)document.exitPointerLock();if(master&&audio)master.gain.setTargetAtTime(0,audio.currentTime,.1);callbacks.onPause();}
  function start(){if(!startedAt){startedAt=Date.now();try{saveProgress();}catch{callbacks.onStorageWarning();}}active=true;clearKeys();soundStart();if(master&&audio)master.gain.setTargetAtTime(config.sound?.13:0,audio.currentTime,.1);
    if(!matchMedia('(pointer: coarse)').matches){
      if(!canvas.requestPointerLock){fallback=true;callbacks.onFallback();return;}
      try{const result=canvas.requestPointerLock();if(result&&typeof result.catch==='function')void result.catch(()=>{fallback=true;callbacks.onFallback();});}catch{fallback=true;callbacks.onFallback();}
    }
  }
  function saveProgress(){
    if(!startedAt)throw new Error('Enter the library before saving.');
    const snapshot:Journey={version:1,journeySeed,frame:{...globalFrame},limits:{...limits},position:{...p},yaw,pitch,mode,fallSpeed,distanceMm:distanceMm.toString(),artificialMs,startedAt,savedAt:Date.now()};
    localStorage.setItem(JOURNEY_STORAGE,JSON.stringify(snapshot));savedAt=snapshot.savedAt;emitStats();return savedAt;
  }
  function emitStats(){const time=libraryTime(startedAt||Date.now(),artificialMs);callbacks.onStats({navigation:navigationAnchor?coarseNavigation(navigationAnchor,p,yaw,pitch):null,floor:bigCount(BigInt(Math.round(p.y/HEIGHT))+BigInt(globalFrame.floorOffset)),distance:bigCount(distanceMm/1000n),libraryClock:time.clock,libraryDays:time.days,savedAt,mode,fallSpeed});}
  async function timedWalk(direction:WalkDirection,years:string){
    if(walkBusy)throw new Error('A walk is already in progress.');walkBusy=true;clearKeys();
    let completedYears:string|undefined;
    const curtain=document.createElement('dialog');
    curtain.className='walk-curtain';curtain.setAttribute('aria-label','Walking through the library');
    curtain.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:black;opacity:0;outline:none';
    curtain.addEventListener('cancel',e=>e.preventDefault());document.body.appendChild(curtain);curtain.showModal();
    try{
      await curtain.animate([{opacity:0},{opacity:1}],{duration:750,fill:'forwards'}).finished;
      const result=await books.walk(p,direction,years);if(disposed)throw new Error('Game closed.');
      globalFrame=result.frame;p=result.position;limits=result.limits;books.setFrame(globalFrame);applyLimits();
      distanceMm+=BigInt(result.distanceCm)*10n;artificialMs=(BigInt(artificialMs)+BigInt(result.elapsedMs)).toString();takeoffTime=0;mode='walking';fallSpeed=0;stepDistance=0;bob=0;setTarget(null);emitStats();
      try{saveProgress();}catch{callbacks.onStorageWarning();}
      closeMenu(false);
      completedYears=(BigInt(result.elapsedMs)/31_536_000_000n).toLocaleString('en-US');
      return result;
    }finally{
      await curtain.animate([{opacity:1},{opacity:0}],{duration:750,fill:'forwards'}).finished.catch(()=>{});
      curtain.close();curtain.remove();walkBusy=false;
      if(!disposed&&active&&!gameMenu)start();
      if(!disposed&&config.showYearsLater&&completedYears!==undefined)callbacks.onWalkComplete?.(completedYears);
    }
  }
  async function teleportToTarget(){
    if(walkBusy)throw new Error('A journey action is already in progress.');
    if(!navigationAnchor)throw new Error('Track a book first.');
    walkBusy=true;clearKeys();
    try{
      const result=await books.targetLanding();if(disposed)throw new Error('Game closed.');
      globalFrame=result.frame;p=result.position;limits=result.limits;
      yaw=result.side===1?Math.PI:0;pitch=Math.atan2(.30+result.row*.39-EYE,1.12);
      takeoffTime=0;mode='walking';fallSpeed=0;stepDistance=0;bob=0;setTarget(null);
      books.setFrame(globalFrame);applyLimits();emitStats();
      try{saveProgress();}catch{callbacks.onStorageWarning();}
    }finally{walkBusy=false;}
    closeMenu();
  }
  function toggleFlight(){if(reading||gameMenu)return;if(mode==='flying'){mode='falling';takeoffTime=0;}else{if(mode==='walking'){takeoffTime=.5;fallSpeed=0;}mode='flying';}stepDistance=0;emitStats();}
  const keydown=(e:KeyboardEvent)=>{if(!active||walkBusy)return;if(e.code==='KeyM'&&!reading&&!(e.target instanceof HTMLElement&&e.target.closest('input,textarea,select,[contenteditable]'))){e.preventDefault();if(!e.repeat)pause();return;}if(e.code==='Backquote'&&config.cheat){e.preventDefault();if(!e.repeat)toggleMenu('debug');return;}if(e.code==='KeyT'){e.preventDefault();if(!e.repeat)toggleMenu();return;}if(gameMenu){if(e.code==='Escape'){e.preventDefault();closeMenu();}return;}if(reading){if(['ArrowLeft','ArrowRight','Escape','Space','KeyW','KeyA','KeyS','KeyD'].includes(e.code))e.preventDefault();if(e.code==='ArrowRight')callbacks.onPage(1);else if(e.code==='ArrowLeft')callbacks.onPage(-1);else if(e.code==='Escape')closeBook();return;}if(e.code==='Escape'){pause();return;}if(e.code==='Space'){e.preventDefault();if(!e.repeat)toggleFlight();return;}if(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code)){e.preventDefault();keys.add(e.code);}};
  const keyup=(e:KeyboardEvent)=>{keys.delete(e.code);};
  function look(dx:number,dy:number){yaw-=dx*.0018*config.sensitivity;pitch=T.MathUtils.clamp(pitch-dy*.0018*config.sensitivity,-1.48,1.48);}
  const mousemove=(e:MouseEvent)=>{if(active&&!reading&&!gameMenu&&document.pointerLockElement===canvas)look(e.movementX,e.movementY);};
  let dragId:number|null=null,dragX=0,dragY=0,dragDistance=0;
  const pointerdown=(e:PointerEvent)=>{if(!active||reading||gameMenu||e.button!==0)return;if(document.pointerLockElement===canvas){openBook();return;}if(!fallback&&e.pointerType==='mouse')return;dragDistance=0;dragId=e.pointerId;dragX=e.clientX;dragY=e.clientY;canvas.setPointerCapture(e.pointerId);};
  const pointermove=(e:PointerEvent)=>{if(active&&!reading&&!gameMenu&&dragId===e.pointerId){dragDistance+=Math.hypot(e.clientX-dragX,e.clientY-dragY);look(e.clientX-dragX,e.clientY-dragY);dragX=e.clientX;dragY=e.clientY;}};
  const pointerup=(e:PointerEvent)=>{const tap=dragId===e.pointerId&&dragDistance<5;dragId=null;if(e.type==='pointerup'&&tap)openBook();};
  const rightClick=(e:MouseEvent)=>{if(active&&reading&&e.button===2){e.preventDefault();closeBook();}};
  const contextmenu=(e:Event)=>{if(active)e.preventDefault();};
  const lockchange=()=>{if(!document.pointerLockElement&&!fallback&&active&&!reading&&!gameMenu)pause();};
  const lockerror=()=>{fallback=true;callbacks.onFallback();};
  // Dialogs already freeze the world. Native file pickers may blur or hide the
  // browser; preserve the open dialog so selecting or cancelling keeps its state.
  const focusLost=()=>{clearKeys();dragId=null;if(gameMenu||reading){windSound(0);return;}pause();};
  const visibility=()=>{if(document.hidden)focusLost();};
  const lost=(e:Event)=>{e.preventDefault();pause();callbacks.onError('Graphics were interrupted. Refresh the page to return to the library.');};
  const resize=()=>{renderer.setPixelRatio(window.devicePixelRatio||1);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight);};
  const events:[EventTarget,string,EventListener][]=[
    [window,'mousedown',rightClick as EventListener],[window,'contextmenu',contextmenu],
    [window,'keydown',keydown as EventListener],[window,'keyup',keyup as EventListener],[window,'blur',focusLost],
    [document,'mousemove',mousemove as EventListener],[document,'pointerlockchange',lockchange],[document,'pointerlockerror',lockerror],[document,'visibilitychange',visibility],
    [canvas,'pointerdown',pointerdown as EventListener],[canvas,'pointermove',pointermove as EventListener],[canvas,'pointerup',pointerup as EventListener],[canvas,'pointercancel',pointerup as EventListener],[canvas,'webglcontextlost',lost],
  ];events.forEach(([target,name,listener])=>target.addEventListener(name,listener));
  const observer=new ResizeObserver(resize);observer.observe(host);
  function animate(now:number){
    if(disposed)return;frame=requestAnimationFrame(animate);const dt=Math.min((now-lastTime)/1000,.05);lastTime=now;
    if(renderer.getPixelRatio()!==(window.devicePixelRatio||1))resize();
    if(reading||gameMenu){windSound(0);return;} // The reader freezes the world; no hidden scene renders are needed.
    if(active&&!reading&&!walkBusy){
      if(keys.has('ArrowLeft'))yaw+=dt*1.4;if(keys.has('ArrowRight'))yaw-=dt*1.4;if(keys.has('ArrowUp'))pitch=Math.min(1.48,pitch+dt);if(keys.has('ArrowDown'))pitch=Math.max(-1.48,pitch-dt);
      let forward=Number(keys.has('KeyW'))-Number(keys.has('KeyS')),right=Number(keys.has('KeyD'))-Number(keys.has('KeyA'));
      const norm=Math.hypot(forward,right);
      const previous=p;
      const fast=keys.has('ShiftLeft')||keys.has('ShiftRight');
      if(mode==='flying') {
        const direction=flightVector(yaw,pitch,forward,right),speed=fast?24:8;
        if(takeoffTime>0){const before=takeoffTime;takeoffTime=Math.max(0,takeoffTime-dt);const height=(t:number)=>.3*(1-Math.cos(Math.PI*(1-t/.5)))/2;p=flyMove(p,0,height(takeoffTime)-height(before),0,limits);}
        p=flyMove(p,direction.x*speed*dt,fallSpeed>0?0:direction.y*speed*dt,direction.z*speed*dt,limits);
        if(fallSpeed>0){const result=brakeFallStep(p,fallSpeed,dt,limits);p=result.position;fallSpeed=result.speed;}
      } else if(mode==='falling') {
        if(norm){const direction=flightVector(yaw,0,forward,right);p=flyMove(p,direction.x*2.4*dt,0,direction.z*2.4*dt,limits);}
        const result=fallStep(p,fallSpeed,dt,limits);p=result.position;fallSpeed=result.speed;
        if(result.landed){mode='walking';stepDistance=0;emitStats();}
      } else if(norm) {
        forward/=norm;right/=norm;const speed=fast?3.4:1.7;
        p=move(p,(-Math.sin(yaw)*forward+Math.cos(yaw)*right)*speed*dt,(-Math.cos(yaw)*forward-Math.sin(yaw)*right)*speed*dt,limits);
        const distance=Math.hypot(p.x-previous.x,p.y-previous.y,p.z-previous.z);
        stepDistance+=distance;bob+=distance*8;if(stepDistance>(fast?1.05:.78)){footstep(fast);stepDistance=0;}
      }
      distanceRemainder+=Math.hypot(p.x-previous.x,p.y-previous.y,p.z-previous.z)*1000;
      const whole=Math.floor(distanceRemainder);distanceMm+=BigInt(whole);distanceRemainder-=whole;
    }
    windSound(active?fallSpeed:0);
    rebase();
    camera.position.set(p.x,p.y+EYE+(config.motion&&active&&mode==='walking'?Math.sin(bob)*.018:0),p.z);camera.rotation.set(pitch,yaw,0,'YXZ');
    world.update(p.x,p.y,camera);
    if(active&&!reading){camera.getWorldDirection(aimDirection);const candidate=pickBook(camera.position,aimDirection,Math.round(p.y/HEIGHT));if(candidate)candidate.frame={...globalFrame};const x=candidate?bookCenter(candidate).x:0;setTarget(candidate&&x>=(limits.minX??-Infinity)&&x<=(limits.maxX??Infinity)?candidate:null);}else setTarget(null);
    renderer.render(scene,camera);
    if(now-lastStats>300){lastStats=now;emitStats();}
  }
  books.setFrame(globalFrame);applyLimits();callbacks.onDestination(globalFrame.destination);emitStats();
  if(globalFrame.originExact!==undefined){const original=globalFrame;void books.referenceFrame(original).then(next=>{if(disposed||globalFrame.originExact!==original.originExact)return;globalFrame={...next,floorOffset:globalFrame.floorOffset,sectionOffset:globalFrame.sectionOffset};books.setFrame(globalFrame);try{saveProgress();}catch{callbacks.onStorageWarning();}}).catch(()=>callbacks.onStorageWarning());}
  const autoSave=()=>{if(startedAt)try{saveProgress();}catch{callbacks.onStorageWarning();}};
  const saveTimer=setInterval(autoSave,300000),timeTimer=setInterval(emitStats,1000);
  window.addEventListener('pagehide',autoSave);
  frame=requestAnimationFrame(animate);
  const lifecycle=new AbortController();
  const handle = {saveProgress,timedWalk,teleportToTarget,
    getBookmark:(book:BookLocation)=>books.getBookmark(book),saveBookmark:(book:BookLocation,name:string,page:number)=>books.saveBookmark(book,name,page),deleteBookmark:(book:BookLocation)=>books.deleteBookmark(book),trackBookmark:(id:string)=>books.trackBookmark(id),
    uploadBook:(text:string)=>books.uploadBook(text),searchBooks:(prefix:string)=>books.search(prefix),clearSearch:()=>books.clearTarget(),
    start,pause,toggleFlight,openBook,closeBook,toggleMenu,teleport,closeMenu,readPage:(book:BookLocation,page:number)=>books.page(book,page),readBook:(book:BookLocation)=>books.raw(book),
    reset(){teleport('arrival');},
    async startOver(){
      // Stop all writers before clearing progress, preferences, and legacy keys.
      handle.dispose(false);
      clearAppStorage(localStorage);
      await clearLocationStorage();
      window.location.reload();
    },
    touchMove(direction:string,pressed:boolean){const code=({forward:'KeyW',back:'KeyS',left:'KeyA',right:'KeyD'} as Record<string,string>)[direction];if(pressed)keys.add(code);else keys.delete(code);},
    configure(next:Settings){config=next;if(!next.cheat&&gameMenu&&menuKind==='debug')closeMenu();world.setDetail(next.quality);camera.fov=next.fov;camera.updateProjectionMatrix();renderer.setPixelRatio(window.devicePixelRatio||1);renderer.setSize(host.clientWidth,host.clientHeight);if(master&&audio)master.gain.setTargetAtTime(next.sound&&active?.13:0,audio.currentTime,.1);},
    dispose(save=true){if(disposed)return;if(save)autoSave();clearInterval(saveTimer);clearInterval(timeTimer);window.removeEventListener('pagehide',autoSave);books.dispose();lifecycle.abort();disposed=true;cancelAnimationFrame(frame);observer.disconnect();events.forEach(([target,name,listener])=>target.removeEventListener(name,listener));if(document.pointerLockElement===canvas)document.exitPointerLock();void audio?.close();world.dispose();highlightGeometry.dispose();highlightEdges.dispose();highlightMaterial.dispose();renderer.dispose();canvas.remove();},
  };
  type ModelContext={registerTool:(tool:{name:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean};execute:(input:unknown)=>unknown},options:{signal:AbortSignal})=>void|Promise<void>};
  const context=(document as Document & {modelContext?:ModelContext}).modelContext;
  if(context?.registerTool){
    const state=()=>({position:{...p},frame:{...globalFrame},startedAt,artificialMs,distanceMm:distanceMm.toString(),savedAt,floor:(BigInt(Math.round(p.y/HEIGHT))+BigInt(globalFrame.floorOffset)).toString(),distance:(distanceMm/1000n).toString(),walking:active&&mode==='walking',mode,fallSpeed});
    const tools=[
      {name:'read_walk_state',description:'Read the current relative library floor, walked distance, and pause state.',readOnly:true,action:state},
      {name:'pause_walk',description:'Pause the library walk and release mouse capture.',readOnly:false,action:()=>{pause();return state();}},
      {name:'reset_walk',description:'Return the walker to the arrival point, as with the visible Return to starting point control.',readOnly:false,action:()=>{handle.reset();return state();}},
    ];
    for(const tool of tools){try{void Promise.resolve(context.registerTool({name:tool.name,description:tool.description,inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:tool.readOnly},execute(input){if(typeof input!=='object'||input===null||Array.isArray(input)||Object.keys(input).length)throw new Error('This action expects an empty object.');return tool.action();}},{signal:lifecycle.signal})).catch(()=>{});}catch{/* Optional browser capability. */}}
  }
  return handle;
}

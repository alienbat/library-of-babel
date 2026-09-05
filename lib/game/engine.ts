import * as T from 'three';
import { createWorld } from './world';
import { EYE, HEIGHT, INNER, move, type Position } from './physics';

type Settings={sound:boolean;motion:boolean;fov:number;sensitivity:number;quality:string};
type Callbacks={onPause:()=>void;onStats:(s:{floor:number;distance:number})=>void;onFallback:()=>void;onError:(s:string)=>void};
export type GameHandle=ReturnType<typeof createGame>;
export function createGame(host:HTMLDivElement, callbacks:Callbacks) {
  const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(host.clientWidth,host.clientHeight);
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
  const canvas=renderer.domElement;host.appendChild(canvas);
  const scene=new T.Scene();scene.background=new T.Color('#202825');scene.fog=new T.FogExp2('#202825',.018);
  const camera=new T.PerspectiveCamera(75,host.clientWidth/host.clientHeight,.04,650);camera.rotation.order='YXZ';
  scene.add(new T.HemisphereLight('#f2eedc','#5a625d',2.0));
  const fill=new T.DirectionalLight('#f8edcc',1.0);fill.position.set(-20,40,-10);scene.add(fill);
  const playerLight=new T.PointLight('#ffe7b4',10,15,1.7);scene.add(playerLight);
  const localLights:T.PointLight[]=[];
  for(let i=0;i<6;i++){const l=new T.PointLight('#fff3d0',12,13,1.7);scene.add(l);localLights.push(l);}
  const world=createWorld(scene);
  let p:Position={x:30,y:0,z:INNER+1.7},yaw=-.88,pitch=-.04,active=false,disposed=false,fallback=false;
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
  function pause(){active=false;clearKeys();if(document.pointerLockElement===canvas)document.exitPointerLock();if(master&&audio)master.gain.setTargetAtTime(0,audio.currentTime,.1);callbacks.onPause();}
  function start(){active=true;clearKeys();soundStart();if(master&&audio)master.gain.setTargetAtTime(config.sound?.13:0,audio.currentTime,.1);
    if(!matchMedia('(pointer: coarse)').matches){
      if(!canvas.requestPointerLock){fallback=true;callbacks.onFallback();return;}
      try{const result=canvas.requestPointerLock();if(result&&typeof result.catch==='function')void result.catch(()=>{fallback=true;callbacks.onFallback();});}catch{fallback=true;callbacks.onFallback();}
    }
  }
  const keydown=(e:KeyboardEvent)=>{if(!active)return;if(e.code==='Escape'){pause();return;}if(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code)){e.preventDefault();keys.add(e.code);}};
  const keyup=(e:KeyboardEvent)=>{keys.delete(e.code);};
  function look(dx:number,dy:number){yaw-=dx*.0018*config.sensitivity;pitch=T.MathUtils.clamp(pitch-dy*.0018*config.sensitivity,-1.48,1.48);}
  const mousemove=(e:MouseEvent)=>{if(active&&document.pointerLockElement===canvas)look(e.movementX,e.movementY);};
  let dragId:number|null=null,dragX=0,dragY=0;
  const pointerdown=(e:PointerEvent)=>{if(!active||(!fallback&&e.pointerType==='mouse'))return;dragId=e.pointerId;dragX=e.clientX;dragY=e.clientY;canvas.setPointerCapture(e.pointerId);};
  const pointermove=(e:PointerEvent)=>{if(active&&dragId===e.pointerId){look(e.clientX-dragX,e.clientY-dragY);dragX=e.clientX;dragY=e.clientY;}};
  const pointerup=()=>{dragId=null;};
  const lockchange=()=>{if(!document.pointerLockElement&&!fallback&&active)pause();};
  const lockerror=()=>{fallback=true;callbacks.onFallback();};
  const visibility=()=>{if(document.hidden)pause();};
  const lost=(e:Event)=>{e.preventDefault();pause();callbacks.onError('Graphics were interrupted. Refresh the page to return to the library.');};
  const resize=()=>{camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight);};
  const events:[EventTarget,string,EventListener][]=[
    [window,'keydown',keydown as EventListener],[window,'keyup',keyup as EventListener],[window,'blur',pause],
    [document,'mousemove',mousemove as EventListener],[document,'pointerlockchange',lockchange],[document,'pointerlockerror',lockerror],[document,'visibilitychange',visibility],
    [canvas,'pointerdown',pointerdown as EventListener],[canvas,'pointermove',pointermove as EventListener],[canvas,'pointerup',pointerup],[canvas,'pointercancel',pointerup],[canvas,'webglcontextlost',lost],
  ];events.forEach(([target,name,listener])=>target.addEventListener(name,listener));
  const observer=new ResizeObserver(resize);observer.observe(host);
  function animate(now:number){
    if(disposed)return;frame=requestAnimationFrame(animate);const dt=Math.min((now-lastTime)/1000,.05);lastTime=now;
    if(active){
      if(keys.has('ArrowLeft'))yaw+=dt*1.4;if(keys.has('ArrowRight'))yaw-=dt*1.4;if(keys.has('ArrowUp'))pitch=Math.min(1.48,pitch+dt);if(keys.has('ArrowDown'))pitch=Math.max(-1.48,pitch-dt);
      let forward=Number(keys.has('KeyW'))-Number(keys.has('KeyS')),right=Number(keys.has('KeyD'))-Number(keys.has('KeyA'));
      const norm=Math.hypot(forward,right);if(norm){forward/=norm;right/=norm;const speed=(keys.has('ShiftLeft')||keys.has('ShiftRight'))?3.4:1.7;
        const next=move(p,(-Math.sin(yaw)*forward+Math.cos(yaw)*right)*speed*dt,(-Math.cos(yaw)*forward-Math.sin(yaw)*right)*speed*dt);
        const distance=Math.hypot(next.x-p.x,next.y-p.y,next.z-p.z);totalDistance+=distance;stepDistance+=distance;bob+=distance*8;p=next;if(stepDistance>.78){footstep();stepDistance=0;}
      }
    }
    camera.position.set(p.x,p.y+EYE+(config.motion&&active?Math.sin(bob)*.018:0),p.z);camera.rotation.set(pitch,yaw,0,'YXZ');
    playerLight.position.set(p.x,p.y+2.5,p.z);
    const side=Math.sign(p.z);localLights.forEach((l,i)=>{l.position.set(Math.floor(p.x/7.62)*7.62+(i-2)*7.62+3.81,Math.round(p.y/HEIGHT)*HEIGHT+3.5,side*(INNER+1.8));});
    world.update(p.x,p.y);renderer.render(scene,camera);
    if(now-lastStats>300){lastStats=now;callbacks.onStats({floor:Math.round(p.y/HEIGHT),distance:Math.floor(totalDistance)});}
  }
  frame=requestAnimationFrame(animate);
  const lifecycle=new AbortController();
  const handle = {
    start,pause,
    reset(){p={x:30,y:0,z:INNER+1.7};yaw=-.88;pitch=-.04;totalDistance=0;callbacks.onStats({floor:0,distance:0});},
    touchMove(direction:string,pressed:boolean){const code=({forward:'KeyW',back:'KeyS',left:'KeyA',right:'KeyD'} as Record<string,string>)[direction];if(pressed)keys.add(code);else keys.delete(code);},
    configure(next:Settings){config=next;camera.fov=next.fov;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,next.quality==='low'?1:1.7));renderer.setSize(host.clientWidth,host.clientHeight);if(master&&audio)master.gain.setTargetAtTime(next.sound&&active?.13:0,audio.currentTime,.1);},
    dispose(){lifecycle.abort();disposed=true;cancelAnimationFrame(frame);observer.disconnect();events.forEach(([target,name,listener])=>target.removeEventListener(name,listener));if(document.pointerLockElement===canvas)document.exitPointerLock();void audio?.close();world.dispose();renderer.dispose();canvas.remove();},
  };
  type ModelContext={registerTool:(tool:{name:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean};execute:(input:unknown)=>unknown},options:{signal:AbortSignal})=>void|Promise<void>};
  const context=(document as Document & {modelContext?:ModelContext}).modelContext;
  if(context?.registerTool){
    const state=()=>({floor:Math.round(p.y/HEIGHT),distance:Math.floor(totalDistance),walking:active});
    const tools=[
      {name:'read_walk_state',description:'Read the current relative library floor, walked distance, and pause state.',readOnly:true,action:state},
      {name:'pause_walk',description:'Pause the library walk and release mouse capture.',readOnly:false,action:()=>{pause();return state();}},
      {name:'reset_walk',description:'Return the walker to the arrival point, as with the visible Return to starting point control.',readOnly:false,action:()=>{handle.reset();return state();}},
    ];
    for(const tool of tools){try{void Promise.resolve(context.registerTool({name:tool.name,description:tool.description,inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:tool.readOnly},execute(input){if(typeof input!=='object'||input===null||Array.isArray(input)||Object.keys(input).length)throw new Error('This action expects an empty object.');return tool.action();}},{signal:lifecycle.signal})).catch(()=>{});}catch{/* Optional browser capability. */}}
  }
  return handle;
}

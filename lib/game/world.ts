import * as T from 'three';
import {bakeGalleryLighting} from './lighting.ts';
import { BAY, HEIGHT, INNER, OUTER, mod } from './physics.ts';

import {bookId,ROWS,BOOKS_PER_ROW,type BookLocation} from './books.ts';

type Box = [number, number, number, number, number, number];
export function createWorld(scene: T.Scene, opened:ReadonlySet<string>=new Set()) {
  const group = new T.Group(), distantGroup = new T.Group(); scene.add(group,distantGroup);
  const geometries: T.BufferGeometry[] = [];
  const textures: T.Texture[] = [];
  const materials: T.Material[] = [];
  const boxGeo = new T.BoxGeometry(1,1,1); geometries.push(boxGeo);
  const pipeGeo = new T.CylinderGeometry(1,1,1,6); geometries.push(pipeGeo);
  function faces(groups:number[]) {
    const geometry=boxGeo.clone(),indices:number[]=[];
    for(const index of groups){const g=boxGeo.groups[index];for(let i=g.start;i<g.start+g.count;i++)indices.push(boxGeo.index!.getX(i));}
    geometry.setIndex(indices);geometry.clearGroups();geometries.push(geometry);return geometry;
  }
  const distantShelfGeometry=faces([4,5]);
  const distantRailGeometry=faces([2,3,4,5]);
  const distantLampGeometry=faces([2,3]);
  // Consolidate identical face materials: two draws instead of six per batch.
  const deckGeometry=faces([0,1,3,4,5,2]);deckGeometry.addGroup(0,30,0);deckGeometry.addGroup(30,6,1);
  const bookGeometry=faces([0,1,4,5,2,3]);bookGeometry.addGroup(0,24,0);bookGeometry.addGroup(24,12,1);
  const bowlGeo=new T.SphereGeometry(1,12,8);
  const seatGeo=new T.TorusGeometry(1,.16,6,20);seatGeo.rotateX(Math.PI/2);
  geometries.push(bowlGeo,seatGeo);
  const baseGeometryCount=geometries.length;
  const dummy = new T.Object3D();
  let seed = 9834;
  const random = () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
  function texture(w: number, h: number, draw: (c: CanvasRenderingContext2D)=>void) {
    const c = document.createElement('canvas'); c.width=w; c.height=h;
    draw(c.getContext('2d')!);
    const t = new T.CanvasTexture(c); t.colorSpace=T.SRGBColorSpace; t.anisotropy=4; textures.push(t); return t;
  }
  const carpet = texture(256,256,c=>{
    c.fillStyle='#6b6c66';c.fillRect(0,0,256,256);
    for(let i=0;i<25000;i++){ const v=65+random()*70;c.fillStyle=`rgba(${v},${v},${v},.35)`;c.fillRect(random()*256,random()*256,1,2); }
  }); carpet.wrapS=carpet.wrapT=T.RepeatWrapping; carpet.repeat.set(12,2);
  const spines=texture(2048,512,c=>{
    c.fillStyle='#302a21';c.fillRect(0,0,2048,512);
    for(let row=0;row<8;row++) {
      for(let x=0;x<2048;) {
        const w=4, y=row*64;
        const colors=['#987953'];
        c.fillStyle=colors[Math.floor(random()*colors.length)];c.fillRect(x+1,y+7,w-1,53);
        c.fillStyle='rgba(225,206,163,.23)';c.fillRect(x+2,y+18,w-3,1);c.fillRect(x+2,y+56,w-3,1);
        c.fillStyle='rgba(0,0,0,.25)';c.fillRect(x+1,y+7,1,53); x+=w;
      }
      c.fillStyle='#514536';c.fillRect(0,row*64+60,2048,4);
    }
  });
  const lighting=bakeGalleryLighting();
  const mat=(params:T.MeshStandardMaterialParameters)=>{const m=lighting.material(params);materials.push(m);return m;};
  const floorMat=mat({map:carpet,roughness:1,color:'#b1b1a7'});
  const slabMat=mat({color:'#aaa99c',roughness:1});
  const wallMat=mat({color:'#a8a69a',roughness:1});
  const woodMat=mat({color:'#544b3d',roughness:.9});
  const railMat=mat({color:'#854a3d',roughness:.6,metalness:.25});
  const shelfMat=mat({map:spines,roughness:1,emissive:'#75644c',emissiveMap:spines,emissiveIntensity:.20});
  const lightMat=mat({color:'#fff0c9',emissive:'#fff0c9',emissiveIntensity:2.2});
  const darkMat=mat({color:'#353c38',roughness:.55,metalness:.3});
  const linenMat=mat({color:'#b7b5a8',roughness:1});
  const tileMap=texture(256,256,c=>{
    c.fillStyle='#bebfb5';c.fillRect(0,0,256,256);
    c.strokeStyle='#858c83';c.lineWidth=2;
    for(let i=0;i<=256;i+=32){c.beginPath();c.moveTo(i,0);c.lineTo(i,256);c.moveTo(0,i);c.lineTo(256,i);c.stroke();}
  });
  const tileMat=mat({map:tileMap,roughness:.75});
  const ceramicMat=mat({color:'#e1e2d7',roughness:.25});
  const chromeMat=mat({color:'#adb6b4',metalness:.75,roughness:.28});
  const mirrorMat=mat({color:'#8faba8',metalness:.65,roughness:.12});
  const blanketMat=mat({color:'#666d65',roughness:1});
  // The close-up volumes sample the exact same atlas as their backing shelves.
  // A different solid colour here made the player's current level look brighter.
  const bookMat=mat({map:spines,roughness:1,emissive:'#75644c',emissiveMap:spines,emissiveIntensity:.20});
  const shadeBook=bookMat.onBeforeCompile.bind(bookMat);
  bookMat.onBeforeCompile=(shader,renderer)=>{
    shadeBook(shader,renderer);
    shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
      vec3 shelfPoint = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
      float shelfU = shelfPoint.z > 0.0 ? -shelfPoint.x / ${BAY} : shelfPoint.x / ${BAY};
      float shelfV = (mod(shelfPoint.y, ${HEIGHT}) - 0.03) / 3.18;
      vMapUv = vec2(fract(shelfU), shelfV);

    `);
  };
  bookMat.customProgramCacheKey=()=> 'baked-book-volumes-matching-shelf-atlas-v2';
  const goldMat=mat({color:'#b59b59',roughness:.65,metalness:.35});
  const screenMat=mat({color:'#b3c9b3',emissive:'#7d9d80',emissiveIntensity:.6});
  goldMat.name='book-edges';
  const distantSlabMat=slabMat,distantFloorMat=floorMat,distantRailMat=railMat;
  // Lightweight distant strips extend the view without duplicating nearby furnishings.
  const farShelfMaterials=[841,405].map(repeats=>{
    const t=spines.clone();t.wrapS=T.RepeatWrapping;t.repeat.set(repeats,1);t.needsUpdate=true;textures.push(t);
    return mat({map:t});
  });
  const farLampMaterials=[841,405].map(repeats=>{
    const t=texture(128,8,c=>{c.fillStyle='#fff0c9';c.fillRect(51,0,27,8);});
    t.wrapS=T.RepeatWrapping;t.repeat.set(repeats*3,1);
    const m=new T.MeshBasicMaterial({map:t,color:'#fff0c9',transparent:true,depthWrite:false});materials.push(m);return m;
  });
  const baseTextureCount=textures.length,baseMaterialCount=materials.length;
  function batch(boxes:Box[], material:T.Material|T.Material[], target=group,geometry:T.BufferGeometry=boxGeo) {
    const m=new T.InstancedMesh(geometry,material,boxes.length);
    boxes.forEach((b,i)=>{dummy.position.set(b[0],b[1],b[2]);dummy.rotation.set(0,0,0);dummy.scale.set(b[3],b[4],b[5]);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);});
    m.computeBoundingSphere();target.add(m);return m;
  }
  const distantBatches:{mesh:T.InstancedMesh;bounds:T.Box3}[]=[];
  const frustum=new T.Frustum(),clipMatrix=new T.Matrix4(),worldBounds=new T.Box3();
  function batchDistant(boxes:Box[],material:T.Material|T.Material[],geometry=boxGeo) {
    // Coarse vertical bands retain low draw counts while allowing conservative
    // box culling. A single sphere spanning 19 km could never reject these rows.
    const buckets=new Map<string,Box[]>();
    for(const box of boxes){
      const level=box[1]/HEIGHT, magnitude=Math.abs(level);
      const band=magnitude<33?0:magnitude<65?1:magnitude<257?2:magnitude<1025?3:4;
      const key=`${Math.sign(level)}:${band}:${Math.sign(box[2])}`;
      const bucket=buckets.get(key);if(bucket)bucket.push(box);else buckets.set(key,[box]);
    }
    for(const boxes of buckets.values()){
      const mesh=batch(boxes,material,distantGroup,geometry),bounds=new T.Box3();
      for(const b of boxes){
        bounds.min.x=Math.min(bounds.min.x,b[0]-b[3]/2);bounds.max.x=Math.max(bounds.max.x,b[0]+b[3]/2);
        bounds.min.y=Math.min(bounds.min.y,b[1]-b[4]/2);bounds.max.y=Math.max(bounds.max.y,b[1]+b[4]/2);
        bounds.min.z=Math.min(bounds.min.z,b[2]-b[5]/2);bounds.max.z=Math.max(bounds.max.z,b[2]+b[5]/2);
      }
      mesh.frustumCulled=false;distantBatches.push({mesh,bounds});
    }
  }
  function pipes(boxes:Box[]) {
    const m=new T.InstancedMesh(pipeGeo,railMat,boxes.length);
    boxes.forEach((b,i)=>{dummy.position.set(b[0],b[1],b[2]);dummy.rotation.set(0,0,b[3]>1?Math.PI/2:0);dummy.scale.set(.036,b[3]>1?b[3]:b[4],.036);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);});m.computeBoundingSphere();group.add(m);
  }
  function sign(text:string, x:number,y:number,z:number, side:number, width=1.8) {
    const tex=texture(512,256,c=>{c.fillStyle='#dad8c7';c.fillRect(0,0,512,256);c.strokeStyle='#7b7667';c.lineWidth=5;c.strokeRect(10,10,492,236);c.fillStyle='#353b36';c.textAlign='center';c.font='22px sans-serif';text.split('\n').forEach((s,i)=>c.fillText(s,256,62+i*44));});
    const m=new T.MeshBasicMaterial({map:tex});materials.push(m);const g=new T.PlaneGeometry(width,width/2);geometries.push(g);const mesh=new T.Mesh(g,m);mesh.position.set(x,y,z);mesh.rotation.y=side===1?Math.PI:0;group.add(mesh);
  }
  const bookBatches:{mesh:T.InstancedMesh;bay:number;side:-1|1}[]=[];
  const unreadColor=new T.Color('#ffffff'),openedColor=new T.Color('#43c9c0');
  function refreshBookColors(){
    for(const {mesh,bay,side} of bookBatches){
      for(let row=0;row<ROWS;row++)for(let book=0;book<BOOKS_PER_ROW;book++){
        mesh.setColorAt(row*BOOKS_PER_ROW+book,opened.has(bookId({level:centerY,bay,side,row,book}))?openedColor:unreadColor);
      }
      if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    }
  }
  function markOpened(location:BookLocation){
    if(location.level!==centerY)return;
    const batch=bookBatches.find(b=>b.bay===location.bay&&b.side===location.side);
    if(batch){batch.mesh.setColorAt(location.row*BOOKS_PER_ROW+location.book,openedColor);batch.mesh.instanceColor!.needsUpdate=true;}
  }
  // Bounded window of repeated geometry; shifted around the walker, never an end wall.
  let centerX=Infinity, centerY=Infinity,nearBaseY=0;
  function rebuild(px:number,py:number) {
    const bx=Math.floor(px/BAY), fy=Math.round(py/HEIGHT);
    if(bx===centerX){
      if(fy!==centerY){
        // Every level has the same architecture. Translate the existing detailed
        // window during flight/fall instead of rebuilding it 14 times a second.
        group.position.y=(fy-nearBaseY)*HEIGHT;distantGroup.position.y=fy*HEIGHT;centerY=fy;refreshBookColors();
      }
      return;
    }
    bookBatches.length=0;
    centerX=bx;centerY=fy;nearBaseY=fy;group.position.y=0;
    while(group.children.length) {const child=group.children[0];group.remove(child);if(child instanceof T.InstancedMesh)child.dispose();}
    // Signs have per-window assets; release before replacing them.
    while(textures.length>baseTextureCount)textures.pop()!.dispose();
    while(materials.length>baseMaterialCount)materials.pop()!.dispose();
    while(geometries.length>baseGeometryCount)geometries.pop()!.dispose();
    const decks:Box[]=[], slabs:Box[]=[], floors:Box[]=[], shelves:Box[]=[], trim:Box[]=[], rails:Box[]=[], lamps:Box[]=[], walls:Box[]=[], furniture:Box[]=[], linens:Box[]=[], blankets:Box[]=[], dark:Box[]=[], screens:Box[]=[];
    const tiles:Box[]=[],ceramics:Box[]=[],bowls:Box[]=[],seats:Box[]=[],chrome:Box[]=[],mirrors:Box[]=[];
    for(let f=fy-32;f<=fy+32;f++)for(let b=bx-15;b<=bx+15;b++)for(const side of [-1,1]) {
      const x=b*BAY,y=f*HEIGHT,z=side*(INNER+1.8288), amenity=mod(b,12)===0;
      // Carpet is the top face of one solid deck, never a second coplanar mesh.
      decks.push([x+BAY/2,y-.17,z,BAY,.34,3.6576]);
      rails.push([x+BAY/2,y+1.2192,side*INNER,BAY,0,0],[x+BAY/2,y+.55,side*INNER,BAY,0,0]);
      for(let j=0;j<6;j++)rails.push([x+j*BAY/6,y+.6,side*INNER,0,1.2,0]);
      for(let j=0;j<3;j++)lamps.push([x+3.81+j*7.62,y+HEIGHT-.38,z,1.6,.035,.28]);
      if(!amenity) {
        shelves.push([x+BAY/2,y+1.62,side*(OUTER+.18),BAY,3.18,.38]);
        for(let j=0;j<8;j++)trim.push([x+j*BAY/8,y+1.63,side*(OUTER-.03),.055,3.25,.46]);
        trim.push([x+BAY/2,y+3.28,side*(OUTER-.04),BAY,.10,.5],[x+BAY/2,y+.07,side*(OUTER-.04),BAY,.14,.5]);
      }else {
        walls.push([x+.5,y+1.8,side*(OUTER+.22),1,3.6,.3],[x+15.5,y+1.8,side*(OUTER+.22),1,3.6,.3],[x+17,y+1.8,side*(OUTER+.22),2,3.6,.3],[x+21.43,y+1.8,side*(OUTER+.22),2.86,3.6,.3]);
        // Solid wall beside the straight stair prevents stepping sideways off it.
        walls.push([x+8,y+1.8,side*(OUTER+.48),8,3.6,.16]);
        walls.push([x+8,y+1.8,side*(OUTER+3.8),14,3.6,.2],[x+1,y+1.8,side*(OUTER+2),.2,3.6,3.6],[x+15,y+1.8,side*(OUTER+2),.2,3.6,3.6]);
        floors.push([x+2.5,y,side*(OUTER+1.9),3,.10,3.8],[x+13.5,y,side*(OUTER+1.9),3,.10,3.8]);
        for(let s=0;s<24;s++) slabs.push([x+4+(s+.5)/3,y+(s+1)*HEIGHT/24-.09,side*(OUTER+2.05),1/3,.18,2.9]);
        // Dormitory, seven beds, fountain and an inert food kiosk.
        // Each room deck also forms the ceiling below; never overlap two slabs.
        floors.push([x+19,y-.18,side*(OUTER+2.65),6,.36,5.3]);
        walls.push([x+19,y+1.8,side*(OUTER+5.3),6,3.6,.2],[x+16,y+1.8,side*(OUTER+2.65),.2,3.6,5.3],[x+22,y+1.8,side*(OUTER+1),.2,3.6,2],[x+22,y+1.8,side*(OUTER+4.4),.2,3.6,1.8],[x+22,y+3.1,side*(OUTER+2.75),.2,1,1.5]);
        for(let bed=0;bed<7;bed++) {
          const back=bed<4, xx=x+16.8+(back?bed*1.4:[0,3.2,4.4][bed-4]), zz=side*(OUTER+(back?4.15:1.4));
          furniture.push([xx,y+.39,zz,1,.14,1.8]);linens.push([xx,y+.53,zz,.96,.15,1.77],[xx,y+.66,zz+side*.63,.70,.13,.35]);blankets.push([xx,y+.62,zz-side*.22,.97,.055,1.25]);
          for(const dx of [-.42,.42])for(const dz of [-.76,.76])furniture.push([xx+dx,y+.2,zz+dz,.045,.4,.045]);
        }
        // Bathroom attached to the sleeping room; an open doorway meets its aisle.
        tiles.push([x+25,y-.18,side*(OUTER+2.5),6,.36,5]);
        walls.push([x+25,y+1.8,side*(OUTER+.325),6,3.6,.35],
          [x+25,y+1.8,side*(OUTER+5),6,3.6,.2],
          [x+28,y+1.8,side*(OUTER+2.5),.2,3.6,5]);
        lamps.push([x+25,y+HEIGHT-.38,side*(OUTER+2.5),2,.04,.4]);
        // Wall-mounted basin with a dark recess, tap and soap pump.
        ceramics.push([x+24.6,y+.78,side*(OUTER+.65),1.1,.2,.65],
          [x+24.6,y+.42,side*(OUTER+.48),.22,.65,.25]);
        dark.push([x+24.6,y+.887,side*(OUTER+.7),.7,.014,.36]);
        chrome.push([x+24.6,y+1.01,side*(OUTER+.39),.045,.28,.045],
          [x+24.6,y+1.13,side*(OUTER+.51),.045,.045,.28]);
        ceramics.push([x+25,y+1,side*(OUTER+.48),.1,.24,.1]);
        chrome.push([x+25,y+1.13,side*(OUTER+.51),.14,.035,.04]);
        // Full-length mirror opposite the sink; inexpensive polished panel.
        chrome.push([x+24.6,y+1.45,side*(OUTER+4.87),1.05,2.3,.08]);
        mirrors.push([x+24.6,y+1.45,side*(OUTER+4.82),.95,2.2,.025]);
        // Toilet in a screened corner, with cistern, oval bowl, seat and paper.
        ceramics.push([x+23,y+.67,side*(OUTER+4.64),.48,.65,.23],
          [x+23,y+.22,side*(OUTER+4.3),.28,.44,.4]);
        bowls.push([x+23,y+.43,side*(OUTER+4.25),.29,.18,.39]);
        dark.push([x+23,y+.57,side*(OUTER+4.23),.32,.015,.44]);
        seats.push([x+23,y+.59,side*(OUTER+4.23),.25,.15,.35]);
        walls.push([x+23.75,y+1.05,side*(OUTER+4.1),.10,2.1,1.7]);
        linens.push([x+23.63,y+.85,side*(OUTER+4.3),.15,.15,.25]);
        chrome.push([x+23.14,y+.95,side*(OUTER+4.49),.12,.035,.035]);
        // Two open shower stalls, each with tray, drain, mixer and overhead head.
        for(const depth of [1.25,3.75]){
          ceramics.push([x+27,y+.025,side*(OUTER+depth),1.65,.05,1.75]);
          dark.push([x+27,y+.056,side*(OUTER+depth),.14,.008,.14]);
          chrome.push([x+27.78,y+1.65,side*(OUTER+depth),.035,1.55,.035],
            [x+27.55,y+2.4,side*(OUTER+depth),.5,.035,.035],
            [x+27.32,y+2.37,side*(OUTER+depth),.25,.055,.25],
            [x+27.73,y+1.1,side*(OUTER+depth),.12,.08,.28]);
        }
        walls.push([x+27,y+1.1,side*(OUTER+2.5),2,2.2,.10]);
        dark.push([x+17.85,y+.68,side*(INNER+.72),.9,1.36,1.1]);screens.push([x+17.85,y+1.38,side*(INNER+.72),.68,.045,.67]);
        dark.push([x+20.6,y+.83,side*(OUTER-.24),.5,.22,.5],[x+20.6,y+.45,side*(OUTER-.05),.25,.8,.2]);
        if(Math.abs(f-fy)<=1&&Math.abs(b-bx)<=12) {
          sign('STAIRS\nUP →     ← DOWN',x+8,y+2.2,side*(OUTER+.38),side,2.6);
          sign('REST AREA\n7 BEDS · BATH →',x+17,y+2.2,side*(OUTER+.04),side,1.2);
          sign('BATHROOM\nSHOWERS · WC',x+24.6,y+2.8,side*(OUTER+.515),-side,1.5);
          sign('LIBRARY\nFind the story of your life.\nYour search has no deadline.',x+21,y+2.1,side*(OUTER+.04),side,1.5);
          const clockTex=texture(256,256,c=>{c.fillStyle='#d4d4c4';c.beginPath();c.arc(128,128,124,0,Math.PI*2);c.fill();c.strokeStyle='#2c332e';c.lineWidth=7;for(let h=0;h<12;h++){const a=h*Math.PI/6;c.beginPath();c.moveTo(128+Math.sin(a)*98,128-Math.cos(a)*98);c.lineTo(128+Math.sin(a)*112,128-Math.cos(a)*112);c.stroke();}c.beginPath();c.moveTo(128,54);c.lineTo(128,128);c.lineTo(176,128);c.stroke();c.fillStyle='#343c33';c.fillRect(63,155,130,28);c.fillStyle='#c4d4b8';c.font='17px monospace';c.fillText('YEAR 1 DAY 1',68,175);});
          const m=new T.MeshBasicMaterial({map:clockTex,transparent:true});materials.push(m);const g=new T.PlaneGeometry(.9,.9);geometries.push(g);const clock=new T.Mesh(g,m);clock.position.set(x+17,y+3,side*(OUTER+.025));clock.rotation.y=side===1?Math.PI:0;group.add(clock);
        }
      }
    }
    batch(tiles,[slabMat,tileMat],group,deckGeometry);batch(ceramics,ceramicMat);batch(bowls,ceramicMat,group,bowlGeo);batch(seats,ceramicMat,group,seatGeo);batch(chrome,chromeMat);batch(mirrors,mirrorMat);
    const deckMaterials=[slabMat,floorMat];
    batch(decks,deckMaterials,group,deckGeometry);batch(slabs,slabMat);batch(floors,[slabMat,floorMat],group,deckGeometry);batch(shelves,shelfMat);batch(trim,woodMat);pipes(rails);batch(lamps,lightMat);batch(walls,wallMat);batch(furniture,railMat);batch(linens,linenMat);batch(blankets,blanketMat);batch(dark,darkMat);batch(screens,screenMat);
    // This periodic horizon never needs to be regenerated when walking. Moving its
    // origin by whole bays/floors preserves the same shelf and lamp alignment.
    distantGroup.position.set(bx*BAY,fy*HEIGHT,0);
    if(distantGroup.children.length===0){
    const farSlabs:Box[]=[],farRails:Box[]=[];
    const farShelves:[Box[],Box[]]=[[],[]],farLamps:[Box[],Box[]]=[[],[]];
    for(let f=-2400;f<=2400;f++) {
      // No overlap with the full-detail rectangle above.
      const strips=Math.abs(f)<=32
        ? [{start:-420,count:405,material:1},{start:16,count:405,material:1}]
        : [{start:-420,count:841,material:0}];
      for(const strip of strips)for(const side of [-1,1]) {
        const width=strip.count*BAY,x=(strip.start+strip.count/2)*BAY,y=f*HEIGHT,z=side*(INNER+1.8288);
        farSlabs.push([x,y-.17,z,width,.34,3.6576]);
        farShelves[strip.material].push([x,y+1.62,side*(OUTER+.18),width,3.18,.38]);
        farLamps[strip.material].push([x,y+HEIGHT-.38,z,width,.035,.28]);
        farRails.push([x,y+1.2192,side*INNER,width,.07,.07],[x,y+.55,side*INNER,width,.07,.07]);
      }
    }
    batchDistant(farSlabs,[distantSlabMat,distantFloorMat],deckGeometry);batchDistant(farRails,distantRailMat,distantRailGeometry);
    for(let i=0;i<2;i++){batchDistant(farShelves[i],farShelfMaterials[i],distantShelfGeometry);batchDistant(farLamps[i],farLampMaterials[i],distantLampGeometry);}
    }
    // Real book volumes close to the player, patterned shelf facades in the distance.
    seed=3451;
    for(let b=bx-2;b<=bx+2;b++)if(mod(b,12)!==0)for(const side of [-1,1]) {
    // Separate book bounds let Three.js reject shelf sections outside the camera view.
    const books:Box[]=[];
    for(let row=0;row<8;row++)for(let i=0;i<570;i++) {
      const x=b*BAY+(i+.5)*BAY/570;
      books.push([x,fy*HEIGHT+.30+row*.39,side*(OUTER-.08),.037,.34,.3]);
    }
    const mesh=batch(books,[bookMat,goldMat],group,bookGeometry);
    bookBatches.push({mesh,bay:b,side:side as -1|1});
    }
    refreshBookColors();
  }
  function update(px:number,py:number,camera?:T.Camera){
    rebuild(px,py);
    if(!camera)return;
    camera.updateMatrixWorld();clipMatrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(clipMatrix);
    for(const {mesh,bounds} of distantBatches){worldBounds.copy(bounds).translate(distantGroup.position);mesh.visible=frustum.intersectsBox(worldBounds);}
  }
  return { update, markOpened, dispose(){lighting.dispose();scene.remove(group,distantGroup);for(const root of [group,distantGroup])root.traverse(o=>{if(o instanceof T.InstancedMesh)o.dispose();});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());} };
}

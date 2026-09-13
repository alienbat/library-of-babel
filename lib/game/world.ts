import {createShelfFrame} from './shelf-frame.ts';
import {createBathroomFixtures,BATHROOM_CONTACTS,type BathroomPlacement} from './bathroom-fixtures.ts';
import {DORM,DORM_BEDS,BATH_SHIFT} from './room-layout.ts';
import {createBeds,createFurniture,type BedPlacement} from './beds.ts';
import {roomOccluders} from './room-ao.ts';
import {createStairCulling} from './landing-occlusion.ts';
import {detailCells,shelfLod,type ShelfCell} from './shelf-lod.ts';
import * as T from 'three';
import {createWallWriting} from './wall-writing.ts';
import {ROOM_LIGHTS} from './room-lighting.ts';
import {staircase} from './stairs.ts';
import {createBoundaryLighting,BOUNDARY_SPAN,BOUNDARY_LIGHT_SPACING,WALL_LIGHT_SPACING} from './boundary-lighting.ts';
import {createInfiniteHorizon,withHorizonFade} from './horizon.ts';
import {bakeGalleryLighting} from './lighting.ts';
import { BAY, HEIGHT, INNER, OUTER, PERIOD, mod,type WorldLimits } from './physics.ts';

import {bookId,ROWS,BOOKS_PER_ROW,type BookLocation} from './books.ts';

type Box = [number, number, number, number, number, number];
export function createWorld(scene: T.Scene, opened:ReadonlySet<string>=new Set(),bedAssetUrl?:string,bathroomAssetUrl?:string,furnishingUrls?:{board:string;upright:string;returns:string;bbq:string}) {
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
  const distantRailGeometry=new T.CylinderGeometry(.036/.07,.036/.07,1,6);
  distantRailGeometry.rotateZ(Math.PI/2);geometries.push(distantRailGeometry);
  const distantLampGeometry=faces([2,3]);
  // Consolidate identical face materials: two draws instead of six per batch.
  const deckGeometry=faces([0,1,3,4,5,2]);deckGeometry.addGroup(0,30,0);deckGeometry.addGroup(30,6,1);
  const bookGeometry=faces([0,1,4,5,2,3]);bookGeometry.addGroup(0,24,0);bookGeometry.addGroup(24,12,1);
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
  // Orthographic shelf-face bake in metres: exactly the same books and boards
  // as the near model. Fractional pixel coverage preserves thin board widths.
  const spines=texture(4096,1024,c=>{
    const sx=4096/BAY,sy=1024/3.18;
    const rect=(x:number,y:number,w:number,h:number,color:string)=>{
      c.fillStyle=color;c.fillRect(x*sx,(3.21-y-h)*sy,w*sx,h*sy);
    };
    rect(0,.03,BAY,3.18,'#a8a69a');
    for(let row=0;row<ROWS;row++){
      const bottom=.13+row*.39;
      for(let book=0;book<BOOKS_PER_ROW;book++){
        const x=(book+.5)*BAY/BOOKS_PER_ROW-.037/2;
        rect(x,bottom,.037,.34,'#987953');
        rect(x,bottom,.037/4,.34,'rgba(0,0,0,.25)');
        rect(x+.037/4,bottom+.34*(1-56/256),.037/2,.34*4/256,'rgba(225,206,163,.23)');
        rect(x+.037/4,bottom+.34*(1-236/256),.037/2,.34*4/256,'rgba(225,206,163,.23)');
      }
      rect(0,bottom-.04,BAY,.04,'#544b3d');
    }
    for(let j=0;j<=8;j++)rect(j*BAY/8-.055/2,.03,.055,3.18,'#544b3d');
    rect(0,.03,BAY,.06,'#544b3d');
  });
  const lighting=bakeGalleryLighting(),beds=createBeds(scene,lighting.material,bedAssetUrl),bathrooms=createBathroomFixtures(scene,lighting.material,bathroomAssetUrl),stairCulling=createStairCulling(scene);
  const shelfFrame=createShelfFrame(furnishingUrls),returns=createFurniture(scene,lighting.material,furnishingUrls?.returns,'return'),bbq=createFurniture(scene,lighting.material,furnishingUrls?.bbq,'bbq');
  let occlusionEnabled=true;
  spines.wrapS=T.RepeatWrapping;
  const boundary=createBoundaryLighting(carpet);
  const horizon=createInfiniteHorizon(scene,spines,lighting.negative,boundary.uniforms,lighting.positive,carpet);
  const boundaryGroup=new T.Group();boundaryGroup.name='corner-boundaries';scene.add(boundaryGroup);
  const endGeometry=new T.PlaneGeometry(40000,40000),capGeometry=new T.PlaneGeometry(40000,BOUNDARY_SPAN);
  // Boundary planes must use the same pixel handoff as gallery geometry behind/in front of them.
  // Otherwise their opaque depth prevents the analytical horizon from closing distant corners.
  const boundaryWallFade=withHorizonFade(boundary.wall),boundaryFloorFade=withHorizonFade(boundary.floor),boundaryCeilingFade=withHorizonFade(boundary.ceiling);
  materials.push(boundaryWallFade,boundaryFloorFade,boundaryCeilingFade);
  const endWall=new T.Mesh(endGeometry,boundaryWallFade),endCap=new T.Mesh(capGeometry,boundaryFloorFade);
  boundaryGroup.add(endWall,endCap);endWall.visible=endCap.visible=false;
  let cornerLimits:WorldLimits={},fixtureX=Infinity,fixtureY=Infinity;
  const frameMaterial=new T.MeshBasicMaterial({color:'#353c38'}),lensMaterial=new T.MeshBasicMaterial({color:new T.Color('#fff0c9').multiplyScalar(2.2)});materials.push(frameMaterial,lensMaterial);
  const frames=new T.InstancedMesh(boxGeo,frameMaterial,144),lenses=new T.InstancedMesh(boxGeo,lensMaterial,144);boundaryGroup.add(frames,lenses);frames.count=lenses.count=0;
  function updateFixtures(px:number,py:number){
    const bx=Math.floor(px/BOUNDARY_LIGHT_SPACING),by=Math.floor(py/WALL_LIGHT_SPACING);
    if(bx===fixtureX&&by===fixtureY)return;fixtureX=bx;fixtureY=by;
    let count=0;
    const put=(x:number,y:number,z:number,wall:boolean)=>{
      if(x<(cornerLimits.minX??-Infinity)||x>(cornerLimits.maxX??Infinity)||y<(cornerLimits.minY??-Infinity)||y>(cornerLimits.maxY??Infinity))return;
      dummy.rotation.set(0,0,0);dummy.position.set(x,y,z);dummy.scale.set(wall?.08:1.8,wall?1.8:.04,.38);dummy.updateMatrix();frames.setMatrixAt(count,dummy.matrix);
      dummy.position.x+=wall?(cornerLimits.minX!==undefined?.05:-.05):0;
      dummy.position.y+=wall?0:cornerLimits.minY!==undefined?.026:-.026;
      dummy.scale.set(wall?.025:1.6,wall?1.6:.012,.20);dummy.updateMatrix();lenses.setMatrixAt(count++,dummy.matrix);
    };
    if(endCap.visible)for(let i=bx-16;i<=bx+16;i++)for(let k=-1;k<=0;k++)put((i+.5)*BOUNDARY_LIGHT_SPACING,endCap.position.y+(cornerLimits.minY!==undefined?.025:-.025),(k+.5)*BOUNDARY_LIGHT_SPACING,false);
    if(endWall.visible)for(let i=by-10;i<=by+10;i++)for(let k=-1;k<=0;k++)put(endWall.position.x+(cornerLimits.minX!==undefined?.045:-.045),(i+.5)*WALL_LIGHT_SPACING,(k+.5)*BOUNDARY_LIGHT_SPACING,true);
    for(const mesh of [frames,lenses]){mesh.count=count;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();}
  }
  function setLimits(next:WorldLimits){
    lighting.setLimits(next);wallWriting.setLimits(next);cornerLimits=next;detailKey='';fixtureX=fixtureY=Infinity;centerX=Infinity;
    endCap.material=next.minY!==undefined?boundaryFloorFade:boundaryCeilingFade;
    horizon.setLimits(next);
    endWall.visible=next.minX!==undefined||next.maxX!==undefined;
    endCap.visible=next.minY!==undefined||next.maxY!==undefined;
    endWall.rotation.y=Math.PI/2;endWall.position.x=next.minX!==undefined?next.minX+.01:next.maxX!==undefined?next.maxX-.01:0;
    endCap.rotation.x=-Math.PI/2;endCap.position.y=next.minY!==undefined?next.minY+.005:next.maxY!==undefined?next.maxY-.005:0;
  }

  const fade=(source:T.MeshBasicMaterial)=>{const m=withHorizonFade(source);materials.push(m);return m;};
  const mat=(params:T.MeshStandardMaterialParameters)=>{const m=lighting.material(params);materials.push(m);return m;};
  const floorMat=mat({map:carpet,roughness:1,color:'#b1b1a7'});
  const slabMat=mat({color:'#aaa99c',roughness:1});
  const wallMat=mat({color:'#a8a69a',roughness:1});
  const wallWriting=createWallWriting();wallWriting.apply(wallMat);
  const woodMat=mat({color:'#544b3d',roughness:.9});
  const railMat=mat({color:'#854a3d',roughness:.6,metalness:.25});
  const shelfBackMat=mat({color:'#a8a69a',roughness:1});shelfBackMat.name='shelf-backing';
  const detailEye={value:new T.Vector3(1e10,1e10,1e10)};
  const shelfMat=shelfLod(mat({map:spines,roughness:1}),detailEye);shelfMat.name='shelf-facade';
  const lightMat=mat({color:'#fff0c9',emissive:'#fff0c9',emissiveIntensity:2.2});
  const darkMat=mat({color:'#353c38',roughness:.55,metalness:.3});
  const tileMap=texture(256,256,c=>{
    c.fillStyle='#bebfb5';c.fillRect(0,0,256,256);
    c.strokeStyle='#858c83';c.lineWidth=2;
    for(let i=0;i<=256;i+=32){c.beginPath();c.moveTo(i,0);c.lineTo(i,256);c.moveTo(0,i);c.lineTo(256,i);c.stroke();}
  });
  const tileMat=mat({map:tileMap,roughness:.75});
  // One binding per actual book; the multi-book atlas is only a distant facade.
  const binding=texture(32,256,c=>{
    c.fillStyle='#987953';c.fillRect(0,0,32,256);
    c.fillStyle='rgba(0,0,0,.25)';c.fillRect(0,0,8,256);
    c.fillStyle='rgba(225,206,163,.23)';c.fillRect(8,52,16,4);c.fillRect(8,232,16,4);
  });
  const bookMat=mat({map:binding,roughness:1});
  const goldMat=mat({color:'#b59b59',roughness:.65,metalness:.35});
  const screenMat=mat({color:'#b3c9b3',emissive:'#7d9d80',emissiveIntensity:.6});
  goldMat.name='book-edges';
  const distantWallMat=fade(mat({color:'#a8a69a'}));
  const distantSlabMat=fade(slabMat),distantFloorMat=fade(floorMat),distantRailMat=fade(railMat);
  // Lightweight distant strips extend the view without duplicating nearby furnishings.
  const farShelfMaterials=[841,405].map(repeats=>{
    const t=spines.clone();t.wrapS=T.RepeatWrapping;t.repeat.set(repeats,1);t.needsUpdate=true;textures.push(t);
    return fade(shelfLod(mat({map:t}),detailEye));
  });
  const farLampMaterials=[841,405].map(repeats=>{
    const t=texture(128,8,c=>{c.fillStyle='#fff0c9';c.fillRect(51,0,27,8);});
    t.wrapS=T.RepeatWrapping;t.repeat.set(repeats*3,1);
    const m=new T.MeshBasicMaterial({map:t,color:'#fff0c9',transparent:true,depthWrite:false});materials.push(m);return fade(m);
  });
  const baseTextureCount=textures.length,baseMaterialCount=materials.length;
  function batch(boxes:Box[], material:T.Material|T.Material[], target=group,geometry:T.BufferGeometry=boxGeo) {
    const m=new T.InstancedMesh(geometry,material,boxes.length);
    boxes.forEach((b,i)=>{dummy.position.set(b[0],b[1],b[2]);dummy.rotation.set(0,0,0);dummy.scale.set(b[3],b[4],b[5]);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);});
    m.computeBoundingSphere();target.add(m);return m;
  }
  const distantBatches:{mesh:T.InstancedMesh;bounds:T.Box3}[]=[];
  const frustum=new T.Frustum(),clipMatrix=new T.Matrix4(),worldBounds=new T.Box3();
  function batchDistant(boxes:Box[],material:T.Material|T.Material[],geometry:T.BufferGeometry=boxGeo) {
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
  const detailGroup=new T.Group();detailGroup.name='nearby-shelf-details';scene.add(detailGroup);
  const bookBatches:({mesh:T.InstancedMesh;parts:T.InstancedMesh[]}&ShelfCell)[]=[];
  const unreadColor=new T.Color('#ffffff'),openedColor=new T.Color('#43c9c0');
  function refreshBookColors(){
    for(const {mesh,bay,side,level} of bookBatches){
      for(let row=0;row<ROWS;row++)for(let book=0;book<BOOKS_PER_ROW;book++)mesh.setColorAt(row*BOOKS_PER_ROW+book,opened.has(bookId({level,bay,side,row,book}))?openedColor:unreadColor);
      if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    }
  }
  function markOpened(location:BookLocation){
    const found=bookBatches.find(b=>b.level===location.level&&b.bay===location.bay&&b.side===location.side);
    if(found){found.mesh.setColorAt(location.row*BOOKS_PER_ROW+location.book,openedColor);found.mesh.instanceColor!.needsUpdate=true;}
  }
  let detailKey='';
  function updateDetails(eye:T.Vector3){
    const snapped=new T.Vector3(Math.round(eye.x),Math.round(eye.y),Math.round(eye.z));
    const key=snapped.toArray().join(':');if(key===detailKey)return;detailKey=key;detailEye.value.copy(snapped);
    const cells=detailCells(snapped,cornerLimits),id=(c:ShelfCell)=>`${c.bay}:${c.level}:${c.side}`;
    const wanted=new Set(cells.map(id));
    for(let i=bookBatches.length-1;i>=0;i--)if(!wanted.has(id(bookBatches[i]))){for(const part of bookBatches[i].parts){detailGroup.remove(part);part.dispose();}bookBatches.splice(i,1);}
    const existing=new Set(bookBatches.map(id));
    for(const cell of cells)if(!existing.has(id(cell))){
      const {bay,level,side}=cell,x=bay*BAY,y=level*HEIGHT;
      const boards:Box[]=[],uprights:Box[]=[],books:Box[]=[];
      for(let row=0;row<ROWS;row++){
        boards.push([x+BAY/2,y+.11+row*.39,side*(OUTER-.04),BAY,.04,.5]);
        for(let i=0;i<BOOKS_PER_ROW;i++)books.push([x+(i+.5)*BAY/BOOKS_PER_ROW,y+.30+row*.39,side*(OUTER-.08),.037,.34,.3]);
      }
      for(let j=0;j<8;j++)uprights.push([x+j*BAY/8,y+1.63,side*(OUTER-.03),.055,3.25,.46]);
      const mesh=batch(books,[bookMat,goldMat],detailGroup,bookGeometry);
      const backing=batch([[x+BAY/2,y+1.62,side*(OUTER+.22),BAY,3.18,.28]],shelfBackMat,detailGroup);
      bookBatches.push({...cell,mesh,parts:[mesh,backing,batch(boards,woodMat,detailGroup,shelfFrame.board),batch(uprights,woodMat,detailGroup,shelfFrame.upright)]});
    }
    refreshBookColors();
  }
  // Bounded window of repeated geometry; shifted around the walker, never an end wall.
  let centerX=Infinity, centerY=Infinity,nearBaseY=0;
  function rebuild(px:number,py:number) {
    const bx=Math.floor(px/BAY), fy=Math.round(py/HEIGHT);
    const nearEnd=(level:number)=>[cornerLimits.minY,cornerLimits.maxY].some(bound=>bound!==undefined&&Math.abs(level*HEIGHT-bound)<34*HEIGHT);
    if(bx===centerX&&(fy===centerY||(!nearEnd(fy)&&!nearEnd(centerY)))){
      if(fy!==centerY){
        // Every level has the same architecture. Translate the existing detailed
        // window during flight/fall instead of rebuilding it 14 times a second.
        group.position.y=(fy-nearBaseY)*HEIGHT;distantGroup.position.y=fy*HEIGHT;centerY=fy;
      }
      return;
    }
    centerX=bx;centerY=fy;nearBaseY=fy;group.position.y=0;
    while(group.children.length) {const child=group.children[0];group.remove(child);if(child instanceof T.InstancedMesh)child.dispose();}
    // Signs have per-window assets; release before replacing them.
    while(textures.length>baseTextureCount)textures.pop()!.dispose();
    while(materials.length>baseMaterialCount)materials.pop()!.dispose();
    while(geometries.length>baseGeometryCount)geometries.pop()!.dispose();
    const returnPlacements:BedPlacement[]=[],bbqPlacements:BedPlacement[]=[],propContacts:Box[]=[],bedPlacements:BedPlacement[]=[],bedContacts:Box[]=[],bathroomPlacements:BathroomPlacement[]=[],bathroomContacts:Box[]=[];
    const decks:Box[]=[], slabs:Box[]=[], floors:Box[]=[], shelves:Box[]=[], trim:Box[]=[], rails:Box[]=[], lamps:Box[]=[], walls:Box[]=[], dark:Box[]=[], screens:Box[]=[];
    const tiles:Box[]=[];
    for(let f=fy-32;f<=fy+32;f++)for(let b=bx-15;b<=bx+15;b++)for(const side of [-1,1]) {
      const x=b*BAY,y=f*HEIGHT,z=side*(INNER+1.8288), amenity=mod(b,12)===0;
      if(y<(cornerLimits.minY??-Infinity)-.001||y>(cornerLimits.maxY??Infinity)+.001)continue;
      // Carpet is the top face of one solid deck, never a second coplanar mesh.
      decks.push([x+BAY/2,y-.17,z,BAY,.34,3.6576]);
      // At the top there is no next floor to supply the gallery ceiling.
      if(cornerLimits.maxY!==undefined&&Math.abs(y+HEIGHT-.34-cornerLimits.maxY)<.001)
        slabs.push([x+BAY/2,y+HEIGHT-.17,z,BAY,.34,3.6576]);
      rails.push([x+BAY/2,y+1.2192,side*INNER,BAY,0,0],[x+BAY/2,y+.55,side*INNER,BAY,0,0]);
      for(let j=0;j<6;j++)rails.push([x+j*BAY/6,y+.6,side*INNER,0,1.2,0]);
      for(let j=0;j<3;j++)lamps.push([x+3.81+j*7.62,y+HEIGHT-.38,z,1.6,.035,.28]);
      if(!amenity) {
        shelves.push([x+BAY/2,y+1.62,side*(OUTER+.035),BAY,3.18,.65]);
        walls.push([x+BAY/2,y+(3.33+HEIGHT-.34)/2,side*(OUTER+.15),BAY,HEIGHT-.34-3.33,.3]);
        trim.push([x+BAY/2,y+3.28,side*(OUTER-.04),BAY,.10,.5],[x+BAY/2,y+.045,side*(OUTER-.04),BAY,.09,.5]);
      }else {
        walls.push([x+.5,y+1.81,side*(OUTER+.15),1,3.62,.3],[x+15.5,y+1.81,side*(OUTER+.15),1,3.62,.3],[x+17,y+1.81,side*(OUTER+.15),2,3.62,.3],[x+22,y+1.81,side*(OUTER+.15),4,3.62,.3]);
        const stairs=staircase(x,y,side,cornerLimits);
        walls.push(...stairs.walls);floors.push(...stairs.floors);slabs.push(...stairs.steps);
        if(cornerLimits.maxY!==undefined&&Math.abs(y+HEIGHT-.34-cornerLimits.maxY)<.001){
          slabs.push([x+20,y+HEIGHT-.18,side*(OUTER+DORM.depth/2),8,.36,DORM.depth],
            [x+25+BATH_SHIFT,y+HEIGHT-.18,side*(OUTER+2.5),6,.36,5]);
        }
        // Dormitory, seven beds, book return and food dispenser.
        // Each room deck also forms the ceiling below; never overlap two slabs.
        floors.push([x+20,y-.18,side*(OUTER+DORM.depth/2),8,.36,DORM.depth]);
        walls.push([x+20,y+1.81,side*(OUTER+DORM.depth),8,3.62,.2],
          [x+DORM.left,y+1.81,side*(OUTER+DORM.depth/2),.2,3.62,DORM.depth],
          [x+DORM.right,y+1.81,side*(OUTER+DORM.bathDoorStart/2),.2,3.62,DORM.bathDoorStart],
          [x+DORM.right,y+1.81,side*(OUTER+(DORM.bathDoorEnd+DORM.depth)/2),.2,3.62,DORM.depth-DORM.bathDoorEnd],
          [x+DORM.right,y+3.1,side*(OUTER+(DORM.bathDoorStart+DORM.bathDoorEnd)/2),.2,1,DORM.bathDoorEnd-DORM.bathDoorStart]);
        for(const bed of DORM_BEDS) {
          const xx=x+bed.x,zz=side*(OUTER+bed.depth),head=side*bed.head;
          bedPlacements.push({x:xx,y,z:zz,side:head});
          bedContacts.push([xx,y+.515,zz,.922,.215,1.688],[xx,y+.79,zz+head*.855,.94,.32,.055]);
        }
        // Bathroom attached to the sleeping room; an open doorway meets its aisle.
        tiles.push([x+25+BATH_SHIFT,y-.18,side*(OUTER+2.5),6,.36,5]);
        walls.push([x+25+BATH_SHIFT,y+1.81,side*(OUTER+.325),6,3.62,.35],
          [x+25+BATH_SHIFT,y+1.81,side*(OUTER+5),6,3.62,.2],
          [x+28+BATH_SHIFT,y+1.81,side*(OUTER+2.5),.2,3.62,5]);

        bathroomPlacements.push({x:x+25+BATH_SHIFT,y,z:side*(OUTER+2.5),side});
        for(const [dx,dy,dz,w,h,d] of BATHROOM_CONTACTS)
          bathroomContacts.push([x+25+BATH_SHIFT+dx,y+dy,side*(OUTER+2.5+dz),w,h,d]);
        bbqPlacements.push({x:x+17,y,z:side*(OUTER-.49),side});
        propContacts.push([x+17,y+.46,side*(OUTER-.49),.74,.85,.87],
          [x+17,y+.94,side*(OUTER-.49),.9,.08,1.1]);
        returnPlacements.push({x:x+21.43,y,z:side*(OUTER-.16),side});
        propContacts.push([x+21.43,y+.62,side*(OUTER-.16),.5,1.24,.44]);
        for(const lamp of ROOM_LIGHTS){
          if(lamp.y>HEIGHT&&cornerLimits.maxY!==undefined&&y+lamp.y>cornerLimits.maxY)continue;
          lamps.push([x+lamp.x,y+lamp.y,side*(OUTER+lamp.z),1.6,.035,.28]);
        }
      }
    }
    beds.set(bedPlacements);bathrooms.set(bathroomPlacements);returns.set(returnPlacements);bbq.set(bbqPlacements);
    batch(tiles,[slabMat,tileMat],group,deckGeometry);
    const deckMaterials=[slabMat,floorMat];
    batch(decks,deckMaterials,group,deckGeometry);batch(slabs,slabMat);batch(floors,[slabMat,floorMat],group,deckGeometry);batch(shelves,shelfMat);batch(trim,woodMat);pipes(rails);batch(lamps,lightMat);batch(walls,wallMat);batch(dark,darkMat);batch(screens,screenMat);
    // Capture the actual room geometry once per lighting variant. Sample a complete
    // amenity cell near this window, even after random starts or origin shifts.
    const roomX=Math.round(bx/12)*PERIOD;
    const topFloor=cornerLimits.maxY===undefined?Infinity:Math.round((cornerLimits.maxY-HEIGHT+.34)/HEIGHT);
    const bottomFloor=cornerLimits.minY===undefined?-Infinity:Math.round(cornerLimits.minY/HEIGHT);
    const normalFloor=Math.max(bottomFloor+2,Math.min(fy,topFloor-2));
    const contacts=(floor:number)=>()=>roomOccluders([decks,slabs,floors,shelves,trim,lamps,walls,dark,screens,tiles,bedContacts,bathroomContacts,propContacts].flat(),new T.Vector3(roomX,floor*HEIGHT,0));
    lighting.bakeRoomContacts(contacts(normalFloor));
    if(topFloor>=fy-31&&topFloor<=fy+31)
      lighting.bakeRoomContacts(contacts(topFloor),true);
    // This periodic horizon never needs to be regenerated when walking. Moving its
    // origin by whole bays/floors preserves the same shelf and lamp alignment.
    distantGroup.position.set(bx*BAY,fy*HEIGHT,0);
    if(distantGroup.children.length===0){
    const farSlabs:Box[]=[],farRails:Box[]=[],farHeaders:Box[]=[];
    const farShelves:[Box[],Box[]]=[[],[]],farLamps:[Box[],Box[]]=[[],[]];
    for(let f=-2400;f<=2400;f++) {
      // No overlap with the full-detail rectangle above.
      const strips=Math.abs(f)<=32
        ? [{start:-420,count:405,material:1},{start:16,count:405,material:1}]
        : [{start:-420,count:841,material:0}];
      for(const strip of strips)for(const side of [-1,1]) {
        const width=strip.count*BAY,x=(strip.start+strip.count/2)*BAY,y=f*HEIGHT,z=side*(INNER+1.8288);
        farHeaders.push([x,y+(3.33+HEIGHT-.34)/2,side*(OUTER+.15),width,HEIGHT-.34-3.33,.3]);
        farSlabs.push([x,y-.17,z,width,.34,3.6576]);
        farShelves[strip.material].push([x,y+1.62,side*(OUTER+.035),width,3.18,.65]);
        farLamps[strip.material].push([x,y+HEIGHT-.38,z,width,.035,.28]);
        farRails.push([x,y+1.2192,side*INNER,width,.07,.07],[x,y+.55,side*INNER,width,.07,.07]);
      }
    }
    batchDistant(farHeaders,distantWallMat,distantShelfGeometry);
    batchDistant(farSlabs,[distantSlabMat,distantFloorMat],deckGeometry);batchDistant(farRails,distantRailMat,distantRailGeometry);
    for(let i=0;i<2;i++){batchDistant(farShelves[i],farShelfMaterials[i],distantShelfGeometry);batchDistant(farLamps[i],farLampMaterials[i],distantLampGeometry);}
    }
  }
  function update(px:number,py:number,camera?:T.Camera){
    rebuild(px,py);
    returns.update(camera?.position??new T.Vector3(px,py+1.68,INNER+1.7),group.position.y);
    bbq.update(camera?.position??new T.Vector3(px,py+1.68,INNER+1.7),group.position.y);
    bathrooms.update(camera?.position??new T.Vector3(px,py+1.68,INNER+1.7),group.position.y);
    beds.update(camera?.position??new T.Vector3(px,py+1.68,INNER+1.7),group.position.y);
    updateDetails(camera?.position??new T.Vector3(px,py+1.68,INNER+1.7));
    endWall.position.y=py;endCap.position.x=px;updateFixtures(px,py);
    if(!camera)return;
    camera.updateMatrixWorld();horizon.update(camera);clipMatrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(clipMatrix);
    stairCulling.update(group,camera,frustum,cornerLimits,occlusionEnabled);
    for(const {mesh,bounds} of distantBatches){worldBounds.copy(bounds).translate(distantGroup.position);mesh.visible=frustum.intersectsBox(worldBounds);}
  }
  return { setOcclusionEnabled(enabled:boolean){occlusionEnabled=enabled;},update, markOpened,setLimits,refreshBookColors, dispose(){shelfFrame.dispose();returns.dispose();bbq.dispose();bathrooms.dispose();beds.dispose();stairCulling.dispose();wallWriting.dispose();boundary.dispose();frames.dispose();lenses.dispose();scene.remove(boundaryGroup);endGeometry.dispose();capGeometry.dispose();horizon.dispose();lighting.dispose();scene.remove(group,distantGroup,detailGroup);for(const root of [group,distantGroup,detailGroup])root.traverse(o=>{if(o instanceof T.InstancedMesh)o.dispose();});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());} };
}

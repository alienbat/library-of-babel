/** Exact coordinates are stored once, as binary, outside localStorage. */
export type LocationAnchor={id:string;floorHex:string;sectionHex:string};
const anchors=new Map<string,LocationAnchor>(),pending=new Map<string,LocationAnchor>();
export function registerLocation(anchor:LocationAnchor){
  if(!/^[a-zA-Z0-9-]{1,80}$/.test(anchor.id)||![anchor.floorHex,anchor.sectionHex].every(s=>/^[0-9a-f]+$/i.test(s)))throw new Error('Invalid saved library location');
  const old=anchors.get(anchor.id);
  if(old&&(old.floorHex!==anchor.floorHex||old.sectionHex!==anchor.sectionHex))throw new Error('Conflicting library location');
  anchors.set(anchor.id,anchor);
}
export function resolveLocation(id:string){const anchor=anchors.get(id);if(!anchor)throw new Error('Saved library location is unavailable.');return anchor;}
export function referenceLocation(floorHex:string,sectionHex:string){
  floorHex=floorHex.replace(/^0+(?=.)/,'').toLowerCase();sectionHex=sectionHex.replace(/^0+(?=.)/,'').toLowerCase();
  for(const a of anchors.values())if(a.floorHex===floorHex&&a.sectionHex===sectionHex)return a.id;
  let id:string;do{id=crypto.randomUUID();}while(anchors.has(id));
  const anchor={id,floorHex,sectionHex};registerLocation(anchor);pending.set(id,anchor);return id;
}
export function hexBytes(hex:string){const padded=hex.length%2?'0'+hex:hex;return Uint8Array.from({length:padded.length/2},(_,i)=>parseInt(padded.slice(i*2,i*2+2),16));}
export function bytesHex(bytes:Uint8Array){return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('').replace(/^0+(?=.)/,'');}
let database:Promise<IDBDatabase>|undefined;
function open(){return database??=new Promise((resolve,reject)=>{const req=indexedDB.open('babel-locations-v1',1);req.onupgradeneeded=()=>req.result.createObjectStore('locations',{keyPath:'id'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
export async function loadLocations(){const db=await open();await new Promise<void>((resolve,reject)=>{const tx=db.transaction('locations'),req=tx.objectStore('locations').getAll();req.onsuccess=()=>{try{for(const a of req.result)registerLocation({id:a.id,floorHex:bytesHex(a.floor),sectionHex:bytesHex(a.section)});}catch(e){reject(e);}};tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
export async function persistLocations(){
  if(!pending.size)return;const entries=[...pending.values()],db=await open();
  await new Promise<void>((resolve,reject)=>{const tx=db.transaction('locations','readwrite');for(const a of entries)tx.objectStore('locations').put({id:a.id,floor:hexBytes(a.floorHex),section:hexBytes(a.sectionHex)});tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error??new Error('Location storage transaction failed'));tx.onerror=()=>reject(tx.error);});
  for(const a of entries)pending.delete(a.id);
}

export async function clearLocationStorage(){const db=await open();await new Promise<void>((resolve,reject)=>{const tx=db.transaction('locations','readwrite');tx.objectStore('locations').clear();tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});anchors.clear();pending.clear();}

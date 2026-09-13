import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {referenceLocation,resolveLocation,registerLocation,persistLocations,loadLocations,clearLocationStorage,hexBytes,bytesHex} from '../lib/game/location-store.ts';
void test('binary coordinates round trip exactly and deduplicate by full address',async()=>{
  await clearLocationStorage();
  const floor='f12345'.repeat(10000),section='abcde'.repeat(10000),id=referenceLocation(floor,section);
  assert.equal(referenceLocation(floor,section),id);
  assert.equal(referenceLocation('000'+floor,section.toUpperCase()),id);
  assert.equal(bytesHex(hexBytes(floor)),floor);
  assert.equal(bytesHex(hexBytes('0')),'0');
  assert.throws(()=>registerLocation({id,floorHex:'1',sectionHex:'2'}),/Conflicting/);
  const originalTransaction=IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction=function(){throw new DOMException('Full','QuotaExceededError');};
  try{await assert.rejects(persistLocations(),/Full/);}finally{IDBDatabase.prototype.transaction=originalTransaction;}
  // Failed writes remain pending and can be retried before publishing a reference.
  await persistLocations();await loadLocations();
  const reloaded=await import(new URL('../lib/game/location-store.ts?reload',import.meta.url).href);
  await reloaded.loadLocations();assert.deepEqual(reloaded.resolveLocation(id),{id,floorHex:floor,sectionHex:section});
  assert.deepEqual(resolveLocation(id),{id,floorHex:floor,sectionHex:section});
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open('babel-locations-v1');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  const stored=await new Promise<{id:string;floor:Uint8Array;section:Uint8Array}[]>((resolve,reject)=>{const req=db.transaction('locations').objectStore('locations').getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  assert.equal(stored.length,1);assert.deepEqual(Object.keys(stored[0]).sort(),['floor','id','section']);
  assert.ok(stored[0].floor instanceof Uint8Array);assert.equal(stored[0].floor.byteLength,Math.ceil(floor.length/2));
  await clearLocationStorage();assert.throws(()=>resolveLocation(id),/unavailable/);db.close();
});

export const DETAIL_STORAGE='babel-detail-v1';
export function readDetail(storage:Pick<Storage,'getItem'>){return storage.getItem(DETAIL_STORAGE)==='high'?'high':'low';}
/** GitHub Pages can share an origin with other apps; clear every game-owned key. */
export function clearAppStorage(storage:Pick<Storage,'length'|'key'|'removeItem'>){
  const keys:string[]=[];
  for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key?.startsWith('babel-'))keys.push(key);}
  for(const key of keys)storage.removeItem(key);
}

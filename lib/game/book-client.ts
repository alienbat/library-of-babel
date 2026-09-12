import type {WalkDirection,WalkResult} from './journey.ts';
import type {Position,WorldLimits} from './physics.ts';
export type TargetLanding={frame:GlobalFrame;position:Position;limits:WorldLimits;side:-1|1;row:number};
import {BOOKMARK_STORAGE,type Bookmark} from './bookmarks.ts';
import type {NavigationAnchor} from './search.ts';
import {globalBook,newFrame,type GlobalBook,type GlobalFrame} from './global-books.ts';
import {loadOpened,type BookLocation} from './books.ts';
const STORAGE='babel-global-opened-v2';
type Reply={id:number;landing?:TargetLanding;journeyWalk?:WalkResult;bookmarks?:Bookmark[];bookmark?:Bookmark|null;navigation?:NavigationAnchor|null;foundPrefix?:string;text?:string;opened:string[];history?:GlobalBook[];error?:string};
export function createBookClient(onHistory:(ids:string[])=>void,onStorageWarning:()=>void,workerUrl:string,onNavigation:(anchor:NavigationAnchor|null)=>void=()=>{},onBookmarks:(records:Bookmark[])=>void=()=>{}){
  let frame=newFrame(),sequence=0,frameVersion=0,failure:Error|undefined;
  const pending=new Map<number,{resolve:(r:Reply)=>void;reject:(e:Error)=>void;version:number}>();
  let worker:Worker|undefined;
  try{worker=new Worker(workerUrl,{type:'module'});}
  catch(error){failure=new Error(`The book generator could not start: ${error instanceof Error?error.message:String(error)}`);}
  if(worker)worker.onmessage=(event:MessageEvent<Reply>)=>{
    const reply=event.data,request=pending.get(reply.id);if(!request)return;pending.delete(reply.id);
    if(reply.error){request.reject(new Error(reply.error));return;}
    if(request.version===frameVersion){onHistory(reply.opened);if(reply.navigation!==undefined)onNavigation(reply.navigation);}
    try{if(reply.history)localStorage.setItem(STORAGE,JSON.stringify(reply.history));}catch{onStorageWarning();}
    if(reply.bookmarks){try{localStorage.setItem(BOOKMARK_STORAGE,JSON.stringify(reply.bookmarks));}catch{onStorageWarning();}onBookmarks(reply.bookmarks);}
    request.resolve(reply);
  };
  function fail(message:string){
    failure=new Error(message);
    console.error('Book worker failure:',message);
    for(const request of pending.values())request.reject(failure);
    pending.clear();
  }
  if(worker)worker.onerror=(event)=>fail(event.message
    ?`Book generation stopped: ${event.message}`
    :'The book generator could not load. Reload the page to retry.');
  if(worker)worker.onmessageerror=()=>fail('The book generator returned an unreadable response. Reload the page to retry.');
  function request(action:string,extra:object={}){
    if(failure)return Promise.reject(failure);
    const id=++sequence;
    return new Promise<Reply>((resolve,reject)=>{pending.set(id,{resolve,reject,version:frameVersion});try{worker!.postMessage({id,action,frame,...extra});}catch(error){pending.delete(id);reject(error instanceof Error?error:new Error(String(error)));}});
  }
  let history:GlobalBook[]=[];
  try{
    const saved=localStorage.getItem(STORAGE);
    if(saved){const parsed:unknown=JSON.parse(saved);if(Array.isArray(parsed))history=parsed;}
    else for(const id of loadOpened(localStorage)){
      const match=/^v1\/L(-?\d+)\/([NS])\/S(-?\d+)\/B(\d+)$/.exec(id);if(!match)continue;
      const shelf=Number(match[3]);history.push({frame:newFrame(),level:Number(match[1]),side:match[2]==='N'?1:-1,bay:Math.floor(shelf/8),row:((shelf%8)+8)%8,book:Number(match[4])-1});
    }
  }catch{onStorageWarning();}
  let bookmarks:Bookmark[]=[];
  try{const parsed:unknown=JSON.parse(localStorage.getItem(BOOKMARK_STORAGE)||'[]');if(Array.isArray(parsed))bookmarks=parsed;}catch{onStorageWarning();}
  void request('init',{history,bookmarks}).catch(()=>{});
  return {
    setFrame(next:GlobalFrame){frame={...next};frameVersion++;onHistory([]);onNavigation(null);void request('history').catch(()=>{});},
    async search(prefix:string){
      const version=frameVersion,reply=await request('search',{prefix});
      if(version!==frameVersion)await request('history');
      return reply.foundPrefix!;
    },
    async uploadBook(text:string){const version=frameVersion;await request('upload-book',{text});if(version!==frameVersion)await request('history');},
    async targetLanding(){return (await request('target-teleport')).landing!;},
    async walk(position:Position,direction:WalkDirection,years:string){return (await request('journey-walk',{position,direction,years})).journeyWalk!;},
    async getBookmark(book:BookLocation){return (await request('bookmark-get',{book:globalBook(book,book.frame??frame)})).bookmark??null;},
    async saveBookmark(book:BookLocation,name:string,page:number){return (await request('bookmark-save',{book:globalBook(book,book.frame??frame),name,page})).bookmark!;},
    async deleteBookmark(book:BookLocation){await request('bookmark-delete',{book:globalBook(book,book.frame??frame)});},
    async trackBookmark(bookmarkId:string){const version=frameVersion;await request('bookmark-track',{bookmarkId});if(version!==frameVersion)await request('history');},
    clearTarget(){onNavigation(null);void request('clear-target').catch(()=>{});},
    async page(book:BookLocation,page:number){const reply=await request('page',{book:globalBook(book,book.frame??frame),page});return reply.text!;},
    dispose(){worker?.terminate();for(const request of pending.values())request.reject(new Error('Reader closed'));pending.clear();},
  };
}

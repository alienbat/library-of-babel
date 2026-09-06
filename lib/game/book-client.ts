import {globalBook,newFrame,type GlobalBook,type GlobalFrame} from './global-books.ts';
import {loadOpened,type BookLocation} from './books.ts';
const STORAGE='babel-global-opened-v2';
type Reply={id:number;text?:string;opened:string[];history?:GlobalBook[];error?:string};
export function createBookClient(onHistory:(ids:string[])=>void,onStorageWarning:()=>void){
  const worker=new Worker(new URL('./book-worker.ts',import.meta.url),{type:'module'});
  let frame=newFrame(),sequence=0,frameVersion=0,failure:Error|undefined;
  const pending=new Map<number,{resolve:(r:Reply)=>void;reject:(e:Error)=>void;version:number}>();
  worker.onmessage=(event:MessageEvent<Reply>)=>{
    const reply=event.data,request=pending.get(reply.id);if(!request)return;pending.delete(reply.id);
    if(reply.error){request.reject(new Error(reply.error));return;}
    if(request.version===frameVersion)onHistory(reply.opened);
    try{if(reply.history)localStorage.setItem(STORAGE,JSON.stringify(reply.history));}catch{onStorageWarning();}
    request.resolve(reply);
  };
  function fail(message:string){
    failure=new Error(message);
    console.error('Book worker failure:',message);
    for(const request of pending.values())request.reject(failure);
    pending.clear();
  }
  worker.onerror=(event)=>fail(event.message
    ?`Book generation stopped: ${event.message}`
    :'The book generator could not load. Reload the page to retry.');
  worker.onmessageerror=()=>fail('The book generator returned an unreadable response. Reload the page to retry.');
  function request(action:string,extra:object={}){
    if(failure)return Promise.reject(failure);
    const id=++sequence;
    return new Promise<Reply>((resolve,reject)=>{pending.set(id,{resolve,reject,version:frameVersion});try{worker.postMessage({id,action,frame,...extra});}catch(error){pending.delete(id);reject(error instanceof Error?error:new Error(String(error)));}});
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
  void request('init',{history}).catch(()=>{});
  return {
    setFrame(next:GlobalFrame){frame={...next};frameVersion++;onHistory([]);void request('history').catch(()=>{});},
    async page(book:BookLocation,page:number){const reply=await request('page',{book:globalBook(book,book.frame??frame),page});return reply.text!;},
    dispose(){worker.terminate();for(const request of pending.values())request.reject(new Error('Reader closed'));pending.clear();},
  };
}

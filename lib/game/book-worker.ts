import {bookmarkName,bookmarkPage,upsertBookmark,type Bookmark} from './bookmarks.ts';
import {matchingOrdinalDigits,MAX_PREFIX,type SearchAddress} from './search.ts';
import {createPortableBookMath} from './portable-books';
import {permuteDigits,textPage,type GlobalBook,type GlobalFrame} from './global-books';
import {bookId,localBookId} from './books';
let targetAddress:SearchAddress|null=null;
let bookmarks:Bookmark[]=[];
let records:GlobalBook[]=[],cached:Uint8Array|undefined,cachedExpression='';
const knownExpressions=new Set<string>();
let projectionFrame='',projectionDirty=true,projected:string[]=[];
// Queue requests behind WASM initialization and preserve init/history/page order.
const ready=createPortableBookMath();
// Attach a rejection handler immediately; each request still receives the actual error.
void ready.catch(()=>{});
let queue=Promise.resolve();
self.onmessage=(event:MessageEvent)=>{
  queue=queue.then(async()=>{
    try{const math=await ready;math.withContext(api=>handle(event,api));}
    catch(error){self.postMessage({id:event.data.id,error:error instanceof Error?error.message:'Book generation failed'});}
  });
};
function handle(event:MessageEvent,{walk,bookOrdinal,digits,projectBook,fromDigits,addressFromOrdinal,navigation}:Parameters<Parameters<Awaited<ReturnType<typeof createPortableBookMath>>['withContext']>[0]>[0]){
  const {id,action,book,page,frame,history}=event.data;
  try{
    const journeyWalk=action==='journey-walk'?walk(frame,event.data.position,event.data.direction,event.data.years):undefined;
    let changed=false,bookmarksChanged=false;
    let bookmark:Bookmark|null|undefined;
    let foundPrefix:string|undefined;
    if(action==='search'){
      const prefix=event.data.prefix;
      if(typeof prefix!=='string'||prefix.length>MAX_PREFIX)throw new RangeError('Invalid search text');
      const index=fromDigits(matchingOrdinalDigits(prefix));
      targetAddress=addressFromOrdinal(index);foundPrefix=prefix;
    }
    if(action==='bookmark-get'||action==='bookmark-save'||action==='bookmark-delete'){
      const index=bookOrdinal(book);
      bookmark=bookmarks.find(b=>bookOrdinal(b.book).isEqual(index))??null;
      if(action==='bookmark-save'){
        bookmark=upsertBookmark(bookmarks,book,event.data.name,page,(a,b)=>bookOrdinal(a).isEqual(bookOrdinal(b)),bookId(book));bookmarksChanged=true;
      }
      if(action==='bookmark-delete'){
        if(bookmark)bookmarks=bookmarks.filter(b=>b.id!==bookmark!.id);
        bookmark=null;bookmarksChanged=true;
      }
    }
    if(action==='bookmark-track'){
      const saved=bookmarks.find(b=>b.id===event.data.bookmarkId);
      if(!saved)throw new RangeError('This bookmark no longer exists.');
      targetAddress=addressFromOrdinal(bookOrdinal(saved.book));
    }
    if(action==='clear-target')targetAddress=null;
    if(action==='init'){
      bookmarks=[];
      for(const saved of Array.isArray(event.data.bookmarks)?event.data.bookmarks:[]){
        try{
          bookOrdinal(saved.book);bookmarkName(saved.name);bookmarkPage(saved.page);
          upsertBookmark(bookmarks,saved.book,saved.name,saved.page,(a,b)=>bookOrdinal(a).isEqual(bookOrdinal(b)),bookId(saved.book));
        }catch{/* Ignore malformed saved entries. */}
      }
      bookmarksChanged=true;
      knownExpressions.clear();cachedExpression='';
      records=(history as GlobalBook[]).filter(record=>{try{bookOrdinal(record);return true;}catch{return false;}});
      records.forEach(record=>knownExpressions.add(bookId(record)));projectionDirty=true;changed=true;
    }
    let text:string|undefined;
    if(action==='page'){
      const expression=bookId(book);
      if(expression!==cachedExpression){
        const index=bookOrdinal(book);
        cached=permuteDigits(digits(index));
        cachedExpression=expression;
        if(!knownExpressions.has(expression)){
          // Expressions using different anchors are compared by exact canonical ordinal.
          if(!records.some(record=>bookOrdinal(record).isEqual(index))){records.push(book);changed=true;projectionDirty=true;}
          knownExpressions.add(expression);
        }
      }
      text=textPage(cached!,page);
    }
    const frameKey=JSON.stringify(frame);
    if(projectionDirty||frameKey!==projectionFrame){
      projected=records.map(record=>projectBook(record,frame as GlobalFrame)).filter(b=>b!==null).map(localBookId);
      projectionFrame=frameKey;projectionDirty=false;
    }
    self.postMessage({id,text,foundPrefix,...(journeyWalk?{journeyWalk}:{}),...(bookmark!==undefined?{bookmark}:{}),...(bookmarksChanged?{bookmarks}:{}),...(['search','history','clear-target','bookmark-track'].includes(action)?{navigation:targetAddress?navigation(targetAddress,frame):null}:{}),opened:projected,...(changed?{history:records}:{})});
  }catch(error){self.postMessage({id,error:error instanceof Error?error.message:'Book generation failed'});}
};

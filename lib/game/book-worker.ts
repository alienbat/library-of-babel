import {loadLocations,persistLocations} from './location-store';
import {bookmarkName,bookmarkPage,upsertBookmark,type Bookmark} from './bookmarks.ts';
import {matchingOrdinalDigits,uploadedContent,exactOrdinalDigits,MAX_PREFIX,type SearchAddress} from './search.ts';
import {createPortableBookMath} from './portable-books';
import {permuteDigits,textPage,type GlobalBook,type GlobalFrame} from './global-books';
import {bookId,localBookId} from './books';
let targetAddress:SearchAddress|null=null,targetFrame:GlobalFrame|null=null;
let bookmarks:Bookmark[]=[];
let records:GlobalBook[]=[],cached:Uint8Array|undefined,cachedExpression='';
const knownExpressions=new Set<string>();
let projectionFrame='',projectionDirty=true,projected:string[]=[];
// Queue requests behind WASM initialization and preserve init/history/page order.
const ready=Promise.all([createPortableBookMath(),loadLocations().catch(()=>{/* Ordinary library exploration still works if IndexedDB is disabled. */})]).then(([math])=>math);
// Attach a rejection handler immediately; each request still receives the actual error.
void ready.catch(()=>{});
let queue=Promise.resolve();
self.onmessage=(event:MessageEvent)=>{
  queue=queue.then(async()=>{
    try{const math=await ready;const reply=math.withContext(api=>handle(event,api));await persistLocations();self.postMessage(reply);}
    catch(error){self.postMessage({id:event.data.id,error:error instanceof Error?error.message:'Book generation failed'});}
  });
};
function handle(event:MessageEvent,{referenceFrame,frameForAddress,targetLanding,walk,bookOrdinal,digits,projectBook,fromDigits,addressFromOrdinal,navigation}:Parameters<Parameters<Awaited<ReturnType<typeof createPortableBookMath>>['withContext']>[0]>[0]){
  const {id,action,page,history}=event.data;
  const frame=referenceFrame(event.data.frame as GlobalFrame);
  const book=event.data.book?{...event.data.book,frame:referenceFrame(event.data.book.frame)}:undefined;
  try{
    const journeyWalk=action==='journey-walk'?walk(frame,event.data.position,event.data.direction,event.data.years):undefined;
    let changed=false,bookmarksChanged=false;
    let bookmark:Bookmark|null|undefined;
    let foundPrefix:string|undefined;
    if(action==='upload-book'){
      if(typeof event.data.text!=='string')throw new RangeError('Invalid text file');
      const content=uploadedContent(event.data.text).trimEnd();
      const index=fromDigits(exactOrdinalDigits(content));
      targetAddress=addressFromOrdinal(index);targetFrame=frameForAddress(targetAddress);foundPrefix='Uploaded book matched exactly.';
    }
    if(action==='search'){
      const prefix=event.data.prefix;
      if(typeof prefix!=='string'||prefix.length>MAX_PREFIX)throw new RangeError('Invalid search text');
      const index=fromDigits(matchingOrdinalDigits(prefix));
      targetAddress=addressFromOrdinal(index);targetFrame={destination:'arrival',floorOffset:'0',sectionOffset:'0',originSearch:prefix};foundPrefix=prefix;
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
      targetAddress=addressFromOrdinal(bookOrdinal(saved.book));targetFrame=saved.book.frame;
    }
    if(action==='clear-target'){targetAddress=null;targetFrame=null;}
    let landing;
    if(action==='target-teleport'){if(!targetAddress||!targetFrame)throw new RangeError('Track a book first.');landing=targetLanding(targetAddress,targetFrame);}
    if(action==='init'){
      bookmarks=[];
      for(const saved of Array.isArray(event.data.bookmarks)?event.data.bookmarks:[]){
        try{
          saved.book={...saved.book,frame:referenceFrame(saved.book.frame)};bookOrdinal(saved.book);bookmarkName(saved.name);bookmarkPage(saved.page);
          upsertBookmark(bookmarks,saved.book,saved.name,saved.page,(a,b)=>bookOrdinal(a).isEqual(bookOrdinal(b)),bookId(saved.book));
        }catch{/* Ignore malformed saved entries. */}
      }
      bookmarksChanged=true;
      knownExpressions.clear();cachedExpression='';
      records=[];for(const record of history as GlobalBook[]){try{const normalized={...record,frame:referenceFrame(record.frame)};bookOrdinal(normalized);records.push(normalized);}catch{/* Ignore malformed or unavailable old locations. */}}
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
    return {id,text,foundPrefix,...(action==='reference-frame'?{frame}:{}),...(landing?{landing}:{}),...(journeyWalk?{journeyWalk}:{}),...(bookmark!==undefined?{bookmark}:{}),...(bookmarksChanged?{bookmarks}:{}),...(['upload-book','search','history','clear-target','bookmark-track'].includes(action)?{navigation:targetAddress?navigation(targetAddress,frame):null}:{}),opened:projected,...(changed?{history:records}:{})};
  }catch(error){return {id,error:error instanceof Error?error.message:'Book generation failed'};}
};

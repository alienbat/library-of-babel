import {createPortableBookMath} from './portable-books';
import {permuteDigits,textPage,type GlobalBook,type GlobalFrame} from './global-books';
import {bookId,localBookId} from './books';
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
function handle(event:MessageEvent,{bookOrdinal,digits,projectBook}:Parameters<Parameters<Awaited<ReturnType<typeof createPortableBookMath>>['withContext']>[0]>[0]){
  const {id,action,book,page,frame,history}=event.data;
  try{
    let changed=false;
    if(action==='init'){
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
    self.postMessage({id,text,opened:projected,...(changed?{history:records}:{})});
  }catch(error){self.postMessage({id,error:error instanceof Error?error.message:'Book generation failed'});}
};

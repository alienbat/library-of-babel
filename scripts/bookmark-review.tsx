import React,{useCallback,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BookmarkEditor} from '../components/game/bookmark-editor';
import {createBookClient} from '../lib/game/book-client';
import {newFrame,shiftFrame} from '../lib/game/global-books';
import type {Bookmark} from '../lib/game/bookmarks';
import type {GameHandle} from '../lib/game/engine';
import {coarseNavigation,type NavigationAnchor} from '../lib/game/search';
const initial={frame:newFrame(),level:0,bay:1,side:1 as const,row:3,book:120};
function Review(){
  const [records,setRecords]=useState<Bookmark[]>([]),[anchor,setAnchor]=useState<NavigationAnchor|null>(null),[page,setPage]=useState(0),[book,setBook]=useState(initial),[open,setOpen]=useState(true),[notice,setNotice]=useState('');
  const client=useRef<ReturnType<typeof createBookClient>|null>(null),handle=useRef<GameHandle|null>(null);
  React.useEffect(()=>{
    const c=createBookClient(()=>{},()=>setNotice('Storage unavailable'),'/book-worker.js',setAnchor,records=>{setRecords(records);setNotice('Ready');});client.current=c;
    handle.current={getBookmark:(b)=>c.getBookmark(b),saveBookmark:(b,n,p)=>c.saveBookmark(b,n,p),deleteBookmark:b=>c.deleteBookmark(b)} as GameHandle;
    return ()=>c.dispose();
  },[]);
  const restore=useCallback((p:number)=>setPage(p),[]);
  return <main><h1>Bookmark integration review</h1><p>{notice}</p>
    <button onClick={()=>setPage(p=>Math.min(409,p+1))}>Next page</button><button onClick={()=>setOpen(false)}>Close book</button>
    <button onClick={()=>{setBook(initial);setPage(0);setOpen(true);}}>Reopen book</button>
    <button onClick={()=>{setBook({...initial,frame:shiftFrame(initial.frame,12,100),bay:-11,level:-100});setPage(0);setOpen(true);}}>Open same book after rebase</button>
    <button onClick={()=>client.current?.setFrame(newFrame('top-right'))}>Teleport top-right</button>
    <p>Current page {page+1}</p>
    {open&&notice&&<BookmarkEditor key={JSON.stringify(book)} game={handle} book={book} page={page} onRestore={restore}/>}
    <h2>Saved books ({records.length})</h2><ul>{records.map(b=><li key={b.id}>{b.name} · Page {b.page+1} <button onClick={()=>void client.current?.trackBookmark(b.id)}>Track</button></li>)}</ul>
    {anchor&&<output>{coarseNavigation(anchor,{x:30,y:0,z:16.9},0,0).distance}</output>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<Review/>);

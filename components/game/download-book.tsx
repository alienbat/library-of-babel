'use client';
import {useEffect,useRef,useState,type RefObject} from 'react';
import type {GameHandle} from '../../lib/game/engine';
import type {BookLocation} from '../../lib/game/books';
import {bookDownloadName} from '../../lib/game/book-download';

export function DownloadBook({game,book}:{game:RefObject<GameHandle|null>;book:BookLocation}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const current=useRef<BookLocation|null>(book),inFlight=useRef(false);
  useEffect(()=>{current.current=book;return()=>{current.current=null;};},[book]);
  async function download(){
    const engine=game.current;
    if(!engine||inFlight.current)return;
    inFlight.current=true;setBusy(true);setError('');
    try {
      const bytes=new Uint8Array(await engine.readBook(book));
      const saved=await engine.getBookmark(book);
      const name=await bookDownloadName(bytes,saved?.name);
      if(current.current!==book)return;
      const url=URL.createObjectURL(new Blob([bytes],{type:'text/plain;charset=utf-8'}));
      const link=document.createElement('a');link.href=url;link.download=name;
      document.body.appendChild(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60_000);
    }catch(e){if(current.current===book)setError(e instanceof Error?e.message:'Could not download this book.');}
    finally{inFlight.current=false;if(current.current===book)setBusy(false);}
  }
  return <div className="book-download"><button className="download-link" disabled={busy} onClick={()=>void download()}>{busy?'Preparing download…':'Download this book'}</button>{error&&<span role="alert">{error}</span>}</div>;
}

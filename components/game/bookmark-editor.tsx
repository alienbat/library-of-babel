'use client';
import {useEffect,useState,type RefObject} from 'react';
import type {GameHandle} from '../../lib/game/engine';
import type {BookLocation} from '../../lib/game/books';
import type {Bookmark} from '../../lib/game/bookmarks';
export function BookmarkEditor({game,book,page,onRestore}:{game:RefObject<GameHandle|null>;book:BookLocation;page:number;onRestore:(page:number)=>void}){
  const [name,setName]=useState(''),[saved,setSaved]=useState<Bookmark|null>(null),[busy,setBusy]=useState(true),[ready,setReady]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  useEffect(()=>{
    let cancelled=false;
    if(game.current)void game.current.getBookmark(book).then(value=>{
      if(cancelled)return;setSaved(value);setName(value?.name??'');setReady(true);if(value)onRestore(value.page);
    }).catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:'Could not load bookmark.');}).finally(()=>{if(!cancelled)setBusy(false);});
    return ()=>{cancelled=true;};
  },[game,book,onRestore]);
  async function save(){
    if(!game.current||busy||!name.trim())return;setBusy(true);setMessage('');setError('');
    try{const value=await game.current.saveBookmark(book,name,page);setSaved(value);setName(value.name);setMessage(`Saved “${value.name}” at page ${value.page+1}.`);}
    catch(e){setError(e instanceof Error?e.message:'Could not save bookmark.');}finally{setBusy(false);}
  }
  async function remove(){
    if(!game.current||busy)return;setBusy(true);setMessage('');setError('');
    try{await game.current.deleteBookmark(book);setSaved(null);setName('');setMessage('Bookmark deleted.');}
    catch(e){setError(e instanceof Error?e.message:'Could not delete bookmark.');}finally{setBusy(false);}
  }
  return <section className="bookmark-editor" aria-label="Bookmark this book">
    <form onSubmit={e=>{e.preventDefault();void save();}}>
      <label htmlFor="bookmark-name">Book name <small>(required)</small></label>
      <input id="bookmark-name" required maxLength={120} value={name} onChange={e=>{setName(e.target.value);setMessage('');}} onKeyDown={e=>e.stopPropagation()} placeholder="Give this book a name" disabled={busy||!ready}/>
      <button disabled={busy||!ready||!name.trim()} type="submit">{saved?'Update bookmark':'Save to bookmark'} · Page {page+1}</button>
      {saved&&<button type="button" disabled={busy} onClick={()=>void remove()}>Delete bookmark</button>}
    </form>
    {saved&&<small>Saved page {saved.page+1}. Saving again replaces the name and page.</small>}
    <output>{message}</output>{error&&<span role="alert">{error}</span>}
  </section>;
}

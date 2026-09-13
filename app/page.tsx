'use client';
import {WalkingPanel} from '../components/game/walking-panel';
import {BookmarkEditor} from '../components/game/bookmark-editor';
import type {Bookmark} from '../lib/game/bookmarks';
import {MAX_PREFIX} from '../lib/game/search';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameHandle, GameStats } from '../lib/game/engine';

import {bookId,bookOpeningTitle,turnPage,PAGE_COUNT,type BookLocation} from '../lib/game/books';

import {DESTINATIONS,DESTINATION_LABELS} from '../lib/game/destinations';

export default function Home() {
  const [uploadFile,setUploadFile]=useState<File|null>(null);
  const [prefix,setPrefix]=useState(''),[searchBusy,setSearchBusy]=useState(false),[searchError,setSearchError]=useState(''),[foundPrefix,setFoundPrefix]=useState('');
  const [bookmarks,setBookmarks]=useState<Bookmark[]>([]),[trackedId,setTrackedId]=useState('');
  const menuDialog=useRef<HTMLDialogElement>(null);
  const [menuOpen,setMenuOpen]=useState(false);
  const [debugOpen,setDebugOpen]=useState(false),[saveNotice,setSaveNotice]=useState('');
  const debugDialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{if(debugOpen){debugDialog.current?.showModal();debugDialog.current?.focus();}},[debugOpen]);
  useEffect(()=>{if(menuOpen){menuDialog.current?.showModal();menuDialog.current?.focus();}},[menuOpen]);
  const reader=useRef<HTMLDialogElement>(null),viewport=useRef<HTMLDivElement>(null), game=useRef<GameHandle|null>(null);
  const [ready,setReady]=useState(false),[playing,setPlaying]=useState(false),[entered,setEntered]=useState(false),[error,setError]=useState('');
  const [teleportBusy,setTeleportBusy]=useState(false),[teleportError,setTeleportError]=useState('');
  const [confirmReset,setConfirmReset]=useState(false),[resetError,setResetError]=useState('');
  const resetDialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{if(confirmReset)resetDialog.current?.showModal();},[confirmReset]);
  const [settings,setSettings]=useState(false),[sound,setSound]=useState(true),[motion,setMotion]=useState(false),[fov,setFov]=useState(75),[sensitivity,setSensitivity]=useState(1),[quality,setQuality]=useState('high');
  const [stats,setStats]=useState<GameStats>({floor:'0',distance:'0',mode:'walking',fallSpeed:0}),[drag,setDrag]=useState(false);
  const [target,setTarget]=useState<BookLocation|null>(null),[book,setBook]=useState<BookLocation|null>(null),[page,setPage]=useState(0),[storageWarning,setStorageWarning]=useState(false);
  useEffect(()=>{if(book)reader.current?.showModal();},[book]);
  const [opening,setOpening]=useState<{book:BookLocation|null;text:string}>({book:null,text:''});
  useEffect(()=>{let cancelled=false;if(book)void game.current?.readPage(book,0).then(text=>{if(!cancelled)setOpening({book,text});}).catch(()=>{});return ()=>{cancelled=true;};},[book]);
  const pageKey=book?`${bookId(book)}:${page}`:'';
  const [pageResult,setPageResult]=useState({key:'',text:'',error:''});
  const pageText=pageResult.key===pageKey?pageResult.text:'';
  const pageError=pageResult.key===pageKey?pageResult.error:'';
  useEffect(()=>{
    let cancelled=false;
    if(book)void game.current?.readPage(book,page).then(text=>{if(!cancelled)setPageResult({key:pageKey,text,error:''});}).catch(error=>{if(!cancelled)setPageResult({key:pageKey,text:'',error:error instanceof Error?error.message:'Could not read this book.'});});
    return ()=>{cancelled=true;};
  },[book,page,pageKey]);
  useEffect(()=>{
    let disposed=false;
    import('../lib/game/engine').then(({createGame})=>{
      if(disposed||!viewport.current)return;
      try {game.current=createGame(viewport.current,{onBookmarks:setBookmarks,onPause:()=>setPlaying(false),onStats:next=>{setStats(next);if(next.savedAt)setEntered(true);},onFallback:()=>setDrag(true),onError:setError,onTarget:setTarget,onBook:b=>{setBook(b);setPage(0);},onPage:delta=>setPage(p=>turnPage(p,delta)),onStorageWarning:()=>setStorageWarning(true),onGameMenu:setMenuOpen,onDebugMenu:setDebugOpen,onDestination:()=>{}});setReady(true);}
      catch(error) {console.error('Library startup failed:',error);setError(error instanceof Error?error.message:'The library could not start. Please reload to try again.');}
    }).catch(()=>setError('The library could not load. Please refresh to try again.'));
    return ()=>{disposed=true;game.current?.dispose();game.current=null;};
  },[]);
  useEffect(()=>{game.current?.configure({sound,motion,fov,sensitivity,quality});},[ready,sound,motion,fov,sensitivity,quality]);
  const restoreBookmarkPage=useCallback((savedPage:number)=>setPage(current=>current===0?savedPage:current),[]);
  const enter=()=>{game.current?.start();setEntered(true);setPlaying(true);setSettings(false);};
  useEffect(()=>{
    if(playing||!entered||!ready||error||confirmReset)return;
    const resume=(event:KeyboardEvent)=>{
      if(!['Escape','KeyM'].includes(event.code)||event.repeat)return;
      event.preventDefault();event.stopImmediatePropagation();
      game.current?.start();setPlaying(true);setSettings(false);
    };
    window.addEventListener('keydown',resume,true);
    return ()=>window.removeEventListener('keydown',resume,true);
  },[playing,entered,ready,error,confirmReset]);
  const saveProgress=()=>{try{const when=game.current?.saveProgress();setSaveNotice(when?`Progress saved at ${new Date(when).toLocaleTimeString()}.`:'Enter the library first.');}catch{setSaveNotice('Could not save progress. Browser storage may be unavailable or full.');}};
  const pause=()=>{game.current?.pause();setPlaying(false);};
  const search=async()=>{
    if(!game.current||searchBusy)return;
    setSearchBusy(true);setSearchError('');
    try{setFoundPrefix(await game.current.searchBooks(prefix));setTrackedId('');}
    catch(error){setSearchError(error instanceof Error?error.message:'Could not search. Please try again.');}
    finally{setSearchBusy(false);}
  };
  const uploadBook=async()=>{
    if(!game.current||!uploadFile||searchBusy)return;
    setSearchBusy(true);setSearchError('');
    try{
      if(!/\.txt$/i.test(uploadFile.name))throw new Error('Choose a .txt file.');
      const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(await uploadFile.arrayBuffer());
      await game.current.uploadBook(text);setTrackedId('');setFoundPrefix(`Exact match for ${uploadFile.name}`);
    }catch(e){setSearchError(e instanceof Error?e.message:'Could not process this text file.');}
    finally{setSearchBusy(false);}
  };
  const trackBookmark=async(saved:Bookmark)=>{
    if(!game.current||searchBusy)return;setSearchBusy(true);setSearchError('');
    try{await game.current.trackBookmark(saved.id);setTrackedId(saved.id);setFoundPrefix('');}
    catch(e){setSearchError(e instanceof Error?e.message:'Could not track bookmark.');}finally{setSearchBusy(false);}
  };
  const deleteBookmark=async(saved:Bookmark)=>{
    if(!game.current||searchBusy)return;setSearchBusy(true);setSearchError('');
    try{
      await game.current.deleteBookmark(saved.book);
      if(trackedId===saved.id){game.current.clearSearch();setTrackedId('');}
    }catch(e){setSearchError(e instanceof Error?e.message:'Could not delete bookmark.');}
    finally{setSearchBusy(false);}
  };
  const teleportTarget=async()=>{
    if(!game.current||teleportBusy)return;setTeleportBusy(true);setTeleportError('');
    try{await game.current.teleportToTarget();}
    catch(e){setTeleportError(e instanceof Error?e.message:'Could not teleport to the target book.');}
    finally{setTeleportBusy(false);}
  };
  const trackedBookmark=bookmarks.find(saved=>saved.id===trackedId);
  return <main className={playing?'game playing':'game'}>
    <div ref={viewport} className="viewport" aria-label="First-person view of the Library of Babel" />
    <div className="vignette" aria-hidden="true" />
    <header className="masthead"><div className="identity"><span className="library-mark" aria-hidden="true">Ⅲ</span><span>THE BABEL LIBRARY<small>AFTER STEVEN L. PECK</small></span></div><div className="header-actions"><button onClick={()=>{setSound(!sound);}} aria-label={sound?'Mute audio':'Enable audio'}>{sound?'Sound on':'Sound off'}</button><button onClick={()=>{if(document.fullscreenElement)void document.exitFullscreen();else void document.documentElement.requestFullscreen?.().catch(()=>{});}} aria-label="Toggle fullscreen">⛶</button>{playing&&!book&&<button onClick={()=>game.current?.toggleMenu()}>Actions <kbd>T</kbd></button>}{playing&&!book&&<button onClick={()=>game.current?.toggleFlight()}>{stats.mode==='flying'?'Stop flying':'Fly'} <kbd>Space</kbd></button>}{playing&&<button onClick={pause}>Game Menu <kbd>M</kbd></button>}</div></header>
    {!playing&&<section className="menu" aria-label={entered?'Paused':'Enter the library'}>
      <p className="eyebrow">{entered?'YOUR SEARCH CAN WAIT':'A SHORT STAY IN HELL'}</p>
      <h1>{entered?'A moment\nof stillness.':'The Library\nof Babel.'}</h1>
      <p className="intro">{entered?'The shelves will still be here.':'A hundred feet across. No end in sight.\nSomewhere in these books is your story.'}</p>
      <div className="menu-actions"><button className="enter" onClick={enter} disabled={!ready||!!error}>{error?'Unable to enter':!ready?'Preparing the library…':entered?'Continue walking':'Enter the library'} <span>→</span></button>{entered&&<button className="settings-button" onClick={saveProgress}>Save Progress</button>}<button className="settings-button" onClick={()=>setSettings(!settings)} aria-expanded={settings}>Settings</button></div>
      {!!stats.savedAt&&<small className="save-notice">Last saved: {new Date(stats.savedAt).toLocaleString()}</small>}
      {storageWarning&&<p className="error" role="alert">Browser storage is unavailable or full. Progress and bookmarks may only last for this session.</p>}
      {saveNotice&&<output className="save-notice">{saveNotice}</output>}
      {error&&<p className="error" role="alert">{error}</p>}
      {settings&&<div className="settings"><label>Field of view <span>{fov}°</span><input type="range" min="55" max="100" value={fov} onChange={e=>setFov(+e.target.value)}/></label><label>Mouse sensitivity <span>{sensitivity.toFixed(1)}</span><input type="range" min="0.3" max="2.5" step="0.1" value={sensitivity} onChange={e=>setSensitivity(+e.target.value)}/></label><label className="inline-label">Gentle walking motion<input type="checkbox" checked={motion} onChange={e=>setMotion(e.target.checked)}/></label><label className="inline-label">Detail<select value={quality} onChange={e=>setQuality(e.target.value)}><option value="high">High</option><option value="low">Low</option></select></label><button className="danger-button" onClick={()=>{setResetError('');setConfirmReset(true);}}>Start Over</button></div>}
      <div className="instructions"><span><kbd>W A S D</kbd> Move</span><span><kbd>MOUSE</kbd> Look</span><span><kbd>SHIFT</kbd> Move faster</span><span><kbd>SPACE</kbd> Toggle flight</span><span><kbd>LEFT CLICK</kbd> Read a book</span><span><kbd>T</kbd> Actions</span><span><kbd>M / ESC</kbd> Game Menu</span></div>
      <p className="mobile-instructions">Use the left pad to move. Drag on the right to look. Tap Fly to take off.</p>
    </section>}
    {confirmReset&&<dialog ref={resetDialog} className="reset-dialog" aria-labelledby="reset-title" aria-describedby="reset-description" onCancel={event=>{event.preventDefault();setConfirmReset(false);}}>
      <h2 id="reset-title">Start over?</h2>
      <p id="reset-description">This deletes your saved location, journey distance, time in the library, bookmarks, and opened-book history in this browser. A new journey starts at zero. This cannot be undone.</p>
      {resetError&&<p className="error" role="alert">{resetError}</p>}
      <div className="reset-actions"><button autoFocus onClick={()=>setConfirmReset(false)}>No</button><button className="danger-button" onClick={async()=>{try{await game.current?.startOver();}catch{setResetError('Could not clear progress. Check browser storage permissions and try again.');}}}>Yes</button></div>
    </dialog>}
    {playing&&!book&&!menuOpen&&!debugOpen&&<><span className={target?"crosshair targeting":"crosshair"} aria-hidden="true"/><div className="walking-hint">{target?'Left click to open':stats.mode==='flying'?'WASD follows your view · Look up/down to climb or descend · Space to fall':stats.mode==='falling'?'Falling · Space to fly again':drag?'Drag to look · WASD to walk · Space to fly':'WASD to walk · Mouse to look · Space to fly'}</div>{target&&<button className="read-target" onClick={()=>game.current?.openBook()}>Open book</button>}<div className="touch-pad" aria-label="Movement controls">{(['forward','left','back','right'] as const).map((direction,i)=><button key={direction} className={direction} aria-label={`Walk ${direction}`} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);game.current?.touchMove(direction,true);}} onPointerUp={()=>game.current?.touchMove(direction,false)} onPointerCancel={()=>game.current?.touchMove(direction,false)}>{['↑','←','↓','→'][i]}</button>)}</div></>}
    {playing&&!book&&!menuOpen&&!debugOpen&&stats.navigation&&<aside className="navigation-target" aria-label="Direction to target book">
      <span className="navigation-arrow" style={{transform:`rotate(${stats.navigation.angle}deg)`}} aria-hidden="true">↑</span>
      <div>{trackedBookmark&&<strong className="tracked-book-name">{trackedBookmark.name}</strong>}<strong>{stats.navigation.direction}</strong><p>You are roughly {stats.navigation.distance} away from the target book.</p><small>Coarse bearing · straight-line distance</small></div>
    </aside>}
    {menuOpen&&<dialog ref={menuDialog} className="teleport-dialog game-menu-dialog" tabIndex={-1} aria-label="Actions" onCancel={e=>{e.preventDefault();game.current?.closeMenu();}}>
      <p className="eyebrow">THE BABEL LIBRARY</p><h2>Actions</h2>
      <p className="journey-time">Days in the library: {stats.libraryDays??'0'}<br/>{stats.libraryClock??'0 years · 0 months · 0 days · 00:00:00'}</p>
      <div className="game-menu-sections">
      <section className="menu-search-section" aria-labelledby="menu-search-title">
      <h3 id="menu-search-title">Search library</h3>
      <p>Find one book that starts with your exact text. Matching is case-sensitive; the result is not necessarily the nearest book.</p>
      <form onSubmit={e=>{e.preventDefault();void search();}}>
        <label htmlFor="book-prefix">Beginning of the book</label>
        <textarea id="book-prefix" value={prefix} onChange={e=>setPrefix(e.target.value)} maxLength={MAX_PREFIX} placeholder="My name is Soren" rows={3} onKeyDown={e=>e.stopPropagation()}/>
        <small>Printable ASCII letters, numbers, spaces and punctuation. Up to {MAX_PREFIX.toLocaleString()} characters.</small>
        <button type="submit" disabled={searchBusy||!prefix.length}>{searchBusy?'Finding a matching book…':'Find a matching book'}</button>
      </form>
      <section className="book-upload" aria-label="Upload a book"><h3>Upload a book</h3>
        <p>Choose a UTF-8 .txt file. Tabs are removed; each line break becomes one space. Text is then cut to 1,312,000 characters or padded with spaces. An empty file matches an entirely blank book.</p>
        <input aria-label="Book text file" type="file" accept=".txt,text/plain" disabled={searchBusy} onChange={e=>{setUploadFile(e.target.files?.[0]??null);setSearchError('');}}/>
        <button disabled={searchBusy||!uploadFile} onClick={()=>void uploadBook()}>{searchBusy?'Processing…':'Confirm upload'}</button>
      </section>
      {searchError&&<p role="alert" className="error">{searchError}</p>}
      {foundPrefix&&<output className="search-result"><strong>Matching book found. Navigation target set.</strong><blockquote>{foundPrefix.slice(0,160)}{foundPrefix.length>160?'…':''}</blockquote><p>{stats.navigation?`You are roughly ${stats.navigation.distance} away from the target book.`:'Updating direction…'}</p><small>The target stays set across teleports during this session. At this scale, walking may not visibly change the distance.</small></output>}
      {stats.navigation&&<button disabled={searchBusy} onClick={()=>{game.current?.clearSearch();setFoundPrefix('');setTrackedId('');}}>Clear target</button>}
      <section className="bookmark-list" aria-label="Saved books"><h3>Saved books</h3>
        <p className="bookmark-storage-note">Saved in this browser.</p>
        {bookmarks.length===0?<p>No bookmarks yet. Name and save a book while reading it.</p>:<ul>{bookmarks.map(saved=><li key={saved.id}><span><strong>{saved.name}</strong><small>Page {saved.page+1}</small></span><div className="bookmark-actions"><button disabled={searchBusy} onClick={()=>void trackBookmark(saved)}>Track<span className="sr-only"> {saved.name}</span></button><button disabled={searchBusy} onClick={()=>void deleteBookmark(saved)}>Delete<span className="sr-only"> {saved.name}</span></button></div></li>)}</ul>}
        {trackedBookmark&&<output>Tracking “{trackedBookmark.name}”. {stats.navigation?`Roughly ${stats.navigation.distance} away.`:''}</output>}
        {storageWarning&&<p role="alert">Browser storage is unavailable or full. Changes may only last for this session.</p>}
      </section>
      </section>
      <WalkingPanel game={game}/></div>
      <button className="teleport-cancel" onClick={()=>game.current?.closeMenu()}>Return to library <kbd>T</kbd></button>
    </dialog>}
    {debugOpen&&<dialog ref={debugDialog} tabIndex={-1} className="teleport-dialog" aria-label="Debug teleport menu" onCancel={e=>{e.preventDefault();game.current?.closeMenu();}}>
      <p className="eyebrow">DEBUG / TELEPORT</p><h2>Teleport</h2><p>Jump to a library boundary, your original starting point, or the tracked book. Journey distance and elapsed time are preserved.</p>
      <div className="teleport-grid">{DESTINATIONS.map(place=><button key={place} disabled={teleportBusy} onClick={()=>game.current?.teleport(place)}>{DESTINATION_LABELS[place]}</button>)}<button disabled={teleportBusy||!stats.navigation} onClick={()=>void teleportTarget()}>{teleportBusy?'Finding target…':'Target Book'}</button></div>
      {teleportError&&<p className="error" role="alert">{teleportError}</p>}
      <button className="teleport-cancel" onClick={()=>game.current?.closeMenu()}>Close <kbd>`</kbd></button>
    </dialog>}
    {book&&<dialog ref={reader} className="book-reader" onCancel={e=>{e.preventDefault();game.current?.closeBook();}} aria-modal="true" aria-label="Open library book">
      <div className="reader-toolbar"><span>THE BABEL LIBRARY <small>410 PAGES · 40 LINES · 80 CHARACTERS</small></span><button onClick={()=>game.current?.closeBook()}>Return to shelf <kbd>RIGHT CLICK</kbd></button></div>
      <div className="book-scroll"><article className="book-page" key={`${bookId(book)}:${page}`}>
        <div className="page-running-head">{opening.book===book?bookOpeningTitle(opening.text):' '}</div>
        <pre className="book-text" aria-label={`Page ${page+1} content`}>{pageText||(pageError||'Preparing this book…')}</pre>
        <div className="page-folio">{page+1}</div>
      </article></div>
      <nav className="reader-navigation" aria-label="Book pages"><button disabled={page===0} onClick={()=>setPage(p=>turnPage(p,-1))}>← Previous</button><span aria-live="polite">Page {page+1} of {PAGE_COUNT}</span><button disabled={page===PAGE_COUNT-1} onClick={()=>setPage(p=>turnPage(p,1))}>Next →</button></nav>
      <BookmarkEditor key={bookId(book)} game={game} book={book} page={page} onRestore={restoreBookmarkPage}/>
    </dialog>}
    <footer><span>{playing?(stats.mode==='flying'?'FLYING':stats.mode==='falling'?`FALLING · ${Math.round(stats.fallSpeed / 0.44704)} MPH`:'WALKING'):'AN UNOFFICIAL LITERARY EXPLORATION'}</span><div><span className="library-clock">{stats.libraryClock}</span><span>LEVEL <b>{stats.floor==='0'?'0':`${stats.floor.startsWith('-')?'':'+'}${stats.floor}`}</b></span><span><b>{stats.distance.toLocaleString()}</b> m travelled total</span></div></footer>
  </main>;
}

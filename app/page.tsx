'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameHandle, GameStats } from '../lib/game/engine';

import {bookId,generatePage,turnPage,PAGE_COUNT,type BookLocation} from '../lib/game/books';

export default function Home() {
  const reader=useRef<HTMLDialogElement>(null),viewport=useRef<HTMLDivElement>(null), game=useRef<GameHandle|null>(null);
  const [ready,setReady]=useState(false),[playing,setPlaying]=useState(false),[entered,setEntered]=useState(false),[error,setError]=useState('');
  const [settings,setSettings]=useState(false),[sound,setSound]=useState(true),[motion,setMotion]=useState(false),[fov,setFov]=useState(75),[sensitivity,setSensitivity]=useState(1),[quality,setQuality]=useState('high');
  const [stats,setStats]=useState<GameStats>({floor:0,distance:0,mode:'walking',fallSpeed:0}),[drag,setDrag]=useState(false);
  const [target,setTarget]=useState<BookLocation|null>(null),[book,setBook]=useState<BookLocation|null>(null),[page,setPage]=useState(0),[storageWarning,setStorageWarning]=useState(false);
  useEffect(()=>{if(book)reader.current?.showModal();},[book]);
  const pageText=useMemo(()=>book?generatePage(book,page):'',[book,page]);
  useEffect(()=>{
    let disposed=false;
    import('../lib/game/engine').then(({createGame})=>{
      if(disposed||!viewport.current)return;
      try {game.current=createGame(viewport.current,{onPause:()=>setPlaying(false),onStats:setStats,onFallback:()=>setDrag(true),onError:setError,onTarget:setTarget,onBook:b=>{setBook(b);setPage(0);},onPage:delta=>setPage(p=>turnPage(p,delta)),onStorageWarning:()=>setStorageWarning(true)});setReady(true);}
      catch {setError('The library needs WebGL graphics. Try opening it in a current desktop browser with hardware acceleration enabled.');}
    }).catch(()=>setError('The library could not load. Please refresh to try again.'));
    return ()=>{disposed=true;game.current?.dispose();game.current=null;};
  },[]);
  useEffect(()=>{game.current?.configure({sound,motion,fov,sensitivity,quality});},[ready,sound,motion,fov,sensitivity,quality]);
  const enter=()=>{game.current?.start();setEntered(true);setPlaying(true);setSettings(false);};
  const pause=()=>{game.current?.pause();setPlaying(false);};
  return <main className={playing?'game playing':'game'}>
    <div ref={viewport} className="viewport" aria-label="First-person view of the Library of Babel" />
    <div className="vignette" aria-hidden="true" />
    <header className="masthead"><div className="identity"><span className="library-mark" aria-hidden="true">Ⅲ</span><span>THE BABEL LIBRARY<small>AFTER STEVEN L. PECK</small></span></div><div className="header-actions"><button onClick={()=>{setSound(!sound);}} aria-label={sound?'Mute audio':'Enable audio'}>{sound?'Sound on':'Sound off'}</button><button onClick={()=>{if(document.fullscreenElement)void document.exitFullscreen();else void document.documentElement.requestFullscreen?.().catch(()=>{});}} aria-label="Toggle fullscreen">⛶</button>{playing&&!book&&<button onClick={()=>game.current?.toggleFlight()}>{stats.mode==='flying'?'Stop flying':'Fly'} <kbd>Space</kbd></button>}{playing&&<button onClick={pause}>Pause <kbd>Esc</kbd></button>}</div></header>
    {!playing&&<section className="menu" aria-label={entered?'Paused':'Enter the library'}>
      <p className="eyebrow">{entered?'YOUR SEARCH CAN WAIT':'A SHORT STAY IN HELL'}</p>
      <h1>{entered?'A moment\nof stillness.':'The Library\nof Babel.'}</h1>
      <p className="intro">{entered?'The shelves will still be here.':'A hundred feet across. No end in sight.\nSomewhere in these books is your story.'}</p>
      <div className="menu-actions"><button className="enter" onClick={enter} disabled={!ready||!!error}>{error?'Unable to enter':!ready?'Preparing the library…':entered?'Continue walking':'Enter the library'} <span>→</span></button><button className="settings-button" onClick={()=>setSettings(!settings)} aria-expanded={settings}>Settings</button></div>
      {error&&<p className="error" role="alert">{error}</p>}
      {settings&&<div className="settings"><label>Field of view <span>{fov}°</span><input type="range" min="55" max="100" value={fov} onChange={e=>setFov(+e.target.value)}/></label><label>Mouse sensitivity <span>{sensitivity.toFixed(1)}</span><input type="range" min="0.3" max="2.5" step="0.1" value={sensitivity} onChange={e=>setSensitivity(+e.target.value)}/></label><label className="inline-label">Gentle walking motion<input type="checkbox" checked={motion} onChange={e=>setMotion(e.target.checked)}/></label><label className="inline-label">Detail<select value={quality} onChange={e=>setQuality(e.target.value)}><option value="high">High</option><option value="low">Low</option></select></label><button className="reset" onClick={()=>{game.current?.reset();}}>Return to starting point</button></div>}
      <div className="instructions"><span><kbd>W A S D</kbd> Move</span><span><kbd>MOUSE</kbd> Look</span><span><kbd>SHIFT</kbd> Move faster</span><span><kbd>SPACE</kbd> Toggle flight</span><span><kbd>LEFT CLICK</kbd> Read a book</span><span><kbd>ESC</kbd> Pause</span></div>
      <p className="mobile-instructions">Use the left pad to move. Drag on the right to look. Tap Fly to take off.</p>
    </section>}
    {playing&&!book&&<><span className={target?"crosshair targeting":"crosshair"} aria-hidden="true"/><div className="walking-hint">{target?`Left click to open · ${bookId(target)}`:stats.mode==='flying'?'WASD follows your view · Look up/down to climb or descend · Space to fall':stats.mode==='falling'?'Falling · Space to fly again':drag?'Drag to look · WASD to walk · Space to fly':'WASD to walk · Mouse to look · Space to fly'}</div>{target&&<button className="read-target" onClick={()=>game.current?.openBook()}>Open book</button>}<div className="touch-pad" aria-label="Movement controls">{(['forward','left','back','right'] as const).map((direction,i)=><button key={direction} className={direction} aria-label={`Walk ${direction}`} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);game.current?.touchMove(direction,true);}} onPointerUp={()=>game.current?.touchMove(direction,false)} onPointerCancel={()=>game.current?.touchMove(direction,false)}>{['↑','←','↓','→'][i]}</button>)}</div></>}
    {book&&<dialog ref={reader} className="book-reader" onCancel={e=>{e.preventDefault();game.current?.closeBook();}} aria-modal="true" aria-label="Open library book">
      <div className="reader-toolbar"><span>THE BABEL LIBRARY <small>410 PAGES · 40 LINES · 80 CHARACTERS</small></span><button onClick={()=>game.current?.closeBook()}>Return to shelf <kbd>RIGHT CLICK</kbd></button></div>
      <div className="book-scroll"><article className="book-page" key={`${bookId(book)}:${page}`}>
        <div className="page-running-head">THE LIBRARY</div>
        <pre className="book-text" aria-label={`Page ${page+1} content`}>{pageText}</pre>
        <div className="page-folio">{page+1}</div>
        <div className="book-footnote">{bookId(book)}</div>
      </article></div>
      <nav className="reader-navigation" aria-label="Book pages"><button disabled={page===0} onClick={()=>setPage(p=>turnPage(p,-1))}>← Previous</button><span aria-live="polite">Page {page+1} of {PAGE_COUNT}</span><button disabled={page===PAGE_COUNT-1} onClick={()=>setPage(p=>turnPage(p,1))}>Next →</button></nav>
      <p className="reader-help">← / → Turn page · Right click or Esc to return · Opened books turn teal{storageWarning?' · History can only be kept for this session.': ''}</p>
    </dialog>}
    <footer><span>{playing?(stats.mode==='flying'?'FLYING':stats.mode==='falling'?`FALLING · ${Math.round(stats.fallSpeed / 0.44704)} MPH`:'WALKING'):'AN UNOFFICIAL LITERARY EXPLORATION'}</span><div><span>LEVEL <b>{stats.floor===0?'ARRIVAL':`${stats.floor>0?'+':''}${stats.floor}`}</b></span><span><b>{stats.distance.toLocaleString()}</b> m travelled</span></div></footer>
  </main>;
}

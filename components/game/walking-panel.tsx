'use client';
import {useState,type RefObject} from 'react';
import type {GameHandle} from '../../lib/game/engine';
import {WALK_DIRECTIONS,WALK_YEARS,walkDistanceLabel,bigCount,type WalkDirection} from '../../lib/game/journey';
export function WalkingPanel({game}:{game:RefObject<GameHandle|null>}){
  const [direction,setDirection]=useState<WalkDirection>('East'),[years,setYears]=useState('1'),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  async function walk(){
    if(!game.current||busy)return;setBusy(true);setError('');setMessage('');
    try{const result=await game.current.timedWalk(direction,years);setMessage(`${result.stoppedAtEdge?'Reached the library boundary. ':''}Travelled ${bigCount(BigInt(result.distanceCm)/100n)} metres. Journey totals updated.`);setConfirm(false);}
    catch(e){setError(e instanceof Error?e.message:'Could not complete this walk.');}finally{setBusy(false);}
  }
  const plannedDistance=walkDistanceLabel(years);
  return <section className="walking-panel" aria-label="Long walks"><h3>Walk through the library</h3>
    <p>Walk at 1.7 m/s for 10 hours a day. Each year is 365 days. Travel ends on a gallery floor; up and down are measured as vertical distance.</p>
    <label>Direction<select value={direction} disabled={busy} onChange={e=>{setDirection(e.target.value as WalkDirection);setConfirm(false);}} onKeyDown={e=>e.stopPropagation()}>{WALK_DIRECTIONS.map(d=><option key={d}>{d}</option>)}</select></label>
    <label>Time walking<select value={years} disabled={busy} onChange={e=>{setYears(e.target.value);setConfirm(false);}} onKeyDown={e=>e.stopPropagation()}>{WALK_YEARS.map(y=><option key={y} value={y}>{Number(y).toLocaleString('en')} {y==='1'?'year':'years'}</option>)}</select></label>
    {confirm?<div className="walk-confirm"><p>Walk {direction.toLowerCase()} for {Number(years).toLocaleString('en')} {years==='1'?'year':'years'}? This adds up to {plannedDistance} metres and the corresponding time to your journey. You will stop early if you reach an edge.</p><button disabled={busy} onClick={()=>void walk()}>{busy?'Walking…':'Confirm walk'}</button><button disabled={busy} onClick={()=>setConfirm(false)}>Cancel</button></div>:<button onClick={()=>{setConfirm(true);setMessage('');}}>Plan walk</button>}
    <output>{message}</output>{error&&<p role="alert">{error}</p>}
  </section>;
}

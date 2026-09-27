import {createFileRoute} from '@tanstack/react-router';
import {useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import {exact,short} from '@/lib/l1/data';
import {NETWORKS} from '@/lib/l1/networks';
import {ECOSYSTEM_PLACES,ECOSYSTEM_SCOPE} from '@/lib/l1/ecosystem';
import {useLiveFeeds,shortTime,age} from '@/lib/l1/live-hooks';
import {isTelemetryFresh,type ChainTelemetry} from '@/lib/l1/telemetry';
import {FINANCE_PLACES} from '@/lib/l1/finance';
import {FinanceCard,StakingCard,FeedDialog} from '@/lib/l1/town-panels';
import type {TownController,TownActivityRecord,TownBridgeEvent} from '@/lib/l1/town-scene';
export const Route=createFileRoute('/')({component:TownPage,head:()=>({links:[{rel:'canonical',href:'https://ethereumtown.vercel.app'}]})});
const CHAINS=NETWORKS;
const SCENE_CHAINS=CHAINS.map(c=>({...c,visitorCount:0}));
function TownPage(){
 const feeds=useLiveFeeds();
 const [selected,setSelected]=useState<string|null>('ethereum'),[paused,setPaused]=useState(false),[speed,setSpeed]=useState(1),[night,setNight]=useState(false),[financeVisible,setFinanceVisible]=useState(true),[loading,setLoading]=useState(true),[sceneError,setSceneError]=useState('');
 const host=useRef<HTMLDivElement>(null),town=useRef<TownController|null>(null),dialog=useRef<HTMLDialogElement>(null);
 const ecosystemPlace=ECOSYSTEM_PLACES.find(p=>p.id===selected);
 const current=CHAINS.find(c=>c.id===selected),institution=FINANCE_PLACES.find(c=>c.id===selected),isStaking=selected==='staking';
 const rows=feeds.telemetry.chains;
 const unit=useMemo(()=>Math.max(1,Math.ceil(Math.max(0,...rows.map(r=>r.transactionCount??0))/800)),[rows]);
 const activity=useMemo<TownActivityRecord[]>(()=>rows.filter(r=>r.blockHash&&r.blockNumber!==null&&r.transactionCount!==null&&r.blockTimestamp).map(r=>({id:r.id,blockNumber:r.blockNumber!,blockHash:r.blockHash!,transactions:r.transactionCount!,timestamp:r.blockTimestamp!,visitorCount:Math.round(r.transactionCount!/unit)})),[rows,unit]);
 const connectionFresh=!!feeds.bridges&&feeds.bridges.status!=='unavailable'&&feeds.now-Date.parse(feeds.bridges.fetchedAt)<90000&&!!feeds.bridges.observedThrough&&feeds.now-Date.parse(feeds.bridges.observedThrough)<180000;
 const events=useMemo<TownBridgeEvent[]>(()=>connectionFresh?(feeds.bridges?.events??[]).map(e=>({id:e.id,chainId:e.chainId,direction:e.direction==='l2-to-ethereum'?'to-l1':'to-l2',kind:e.kind})):[],[feeds.bridges,connectionFresh]);
 const state=useRef({selected,paused,speed,night,financeVisible,activity,events});state.current={selected,paused,speed,night,financeVisible,activity,events};
 useEffect(()=>{
  let cancelled=false;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)setPaused(true);
  import('@/lib/l1/town-scene').then(({mountTown})=>{
   if(cancelled||!host.current)return;
   let applyingInitialState=true;
   const scene=mountTown(host.current,SCENE_CHAINS,id=>{if(!applyingInitialState)setSelected(id)});town.current=scene;
   const s=state.current;scene.setPaused(s.paused);scene.setSpeed(s.speed);scene.setNight(s.night);scene.setFinanceVisible(s.financeVisible);scene.select(s.selected);scene.setLiveActivity(s.activity);scene.showBridgeEvents(s.events);applyingInitialState=false;setLoading(false);
  }).catch(()=>{if(!cancelled){setSceneError('The 3D town could not start. Your live data is still available below.');setLoading(false)}});
  return()=>{cancelled=true;town.current?.dispose();town.current=null};
 },[]);
 useEffect(()=>{town.current?.select(selected)},[selected]);
 useEffect(()=>{town.current?.setPaused(paused)},[paused]);
 useEffect(()=>{town.current?.setSpeed(speed)},[speed]);
 useEffect(()=>{town.current?.setNight(night)},[night]);
 useEffect(()=>{town.current?.setFinanceVisible(financeVisible);town.current?.select(state.current.selected)},[financeVisible]);
 useEffect(()=>{town.current?.setLiveActivity(activity)},[activity]);
 useEffect(()=>{town.current?.showBridgeEvents(events)},[events]);
 function select(id:string|null){if(FINANCE_PLACES.some(p=>p.id===id))setFinanceVisible(true);setSelected(id)}
 function stepNeighborhood(step:number){const i=CHAINS.findIndex(c=>c.id===selected);select(CHAINS[(Math.max(0,i)+step+CHAINS.length)%CHAINS.length].id)}
 function toggleFinance(){setFinanceVisible(v=>!v);if(institution)setSelected(null)}
 function openSources(){if(dialog.current&&!dialog.current.open){dialog.current.showModal();dialog.current.scrollTop=0}}
 const freshCount=rows.filter(r=>isTelemetryFresh(r,feeds.now)).length;
 const hasData=rows.some(r=>r.blockNumber!==null);
 const feedLabel=freshCount===CHAINS.length?'Live':freshCount>0?'Partial':hasData?'Stale':feeds.telemetry.polledAt?'Unavailable':'Connecting';
 const row=rows.find(r=>r.id===selected),eth=rows.find(r=>r.id==='ethereum');
 const recent=(feeds.bridges?.events??[]).slice(0,4);
 const checked=feeds.telemetry.polledAt?shortTime(feeds.telemetry.polledAt):'Connecting…';
 return <main className="l1-town ethereum-town live-town" data-time={night?'night':'day'} data-finance={financeVisible?'visible':'hidden'}>
  <div ref={host} className="town-scene" role="img" aria-label="Interactive Ethereum town: central Ethereum hall, validator lights, nine Layer 2 neighborhoods and observed connections. Use the navigation buttons to explore."/>
  <div className="town-vignette"/>
  <header className="town-header">
   <div className="town-brand"><span className="town-monogram eth-monogram" aria-hidden="true">◇</span><div><strong>Ethereum Town</strong><small>A connected economy, observed live.</small></div></div>
   <div className="neighborhood-nav"><button aria-label="Previous neighborhood" onClick={()=>stepNeighborhood(-1)}>←</button><span>{Math.max(0,CHAINS.findIndex(c=>c.id===selected))+1} / {CHAINS.length}</span><button aria-label="Next neighborhood" onClick={()=>stepNeighborhood(1)}>→</button></div>
   <div className="town-date live-feed-badge" data-status={freshCount===CHAINS.length?'live':freshCount?'partial':'waiting'}><span><i/> {feedLabel}</span><strong>{freshCount}/{CHAINS.length} network feeds current</strong></div>
   <button className="ledger-trigger" aria-haspopup="dialog" aria-controls="town-reading-guide" onClick={openSources}>Activity & sources <span>↗</span></button>
  </header>
  <nav className="chain-rail" aria-label="Explore the town">
   <button className={'chain-tab '+(!selected?'selected':'')} onClick={()=>select(null)}>Ecosystem</button>
   <button className={'chain-tab staking-tab '+(isStaking?'selected':'')} onClick={()=>select('staking')}><span>◈</span> ETH staking</button>
   <button className={'chain-tab '+(ecosystemPlace?'selected':'')} onClick={()=>select('stablecoins')}>Economy guide</button>
   <button className={'chain-tab finance-toggle '+(financeVisible?'selected':'')} aria-pressed={financeVisible} onClick={toggleFinance}>Wider finance {financeVisible?'−':'+'}</button>
   {CHAINS.map(c=><button key={c.id} className={'chain-tab '+(selected===c.id?'selected':'')} style={{'--chain-color':c.color} as CSSProperties} onClick={()=>select(c.id)}><span className="chain-dot"/>{c.name}</button>)}
  </nav>
  {financeVisible&&<nav className="finance-rail" aria-label="Financial ecosystem">{FINANCE_PLACES.map(p=><button key={p.id} className={selected===p.id?'selected':''} onClick={()=>select(p.id)}>{p.name}<span>{p.status==='opportunity'?'Possible future':p.status==='live-pilot'?'Pilot':'Live product'}</span></button>)}</nav>}
  <aside className="town-card" style={{'--selected-chain':current?.color} as CSSProperties}>
   {ecosystemPlace?<div className="ecosystem-card-content"><div className="card-top"><span className="card-tag">THE ETHEREUM ECONOMY</span><button className="staking-back" aria-label="Back to Ethereum" onClick={()=>select('ethereum')}>↗</button></div><h1>{ecosystemPlace.name}</h1><p className="finance-description">{ecosystemPlace.description}</p><p className="institution-note">{ecosystemPlace.examples}</p><a className="institution-source" href={ecosystemPlace.sourceUrl} target="_blank" rel="noreferrer">{ecosystemPlace.sourceLabel} ↗</a><p className="institution-note">{ecosystemPlace.scopeNote}</p><div className="ecosystem-category-links">{ECOSYSTEM_PLACES.map(p=><button key={p.id} aria-pressed={p.id===selected} onClick={()=>select(p.id)}>{p.name}</button>)}</div><p className="institution-note">{ECOSYSTEM_SCOPE}</p></div>:isStaking?<StakingCard data={feeds.staking} onHall={()=>select('ethereum')}/>:institution?<FinanceCard place={institution} onTarget={select}/>:current?<>
    <div className="card-top"><span className="card-tag">{current.kind==='l1'?'THE SETTLEMENT FOUNDATION':'LAYER 2 NEIGHBORHOOD'}</span><button className="staking-back" onClick={()=>select(null)} aria-label="Back to ecosystem">↗</button></div>
    <h1>{current.name}</h1>
    <div className="observation-state" data-current={isTelemetryFresh(row,feeds.now)}>{row?.blockNumber!==null&&row?.blockNumber!==undefined?(isTelemetryFresh(row,feeds.now)?'Current observation':'Last known · stale'):'Waiting for a verified block'}</div>
    <div className="town-big-number">{row?.transactionCount!==null&&row?.transactionCount!==undefined?exact(row.transactionCount):'—'}</div>
    <p className="town-number-caption">transactions in the latest observed block<br/><span>{row?.blockTimestamp?shortTime(row.blockTimestamp)+' · '+age(row.blockTimestamp,feeds.now):'No block observation yet'}</span></p>
    <BlockLink row={row}/>
    <p className="scope-note">{current.kind==='l1'?'Ethereum is the town’s settlement and consensus foundation. The surrounding L2s execute their own transactions and submit data or state updates to Ethereum.':current.connection}</p>
    {current.kind==='l2'&&<button className="connection-link" onClick={()=>select('ethereum')}><span className="connection-dot"/>Explore Ethereum’s town hall →</button>}
    <p className="block-finality">{row?.finality??'Feed connecting'} · checked {row?shortTime(row.observedAt):'—'}</p>
    {row?.status==='unavailable'&&<p className="feed-caution">This feed is unavailable. The last known observation is retained.</p>}
    <p className="coverage-note">{feeds.bridges?.coverage.find(c=>c.chainId===current.id)?.settlementStatus==='unsupported'?'Live blocks · connection events not yet monitored':current.kind==='l2'?'Observed connections: see activity & sources for coverage':'L2 execution, data publication and asset bridging are distinct.'}</p>
    <ScaleNote unit={unit}/>
   </>:<>
    <div className="card-top"><span className="card-tag">ONE FOUNDATION · MANY NEIGHBORHOODS</span><span className="live-dot" data-current={freshCount===CHAINS.length}/></div>
    <h1>Welcome to<br/>Ethereum Town.</h1>
    <p className="ecosystem-lead">Ethereum at the center. Layer 2 neighborhoods around it. Watch the economy connect.</p>
    <div className="town-big-number">{freshCount}<span className="feed-denominator"> / {CHAINS.length}</span></div>
    <p className="town-number-caption">network feeds current<br/><span>Latest blocks checked {checked}</span></p>
    <button className="foundation-stat" onClick={()=>select('ethereum')}><span><small>Ethereum block</small><strong>{eth?.blockNumber?exact(eth.blockNumber):'—'}</strong></span><span>↗</span></button>
    <button className="staking-entry" onClick={()=>select('staking')}><span>◈</span><span>{short(feeds.staking.reportedStakedEth)} ETH reported staked<small>Explore the city’s security foundation</small></span><span>→</span></button>
    <button className="connection-link" onClick={()=>{setFinanceVisible(true);select(null)}}>Explore the wider financial district →</button>
    <ScaleNote unit={unit}/>
   </>}
  </aside>
  <aside className="live-events" aria-label="Observed Ethereum connections">
   <div className="live-events-head"><span className="card-tag">OBSERVED L1 ACTIVITY</span><span className="event-feed-status">{connectionFresh?(feeds.bridges?.status==='partial'?'Partial feed':'Current feed'):'Checking / stale'}</span></div>
   <h2>L2s meet Ethereum</h2>
   {recent.length>0?<ol>{recent.map(e=><li key={e.id}><a href={e.explorerUrl} target="_blank" rel="noreferrer"><span className="event-kind">{e.kind==='settlement'?'Settlement':'Bridge'}</span><strong>{e.direction==='l2-to-ethereum'?e.chainName+' → Ethereum':'Ethereum → '+e.chainName}</strong><small>{e.stage.replaceAll('-',' ')} · {shortTime(e.timestamp)}</small></a></li>)}</ol>:<p>{feeds.bridges?.status==='unavailable'?'Connection observations are unavailable.':feeds.bridges?'No matching observations in the monitored window.':'Connecting to Ethereum…'}</p>}
   <p className="event-window">{feeds.bridges?.periodStart?'Window '+shortTime(feeds.bridges.periodStart)+'–'+shortTime(feeds.bridges.observedThrough):'Packets appear only for observed onchain events.'}</p>
   <button onClick={openSources}>See events, coverage & methods ↗</button>
  </aside>
  <div className="connection-legend"><span className="legend-route"/> Moving packets: observed L1 events. Validator lights: symbolic.<button aria-haspopup="dialog" aria-controls="town-reading-guide" onClick={openSources}>How to read the town</button></div>
  <footer className="town-footer">
   <div className="playback-controls">
    <button className="pause-control" onClick={()=>setPaused(v=>!v)} aria-label={paused?'Resume animation':'Pause animation'}><b>{paused?'▶':'Ⅱ'}</b><span>{paused?'Play':'Pause'}</span></button>
    <label className="speed-control">Speed<select aria-label="Animation speed" value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value={.5}>½×</option><option value={1}>1×</option><option value={2}>2×</option></select></label>
    <button className="day-control" onClick={()=>setNight(v=>!v)}>{night?'☀ Day':'☾ Night'}</button>
    <button className="overview-control" onClick={()=>select(null)}>Overview ↗</button>
   </div>
   <div className="source-status"><span>Blocks + connections · checked every 30 seconds</span><span>Checked {checked} · animation controls do not pause data</span></div>
   <button className="refresh-control" disabled={feeds.refreshing} onClick={feeds.refresh}>{feeds.refreshing?'Checking…':'Refresh data ↻'}</button>
  </footer>
  {(loading||sceneError)&&<div className="town-loading">{loading?'Building your town…':sceneError}{sceneError&&<button onClick={openSources}>View the live data</button>}</div>}
  <FeedDialog dialog={dialog} chains={CHAINS} telemetry={feeds.telemetry} bridges={feeds.bridges} staking={feeds.staking} historical={feeds.historical} unit={unit} now={feeds.now} onSelect={select}/>
 </main>;
}
function ScaleNote({unit}:{unit:number}){return <div className="scale-note"><span className="walker-symbol" aria-hidden="true">♙</span><span>1 walker ≈ {exact(unit)} block transaction{unit===1?'':'s'}<small>Rounded latest-block counts. Not TPS or unique people.</small></span></div>}
function BlockLink({row}:{row?:ChainTelemetry}){return <div className="block-detail">{row?.explorerUrl?<a href={row.explorerUrl} target="_blank" rel="noreferrer">Block {exact(row.blockNumber!)} ↗</a>:<span>Block —</span>}</div>}

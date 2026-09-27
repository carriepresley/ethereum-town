import {useCallback,useEffect,useRef,useState} from 'react';
import {getTelemetry} from './telemetry.functions';
import {getBridges} from './bridges.functions';
import {getActivity} from './activity.functions';
import {getStaking} from './staking.functions';
import {SNAPSHOT} from './data';
import {STAKING_SNAPSHOT} from './staking';
import {unavailableBridgeSnapshot,type BridgeSnapshot} from './bridges';
import {TELEMETRY_POLL_MS,mergeTelemetrySnapshot,markTelemetryUnavailable,type TelemetrySnapshot} from './telemetry';
import {createFeedPoller} from './telemetry-polling';
export function useLiveFeeds(){
 const [telemetry,setTelemetry]=useState<TelemetrySnapshot>({polledAt:'',chains:[]});
 const [bridges,setBridges]=useState<BridgeSnapshot|null>(null);
 const [historical,setHistorical]=useState(SNAPSHOT),[staking,setStaking]=useState(STAKING_SNAPSHOT);
 const [refreshing,setRefreshing]=useState(false),[now,setNow]=useState(0);
 const poller=useRef<ReturnType<typeof createFeedPoller>|null>(null);
 if(!poller.current)poller.current=createFeedPoller(()=>{
  setRefreshing(Boolean(poller.current?.busy('telemetry')||poller.current?.busy('bridges')));
  setNow(Date.now());
 });
 const refreshLive=useCallback(()=>{
  void poller.current!.run('telemetry',{
   request:signal=>getTelemetry({signal}),timeoutMs:16000,
   success:next=>setTelemetry(old=>mergeTelemetrySnapshot(old,next)),
   failure:()=>setTelemetry(old=>markTelemetryUnavailable(old)),
  });
  void poller.current!.run('bridges',{
   request:signal=>getBridges({signal}),timeoutMs:28000,
   success:setBridges,failure:()=>setBridges(unavailableBridgeSnapshot()),
  });
 },[]);
 const refreshReference=useCallback(()=>{
  void poller.current!.run('activity',{
   request:signal=>getActivity({signal}),timeoutMs:20000,
   success:value=>setHistorical(old=>value.warning?{...old,warning:value.warning}:value),
   failure:()=>setHistorical(old=>({...old,warning:'Reference update unavailable. Last known report retained.'})),
  });
  void poller.current!.run('staking',{
   request:signal=>getStaking({signal}),timeoutMs:16000,
   success:value=>setStaking(old=>value.warning?{...old,warning:value.warning}:value),
   failure:()=>setStaking(old=>({...old,warning:'Staking source update unavailable. Last known report retained.'})),
  });
 },[]);
 useEffect(()=>{
  setNow(Date.now());refreshLive();refreshReference();
  const live=setInterval(()=>{if(!document.hidden)refreshLive()},TELEMETRY_POLL_MS);
  const reference=setInterval(()=>{if(!document.hidden)refreshReference()},900000);
  const tick=setInterval(()=>setNow(Date.now()),5000);
  const onVisible=()=>{if(!document.hidden){setNow(Date.now());refreshLive();refreshReference()}};
  document.addEventListener('visibilitychange',onVisible);
  window.addEventListener('online',onVisible);
  return()=>{clearInterval(live);clearInterval(reference);clearInterval(tick);document.removeEventListener('visibilitychange',onVisible);window.removeEventListener('online',onVisible);poller.current?.cancelAll()};
 },[refreshLive,refreshReference]);
 return {telemetry,bridges,historical,staking,refreshing,now,refresh:()=>{refreshLive();refreshReference()}};
}
export function shortTime(iso:string|null|undefined){if(!iso||!Number.isFinite(Date.parse(iso)))return '—';return new Date(iso).toLocaleTimeString('en-US',{hour12:false,timeZone:'UTC'})+' UTC'}
export function age(iso:string|null|undefined,now:number){if(!iso||!now||!Number.isFinite(Date.parse(iso)))return '—';const n=Math.max(0,Math.floor((now-Date.parse(iso))/1000));return n<60?n+'s ago':n<3600?Math.floor(n/60)+'m ago':Math.floor(n/3600)+'h ago'}

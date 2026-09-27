import {describe,expect,test} from 'bun:test'
import {publicFeedCache,createNodeCompletedCache,NODE_PUBLIC_CACHE_LIMITS} from '../src/lib/l1/public-feed-cache.server'
import {TELEMETRY_NETWORKS,parseTelemetryBatch,loadTelemetry} from '../src/lib/l1/telemetry-loader.server'
import {isTelemetryFresh,mergeTelemetrySnapshot,markTelemetryUnavailable} from '../src/lib/l1/telemetry'
import {createFeedPoller} from '../src/lib/l1/telemetry-polling'
import {loadStaking,parseStakingHtml} from '../src/lib/l1/staking-loader.server'

const hash='0x'+'a'.repeat(64)
const observed=()=>new Date().toISOString()
const payload=(network:typeof TELEMETRY_NETWORKS[number],timestamp=Math.floor(Date.now()/1000))=>[
 {jsonrpc:'2.0',id:1,result:network.chainId},
 {jsonrpc:'2.0',id:2,result:network.protocol==='evm'
  ?{number:'0x100',timestamp:'0x'+timestamp.toString(16),hash,transactions:[]}
  :{block_number:256,timestamp,block_hash:hash,status:'ACCEPTED_ON_L2',transactions:[]}},
]
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done});return {promise,resolve}}

describe('mainnet block feed correctness',()=>{
 test('all ten fixed chain identities parse real block units; zero remains zero',()=>{
  expect(TELEMETRY_NETWORKS).toHaveLength(10)
  expect(new Set(TELEMETRY_NETWORKS.map(n=>n.id)).size).toBe(10)
  for(const network of TELEMETRY_NETWORKS){
   const row=parseTelemetryBatch(network,payload(network),observed())
   expect(row.transactionCount).toBe(0)
   expect(row.blockNumber).toBe(256)
   expect(isTelemetryFresh(row)).toBe(true)
   expect(row.finality.includes('finality not verified')).toBe(true)
  }
 })
 test('wrong network, unsafe height, future time and malformed transactions fail closed',()=>{
  const network=TELEMETRY_NETWORKS[0]
  for(const mutate of [
   (p:any)=>{p[0].result='0x2'},
   (p:any)=>{p[1].result.number='0x20000000000000'},
   (p:any)=>{p[1].result.timestamp='0x'+(Math.floor(Date.now()/1000)+120).toString(16)},
   (p:any)=>{p[1].result.transactions=[hash,hash]},
   (p:any)=>{p[1].result.transactions=[{}]},
   (p:any)=>{p[1].id=1},
   (p:any)=>{p[1].error={code:-32000,message:'Unavailable'}},
  ]){const p=payload(network);mutate(p);expect(()=>parseTelemetryBatch(network,p,observed())).toThrow()}
 })
 test('old source checks and old block timestamps both stop live status',()=>{
  const n=TELEMETRY_NETWORKS[0],row=parseTelemetryBatch(n,payload(n),observed())
  expect(isTelemetryFresh(row,Date.now()+91_000)).toBe(false)
  expect(isTelemetryFresh({...row,blockTimestamp:new Date(Date.now()-121_000).toISOString()})).toBe(false)
 })
 test('one provider failure does not erase healthy networks or report a zero count',async()=>{
  const result=await loadTelemetry((async(url:any)=>{
   const n=TELEMETRY_NETWORKS.find(n=>n.rpc===url)!
   return n.id==='base'?new Response('limited',{status:429}):Response.json(payload(n))
  }) as typeof fetch)
  expect(result.chains.filter(r=>r.status==='ok')).toHaveLength(9)
  expect(result.chains.find(r=>r.id==='base')?.transactionCount).toBeNull()
 })
 test('retained data keeps its original timestamp and cannot be live after a failure',()=>{
  const row=parseTelemetryBatch(TELEMETRY_NETWORKS[0],payload(TELEMETRY_NETWORKS[0]),observed())
  const old={polledAt:row.observedAt,chains:[row]}
  const failed={...row,status:'unavailable' as const,blockNumber:null,transactionCount:null,observedAt:observed(),error:'RPC unavailable'}
  const merged=mergeTelemetrySnapshot(old,{polledAt:observed(),chains:[failed]})
  expect(merged.chains[0].observedAt).toBe(row.observedAt)
  expect(merged.chains[0].blockNumber).toBe(row.blockNumber)
  expect(isTelemetryFresh(merged.chains[0])).toBe(false)
  expect(isTelemetryFresh(markTelemetryUnavailable(old).chains[0])).toBe(false)
 })
 test('Node loader invocations do not share requests or module state',async()=>{
  const original=globalThis.fetch;let calls=0
  globalThis.fetch=(async(url:any)=>{calls++;const n=TELEMETRY_NETWORKS.find(n=>n.rpc===url)!;return Response.json(payload(n))}) as typeof fetch
  try{
   const [a,b]=await Promise.all([loadTelemetry(),loadTelemetry()])
   const c=await loadTelemetry()
   expect(calls).toBe(30);expect(a).not.toBe(b);expect(b).not.toBe(c)
  }finally{globalThis.fetch=original}
 })
})

describe('independent refresh lifecycle',()=>{
 test('a slow bridge feed cannot delay the block feed or allow duplicate block requests',async()=>{
  const poller=createFeedPoller(),bridge=deferred<string>(),head=deferred<string>()
  const got:string[]=[];let calls=0
  const first=poller.run('bridges',{request:()=>bridge.promise,timeoutMs:1000,success:v=>got.push(v),failure:()=>{}})
  const second=poller.run('telemetry',{request:()=>{calls++;return head.promise},timeoutMs:1000,success:v=>got.push(v),failure:()=>{}})
  await poller.run('telemetry',{request:async()=>{calls++;return 'duplicate'},timeoutMs:1000,success:v=>got.push(v),failure:()=>{}})
  head.resolve('head');await second
  expect(got).toEqual(['head']);expect(calls).toBe(1);expect(poller.busy('bridges')).toBe(true)
  bridge.resolve('bridge');await first
 })
 test('a hung transport times out, releases its gate, and ignores late completion',async()=>{
  const poller=createFeedPoller(),hung=deferred<string>();let failed=0,success=0,aborted=false
  await poller.run('telemetry',{request:signal=>{signal.addEventListener('abort',()=>{aborted=true});return hung.promise},timeoutMs:10,success:()=>success++,failure:()=>failed++})
  expect(failed).toBe(1);expect(aborted).toBe(true);expect(poller.busy('telemetry')).toBe(false)
  hung.resolve('too late');await Promise.resolve();expect(success).toBe(0)
  await poller.run('telemetry',{request:async()=>1,timeoutMs:100,success:()=>success++,failure:()=>failed++})
  expect(success).toBe(1)
 })
 test('unmount cancellation suppresses late writes and permits a clean restart',async()=>{
  const poller=createFeedPoller(),old=deferred<string>();const got:string[]=[]
  const previous=poller.run('telemetry',{request:()=>old.promise,timeoutMs:1000,success:v=>got.push(v),failure:()=>got.push('old error')})
  poller.cancelAll()
  await poller.run('telemetry',{request:async()=>'new',timeoutMs:1000,success:v=>got.push(v),failure:()=>{}})
  old.resolve('old');await previous;expect(got).toEqual(['new'])
 })
})

describe('reported staking figure',()=>{
 const html='<div>43,558,895</div><div>Total ETH staked</div>'
 test('the exact visible card is required and hydration duplicates are ignored',()=>{
  expect(parseStakingHtml(html+'<script>'+html+'</script>')).toBe(43558895)
  for(const bad of [html+html,'<div>35%</div><div>Total ETH staked</div>','<div>43,558,895.5</div><div>Total ETH staked</div>']){
   expect(()=>parseStakingHtml(bad)).toThrow()
  }
 })
 test('Node staking loads stay request-scoped; the caveat is not an update error',async()=>{
  const original=globalThis.fetch;let calls=0
  globalThis.fetch=(async()=>{calls++;return new Response(html)}) as typeof fetch
  try{
   const [a,b]=await Promise.all([loadStaking(),loadStaking()])
   expect(calls).toBe(2);expect(a).not.toBe(b);expect(a.warning).toBeUndefined()
   expect(a.sourceNote).toContain('without a metric timestamp or epoch')
  }finally{globalThis.fetch=original}
 })
})

describe('completed Cloudflare public JSON cache',()=>{
 const requestUrl='https://town.example/feed'
 const options=(load:()=>Promise<{capturedAt:string;status:string;count:number}>)=>({
  requestUrl,key:'selected-bridges',ttlSeconds:12,load,timestamp:(v:{capturedAt:string})=>v.capturedAt,
  cacheable:(v:{status:string})=>v.status==='ok',
 })
 function installCache(overrides:Record<string,unknown>={}){
  const original=Object.getOwnPropertyDescriptor(globalThis,'caches')
  const entries=new Map<string,Response>()
  const cache={
   match:async(request:Request)=>entries.get(request.url)?.clone(),
   put:async(request:Request,response:Response)=>{entries.set(request.url,response.clone())},
   delete:async(request:Request)=>entries.delete(request.url),
   ...overrides,
  }
  Object.defineProperty(globalThis,'caches',{configurable:true,value:{default:cache}})
  return {entries,restore:()=>{if(original)Object.defineProperty(globalThis,'caches',original);else delete (globalThis as any).caches}}
 }
 test('completed entries preserve the source time and explicit expiry forces a new read',async()=>{
  const fake=installCache();let calls=0
  const load=async()=>({capturedAt:observed(),status:'ok',count:++calls})
  try{
   const a=await publicFeedCache(options(load)),b=await publicFeedCache(options(load))
   expect(calls).toBe(1);expect(b).toEqual(a)
   const [key,response]=[...fake.entries][0]
   const saved=await response.json();saved.expiresAt=Date.now()-1
   fake.entries.set(key,Response.json(saved))
   const c=await publicFeedCache(options(load));expect(calls).toBe(2);expect(c.count).toBe(2)
  }finally{fake.restore()}
 })
 test('unavailable results and failed upstream loads are never cached as live',async()=>{
  const fake=installCache();let calls=0
  try{
   const bad=options(async()=>({capturedAt:observed(),status:'unavailable',count:++calls}))
   await publicFeedCache(bad);await publicFeedCache(bad)
   expect(calls).toBe(2);expect(fake.entries.size).toBe(0)
   await expect(publicFeedCache(options(async()=>{throw Error('upstream failed')}))).rejects.toThrow('upstream failed')
   expect(fake.entries.size).toBe(0)
  }finally{fake.restore()}
 })
 test('simultaneous cold requests do not share in-flight work across Worker contexts',async()=>{
  const fake=installCache(),work=deferred<{capturedAt:string;status:string;count:number}>();let calls=0
  try{
   const o=options(()=>{calls++;return work.promise})
   const a=publicFeedCache(o),b=publicFeedCache(o)
   await new Promise(r=>setTimeout(r,0));expect(calls).toBe(2)
   work.resolve({capturedAt:observed(),status:'ok',count:1});await Promise.all([a,b])
   expect(fake.entries.size).toBe(1)
  }finally{fake.restore()}
 })
 test('cache puts complete before the request returns; cache failures preserve real data',async()=>{
  const gate=deferred<void>();let putStarted=false,returned=false
  const fake=installCache({put:async()=>{putStarted=true;await gate.promise}})
  try{
   const task=publicFeedCache(options(async()=>({capturedAt:observed(),status:'ok',count:1}))).then(v=>{returned=true;return v})
   await new Promise(r=>setTimeout(r,0));expect(putStarted).toBe(true);expect(returned).toBe(false)
   gate.resolve();await task;expect(returned).toBe(true)
  }finally{fake.restore()}
  const broken=installCache({match:async()=>{throw Error('cache unavailable')},put:async()=>{throw Error('cache unavailable')}})
  try{expect((await publicFeedCache(options(async()=>({capturedAt:observed(),status:'ok',count:7})))).count).toBe(7)}
  finally{broken.restore()}
 })
 test('a fifteen-minute report expires without renewing its original capture time',async()=>{
  const fake=installCache();let calls=0
  try{
   const o={...options(async()=>({capturedAt:observed(),status:'ok',count:++calls})),key:'reported-staking',ttlSeconds:900}
   const a=await publicFeedCache(o),b=await publicFeedCache(o);expect(b.capturedAt).toBe(a.capturedAt);expect(calls).toBe(1)
   const [key,response]=[...fake.entries][0],saved=await response.json()
   saved.value.capturedAt=new Date(Date.now()-901_000).toISOString()
   fake.entries.set(key,Response.json(saved))
   await publicFeedCache(o);expect(calls).toBe(2)
  }finally{fake.restore()}
 })
})

describe('bounded Node completed-value cache',()=>{
 async function withoutCloudflare(run:()=>Promise<void>){
  const original=Object.getOwnPropertyDescriptor(globalThis,'caches')
  Object.defineProperty(globalThis,'caches',{configurable:true,value:undefined})
  try{await run()}finally{
   if(original)Object.defineProperty(globalThis,'caches',original)
   else delete (globalThis as any).caches
  }
 }
 const options=(host:string,load:()=>Promise<any>)=>({
  requestUrl:'https://'+host+'.example/feed',key:'selected-bridges',ttlSeconds:12,load,
  timestamp:(v:any)=>v.capturedAt,cacheable:(v:any)=>v.status==='ok',
 })
 test('fallback reuses completed JSON and isolates mutations by every caller',async()=>{
  await withoutCloudflare(async()=>{
   let calls=0
   const o=options('node-reuse',async()=>({capturedAt:observed(),status:'ok',nested:{count:++calls}}))
   const a=await publicFeedCache(o),capture=a.capturedAt;a.nested.count=99
   const b=await publicFeedCache(o);expect(b.nested.count).toBe(1);expect(b.capturedAt).toBe(capture)
   b.nested.count=55
   expect((await publicFeedCache(o)).nested.count).toBe(1);expect(calls).toBe(1)
  })
 })
 test('expired entries reload; unavailable and thrown results are never cached',async()=>{
  await withoutCloudflare(async()=>{
   let calls=0
   const o={...options('node-expiry',async()=>({capturedAt:observed(),status:'ok',count:++calls})),ttlSeconds:0.01}
   await publicFeedCache(o);await new Promise(r=>setTimeout(r,20));await publicFeedCache(o)
   expect(calls).toBe(2)
   let failures=0
   const bad=options('node-failure',async()=>({capturedAt:observed(),status:'unavailable',count:++failures}))
   await publicFeedCache(bad);await publicFeedCache(bad);expect(failures).toBe(2)
   const throws=options('node-throws',async()=>{failures++;throw Error('source offline')})
   await expect(publicFeedCache(throws)).rejects.toThrow('source offline')
   await expect(publicFeedCache(throws)).rejects.toThrow('source offline');expect(failures).toBe(4)
  })
 })
 test('only the three approved public feeds and their bounded TTLs are cached',async()=>{
  await withoutCloudflare(async()=>{
   let calls=0
   const o=options('node-allowlist',async()=>({capturedAt:observed(),status:'ok',count:++calls}))
   for(const invalid of [{...o,key:'user-profile'},{...o,ttlSeconds:13},{...o,ttlSeconds:Infinity}]){
    await publicFeedCache(invalid);await publicFeedCache(invalid)
   }
   expect(calls).toBe(6)
  })
 })
 test('entry count, total bytes and per-entry bytes stay bounded',async()=>{
  const cache=createNodeCompletedCache()
  const request=(i:number)=>new Request('https://bounds.example/'+i)
  const response=(padding='')=>Response.json({expiresAt:Date.now()+12000,value:{padding}})
  for(let i=0;i<=NODE_PUBLIC_CACHE_LIMITS.entries;i++)await cache.put(request(i),response())
  expect(await cache.match(request(0))).toBeUndefined()
  expect(await cache.match(request(NODE_PUBLIC_CACHE_LIMITS.entries))).toBeDefined()
  const byteCache=createNodeCompletedCache()
  for(let i=0;i<5;i++)await byteCache.put(request(i),response('x'.repeat(900000)))
  expect(await byteCache.match(request(0))).toBeUndefined()
  expect(await byteCache.match(request(4))).toBeDefined()
  await byteCache.put(request(5),response('x'.repeat(NODE_PUBLIC_CACHE_LIMITS.entryBytes)))
  expect(await byteCache.match(request(5))).toBeUndefined()
 })
 test('simultaneous cold Node requests keep their in-flight work separate',async()=>{
  await withoutCloudflare(async()=>{
   const work=deferred<any>();let calls=0
   const o=options('node-concurrent',()=>{calls++;return work.promise})
   const a=publicFeedCache(o),b=publicFeedCache(o)
   await new Promise(r=>setTimeout(r,0));expect(calls).toBe(2)
   work.resolve({capturedAt:observed(),status:'ok',count:1})
   await Promise.all([a,b]);await publicFeedCache(o);expect(calls).toBe(2)
  })
 })
})

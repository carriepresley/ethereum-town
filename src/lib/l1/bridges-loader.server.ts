import { BATCH_INBOXES, SETTLEMENT_REGISTRY, BRIDGE_FEED_NOTE, BRIDGE_REGISTRY, bridgeCoverage, unavailableBridgeSnapshot, type BridgeEvent, type BridgeSnapshot } from './bridges'
import { readBoundedJson, UPSTREAM_RESPONSE_LIMITS } from './bounded-response.server'

export const BRIDGE_WINDOW_BLOCKS = 100
export const BRIDGE_LOAD_DEADLINE_MS = 24_000
const RPC_CONCURRENCY = 6
const RPCS = [
  { url: 'https://ethereum-rpc.publicnode.com', label: 'PublicNode · Ethereum mainnet' },
  { url: 'https://eth.drpc.org', label: 'dRPC · Ethereum mainnet' },
]
type RpcLog = { address: string; topics: string[]; data: string; transactionHash: string; logIndex: string; blockNumber: string; blockHash: string; removed?: boolean }
type RpcBlock = { number: string; hash: string; timestamp: string }
const hexQuantity = /^0x(?:0|[1-9a-f][0-9a-f]*)$/i
const hashPattern = /^0x[0-9a-f]{64}$/i
const addressPattern = /^0x[0-9a-f]{40}$/i
function quantity(value: unknown): number {
  if (typeof value !== 'string' || !hexQuantity.test(value)) throw new Error('Invalid Ethereum quantity')
  const n = Number(BigInt(value))
  if (!Number.isSafeInteger(n) || n < 0) throw new Error('Unsafe Ethereum quantity')
  return n
}
function block(raw: unknown, expected?: number): RpcBlock {
  if (!raw || typeof raw !== 'object') throw new Error('Missing Ethereum block')
  const b = raw as RpcBlock
  if (!hashPattern.test(b.hash) || (expected !== undefined && quantity(b.number) !== expected)) throw new Error('Block identity mismatch')
  quantity(b.number); quantity(b.timestamp)
  return b
}
function time(b: RpcBlock): string { return new Date(quantity(b.timestamp) * 1000).toISOString() }
/** Pure parser used by both live fetch and integrity tests. No amount/value is inferred. */
export function parseBridgeLogs(logs: unknown[], blocks: Map<number, RpcBlock>, fromBlock: number, toBlock: number): BridgeEvent[] {
  const result = new Map<string, BridgeEvent>()
  for (const raw of logs) {
    if (!raw || typeof raw !== 'object') throw new Error('Malformed log')
    const log = raw as RpcLog
    if (log.removed === true) continue
    if (!addressPattern.test(log.address) || !Array.isArray(log.topics)) throw new Error('Malformed bridge log')
    const entry = [...BRIDGE_REGISTRY,...SETTLEMENT_REGISTRY].find(e => e.addresses.some(a => a.toLowerCase() === log.address.toLowerCase()))
    const spec = entry?.events.find(e => e.topic === log.topics[0]?.toLowerCase())
    if (!entry || !spec) continue
    if (log.topics.length !== spec.topicCount || log.topics.some(t => !hashPattern.test(t)) || !/^0x(?:[0-9a-f]{2})*$/i.test(log.data) || (log.data.length - 2) / 2 < spec.minimumDataBytes) throw new Error('Malformed event ABI data')
    if (!hashPattern.test(log.transactionHash) || !hashPattern.test(log.blockHash)) throw new Error('Missing event identity')
    const n = quantity(log.blockNumber), index = quantity(log.logIndex)
    if (n < fromBlock || n > toBlock) throw new Error('Log outside requested window')
    const b = blocks.get(n)
    if (!b || b.hash.toLowerCase() !== log.blockHash.toLowerCase()) throw new Error('Bridge log changed during a reorganization')
    const txHash = log.transactionHash.toLowerCase(), id = txHash + ':' + index
    result.set(id, { kind: entry.kind ?? 'bridge', sourceUrl: entry.sources[0]?.url ?? 'https://ethereum.org', id, chainId: entry.chainId, chainName: entry.chainName, direction: spec.direction, stage: spec.stage, eventName: spec.name, contractAddress: log.address.toLowerCase(), txHash, logIndex: index, blockNumber: n, blockHash: log.blockHash.toLowerCase(), timestamp: time(b), finality: 'included', explorerUrl: 'https://etherscan.io/tx/' + txHash })
  }
  return [...result.values()].sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex)
}
async function loadFromRpc(endpoint: typeof RPCS[number], fetchImpl: typeof fetch, deadline: AbortSignal): Promise<BridgeSnapshot> {
  let nextId = 0, active = 0
  const waiting: Array<() => void> = []
  const acquire = () => active < RPC_CONCURRENCY ? (active++, Promise.resolve()) : new Promise<void>(resolve => waiting.push(resolve))
  const release = () => { const next = waiting.shift(); if (next) next(); else active-- }
  const rpc = async (method: string, params: unknown[]): Promise<unknown> => {
    await acquire()
    try {
      deadline.throwIfAborted()
      const id = ++nextId
      const response = await fetchImpl(endpoint.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }), signal: AbortSignal.any([deadline, AbortSignal.timeout(8000)]), cache: 'no-store' })
      if (!response.ok) throw new Error('Ethereum RPC HTTP ' + response.status)
      const body = await readBoundedJson(response, UPSTREAM_RESPONSE_LIMITS.bridges) as { id?: number; error?: unknown; result?: unknown }
      if (body.id !== id || body.error || !Object.prototype.hasOwnProperty.call(body, 'result')) throw new Error('Ethereum RPC response failed')
      return body.result
    } finally { release() }
  }
  const [chainId, rawHead] = await Promise.all([rpc('eth_chainId', []), rpc('eth_getBlockByNumber', ['latest', false])])
  if (chainId !== '0x1') throw new Error('Expected Ethereum mainnet')
  const head = block(rawHead), toBlock = quantity(head.number), fromBlock = Math.max(0, toBlock - BRIDGE_WINDOW_BLOCKS + 1)
  const age = Date.now() - quantity(head.timestamp) * 1000
  if (age < -60_000 || age > 180_000) throw new Error('Ethereum RPC head is not recent')
  const monitored = [...BRIDGE_REGISTRY,...SETTLEMENT_REGISTRY].filter(e => e.events.length)
  const topics = [...new Set(monitored.flatMap(e => e.events.map(s => s.topic)))]
  const logs = await rpc('eth_getLogs', [{ fromBlock: '0x' + fromBlock.toString(16), toBlock: head.number, address: monitored.flatMap(e => e.addresses), topics: [topics] }])
  if (!Array.isArray(logs) || logs.length > 5000) throw new Error('Invalid bridge event response')
  const requiredBlocks = new Set<number>([fromBlock, toBlock])
  for (const raw of logs) { if (raw && typeof raw === 'object' && !(raw as RpcLog).removed) requiredBlocks.add(quantity((raw as RpcLog).blockNumber)) }
  if ([...requiredBlocks].some(n => n < fromBlock || n > toBlock)) throw new Error('RPC returned logs beyond the query')
  const blocks = new Map<number, RpcBlock>()
  await Promise.all([...requiredBlocks].map(async n => blocks.set(n, block(await rpc('eth_getBlockByNumber', ['0x' + n.toString(16), false]), n))))
  // Read the head block again so events from a changed branch are not passed to the UI.
  if (blocks.get(toBlock)?.hash.toLowerCase() !== head.hash.toLowerCase()) throw new Error('Ethereum head changed branch during fetch')
  const events = parseBridgeLogs(logs, blocks, fromBlock, toBlock)
  const batchAvailable: string[] = []
  await Promise.all(BATCH_INBOXES.map(async inbox => {
    try {
      const response=await fetchImpl('https://eth.blockscout.com/api/v2/addresses/'+inbox.address+'/transactions?filter=to',{signal:AbortSignal.any([deadline,AbortSignal.timeout(8000)]),cache:'no-store'})
      if(!response.ok) throw new Error('Batch discovery unavailable')
      const body=await readBoundedJson(response,UPSTREAM_RESPONSE_LIMITS.bridges) as {items?: Array<{hash:string; block_number:number;type:number;from?:{hash:string};to?:{hash:string};status:string}>}
      if(!Array.isArray(body.items))throw new Error('Invalid batch discovery')
      const candidates=body.items.filter(t=>Number.isSafeInteger(t.block_number)&&t.block_number>=fromBlock&&t.block_number<=toBlock&&t.type===3&&t.status==='ok'&&t.from?.hash?.toLowerCase()===inbox.sender&&t.to?.hash?.toLowerCase()===inbox.address&&hashPattern.test(t.hash)).slice(0,6)
      const verified: BridgeEvent[]=[]
      await Promise.all(candidates.map(async c=>{
        const [rawTx,rawReceipt]=await Promise.all([rpc('eth_getTransactionByHash',[c.hash]),rpc('eth_getTransactionReceipt',[c.hash])])
        const tx=rawTx as {hash:string;from:string;to:string;type:string;blockNumber:string;blockHash:string;blobVersionedHashes:string[]}|null
        const receipt=rawReceipt as {transactionHash:string;blockHash:string;status:string}|null
        if(!tx||!receipt||tx.hash.toLowerCase()!==c.hash.toLowerCase()||tx.from.toLowerCase()!==inbox.sender||tx.to.toLowerCase()!==inbox.address||tx.type!=='0x3'||!Array.isArray(tx.blobVersionedHashes)||!tx.blobVersionedHashes.length||receipt.status!=='0x1'||receipt.transactionHash.toLowerCase()!==c.hash.toLowerCase()||receipt.blockHash!==tx.blockHash)throw new Error('Batch candidate failed RPC verification')
        const n=quantity(tx.blockNumber)
        if(n<fromBlock||n>toBlock)throw new Error('Batch outside observed window')
        const b=blocks.get(n)??block(await rpc('eth_getBlockByNumber',['0x'+n.toString(16),false]),n)
        if(b.hash!==tx.blockHash)throw new Error('Batch branch changed')
        const txHash=tx.hash.toLowerCase()
        verified.push({kind:'settlement',sourceUrl:inbox.sourceUrl,id:txHash+':batch',chainId:inbox.chainId,chainName:inbox.chainName,direction:'l2-to-ethereum',stage:'batch-data-posted',eventName:'Blob batch submission',contractAddress:inbox.address,txHash,logIndex:-1,blockNumber:n,blockHash:b.hash,timestamp:time(b),finality:'included',explorerUrl:'https://etherscan.io/tx/'+txHash})
      }))
      events.push(...verified)
      batchAvailable.push(inbox.chainId)
    } catch { /* Bridge log coverage stays live if this separate sampled batch source fails. */ }
  }))
  // Recheck the same block after enrichment too, before publishing any observations.
  const finalHead = block(await rpc('eth_getBlockByNumber', [head.number, false]), toBlock)
  if (finalHead.hash.toLowerCase() !== head.hash.toLowerCase()) throw new Error('Ethereum branch changed during batch verification')
  if (Date.now() - quantity(head.timestamp) * 1000 > 180_000) throw new Error('Ethereum observations became stale during fetch')
  events.sort((a,b)=>b.blockNumber-a.blockNumber||b.logIndex-a.logIndex)
  const coverage=bridgeCoverage(true,batchAvailable)
  return { status: coverage.every(c=>c.status==='monitored'&&c.settlementStatus==='monitored') ? 'live' : 'partial', fetchedAt: new Date().toISOString(), fromBlock, toBlock, periodStart: time(blocks.get(fromBlock)!), observedThrough: time(head), rpcLabel: endpoint.label, rpcUrl: endpoint.url, coverage, events, note: BRIDGE_FEED_NOTE }
}
export async function loadBridgeSnapshot(fetchImpl: typeof fetch = fetch): Promise<BridgeSnapshot> {
  const deadline = AbortSignal.timeout(BRIDGE_LOAD_DEADLINE_MS)
  for (const endpoint of RPCS) {
    if (deadline.aborted) break
    const attempt = new AbortController()
    try { return await loadFromRpc(endpoint, fetchImpl, AbortSignal.any([deadline, attempt.signal])) } catch { /* Try an independent public read source; never invent an empty successful window. */ }
    finally { attempt.abort() }
  }
  return unavailableBridgeSnapshot()
}

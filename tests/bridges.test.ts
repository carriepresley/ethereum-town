import { describe, expect, test } from 'bun:test'
import { BRIDGE_REGISTRY, SETTLEMENT_REGISTRY, STANDARD_BRIDGE_EVENTS } from '../src/lib/l1/bridges'
import { loadBridgeSnapshot, parseBridgeLogs } from '../src/lib/l1/bridges-loader.server'
const hash = '0x' + 'a'.repeat(64)
const txHash = '0x' + 'b'.repeat(64)
const topic = '0x' + '0'.repeat(64)
const block = { number: '0x64', hash, timestamp: '0x1' }
const blocks = new Map([[100, block]])
function log(index = 0, eventIndex = 0) {
  const spec = STANDARD_BRIDGE_EVENTS[eventIndex]
  return { address: BRIDGE_REGISTRY[0].addresses[0], topics: [spec.topic, ...Array(spec.topicCount - 1).fill(topic)], data: '0x' + '0'.repeat(spec.minimumDataBytes * 2), transactionHash: txHash, logIndex: '0x' + index.toString(16), blockNumber: '0x64', blockHash: hash, removed: false }
}
describe('verified bridge observations', () => {
  test('a deposit initiation never becomes completed L2 receipt', () => {
    const [event] = parseBridgeLogs([log()], blocks, 100, 100)
    expect(event.stage).toBe('deposit-initiated')
    expect(event.direction).toBe('ethereum-to-l2')
    expect(event.kind).toBe('bridge')
    expect(event.finality).toBe('included')
    expect(event.id).toBe(txHash + ':0')
    expect('amount' in event).toBe(false)
  })
  test('withdrawal bridge stage is distinct from Ethereum consensus finality', () => {
    const [event] = parseBridgeLogs([log(1, 1)], blocks, 100, 100)
    expect(event.stage).toBe('withdrawal-finalized')
    expect(event.direction).toBe('l2-to-ethereum')
    expect(event.finality).toBe('included')
  })
  test('deduplicates exact log identity; drops removed and unknown-emitter logs', () => {
    const events = parseBridgeLogs([log(), log(), { ...log(1), removed: true }, { ...log(2), address: '0x' + '1'.repeat(40) }], blocks, 100, 100)
    expect(events).toHaveLength(1)
  })
  test('rejects a reorganization, malformed recognized event and wrong block window', () => {
    expect(() => parseBridgeLogs([{ ...log(), blockHash: '0x' + 'c'.repeat(64) }], blocks, 100, 100)).toThrow()
    expect(() => parseBridgeLogs([{ ...log(), data: '0x' }], blocks, 100, 100)).toThrow()
    expect(() => parseBridgeLogs([log()], blocks, 101, 102)).toThrow()
  })
  test('state update is settlement activity, not an asset bridge', () => {
    const starknet = SETTLEMENT_REGISTRY.find(e => e.chainId === 'starknet')!
    const spec = starknet.events[0]
    const [event] = parseBridgeLogs([{ ...log(), address: starknet.addresses[0], topics: [spec.topic], data: '0x' + '0'.repeat(192) }], blocks, 100, 100)
    expect(event.kind).toBe('settlement')
    expect(event.stage).toBe('state-updated')
    expect(event.chainId).toBe('starknet')
  })
  test('provider failure reports unavailable instead of inventing a quiet live window', async () => {
    const unavailableFetch: typeof fetch = async () => { throw new Error('offline') }
    const result = await loadBridgeSnapshot(unavailableFetch)
    expect(result.status).toBe('unavailable')
    expect(result.toBlock).toBeNull()
    expect(result.events).toEqual([])
    expect(result.coverage.filter(e => e.status !== 'unsupported').every(e => e.status === 'unavailable')).toBe(true)
    expect(result.coverage.filter(e => e.status === 'unsupported').map(e => e.chainId)).toEqual(['mantle','ink','unichain'])
  })
})

function observedWindowFetch(reorganizeAfterEnrichment = false) {
  let active = 0, peak = 0
  const headReads = new Map<string, number>()
  const timestamp = '0x' + Math.floor(Date.now() / 1000).toString(16)
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input)
    if (url.includes('blockscout')) return Response.json({ items: [] })
    active++; peak = Math.max(peak, active)
    try {
      await new Promise(resolve => setTimeout(resolve, 3))
      const req = JSON.parse(String(init?.body)) as { id: number; method: string; params: unknown[] }
      let result: unknown
      if (req.method === 'eth_chainId') result = '0x1'
      else if (req.method === 'eth_getLogs') result = Array.from({ length: 30 }, (_, i) => ({ ...log(i), blockNumber: '0x' + (101 + i).toString(16) }))
      else if (req.method === 'eth_getBlockByNumber') {
        const number = req.params[0] === 'latest' ? '0xc8' : String(req.params[0])
        if (req.params[0] === '0xc8') headReads.set(url, (headReads.get(url) ?? 0) + 1)
        const changed = reorganizeAfterEnrichment && (headReads.get(url) ?? 0) >= 2
        result = { number, timestamp, hash: changed ? '0x' + 'c'.repeat(64) : hash }
      } else throw new Error('Unexpected RPC method')
      return Response.json({ jsonrpc: '2.0', id: req.id, result })
    } finally { active-- }
  }
  return { fetchImpl, peak: () => peak }
}

describe('bridge source integrity and load limits', () => {
  test('bounds concurrent RPC reads while retaining the whole requested observation window', async () => {
    const source = observedWindowFetch()
    const result = await loadBridgeSnapshot(source.fetchImpl)
    expect(result.status).toBe('partial')
    expect(result.events).toHaveLength(30)
    expect(source.peak()).toBeLessThanOrEqual(6)
    expect(result.fromBlock).toBe(101)
    expect(result.toBlock).toBe(200)
  })
  test('discards observations if the head changes branch after batch enrichment', async () => {
    const source = observedWindowFetch(true)
    const result = await loadBridgeSnapshot(source.fetchImpl)
    expect(result.status).toBe('unavailable')
    expect(result.events).toEqual([])
  })
})

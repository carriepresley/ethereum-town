import { describe, expect, spyOn, test } from 'bun:test'
import { readBoundedJson, readBoundedText, UPSTREAM_RESPONSE_LIMITS } from '../src/lib/l1/bounded-response.server'
import { loadTelemetry, TELEMETRY_NETWORKS } from '../src/lib/l1/telemetry-loader.server'
import { loadStaking } from '../src/lib/l1/staking-loader.server'
import { loadBridgeSnapshot } from '../src/lib/l1/bridges-loader.server'
import { ACTIVITY_URL, loadEthereumActivity, SELECTED } from '../src/lib/l1/loader.server'

const encode = (text: string) => new TextEncoder().encode(text)

// No prefetching: a rejected header must never ask the source for a body chunk.
function streamedResponse(chunks: Uint8Array[], headers?: HeadersInit) {
  const state = { pulls: 0, canceled: 0 }
  let index = 0
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      state.pulls++
      if (index === chunks.length) controller.close()
      else controller.enqueue(chunks[index++])
    },
    cancel() { state.canceled++ },
  }, { highWaterMark: 0 })
  return { response: new Response(stream, { headers }), state }
}

describe('bounded upstream response reading', () => {
  test('each feed has an explicit byte budget', () => {
    expect(UPSTREAM_RESPONSE_LIMITS).toEqual({
      telemetry: 2 * 1024 * 1024,
      bridges: 4 * 1024 * 1024,
      staking: 4 * 1024 * 1024,
      historical: 8 * 1024 * 1024,
    })
  })

  test('rejects an oversized declared length before reading and cancels its source', async () => {
    const { response, state } = streamedResponse([encode('small')], { 'content-length': '101' })
    await expect(readBoundedText(response, 100)).rejects.toThrow()
    expect(state.pulls).toBe(0)
    expect(state.canceled).toBe(1)
  })

  test('rejects malformed declared lengths before reading', async () => {
    for (const value of ['-1', '+4', '1.5', '1e2', 'NaN', '4, 4', 'four']) {
      const { response, state } = streamedResponse([encode('test')], { 'content-length': value })
      await expect(readBoundedText(response, 100)).rejects.toThrow()
      expect(state.pulls).toBe(0)
    }
  })

  test('counts streamed bytes with omitted and underreported headers, then stops the source', async () => {
    for (const headers of [undefined, { 'content-length': '1' }]) {
      const { response, state } = streamedResponse([encode('12345'), encode('6789'), encode('never read')], headers)
      await expect(readBoundedText(response, 8)).rejects.toThrow()
      expect(state.pulls).toBe(2)
      expect(state.canceled).toBe(1)
      expect(response.body?.locked).toBe(false)
    }
  })

  test('accepts exactly the byte limit and decodes a character split across chunks', async () => {
    const text = 'A€🌍Z'
    const bytes = encode(text)
    const { response, state } = streamedResponse(
      [bytes.slice(0, 2), bytes.slice(2, 5), bytes.slice(5, 7), bytes.slice(7)],
      { 'content-length': String(bytes.byteLength) },
    )
    expect(await readBoundedText(response, bytes.byteLength)).toBe(text)
    expect(state.canceled).toBe(0)
    expect(response.body?.locked).toBe(false)
    // Five JavaScript code units occupy nine UTF-8 bytes; a character count is unsafe.
    await expect(readBoundedText(new Response(text), text.length)).rejects.toThrow()
  })

  test('attempts cancellation and releases the reader when a source read fails', async () => {
    const response = new Response(new ReadableStream<Uint8Array>({
      pull() { throw new Error('upstream read failed') },
    }, { highWaterMark: 0 }))
    const reader = response.body!.getReader()
    const getReader = spyOn(response.body!, 'getReader').mockImplementation(() => reader)
    const cancel = spyOn(reader, 'cancel')
    try {
      await expect(readBoundedText(response, 100)).rejects.toThrow()
      expect(cancel).toHaveBeenCalledTimes(1)
      expect(response.body?.locked).toBe(false)
    } finally {
      cancel.mockRestore()
      getReader.mockRestore()
    }
  })

  test('parses bounded JSON and hides malformed upstream payloads in its error', async () => {
    expect(await readBoundedJson(new Response('{"count":0}'), 11)).toEqual({ count: 0 })
    const marker = 'private-upstream-payload-should-not-appear'
    let failure: unknown
    try { await readBoundedJson(new Response('{"secret": "' + marker), 100) }
    catch (error) { failure = error }
    expect(failure).toBeInstanceOf(Error)
    expect((failure as Error).message).toBe('Upstream response is not valid JSON')
    expect(String(failure)).not.toContain(marker)
  })
})

describe('feed loaders fail closed on oversized upstream responses', () => {
  test('telemetry refuses valid but oversized JSON even when Content-Length underreports it', async () => {
    const sources: ReturnType<typeof streamedResponse>[] = []
    const padding = new Uint8Array(UPSTREAM_RESPONSE_LIMITS.telemetry).fill(32)
    const fetchImpl = (async (url: string | URL | Request) => {
      const network = TELEMETRY_NETWORKS.find(network => network.rpc === String(url))!
      const timestamp = Math.floor(Date.now() / 1000)
      const hash = '0x' + 'a'.repeat(64)
      const block = network.protocol === 'evm'
        ? { number: '0x100', timestamp: '0x' + timestamp.toString(16), hash, transactions: [] }
        : { block_number: 256, timestamp, block_hash: hash, status: 'ACCEPTED_ON_L2', transactions: [] }
      const body = JSON.stringify([{ jsonrpc: '2.0', id: 1, result: network.chainId }, { jsonrpc: '2.0', id: 2, result: block }])
      const source = streamedResponse([encode(body), padding], { 'content-length': '1' })
      sources.push(source)
      return source.response
    }) as typeof fetch
    const result = await loadTelemetry(fetchImpl)
    expect(result.chains).toHaveLength(TELEMETRY_NETWORKS.length)
    expect(result.chains.every(row => row.status === 'unavailable' && row.transactionCount === null && row.blockNumber === null)).toBe(true)
    expect(sources.every(source => source.state.canceled === 1)).toBe(true)
  })

  test('staking refuses an oversized header before parsing an otherwise valid total', async () => {
    const source = streamedResponse([encode('<div>43,558,895</div><div>Total ETH staked</div>')], {
      'content-length': String(UPSTREAM_RESPONSE_LIMITS.staking + 1),
    })
    await expect(loadStaking((async () => source.response) as typeof fetch)).rejects.toThrow()
    expect(source.state.pulls).toBe(0)
    expect(source.state.canceled).toBe(1)
  })

  test('bridges mark all attempted RPC sources unavailable when their declared bodies exceed the limit', async () => {
    const sources: ReturnType<typeof streamedResponse>[] = []
    const endpoints = new Set<string>()
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      endpoints.add(String(url))
      const request = JSON.parse(String(init?.body))
      const result = request.method === 'eth_chainId' ? '0x1'
        : request.method === 'eth_getLogs' ? []
        : { number: request.params[0] === 'latest' ? '0xc8' : request.params[0], hash: '0x' + 'a'.repeat(64), timestamp: '0x' + Math.floor(Date.now() / 1000).toString(16) }
      const source = streamedResponse([encode(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }))], {
        'content-length': String(UPSTREAM_RESPONSE_LIMITS.bridges + 1),
      })
      sources.push(source)
      return source.response
    }) as typeof fetch
    const result = await loadBridgeSnapshot(fetchImpl)
    expect(endpoints.size).toBe(2)
    expect(result.status).toBe('unavailable')
    expect(result.events).toEqual([])
    expect(result.toBlock).toBeNull()
    expect(result.coverage.filter(row => row.status !== 'unsupported').every(row => row.status === 'unavailable')).toBe(true)
    expect(sources.length).toBeGreaterThanOrEqual(4)
    expect(sources.every(source => source.state.pulls === 0 && source.state.canceled === 1)).toBe(true)
  })

  test('historical activity rejects a valid oversized dataset without a Content-Length header', async () => {
    const date = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
    const rows = SELECTED.map((chain: { origin: string }) => ({ origin_key: chain.origin, metric_key: 'txcount', date, value: 1 }))
    const source = streamedResponse([encode(JSON.stringify(rows)), new Uint8Array(UPSTREAM_RESPONSE_LIMITS.historical).fill(32)])
    const master = {
      chains: Object.fromEntries(SELECTED.map((chain: { origin: string; layer: string }) => [chain.origin, { deployment: 'PROD', chain_type: chain.layer, da_layer: 'Ethereum' }])),
      metrics: { txcount: { supported_chains: SELECTED.map((chain: { origin: string }) => chain.origin) } },
    }
    const fetchImpl = (async (url: string | URL | Request) => String(url) === ACTIVITY_URL ? source.response : Response.json(master)) as typeof fetch
    await expect(loadEthereumActivity(fetchImpl)).rejects.toThrow()
    expect(source.state.canceled).toBe(1)
    expect(source.response.body?.locked).toBe(false)
  })
})

import type { ChainTelemetry, TelemetryChainId, TelemetrySnapshot } from './telemetry'
import { readBoundedJson, UPSTREAM_RESPONSE_LIMITS } from './bounded-response.server'

type Network = {
  id: TelemetryChainId
  rpc: string
  chainId: string
  protocol: 'evm' | 'starknet'
  explorer: string
  maxBlockAgeMs: number
}

export const TELEMETRY_NETWORKS: readonly Network[] = [
  { id: 'ethereum', rpc: 'https://ethereum-rpc.publicnode.com', chainId: '0x1', protocol: 'evm', explorer: 'https://etherscan.io/block/', maxBlockAgeMs: 120_000 },
  { id: 'base', rpc: 'https://mainnet.base.org', chainId: '0x2105', protocol: 'evm', explorer: 'https://basescan.org/block/', maxBlockAgeMs: 120_000 },
  { id: 'arbitrum', rpc: 'https://arb1.arbitrum.io/rpc', chainId: '0xa4b1', protocol: 'evm', explorer: 'https://arbiscan.io/block/', maxBlockAgeMs: 120_000 },
  { id: 'optimism', rpc: 'https://mainnet.optimism.io', chainId: '0xa', protocol: 'evm', explorer: 'https://optimistic.etherscan.io/block/', maxBlockAgeMs: 120_000 },
  { id: 'starknet', rpc: 'https://api.cartridge.gg/x/starknet/mainnet', chainId: '0x534e5f4d41494e', protocol: 'starknet', explorer: 'https://voyager.online/block/', maxBlockAgeMs: 300_000 },
  { id: 'zksync-era', rpc: 'https://mainnet.era.zksync.io', chainId: '0x144', protocol: 'evm', explorer: 'https://explorer.zksync.io/block/', maxBlockAgeMs: 300_000 },
  { id: 'linea', rpc: 'https://rpc.linea.build', chainId: '0xe708', protocol: 'evm', explorer: 'https://lineascan.build/block/', maxBlockAgeMs: 300_000 },
  { id: 'mantle', rpc: 'https://rpc.mantle.xyz', chainId: '0x1388', protocol: 'evm', explorer: 'https://mantlescan.xyz/block/', maxBlockAgeMs: 300_000 },
  { id: 'ink', rpc: 'https://rpc-gel.inkonchain.com', chainId: '0xdef1', protocol: 'evm', explorer: 'https://explorer.inkonchain.com/block/', maxBlockAgeMs: 120_000 },
  { id: 'unichain', rpc: 'https://mainnet.unichain.org', chainId: '0x82', protocol: 'evm', explorer: 'https://uniscan.xyz/block/', maxBlockAgeMs: 120_000 },
]

const RPC_TIMEOUT_MS = 8_000
const HEX = /^0x[0-9a-fA-F]+$/
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function quantity(value: unknown): number {
  if (typeof value !== 'string' || !HEX.test(value)) throw new Error('RPC returned an invalid hex quantity')
  const n = BigInt(value)
  if (n < 0n || n > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('RPC quantity is out of range')
  return Number(n)
}
function integer(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('RPC returned an invalid integer')
  return value
}
function hash(value: unknown, protocol: Network['protocol']): string {
  if (typeof value !== 'string' || !(protocol === 'evm' ? /^0x[0-9a-fA-F]{64}$/ : /^0x[0-9a-fA-F]{1,64}$/).test(value)) {
    throw new Error('RPC returned an invalid block or transaction hash')
  }
  return value
}

export function parseTelemetryBatch(network: Network, payload: unknown, observedAt: string): ChainTelemetry {
  if (!Array.isArray(payload) || payload.length !== 2) throw new Error('RPC batch response is incomplete')
  const responses = new Map<number, Record<string, unknown>>()
  for (const value of payload) {
    if (!record(value) || value.jsonrpc !== '2.0' || (value.id !== 1 && value.id !== 2) || responses.has(value.id)) {
      throw new Error('RPC response identifiers do not match the request')
    }
    if (value.error !== undefined || !('result' in value)) throw new Error('RPC reported a method error')
    responses.set(value.id, value)
  }
  const reportedChain = responses.get(1)?.result
  if (typeof reportedChain !== 'string' || !HEX.test(reportedChain) || BigInt(reportedChain) !== BigInt(network.chainId)) {
    throw new Error('RPC mainnet identity check failed')
  }
  const block = responses.get(2)?.result
  if (!record(block) || !Array.isArray(block.transactions)) throw new Error('RPC latest block is unavailable')
  const blockNumber = network.protocol === 'evm' ? quantity(block.number) : integer(block.block_number)
  const timestamp = network.protocol === 'evm' ? quantity(block.timestamp) : integer(block.timestamp)
  const observedMs = Date.parse(observedAt)
  if (!Number.isFinite(observedMs) || timestamp <= 0 || timestamp * 1000 > observedMs + 60_000) {
    throw new Error('RPC block timestamp is invalid or in the future')
  }
  const blockHash = hash(network.protocol === 'evm' ? block.hash : block.block_hash, network.protocol)
  const transactions = block.transactions.map(value => hash(value, network.protocol))
  if (new Set(transactions).size !== transactions.length) throw new Error('RPC block contains duplicate transaction hashes')
  let finality = 'Latest block; finality not verified'
  if (network.protocol === 'starknet') {
    if (block.status !== 'ACCEPTED_ON_L2' && block.status !== 'ACCEPTED_ON_L1') throw new Error('Starknet latest block is not accepted')
    finality = block.status === 'ACCEPTED_ON_L1'
      ? 'Accepted on L1, as reported by Starknet RPC'
      : 'Accepted on L2; L1 finality not verified'
  }
  return {
    id: network.id, status: 'ok', blockNumber, blockHash,
    blockTimestamp: new Date(timestamp * 1000).toISOString(),
    transactionCount: transactions.length, observedAt,
    sourceUrl: network.rpc, explorerUrl: network.explorer + blockNumber,
    finality, maxBlockAgeMs: network.maxBlockAgeMs,
  }
}

async function loadChain(network: Network, fetchImpl: typeof fetch): Promise<ChainTelemetry> {
  const starknet = network.protocol === 'starknet'
  const response = await fetchImpl(network.rpc, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
    body: JSON.stringify([
      { jsonrpc: '2.0', id: 1, method: starknet ? 'starknet_chainId' : 'eth_chainId', params: [] },
      { jsonrpc: '2.0', id: 2, method: starknet ? 'starknet_getBlockWithTxHashes' : 'eth_getBlockByNumber', params: starknet ? ['latest'] : ['latest', false] },
    ]),
  })
  if (!response.ok) throw new Error('Public RPC returned HTTP ' + response.status)
  const payload = await readBoundedJson(response, UPSTREAM_RESPONSE_LIMITS.telemetry)
  return parseTelemetryBatch(network, payload, new Date().toISOString())
}

function unavailable(network: Network, reason: unknown): ChainTelemetry {
  const error = reason instanceof Error && ['TimeoutError', 'AbortError'].includes(reason.name)
    ? 'Public RPC timed out after 8 seconds'
    : reason instanceof Error && reason.message.startsWith('Public RPC returned HTTP')
      ? reason.message
      : reason instanceof Error && reason.message.startsWith('RPC')
        ? reason.message
        : 'Public RPC could not be verified'
  return {
    id: network.id, status: 'unavailable', blockNumber: null, blockHash: null,
    blockTimestamp: null, transactionCount: null, observedAt: new Date().toISOString(),
    sourceUrl: network.rpc, explorerUrl: null, finality: 'Unavailable',
    maxBlockAgeMs: network.maxBlockAgeMs, error,
  }
}

// Fixed read-only endpoints only. A failed chain never substitutes a dated activity snapshot.
export async function loadTelemetry(fetchImpl: typeof fetch = fetch): Promise<TelemetrySnapshot> {
  const results = await Promise.allSettled(TELEMETRY_NETWORKS.map(network => loadChain(network, fetchImpl)))
  return {
    polledAt: new Date().toISOString(),
    chains: results.map((result, i) => result.status === 'fulfilled' ? result.value : unavailable(TELEMETRY_NETWORKS[i], result.reason)),
  }
}

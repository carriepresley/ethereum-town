export type TelemetryChainId = 'ethereum' | 'base' | 'arbitrum' | 'optimism' | 'starknet' | 'zksync-era' | 'linea' | 'mantle' | 'ink' | 'unichain'

export type ChainTelemetry = {
  id: TelemetryChainId
  status: 'ok' | 'unavailable'
  blockNumber: number | null
  blockHash: string | null
  blockTimestamp: string | null
  transactionCount: number | null
  observedAt: string
  sourceUrl: string
  explorerUrl: string | null
  finality: string
  maxBlockAgeMs: number
  error?: string
}

export type TelemetrySnapshot = {
  polledAt: string
  chains: ChainTelemetry[]
}

export const TELEMETRY_POLL_MS = 30_000
export const TELEMETRY_MAX_POLL_AGE_MS = 90_000
export const TELEMETRY_METRIC_LABEL = 'Transactions in latest observed block'

// Operational display rules only; an old observation is not proof a network has stopped.
export function isTelemetryFresh(row: ChainTelemetry | undefined, now = Date.now()): boolean {
  if (!row || row.status !== 'ok' || row.blockTimestamp === null) return false
  const observed = Date.parse(row.observedAt)
  const block = Date.parse(row.blockTimestamp)
  return Number.isFinite(observed) && Number.isFinite(block)
    && now - observed >= -60_000 && now - observed <= TELEMETRY_MAX_POLL_AGE_MS
    && now - block >= -60_000 && now - block <= row.maxBlockAgeMs
}

/** Failed checks retain last known data, but never advance its observedAt or keep it live. */
export function mergeTelemetrySnapshot(previous: TelemetrySnapshot, next: TelemetrySnapshot): TelemetrySnapshot {
  return {...next,chains:next.chains.map(row=>{
    if(row.status==='ok')return row
    const old=previous.chains.find(value=>value.id===row.id)
    return old?.blockNumber!==null&&old?.blockNumber!==undefined
      ? {...old,status:'unavailable',error:row.error}:row
  })}
}
export function markTelemetryUnavailable(previous: TelemetrySnapshot): TelemetrySnapshot {
  return {...previous,polledAt:new Date().toISOString(),chains:previous.chains.map(row=>({...row,status:'unavailable',error:'Feed request failed. Last known block retained.'}))}
}

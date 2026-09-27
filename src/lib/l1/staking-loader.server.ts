// @ts-nocheck
import { readBoundedText, UPSTREAM_RESPONSE_LIMITS } from './bounded-response.server'
// Server-only fetch: never expose a Dune credential or substitute validator count times 32.
export const STAKING_SOURCE_URL = 'https://ethereum.org/staking/'
export const STAKING_PROVIDER = 'ethereum.org (Dune Analytics)'
export const STAKING_WARNING = "Ethereum.org reports this total without a metric timestamp or epoch. Source-checked time is when the page was fetched, not an on-chain as-of time."

export function parseStakingHtml(html) {
  if (typeof html !== 'string' || html.length === 0) throw new Error('Empty Ethereum staking page')
  // Read only the unique visible server-rendered card, not duplicated hydration data.
  const visibleHtml = html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
  const card = /<div\b[^>]*>\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)\s*<\/div>\s*<div\b[^>]*>\s*Total ETH staked\s*(?=<|$)/g
  const matches = [...visibleHtml.matchAll(card)]
  if (matches.length !== 1) throw new Error('Ethereum staking total card is missing or ambiguous')
  const reportedStakedEth = Number(matches[0][1].replace(/,/g, ''))
  if (!Number.isSafeInteger(reportedStakedEth) || reportedStakedEth <= 0 || reportedStakedEth > 1_000_000_000) {
    throw new Error('Ethereum staking total is not a plausible positive integer ETH amount')
  }
  return reportedStakedEth
}

export async function loadStaking(fetchImpl = fetch) {
  const response = await fetchImpl(STAKING_SOURCE_URL, {
    cache: 'no-store',
    headers: { accept: 'text/html', 'user-agent': 'TokenTown/1.0 (public Ethereum staking source)' },
    signal: AbortSignal.timeout(12_000),
  })
  if (!response.ok) throw new Error('Ethereum staking source returned HTTP ' + response.status)
  const reportedStakedEth = parseStakingHtml(await readBoundedText(response, UPSTREAM_RESPONSE_LIMITS.staking))
  return {
    reportedStakedEth,
    capturedAt: new Date().toISOString(),
    sourceUrl: STAKING_SOURCE_URL,
    provider: STAKING_PROVIDER,
    sourceNote: STAKING_WARNING,
  }
}

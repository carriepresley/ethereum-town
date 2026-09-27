// @ts-nocheck
import { readBoundedJson, UPSTREAM_RESPONSE_LIMITS } from './bounded-response.server'
// Public, documented daily dataset. Keep fetches server-side and cache for 15 minutes.
export const ACTIVITY_URL = 'https://api.growthepie.com/v1/export/txcount.json';
export const MASTER_URL = 'https://api.growthepie.com/v1/master.json';
export const SELECTED = [
  { slug:'ethereum', origin:'ethereum', name:'Ethereum', layer:'l1' },
  { slug:'base', origin:'base', name:'Base', layer:'rollup' },
  { slug:'arbitrum', origin:'arbitrum', name:'Arbitrum One', layer:'rollup' },
  { slug:'optimism', origin:'optimism', name:'OP Mainnet', layer:'rollup' },
  { slug:'starknet', origin:'starknet', name:'Starknet', layer:'rollup' },
  { slug:'zksync-era', origin:'zksync_era', name:'ZKsync Era', layer:'rollup' },
  { slug:'linea', origin:'linea', name:'Linea', layer:'rollup' },
];
export const NOTES = {
  ethereum:'Ethereum mainnet transactions. L2 execution counts are shown separately; rollup submissions are already part of the mainnet count.',
  base:'Transactions executed on Base, an Ethereum L2. Its connection to Ethereum represents data publication and settlement, not measured bridge transfers.',
  arbitrum:'Transactions executed on Arbitrum One, an optimistic rollup. Its connection to Ethereum represents data publication and settlement, not measured bridge transfers.',
  optimism:'Transactions executed on OP Mainnet, an optimistic rollup. Its connection to Ethereum represents data publication and settlement, not measured bridge transfers.',
  starknet:'Transactions executed on Starknet, a validity rollup. State updates and validity proofs link it to Ethereum; displayed routes are conceptual.',
  'zksync-era':'Transactions executed on ZKsync Era, a validity rollup. State updates and validity proofs link it to Ethereum; displayed routes are conceptual.',
  linea:'Transactions executed on Linea, a validity rollup. State updates and validity proofs link it to Ethereum; displayed routes are conceptual.',
};
export function parseEthereumActivity(rows, master, now = new Date()) {
  if (!Array.isArray(rows) || !master?.chains) throw new Error('Invalid provider dataset.');
  const today = now.toISOString().slice(0,10);
  const byOrigin = new Map(SELECTED.map(c=>[c.origin,new Map()]));
  for (const c of SELECTED) {
    const meta = master.chains[c.origin];
    if (meta?.deployment !== 'PROD' || meta.chain_type !== c.layer ||
        !master.metrics?.txcount?.supported_chains?.includes(c.origin)) {
      throw new Error('Chain coverage or classification changed: '+c.origin);
    }
    if (c.layer === 'rollup' && !String(meta.da_layer || '').startsWith('Ethereum')) {
      throw new Error('Ethereum data-availability relationship changed: '+c.origin);
    }
  }
  for (const row of rows) {
    const bucket = byOrigin.get(row.origin_key);
    if (!bucket || row.metric_key !== 'txcount') continue;
    if (typeof row.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
      throw new Error('Invalid provider UTC date.');
    }
    const date = new Date(row.date+'T00:00:00Z');
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== row.date) {
      throw new Error('Invalid provider calendar date.');
    }
    // A partial current UTC day or a future row can never become the selected date.
    if (row.date >= today) continue;
    if (!Number.isSafeInteger(row.value) || row.value < 0) {
      throw new Error('Invalid transaction count for '+row.origin_key);
    }
    if (bucket.has(row.date) && bucket.get(row.date) !== row.value) {
      throw new Error('Conflicting provider counts.');
    }
    bucket.set(row.date,row.value);
  }
  const common = [...byOrigin.get('ethereum').keys()]
    .filter(date=>SELECTED.every(c=>byOrigin.get(c.origin).has(date))).sort();
  const dateUtc = common.at(-1);
  if (!dateUtc) throw new Error('No complete common UTC day for all seven networks.');
  const chains = SELECTED.map(c=>({
    chain:c.name, slug:c.slug, originKey:c.origin,
    transactionCount:byOrigin.get(c.origin).get(dateUtc),
    sourceUrl:ACTIVITY_URL, notes:NOTES[c.slug],
    layer:c.layer==='l1'?'Layer 1':'Layer 2',
    rollupType:master.chains[c.origin].technology,
    dataAvailability:master.chains[c.origin].da_layer || null,
    relationshipUrl:master.chains[c.origin].l2beat_link,
  }));
  return {
    provider:'growthepie',sourceUrl:ACTIVITY_URL,
    capturedAt:now.toISOString(),dateUtc,periodVerified:true,
    period:'Latest completed UTC date shared by all seven source series',
    periodVerification:'Explicit provider UTC calendar dates; all seven series present; current and future dates excluded.',
    providerMetadataUpdatedAt:master.last_updated_utc || null,
    metric:'txcount',
    metricDefinition:'Provider-reported chain transaction count, not unique users, dollars, bridge transfers, batch count or proof count. The app applies no additional transaction filter. Transaction complexity differs between networks.',
    chains,
  };
}
export async function loadEthereumActivity(fetchImpl=fetch) {
  const [activityResponse,masterResponse]=await Promise.all([
    fetchImpl(ACTIVITY_URL,{headers:{Accept:'application/json'}}),
    fetchImpl(MASTER_URL,{headers:{Accept:'application/json'}}),
  ]);
  if (!activityResponse.ok || !masterResponse.ok) throw new Error('Activity source unavailable.');
  const [rows,master]=await Promise.all([
    readBoundedJson(activityResponse,UPSTREAM_RESPONSE_LIMITS.historical),
    readBoundedJson(masterResponse,UPSTREAM_RESPONSE_LIMITS.historical),
  ]);
  return parseEthereumActivity(rows,master,new Date());
}
// Preserve the existing server-function import while the presentation changes.
export const loadChainspect=loadEthereumActivity;

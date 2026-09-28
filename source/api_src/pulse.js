// Ethereum Town — live block feed.
// Returns the latest few mainnet blocks with the L2s that posted blobs in each.
// Cached at the edge for a few seconds so every visitor shares one upstream call.
const RPCS = [
  'https://ethereum-rpc.publicnode.com',
  'https://eth.llamarpc.com',
  'https://eth.drpc.org',
  'https://rpc.mevblocker.io',
];
const SENDERS = __SENDERS__;
const BLOBSCAN_KEYS = { base: 'base', arbitrum: 'arbitrum', world: 'worldchain', optimism: 'optimism', unichain: 'unichain', zksync: 'zksync' };
const GAS_LIMIT_FALLBACK = 60e6;

async function getJSON(url, init = {}, ms = 4000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { ...init, signal: ctl.signal, headers: { 'content-type': 'application/json', 'user-agent': 'ethereum-town/1.0', ...(init.headers || {}) } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}
async function rpc(body) {
  let last;
  for (const url of RPCS) {
    try {
      const j = await getJSON(url, { method: 'POST', body: JSON.stringify(body) }, 3500);
      if (Array.isArray(body) ? Array.isArray(j) : j && j.result !== undefined) return j;
      last = new Error('bad rpc response');
    } catch (e) { last = e; }
  }
  throw last || new Error('rpc failed');
}
const hex = (n) => '0x' + n.toString(16);
const num = (h) => (h ? parseInt(h, 16) : 0);
function keyFor(rollup, from) {
  if (rollup) return BLOBSCAN_KEYS[rollup] || rollup;
  return SENDERS[(from || '').toLowerCase()] || 'other';
}

module.exports = async (req, res) => {
  try {
    const head = num((await rpc({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] })).result);
    const nums = [head - 3, head - 2, head - 1, head];
    const batch = await rpc(nums.map((n) => ({ jsonrpc: '2.0', id: n, method: 'eth_getBlockByNumber', params: [hex(n), false] })));
    const blocks = batch.map((r) => r.result).filter(Boolean).sort((a, b) => num(a.number) - num(b.number));

    // blob posters: Blobscan's recent transactions carry rollup labels
    const posters = new Map(); // block number -> Map(key -> blobs)
    let indexedTo = 0;
    try {
      const bs = await getJSON('https://api.blobscan.com/transactions?ps=40', {}, 3000);
      for (const t of bs.transactions || []) {
        indexedTo = Math.max(indexedTo, t.blockNumber);
        if (!posters.has(t.blockNumber)) posters.set(t.blockNumber, new Map());
        const m = posters.get(t.blockNumber), k = keyFor(t.rollup, t.from);
        m.set(k, (m.get(k) || 0) + ((t.blobs && t.blobs.length) || 1));
      }
    } catch (e) { /* fall back to RPC below */ }

    // any block with blobs that Blobscan hasn't indexed yet: read its type-3 transactions directly
    const missing = blocks.filter((b) => num(b.blobGasUsed) > 0 && !posters.has(num(b.number)));
    if (missing.length) {
      try {
        const full = await rpc(missing.map((b) => ({ jsonrpc: '2.0', id: num(b.number), method: 'eth_getBlockByNumber', params: [b.number, true] })));
        for (const r of full) {
          const b = r.result; if (!b) continue;
          const m = new Map();
          for (const tx of b.transactions || []) {
            if (tx.type !== '0x3') continue;
            const k = keyFor(null, tx.from);
            m.set(k, (m.get(k) || 0) + ((tx.blobVersionedHashes && tx.blobVersionedHashes.length) || 1));
          }
          posters.set(num(b.number), m);
        }
      } catch (e) { /* leave unlabeled */ }
    }

    const out = blocks.map((b) => {
      const n = num(b.number), gl = num(b.gasLimit) || GAS_LIMIT_FALLBACK, gu = num(b.gasUsed), bf = num(b.baseFeePerGas);
      const blobs = Math.round(num(b.blobGasUsed) / 131072);
      const m = posters.get(n) || new Map();
      let list = [...m.entries()].sort((a, c) => c[1] - a[1]);
      const counted = list.reduce((s, p) => s + p[1], 0);
      if (counted < blobs) list.push(['other', blobs - counted]);
      return {
        n, ts: num(b.timestamp), tx: (b.transactions || []).length, gasPct: +(gu / gl * 100).toFixed(1), gasLimit: gl,
        baseFee: +(bf / 1e9).toFixed(4), blobs, posters: list, burn: +(gu * bf / 1e18).toFixed(6),
      };
    });
    res.setHeader('Cache-Control', 'public, s-maxage=8, stale-while-revalidate=30');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({ ok: true, head, indexedTo, blocks: out, t: Date.now() });
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ ok: false, error: String(e && e.message || e) });
  }
};

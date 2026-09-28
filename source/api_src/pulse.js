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
// most blocks carry their builder's name in extraData (e.g. "Titan (titanbuilder.xyz)")
function builderOf(extra) {
  if (!extra || extra.length < 4) return null;
  let s = '';
  for (let i = 2; i + 1 < extra.length; i += 2) { const c = parseInt(extra.slice(i, i + 2), 16); if (c >= 32 && c < 127) s += String.fromCharCode(c); }
  s = s.trim();
  return (s.match(/[A-Za-z]/g) || []).length >= 3 ? s.slice(0, 40) : null;
}
// validator withdrawals in this block: [reward payouts, ETH they carried, ETH of stake withdrawn (1 ETH or more each)]
function withdrawalsOf(ws) {
  let n = 0, skim = 0, big = 0;
  for (const w of ws || []) { const a = num(w.amount) / 1e9; if (a < 1) { n++; skim += a; } else big += a; }
  return [n, +skim.toFixed(4), +big.toFixed(3)];
}
function keyFor(rollup, from) {
  if (rollup) return BLOBSCAN_KEYS[rollup] || rollup;
  return SENDERS[(from || '').toLowerCase()] || 'other';
}

module.exports = async (req, res) => {
  try {
    const head = num((await rpc({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] })).result);
    const nums = [head - 3, head - 2, head - 1, head];
    const batch = await rpc(nums.map((n) => ({ jsonrpc: '2.0', id: n, method: 'eth_getBlockByNumber', params: [hex(n), false] }))
      .concat([{ jsonrpc: '2.0', id: 'fin', method: 'eth_getBlockByNumber', params: ['finalized', false] }, { jsonrpc: '2.0', id: 'fee', method: 'eth_feeHistory', params: ['0xa', 'latest', [50]] }]));
    const byId = Object.fromEntries(batch.map((r) => [String(r.id), r.result]));
    const blocks = nums.map((n) => byId[String(n)]).filter(Boolean).sort((a, b) => num(a.number) - num(b.number));
    const fin = byId.fin ? { n: num(byId.fin.number), ts: num(byId.fin.timestamp) } : null;
    const tips = ((byId.fee && byId.fee.reward) || []).map((r) => num(r && r[0]) / 1e9).filter((x) => isFinite(x));
    tips.sort((a, b) => a - b); // median of the last 10 blocks' median tips: one odd block doesn't swing it
    const tipGwei = tips.length ? +tips[Math.floor(tips.length / 2)].toFixed(4) : null;

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
        baseFee: +(bf / 1e9).toFixed(4), blobs, posters: list, burn: +(gu * bf / 1e18).toFixed(6), builder: builderOf(b.extraData),
        wd: withdrawalsOf(b.withdrawals),
      };
    });
    res.setHeader('Cache-Control', 'public, s-maxage=8, stale-while-revalidate=30');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({ ok: true, head, indexedTo, blocks: out, finalized: fin, tipGwei, t: Date.now() });
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ ok: false, error: String(e && e.message || e) });
  }
};

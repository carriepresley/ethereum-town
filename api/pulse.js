// Ethereum Town — live block feed.
// Returns the latest few mainnet blocks with the L2s that posted blobs in each.
// Cached at the edge for a few seconds so every visitor shares one upstream call.
const RPCS = [
  'https://ethereum-rpc.publicnode.com',
  'https://eth.llamarpc.com',
  'https://eth.drpc.org',
  'https://rpc.mevblocker.io',
];
const SENDERS = {"0x5050f69a9786f081509234f1a7f4684b5e5b76c9":"base","0x2f40d796917ffb642bd2e2bdd2c762a5e40fd749":"mantle","0xdaa526086787d9debe1d7f3ffdb1fe50cf8687f4":"robinhood","0x6db6161fc5662450e801398bad62dd9921216b98":"ink","0x5f62d006c10c009ff50c878cd6157ac861c99990":"taiko","0xae4d46bd9117cb017c5185844699c51107cb28a9":"metis","0xc1b634853cb333d3ad8663715b08f41a3aec47cc":"arbitrum","0x98245d0adf4595c66f0a9db8e13c44cbff6be459":"xlayer","0x191ff0ec830f83916a427d169a234c33e48aa79f":"lighter","0x2f60a5184c63ca94f82a27100643dbabe4f3f7fd":"unichain","0x6887246668a3b87f54deb3b94ba47a6f63f32985":"optimism","0xc94c243f8fb37223f3eb2f7961f7072602a51b8b":"metal","0xf7ca543d652e38692fd12f989eb55b5327ec9a20":"shape","0xdbbe3d8c2d2b22a2611c5a94a9a12c2fcd49eb29":"worldchain","0x65115c6d23274e0a29a63b69130efe901aa52e7a":"hemi","0x625726c858dbf78c0125436c943bf4b4be9d9033":"zora","0x5e70713222faf60c9e9fb69240d06ae6d688563a":"hashkey","0x6be789605b13edb78749824633b9933d44b582ba":"abstract","0x1ffda89c755f6d4af069897d77ccabb580fd412a":"katana","0x35376dd47c061bc3b8c8e8d61987019e7ed58f06":"taiko","0xa9b074b27de97f492f8f07fd7c213400e4ca5391":"superseed","0x415c8893d514f9bc5211d36eeda4183226b84aa7":"blast","0x6ab0e960911b50f6d14f249782ac12ec3e7584a0":"morph","0x705623d3985cf88e5a69fc99ca7d089063449902":"pegglecoin","0x6776be80dbada6a02b5f2095cf13734ac303b8d1":"soneium","0x08f9f14ff43e112b18c96f0986f28cb1878f1d11":"bob","0xb5bd290ef8ef3840cb866c7a8b7cc9e45fde3ab9":"codex","0x054a47b9e2a22af6c0ce55020238c8fecd7d334b":"scroll","0xa90c7cdb553332948e2943431436117ecfb1e781":"zksync2","0xcf8225801df6ef90ad3bc86808f574403a309de8":"zircuit","0x9fb23129982c993743eb9bb156af8cc8fa2ac761":"phala","0xa4ed58737fc5c4861c33410c29ecb1e2af29d960":"boba","0x2c169dfe5fbba12957bdd0ba47d9cedbfe260ca7":"starknet","0x99199a22125034c808ff20f377d91187e8050f2e":"mode","0x8839e742fd56ebc0d31d11dd5a2ca25aa61c54da":"forknet","0x7ab7da0c3117d7dfe0abfaa8d8d33883f8477c74":"debankchain","0xde794bec196832474f2f218135bfd0f7ca7fb038":"swanchain","0xd0b4c3ac8a50b6f1b3949adaf55cc9805620eb57":"settlus","0x46d2f319fd42165d4318f099e143dea8124e9e3e":"linea","0xf263a0aa8afeaa7d516b596d49d7ba6c0feb102c":"r0ar","0xbe7f4edb6257b4d2c77293c380f19ce96a4fa41e":"symbiosis","0xa6ea2f3299b63c53143c993d2d5e60a69cd6fe24":"lisk"};
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

// Ethereum Town — slow-moving numbers: L2 rankings, staking queues, supply, stablecoins.
// Cached at the edge for 15 minutes.
const CANDIDATES = [["lighter","lighter"],["rise","rise"],["base","base"],["robinhood","robinhood"],["fuel","fuel"],["polygon-pos","polygon-pos"],["megaeth","megaeth"],["optimism","op-mainnet"],["arbitrum","arbitrum"],["xlayer","xlayer"],["celo","celo"],["worldchain","world"],["unichain","unichain"],["ink","ink"],["gnosis","gnosis"],["soneium","soneium"],["lasernet","lasernet"],["abstract","abstract"],["blast","blast"],["eclipse","eclipse"],["starknet","starknet"],["plumenetwork","plumenetwork"],["paradex","paradex"],["roninnetwork","ronin-network"]]; // [id, slug] pairs, busiest L2s at the last snapshot
const NAMES = { base: 'Base', 'polygon-pos': 'Polygon PoS', optimism: 'OP Mainnet', arbitrum: 'Arbitrum One', xlayer: 'X Layer', fuel: 'Fuel', zksync2: 'ZKsync Era', worldchain: 'World Chain', robinhood: 'Robinhood Chain', gnosis: 'Gnosis Chain', starknet: 'Starknet', megaeth: 'MegaETH', rise: 'RISE', lyra: 'Derive', roninnetwork: 'Ronin', taiko: 'Taiko', mantapacific: 'Manta Pacific', plumenetwork: 'Plume', lasernet: 'Lasernet', immutablezkevm: 'Immutable zkEVM', metis: 'Metis', galxegravity: 'Gravity' };
// block builders sign blocks in extraData; the same grouping runs in the page
const BUILDERS = [[/titan/, 'titan', 'Titan'], [/buildernet/, 'buildernet', 'BuilderNet'], [/quasar/, 'quasar', 'Quasar'], [/beaver/, 'beaver', 'beaverbuild'], [/rsync/, 'rsync', 'rsync'], [/bloxroute|blxr/, 'bloxroute', 'bloXroute'], [/btcs/, 'btcs', 'BTCS'], [/eureka/, 'eureka', 'Eureka'], [/bobthebuilder/, 'bob', 'bobTheBuilder'], [/bombora/, 'bombora', 'Bombora'], [/ultrasound/, 'ultrasound', 'Ultra Sound']];
const BUILDER_NAMES = Object.fromEntries(BUILDERS.map((b) => [b[1], b[2]]).concat([['self', 'Built by validators'], ['untagged', 'No tag'], ['other', 'Other builders']]));
function tagOf(extra) { let s = ''; for (let i = 2; i + 1 < (extra || '').length; i += 2) { const c = parseInt(extra.slice(i, i + 2), 16); if (c >= 32 && c < 127) s += String.fromCharCode(c); } return s.trim(); }
function builderKey(tag) {
  const t = (tag || '').toLowerCase();
  if (!t) return 'untagged';
  if (/^(geth|nethermind|besu|erigon|reth)/.test(t.replace(/[^a-z0-9]/g, ''))) return 'self';
  for (const [rx, k] of BUILDERS) if (rx.test(t)) return k;
  return 'other';
}
const tvsEx = (p) => ((p.tvs && p.tvs.breakdown && p.tvs.breakdown.total) || 0) - ((p.tvs && p.tvs.breakdown && p.tvs.breakdown.associated) || 0);
const BLOBSCAN_KEYS = { base: 'base', arbitrum: 'arbitrum', world: 'worldchain', optimism: 'optimism', unichain: 'unichain', zksync: 'zksync2' };
const SENDERS = {"0x5050f69a9786f081509234f1a7f4684b5e5b76c9":"base","0x2f40d796917ffb642bd2e2bdd2c762a5e40fd749":"mantle","0xdaa526086787d9debe1d7f3ffdb1fe50cf8687f4":"robinhood","0x6db6161fc5662450e801398bad62dd9921216b98":"ink","0x5f62d006c10c009ff50c878cd6157ac861c99990":"taiko","0xae4d46bd9117cb017c5185844699c51107cb28a9":"metis","0xc1b634853cb333d3ad8663715b08f41a3aec47cc":"arbitrum","0x98245d0adf4595c66f0a9db8e13c44cbff6be459":"xlayer","0x191ff0ec830f83916a427d169a234c33e48aa79f":"lighter","0x2f60a5184c63ca94f82a27100643dbabe4f3f7fd":"unichain","0x6887246668a3b87f54deb3b94ba47a6f63f32985":"optimism","0xc94c243f8fb37223f3eb2f7961f7072602a51b8b":"metal","0xf7ca543d652e38692fd12f989eb55b5327ec9a20":"shape","0xdbbe3d8c2d2b22a2611c5a94a9a12c2fcd49eb29":"worldchain","0x65115c6d23274e0a29a63b69130efe901aa52e7a":"hemi","0x625726c858dbf78c0125436c943bf4b4be9d9033":"zora","0x5e70713222faf60c9e9fb69240d06ae6d688563a":"hashkey","0x6be789605b13edb78749824633b9933d44b582ba":"abstract","0x1ffda89c755f6d4af069897d77ccabb580fd412a":"katana","0x35376dd47c061bc3b8c8e8d61987019e7ed58f06":"taiko","0xa9b074b27de97f492f8f07fd7c213400e4ca5391":"superseed","0x415c8893d514f9bc5211d36eeda4183226b84aa7":"blast","0x6ab0e960911b50f6d14f249782ac12ec3e7584a0":"morph","0x705623d3985cf88e5a69fc99ca7d089063449902":"pegglecoin","0x6776be80dbada6a02b5f2095cf13734ac303b8d1":"soneium","0x08f9f14ff43e112b18c96f0986f28cb1878f1d11":"bob","0xb5bd290ef8ef3840cb866c7a8b7cc9e45fde3ab9":"codex","0x054a47b9e2a22af6c0ce55020238c8fecd7d334b":"scroll","0xa90c7cdb553332948e2943431436117ecfb1e781":"zksync2","0xcf8225801df6ef90ad3bc86808f574403a309de8":"zircuit","0x9fb23129982c993743eb9bb156af8cc8fa2ac761":"phala","0xa4ed58737fc5c4861c33410c29ecb1e2af29d960":"boba","0x2c169dfe5fbba12957bdd0ba47d9cedbfe260ca7":"starknet","0x99199a22125034c808ff20f377d91187e8050f2e":"mode","0x8839e742fd56ebc0d31d11dd5a2ca25aa61c54da":"forknet","0x7ab7da0c3117d7dfe0abfaa8d8d33883f8477c74":"debankchain","0xde794bec196832474f2f218135bfd0f7ca7fb038":"swanchain","0xd0b4c3ac8a50b6f1b3949adaf55cc9805620eb57":"settlus","0x46d2f319fd42165d4318f099e143dea8124e9e3e":"linea","0xf263a0aa8afeaa7d516b596d49d7ba6c0feb102c":"r0ar","0xbe7f4edb6257b4d2c77293c380f19ce96a4fa41e":"symbiosis","0xa6ea2f3299b63c53143c993d2d5e60a69cd6fe24":"lisk"};
const RPC = 'https://ethereum-rpc.publicnode.com';

async function get(url, ms = 8000, type = 'json', init = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { ...init, signal: ctl.signal, headers: { 'user-agent': 'Mozilla/5.0 (ethereum-town)', ...(init.headers || {}) } });
    if (!r.ok) throw new Error(url + ' ' + r.status);
    return type === 'json' ? await r.json() : await r.text();
  } finally { clearTimeout(t); }
}
const settle = async (p) => { try { return await p; } catch (e) { return null; } };
const avg = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
function fakeExp(factor, num, den) { let i = 1, out = 0, acc = factor * den; while (acc > 0 && i < 200) { out += acc; acc = Math.floor(acc * num / (den * i)); i++; } return out / den; }

module.exports = async (req, res) => {
  const out = { ok: true, asOf: new Date().toISOString() };
  const [summary, vqHtml, gauge, burnSums, priceStats, supplyParts, stables, agg1y] = await Promise.all([
    settle(get('https://l2beat.com/api/scaling/summary', 9000)),
    settle(get('https://www.validatorqueue.com/', 9000, 'text')),
    settle(get('https://ultrasound.money/api/v2/fees/gauge-rates', 6000)),
    settle(get('https://ultrasound.money/api/v2/fees/burn-sums', 6000)),
    settle(get('https://ultrasound.money/api/v2/fees/eth-price-stats', 6000)),
    settle(get('https://ultrasound.money/api/v2/fees/supply-parts', 6000)),
    settle(get('https://stablecoins.llama.fi/stablecoins?includePrices=false', 9000)),
    settle(get('https://l2beat.com/api/scaling/activity?range=max', 9000)),
  ]);

  // ---- the district: the 14 L2s with the best average of their activity rank and value-secured rank
  try {
    const projects = (summary && summary.projects) || {};
    const elig = Object.entries(projects).filter(([, p]) => p.type === 'layer2' && !p.isArchived && p.hostChain === 'Ethereum');
    const valueOrder = elig.sort((a, b) => tvsEx(b[1]) - tvsEx(a[1]));
    const rv = Object.fromEntries(valueOrder.map(([id], i) => [id, i + 1]));
    const byTvs = valueOrder.slice(0, 16).map(([id, p]) => [id, p.slug]);
    const cand = new Map([...CANDIDATES, ...byTvs].map(([id, slug]) => [id, slug]));
    const acts = await Promise.all([...cand.entries()].map(async ([id, slug]) => {
      const j = await settle(get('https://l2beat.com/api/scaling/activity/' + slug, 7000));
      const rows = (j && j.data && j.data.chart && j.data.chart.data || []).map((r) => [r[0], r[1] || 0, r[2] || 0]);
      if (rows.length < 14) return null;
      const u7 = avg(rows.slice(-7).map((r) => r[2])) / 86400, up = avg(rows.slice(-14, -7).map((r) => r[2])) / 86400;
      const p = projects[id]; if (!p) return null;
      const da = (p.badges || []).filter((b) => b.type === 'DA').map((b) => b.id);
      const risks = Object.fromEntries((p.risks || []).map((r) => [r.name, r.value]));
      const fmtD = (ts) => new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
      const last30 = rows.slice(-30);
      return {
        key: id, slug, name: NAMES[id] || p.name.replace(/ Chain$/, id === 'robinhood' ? ' Chain' : ''),
        uops: +u7.toFixed(1), wow: up ? +(u7 / up - 1).toFixed(4) : 0,
        // value secured without the chain's own token (L2BEAT 'associated'); keep the total for the card
        tvs: Math.round(((p.tvs && p.tvs.breakdown && p.tvs.breakdown.total) || 0) - ((p.tvs && p.tvs.breakdown && p.tvs.breakdown.associated) || 0)),
        tvsTotal: Math.round((p.tvs && p.tvs.breakdown && p.tvs.breakdown.total) || 0),
        ownToken: ((p.tvs && p.tvs.associatedTokens) || []).slice(0, 2).map((t) => t.symbol).join('/'),
        tvs7d: +((p.tvs && p.tvs.change7d) || 0).toFixed(4),
        stage: p.stage, category: p.category, stack: (p.providers || []).join(', ') || 'Independent',
        da: da.includes('EthereumBlobs') ? 'blobs' : (da.some((d) => d.includes('EigenDA')) ? 'eigenda' : 'own'), daLabel: risks['Data Availability'] || '',
        txPerDay: Math.round(avg(rows.slice(-7).map((r) => r[1]))),
        spark: last30.map((r) => +(r[2] / 86400).toFixed(2)), sparkRange: [fmtD(last30[0][0]), fmtD(last30[last30.length - 1][0])],
        blobsPerDay: 0, blobShare: 0, rv: rv[id],
        risks: (p.risks || []).map((r) => [r.name, r.value, r.sentiment || '', (r.regular && r.regular.value) || null]),
      };
    }));
    const ranked = acts.filter(Boolean).sort((a, b) => b.uops - a.uops);
    ranked.forEach((s, i) => { s.ru = i + 1; });
    const district = ranked.slice().sort((a, b) => (a.ru + a.rv) / 2 - (b.ru + b.rv) / 2 || a.ru - b.ru).slice(0, 14);
    district.forEach((s, i) => { s.rank = i + 1; });
    if (district.length >= 10) out.l2 = district;
    // aggregate activity
    const rows = (agg1y && agg1y.data && agg1y.data.chart && agg1y.data.chart.data || []).map((r) => [r[0], r[1] || 0, r[2] || 0]);
    if (rows.length > 380) {
      // same 7-day window one year earlier, matched by timestamp (days 365-371 before the latest day)
      const last = rows[rows.length - 1][0];
      const yr = rows.filter((r) => r[0] >= last - 371 * 86400 && r[0] <= last - 365 * 86400);
      const now7 = avg(rows.slice(-7).map((r) => r[2])) / 86400;
      const lighter = ranked.find((r) => r.key === 'lighter');
      if (yr.length >= 5) out.l2agg = { uops: Math.round(now7), uopsYearAgo: Math.round(avg(yr.map((r) => r[2])) / 86400), lighterShare: lighter ? +(lighter.uops / now7).toFixed(3) : undefined, lighterUops: lighter ? lighter.uops : undefined, nL2: elig.length };
    }
  } catch (e) { out.l2err = String(e.message || e); }

  // ---- blob shares from the most recent ~1,000 blob transactions
  try {
    const bs = await get('https://api.blobscan.com/transactions?ps=500', 10000);
    const txs = bs.transactions || [];
    if (txs.length > 100) {
      const per = new Map(); let tot = 0;
      for (const t of txs) {
        const k = t.rollup ? (BLOBSCAN_KEYS[t.rollup] || t.rollup) : (SENDERS[(t.from || '').toLowerCase()] || 'other');
        const n = (t.blobs && t.blobs.length) || 1; per.set(k, (per.get(k) || 0) + n); tot += n;
      }
      const t0 = Date.parse(txs[txs.length - 1].blockTimestamp), t1 = Date.parse(txs[0].blockTimestamp);
      const days = Math.max(0.01, (t1 - t0) / 86400000);
      out.blobWindowDays = +days.toFixed(3);
      out.blobShares = [...per.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([key, v]) => ({ key, name: key === 'other' ? 'Unlabeled' : ((out.l2 || []).find((x) => x.key === key) || {}).name || key.replace(/^./, (c) => c.toUpperCase()), perDay: Math.round(v / days), share: +(v / tot).toFixed(4) }));
      if (out.l2) for (const s of out.l2) { const v = per.get(s.key) || 0; s.blobsPerDay = Math.round(v / days); s.blobShare = +(v / tot).toFixed(4); }
    }
  } catch (e) { /* keep snapshot shares client-side */ }

  // ---- mainnet sample: last 24h, every 150th block
  try {
    const head = parseInt((await get(RPC, 5000, 'json', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }) })).result, 16);
    const nums = []; for (let n = head - 7200; n <= head; n += 150) nums.push(n);
    const batch = await get(RPC, 8000, 'json', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(nums.map((n) => ({ jsonrpc: '2.0', id: n, method: 'eth_getBlockByNumber', params: ['0x' + n.toString(16), false] }))) });
    const bl = batch.map((r) => r.result).filter(Boolean);
    if (bl.length > 20) {
      const tx = avg(bl.map((b) => b.transactions.length));
      const full = avg(bl.map((b) => parseInt(b.gasUsed, 16) / parseInt(b.gasLimit, 16)));
      const blobs = avg(bl.map((b) => parseInt(b.blobGasUsed || '0x0', 16) / 131072));
      const blobFee = avg(bl.map((b) => (parseInt(b.blobGasUsed || '0x0', 16)) * fakeExp(1, parseInt(b.excessBlobGas || '0x0', 16), 11684671) / 1e18));
      out.l1 = { txPerDay: Math.round(tx * 7200), fullness: +full.toFixed(3), blobsPerBlock: +blobs.toFixed(2), blobFees7dEth: +(blobFee * 7200 * 7).toFixed(3), gasLimit: parseInt(bl[bl.length - 1].gasLimit, 16), window: '24h' };
    }
  } catch (e) { /* keep snapshot */ }

  // ---- builders and validator payouts: the latest 200 blocks
  try {
    const head = parseInt((await get(RPC, 5000, 'json', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }) })).result, 16);
    const chunks = [0, 1, 2, 3].map((c) => { const a = []; for (let n = head - 199 + c * 50; n < head - 199 + (c + 1) * 50; n++) a.push(n); return a; });
    const res = await Promise.all(chunks.map((nums) => settle(get(RPC, 9000, 'json', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(nums.map((n) => ({ jsonrpc: '2.0', id: n, method: 'eth_getBlockByNumber', params: ['0x' + n.toString(16), false] }))) }))));
    const bl = res.filter(Array.isArray).flat().map((r) => r && r.result).filter(Boolean);
    if (bl.length >= 100) {
      const count = {};
      let skim = 0, principal = 0, principalBlocks = 0; const amts = [];
      for (const b of bl) {
        const k = builderKey(tagOf(b.extraData)); count[k] = (count[k] || 0) + 1;
        let big = 0;
        for (const w of b.withdrawals || []) { const a = parseInt(w.amount, 16) / 1e9; if (a < 1) { skim += a; amts.push(a); } else big += a; }
        if (big > 0) { principal += big; principalBlocks++; }
      }
      const ts = bl.map((b) => parseInt(b.timestamp, 16));
      amts.sort((a, b) => a - b);
      out.builders = { blocks: bl.length, minutes: Math.round((Math.max(...ts) - Math.min(...ts)) / 60), shares: Object.entries(count).sort((a, b) => b[1] - a[1]).map(([k, c]) => [k, BUILDER_NAMES[k] || k, c]) };
      out.payouts = { skimPerBlock: +(skim / bl.length).toFixed(4), skimPerDay: Math.round(skim / bl.length * 7200), perBlock: 16, principalBlocks, principalEth: +principal.toFixed(1), median: +(amts[Math.floor(amts.length / 2)] || 0).toFixed(4), blocks: bl.length };
    }
  } catch (e) { /* keep snapshot */ }

  // ---- staking queues
  try {
    const m = vqHtml && vqHtml.match(/const historical_data = (\[.*?\]);/s);
    if (m) {
      const h = JSON.parse(m[1]); const last = h[h.length - 1];
      out.staking = {
        staked: last.staked_amount, pct: last.staked_percent, validators: last.validators, apr: last.apr,
        entryQ: last.entry_queue, entryWait: last.entry_wait, exitQ: last.exit_queue, exitWait: last.exit_wait,
        churn: last.current_entry_churn || 256, hist: h.slice(-90).map((r) => [r.date.slice(5), r.entry_queue, r.exit_queue]),
      };
      if (last.supply) out.supply = { supply: last.supply };
    }
  } catch (e) { /* keep snapshot */ }

  // ---- supply, issuance, burn, price
  try {
    const d7 = gauge && gauge.d7;
    out.supply = out.supply || {};
    if (supplyParts) {
      const s = Number(BigInt(supplyParts.executionBalancesSum) / 10n ** 18n) + Number(BigInt(supplyParts.beaconBalancesSum) / 10n ** 9n) - Number(BigInt(supplyParts.beaconDepositsSum) / 10n ** 9n);
      if (s > 1e8) out.supply.supply = s;
    }
    if (d7) Object.assign(out.supply, { issuedPerDay: d7.issuance_rate_yearly.eth / 365, burnedPerDay: d7.burn_rate_yearly.eth / 365, growthPct: d7.supply_growth_rate_yearly * 100 });
    if (burnSums && burnSums.since_burn) out.supply.burnedSince1559 = Math.round(burnSums.since_burn.sum.eth);
    if (priceStats && priceStats.usd) out.price = priceStats.usd;
  } catch (e) { /* keep snapshot */ }

  // ---- stablecoins on Ethereum (USD-pegged): totals and the biggest issuers
  try {
    const assets = (stables && stables.peggedAssets) || [];
    const onEth = (a) => (((a.chainCirculating || {}).Ethereum || {}).current || {}).peggedUSD || 0;
    const all = assets.reduce((s, a) => s + (((a.circulating || {}).peggedUSD) || 0), 0);
    const eth = assets.reduce((s, a) => s + onEth(a), 0);
    if (all > 1e10 && eth > 1e9) {
      const top = assets.slice().sort((a, b) => onEth(b) - onEth(a)).slice(0, 5).map((a) => [a.symbol, a.name, Math.round(onEth(a)), a.pegMechanism || '']);
      out.stables = { eth: Math.round(eth), all: Math.round(all), share: +(eth / all).toFixed(4), top };
    }
  } catch (e) { /* keep snapshot */ }

  res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=86400');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json(out);
};

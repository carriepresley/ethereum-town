// Ethereum Town — slow-moving numbers: L2 rankings, staking queues, supply, stablecoins.
// Cached at the edge for 15 minutes.
const CANDIDATES = __CANDIDATES__; // [id, slug] pairs, busiest L2s at the last snapshot
const NAMES = { base: 'Base', 'polygon-pos': 'Polygon PoS', optimism: 'OP Mainnet', fuel: 'Fuel', zksync2: 'ZKsync Era', worldchain: 'World Chain', lyra: 'Derive', roninnetwork: 'Ronin', taiko: 'Taiko', mantapacific: 'Manta Pacific', plumenetwork: 'Plume', lasernet: 'Lasernet', immutablezkevm: 'Immutable zkEVM', metis: 'Metis', galxegravity: 'Gravity' };
const BLOBSCAN_KEYS = { base: 'base', arbitrum: 'arbitrum', world: 'worldchain', optimism: 'optimism', unichain: 'unichain', zksync: 'zksync2' };
const SENDERS = __SENDERS__;
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
  const [summary, vqHtml, gauge, burnSums, priceStats, supplyParts, stableChains, agg1y] = await Promise.all([
    settle(get('https://l2beat.com/api/scaling/summary', 9000)),
    settle(get('https://www.validatorqueue.com/', 9000, 'text')),
    settle(get('https://ultrasound.money/api/v2/fees/gauge-rates', 6000)),
    settle(get('https://ultrasound.money/api/v2/fees/burn-sums', 6000)),
    settle(get('https://ultrasound.money/api/v2/fees/eth-price-stats', 6000)),
    settle(get('https://ultrasound.money/api/v2/fees/supply-parts', 6000)),
    settle(get('https://stablecoins.llama.fi/stablecoinchains', 8000)),
    settle(get('https://l2beat.com/api/scaling/activity?range=max', 9000)),
  ]);

  // ---- L2 ranking by 7-day activity
  try {
    const projects = (summary && summary.projects) || {};
    const byTvs = Object.entries(projects)
      .filter(([, p]) => p.type === 'layer2' && !p.isArchived && p.hostChain === 'Ethereum')
      .sort((a, b) => ((b[1].tvs && b[1].tvs.breakdown && b[1].tvs.breakdown.total) || 0) - ((a[1].tvs && a[1].tvs.breakdown && a[1].tvs.breakdown.total) || 0))
      .slice(0, 14).map(([id, p]) => [id, p.slug]);
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
        blobsPerDay: 0, blobShare: 0,
      };
    }));
    const ranked = acts.filter(Boolean).sort((a, b) => b.uops - a.uops);
    if (ranked.length >= 10) out.l2 = ranked.slice(0, 14);
    // aggregate activity
    const rows = (agg1y && agg1y.data && agg1y.data.chart && agg1y.data.chart.data || []).map((r) => [r[0], r[1] || 0, r[2] || 0]);
    if (rows.length > 380) {
      // same 7-day window one year earlier, matched by timestamp (days 365-371 before the latest day)
      const last = rows[rows.length - 1][0];
      const yr = rows.filter((r) => r[0] >= last - 371 * 86400 && r[0] <= last - 365 * 86400);
      const now7 = avg(rows.slice(-7).map((r) => r[2])) / 86400;
      const lighter = ranked.find((r) => r.key === 'lighter');
      if (yr.length >= 5) out.l2agg = { uops: Math.round(now7), uopsYearAgo: Math.round(avg(yr.map((r) => r[2])) / 86400), lighterShare: lighter ? +(lighter.uops / now7).toFixed(3) : undefined, lighterUops: lighter ? lighter.uops : undefined };
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

  // ---- stablecoins
  try {
    if (Array.isArray(stableChains)) {
      const tot = stableChains.reduce((s, c) => s + ((c.totalCirculatingUSD && c.totalCirculatingUSD.peggedUSD) || 0), 0);
      const eth = stableChains.find((c) => c.name === 'Ethereum');
      if (eth && tot) out.stables = { eth: eth.totalCirculatingUSD.peggedUSD, all: tot, share: +(eth.totalCirculatingUSD.peggedUSD / tot).toFixed(3) };
    }
  } catch (e) { /* keep snapshot */ }

  res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=86400');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json(out);
};

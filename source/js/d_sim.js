
/* =====================================================================
   SIMULATION: block schedule, trains, trucks, passengers, burn, supply
   ===================================================================== */
const GAS_LIMIT = 60e6;
const GENESIS = 1606824023;
function mkBlock(b) { // replay tuple -> block
  const gasPct = b[3] / 10, baseFee = b[4] / 1e4;
  return { n: b[0], ts: b[1], tx: b[2], gasPct, baseFee, blobs: b[5], posters: b[6], slot: b[7], burn: (b[3] / 1000) * GAS_LIMIT * baseFee * 1e-9,
    builder: (D.replay.tags || [])[b[8]] || null, wd: b[9] || null };
}
/* block builders sign their blocks in extraData; the same grouping runs in /api/town */
const BUILDER_RX = [[/titan/, 'titan', 'Titan'], [/buildernet/, 'buildernet', 'BuilderNet'], [/quasar/, 'quasar', 'Quasar'], [/beaver/, 'beaver', 'beaverbuild'], [/rsync/, 'rsync', 'rsync'], [/bloxroute|blxr/, 'bloxroute', 'bloXroute'], [/btcs/, 'btcs', 'BTCS'], [/eureka/, 'eureka', 'Eureka'], [/bobthebuilder/, 'bob', 'bobTheBuilder'], [/bombora/, 'bombora', 'Bombora'], [/ultrasound/, 'ultrasound', 'Ultra Sound']];
const CLIENT_RX = /^(geth|nethermind|besu|erigon|reth)/;
function builderKey(tag) {
  const t = (tag || '').toLowerCase();
  if (!t) return 'untagged';
  if (CLIENT_RX.test(t.replace(/[^a-z0-9]/g, ''))) return 'self';
  for (const [rx, k] of BUILDER_RX) if (rx.test(t)) return k;
  return 'other';
}
function builderName(tag) {
  const k = builderKey(tag), known = BUILDER_RX.find((x) => x[1] === k);
  if (known) return known[2];
  if (k === 'self') { const m = CLIENT_RX.exec(tag.toLowerCase().replace(/[^a-z0-9]/g, '')); return 'the proposer’s own node (' + m[1][0].toUpperCase() + m[1].slice(1) + ')'; }
  return k === 'untagged' ? 'an untagged builder' : tag;
}
const REPLAY = D.replay.blocks.map(mkBlock);
const AVG_BURN = REPLAY.reduce((s, b) => s + b.burn, 0) / REPLAY.length;
const ST = {
  mode: 'replay', T: -2.6, speed: 1, paused: false, sky: 'now', hourSet: 13, stop: 0, tour: false, tourT: 0,
  cumBurn: 0, supply0: D.supply.supply, issuePerSlot: D.supply.issuedPerDay / 7200, liveK0: null, lastLiveN: 0, lastK: null,
  started: performance.now(), nightF: 0, burnLevel: 0.4, lastEpoch: null, touched: false, lowered: false,
};
const LIVE = new Map(); // slot k -> block
function blockFor(k) {
  if (ST.mode === 'live' && ST.liveK0 !== null && k >= ST.liveK0) return LIVE.get(k) || null;
  const N = REPLAY.length; return REPLAY[((k % N) + N) % N];
}
const DONE = { trucks: new Set(), wait: new Set(), board: new Set(), alight: new Set(), depart: new Set(), build: new Set(), pay: new Set() };

/* ---------- trucks & crates per block ---------- */
const SHOP_BY_KEY = () => Object.fromEntries(SHOPS.map((s) => [s.key, s]));
function planBlock(k, b) {
  if (b.plan) return b.plan;
  let posters = (b.posters || []).map((p) => [p[0], p[1]]).filter((p) => p[1] > 0);
  if (posters.length > 6) { const tail = posters.slice(5).reduce((s, p) => s + p[1], 0); posters = posters.slice(0, 5).concat([['other', tail]]); }
  const J = posters.length, F = Math.ceil(b.blobs / 3);
  let lo = Math.max(7.8, 22.75 - 2.05 * F + 0.5), hi = 20.6;
  if (J > 1 && (hi - lo) / (J - 1) < 2.15) lo = Math.max(7.6, hi - 2.15 * (J - 1));
  const spots = J === 1 ? [clamp((lo + hi) / 2, 7.8, 20.6)] : posters.map((_, j) => lo + (hi - lo) * (j / Math.max(1, J - 1)));
  // slots: eastmost truck fills slot 0 upward
  const trucks = posters.map((p, j) => ({ key: p[0], n: p[1], spotX: spots[j], j, slots: [] }));
  let s = 0;
  for (let j = J - 1; j >= 0; j--) for (let c = 0; c < trucks[j].n && s < 21; c++) trucks[j].slots.push(s++);
  const B = s, launches = [];
  let q = 0;
  for (let j = J - 1; j >= 0; j--) for (const sl of trucks[j].slots) { launches.push({ j, slot: sl, t: 3.3 + (B > 1 ? (q / (B - 1)) * 3.9 : 0) }); q++; }
  for (const t of trucks) { const last = launches.filter((l) => l.j === t.j).reduce((m, l) => Math.max(m, l.t), 3.3); t.release = last + 0.9 + t.j * 0.15; }
  b.plan = { trucks, launches, fired: new Set() };
  return b.plan;
}
function scheduleTrucks(k, b, T) {
  const plan = planBlock(k, b); const byKey = SHOP_BY_KEY();
  for (const tr of plan.trucks) {
    const id = k + ':' + b.n + ':' + tr.j; if (DONE.trucks.has(id)) continue;
    const shop = byKey[tr.key] || null;
    const { pts, holdSeg } = truckPath(shop, tr.spotX);
    const Lh = pathLen(pts, holdSeg), travel = Lh / 3.0 * 1.2 + 1.6;
    const tArrive = 12 * k + 0.9 + tr.j * 0.3;
    const tSpawn = tArrive - travel;
    if (T < tSpawn) continue;
    DONE.trucks.add(id);
    const v = spawnVehicle('truck', pts, { color: containerColor(tr.key), key: tr.key, holds: [{ seg: holdSeg, until: 12 * k + tr.release }], v0: 2.6 });
    if (!v) continue;
    v.slotK = k; v.blockN = b.n;
    tr.v = v;
    let adv = (T - tSpawn) * 3.0;
    if (adv > 0.2) { // catch up when joining late
      adv = Math.min(adv, Lh - 0.05);
      while (adv > 0 && v.seg < holdSeg) { const a = pts[v.seg + 1], d = Math.hypot(a[0] - v.x, a[1] - v.y); if (adv >= d) { v.x = a[0]; v.y = a[1]; v.seg++; adv -= d; } else { v.x += (a[0] - v.x) / d * adv; v.y += (a[1] - v.y) / d * adv; adv = 0; } }
      const a = pts[v.seg + 1]; if (a) v.hd = Math.atan2(a[1] - v.y, a[0] - v.x); v.s = 1;
    }
    if (shop) v.onDone = (vv) => { vv.st = 0; };
  }
}
function retireSlot(k, n) {
  for (const v of vehicles) if (v.slotK === k && v.blockN !== n) { v.st = 0; v.holds = []; }
  for (let i = crates.length - 1; i >= 0; i--) if (crates[i].k === k) { crateMesh.setMatrixAt(crates[i].i, ZERO_M); cFree.push(crates[i].i); crates.splice(i, 1); }
  crateMesh.instanceMatrix.needsUpdate = true;
}
function fireCrates(k, b, T, train) {
  const plan = planBlock(k, b);
  for (const L of plan.launches) {
    if (plan.fired.has(L.slot) || T < 12 * k + L.t) continue;
    plan.fired.add(L.slot);
    const tr = plan.trucks[L.j]; const v = tr.v;
    const from = v && !v.done ? [v.x, 0.85, v.y] : [tr.spotX, 0.85, YARD.lane];
    const i = cFree.pop(); if (i === undefined) { if (train) train.loaded[L.slot] = true; continue; }
    _c.set(containerColor(tr.key)); crateMesh.setColorAt(i, _c); crateMesh.instanceColor.needsUpdate = true;
    crates.push({ i, from, slot: L.slot, t0: 12 * k + L.t, dur: 0.9, k, spin: R(-1, 1) });
  }
}
function updateCrates(T) {
  for (let n = crates.length - 1; n >= 0; n--) {
    const c = crates[n]; const u = (T - c.t0) / c.dur;
    const tr = TRAINS.find((t) => t.k === c.k);
    const tx = STOP_X + slotX(c.slot), ty = RAIL_Y, tz = 0.12 + 0.36 + 0.31;
    if (u >= 1) {
      if (tr) tr.loaded[c.slot] = true;
      crateMesh.setMatrixAt(c.i, ZERO_M); cFree.push(c.i); crates.splice(n, 1); continue;
    }
    const e = smooth(u);
    _v.set(lerp(c.from[0], tx, e), lerp(c.from[1], tz, u) + Math.sin(Math.PI * u) * 1.7, lerp(c.from[2], ty, e));
    _e.set(0, c.spin * u * 1.4, 0); _q.setFromEuler(_e); _s.setScalar(1);
    _m4.compose(_v, _q, _s); crateMesh.setMatrixAt(c.i, _m4);
  }
  crateMesh.instanceMatrix.needsUpdate = true;
}

/* ---------- platform passengers ---------- */
const DOORS = [24.2, 25.9, 30.1, 31.8];
const WAITING = new Map();
function coachDoors() { const out = []; for (let i = 0; i < COACHES; i++) { const x1 = STOP_X - (LEN.loco + LEN.gap + i * (LEN.car + LEN.gap)); out.push(x1 - 0.4, x1 - 1.6); } return out; }
function platformWait(k, b) {
  const n = clamp(Math.round(b.tx / 30), 3, 20), list = [];
  for (let i = 0; i < n; i++) {
    const d = pick(DOORS); const p = spawnPerson(d + R(-0.2, 0.2), 23.9, 0.32);
    if (!p) continue; p.z = 0.32;
    walkTo(p, [[clamp(d + R(-3.2, 3.2), 23.0, 33.9), R(24.05, 24.5), 0.32]]);
    list.push(p);
  }
  WAITING.set(k, list);
}
function platformBoard(k) {
  const list = WAITING.get(k) || []; const doors = coachDoors();
  for (const p of list) { const dx = doors.reduce((a, b) => (Math.abs(b - p.x) < Math.abs(a - p.x) ? b : a)); walkTo(p, [[dx, 24.64, 0.32]], kill); }
  WAITING.delete(k);
}
function platformAlight(b) {
  const n = clamp(Math.round(b.tx / 45), 2, 12), doors = coachDoors();
  for (let i = 0; i < n; i++) {
    const dx = pick(doors); const p = spawnPerson(dx, 24.62, 0.32); if (!p) continue;
    const d = pick(DOORS); walkTo(p, [[dx + R(-0.3, 0.3), 24.3, 0.32], [d + R(-0.15, 0.15), 23.92, 0.32]], kill);
  }
}

/* ---------- couriers for off-Ethereum data ---------- */
function updateCouriers(dt) {
  for (const s of SHOPS) {
    if (s.da === 'blobs') continue;
    s.courierT = (s.courierT ?? R(4, 30)) - dt;
    if (s.courierT > 0) continue;
    s.courierT = R(38, 70);
    const out = laneOffset(s.row === 1 ? [[s.pickup.x, 17.9], [s.pickup.x, 19.5], [28.6, 19.5]] : [[s.pickup.x, 10.9], [s.pickup.x, 12.5], [nearestAvenue(s.pickup.x), 12.5], [nearestAvenue(s.pickup.x), 19.5], [28.6, 19.5]], 0.5);
    const last = out[out.length - 1];
    const pts = out.concat([[last[0], 20.35]]);
    spawnVehicle('courier', pts, { color: s.brand.id, vmax: 3.3, onDone: (v) => { v.st = 0; } });
  }
}

/* ---------- per-frame orchestration ---------- */
let boardBlock = null;
function simTick(dt, T) {
  const kNow = Math.floor(T / 12);
  // train pool
  const active = [];
  for (let k = kNow - 1; k <= kNow + 1; k++) { const b = blockFor(k); if (!b) continue; const t = T - 12 * k; if (t > -3.2 && t < 16) active.push({ k, b, t }); }
  for (const tr of TRAINS) if (!active.some((a) => a.k === tr.k)) { tr.k = null; tr.g.visible = false; }
  for (const a of active) {
    let tr = TRAINS.find((x) => x.k === a.k);
    if (!tr) { tr = TRAINS.find((x) => x.k === null); if (!tr) continue; tr.k = a.k; tr.block = null; }
    if (tr.block !== a.b) { tr.block = a.b; tr.loaded = new Array(21).fill(false); tr.nb = Math.min(21, a.b.blobs); if (a.t > 8.5) tr.loaded.fill(true); }
    const front = trainFront(a.t);
    tr.g.position.set(front, 0.12, RAIL_Y); tr.g.visible = front > 3.4 && front - trainLength(tr.nb) < 48.6;
    tr.front = front; tr.t = a.t;
    const F = Math.ceil(tr.nb / 3);
    tr.flats.forEach((f, j) => { f.visible = j < F; });
    const plan = a.b.plan;
    for (let s = 0; s < 21; s++) {
      if (s < tr.nb && (tr.loaded[s] || a.t > 9.2 || (!plan && a.t > 3))) {
        let key = 'other';
        if (plan) { const tk = plan.trucks.find((x) => x.slots.includes(s)); if (tk) key = tk.key; }
        _c.set(containerColor(key)); tr.boxes.setColorAt(s, _c);
        _v.set(slotX(s), 0.42 + 0.25, 0); _q.identity(); _s.setScalar(1); _m4.compose(_v, _q, _s); tr.boxes.setMatrixAt(s, _m4);
      } else tr.boxes.setMatrixAt(s, ZERO_M);
    }
    tr.boxes.instanceMatrix.needsUpdate = true; if (tr.boxes.instanceColor) tr.boxes.instanceColor.needsUpdate = true;
    const load = clamp(a.b.tx / 420, 0.12, 1);
    tr.coachWin.forEach((m, i) => { m.emissiveIntensity = (0.06 + ST.nightF * 0.95) * clamp(load * 1.25 - i * 0.12, 0.12, 1); });
    tr.light.intensity = ST.nightF * 38;
  }
  // gates
  gatesClosed = TRAINS.some((tr) => tr.k !== null && tr.t >= 7.4 && tr.front - trainLength(tr.nb) < 40.2 && tr.front > 30);
  // per-slot events
  for (let k = kNow - 1; k <= kNow + 2; k++) {
    const b = blockFor(k); if (!b) continue;
    if (T >= 12 * k - 16) scheduleTrucks(k, b, T);
    if (T >= 12 * k - 7 && !DONE.wait.has(k)) { DONE.wait.add(k); platformWait(k, b); }
    if (T >= 12 * k + 3.3 && !DONE.board.has(k)) { DONE.board.add(k); platformBoard(k); }
    if (T >= 12 * k + 3.5 && !DONE.alight.has(k)) { DONE.alight.add(k); platformAlight(b); }
    const tr = TRAINS.find((x) => x.k === k);
    if (T >= 12 * k + 3.2 && T < 12 * k + 9) fireCrates(k, b, T, tr);
    if (T >= 12 * k + 9 && !DONE.depart.has(k)) { DONE.depart.add(k); onDepart(k, b); }
    const real = ST.mode !== 'live' || b.live;
    if (T >= 12 * k + 1.4 && !DONE.build.has(k)) { DONE.build.add(k); if (real && T < 12 * k + 6) handoff(b); }
    if (T >= 12 * k + 3.6 && !DONE.pay.has(k)) { DONE.pay.add(k); if (real && T < 12 * k + 10) payout(b); }
  }
  updateCrates(T);
  const cur = blockFor(kNow) || blockFor(kNow - 1);
  if (cur && cur !== boardBlock && T - 12 * kNow > -3 && (ST.mode !== 'live' || cur.live)) { boardBlock = cur; updateBoard(cur); }
  // tidy memory
  if (DONE.depart.size > 400) for (const s of Object.values(DONE)) { for (const v of s) { const kk = typeof v === 'number' ? v : parseInt(v); if (kk < kNow - 5) s.delete(v); } }
}
function onDepart(k, b) {
  for (let i = 0; i < 14; i++) smoke.emit(42.2 + R(-0.2, 0.2), 6.7, 22 + R(-0.2, 0.2), R(-0.1, 0.25), R(0.9, 1.5), R(-0.15, 0.15), R(5, 8), 0.5, 2.4, 0.45, '#8f8b86', '#b8b5b0', 0.25);
  if (ST.mode === 'live' && !b.live) return; // a replay train still finishing its run after going live: no numbers
  ST.cumBurn += b.burn;
  ST.burnLevel = clamp(ST.burnLevel + b.burn / Math.max(1e-4, AVG_BURN) * 0.45, 0, 3.5);
  toast([37.5, 2.6, RAIL_Y], `Block ${fmt(b.n)} departs · ${fmt(b.tx)} txns`, 'blk');
  if (b.burn > 0) toast([42.0, 7.4, 21.6], `−${b.burn < 0.01 ? b.burn.toFixed(4) : b.burn.toFixed(3)} ETH burned`, 'burn');
  const ep = Math.floor(b.slot / 32);
  if (ST.lastEpoch !== null && ep !== ST.lastEpoch) epochPayout(ep); // first block of a new epoch (also when its first slot was missed)
  ST.lastEpoch = ep;
}
function epochPayout(ep) { // rewards are credited to validator balances at each epoch boundary; the vault glows
  toast([44, 5.4, 14], `Epoch ${fmt(ep)} · attestation rewards credited`, 'gold');
  ST.vaultGlow = 1;
}
/* ---------- the builder of each block hands it to the train ---------- */
const HANDOFFS = [];
const _hw = new THREE.Vector3();
function handoff(b) {
  const w = workshopFor(b.builder); if (!w) return;
  w.flash = 1;
  const p0 = new THREE.Vector3(w.cx, w.h + 0.6, (w.y0 + w.y1) / 2), p2 = new THREE.Vector3(STOP_X - 4.5, 1.35, RAIL_Y);
  HANDOFFS.push({ curve: new THREE.QuadraticBezierCurve3(p0, new THREE.Vector3((p0.x + p2.x) / 2, 4.6, (p0.z + p2.z) / 2), p2), u: 0 });
  const sel = STOPS[ST.stop] && STOPS[ST.stop].type;
  if (sel === 'builders' || sel === 'station') toast([w.cx, w.h + 1.35, (w.y0 + w.y1) / 2], `Block ${fmt(b.n)} built by ${builderName(b.builder)}`, 'blk');
}
function updateHandoffs(dt) {
  for (const w of WORKSHOPS) { w.flash = Math.max(0, w.flash - dt * 0.45); w.beacon.emissiveIntensity = 0.15 + w.flash * 3.2 + ST.nightF * 0.4; }
  for (let i = HANDOFFS.length - 1; i >= 0; i--) {
    const h = HANDOFFS[i]; h.u += dt * 0.85;
    if (h.u >= 1) { HANDOFFS.splice(i, 1); continue; }
    for (let j = 0; j < 2; j++) { h.curve.getPointAt(clamp(h.u - j * 0.02, 0, 1), _hw); sparkles.emit(_hw.x, _hw.y, _hw.z, 0, 0.02, 0, 0.5, 0.2, 0.05, 0.95, '#f2f6ff', '#7f9bff', 0.2); }
  }
}
/* ---------- staking payouts: every block pays 16 validators their accumulated rewards (the withdrawal sweep).
   Gold sparks fly from the vault to the homes on the hill, which stand in for everyone who stakes. ---------- */
const REWARDS = [];
const _rw = new THREE.Vector3();
function payout(b) {
  const wd = b.wd || [16, 0, 0], n = wd[0] || 0;
  for (let i = 0; i < n; i++) sendReward(-(i / Math.max(1, n)) * 4.4);
  const sel = STOPS[ST.stop] && STOPS[ST.stop].type;
  if (sel === 'vault' && n) toast([44, 4.7, 13.4], `Block ${fmt(b.n)} paid ${n} validators ${wd[1] >= 0.01 ? wd[1].toFixed(2) : wd[1].toFixed(3)} ETH`, 'gold');
  if (wd[2] > 0) { // a withdrawal of 1 ETH or more, usually stake leaving: someone walks out of the OUT door
    const p = spawnPerson(46.1, 14.95, 0.35, { color: '#d9b25a' });
    if (p) walkTo(p, [[46.1, 15.62, 0.35], [46.1, 15.93, 0.24], [46.1, 16.2, 0.13], [46.4, 16.45, 0], [49.05, 16.5, 0], [49.45, 18.1, 0], [51.8, 18.15, 0]], kill);
    if (sel === 'vault') toast([46.1, 3.2, 15.6], `${wd[2] >= 10 ? Math.round(wd[2]) : wd[2].toFixed(1)} ETH withdrawn`, '');
  }
}
function rewardArc() {
  const east = rand() < 0.25; // a few head for the homes on the east edge
  const p0 = new THREE.Vector3(R(41.5, 46.5), 4.25, R(12.7, 14.3));
  const p2 = east ? new THREE.Vector3(R(49.6, 51.2), 1.35, R(8.6, 12.8)) : new THREE.Vector3(R(40.8, 50.4), 1.45, R(1.0, 2.9));
  return new THREE.QuadraticBezierCurve3(p0, new THREE.Vector3((p0.x + p2.x) / 2, 7.2, (p0.z + p2.z) / 2), p2);
}
function sendReward(u0 = 0) {
  if (REWARDS.length > 60) return;
  REWARDS.push({ curve: rewardArc(), u: u0, speed: R(0.34, 0.5) });
}
function updateRewards(dt) {
  if (dt <= 0) return;
  for (let i = REWARDS.length - 1; i >= 0; i--) {
    const r = REWARDS[i]; r.u += dt * r.speed;
    if (r.u >= 1) { REWARDS.splice(i, 1); continue; }
    if (r.u < 0) continue;
    r.curve.getPointAt(r.u, _rw);
    sparkles.emit(_rw.x, _rw.y, _rw.z, 0, 0.03, 0, 0.42, 0.17, 0.05, 0.95, '#ffe49a', '#ffb83d', 0.2);
  }
}
function updateFx(dt, T) {
  ST.burnLevel = Math.max(0.25, ST.burnLevel - dt * 0.18);
  const rate = 3 + ST.burnLevel * 6;
  if (rand() < dt * rate) smoke.emit(42.2 + R(-0.15, 0.15), 6.65, 22 + R(-0.15, 0.15), R(-0.05, 0.2), R(0.55, 0.9), R(-0.1, 0.1), R(5, 9), 0.35, 1.9, 0.32, '#8f8b86', '#c4c1bc', 0.2);
  if (rand() < dt * (8 + ST.burnLevel * 16)) flames.emit(42.2 + R(-0.18, 0.18), 6.62, 22 + R(-0.18, 0.18), R(-0.1, 0.1), R(0.8, 1.6) * (0.6 + ST.burnLevel * 0.3), R(-0.1, 0.1), R(0.35, 0.7), 0.32 + ST.burnLevel * 0.08, 0.05, 0.9, '#ffe58a', '#ff4a12', 0.8);
  furnaceMouth.emissiveIntensity = 0.9 + ST.burnLevel * 0.9 + Math.sin(T * 7) * 0.15;
  furnaceLight.intensity = (3 + ST.burnLevel * 4) * (0.3 + ST.nightF * 0.8);
  updateRewards(dt);
  updateHandoffs(dt);
  if (mintCoin) mintCoin.rotation.y += dt * 0.9;
  ST.vaultGlow = Math.max(0, (ST.vaultGlow || 0) - dt * 0.35);
  if (vaultDoors) vaultDoors.emissiveIntensity += ST.vaultGlow * 1.6;
  smoke.update(dt); flames.update(dt); sparkles.update(dt);
  if (clockHand) clockHand.rotation.z = -((((T % 12) + 12) % 12) / 12) * Math.PI * 2;
  if (ethGem) { ethGem.rotation.y += dt * 0.6; ethGem.position.y = 7.35 + Math.sin(T * 0.8) * 0.12; }
  for (const g of GATES) {
    const target = gatesClosed ? 0 : Math.PI / 2 - 0.05;
    g.angle += clamp(target - g.angle, -dt * 1.8, dt * 1.8);
    g.g.rotation.z = g.dir * g.angle;
    g.light.material.emissiveIntensity = gatesClosed ? (Math.sin(T * 9) > 0 ? 3 : 0.2) : 0;
  }
}
const furnaceLight = new THREE.PointLight('#ff7a2a', 4, 9, 1.4);
furnaceLight.position.set(42.2, 7.3, 22.4); scene.add(furnaceLight);

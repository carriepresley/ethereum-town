
/* =====================================================================
   ACTORS: people, vehicles, trains, crates, particles
   ===================================================================== */
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const ZERO_M = new THREE.Matrix4().makeScale(0, 0, 0);

/* ---------------- people ---------------- */
const MAXP = 1400;
const pBodyGeo = new THREE.CapsuleGeometry(0.078, 0.2, 2, 7); pBodyGeo.translate(0, 0.178, 0);
const pHeadGeo = new THREE.SphereGeometry(0.068, 8, 6); pHeadGeo.translate(0, 0.418, 0);
const pBody = new THREE.InstancedMesh(pBodyGeo, new THREE.MeshStandardMaterial({ roughness: 0.85 }), MAXP);
const pHead = new THREE.InstancedMesh(pHeadGeo, new THREE.MeshStandardMaterial({ roughness: 0.7 }), MAXP);
for (const m of [pBody, pHead]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.castShadow = !LOW; m.frustumCulled = false; scene.add(m); }
const CLOTHES = ['#e4572e', '#2e4a7d', '#f3a712', '#6a994e', '#4d7ea8', '#e8e3db', '#8d5a97', '#2e86ab', '#d1495b', '#3a3f4b', '#f6ae2d', '#7b8cde', '#c97b63', '#1f7a6d', '#b8b8c0', '#ef8a62'];
const SKIN = ['#f1c9a5', '#e0ac85', '#c68863', '#9b6a47', '#6b4630', '#f5d6bc'];
const people = [];
const pFree = []; for (let i = MAXP - 1; i >= 0; i--) { pFree.push(i); pBody.setMatrixAt(i, ZERO_M); pHead.setMatrixAt(i, ZERO_M); }
function spawnPerson(x, y, z = 0, opts = {}) {
  const i = pFree.pop(); if (i === undefined) return null;
  const p = { i, x, y, z, path: [], speed: opts.speed || R(0.72, 1.02), s: opts.instant ? 1 : 0, st: 1, ph: R(0, 6.28), hd: R(0, 6.28), cb: null, dying: false, walk: false, idle: R(0, 10), tag: opts.tag };
  _c.set(opts.color || pick(CLOTHES)); pBody.setColorAt(i, _c);
  _c.set(pick(SKIN)); pHead.setColorAt(i, _c);
  pBody.instanceColor.needsUpdate = true; pHead.instanceColor.needsUpdate = true;
  people.push(p);
  return p;
}
function walkTo(p, pts, cb) { p.path = pts.map((q) => [q[0], q[1], q[2] ?? p.z]); p.cb = cb || null; }
function kill(p) { p.dying = true; p.st = 0; p.path = []; }
function updatePeople(dt) {
  let dirty = false;
  for (let n = people.length - 1; n >= 0; n--) {
    const p = people[n];
    if (p.path.length) {
      const t = p.path[0];
      const dx = t[0] - p.x, dy = t[1] - p.y, dz = t[2] - p.z, d = Math.hypot(dx, dy);
      const step = p.speed * dt;
      if (d <= step || d < 1e-4) { p.x = t[0]; p.y = t[1]; p.z = t[2]; p.path.shift(); if (!p.path.length && p.cb) { const cb = p.cb; p.cb = null; cb(p); } }
      else { p.x += dx / d * step; p.y += dy / d * step; p.z += dz * Math.min(1, step / d); p.hd = Math.atan2(dx, dy); }
      p.walk = true; p.ph += dt * 10 * p.speed;
    } else { p.walk = false; p.idle += dt; }
    p.s += (p.st - p.s) * Math.min(1, dt * 7);
    if (p.dying && p.s < 0.04) {
      pBody.setMatrixAt(p.i, ZERO_M); pHead.setMatrixAt(p.i, ZERO_M); pFree.push(p.i); people.splice(n, 1); dirty = true; continue;
    }
    const bob = p.walk ? Math.abs(Math.sin(p.ph)) * 0.035 : Math.max(0, Math.sin(p.idle * 1.7 + p.i)) * 0.006;
    _e.set(p.walk ? 0.1 : 0, p.hd, p.walk ? Math.sin(p.ph) * 0.07 : Math.sin(p.idle * 0.9 + p.i) * 0.03);
    _q.setFromEuler(_e); _v.set(p.x, p.z + bob, p.y); _s.setScalar(p.s);
    _m4.compose(_v, _q, _s);
    pBody.setMatrixAt(p.i, _m4); pHead.setMatrixAt(p.i, _m4);
    dirty = true;
  }
  if (dirty) { pBody.instanceMatrix.needsUpdate = true; pHead.instanceMatrix.needsUpdate = true; }
}

/* ---------------- shop crowds ---------------- */
const CROWDS = [];
function crowdFor(shop) {
  const u = Math.max(0.5, shop.uops);
  const Q = clamp(Math.round(1.5 + 0.26 * Math.sqrt(u)), 2, 12);
  const rate = 0.07 * Math.sqrt(u);
  const dir = shop.row === 1 ? 1 : 1;
  const walkY = shop.door.y + 0.86, qY = shop.door.y + 0.46;
  const c = { shop, Q, rate, walkY, qY, queue: [], tA: R(0, 1 / rate), tS: R(0, 1 / rate), tE: R(0, 1 / rate), rx: 0.45 + 0.12 * Q, dir };
  CROWDS.push(c);
  // pre-populate queue and walkers
  for (let i = 0; i < Q; i++) { const s = crowdSpot(c); const p = spawnPerson(s[0], s[1], 0, { instant: true }); if (p) { p.hd = Math.PI; c.queue.push(p); } }
  const inflight = Math.round(rate * 7);
  for (let i = 0; i < inflight; i++) arrive(c, R(0.1, 0.9));
  for (let i = 0; i < inflight; i++) exitWalker(c, R(0.1, 0.9));
  return c;
}
function crowdSpot(c) {
  const d = c.shop.door;
  for (let t = 0; t < 8; t++) {
    const a = R(-1, 1), b = R(0, 1);
    const x = d.x + a * c.rx, y = d.y + 0.2 + b * 0.5;
    if (!c.queue.some((p) => Math.hypot(p.x - x, p.y - y) < 0.2)) return [x, y];
  }
  return [d.x + R(-c.rx, c.rx), d.y + R(0.2, 0.7)];
}
function arrive(c, pre = 0) {
  const d = c.shop.door, side = rand() < 0.5 ? -1 : 1, far = R(3.5, 9);
  const sx = clamp(d.x + side * far, 0.4, WX - 0.4);
  const p = spawnPerson(sx, c.walkY + R(-0.06, 0.06), 0, { instant: pre > 0 });
  if (!p) return;
  if (pre) p.x = lerp(sx, d.x, pre);
  const spot = crowdSpot(c);
  walkTo(p, [[spot[0] + side * 0.3, c.walkY], spot], (pp) => { pp.hd = Math.PI; c.queue.push(pp); });
}
function exitWalker(c, pre = 0) {
  const d = c.shop.door, side = rand() < 0.5 ? -1 : 1, far = R(3.5, 9);
  const tx = clamp(d.x + side * far, 0.4, WX - 0.4);
  const p = spawnPerson(d.x + R(-0.15, 0.15), d.y + 0.08, 0, { instant: pre > 0 });
  if (!p) return;
  if (pre) { p.x = lerp(d.x, tx, pre); p.y = c.walkY; walkTo(p, [[tx, c.walkY]], kill); }
  else walkTo(p, [[d.x + side * 0.25, c.walkY], [tx, c.walkY + R(-0.06, 0.06)]], kill);
}
function updateCrowds(dt) {
  for (const c of CROWDS) {
    c.tA -= dt; c.tS -= dt; c.tE -= dt;
    if (c.tA <= 0) { c.tA += (1 / c.rate) * R(0.5, 1.5); if (c.queue.length < c.Q + 4) arrive(c); }
    if (c.tS <= 0) {
      c.tS += (1 / c.rate) * R(0.6, 1.4) * (c.queue.length > c.Q ? 0.6 : 1);
      if (c.queue.length) {
        let bi = 0, bd = 1e9; const d = c.shop.door;
        c.queue.forEach((p, i) => { const dd = Math.hypot(p.x - d.x, p.y - d.y); if (dd < bd && !p.path.length) { bd = dd; bi = i; } });
        const p = c.queue.splice(bi, 1)[0];
        walkTo(p, [[d.x + R(-0.12, 0.12), d.y + 0.05]], kill);
      }
    }
    if (c.tE <= 0) { c.tE += (1 / c.rate) * R(0.5, 1.5); exitWalker(c); }
    // shuffle
    if (c.queue.length && rand() < dt * 0.6) { const p = pick(c.queue); if (!p.path.length) { const s = crowdSpot(c); walkTo(p, [s], (pp) => { pp.hd = Math.PI; }); } }
  }
}

/* ---------------- vault queues (each figure ≈ 20,000 ETH) ----------------
   Entry: a serpentine line at the IN door. Its length is the real queue; the front walks inside and
   newcomers join the back at an illustrative pace. Exit: figures come out of the OUT door, wait in a
   short row and walk off to the street. Lines ease toward new queue sizes when the data refreshes. */
const VAULTQ = { entry: [], exit: [], nIn: 0, nOut: 0, tIn: 2.5, tOut: 4.5 };
const VQ_ROWS = [16.43, 16.71, 16.99, 17.27];
const VQ_COLORS = ['#2e4a7d', '#3a3f4b', '#1f7a6d', '#8d5a97', '#c97b63', '#4d7ea8', '#e8e3db'];
function entrySlot(i) { const r = Math.min(3, Math.floor(i / 24)), k = i - r * 24; return [r % 2 === 0 ? 40.35 + k * 0.245 : 46.05 - k * 0.245, VQ_ROWS[r], r % 2 === 0 ? -Math.PI / 2 : Math.PI / 2]; }
function exitSlot(k) { return [46.65 + k * 0.24, 16.7, Math.PI / 2]; }
function toSlot(p, s) { walkTo(p, [[s[0], s[1], 0]], (pp) => { pp.hd = s[2]; }); }
function setVaultQueueTargets(entryEth, exitEth) {
  VAULTQ.nIn = clamp(Math.round(entryEth / 20000), 0, 96);
  VAULTQ.nOut = clamp(Math.round(exitEth / 20000), 0, 9);
}
function buildVaultQueues(entryEth, exitEth) {
  for (const p of VAULTQ.entry.concat(VAULTQ.exit)) kill(p);
  VAULTQ.entry = []; VAULTQ.exit = [];
  setVaultQueueTargets(entryEth, exitEth);
  for (let i = 0; i < VAULTQ.nIn; i++) { const s = entrySlot(i); const p = spawnPerson(s[0], s[1], 0, { instant: true, color: pick(VQ_COLORS) }); if (p) { p.hd = s[2]; VAULTQ.entry.push(p); } }
  for (let k = 0; k < VAULTQ.nOut; k++) { const s = exitSlot(k); const p = spawnPerson(s[0], s[1], 0, { instant: true }); if (p) { p.hd = s[2]; VAULTQ.exit.push(p); } }
}
function updateVaultQueues(dt) {
  if (dt <= 0) return;
  VAULTQ.tIn -= dt; VAULTQ.tOut -= dt;
  if (VAULTQ.tIn <= 0) {
    VAULTQ.tIn = R(3.6, 5.2);
    const q = VAULTQ.entry;
    if (q.length && q.length >= VAULTQ.nIn) {
      // the front of the line climbs the steps and goes in through the IN door
      walkTo(q.shift(), [[40.7, 16.2, 0.13], [41.0, 15.93, 0.24], [41.3, 15.62, 0.35], [41.95, 15.62, 0.35], [41.95, 14.92, 0.35]], kill);
      q.forEach((pp, i) => toSlot(pp, entrySlot(i)));
    }
    if (q.length < VAULTQ.nIn) { // a newcomer joins the back
      const s = entrySlot(q.length);
      const p = spawnPerson(R(39.6, 40.4), R(18.05, 18.3), 0, { color: pick(VQ_COLORS) });
      if (p) { walkTo(p, [[s[0] - 0.15, 17.74, 0], [s[0], s[1], 0]], (pp) => { pp.hd = s[2]; }); q.push(p); }
    }
  }
  if (VAULTQ.tOut <= 0) {
    VAULTQ.tOut = R(6, 9);
    const q = VAULTQ.exit;
    // the front of the exit row (east end) leaves for the street
    if (q.length && q.length >= VAULTQ.nOut) walkTo(q.pop(), [[49.05, 16.72, 0], [49.45, 18.1, 0], [51.8, 18.15, 0]], kill);
    if (q.length < VAULTQ.nOut) { // someone comes out of the OUT door and joins the row
      q.forEach((pp, k) => toSlot(pp, exitSlot(k + 1)));
      const p = spawnPerson(46.1, 14.95, 0.35);
      if (p) { walkTo(p, [[46.1, 15.62, 0.35], [46.1, 15.93, 0.24], [46.1, 16.2, 0.13], [46.35, 16.45, 0], [46.65, 16.7, 0]], (pp) => { pp.hd = Math.PI / 2; }); q.unshift(p); }
    }
  }
}

/* ---------------- ambient strollers ---------------- */
const STROLL = [
  { y: 20.86, a: 0.4, b: WX - 0.4, w: 3 }, { y: 14.05, a: 0.4, b: 36.4, w: 2 }, { y: 7.0, a: 0.4, b: WX - 0.4, w: 2 },
  { y: 30.15, a: 0.4, b: WX - 0.4, w: 2 }, { y: 11.05, a: 0.4, b: 12.1, w: 0.6 },
];
let strollCount = 0;
function stroller(pre) {
  const tot = STROLL.reduce((s, r) => s + r.w, 0); let q = rand() * tot, r = STROLL[0];
  for (const s of STROLL) { q -= s.w; if (q <= 0) { r = s; break; } }
  const fwd = rand() < 0.5, x0 = fwd ? r.a : r.b, x1 = fwd ? r.b : r.a;
  const p = spawnPerson(pre ? lerp(x0, x1, rand()) : x0, r.y + R(-0.15, 0.15), 0, { instant: !!pre, speed: R(0.55, 0.85) });
  if (!p) return; strollCount++;
  walkTo(p, [[x1, p.y]], (pp) => { kill(pp); strollCount--; });
}

/* ---------------- vehicles ---------------- */
const MAXV = 90;
const ACTOR_MESHES = [pBody, pHead]; // people and vehicles: their shadows are the first thing to go on slow devices
function vMesh(geo, mat, cast = true) { const m = new THREE.InstancedMesh(geo, mat, MAXV); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.castShadow = cast && !LOW; m.frustumCulled = false; for (let i = 0; i < MAXV; i++) m.setMatrixAt(i, ZERO_M); scene.add(m); ACTOR_MESHES.push(m); return m; }
const gCarBody = new THREE.BoxGeometry(1.0, 0.28, 0.5); gCarBody.translate(0, 0.25, 0);
const gCarTop = new THREE.BoxGeometry(0.56, 0.22, 0.46); gCarTop.translate(-0.06, 0.5, 0);
const gCab = new THREE.BoxGeometry(0.46, 0.58, 0.64); gCab.translate(0.64, 0.41, 0);
const gCargo = new THREE.BoxGeometry(1.34, 0.74, 0.7); gCargo.translate(-0.28, 0.52, 0);
const gChassis = new THREE.BoxGeometry(1.0, 0.14, 0.46); gChassis.translate(0, 0.1, 0);
const gScooter = new THREE.BoxGeometry(0.46, 0.2, 0.18); gScooter.translate(0, 0.2, 0);
const gRider = new THREE.CapsuleGeometry(0.075, 0.16, 2, 6); gRider.translate(-0.05, 0.47, 0);
const gLamp = new THREE.BoxGeometry(0.03, 0.06, 0.34); gLamp.translate(0, 0.28, 0);
const mBody = vMesh(gCarBody, new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.25 }));
const mTop = vMesh(gCarTop, new THREE.MeshStandardMaterial({ color: '#2b3446', roughness: 0.2, metalness: 0.5 }));
const mCab = vMesh(gCab, new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.2 }));
const mCargo = vMesh(gCargo, new THREE.MeshStandardMaterial({ roughness: 0.6 }));
const mChassis = vMesh(gChassis, new THREE.MeshStandardMaterial({ color: '#23262d', roughness: 0.8 }));
const mScooter = vMesh(gScooter, new THREE.MeshStandardMaterial({ roughness: 0.5 }));
const mRider = vMesh(gRider, new THREE.MeshStandardMaterial({ color: '#2c3140', roughness: 0.8 }));
const HEAD_MAT = nightMat(new THREE.MeshStandardMaterial({ color: '#fff6de', emissive: '#fff1c8', emissiveIntensity: 0.2 }), 0.2, 2.2);
const TAIL_MAT = nightMat(new THREE.MeshStandardMaterial({ color: '#7a1010', emissive: '#ff2020', emissiveIntensity: 0.3 }), 0.3, 1.6);
const mHead = vMesh(gLamp, HEAD_MAT, false), mTail = vMesh(gLamp, TAIL_MAT, false);
// headlight pools on the road
const beamTex = (() => { const c = textCanvas(128, 128), g = c.getContext('2d'); const gr = g.createRadialGradient(20, 64, 4, 40, 64, 100); gr.addColorStop(0, 'rgba(255,238,200,0.55)'); gr.addColorStop(1, 'rgba(255,238,200,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(8, 64); g.lineTo(128, 10); g.lineTo(128, 118); g.closePath(); g.fill(); const t = new THREE.CanvasTexture(c); return t; })();
const BEAM_MAT = new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
const gBeam = new THREE.PlaneGeometry(2.0, 1.1); gBeam.rotateX(-Math.PI / 2); gBeam.translate(1.35, 0.075, 0);
const mBeam = vMesh(gBeam, BEAM_MAT, false);
const CAR_COLORS = ['#c9372c', '#2f5d9e', '#e9e5dc', '#2c2f36', '#8a9aa8', '#d9a03f', '#3f7d5b', '#6b4d8f', '#b8bec7', '#1d4f73', '#d06a3a'];
const vehicles = [];
const vFree = []; for (let i = MAXV - 1; i >= 0; i--) vFree.push(i);
function spawnVehicle(kind, pts, opts = {}) {
  const i = vFree.pop(); if (i === undefined) return null;
  const v = { i, kind, pts, seg: 0, x: pts[0][0], y: pts[0][1], hd: 0, v: opts.v0 ?? 0, vmax: opts.vmax || (kind === 'truck' ? 3.0 : kind === 'courier' ? 3.2 : R(3.1, 3.9)), len: kind === 'truck' ? 1.9 : kind === 'courier' ? 0.6 : 1.1, s: opts.instant ? 1 : 0, st: 1, holds: opts.holds || [], onDone: opts.onDone, key: opts.key, lane: '' };
  const d0 = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]]; v.hd = Math.atan2(d0[1], d0[0]);
  if (kind === 'car') { _c.set(opts.color || pick(CAR_COLORS)); mBody.setColorAt(i, _c); mBody.instanceColor.needsUpdate = true; }
  if (kind === 'truck') { _c.set('#eef0f3'); mCab.setColorAt(i, _c); _c.set(opts.color || '#c7ad86'); mCargo.setColorAt(i, _c); mCab.instanceColor.needsUpdate = true; mCargo.instanceColor.needsUpdate = true; }
  if (kind === 'courier') { _c.set(opts.color || '#f28c28'); mScooter.setColorAt(i, _c); mScooter.instanceColor.needsUpdate = true; }
  vehicles.push(v); return v;
}
function laneKey(v) {
  const a = v.pts[v.seg], b = v.pts[v.seg + 1]; if (!b) return '';
  if (Math.abs(a[1] - b[1]) < 0.01) return 'x' + (b[0] > a[0] ? '+' : '-') + a[1].toFixed(1);
  if (Math.abs(a[0] - b[0]) < 0.01) return 'y' + (b[1] > a[1] ? '+' : '-') + a[0].toFixed(1);
  return '';
}
function laneCoord(v) { const k = v.lane; if (!k) return 0; const sgn = k[1] === '+' ? 1 : -1; return (k[0] === 'x' ? v.x : v.y) * sgn; }
let gatesClosed = false;
function updateVehicles(dt, T) {
  // lane grouping for following
  const lanes = new Map();
  for (const v of vehicles) { v.lane = laneKey(v); if (!v.lane) continue; if (!lanes.has(v.lane)) lanes.set(v.lane, []); lanes.get(v.lane).push(v); }
  for (const arr of lanes.values()) { arr.sort((a, b) => laneCoord(b) - laneCoord(a)); for (let k = 0; k < arr.length; k++) arr[k].leader = k > 0 ? arr[k - 1] : null; }
  for (let n = vehicles.length - 1; n >= 0; n--) {
    const v = vehicles[n];
    let want = v.vmax;
    if (v.lane && v.leader) {
      const gap = laneCoord(v.leader) - laneCoord(v) - (v.len + v.leader.len) / 2;
      if (gap < 2.2) want = Math.min(want, v.leader.v * 0.95 + Math.max(0, gap - 0.45) * 1.2);
      if (gap < 0.45) want = 0;
    }
    // hold points (e.g. yard spots)
    const hold = v.holds.find((h) => h.seg === v.seg + 1 && T < h.until);
    let maxStep = Infinity;
    if (hold) { const t = v.pts[hold.seg]; const dist = Math.hypot(t[0] - v.x, t[1] - v.y); want = Math.min(want, Math.max(0, (dist - 0.02) * 2.2)); maxStep = Math.max(0, dist - 0.001); }
    // level crossing on Avenue C
    if (v.lane === 'y+37.5' && gatesClosed && v.y < 24.15 && v.y > 20.5) want = Math.min(want, Math.max(0, (24.1 - v.y - 0.02) * 2.4));
    if (v.lane === 'y-38.5' && gatesClosed && v.y > 26.65 && v.y < 28.6) want = Math.min(want, Math.max(0, (v.y - 26.7 - 0.02) * 2.4));
    // corner slowdown
    const nxt = v.pts[v.seg + 1];
    if (nxt && v.pts[v.seg + 2]) { const dd = Math.hypot(nxt[0] - v.x, nxt[1] - v.y); if (dd < 1.2) want = Math.min(want, 1.4 + dd); }
    v.v += clamp(want - v.v, -9 * dt, 3.2 * dt);
    if (v.v < 0) v.v = 0;
    let step = Math.min(v.v * dt, maxStep);
    while (step > 0 && v.seg < v.pts.length - 1) {
      const t = v.pts[v.seg + 1], dx = t[0] - v.x, dy = t[1] - v.y, d = Math.hypot(dx, dy);
      if (d < 1e-5) { v.seg++; continue; }
      const tgtH = Math.atan2(dy, dx);
      let dh = tgtH - v.hd; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
      v.hd += dh * Math.min(1, dt * 9);
      if (step >= d) { v.x = t[0]; v.y = t[1]; step -= d; v.seg++; }
      else { v.x += dx / d * step; v.y += dy / d * step; step = 0; }
    }
    if (v.seg >= v.pts.length - 1 && !v.done) { v.done = true; if (v.onDone) v.onDone(v); else v.st = 0; }
    // fade near the diorama edge
    const edge = Math.min(v.x + 0.6, WX + 0.6 - v.x, v.y + 0.6, WY + 0.6 - v.y);
    const st = v.st * clamp(edge / 1.2, 0, 1);
    v.s += (st - v.s) * Math.min(1, dt * 8);
    if (v.st === 0 && v.s < 0.03) { hideVehicle(v); vFree.push(v.i); vehicles.splice(n, 1); continue; }
    drawVehicle(v);
  }
  for (const m of [mBody, mTop, mCab, mCargo, mChassis, mScooter, mRider, mHead, mTail, mBeam]) m.instanceMatrix.needsUpdate = true;
}
function hideVehicle(v) { for (const m of [mBody, mTop, mCab, mCargo, mChassis, mScooter, mRider, mHead, mTail, mBeam]) m.setMatrixAt(v.i, ZERO_M); }
const _qH = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);
function drawVehicle(v) {
  _qH.setFromAxisAngle(_up, -v.hd); _v.set(v.x, 0.055, v.y); _s.setScalar(v.s);
  _m4.compose(_v, _qH, _s);
  if (v.kind === 'car') {
    mBody.setMatrixAt(v.i, _m4); mTop.setMatrixAt(v.i, _m4);
    _s.set(v.s, v.s, v.s); _m4.compose(_v, _qH, _s); mChassis.setMatrixAt(v.i, _m4);
    lampsFor(v, 0.5, -0.5);
  } else if (v.kind === 'truck') {
    mCab.setMatrixAt(v.i, _m4); mCargo.setMatrixAt(v.i, _m4);
    _s.set(v.s * 1.75, v.s, v.s * 1.2); _m4.compose(_v, _qH, _s); mChassis.setMatrixAt(v.i, _m4);
    lampsFor(v, 0.88, -0.96);
  } else {
    mScooter.setMatrixAt(v.i, _m4); mRider.setMatrixAt(v.i, _m4);
    lampsFor(v, 0.24, -0.24, 0.5);
  }
}
function lampsFor(v, front, back, w = 1) {
  const ch = Math.cos(-v.hd), sh = Math.sin(-v.hd);
  _s.set(v.s, v.s, v.s * w);
  _v.set(v.x + Math.cos(v.hd) * front, 0.055, v.y + Math.sin(v.hd) * front); _m4.compose(_v, _qH, _s); mHead.setMatrixAt(v.i, _m4);
  mBeam.setMatrixAt(v.i, _m4);
  _v.set(v.x + Math.cos(v.hd) * back, 0.055, v.y + Math.sin(v.hd) * back); _m4.compose(_v, _qH, _s); mTail.setMatrixAt(v.i, _m4);
}

/* ---------------- routes ---------------- */
function laneOffset(center, off = 0.5) { // right-hand lane offset of a centre polyline
  const out = [];
  const n = center.length;
  const dirs = [];
  for (let i = 0; i < n - 1; i++) { const dx = center[i + 1][0] - center[i][0], dy = center[i + 1][1] - center[i][1], d = Math.hypot(dx, dy) || 1; dirs.push([dx / d, dy / d]); }
  for (let i = 0; i < n; i++) {
    const d1 = dirs[Math.max(0, i - 1)], d2 = dirs[Math.min(dirs.length - 1, i)];
    const r1 = [-d1[1], d1[0]], r2 = [-d2[1], d2[0]];
    const same = Math.abs(d1[0] - d2[0]) < 1e-6 && Math.abs(d1[1] - d2[1]) < 1e-6;
    const rx = same ? r1[0] : r1[0] + r2[0], ry = same ? r1[1] : r1[1] + r2[1];
    out.push([center[i][0] + rx * off, center[i][1] + ry * off]);
  }
  return out;
}
function nearestAvenue(x) { return [13.5, 27.5].reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a)); }
function routeToYard(shop) { // centre-line waypoints ending at the yard entrance on Rollup Row
  if (!shop) return rand() < 0.5 ? [[-0.8, 19.5], [YARD.entryX, 19.5]] : [[WX + 0.8, 19.5], [YARD.entryX, 19.5]];
  const px = shop.pickup.x;
  if (shop.row === 1) return [[px, 17.9], [px, 19.5], [YARD.entryX, 19.5]];
  const ax = nearestAvenue(px);
  return [[px, 10.9], [px, 12.5], [ax, 12.5], [ax, 19.5], [YARD.entryX, 19.5]];
}
function routeFromYard(shop) { // from the yard exit on Rollup Row back to the shop
  if (!shop) return [[YARD.exitX, 19.5], [-0.8, 19.5]];
  const px = shop.pickup.x;
  if (shop.row === 1) return [[YARD.exitX, 19.5], [px, 19.5], [px, 17.9]];
  const ax = nearestAvenue(px);
  return [[YARD.exitX, 19.5], [ax, 19.5], [ax, 12.5], [px, 12.5], [px, 10.9]];
}
function truckPath(shop, spotX) {
  const road = laneOffset(routeToYard(shop), 0.5);
  road.pop(); // replace the last corner with an explicit turn into the yard
  const last = road[road.length - 1];
  const inLane = last[1] > 19.5 ? 20.0 : 19.0;
  road.push([YARD.entryX, inLane]);
  road.push([YARD.entryX, 21.2], [YARD.entryX, YARD.lane], [spotX, YARD.lane]);
  const holdSeg = road.length - 1;
  road.push([YARD.exitX, YARD.lane], [YARD.exitX, 20.9]);
  const back = laneOffset(routeFromYard(shop), 0.5);
  back[0] = [YARD.exitX, back[0][1]];
  return { pts: road.concat(back), holdSeg };
}
function pathLen(pts, upto) { let s = 0; for (let i = 0; i < Math.min(upto ?? pts.length - 1, pts.length - 1); i++) s += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); return s; }
const CAR_ROUTES = [
  { r: 0.14, pts: [[-0.7, 28.7], [WX + 0.7, 28.7]] }, { r: 0.14, pts: [[WX + 0.7, 27.7], [-0.7, 27.7]] },
  { r: 0.07, pts: [[-0.7, 6.0], [WX + 0.7, 6.0]] }, { r: 0.07, pts: [[WX + 0.7, 5.0], [-0.7, 5.0]] },
  { r: 0.06, pts: [[-0.7, 13.0], [37.5, 13.0], [37.5, 28.7], [WX + 0.7, 28.7]] },
  { r: 0.06, pts: [[WX + 0.7, 27.7], [38.5, 27.7], [38.5, 5.0], [-0.7, 5.0]] },
  { r: 0.05, pts: [[-0.7, 6.0], [37.5, 6.0], [37.5, 12.0], [-0.7, 12.0]] },
  { r: 0.06, pts: [[-0.7, 20.0], [WX + 0.7, 20.0]] }, { r: 0.06, pts: [[WX + 0.7, 19.0], [-0.7, 19.0]] },
];
function updateTraffic(dt) {
  for (const cr of CAR_ROUTES) {
    cr.t = (cr.t ?? R(0, 4)) - dt;
    if (cr.t <= 0) {
      cr.t = R(0.6, 1.6) / cr.r;
      const blocked = vehicles.some((v) => Math.hypot(v.x - cr.pts[0][0], v.y - cr.pts[0][1]) < 2.2);
      if (!blocked) spawnVehicle('car', cr.pts.map((p) => [p[0], p[1]]), { v0: 2.5 });
    }
  }
}

/* ---------------- trains ---------------- */
const CLIP = [new THREE.Plane(new THREE.Vector3(1, 0, 0), -3.5), new THREE.Plane(new THREE.Vector3(-1, 0, 0), 48.5)];
function tmat(hex, o = {}) { const m = new THREE.MeshStandardMaterial({ color: hex, roughness: o.r ?? 0.55, metalness: o.m ?? 0.2, clippingPlanes: CLIP }); if (o.e) { m.emissive = new THREE.Color(o.e); m.emissiveIntensity = o.ei ?? 1; } return m; }
const TM = {
  loco: tmat('#3b48be', { r: 0.45, m: 0.35 }), stripe: tmat('#f4f5f8'), dark: tmat('#1d2029', { r: 0.7 }), coach: tmat('#dde2ea', { r: 0.45, m: 0.3 }),
  roof: tmat('#9aa3b2'), deck: tmat('#4a505c', { r: 0.8 }), gem: tmat('#9aa6ff', { e: '#6f7bff', ei: 1.2 }),
  headlight: nightMat(tmat('#fff7de', { e: '#fff3cf', ei: 1 }), 0.8, 2.6),
};
const COACHES = 5, FLATS = 7;
const LEN = { loco: 2.35, car: 2.0, gap: 0.05 };
function makeTrain() {
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  // loco (local x: 0 = nose, extends to -2.35)
  add(new THREE.BoxGeometry(2.3, 0.78, 0.86), TM.loco, -1.2, 0.68, 0);
  add(new THREE.BoxGeometry(0.95, 0.3, 0.8), TM.loco, -0.62, 1.22, 0);
  add(new THREE.BoxGeometry(0.2, 0.2, 0.78), TM.dark, -0.12, 1.2, 0);
  add(new THREE.BoxGeometry(2.32, 0.07, 0.88), TM.stripe, -1.2, 0.66, 0);
  add(new THREE.BoxGeometry(0.06, 0.12, 0.3), TM.headlight, 0.0, 0.52, 0);
  const gem = add(new THREE.OctahedronGeometry(0.13, 0), TM.gem, -1.4, 0.92, 0.44); gem.scale.set(1, 1.5, 0.3);
  add(new THREE.BoxGeometry(0.55, 0.2, 0.7), TM.dark, -0.45, 0.18, 0); add(new THREE.BoxGeometry(0.55, 0.2, 0.7), TM.dark, -1.95, 0.18, 0);
  const coachWin = [];
  for (let i = 0; i < COACHES; i++) {
    const x1 = -(LEN.loco + LEN.gap + i * (LEN.car + LEN.gap)), cx = x1 - LEN.car / 2;
    add(new THREE.BoxGeometry(1.98, 0.8, 0.84), TM.coach, cx, 0.7, 0);
    add(new THREE.BoxGeometry(1.9, 0.08, 0.7), TM.roof, cx, 1.14, 0);
    add(new THREE.BoxGeometry(1.99, 0.07, 0.86), TM.loco, cx, 0.42, 0);
    const wm = tmat('#9fb3c8', { r: 0.25, m: 0.4, e: '#ffd38a', ei: 0 });
    add(new THREE.BoxGeometry(1.78, 0.25, 0.87), wm, cx, 0.8, 0);
    coachWin.push(wm);
    add(new THREE.BoxGeometry(0.45, 0.2, 0.7), TM.dark, cx + 0.7, 0.18, 0); add(new THREE.BoxGeometry(0.45, 0.2, 0.7), TM.dark, cx - 0.7, 0.18, 0);
  }
  const flats = [];
  for (let j = 0; j < FLATS; j++) {
    const x1 = -(LEN.loco + LEN.gap + COACHES * (LEN.car + LEN.gap) + j * (LEN.car + LEN.gap)), cx = x1 - LEN.car / 2;
    const f = new THREE.Group();
    const d = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.12, 0.84), TM.deck); d.position.set(0, 0.36, 0); d.castShadow = d.receiveShadow = true; f.add(d);
    for (const bx of [0.7, -0.7]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.22, 0.7), TM.dark); b.position.set(bx, 0.19, 0); f.add(b); }
    f.position.x = cx; g.add(f); flats.push(f);
  }
  const boxes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 0.5, 0.74), new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.15, clippingPlanes: CLIP }), FLATS * 3);
  boxes.castShadow = true; boxes.frustumCulled = false; g.add(boxes);
  for (let i = 0; i < FLATS * 3; i++) boxes.setMatrixAt(i, ZERO_M);
  const light = new THREE.SpotLight('#ffefcf', 0, 14, 0.5, 0.6, 1.2); light.position.set(0.1, 0.55, 0); light.target.position.set(6, 0, 0); g.add(light, light.target);
  g.visible = false; scene.add(g);
  return { g, coachWin, flats, boxes, light, k: null, block: null, loaded: [], nb: 0 };
}
const TRAINS = [makeTrain(), makeTrain(), makeTrain()];
function slotX(s) { // x of container slot s relative to train nose
  const j = Math.floor(s / 3), i = s % 3;
  const x1 = -(LEN.loco + LEN.gap + COACHES * (LEN.car + LEN.gap) + j * (LEN.car + LEN.gap));
  return x1 - LEN.car / 2 + (1 - i) * 0.64;
}
function trainFront(t) { // t = seconds since slot start
  if (t < 3) return STOP_X - 2 * (3 - t) * (3 - t);
  if (t < 9) return STOP_X;
  return STOP_X + 2 * (t - 9) * (t - 9);
}
function trainLength(nb) { return LEN.loco + COACHES * (LEN.car + LEN.gap) + Math.ceil(nb / 3) * (LEN.car + LEN.gap); }

/* ---------------- crates in flight ---------------- */
const MAXC = 64;
const crateMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 0.5, 0.74), new THREE.MeshStandardMaterial({ roughness: 0.55 }), MAXC);
crateMesh.castShadow = true; crateMesh.frustumCulled = false; crateMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(crateMesh);
for (let i = 0; i < MAXC; i++) crateMesh.setMatrixAt(i, ZERO_M);
const crates = []; const cFree = []; for (let i = MAXC - 1; i >= 0; i--) cFree.push(i);

/* ---------------- particles ---------------- */
class Particles {
  constructor(max, { additive = false, color = '#ffffff' } = {}) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.a = new Float32Array(max); this.sz = new Float32Array(max);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.age = new Float32Array(max); this.s0 = new Float32Array(max); this.s1 = new Float32Array(max); this.a0 = new Float32Array(max);
    this.c0 = new Float32Array(max * 3); this.c1 = new Float32Array(max * 3); this.drag = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aCol', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aA', new THREE.BufferAttribute(this.a, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aS', new THREE.BufferAttribute(this.sz, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uScale: { value: 400 } },
      vertexShader: 'attribute vec3 aCol; attribute float aA; attribute float aS; uniform float uScale; varying vec3 vC; varying float vA; void main(){ vC=aCol; vA=aA; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = aS*uScale/max(0.1,-mv.z); gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'varying vec3 vC; varying float vA; void main(){ vec2 c = gl_PointCoord-0.5; float d = length(c); float a = smoothstep(0.5,0.0,d)*vA; if(a<0.01) discard; gl_FragColor = vec4(vC,a); }',
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; scene.add(this.points);
  }
  emit(x, y, z, vx, vy, vz, life, s0, s1, a0, c0, c1, drag = 0.4) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.pos.set([x, y, z], i * 3); this.vel.set([vx, vy, vz], i * 3); this.life[i] = life; this.age[i] = 0; this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = a0; this.drag[i] = drag;
    _c.set(c0); this.c0.set([_c.r, _c.g, _c.b], i * 3); _c.set(c1 || c0); this.c1.set([_c.r, _c.g, _c.b], i * 3);
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) { this.n--; this.copy(this.n, i); i--; continue; }
      const t = this.age[i] / this.life[i], dr = Math.max(0, 1 - this.drag[i] * dt);
      for (let k = 0; k < 3; k++) { this.vel[i * 3 + k] *= dr; this.pos[i * 3 + k] += this.vel[i * 3 + k] * dt; this.col[i * 3 + k] = lerp(this.c0[i * 3 + k], this.c1[i * 3 + k], t); }
      this.sz[i] = lerp(this.s0[i], this.s1[i], t);
      this.a[i] = this.a0[i] * Math.min(1, t * 6) * (1 - t);
    }
    this.geo.setDrawRange(0, this.n);
    for (const k of ['position', 'aCol', 'aA', 'aS']) this.geo.attributes[k].needsUpdate = true;
  }
  copy(from, to) {
    for (const arr of [this.pos, this.vel, this.col, this.c0, this.c1]) for (let k = 0; k < 3; k++) arr[to * 3 + k] = arr[from * 3 + k];
    for (const arr of [this.a, this.sz, this.life, this.age, this.s0, this.s1, this.a0, this.drag]) arr[to] = arr[from];
  }
}
const smoke = new Particles(420);
const flames = new Particles(220, { additive: true });
const sparkles = new Particles(520, { additive: true });

/* ---------------- birds ---------------- */
const BIRDS = [];
function buildBirds() {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, -0.12, 0, -0.22, 0.06, 0, 0, 0, 0, 0, 0.06, 0, 0, -0.12, 0, 0.22]), 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshBasicMaterial({ color: '#2b3040', side: THREE.DoubleSide });
  for (let f = 0; f < 2; f++) {
    const flock = { birds: [], t: R(0, 30), y: R(9, 12), z0: R(2, 28), dir: f ? 1 : -1 };
    for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(geo, mat); b.scale.setScalar(1.3); scene.add(b); flock.birds.push({ m: b, ox: -i * 0.55 * (i % 2 ? 1 : -1), oz: i * 0.45, ph: R(0, 6) }); }
    BIRDS.push(flock);
  }
}


/* =====================================================================
   BUILD + MAIN LOOP
   ===================================================================== */
function buildWorld() {
  buildGround();
  buildRail();
  hill(0, 22.2, 3.4, 27.0, 'E');
  hill(48.6, 22.2, WX, 27.0, 'W');
  buildStation();
  buildVault();
  buildMint();
  buildBuilders();
  buildBurn();
  buildGates();
  D.l2.slice(0, 14).forEach((s, i) => buildShop({ ...s, rank: i + 1 }, i));
  // houses: Validator Hill (north) and the east edge
  let seed = 3;
  for (let x = 1.2; x < 36.5; x += R(3.2, 4.1)) { house(x, R(0.7, 1.2), R(2.0, 2.5), R(1.7, 2.0), seed++); addTree(x + R(2.4, 2.9), R(1.2, 3.1), R(0.8, 1.1)); }
  for (let x = 40.2; x < 50.6; x += R(3.0, 3.6)) { house(x, R(0.7, 1.1), R(1.9, 2.3), R(1.7, 2.0), seed++); addTree(x + R(2.2, 2.7), R(1.4, 3.2), R(0.8, 1.1)); }
  house(49.4, 8.2, 2.0, 1.8, seed++); house(49.6, 11.2, 1.9, 1.8, seed++);
  // trees
  for (let x = 0.7; x < WX - 0.5; x += R(1.3, 2.1)) if ((x < 36.4 || x > 39.6) && (x < 19.1 || x > 36.1)) addTree(x, R(29.7, 30.7), R(0.85, 1.25)); // Builders' Row sits across the tracks
  for (let x = 4.5; x < 47.5; x += R(3.5, 5.5)) if (x < 36 || x > 40) addTree(x, R(26.35, 26.8), R(0.6, 0.85), 'round');
  for (let x = 1.2; x < 36; x += R(3.6, 4.6)) if (!(x > 12 && x < 15) && !(x > 26 && x < 29)) addTree(x, 13.85, R(0.62, 0.78), 'round');
  for (let x = 1.4; x < WX - 1; x += R(4.2, 5.6)) if (!(x > 12 && x < 15) && !(x > 26 && x < 29) && !(x > 36.5 && x < 39.5)) addTree(x, 6.85, R(0.62, 0.8), 'round');
  for (const [x, y] of [[33.4, 8.0], [35.4, 8.3], [34.2, 9.7], [35.8, 10.1], [33.2, 10.2]]) addTree(x, y, R(0.8, 1.1));
  for (const [x, y] of [[35.0, 22.0], [36.2, 23.3], [35.2, 24.1]]) addTree(x, y, R(0.75, 0.95));
  for (const [x, y] of [[0.8, 21.6], [2.0, 21.7], [3.3, 21.55], [47.4, 21.4], [47.9, 23.0], [47.3, 24.2]]) addTree(x, y, R(0.7, 0.95));
  for (let y = 7.8; y < 17; y += R(1.5, 2.1)) addTree(R(51.2, 51.7), y, R(0.7, 1.0));
  for (let y = 7.9; y < 11; y += 1.4) addTree(R(39.6, 40.2), y + 0.2, R(0.7, 0.9));
  for (const [x, y] of [[0.9, 23.2], [2.3, 25.9], [1.1, 26.4], [49.7, 23.0], [51.2, 25.8], [50.3, 26.2]]) addTree(x, y, R(0.75, 1.0), 'pine', 2.75);
  // street lamps
  for (let x = 2; x < WX - 1; x += 5) if (Math.abs(x - YARD.entryX) > 1 && Math.abs(x - YARD.exitX) > 1 && Math.abs(x - 38) > 1.3) LAMPS.push({ x, y: 20.95 });
  for (let x = 3; x < WX - 1; x += 6.5) if (Math.abs(x - 38) > 1.5) LAMPS.push({ x, y: 26.95 });
  for (let x = 4; x < 36; x += 7) if (Math.abs(x - 13.5) > 1.5 && Math.abs(x - 27.5) > 1.5) LAMPS.push({ x, y: 14.2 });
  for (let x = 2.5; x < WX - 1; x += 7) if (Math.abs(x - 13.5) > 1.5 && Math.abs(x - 27.5) > 1.5 && Math.abs(x - 38) > 1.5) LAMPS.push({ x, y: 7.25 });
  buildTrees(); buildLamps(); buildClouds(); buildBirds();
  flushStatic();
}

let lastFrame = performance.now(), flagT = 0, screenT = 0;
const NORENDER = /norender/.test(location.hash);
window.__town = { ST, D, STOPS, people, vehicles, TRAINS, crates, LIVE, SHOPS, VAULTQ, REWARDS, WORKSHOPS, HANDOFFS, MINT, LOW, MSAA, get board() { return boardBlock; }, get pr() { return renderer.getPixelRatio(); }, flyTo: (v) => { flyTo(v, true); updateFly(0.1); } };
/* one-step quality drop when the first seconds run slowly: fewer pixels, no MSAA, no shadows from people and cars */
const PERF = { t: 0, n: 0, sum: 0, done: false };
function watchPerf(raw) {
  if (PERF.done || NORENDER || document.hidden || raw > 0.5) return;
  PERF.t += raw; if (PERF.t < 2) return; // skip warm-up (shader compiles, first data)
  PERF.n++; PERF.sum += raw;
  if (PERF.t > 7) { PERF.done = true; if (PERF.sum / PERF.n > 1 / 24) lowerQuality(); }
}
function lowerQuality() {
  if (ST.lowered) return; ST.lowered = true;
  const pr = Math.max(1, renderer.getPixelRatio() * 0.75);
  renderer.setPixelRatio(pr); composer.setPixelRatio(pr);
  for (const rt of [composer.renderTarget1, composer.renderTarget2]) if (rt.samples) { rt.samples = 0; rt.dispose(); }
  for (const m of ACTOR_MESHES) m.castShadow = false;
  if (sun.shadow.mapSize.x > 1024) { sun.shadow.mapSize.set(1024, 1024); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  resize();
}
function frame(now) {
  const raw = (now - lastFrame) / 1000; lastFrame = now;
  const dtR = Math.min(ST.mode === 'live' ? 0.5 : 0.1, raw); // live: keep pace with the chain even on slow devices
  watchPerf(raw);
  const dt = ST.paused ? 0 : dtR * (ST.mode === 'live' ? 1 : ST.speed);
  ST.T += dt;
  applySky(dtR);
  simTick(dt, ST.T);
  updateCrowds(dt);
  updateVaultQueues(dt);
  if (dt > 0 && strollCount < 34 && rand() < dt * 3) stroller(false);
  updatePeople(dt);
  updateTraffic(dt);
  updateCouriers(dt);
  updateVehicles(dt, ST.T);
  updateFx(dt, ST.T);
  // clouds & birds
  for (const c of CLOUDS) { c.position.x += c.userData.v * dt; if (c.position.x > 68) c.position.x = -16; }
  for (const f of BIRDS) {
    f.t += dt; const span = 90, x = f.dir > 0 ? -20 + (f.t * 2.2) % span : 72 - (f.t * 2.2) % span;
    const vis = ST.nightF < 0.6;
    for (const b of f.birds) { b.m.visible = vis; b.m.position.set(x + b.ox, f.y + Math.sin(f.t * 0.7 + b.ph) * 0.3, f.z0 + b.oz); b.m.rotation.y = f.dir > 0 ? 0 : Math.PI; b.m.scale.z = 1.3 * (0.35 + 0.65 * Math.abs(Math.sin(f.t * 9 + b.ph))); }
  }
  // waving flags
  flagT += dt;
  for (const s of SHOPS) {
    if (!s.flag) continue;
    const pos = s.flag.geometry.attributes.position, base = s.flag.userData.base;
    for (let i = 0; i < pos.count; i++) { const x = base[i * 3]; pos.array[i * 3 + 2] = Math.sin(flagT * 5 + x * 7 + s.idx) * 0.06 * (x / 0.55); }
    pos.needsUpdate = true;
  }
  // gentle tree sway (every other frame)
  if (treeCanopy && (Math.floor(now / 16) % 2 === 0)) {
    for (let i = 0; i < TREES.length; i++) {
      const t = TREES[i]; if (t.slot === undefined) continue;
      _q.setFromAxisAngle(_up, t.c * 6.28); _e.set(Math.sin(flagT * 1.3 + t.x) * 0.035, t.c * 6.28, Math.cos(flagT * 1.1 + t.y) * 0.035); _q.setFromEuler(_e);
      _s.set(t.s, t.s * (0.9 + t.c * 0.3), t.s); _v.set(t.x, t.base, t.y); _m4.compose(_v, _q, _s); treeCanopy.setMatrixAt(t.slot, _m4);
    }
    treeCanopy.instanceMatrix.needsUpdate = true;
  }
  updateFly(dtR);
  controls.update();
  updateOcclusion(dtR);
  controls.target.x = clamp(controls.target.x, -4, WX + 4); controls.target.z = clamp(controls.target.z, -4, WY + 4); controls.target.y = clamp(controls.target.y, 0, 9);
  // ring pulse
  if (ring.visible) { ring.userData.t = (ring.userData.t || 0) + dtR; ring.material.opacity = 0.55 * (1 - smooth((ring.userData.t - 2.2) / 1.6)); ring.scale.z = 1; }
  // tour
  if (ST.tour) { ST.tourT += dtR; if (ST.tourT > 9) { ST.tourT = 0; selectStop(ST.stop + 1, true); } }
  updateIntro(dtR);
  screenT += dtR; if (screenT > 0.12) { screenT = 0; updateSupply(); }
  updateLabels(); updateToasts(dtR);
  if (!NORENDER) composer.render();
  requestAnimationFrame(frame);
}

function resize() {
  const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloom.resolution.set(w * 0.5, h * 0.5);
  camera.aspect = w / h;
  // keep the town centred in the space the side card leaves free
  const dx = (!ST.uiHidden && w > 1100) ? 178 : 0, dy = (!ST.uiHidden && w > 760) ? 18 : 0;
  if (dx || dy) camera.setViewOffset(w + 2 * dx, h + 2 * dy, 2 * dx, 0, w, h); else camera.clearViewOffset();
  camera.updateProjectionMatrix();
  const sc = (h * renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  smoke.mat.uniforms.uScale.value = sc; flames.mat.uniforms.uScale.value = sc; sparkles.mat.uniforms.uScale.value = sc;
}
window.addEventListener('resize', resize);

function applyHash(tokens, instant) {
  for (const t of tokens) {
    if (SKY_HOUR[t] !== undefined || t === 'cycle') { ST.sky = t; $('#skyLabel').textContent = SKY_LABEL[t]; $('#sky').setAttribute('aria-label', 'Time of day: ' + SKY_LABEL[t]); if (t !== 'cycle' && instant) hourShown = SKY_HOUR[t]; else if (t === 'cycle') ST.hourSet = hourShown ?? 12; }
    else if (t === 'tour') setTour(true);
    else if (t === 'noui') setUiHidden(true);
    else { const i = STOPS.findIndex((s) => (s.shop && s.shop.key === t) || s.type === t); if (i >= 0) { if (!tokens.includes('tour')) setTour(false); selectStop(i); if (instant) { flyTo(STOPS[i].view, true); updateFly(0.1); } } }
  }
  if (!instant && !tokens.length) { setTour(false); selectStop(0); } // address cleared: back to the overview
}
async function init() {
  resize();
  const fontsReady = Promise.race([Promise.all([
    document.fonts.load('800 64px "Big Shoulders Display"'), document.fonts.load('900 64px "Big Shoulders Display"'),
    document.fonts.load('900 64px "Doto"'), document.fonts.load('700 30px "Figtree"'),
  ]), new Promise((r) => setTimeout(r, 2500))]);
  const town = await Promise.race([getJSON('/api/town', 6000), new Promise((r) => setTimeout(() => r(null), 6500))]);
  if (town) applyTown(town);
  await fontsReady;
  buildWorld();
  buildStops();
  makeLabels();
  SHOPS.forEach(crowdFor);
  buildVaultQueues(D.staking.entryQ, D.staking.exitQ);
  for (let i = 0; i < 26; i++) stroller(true);
  for (const cr of CAR_ROUTES) { const n = Math.round(cr.r * 12); for (let i = 0; i < n; i++) { const v = spawnVehicle('car', cr.pts.map((p) => [p[0], p[1]]), { instant: true, v0: 3 }); if (v) { let adv = R(2, pathLen(cr.pts) - 2); while (adv > 0 && v.seg < v.pts.length - 1) { const a = v.pts[v.seg + 1], d = Math.hypot(a[0] - v.x, a[1] - v.y); if (adv >= d) { v.x = a[0]; v.y = a[1]; v.seg++; adv -= d; } else { v.x += (a[0] - v.x) / d * adv; v.y += (a[1] - v.y) / d * adv; adv = 0; } } const a = v.pts[v.seg + 1]; if (a) v.hd = Math.atan2(a[1] - v.y, a[0] - v.x); } } }
  // shareable views: #night, #dusk, #dawn, #day, #tour, #noui, or an L2 / place key (e.g. #base, #station, #vault, #burn)
  const tokens = (location.hash || '').replace('#', '').toLowerCase().split(/[-.~_]/).filter(Boolean);
  HASH_KEEP = tokens.filter((t) => SKY_HOUR[t] !== undefined || t === 'cycle' || t === 'noui'); // kept in the address as stops change
  bindUI();
  setPaused(ST.paused);
  selectStop(0);
  flyTo(STOPS[0].view, true); updateFly(0.1);
  applyHash(tokens, true);
  if (!tokens.length && !RM && !NORENDER && !introSeen()) setTimeout(() => { if (ST.stop === 0 && !ST.tour) startIntro(); }, 1200); // first visit: a short guided flight
  // a link pasted into the address bar of an open town (our own replaceState calls don't fire this)
  window.addEventListener('hashchange', () => {
    const t = (location.hash || '').replace('#', '').toLowerCase().split(/[-.~_]/).filter(Boolean);
    HASH_KEEP = t.filter((x) => SKY_HOUR[x] !== undefined || x === 'cycle' || x === 'noui');
    applyHash(t, false);
  });
  applySky(0.016);
  setModeUI();
  document.body.classList.add('ready');
  requestAnimationFrame((t) => { lastFrame = t; frame(t); });
  startLive();
}
init().catch((e) => { console.error(e); const el = document.getElementById('loading'); if (el) el.textContent = 'Could not start the 3D town on this device.'; });


/* =====================================================================
   TIME OF DAY
   ===================================================================== */
const SKY_ORDER = ['now', 'dawn', 'day', 'dusk', 'night', 'cycle'];
const SKY_LABEL = { now: 'Now', dawn: 'Dawn', day: 'Midday', dusk: 'Dusk', night: 'Night', cycle: 'Day cycle' };
const SKY_HOUR = { dawn: 7.05, day: 13.2, dusk: 18.25, night: 22.6 };
const CL = (h) => new THREE.Color(h);
const PAL = {
  sunDay: CL('#fff3e0'), sunGold: CL('#ffb97c'), moon: CL('#9fb2ff'),
  hSkyDay: CL('#d8e9ff'), hSkyGold: CL('#ffc7a6'), hSkyNight: CL('#2c3866'),
  hGrdDay: CL('#8d7d64'), hGrdNight: CL('#16140f'),
  topDay: CL('#79acdb'), midDay: CL('#cde2ee'), botDay: CL('#e6ede6'),
  topGold: CL('#5a74c0'), midGold: CL('#f6b98e'), botGold: CL('#e7c0b2'),
  topNight: CL('#050915'), midNight: CL('#121a36'), botNight: CL('#0b1020'),
  cloudDay: CL('#ffffff'), cloudNight: CL('#3c4668'),
};
const _ca = new THREE.Color(), _cb = new THREE.Color();
function mix3(day, gold, night, d, g, out) { out.copy(day).lerp(gold, g); _cb.copy(out); return out.copy(night).lerp(_cb, d); }
let hourShown = null;
function localHour() { const d = new Date(); return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600; }
function skyTarget(dtR) {
  if (ST.sky === 'now') return localHour();
  if (ST.sky === 'cycle') { ST.hourSet = (ST.hourSet + dtR * 24 / 100) % 24; return ST.hourSet; }
  return SKY_HOUR[ST.sky];
}
function applySky(dtR) {
  const target = skyTarget(dtR);
  if (hourShown === null || ST.sky === 'cycle') hourShown = target;
  else { let dh = target - hourShown; if (dh < 0) dh += 24; if (dh > 0.001) { const step = Math.min(dh, dtR * 7); hourShown = (hourShown + step) % 24; } }
  const h = hourShown;
  const rise = 6.8, set = 18.75;
  let d;
  if (h < rise - 0.75 || h > set + 0.85) d = 0;
  else if (h < rise + 0.85) d = smooth((h - (rise - 0.75)) / 1.6);
  else if (h > set - 0.85) d = 1 - smooth((h - (set - 0.85)) / 1.7);
  else d = 1;
  const g = clamp(Math.max(1 - Math.abs(h - (rise + 0.55)) / 1.25, 1 - Math.abs(h - (set - 0.35)) / 1.25), 0, 1) * clamp(d * 1.6, 0, 1);
  ST.nightF = 1 - d; ST.gold = g;
  // sun / moon
  if (d > 0.02) {
    const phi = Math.PI * clamp((h - rise) / (set - rise), -0.05, 1.05);
    const el = Math.max(0.12, Math.sin(clamp(phi, 0, Math.PI)) * 0.92);
    const dir = new THREE.Vector3(Math.cos(phi) * Math.cos(el), Math.sin(el), Math.abs(Math.sin(phi)) * Math.cos(el) * 0.95 + 0.25).normalize();
    sun.position.copy(dir).multiplyScalar(95).add(sun.target.position);
    _ca.copy(PAL.sunDay).lerp(PAL.sunGold, g); _ca.lerp(PAL.moon, 1 - d);
    sun.color.copy(_ca); sun.intensity = lerp(0.45, 2.75 - g * 0.6, d);
  } else {
    sun.position.set(-0.35, 0.9, 0.55).normalize().multiplyScalar(95).add(sun.target.position);
    sun.color.copy(PAL.moon); sun.intensity = 0.38;
  }
  mix3(PAL.hSkyDay, PAL.hSkyGold, PAL.hSkyNight, d, g, hemi.color);
  hemi.groundColor.copy(PAL.hGrdNight).lerp(PAL.hGrdDay, d);
  hemi.intensity = lerp(0.34, 1.05, d);
  mix3(PAL.topDay, PAL.topGold, PAL.topNight, d, g, skyUniforms.top.value);
  mix3(PAL.midDay, PAL.midGold, PAL.midNight, d, g, skyUniforms.mid.value);
  mix3(PAL.botDay, PAL.botGold, PAL.botNight, d, g, skyUniforms.bot.value);
  scene.fog.color.copy(skyUniforms.mid.value);
  starMat.opacity = smooth((ST.nightF - 0.35) / 0.5) * 0.9;
  bloom.strength = 0.16 + ST.nightF * 0.34;
  bloom.threshold = lerp(0.92, 0.8, ST.nightF);
  bloom.radius = 0.35;
  renderer.toneMappingExposure = lerp(1.0, 1.04, ST.nightF);
  const nf = smooth((ST.nightF - 0.2) / 0.6);
  for (const n of NIGHT_MATS) n.m.emissiveIntensity = lerp(n.day, n.night, nf);
  BEAM_MAT.opacity = nf * 0.3;
  const cm = CLOUDS[0] && CLOUDS[0].children[0].material; if (cm) { cm.color.copy(PAL.cloudNight).lerp(PAL.cloudDay, d); cm.opacity = lerp(0.55, 0.93, d); }
  ST.hour = h;
}

/* =====================================================================
   LABELS, TOASTS, BOARD
   ===================================================================== */
const labelLayer = $('#labels'), toastLayer = $('#toasts');
const LABELS = [];
function makeLabels() {
  labelLayer.innerHTML = '';
  LABELS.length = 0;
  STOPS.forEach((s, i) => {
    if (!s.anchor) return;
    const el = document.createElement('button');
    el.className = 'lbl';
    el.type = 'button';
    el.innerHTML = s.type === 'l2'
      ? `<i style="background:${s.shop.brand.id}"></i><b>${s.shop.rank}</b>${s.shop.name}`
      : `<i class="${s.type}"></i>${s.short || s.name}`;
    el.setAttribute('aria-label', `Open ${s.name}`);
    el.addEventListener('click', (ev) => { ev.stopPropagation(); selectStop(i); });
    labelLayer.appendChild(el);
    LABELS.push({ el, stop: s, idx: i, v: new THREE.Vector3(...s.anchor) });
  });
  for (const I of INFO) {
    const el = document.createElement('button');
    el.className = 'lbl info ' + I.cls; el.type = 'button';
    el.innerHTML = '<i></i><span></span>';
    el.addEventListener('click', (ev) => { ev.stopPropagation(); const i = STOPS.findIndex((x) => x.type === I.go); if (i >= 0) selectStop(i); });
    labelLayer.appendChild(el);
    I.el = el; I.span = el.querySelector('span'); I.shown = undefined; I.w = 0;
  }
}
/* secondary labels that say what is happening around the vault (shown near it, or when it is selected) */
const INFO = [
  { v: new THREE.Vector3(43.1, 0.95, 16.95), cls: 'in', go: 'vault', text: () => `Waiting to stake · ${compact(D.staking.entryQ, 2)} ETH` },
  { v: new THREE.Vector3(47.7, 0.85, 16.75), cls: 'out', go: 'vault', text: () => `Waiting to exit · ${compact(D.staking.exitQ, 0)} ETH` },
  { v: new THREE.Vector3(38.2, 4.55, 14.45), cls: 'gold', go: 'bitmine', text: () => `Bitmine’s stake · ${compact(D.bitmine.staked, 2)} ETH` },
  { v: new THREE.Vector3(45.6, 2.5, 2.2), cls: 'gold', go: 'vault', only: 'vault', text: () => 'Rewards to other stakers' },
];
const _pv = new THREE.Vector3();
const PRIO = { station: 1, vault: 2, burn: 3, bitmine: 4 };
// panels that labels should not peek out from under (refreshed a few times a second)
let panelRects = [], panelT = 0;
function refreshPanels() {
  const app = canvas.getBoundingClientRect();
  panelRects = ['.plaque', '#board', '#card', '#key', '.dock'].map((q) => document.querySelector(q)).filter((el) => el && el.offsetParent !== null)
    .map((el) => { const r = el.getBoundingClientRect(); return [r.left - app.left, r.top - app.top, r.right - app.left, r.bottom - app.top]; });
}
function updateLabels() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const dist = camera.position.distanceTo(controls.target);
  const order = LABELS.slice().sort((a, b) => ((ST.stop === b.idx) - (ST.stop === a.idx)) || ((PRIO[a.stop.type] || 10 + (a.stop.shop ? a.stop.shop.rank : 0)) - (PRIO[b.stop.type] || 10 + (b.stop.shop ? b.stop.shop.rank : 0))));
  const now = performance.now(); if (now - panelT > 400) { panelT = now; refreshPanels(); }
  const placed = ST.uiHidden ? [] : panelRects.slice();
  for (const L of order) {
    _pv.copy(L.v).project(camera);
    const on = ST.stop === L.idx;
    const vis = _pv.z < 1 && _pv.x > -1.1 && _pv.x < 1.1 && _pv.y > -1.1 && _pv.y < 1.15 && !ST.uiHidden;
    const small = dist > 62 && L.stop.type === 'l2' && L.stop.shop.rank > 7 && !on;
    if (!vis || small) { if (L.shown !== false) { L.el.style.display = 'none'; L.shown = false; } continue; }
    const x = (_pv.x + 1) / 2 * w, y = (1 - _pv.y) / 2 * h;
    if (!L.w) { L.el.style.display = ''; L.shown = true; L.w = L.el.offsetWidth || 90; L.h = L.el.offsetHeight || 22; } // measuring shows it, so the hide below must run
    const r = [x - L.w / 2, y - L.h, x + L.w / 2, y];
    const hit = r[1] < 2 || placed.some((p) => r[0] < p[2] - 4 && r[2] > p[0] + 4 && r[1] < p[3] - 2 && r[3] > p[1] + 2);
    if (hit && !on) { if (L.shown !== false) { L.el.style.display = 'none'; L.shown = false; } continue; }
    placed.push(r);
    if (L.shown !== true) { L.el.style.display = ''; L.shown = true; }
    L.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    if (L.on !== on) { L.el.classList.toggle('on', on); L.on = on; L.w = 0; }
  }
  const sel = STOPS[ST.stop] && STOPS[ST.stop].type;
  for (const I of INFO) {
    const want = !ST.uiHidden && (I.only ? sel === I.only : (sel === 'vault' || sel === 'bitmine' || camera.position.distanceTo(I.v) < 30));
    let show = false, x = 0, y = 0;
    if (want) {
      _pv.copy(I.v).project(camera);
      if (_pv.z < 1 && _pv.x > -1.05 && _pv.x < 1.05 && _pv.y > -1.05 && _pv.y < 1.05) {
        const t = I.text(); if (I.t !== t) { I.span.textContent = t; I.t = t; I.w = 0; }
        x = (_pv.x + 1) / 2 * w; y = (1 - _pv.y) / 2 * h;
        if (!I.w) { I.el.style.display = ''; I.shown = true; I.w = I.el.offsetWidth || 120; I.h = I.el.offsetHeight || 20; }
        const r = [x - I.w / 2, y - I.h, x + I.w / 2, y];
        show = r[1] >= 2 && !placed.some((p) => r[0] < p[2] - 2 && r[2] > p[0] + 2 && r[1] < p[3] - 1 && r[3] > p[1] + 1);
        if (show) placed.push(r);
      }
    }
    if (!show) { if (I.shown !== false) { I.el.style.display = 'none'; I.shown = false; } continue; }
    if (I.shown !== true) { I.el.style.display = ''; I.shown = true; }
    I.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
  }
}
const TOASTS = [];
function toast(pos, text, cls = '') {
  if (ST.uiHidden || document.hidden) return;
  const el = document.createElement('div'); el.className = 'toast ' + cls; el.textContent = text;
  toastLayer.appendChild(el);
  TOASTS.push({ el, v: new THREE.Vector3(...pos), t: 0 });
  if (TOASTS.length > 10) { const o = TOASTS.shift(); o.el.remove(); }
}
function updateToasts(dtR) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  for (let i = TOASTS.length - 1; i >= 0; i--) {
    const t = TOASTS[i]; t.t += dtR;
    if (t.t > 2.8) { t.el.remove(); TOASTS.splice(i, 1); continue; }
    _pv.copy(t.v); _pv.y += t.t * 0.5; _pv.project(camera);
    if (_pv.z > 1) { t.el.style.opacity = 0; continue; }
    t.el.style.opacity = String(Math.min(1, t.t * 4) * (1 - smooth((t.t - 2.1) / 0.7)));
    t.el.style.transform = `translate(${((_pv.x + 1) / 2 * w).toFixed(1)}px, ${((1 - _pv.y) / 2 * h).toFixed(1)}px) translate(-50%, -50%)`;
  }
}
function nameOf(key) { return (D.names && D.names[key]) || (SHOPS.find((s) => s.key === key) || {}).name || key; }
function updateBoard(b) {
  $('#bNum').textContent = fmt(b.n);
  $('#bTx').textContent = fmt(b.tx);
  $('#bBlobs').textContent = b.blobs;
  $('#bGas').textContent = Math.round(b.gasPct) + '%';
  $('#bSlot').textContent = ((b.slot % 32) + 1) + '/32';
  const d = new Date(b.ts * 1000);
  $('#bClock').textContent = d.toISOString().slice(11, 19) + ' UTC';
  const cargo = (b.posters || []).slice(0, 4).map((p) => `<span class="sw" style="background:${containerColor(p[0])}"></span>${nameOf(p[0])} ${p[1]}`).join(' · ');
  $('#bCargo').innerHTML = `<em>FREIGHT</em>${b.blobs ? cargo + ((b.posters || []).length > 4 ? ' · …' : '') : 'No blobs this block'}`;
  if (ST.stop === 1) refreshStationNow();
}
function updateSupply() {
  const slots = ST.T / 12;
  const s = ST.supply0 + ST.issuePerSlot * slots - ST.cumBurn;
  const txt = fmt(s, 2);
  $('#bSupply').textContent = txt;
  if (supplyScreen && supplyScreen.last !== txt) {
    supplyScreen.last = txt;
    const c = supplyScreen.canvas, g = c.getContext('2d');
    g.fillStyle = '#0d1120'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#ffc55c'; g.font = `900 132px ${'"Doto",monospace'}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(fmt(s, 0), c.width / 2, c.height / 2 + 6);
    supplyScreen.tex.needsUpdate = true;
  }
  const bm = ST.bitmineRate * Math.max(0, ST.T);
  const el = document.getElementById('bmLive'); if (el) el.textContent = bm.toFixed(3);
  if (bitmineScreen && Math.floor(ST.T * 2) !== bitmineScreen.last) {
    bitmineScreen.last = Math.floor(ST.T * 2);
    const c = bitmineScreen.canvas, g = c.getContext('2d');
    g.fillStyle = '#0b0e14'; g.fillRect(0, 0, 512, 256);
    g.fillStyle = '#8f7a4a'; g.font = `700 30px ${UI}`; g.textAlign = 'center';
    g.fillText('EST. STAKING REWARDS', 256, 52); g.fillText('SINCE YOU ARRIVED', 256, 88);
    g.fillStyle = '#ffd27a'; g.font = `900 92px "Doto",monospace`; g.fillText('+' + bm.toFixed(3), 256, 170);
    g.fillStyle = '#c9a45a'; g.font = `700 30px ${UI}`; g.fillText('ETH  ·  ≈1 IN ' + Math.round(1 / D.bitmine.stakeShare) + ' BLOCKS', 256, 228);
    bitmineScreen.tex.needsUpdate = true;
  }
}

/* =====================================================================
   CARDS: every place says what it is, what the town shows,
   and where each number comes from
   ===================================================================== */
const card = $('#card');
const SPARKS = new Map(); let sparkId = 0;
function pct(v, d = 1) { return (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(d) + '%'; }
function delta(v, good = 'up', label = '') {
  if (v === null || v === undefined || !isFinite(v)) return '';
  const up = v >= 0, isGood = good === 'up' ? up : !up;
  const arrow = up ? '<svg width="9" height="9" viewBox="0 0 9 9" aria-hidden="true"><path d="M4.5 1 8 6H1z" fill="currentColor"/></svg>' : '<svg width="9" height="9" viewBox="0 0 9 9" aria-hidden="true"><path d="M4.5 8 1 3h7z" fill="currentColor"/></svg>';
  return `<span class="${isGood ? 'up' : 'down'}">${arrow} ${pct(v)}</span>${label ? ' ' + label : ''}`;
}
function stat(l, v, d = '', wide = false) { return `<div class="stat${wide ? ' wide' : ''}"><div class="l">${l}</div><div class="v">${v}</div>${d ? `<div class="d">${d}</div>` : ''}</div>`; }
function spark(values, opts = {}) {
  const id = 'sp' + (++sparkId); SPARKS.set(id, { values, ...opts });
  const w = 300, h = opts.h || 56, pad = 4;
  const max = Math.max(...values), min = opts.zero ? 0 : Math.min(...values);
  const span = max - min || 1;
  const X = (i) => pad + (i / (values.length - 1)) * (w - pad * 2);
  const Y = (v) => pad + (1 - (v - min) / span) * (h - pad * 2);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join('');
  const area = `${d}L${X(values.length - 1).toFixed(1)},${h - pad}L${X(0).toFixed(1)},${h - pad}Z`;
  const lx = X(values.length - 1), ly = Y(values[values.length - 1]);
  return `<div class="spark" data-spark="${id}"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${opts.aria || ''}">
    <line x1="${pad}" x2="${w - pad}" y1="${h - pad}" y2="${h - pad}" stroke="var(--line)" stroke-width="1"/>
    <path d="${area}" fill="${opts.color || 'var(--accent)'}" opacity=".1"/>
    <path d="${d}" fill="none" stroke="${opts.color || 'var(--accent)'}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <line class="xh" x1="0" x2="0" y1="${pad}" y2="${h - pad}" stroke="var(--ink-3)" stroke-width="1" opacity="0"/>
    ${opts.marker !== undefined ? `<circle class="mk" cx="${X(opts.marker).toFixed(1)}" cy="${Y(values[opts.marker]).toFixed(1)}" r="4" fill="var(--gold)" stroke="var(--panel-solid)" stroke-width="2"/>` : ''}
    <circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="4" fill="${opts.color || 'var(--accent)'}" stroke="var(--panel-solid)" stroke-width="2"/>
    <circle class="hv" cx="0" cy="0" r="4" fill="${opts.color || 'var(--accent)'}" stroke="var(--panel-solid)" stroke-width="2" opacity="0"/>
  </svg><div class="cap"><span>${opts.left || ''}</span><span>${opts.right || ''}</span></div></div>`;
}
function bindSparks() {
  const tip = $('#tip');
  card.querySelectorAll('.spark').forEach((el) => {
    const S = SPARKS.get(el.dataset.spark); if (!S) return;
    const svg = el.querySelector('svg'), xh = svg.querySelector('.xh'), hv = svg.querySelector('.hv');
    const w = 300, h = S.h || 56, pad = 4, vals = S.values, max = Math.max(...vals), min = S.zero ? 0 : Math.min(...vals), span = max - min || 1;
    const move = (ev) => {
      const r = svg.getBoundingClientRect();
      const i = clamp(Math.round(((ev.clientX - r.left) / r.width * w - pad) / (w - pad * 2) * (vals.length - 1)), 0, vals.length - 1);
      const x = pad + (i / (vals.length - 1)) * (w - pad * 2), y = pad + (1 - (vals[i] - min) / span) * (h - pad * 2);
      xh.setAttribute('x1', x); xh.setAttribute('x2', x); xh.setAttribute('opacity', '.5');
      hv.setAttribute('cx', x); hv.setAttribute('cy', y); hv.setAttribute('opacity', '1');
      tip.hidden = false; tip.innerHTML = `<b>${S.fmt ? S.fmt(vals[i]) : fmt(vals[i])}</b> ${S.labelAt ? S.labelAt(i) : ''}`;
      const app = $('#app').getBoundingClientRect();
      tip.style.left = Math.min(app.width - tip.offsetWidth - 8, ev.clientX - app.left + 12) + 'px';
      tip.style.top = (ev.clientY - app.top - 34) + 'px';
    };
    const leave = () => { xh.setAttribute('opacity', '0'); hv.setAttribute('opacity', '0'); tip.hidden = true; };
    svg.addEventListener('pointermove', move); svg.addEventListener('pointerleave', leave);
  });
}
const FLAG_ICON = '<svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true"><path d="M2 10.5V1" stroke="currentColor" stroke-width="1.4"/><path d="M2.6 1.2h6.6L7.6 3.3l1.6 2.1H2.6z" fill="currentColor"/></svg>';
const DISH_ICON = '<svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true"><path d="M1.5 4.5a5 5 0 0 0 5 5z" fill="currentColor"/><path d="M4 7 8 3M8 3l1.5-1.5" stroke="currentColor" stroke-width="1.3"/></svg>';
const TRUCK_ICON = '<svg width="13" height="11" viewBox="0 0 13 11" aria-hidden="true"><rect x=".5" y="2" width="8" height="6" rx="1" fill="currentColor"/><rect x="8.5" y="4" width="4" height="4" rx="1" fill="currentColor" opacity=".6"/></svg>';
const EXT_ICON = '<svg class="ext" width="9" height="9" viewBox="0 0 10 10" aria-hidden="true"><path d="M3.8 1.6h4.6v4.6M8.2 1.8 1.8 8.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function ext(url, label) { return `<a href="${url}" target="_blank" rel="noopener">${label}${EXT_ICON}</a>`; }
function head(eyebrow, title, sub, sw) {
  return `<div class="card-head"><div class="eyebrow">${sw ? `<span class="sw" style="background:${sw}"></span>` : ''}${eyebrow}</div><h2>${title}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}</div>`;
}
function block(title, html, cls = '') { return `<div class="block${cls ? ' ' + cls : ''}"><h3>${title}</h3>${html}</div>`; }
function paras(...ps) { return ps.filter(Boolean).map((p) => `<p class="note">${p}</p>`).join(''); }
function seeList(items, title = 'What you’re seeing') { return block(title, `<ul class="see">${items.filter(Boolean).map((t) => `<li>${t}</li>`).join('')}</ul>`); }
function sourceList(items, foot = '') {
  return block('Sources &amp; further reading', `<ul class="links">${items.filter(Boolean).map(([label, url, what]) => `<li>${ext(url, label)}${what ? `<span>${what}</span>` : ''}</li>`).join('')}</ul>${foot ? `<p class="foot">${foot}</p>` : ''}`, 'srcs');
}
function hoursLabel(days) { const h = Math.max(1, Math.round(days * 24)); return h === 1 ? 'hour' : h + ' hours'; }
function liveNote() { return ST.mode === 'live' ? 'Trains are arriving live from Ethereum mainnet.' : `Trains replay real blocks from ${D.replay.from}–${D.replay.to} UTC on Sep 28, 2026.`; }
function asOf() { return ST.mode === 'live' && D.liveAsOf ? `Refreshed ${D.liveAsOf}` : `Snapshot ${D.asOfLabel}`; }

/* where each number comes from, plus plain-language explainers */
const SRC = {
  etherscan: (n) => [`Block ${fmt(n)} on Etherscan`, `https://etherscan.io/block/${n}`, 'check this block yourself'],
  rpc: ['Ethereum JSON-RPC', 'https://ethereum.org/developers/docs/apis/json-rpc/', 'blocks, gas and fees, read from a public node'],
  blobscan: ['Blobscan', 'https://blobscan.com/', 'which network posted each blob'],
  l2beat: ['L2BEAT · Activity', 'https://l2beat.com/layer2s/activity', 'the L2 ranking: 7-day average activity'],
  l2beatProject: (s) => [`L2BEAT · ${s.name}`, `https://l2beat.com/layer2s/projects/${s.slug || s.key}`, 'activity, value secured, stage and risks'],
  stages: ['L2BEAT · Stages framework', 'https://l2beat.com/stages', 'what Stage 0, 1 and 2 mean'],
  vq: ['validatorqueue.com', 'https://www.validatorqueue.com/', 'stake, validators, queues and staking rate (beaconcha.in data)'],
  ethstore: ['beaconcha.in · ETH.STORE', 'https://beaconcha.in/ethstore', 'how the staking rate is measured'],
  usm: ['ultrasound.money', 'https://ultrasound.money/', 'supply, issuance and burn'],
  llama: ['DefiLlama · Stablecoins', 'https://defillama.com/stablecoins/Ethereum', 'stablecoins on Ethereum'],
  eoL2: ['ethereum.org · Layer 2', 'https://ethereum.org/layer-2/', 'what L2s are and how they scale Ethereum'],
  eoBlocks: ['ethereum.org · Blocks', 'https://ethereum.org/developers/docs/blocks/', 'how blocks are proposed'],
  eoDank: ['ethereum.org · Danksharding', 'https://ethereum.org/roadmap/danksharding/', 'why blobs exist'],
  eoPos: ['ethereum.org · Proof of stake', 'https://ethereum.org/developers/docs/consensus-mechanisms/pos/', 'validators, attestations and slashing'],
  eoStaking: ['ethereum.org · Staking', 'https://ethereum.org/staking/', 'ways to stake ETH'],
  eoIssuance: ['ethereum.org · ETH issuance', 'https://ethereum.org/roadmap/merge/issuance/', 'where new ETH comes from'],
  eoGas: ['ethereum.org · Gas and fees', 'https://ethereum.org/developers/docs/gas/', 'base fee, priority fee and the burn'],
  eip1559: ['EIP-1559', 'https://eips.ethereum.org/EIPS/eip-1559', 'the base fee and its burn'],
  eip4844: ['EIP-4844', 'https://eips.ethereum.org/EIPS/eip-4844', 'blobs'],
  eip7918: ['EIP-7918', 'https://eips.ethereum.org/EIPS/eip-7918', 'the blob fee floor'],
  eip7251: ['EIP-7251', 'https://eips.ethereum.org/EIPS/eip-7251', 'validator consolidations'],
  bm: () => [`Bitmine press release · ${D.bitmine.releaseDate}`, D.bitmine.releaseUrl, `holdings and staked ETH as of ${D.bitmine.holdingsDate}`],
  bmPrev: () => ['Bitmine press release · Sep 21, 2026', D.bitmine.prevReleaseUrl, `holdings as of ${D.bitmine.prevDate}`],
};

/* ---------- L2 background, paraphrased from each project's L2BEAT page ---------- */
const L2_ABOUT = {
  lighter: 'An app-specific ZK rollup built for trading. It runs the Lighter exchange, and zero-knowledge proofs of its results are checked on Ethereum.',
  rise: 'A low-latency chain on the OP Stack built for real-time trading through its RISEx exchange. It posts its data to EigenDA.',
  base: 'Coinbase’s L2: a general-purpose optimistic rollup built with the OP Stack.',
  robinhood: 'Robinhood’s L2, built with Arbitrum technology (Orbit) and focused on tokenized stocks, ETFs and other real-world assets. Its public mainnet opened on July 1, 2026.',
  fuel: 'Fuel Ignition runs its own virtual machine (FuelVM) and programming language (Sway) instead of Ethereum’s EVM.',
  'polygon-pos': 'A long-running proof-of-stake sidechain. Polygon’s own validators, not Ethereum, secure its bridge and keep its data.',
  megaeth: 'A “real-time” chain on the OP Stack that aims for sub-millisecond latency and over 100,000 transactions per second. It posts its data to EigenDA.',
  optimism: 'The original OP Stack chain: a general-purpose optimistic rollup built by Optimism.',
  arbitrum: 'A general-purpose optimistic rollup built by Offchain Labs and governed by the Arbitrum DAO.',
  xlayer: 'The OKX exchange’s L2, built on the OP Stack and connected to the Agglayer shared bridge.',
  celo: 'Launched as its own blockchain in 2020 and moved onto Ethereum as an L2 in March 2025. Built on the OP Stack, it focuses on payments and everyday use, and posts its data to EigenDA.',
  worldchain: 'The World Foundation’s L2 for the World app, built on the OP Stack. It gives priority blockspace to people verified with World ID.',
  unichain: 'Uniswap Labs’ L2 for DeFi, built on the OP Stack.',
  ink: 'Kraken’s L2: an optimistic rollup built with the OP Stack.',
};
// why L2BEAT lists a project under "Others" (from its project pages, Sep 28, 2026); shown only while it is still there
const OTHERS_WHY = {
  rise: 'fewer than five outside parties can challenge its results',
  robinhood: 'fewer than five outside parties can challenge its results',
  worldchain: 'fewer than five outside parties can challenge its results',
  xlayer: 'fewer than five outside parties can challenge its results',
  megaeth: 'fewer than five outside parties can challenge its results, and it has no data-availability bridge',
  fuel: 'it has no working proof system and no data-availability bridge',
  'polygon-pos': 'it has no working proof system',
};
const STAGE_TEXT = {
  'Stage 0': '<b>Full training wheels.</b> It has a working proof system, but its operators can still override it.',
  'Stage 1': '<b>Limited training wheels.</b> Users can exit even if the operators misbehave, and only a Security Council supermajority (at least 75%) can override the system.',
  'Stage 2': '<b>No training wheels.</b> Anyone can challenge its results, users get at least 30 days to exit before upgrades, and the council may act only on bugs proven onchain.',
};
const DA_TEXT = {
  blobs: 'Posts its data to Ethereum as blobs, so anyone can rebuild its state from mainnet.',
  eigenda: 'Posts its data to EigenDA, an external data network; Ethereum receives only commitments to it.',
  own: 'Relies on its own validator network for data and posts periodic checkpoints to Ethereum.',
};
function stackFamily(s) { const t = s.stack || ''; return /OP Stack/.test(t) ? 'OP Stack' : /Arbitrum|Orbit/.test(t) ? 'Arbitrum stack' : null; }

/* ---------- overview ---------- */
function overviewCard() {
  const a = D.l2agg, s = D.staking, sp = D.supply, st = D.stables, l1 = D.l1;
  const nBlob = SHOPS.filter((x) => x.da === 'blobs').length, nOff = SHOPS.length - nBlob;
  const lighter = D.l2.find((x) => x.key === 'lighter');
  const caveat = !!(lighter && a.uopsYearAgo) && Date.now() < Date.UTC(2026, 9, 9); // until the year-ago week includes Lighter
  const exL = caveat ? (a.uops - (a.lighterUops || lighter.uops)) / a.uopsYearAgo : 0;
  const top = [...D.l2].sort((x, y) => y.uops - x.uops)[0];
  const two = D.blobShares.filter((x) => x.key !== 'other').slice(0, 2);
  const blobWin = D.blobLive ? `in the last ${hoursLabel(D.l1.blobSourceDays)}` : 'in the 24 hours to Sep 28';
  const oneIn = Math.round(1 / D.bitmine.stakeShare);
  const map = [
    ['station', '#4453d0', 'Mainnet Station', 'Ethereum’s base layer (L1). A train leaves every 12 seconds, and each one is a real block.'],
    ['l2', 'conic-gradient(#0052ff 0 25%, #ff0420 0 50%, #c6f500 0 75%, #f50db4 0)', `The ${SHOPS.length} shops`, `The busiest L2 networks by activity on L2BEAT. Taller means more value secured; a bigger crowd means more activity.`],
    [null, '#c7ad86', 'Trucks and couriers', `${nBlob} of the ${SHOPS.length} post their data to Ethereum as blobs and send trucks to the station. The other ${nOff} keep their data elsewhere and send couriers.`],
    ['vault', '#bcd0ff', 'Beacon Vault', 'Staking: validators lock ETH here to secure the chain. The people lined up outside are ETH waiting to be staked; gold sparks are rewards.'],
    ['burn', '#ff7a3d', 'The Burn', 'Where fees are burned. The tower next door keeps a running count of all ETH in existence.'],
    ['bitmine', '#e4b34f', 'Bitmine', `A public company that stakes about 1 in ${oneIn} of all staked ETH. A gold pipe links it to the vault, where that stake sits.`],
  ];
  const facts = [
    `<b>${top.name}</b> accounts for about ${Math.round(top.uops / a.uops * 100)}% of all L2 activity that L2BEAT tracks.`,
    two.length === 2 ? `<b>${two[0].name} and ${two[1].name}</b> posted ${Math.round((two[0].share + two[1].share) * 100)}% of all blob data ${blobWin}.` : '',
    `<b>Blob space</b> is running at about ${Math.round(l1.blobsPerBlock / l1.blobTarget * 100)}% of its target, so L2s pay close to the minimum for data.`,
    `<b>${compact(s.entryQ, 2)} ETH</b> is waiting to start staking, about a ${Math.round(s.entryWait)}-day wait.`,
    `<b>${fmt(sp.issuedPerDay, 0)} ETH</b> is issued and <b>${fmt(sp.burnedPerDay, 0)} ETH</b> burned a day (7-day average), so supply grows about ${sp.growthPct.toFixed(2)}% a year.`,
    `<b>$${(st.eth / 1e9).toFixed(0)}B</b> in stablecoins sits on Ethereum mainnet, ${Math.round(st.share * 100)}% of all stablecoins.`,
  ];
  return head('Welcome to', 'Ethereum Town', `A living miniature of the Ethereum network, built from real data. ${liveNote()} Click any building to see what it is and where its numbers come from.`)
    + `<div class="stats">${stat('L1 transactions a day', compact(l1.txPerDay, 2), delta(l1.txPerDay / l1.txPerDayYearAgo - 1, 'up', 'vs last year'))}
      ${stat('L2 activity', fmt(a.uops) + '<small>ops/s</small>', `${(a.uops / a.uopsYearAgo).toFixed(1)}× a year ago${caveat ? '*' : ''}`)}
      ${stat('ETH staked', s.pct.toFixed(1) + '%', '≈' + compact(s.staked, 1) + ' ETH')}
      ${stat('Supply growth', '+' + sp.growthPct.toFixed(2) + '%<small>/yr</small>', 'Issuance outpaces the burn')}</div>`
    + (caveat ? `<p class="foot">* About ${exL.toFixed(1)}× without Lighter, which L2BEAT has only counted since ${a.lighterSince || 'Oct 2, 2025'}.</p>` : '')
    + block('Map of the town', `<ul class="maplist">${map.map(([go, c, name, text]) => go
      ? `<li><button type="button" data-go="${go}"><i style="background:${c}"></i><span><b>${name}</b> ${text}</span></button></li>`
      : `<li><div><i style="background:${c}"></i><span><b>${name}</b> ${text}</span></div></li>`).join('')}</ul>`)
    + seeList(facts, 'Notable today')
    + `<div class="btnrow"><button class="btn primary" data-act="tour">Start the tour</button><button class="btn" data-act="about">About the data</button></div>`
    + sourceList([SRC.l2beat, SRC.blobscan, SRC.vq, SRC.usm, SRC.llama, SRC.rpc], asOf() + '.');
}

/* ---------- Mainnet Station ---------- */
function stationNowHTML() {
  const b = boardBlock; if (!b) return '<div class="block" id="stationNow" hidden></div>'; // filled when the first train arrives
  return `<div class="block" id="stationNow"><h3>Now boarding</h3><div class="stats">
    ${stat('Block', fmt(b.n), new Date(b.ts * 1000).toISOString().slice(11, 19) + ' UTC')}
    ${stat('Transactions', fmt(b.tx), Math.round(b.gasPct) + '% of the gas limit')}
    ${stat('Blobs aboard', b.blobs + '<small>of ' + D.l1.blobMax + ' max</small>', (b.posters || []).slice(0, 2).map((p) => nameOf(p[0]) + ' ' + p[1]).join(' · ') || 'None this block')}
    ${stat('Burned by this block', b.burn.toFixed(4) + '<small>ETH</small>', b.baseFee.toFixed(3) + ' gwei base fee')}</div>
    <p class="foot">${ext(`https://etherscan.io/block/${b.n}`, `Look up block ${fmt(b.n)} on Etherscan`)}</p></div>`;
}
function refreshStationNow() { const el = document.getElementById('stationNow'); if (el) el.outerHTML = stationNowHTML(); }
function stationCard() {
  const l1 = D.l1, rs = D.replay.spark;
  const idx = clamp(Math.floor((((Math.floor(ST.T / 12) % REPLAY.length) + REPLAY.length) % REPLAY.length) / D.replay.bucket), 0, rs.length - 1);
  const top = D.blobShares.slice(0, 9);
  const maxShare = Math.max(...top.map((s) => s.share));
  const gl = Math.round((l1.gasLimit || 60e6) / 1e6);
  return head('Layer 1 · Execution', 'Mainnet Station', 'Ethereum’s base layer. Every 12 seconds a validator, chosen at random in proportion to its stake, proposes a block of transactions, and tens of thousands of others vote (attest) that it is valid.', '#4453d0')
    + stationNowHTML()
    + `<div class="block"><h3>${l1.window === '24h' ? 'The last 24 hours' : 'The week to Sep 28'}</h3><div class="stats">
      ${stat('Transactions a day', compact(l1.txPerDay, 2), delta(l1.txPerDay / l1.txPerDayYearAgo - 1, 'up', 'vs last year'))}
      ${stat('Gas limit', gl + 'M', 'Was 45M a year ago · ~' + Math.round(l1.fullness * 100) + '% used')}
      ${stat('Blob freight', l1.blobsPerBlock.toFixed(1) + '<small>per block</small>', `Target ${l1.blobTarget} · max ${l1.blobMax} · ~${Math.round(l1.blobsPerBlock / l1.blobTarget * 100)}% of target`)}
      ${stat('Blob fees paid', '≈' + l1.blobFees7dEth.toFixed(2) + '<small>ETH / 7 days</small>', l1.window === '24h' ? 'At the last day’s pace' : 'L2 data is nearly free right now')}</div></div>`
    + seeList([
      '<b>Each train is one real block.</b> Its coaches light up with the block’s transaction count, and more passengers board when it carries more.',
      '<b>Each container is one blob</b>, colored by the L2 that posted it. Trucks bring them from the shops; batches from other networks arrive from out of town.',
      '<b>The departure board</b> shows the block at the platform, and the clock tower ticks once per 12-second slot.',
    ])
    + (ST.mode === 'replay' ? `<div class="block"><h3>Transactions per block, replay window</h3>${spark(rs, { marker: idx, fmt: (v) => fmt(v, 0) + ' tx/block', labelAt: () => '· 5-min avg', left: D.replay.from + ' UTC', right: D.replay.to + ' UTC', aria: 'Transactions per block across the replay window' })}</div>` : '')
    + `<div class="block"><h3>Who ships blobs · ${D.blobLive ? 'last ' + hoursLabel(l1.blobSourceDays) : '24 hours to Sep 28'}</h3><div class="bars">${top.map((s) => `<span class="n"><i style="background:${containerColor(s.key)}"></i>${s.name}</span><span class="t" style="width:${(s.share / maxShare * 100).toFixed(1)}%"></span><span class="p">${(s.share * 100).toFixed(1)}%</span>`).join('')}</div></div>`
    + block('Why it matters', paras(
      `Mainnet is where everything settles: L2s post their data and state commitments (and, for ZK rollups, proofs) here, and the base fee paid by every transaction is burned. A gas limit, now ${gl} million, caps how much work fits in each block.`,
      `<b>Blobs</b> are Ethereum’s cheap data lane for L2s, added in March 2024 (EIP-4844). The network keeps blob data for about 18 days, long enough for anyone to check an L2’s work, instead of storing it forever. Each block can carry up to ${l1.blobMax} blobs, with a target of ${l1.blobTarget}. While usage stays below the target, the blob fee sits near a floor that moves with regular gas prices (EIP-7918, from the Fusaka upgrade). Blob fees are burned too.`))
    + sourceList([SRC.rpc, SRC.blobscan, SRC.eoBlocks, SRC.eoDank, SRC.eip4844, SRC.eip7918], `Blob attribution uses Blobscan labels, matched to L2BEAT’s list of batch-poster addresses where unlabeled. ${asOf()}.`);
}

/* ---------- L2 shops ---------- */
function l2Card(shop) {
  const s = shop, stage = stageOf(s), rated = stage !== 'Not rated';
  const da = s.da === 'blobs' ? `<span class="tag">${TRUCK_ICON}Data on Ethereum</span>` : `<span class="tag warn">${DISH_ICON}Data on ${s.da === 'eigenda' ? 'EigenDA' : 'its own network'}</span>`;
  const stageTag = stage === 'Stage 1' || stage === 'Stage 2' ? `<span class="tag good">${FLAG_ICON}${stage}</span>` : `<span class="tag">${stage}</span>`;
  const sp = s.spark && s.spark.length > 3 ? spark(s.spark, { color: 'var(--accent)', fmt: (v) => fmt(v, v < 10 ? 1 : 0) + ' ops/s', labelAt: (i) => '· ' + (i === s.spark.length - 1 ? 'latest day' : (s.spark.length - 1 - i) + 'd earlier'), left: s.sparkRange ? s.sparkRange[0] : '', right: s.sparkRange ? s.sparkRange[1] : '', aria: `Daily activity for ${s.name} over 30 days` }) : '';
  const dataStat = s.da === 'blobs'
    ? stat('Data shipped to Ethereum', fmt(s.blobsPerDay) + '<small>blobs/day</small>', (s.blobShare * 100).toFixed(1) + '% of all blob data')
    : stat('Data shipped to Ethereum', 'None', 'Only commitments reach mainnet');
  const fam = stackFamily(s);
  const sibs = fam ? SHOPS.filter((x) => x !== s && stackFamily(x) === fam).sort((x, y) => x.rank - y.rank) : [];
  const why = !rated && s.category === 'Other' ? OTHERS_WHY[s.key] : null;
  const stageText = rated ? STAGE_TEXT[stage] || ''
    : `<b>Not rated.</b> L2BEAT lists it under “Others”, its group for L2s that lack a working proof system or enough data-availability guarantees, so it gets no stage.${why ? ' Its L2BEAT page notes that ' + why + '.' : ''}`;
  const about = L2_ABOUT[s.key] || `${s.category}${s.stack && s.stack !== 'Independent' ? ' built on ' + s.stack : ''}.`;
  return head(`L2 · #${s.rank} by activity`, s.name, about, s.brand.id)
    + `<div class="tags">${stageTag}${da}</div>`
    + `<div class="stats">${stat('Activity, 7-day avg', fmt(s.uops, s.uops < 10 ? 1 : 0) + '<small>ops/s</small>', delta(s.wow, 'up', 'vs prior week'))}
      ${stat('Value secured', usd(s.tvs), delta(s.tvs7d, 'up', 'in 7 days'))}
      ${stat('Transactions a day', compact(s.txPerDay, 1))}
      ${dataStat}</div>`
    + seeList([
      '<b>Crowd and height:</b> the crowd at its door grows with the square root of its activity, and the building with the square root of value secured.',
      s.da === 'blobs' ? '<b>Trucks</b> in its colors carry its real blob batches to the station, block by block.' : '<b>Couriers</b> leave its door instead of trucks, because its data doesn’t go to Ethereum. Their timing is illustrative; the dish on the roof marks the same thing.',
      stage === 'Stage 1' || stage === 'Stage 2' ? '<b>The green flag</b> on the roof marks Stage 1 or higher on L2BEAT.' : '',
      sibs.length ? `<b>Same code base:</b> ${sibs.length === 1 ? 'one other shop here runs' : sibs.length + ' other shops here run'} the ${fam} too: ${sibs.map((x) => x.name).join(', ')}.` : '',
    ])
    + (sp ? `<div class="block"><h3>Daily activity, last 30 days</h3>${sp}</div>` : '')
    + block('How it’s secured', paras(stageText, `<b>Data.</b> ${DA_TEXT[s.da] || ''}`, 'Stages measure how much a chain still depends on its operators, not how safe it is overall.'))
    + block('What’s an L2?', paras(
      'An L2 runs its own network and settles to Ethereum: it batches many transactions, then posts its data (or a commitment to it) and a proof or claim about the result to mainnet. That lets it handle far more activity at lower cost, while leaning on Ethereum for security to a degree that depends on its design.',
      '<b>Activity</b> is L2BEAT’s user operations per second (UOPS). <b>Value secured</b> counts the assets held on the L2: bridged from Ethereum, bridged via third-party bridges, and minted natively.'))
    + sourceList([SRC.l2beatProject(s), s.da === 'blobs' ? SRC.blobscan : null, SRC.stages, SRC.eoL2],
      `Activity and value secured are 7-day averages${ST.mode === 'live' ? '' : ' to Sep 27'}; blob counts cover ${D.blobLive ? 'the last ' + hoursLabel(D.l1.blobSourceDays) : 'the 24 hours to Sep 28'}. Colors nod to each network’s brand.`);
}

/* ---------- Beacon Vault ---------- */
function vaultCard() {
  const s = D.staking, hist = s.hist, sp = D.supply;
  const issueShare = clamp(Math.floor((sp.issuedPerDay * 365) / s.staked / (s.apr / 100) * 100) / 100, 0, 1);
  const oneIn = Math.round(1 / D.bitmine.stakeShare);
  const capped = s.entryQ / 20000 > 96 || s.exitQ / 20000 > 16;
  const xn = s.exitNote;
  return head('Consensus layer · Staking', 'Beacon Vault', 'Proof of stake: validators lock ETH as collateral to propose and attest to blocks. They earn rewards for doing it honestly and can lose part of their stake (slashing) for provable misbehavior.', '#bcd0ff')
    + `<div class="stats">${stat('ETH staked', '≈' + compact(s.staked, 1), s.pct.toFixed(1) + '% of all ETH')}
      ${stat('Active validators', fmt(s.validators))}
      ${stat('Waiting to stake', compact(s.entryQ, 2) + '<small>ETH</small>', '≈' + s.entryWait.toFixed(1) + '-day wait')}
      ${stat('Waiting to exit', compact(s.exitQ, 0) + '<small>ETH</small>', '≈' + s.exitWait.toFixed(1) + '-day wait')}
      ${stat('Staking rate', s.apr.toFixed(2) + '%<small>a year</small>', `≈${Math.round(issueShare * 100)}% of it is newly issued ETH`, true)}</div>`
    + seeList([
      `<b>The people lined up outside</b> are ETH waiting to be staked, about 20,000 ETH per figure. The front of the line walks in through the <b>IN</b> door and newcomers join the back; the line’s length is real, the pace is sped up (the real line moves about one figure every ${Math.round(20000 / s.churn * 6.4 / 60)} hours).${capped ? ' The lines stop growing at 96 and 9 figures.' : ''}`,
      '<b>The short row by the OUT door</b> is the exit queue: figures come out of the vault and head for the street.',
      `<b>Gold sparks leaving the vault</b> are staking rewards, with a burst every epoch (6.4 minutes). About 1 in ${oneIn} flow through the gold pipe to Bitmine, whose staked ETH sits in here too; the rest go to the homes on the hill, standing in for every other staker.`,
    ])
    + `<div class="block"><h3>Entry queue, last 90 days (ETH)</h3>${spark(hist.map((r) => r[1]), { zero: true, fmt: (v) => compact(v, 2) + ' ETH', labelAt: (i) => '· ' + hist[i][0], left: hist[0][0], right: hist[hist.length - 1][0], aria: 'Entry queue over 90 days' })}</div>`
    + `<div class="block"><h3>Exit queue, last 90 days (ETH)</h3>${spark(hist.map((r) => r[2]), { zero: true, fmt: (v) => compact(v, 1) + ' ETH', labelAt: (i) => '· ' + hist[i][0], left: hist[0][0], right: hist[hist.length - 1][0], aria: 'Exit queue over 90 days' })}</div>`
    + block('Why there are lines', paras(
      `The protocol limits how fast ETH can join or leave staking: up to ${s.churn} ETH per 6.4-minute epoch in each direction, so surges wait in line. A long entry queue means more ETH wants to be staked than the protocol lets in at once.`,
      xn ? `<b>About the exit line:</b> on ${xn.date}, about ${Math.round(xn.consolidationShare * 100)}% of it was validators merging into bigger ones (consolidations, EIP-7251). That ETH stays staked; only about ${fmt(xn.unstakingEth)} ETH was actually leaving staking.` : '',
      `<b>The staking rate</b> comes from beaconcha.in’s ETH.STORE index. About ${Math.round(issueShare * 100)}% of it is newly issued ETH and the rest is priority fees; MEV payments aren’t counted, so all-in returns run slightly higher.`))
    + sourceList([SRC.vq, SRC.ethstore, SRC.eoPos, SRC.eoStaking, SRC.eip7251], asOf() + '.');
}

/* ---------- Bitmine ---------- */
function bitmineCard() {
  const b = D.bitmine, share = b.stakeShare, perDay = ST.bitmineRate * 86400;
  const added = b.holdings - b.prevHoldings;
  return head('ETH treasury company · Staking', 'Bitmine Staking &amp; Rewards', 'Bitmine Immersion Technologies (NYSE: BMNR) is a public company that holds ETH as its main treasury asset and stakes most of it, so its validators propose blocks and earn rewards like any other staker.', '#e4b34f')
    + `<div class="stats">${stat('ETH held', compact(b.holdings, 2), (b.supplyShare * 100).toFixed(1) + '% of all ETH · as of ' + b.holdingsDate)}
      ${stat('ETH staked', compact(b.staked, 2), (share * 100).toFixed(1) + '% of all staked ETH')}
      ${stat('Share of block proposals', '≈1 in ' + Math.round(1 / share), '≈' + fmt(Math.round(7200 * share / 10) * 10) + ' blocks a day (estimate)')}
      ${stat('Staking rewards', '≈' + fmt(perDay, 0) + '<small>ETH/day</small>', 'At the ' + D.staking.apr.toFixed(2) + '% network rate (estimate)')}
      ${stat('Added in the latest week', (added >= 0 ? '+' : '−') + fmt(Math.abs(added)) + '<small>ETH</small>', b.prevDate.replace(', 2026', '') + ' → ' + b.holdingsDate, true)}</div>`
    + `<div class="block"><h3>Since you opened this page</h3><div class="stat"><div class="v"><span id="bmLive" class="live-counter">0.000</span><small>ETH in estimated rewards</small></div></div></div>`
    + seeList([
      `<b>The tower is Bitmine’s treasury:</b> the ${compact(b.holdings, 2)} ETH it holds. <b>The gold pipe</b> runs to the Beacon Vault, because the ${compact(b.staked, 2)} ETH it stakes sits there alongside everyone else’s.`,
      `<b>Rewards flow back through the pipe:</b> about 1 in ${Math.round(1 / share)} of the gold sparks leaving the vault. The screen counts its estimated rewards since you opened the page.`,
      '<b>Despite the name, nothing is mined here.</b> Ethereum replaced mining with staking in 2022, so new ETH now comes from staking rewards.',
    ])
    + block('How the estimates work', paras(
      `Validators are picked to propose blocks at random in proportion to their stake, so a staker with ${(share * 100).toFixed(1)}% of staked ETH should propose about that share of blocks over time. Estimated rewards are its staked ETH times the network’s average staking rate; actual results depend on validator performance, MEV and fees.`,
      `Bitmine says it stakes through MAVAN (its “Made in America Validator Network”) and staking partners, buys ETH every week, and aims to hold 5% of all ETH. In its ${b.releaseDate} release it projected about $${Math.round(b.statedAnnualStakingUsd / 1e6)}M a year in staking revenue.`))
    + sourceList([SRC.bm(), SRC.bmPrev(), SRC.vq, SRC.eoStaking], 'Company figures are self-reported in weekly press releases. Proposal share and rewards are estimates. Nothing here is investment advice.');
}

/* ---------- The Burn ---------- */
function burnCard() {
  const s = D.supply, off = s.burnedPerDay / s.issuedPerDay;
  return head('Monetary policy', 'The Burn &amp; Supply Tower', 'Since the London upgrade (August 2021, EIP-1559), every transaction pays a base fee that is burned, permanently removing that ETH. New ETH is issued to validators as staking rewards.', '#ff7a3d')
    + `<div class="stats">${stat('ETH supply', compact(s.supply, 2), '+' + s.growthPct.toFixed(2) + '% a year at the 7-day pace')}
      ${stat('Issued a day', '≈' + fmt(s.issuedPerDay, 0) + '<small>ETH</small>', 'Paid to validators')}
      ${stat('Burned a day', '≈' + fmt(s.burnedPerDay, 0) + '<small>ETH</small>', '7-day average')}
      ${stat('Burned since EIP-1559', compact(s.burnedSince1559, 2) + '<small>ETH</small>', 'Since Aug 5, 2021')}</div>`
    + seeList([
      '<b>The furnace</b> flares with each block’s burned base fee, and a tag shows the amount.',
      '<b>The supply tower</b> starts from the latest supply figure, adds new issuance every 12-second slot and subtracts each block’s burn. The departure board shows the same count.',
    ])
    + `<div class="block"><h3>Issued vs. burned, ETH per day</h3><div class="bars">
      <span class="n">Issued</span><span class="t" style="width:100%"></span><span class="p">${fmt(s.issuedPerDay, 0)}</span>
      <span class="n">Burned</span><span class="t" style="width:${Math.max(0.6, off * 100).toFixed(1)}%"></span><span class="p">${fmt(s.burnedPerDay, 0)}</span></div>
      <p class="note">At the 7-day pace, the burn offsets about ${Math.max(1, Math.round(off * 100))}% of new issuance.</p></div>`
    + block('Why it matters', paras(
      'Supply grows when issuance outpaces the burn, and shrinks when busy blocks push base fees, and the burn, above it. Issuance rises with the amount of ETH staked.',
      'Blob fees are burned too, but at today’s blob prices they add almost nothing.'))
    + sourceList([SRC.usm, SRC.eip1559, SRC.eoGas, SRC.eoIssuance], asOf() + '.');
}

function renderCard() {
  SPARKS.clear();
  const s = STOPS[ST.stop];
  let html;
  if (s.type === 'overview') html = overviewCard();
  else if (s.type === 'station') html = stationCard();
  else if (s.type === 'l2') html = l2Card(s.shop);
  else if (s.type === 'vault') html = vaultCard();
  else if (s.type === 'bitmine') html = bitmineCard();
  else html = burnCard();
  card.innerHTML = html;
  card.scrollTop = 0;
  bindSparks();
  card.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.act === 'tour') setTour(true);
    else if (b.dataset.act === 'about') { $('#about').hidden = false; $('#aboutClose').focus(); }
  }));
  card.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => {
    const i = STOPS.findIndex((x) => x.type === b.dataset.go); if (i >= 0) { setTour(false); selectStop(i); }
  }));
  if (SMALL) card.classList.add('collapsed');
  layoutMobile();
}

/* =====================================================================
   STOPS & CAMERA
   ===================================================================== */
function buildStops() {
  STOPS.length = 0;
  STOPS.push({ type: 'overview', name: 'Ethereum Town', view: { t: [26.5, 0, 16.2], d: SMALL ? 112 : 80, p: 0.88, a: 0.66 } });
  STOPS.push({ type: 'station', name: 'Mainnet Station', short: 'Mainnet Station', group: CIVIC.station, anchor: [28, 8.4, 22.8], view: { t: [28.4, 1.2, 23.6], d: 27, p: 0.98, a: 0.52 } });
  for (const s of [...SHOPS].sort((a, b) => a.rank - b.rank)) {
    const behindStation = s.row === 1 && s.cx > 20.5 && s.cx < 35;
    STOPS.push({ type: 'l2', name: s.name, shop: s, group: s.grp, anchor: [s.cx, s.h + 1.05, s.cy], view: { t: [s.cx, Math.min(2.6, s.h * 0.4), s.y1 + 0.3], d: 12.5 + s.h * 1.45, p: s.row === 2 ? 0.8 : 0.92, a: behindStation ? (s.cx > 27.5 ? 1.05 : -0.75) : 0.55 } });
  }
  STOPS.push({ type: 'vault', name: 'Beacon Vault', short: 'Beacon Vault', group: CIVIC.vault, anchor: [44, 4.9, 14], view: { t: [42.4, 1.5, 15.7], d: 24, p: 0.86, a: -0.45 } });
  STOPS.push({ type: 'bitmine', name: 'Bitmine Staking & Rewards', short: 'Bitmine', group: CIVIC.bitmine, anchor: [34.5, 7.9, 16], view: { t: [37.2, 2.8, 15.6], d: 22, p: 0.93, a: 0.55 } });
  STOPS.push({ type: 'burn', name: 'The Burn', short: 'The Burn · Supply', group: CIVIC.burn, anchor: [45.2, 9.6, 22.8], view: { t: [43.3, 2.8, 23.0], d: 22, p: 0.98, a: 0.62 } });
}
let fly = null;
const _sph = new THREE.Spherical();
function flyTo(v, instant = false) {
  const fromT = controls.target.clone();
  _sph.setFromVector3(camera.position.clone().sub(controls.target));
  const from = { r: _sph.radius, p: _sph.phi, a: _sph.theta };
  let a1 = v.a; while (a1 - from.a > Math.PI) a1 -= 2 * Math.PI; while (from.a - a1 > Math.PI) a1 += 2 * Math.PI;
  fly = { fromT, toT: new THREE.Vector3(...v.t), from, to: { r: v.d, p: v.p, a: a1 }, t: 0, dur: instant || RM ? 0.001 : 1.6 };
}
function updateFly(dtR) {
  if (!fly) return;
  fly.t += dtR; const u = smooth(fly.t / fly.dur), e = u * u * (3 - 2 * u);
  controls.target.lerpVectors(fly.fromT, fly.toT, e);
  _sph.set(lerp(fly.from.r, fly.to.r, e), lerp(fly.from.p, fly.to.p, e), lerp(fly.from.a, fly.to.a, e));
  camera.position.setFromSpherical(_sph).add(controls.target);
  if (fly.t >= fly.dur) fly = null;
}
controls.addEventListener('start', () => { fly = null; if (ST.tour) setTour(false); });
const _ray = new THREE.Ray(), _dir = new THREE.Vector3(), _hit = new THREE.Vector3(), _fp = new THREE.Vector3(), _side = new THREE.Vector3();
function updateOcclusion(dtR) {
  const s = STOPS[ST.stop];
  const active = s && s.type !== 'overview';
  const C = camera.position, F = controls.target;
  const dist = C.distanceTo(F);
  _side.set(F.z - C.z, 0, C.x - F.x).normalize();
  for (const g of GROUPS) {
    let target = 1;
    if (active && dist < 70 && g !== s.group) {
      for (const off of [0, 1.2, -1.2]) {
        _fp.copy(F).addScaledVector(_side, off); _dir.copy(_fp).sub(C); const L = _dir.length(); _dir.divideScalar(L);
        _ray.set(C, _dir);
        if (_ray.intersectBox(g.box, _hit) && C.distanceTo(_hit) < L - 1.0) { target = 0.14; break; }
      }
    }
    setGroupFade(g, g.fade + (target - g.fade) * Math.min(1, dtR * 7));
  }
}
const ring = new THREE.Mesh(new THREE.RingGeometry(0.965, 1, 72), new THREE.MeshBasicMaterial({ color: '#8a96ff', transparent: true, opacity: 0.5, depthWrite: false }));
ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; ring.visible = false; scene.add(ring);
function selectStop(i, fromTour = false) {
  const n = STOPS.length; i = ((i % n) + n) % n;
  ST.stop = i;
  const s = STOPS[i];
  $('#stopIdx').textContent = s.type === 'overview' ? 'Overview' : `Stop ${i} of ${n - 1}`;
  $('#stopName').textContent = s.name;
  flyTo(s.view);
  renderCard();
  ring.visible = s.type !== 'overview'; ring.userData.t = 0;
  if (ring.visible) {
    const sh = s.shop; let cx, cy, r;
    if (sh) { cx = sh.cx; cy = sh.cy; r = 2.35; }
    else if (s.type === 'station') { cx = 28; cy = 23; r = 6.6; }
    else if (s.type === 'vault') { cx = 44; cy = 14.6; r = 5.2; }
    else if (s.type === 'bitmine') { cx = 34.5; cy = 16; r = 2.3; }
    else { cx = 43.1; cy = 22.8; r = 3.9; }
    ring.position.set(cx, 0.08, cy); ring.scale.setScalar(r);
  }
  if (!fromTour) ST.tourT = 0;
}
function setTour(on) {
  ST.tour = on; ST.tourT = 0; $('#tour').setAttribute('aria-pressed', String(on));
  if (on) selectStop(ST.stop + 1, true);
}

/* =====================================================================
   INPUT
   ===================================================================== */
const ray = new THREE.Raycaster(), _nd = new THREE.Vector2();
let downAt = null;
function pickAt(cx, cy) {
  const r = canvas.getBoundingClientRect();
  _nd.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(_nd, camera);
  const hit = ray.intersectObjects(PICK, false)[0];
  return hit ? hit.object.userData.stop : null;
}
function stopIndexFor(p) { return STOPS.findIndex((s) => (p.type === 'l2' ? s.shop === p.shop : s.type === p.type)); }
canvas.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; canvas.classList.add('dragging'); });
window.addEventListener('pointerup', (e) => {
  canvas.classList.remove('dragging');
  if (!downAt) return; const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]); downAt = null;
  if (moved < 6 && e.target === canvas) { const p = pickAt(e.clientX, e.clientY); if (p) { const i = stopIndexFor(p); if (i >= 0) selectStop(i); } }
});
let hoverT = 0;
canvas.addEventListener('pointermove', (e) => {
  if (downAt || performance.now() - hoverT < 90) return; hoverT = performance.now();
  canvas.classList.toggle('hovering', !!pickAt(e.clientX, e.clientY));
});
function setSpeed(v) {
  if (v > 1 && ST.mode === 'live') { ST.mode = 'replay'; setModeUI(); toast([28, 9, 22.8], 'Fast-forward replays the Sep 28 blocks', 'blk'); }
  ST.speed = v;
  document.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.speed === v)));
}
function setPaused(p) {
  ST.paused = p;
  $('#play').setAttribute('aria-label', p ? 'Play' : 'Pause');
  $('#playIcon').innerHTML = p ? '<path d="M3 1.8v10.4L12 7z" fill="currentColor"/>' : '<rect x="2.5" y="2" width="3" height="10" rx="1" fill="currentColor"/><rect x="8.5" y="2" width="3" height="10" rx="1" fill="currentColor"/>';
}
function cycleSky() {
  const i = (SKY_ORDER.indexOf(ST.sky) + 1) % SKY_ORDER.length; ST.sky = SKY_ORDER[i];
  if (ST.sky === 'cycle') ST.hourSet = hourShown ?? 12;
  $('#skyLabel').textContent = SKY_LABEL[ST.sky]; $('#sky').setAttribute('aria-label', 'Time of day: ' + SKY_LABEL[ST.sky]);
}
function layoutMobile() {
  if (!SMALL) return;
  const dock = document.querySelector('.dock');
  const hgt = dock ? dock.offsetHeight : 90;
  card.style.bottom = `calc(${hgt + 22}px + env(safe-area-inset-bottom, 0px))`;
  card.style.maxHeight = `calc(100% - ${hgt + 150}px)`;
}
window.addEventListener('resize', () => layoutMobile());
function setUiHidden(h) {
  ST.uiHidden = h; $('#ui').hidden = h; $('#showUi').hidden = !h; labelLayer.hidden = h; toastLayer.hidden = h;
  resize();
}
function setModeUI() {
  const live = ST.mode === 'live';
  $('#modeTag').textContent = live ? 'Live' : 'Replay · Sep 28';
  $('#board').classList.toggle('is-live', live);
  $('#goLive').hidden = live || !LIVE_OK;
  $('#asof').textContent = live ? `Live from Ethereum mainnet · rankings refreshed ${D.liveAsOf || 'recently'}` : `Data snapshot · ${D.asOfLabel} · trains replay ${D.replay.from}–${D.replay.to} UTC`;
}
function bindUI() {
  $('#prev').addEventListener('click', () => { setTour(false); selectStop(ST.stop - 1); });
  $('#next').addEventListener('click', () => { setTour(false); selectStop(ST.stop + 1); });
  $('#play').addEventListener('click', () => setPaused(!ST.paused));
  document.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => setSpeed(+b.dataset.speed)));
  $('#sky').addEventListener('click', cycleSky);
  $('#tour').addEventListener('click', () => setTour(!ST.tour));
  $('#hideBtn').addEventListener('click', () => setUiHidden(true));
  $('#showUi').addEventListener('click', () => setUiHidden(false));
  $('#aboutBtn').addEventListener('click', () => { $('#about').hidden = false; $('#aboutClose').focus(); });
  $('#aboutClose').addEventListener('click', () => { $('#about').hidden = true; });
  $('#about').addEventListener('click', (e) => { if (e.target.id === 'about') $('#about').hidden = true; });
  $('#keyToggle').addEventListener('click', () => { const k = $('#key'); const min = k.classList.toggle('min'); $('#keyToggle').textContent = min ? 'Show' : 'Hide'; $('#keyToggle').setAttribute('aria-expanded', String(!min)); });
  $('#goLive').addEventListener('click', () => { goLive(); });
  card.addEventListener('click', (e) => { if (SMALL && e.target.closest('.card-head')) card.classList.toggle('collapsed'); });
  window.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input,textarea')) return;
    if (!$('#about').hidden && e.key === 'Escape') { $('#about').hidden = true; return; }
    if (e.key === 'ArrowRight') { setTour(false); selectStop(ST.stop + 1); }
    else if (e.key === 'ArrowLeft') { setTour(false); selectStop(ST.stop - 1); }
    else if (e.key === ' ') { e.preventDefault(); setPaused(!ST.paused); }
    else if (e.key === '1' || e.key === '2' || e.key === '3') setSpeed([1, 3, 10][+e.key - 1]);
    else if (e.key === 'n' || e.key === 'N') cycleSky();
    else if (e.key === 't' || e.key === 'T') setTour(!ST.tour);
    else if (e.key === 'h' || e.key === 'H') setUiHidden(!ST.uiHidden);
    else if (e.key === '?') $('#about').hidden = false;
    else if (e.key === 'Escape') { if (ST.tour) setTour(false); }
  });
}

/* =====================================================================
   LIVE DATA (served by /api on Vercel; falls back to the snapshot)
   ===================================================================== */
let LIVE_OK = false;
async function getJSON(url, ms = 4000) {
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal, cache: 'no-store' }); if (!r.ok) return null; const ct = r.headers.get('content-type') || ''; if (!ct.includes('json')) return null; return await r.json(); }
  catch (e) { return null; } finally { clearTimeout(to); }
}
function applyTown(j) {
  if (!j || !j.ok) return;
  if (Array.isArray(j.l2) && j.l2.length >= 10) {
    const old = Object.fromEntries(D.l2.map((s) => [s.key, s]));
    if (!(j.blobShares && j.blobShares.length)) for (const s of j.l2) { const o = old[s.key]; if (o) { s.blobsPerDay = o.blobsPerDay; s.blobShare = o.blobShare; } }
    D.l2 = j.l2;
  }
  if (j.staking) Object.assign(D.staking, j.staking);
  if (j.supply) Object.assign(D.supply, j.supply);
  if (j.l2agg) Object.assign(D.l2agg, j.l2agg);
  if (j.stables) Object.assign(D.stables, j.stables);
  if (j.blobShares && j.blobShares.length) { D.blobShares = j.blobShares; D.l1.blobSourceDays = j.blobWindowDays || 0.1; D.blobLive = true; }
  if (j.l1) Object.assign(D.l1, j.l1);
  if (j.price) D.price = j.price;
  if (j.names) Object.assign(D.names, j.names);
  D.bitmine.stakeShare = D.bitmine.staked / D.staking.staked;
  D.bitmine.supplyShare = D.bitmine.holdings / D.supply.supply;
  ST.bitmineRate = (D.bitmine.staked * (D.staking.apr / 100)) / (365 * 86400);
  ST.supply0 = D.supply.supply; ST.issuePerSlot = D.supply.issuedPerDay / 7200;
  D.liveAsOf = new Date(j.asOf || Date.now()).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function pulseToBlocks(j) {
  return (j.blocks || []).map((b) => ({ n: b.n, ts: b.ts, tx: b.tx, gasPct: b.gasPct, baseFee: b.baseFee, blobs: b.blobs, posters: b.posters || [], slot: Math.floor((b.ts - GENESIS) / 12), burn: b.burn ?? (b.gasPct / 100) * GAS_LIMIT * b.baseFee * 1e-9 })).sort((a, b) => a.n - b.n);
}
function queueLive(blocks) {
  const kNow = Math.floor(ST.T / 12);
  for (const b of blocks) {
    if (b.n <= ST.lastLiveN) continue;
    let k = ST.lastK === null ? kNow + 2 : Math.max(ST.lastK + 1, kNow + 2);
    if (ST.lastK !== null && ST.lastK - kNow > 5) continue;
    LIVE.set(k, b); ST.lastK = k; ST.lastLiveN = b.n;
    if (ST.liveK0 === null) ST.liveK0 = k;
  }
}
async function pollPulse() {
  if (document.hidden) return;
  const j = await getJSON('/api/pulse', 5000);
  if (!j || !j.blocks) return;
  if (ST.mode === 'live') queueLive(pulseToBlocks(j));
  else ST.pendingLive = pulseToBlocks(j);
}
function goLive() {
  if (!LIVE_OK) return;
  ST.mode = 'live'; ST.speed = 1; ST.liveK0 = null; ST.lastK = null; LIVE.clear();
  document.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.speed === 1)));
  if (ST.pendingLive) { ST.lastLiveN = Math.max(0, ST.pendingLive[ST.pendingLive.length - 1].n - 2); queueLive(ST.pendingLive); }
  setModeUI(); renderCard();
}
async function startLive() {
  const j = await getJSON('/api/pulse', 5000);
  if (!j || !j.blocks || !j.blocks.length) { setModeUI(); return; }
  LIVE_OK = true;
  const blocks = pulseToBlocks(j);
  ST.mode = 'live';
  ST.lastLiveN = Math.max(0, blocks[blocks.length - 1].n - 2);
  queueLive(blocks);
  setModeUI(); renderCard();
  setInterval(pollPulse, 6000);
  setInterval(async () => { const t = await getJSON('/api/town', 8000); if (t) { applyTown(t); setVaultQueueTargets(D.staking.entryQ, D.staking.exitQ); renderCard(); } }, 15 * 60 * 1000);
}

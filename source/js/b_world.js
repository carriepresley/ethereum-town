
/* =====================================================================
   WORLD LAYOUT (x = east, y = south, h = up). The diorama is 52 × 31.
   ===================================================================== */
const WX = 52, WY = 31;
const RAIL_Y = 25.4, STOP_X = 35.4;
const ROW1 = [14.5, 17.5], ROW2 = [7.5, 10.5];
const LOTS = [[0.8, 3.8], [4.8, 7.8], [8.8, 11.8], [15, 18], [19, 22], [23, 26], [29, 32], [33, 36]];
const LOT_ORDER = [6, 5, 4, 3, 2, 1, 0]; // lots nearest the station first
const YARD = { x0: 4.3, x1: 22.4, lane: 22.2, entryX: 21.7, exitX: 6.4 };
const ROADS = {
  RR: { axis: 'x', c: 19.5, a: 0, b: WX },   // Rollup Row
  MS: { axis: 'x', c: 12.5, a: 0, b: 39 },   // Market Street
  HR: { axis: 'x', c: 5.5, a: 0, b: WX },    // Hill Road
  CR: { axis: 'x', c: 28.2, a: 0, b: WX },   // Coast Road
  AA: { axis: 'y', c: 13.5, a: 5.5, b: 19.5 },
  AB: { axis: 'y', c: 27.5, a: 5.5, b: 19.5 },
  AC: { axis: 'y', c: 38, a: 5.5, b: 28.2 },
};

const COLORS = {
  grass: '#8dbd6e', grassLip: '#7aad5d', park: '#99c77a', earth: '#8a6a4d', earthDark: '#6b503a',
  paved: '#dad4c7', yard: '#c2bcb0', asphalt: '#4c5362', lane: '#efeadf', ballast: '#8b8478',
  sleeper: '#6a5545', rail: '#b4bac3', platform: '#cfc8bb', stone: '#a29b8f', dark: '#16181d',
};

/* ---------- shops: each network's own color scheme (colors only — no logos) ----------
   id: identity color (labels, containers, couriers) · wall: façade · trim: frame, parapet, pilasters
   accent: awning + glowing crown · sign: [background, lettering] */
const BRAND = {
  lighter: { id: '#2a2e36', wall: '#1d2027', trim: '#eceef2', accent: '#f4f5f7', sign: ['#f4f5f7', '#14161b'] },
  rise: { id: '#f28c28', wall: '#f7efe4', trim: '#f28c28', accent: '#f28c28', sign: ['#f28c28', '#ffffff'] },
  base: { id: '#0052ff', wall: '#1d5cff', trim: '#f4f7ff', accent: '#ffffff', sign: ['#ffffff', '#0052ff'] },
  robinhood: { id: '#c6f500', wall: '#15181a', trim: '#c6f500', accent: '#ccff00', sign: ['#ccff00', '#101312'] },
  fuel: { id: '#00d98a', wall: '#e3f5ec', trim: '#0d1813', accent: '#00e38c', sign: ['#0d1813', '#00f58c'] },
  'polygon-pos': { id: '#7b3fe4', wall: '#7f45e6', trim: '#efe7ff', accent: '#f3edff', sign: ['#f3edff', '#5b22c9'] },
  megaeth: { id: '#e2487f', wall: '#f4ecef', trim: '#1a1a1d', accent: '#e2487f', sign: ['#1a1a1d', '#ffffff'] },
  optimism: { id: '#ff0420', wall: '#f5192f', trim: '#fff4f5', accent: '#ffffff', sign: ['#ffffff', '#e0001c'] },
  arbitrum: { id: '#12aaff', wall: '#213147', trim: '#12aaff', accent: '#12aaff', sign: ['#12aaff', '#ffffff'] },
  xlayer: { id: '#8f97a6', wall: '#eff0f2', trim: '#141517', accent: '#141517', sign: ['#141517', '#ffffff'] },
  celo: { id: '#f2f24a', wall: '#f4f55a', trim: '#1b1b1b', accent: '#1b1b1b', sign: ['#1b1b1b', '#fcff52'] },
  worldchain: { id: '#e6e6e6', wall: '#fafafa', trim: '#121212', accent: '#121212', sign: ['#121212', '#ffffff'] },
  unichain: { id: '#f50db4', wall: '#f21bb6', trim: '#ffe8f7', accent: '#ffffff', sign: ['#ffffff', '#cc0096'] },
  ink: { id: '#7132f5', wall: '#7438f3', trim: '#efe8ff', accent: '#ffffff', sign: ['#ffffff', '#5a1fe0'] },
};
const FALLBACK_ACCENTS = ['#ff8a3d', '#27b5a3', '#d64f8c', '#6c7bff', '#e0b02a', '#45a0e6', '#9b6bd6'];
function brandOf(key, i) {
  if (BRAND[key]) return BRAND[key];
  const a = FALLBACK_ACCENTS[i % FALLBACK_ACCENTS.length];
  return { id: a, wall: '#ece9e2', trim: a, accent: a, sign: [a, lum(a) > 0.55 ? '#141821' : '#ffffff'] };
}
function shopColor(key) { return (BRAND[key] && BRAND[key].id) || '#c9ae84'; }
const CONTAINER = {
  lighter: '#3a404c', rise: '#f28c28', base: '#0052ff', robinhood: '#b8e600', fuel: '#00d98a', 'polygon-pos': '#7b3fe4',
  megaeth: '#e2487f', optimism: '#ff0420', arbitrum: '#12aaff', xlayer: '#9aa3b5', celo: '#f2f24a', worldchain: '#f2f2f2',
  unichain: '#f50db4', ink: '#7132f5', other: '#c7ad86',
};
function containerColor(key) { return CONTAINER[key] || '#c7ad86'; }
/* L2BEAT shows no stage for projects in its "Others" category, even when its data says "Stage 0". */
function stageOf(s) { return (!s.stage || s.category === 'Other' || s.stage === 'Not applicable' || s.stage === 'UnderReview') ? 'Not rated' : s.stage; }

/* ---------- stops registry (filled while building) ---------- */
const STOPS = [];
const PICK = []; // invisible proxies for raycast picking
const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
function addProxy(stop, x0, y0, x1, y1, h) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h, y1 - y0), proxyMat);
  m.position.set((x0 + x1) / 2, h / 2, (y0 + y1) / 2);
  m.userData.stop = stop;
  scene.add(m); PICK.push(m);
}

/* ================= ground ================= */
function buildGround() {
  // diorama slab
  box(-0.2, -0.2, WX + 0.2, WY + 0.2, -1.9, -0.9, COLORS.earthDark, { cast: false });
  box(-0.2, -0.2, WX + 0.2, WY + 0.2, -0.9, -0.1, COLORS.earth, { cast: false });
  box(-0.2, -0.2, WX + 0.2, WY + 0.2, -0.1, 0, COLORS.grass, { cast: false });
  // paved town core & plazas
  const P = (x0, y0, x1, y1, c = COLORS.paved) => box(x0, y0, x1, y1, 0, 0.025, c, { cast: false });
  P(0, 3.8, 39.5, 21.2);
  P(39.5, 17.1, WX, 21.2);
  P(39.5, 3.8, WX, 7.5);
  P(39.2, 11.3, 48.9, 17.1);
  P(22.4, 21.2, 37, 24.75);
  P(39.1, 20.9, 47.4, 24.6);
  box(YARD.x0, 21.2, YARD.x1, 24.75, 0, 0.03, COLORS.yard, { cast: false });
  // parks
  box(32.7, 7.3, 36.3, 10.7, 0.025, 0.05, COLORS.park, { cast: false });
  box(34.4, 21.3, 36.9, 24.6, 0.025, 0.05, COLORS.park, { cast: false });
  // roads
  const road = (x0, y0, x1, y1) => box(x0, y0, x1, y1, 0.025, 0.055, COLORS.asphalt, { cast: false, r: 0.95 });
  road(0, 18.5, WX, 20.5); road(0, 11.5, 39, 13.5); road(0, 4.5, WX, 6.5); road(0, 27.2, WX, 29.2);
  road(12.5, 4.5, 14.5, 20.5); road(26.5, 4.5, 28.5, 20.5); road(37, 4.5, 39, 29.2);
  road(YARD.entryX - 0.7, 20.5, YARD.entryX + 0.7, 22.9); road(YARD.exitX - 0.7, 20.5, YARD.exitX + 0.7, 22.9);
  road(YARD.exitX - 0.7, 21.6, YARD.entryX + 0.7, 22.8);
  // dashed centre lines
  const dash = (x0, y0, x1, y1) => box(x0, y0, x1, y1, 0.055, 0.062, COLORS.lane, { cast: false, recv: false });
  const inter = (v, list) => list.some(([a, b]) => v > a && v < b);
  const xCross = [[12.3, 14.7], [26.3, 28.7], [36.8, 39.2], [YARD.entryX - 0.8, YARD.entryX + 0.8], [YARD.exitX - 0.8, YARD.exitX + 0.8]];
  for (const [yy, x1] of [[19.5, WX], [12.5, 39], [5.5, WX], [28.2, WX]]) {
    for (let x = 0.4; x < x1 - 0.8; x += 1.7) if (!inter(x + 0.4, xCross)) dash(x, yy - 0.04, x + 0.8, yy + 0.04);
  }
  const yCross = [[4.3, 6.7], [11.3, 13.7], [18.3, 20.7], [24.6, 26.2], [27, 29.4]];
  for (const [xx, y0, y1] of [[13.5, 6.5, 18.5], [27.5, 6.5, 18.5], [38, 6.5, 27.2]]) {
    for (let y = y0 + 0.3; y < y1 - 0.6; y += 1.7) if (!inter(y + 0.4, yCross)) dash(xx - 0.04, y, xx + 0.04, y + 0.8);
  }
  // zebra crossings
  const zebraX = (x0, x1, y0, y1) => { for (let x = x0; x < x1; x += 0.36) box(x, y0, x + 0.2, y1, 0.055, 0.062, '#f4f1e8', { cast: false, recv: false }); };
  const zebraY = (y0, y1, x0, x1) => { for (let y = y0; y < y1; y += 0.36) box(x0, y, x1, y + 0.2, 0.055, 0.062, '#f4f1e8', { cast: false, recv: false }); };
  zebraY(18.6, 20.4, 11.6, 12.4); zebraY(18.6, 20.4, 25.6, 26.4); zebraY(18.6, 20.4, 39.1, 39.9);
  zebraY(11.6, 13.4, 11.6, 12.4); zebraY(11.6, 13.4, 25.6, 26.4);
  zebraX(12.6, 14.4, 17.7, 18.4); zebraX(26.6, 28.4, 17.7, 18.4);
  // stop lines at the level crossing
  box(37.05, 24.1, 37.95, 24.2, 0.055, 0.062, '#f4f1e8', { cast: false, recv: false });
  box(38.05, 26.6, 38.95, 26.7, 0.055, 0.062, '#f4f1e8', { cast: false, recv: false });
  // yard markings
  for (let x = 7.6; x < 21.2; x += 2.0) box(x, 23.1, x + 0.06, 23.9, 0.03, 0.036, '#e8c547', { cast: false, recv: false });
}

/* ================= rail ================= */
function buildRail() {
  box(0, 24.75, WX, 26.05, 0, 0.12, COLORS.ballast, { cast: false, r: 1 });
  const sleeperGeo = new THREE.BoxGeometry(0.18, 0.05, 1.05);
  const sl = new THREE.InstancedMesh(sleeperGeo, M(COLORS.sleeper), Math.ceil(WX / 0.5));
  const m4 = new THREE.Matrix4(); let i = 0;
  for (let x = 0.25; x < WX; x += 0.5) { m4.makeTranslation(x, 0.145, RAIL_Y); sl.setMatrixAt(i++, m4); }
  sl.count = i; sl.receiveShadow = true; scene.add(sl);
  for (const yy of [RAIL_Y - 0.28, RAIL_Y + 0.28]) box(0, yy - 0.035, WX, yy + 0.035, 0.17, 0.24, COLORS.rail, { m: 0.7, r: 0.35, cast: false });
  // platform & freight dock
  box(22.6, 23.85, 34.4, 24.72, 0, 0.32, COLORS.platform);
  box(22.6, 24.56, 34.4, 24.68, 0.32, 0.335, '#e8c547', { cast: false });
  box(8.2, 24.0, 22.4, 24.72, 0, 0.26, '#b5ae9f');
  box(8.2, 24.58, 22.4, 24.7, 0.26, 0.272, '#e8c547', { cast: false });
  // level crossing deck
  box(37, 24.75, 39, 26.05, 0.12, 0.2, '#5a606d', { cast: false });
  // freight yard: container stacks and a gantry over the dock
  const stackCols = ['#c7ad86', '#2b63ff', '#a8d81b', '#2bb3f3', '#ff2a3a', '#9aa3b5', '#f2f2f2', '#7132f5'];
  let sc = 0;
  for (const [x, y, n] of [[4.9, 21.55, 3], [4.9, 22.35, 2], [5.6, 23.3, 2], [4.9, 23.3, 3]]) {
    for (let k = 0; k < n; k++) box(x, y, x + 0.62, y + 0.74, k * 0.5, k * 0.5 + 0.48, stackCols[(sc++) % stackCols.length], { r: 0.6 });
  }
  const steel = M('#e0a526', { r: 0.5, m: 0.4 });
  for (const x of [8.3, 22.1]) { box(x, 23.35, x + 0.16, 23.51, 0, 3.0, null, { material: steel }); box(x, 26.6, x + 0.16, 26.76, 0, 3.0, null, { material: steel }); }
  box(8.3, 23.35, 22.26, 23.51, 2.84, 3.0, null, { material: steel });
  box(8.3, 26.6, 22.26, 26.76, 2.84, 3.0, null, { material: steel });
  box(8.3, 23.35, 8.46, 26.76, 2.84, 3.0, null, { material: steel }); box(22.1, 23.35, 22.26, 26.76, 2.84, 3.0, null, { material: steel });
}

/* ================= hills & tunnels ================= */
function hill(x0, y0, x1, y1, portalFace) {
  box(x0, y0, x1, y1, 0, 1.6, COLORS.earth, { r: 1 });
  box(x0, y0, x1, y1, 1.6, 1.75, COLORS.grass);
  box(x0 + 0.35, y0 + 0.4, x1 - 0.35, y1 - 0.4, 1.75, 2.35, COLORS.grass, { flat: true });
  box(x0 + 0.9, y0 + 1.0, x1 - 0.9, y1 - 1.1, 2.35, 2.75, COLORS.grassLip, { flat: true });
  const px = portalFace === 'E' ? x1 : x0, dir = portalFace === 'E' ? 1 : -1;
  // stone portal
  box(Math.min(px, px + dir * 0.22), RAIL_Y - 0.95, Math.max(px, px + dir * 0.22), RAIL_Y + 0.95, 0, 1.95, COLORS.stone, { r: 1 });
  box(Math.min(px, px + dir * 0.26), RAIL_Y - 0.62, Math.max(px, px + dir * 0.26), RAIL_Y + 0.62, 0.1, 1.3, COLORS.dark, { cast: false });
  const g = new THREE.CylinderGeometry(0.62, 0.62, 0.27, 16, 1, false, 0, Math.PI);
  g.rotateZ(Math.PI / 2);
  g.translate(px + dir * 0.13, 1.3, RAIL_Y);
  put(g, COLORS.dark, { cast: false });
  box(Math.min(px, px + dir * 0.3), RAIL_Y - 1.0, Math.max(px, px + dir * 0.3), RAIL_Y + 1.0, 1.95, 2.12, '#8e877b');
}

/* ================= trees & lamps (instanced) ================= */
const TREES = [];
function addTree(x, y, s = 1, kind, base = 0) { TREES.push({ x, y, s, kind: kind || (rand() < 0.28 ? 'pine' : 'round'), base, c: rand() }); }
let treeCanopy, treePine;
const TREE_GREENS = ['#5f9a4f', '#6aa65a', '#4f8a47', '#78b061', '#5a9656'];
const TREE_AUTUMN = ['#d98b32', '#c8642f', '#e2b13c'];
function buildTrees() {
  const trunkGeo = new THREE.CylinderGeometry(0.05, 0.075, 0.55, 6); trunkGeo.translate(0, 0.275, 0);
  const canopyGeo = new THREE.IcosahedronGeometry(0.46, 0); canopyGeo.translate(0, 0.9, 0);
  const pineGeo = new THREE.ConeGeometry(0.42, 1.25, 7); pineGeo.translate(0, 1.05, 0);
  const n = TREES.length;
  const trunks = new THREE.InstancedMesh(trunkGeo, M('#6e5140'), n);
  treeCanopy = new THREE.InstancedMesh(canopyGeo, new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), n);
  treePine = new THREE.InstancedMesh(pineGeo, new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), n);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  let ic = 0, ip = 0;
  TREES.forEach((t, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.c * 6.28);
    sc.set(t.s, t.s * (0.9 + t.c * 0.3), t.s); p.set(t.x, t.base, t.y);
    m4.compose(p, q, sc); trunks.setMatrixAt(i, m4);
    const autumn = t.kind === 'round' && hash01(i * 7 + 3) < 0.16;
    col.set(autumn ? TREE_AUTUMN[i % 3] : TREE_GREENS[i % TREE_GREENS.length]);
    if (t.kind === 'pine') { col.set('#3f7a47').offsetHSL(0, 0, (t.c - 0.5) * 0.08); treePine.setMatrixAt(ip, m4); treePine.setColorAt(ip++, col); }
    else { col.offsetHSL(0, 0, (t.c - 0.5) * 0.06); treeCanopy.setMatrixAt(ic, m4); treeCanopy.setColorAt(ic++, col); t.slot = ic - 1; }
  });
  treeCanopy.count = ic; treePine.count = ip;
  for (const m of [trunks, treeCanopy, treePine]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }
}
const LAMPS = [];
function buildLamps() {
  const poleGeo = new THREE.CylinderGeometry(0.035, 0.045, 1.55, 6); poleGeo.translate(0, 0.775, 0);
  const headGeo = new THREE.BoxGeometry(0.26, 0.08, 0.16); headGeo.translate(0, 1.58, 0);
  const n = LAMPS.length;
  const poles = new THREE.InstancedMesh(poleGeo, M('#3b404a', { m: 0.5, r: 0.5 }), n);
  const heads = new THREE.InstancedMesh(headGeo, LAMP_MAT, n);
  const m4 = new THREE.Matrix4();
  LAMPS.forEach((l, i) => { m4.makeTranslation(l.x, l.base || 0, l.y); poles.setMatrixAt(i, m4); heads.setMatrixAt(i, m4); });
  poles.castShadow = true; scene.add(poles, heads);
}

/* ================= houses ================= */
const HOUSE_WALLS = ['#eadfce', '#dbe3ec', '#e9d6d2', '#dde6d3', '#efe6c9', '#d9d3e6'];
const HOUSE_ROOFS = ['#8a6c60', '#6c7a93', '#9e655a', '#5f7d62', '#7d6a8f'];
function house(x0, y0, w, d, seed) {
  const x1 = x0 + w, y1 = y0 + d, h = 1.05 + hash01(seed) * 0.35;
  const wall = HOUSE_WALLS[seed % HOUSE_WALLS.length], roof = HOUSE_ROOFS[(seed * 3) % HOUSE_ROOFS.length];
  box(x0, y0, x1, y1, 0, h, wall);
  if (w >= d) gable(x0, y0, x1, y1, h, 0.62, roof, { flat: true }); else gableY(x0, y0, x1, y1, h, 0.62, roof, { flat: true });
  box(x0 + w * 0.42, y1 - 0.01, x0 + w * 0.58, y1 + 0.03, 0, 0.62, '#5b4636', { cast: false });
  windowGrid(x0, y0, x1, y1, ['S', 'E', 'W', 'N'], 0.32, h - 0.1, 0.62, 0.62, seed + 50);
  cyl(x0 + w * 0.75, y0 + d * 0.3, 0.09, h, h + 0.75, '#8b7b6d', {}, 6);
}

/* ================= shops ================= */
const SHOPS = []; // runtime shop objects
function shopHeight(tvs) { return clamp(1.75 + 0.047 * Math.sqrt(Math.max(0, tvs) / 1e6), 1.75, 8.2); }
function buildShop(s, idx) {
  const row = idx < 7 ? ROW1 : ROW2, lotI = idx < 7 ? LOT_ORDER[idx] : LOT_ORDER[idx - 7];
  const [x0, x1] = LOTS[lotI], [y0, y1] = row;
  const b = brandOf(s.key, idx), h = shopHeight(s.tvs);
  const seed = idx * 97 + 11;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const tall = h > 5.4;
  const podium = tall ? h * 0.68 : h;
  beginGroup('shop:' + s.key);
  // body
  box(x0, y0, x1, y1, 0, podium, b.wall, { r: 0.85 });
  if (tall) box(x0 + 0.35, y0 + 0.35, x1 - 0.35, y1 - 0.35, podium, h, b.wall, { r: 0.85 });
  // base plinth band
  box(x0 - 0.03, y0 - 0.03, x1 + 0.03, y1 + 0.03, 0, 0.1, b.trim, { cast: false });
  // storefront (south face)
  for (const [u0, u1] of [[0.18, 1.2], [1.8, 2.82]]) windowOn('S', x0, y0, x1, y1, u0, u1, 0.16, 0.96, hash01(seed + u0 * 10) < 0.8 ? WIN_LIT2 : WIN_LIT);
  box(x0 + 1.24, y1 - 0.01, x0 + 1.76, y1 + 0.04, 0.1, 0.92, '#262a31', { cast: false });
  box(x0 + 1.2, y1 + 0.02, x0 + 1.8, y1 + 0.06, 0.92, 0.98, b.trim, { cast: false });
  // side ground windows
  windowOn('E', x0, y0, x1, y1, 0.3, 1.3, 0.25, 0.9, WIN_LIT); windowOn('W', x0, y0, x1, y1, 1.7, 2.7, 0.25, 0.9, WIN_LIT2);
  // awning in brand colour
  const aw = new THREE.BoxGeometry(2.7, 0.045, 0.52); aw.rotateX(0.32); aw.translate(cx, 1.0, y1 + 0.24);
  putM(aw, M(b.accent, { r: 0.7 }), true, true);
  // sign band in the network's own colors
  const [signBg, signFg] = b.sign;
  const tex = signTexture(s.name.toUpperCase(), signBg, signFg, { spacing: 4 });
  signPlane(tex, 'S', cx, y1 + 0.045, 1.33, 2.62, 0.4, [0.35, 1.9]);
  box(x0 + 0.12, y1 - 0.01, x1 - 0.12, y1 + 0.04, 1.1, 1.56, b.trim, { cast: false });
  // corner pilasters frame the façade in the trim color
  for (const px of [x0, x1 - 0.14]) box(px, y1 - 0.02, px + 0.14, y1 + 0.05, 0.1, podium - 0.08, b.trim, { cast: false });
  if (tall) for (const px of [x0 + 0.35, x1 - 0.49]) box(px, y1 - 0.37, px + 0.14, y1 - 0.3, podium + 0.08, h - 0.2, b.trim, { cast: false });
  // upper floors
  windowGrid(x0, y0, x1, y1, ['S', 'E', 'W', 'N'], 1.78, podium - 0.2, 0.58, 0.72, seed);
  if (tall) windowGrid(x0 + 0.35, y0 + 0.35, x1 - 0.35, y1 - 0.35, ['S', 'E', 'W', 'N'], podium + 0.25, h - 0.25, 0.58, 0.7, seed + 7);
  // parapet + glowing crown in brand colour
  const top = h, rx0 = tall ? x0 + 0.35 : x0, rx1 = tall ? x1 - 0.35 : x1, ry0 = tall ? y0 + 0.35 : y0, ry1 = tall ? y1 - 0.35 : y1;
  const crown = glowMat(b.accent, 0.35, 1.5);
  box(rx0 - 0.03, ry0 - 0.03, rx1 + 0.03, ry1 + 0.03, top - 0.2, top - 0.1, null, { material: crown, cast: false });
  for (const [a0, b0, a1, b1] of [[rx0, ry0, rx1, ry0 + 0.1], [rx0, ry1 - 0.1, rx1, ry1], [rx0, ry0, rx0 + 0.1, ry1], [rx1 - 0.1, ry0, rx1, ry1]]) box(a0, b0, a1, b1, top, top + 0.18, b.trim);
  if (tall) box(x0, y0, x1, y1, podium, podium + 0.08, b.trim);
  // rooftop details
  box(rx0 + 0.35, ry0 + 0.35, rx0 + 0.95, ry0 + 0.8, top, top + 0.32, '#9aa1ab', { r: 0.6, m: 0.3 });
  cyl(rx1 - 0.55, ry0 + 0.6, 0.26, top, top + 0.55, '#7d6552', {}, 10);
  if (s.da !== 'blobs') { // off-Ethereum data: satellite dish
    const dish = new THREE.SphereGeometry(0.38, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.6);
    dish.rotateX(Math.PI * 0.72); dish.rotateY(-0.5); dish.translate(rx0 + 0.75, top + 0.62, ry1 - 0.7);
    put(dish, '#e6e8ec', { r: 0.4, m: 0.2 });
    cyl(rx0 + 0.75, ry1 - 0.7, 0.04, top, top + 0.5, '#9aa1ab', {}, 6);
  }
  let flag = null;
  const stage = stageOf(s);
  if (stage === 'Stage 1' || stage === 'Stage 2') {
    cyl(rx1 - 0.35, ry1 - 0.35, 0.025, top, top + 1.25, '#d9dde3', { m: 0.6, r: 0.3 }, 6);
    flag = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.32, 6, 1), new THREE.MeshStandardMaterial({ color: stage === 'Stage 2' ? '#2c8cf0' : '#2fb36b', side: THREE.DoubleSide, roughness: 0.8 }));
    flag.geometry.translate(0.275, 0, 0);
    flag.position.set(rx1 - 0.35, top + 1.08, ry1 - 0.35);
    flag.castShadow = true; addObj(flag);
    flag.userData.base = flag.geometry.attributes.position.array.slice();
  }
  // antenna for the tallest
  if (tall) cyl(cx, cy, 0.04, h + 0.18, h + 1.6, '#cfd4db', { m: 0.6, r: 0.3 }, 6);
  const grp = endGroup();
  const shop = {
    ...s, idx, x0, x1, y0, y1, cx, cy, h, brand: b, flag, grp,
    door: { x: cx, y: y1 }, row: idx < 7 ? 1 : 2,
    pickup: { x: x1 + 0.5, road: idx < 7 ? 'RR' : 'MS' },
  };
  SHOPS.push(shop);
  addProxy({ type: 'l2', shop }, x0, y0, x1, y1, h + 0.4);
  // lamp posts near the shop front
  LAMPS.push({ x: x0 - 0.35, y: y1 + 0.9 });
  return shop;
}

/* ================= civic buildings ================= */
let clockHand, ethGem, supplyScreen, furnaceMouth, vaultDoors;
const CIVIC = {};
function buildStation() {
  const x0 = 22.8, x1 = 33.2, y0 = 21.25, y1 = 23.85, h = 2.25;
  beginGroup('station');
  box(x0, y0, x1, y1, 0, h, '#e8e0cf', { r: 0.85 });
  box(x0 - 0.05, y0 - 0.05, x1 + 0.05, y1 + 0.05, h - 0.12, h + 0.02, '#cbbfa6');
  gable(x0, y0, x1, y1, h, 1.05, '#4251c4', { r: 0.6, flat: true });
  // arched windows along the hall
  for (let u = 0.5; u < x1 - x0 - 0.5; u += 1.25) {
    if (u > 4.1 && u < 6.2) continue;
    windowOn('S', x0, y0, x1, y1, u, u + 0.62, 0.55, 1.85, hash01(u * 100) < 0.7 ? WIN_LIT : WIN_LIT2);
    windowOn('N', x0, y0, x1, y1, u, u + 0.62, 0.55, 1.85, WIN_LIT);
  }
  // doors to the platform
  for (const dx of [24.2, 25.9, 30.1, 31.8]) box(dx - 0.28, y1 - 0.01, dx + 0.28, y1 + 0.04, 0.32, 1.25, '#2a2f3a', { cast: false });
  // clock tower
  const tx0 = 27.2, tx1 = 28.8, ty0 = 21.6, ty1 = 23.95;
  box(tx0, ty0, tx1, ty1, 0, 4.7, '#e2d8c4');
  box(tx0 - 0.08, ty0 - 0.08, tx1 + 0.08, ty1 + 0.08, 4.7, 4.9, '#cbbfa6');
  pyramid(28, (ty0 + ty1) / 2, 1.9, 4.9, 1.35, '#4251c4', { flat: true, r: 0.6 });
  windowOn('S', tx0, ty0, tx1, ty1, 0.45, 1.15, 0.5, 2.1, WIN_LIT);
  // clock face
  const cc = textCanvas(256, 256), g = cc.getContext('2d');
  g.fillStyle = '#fbf6e8'; g.beginPath(); g.arc(128, 128, 122, 0, 7); g.fill();
  g.strokeStyle = '#2b2f3b'; g.lineWidth = 8; g.stroke();
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.lineWidth = i % 3 === 0 ? 10 : 5; g.beginPath(); g.moveTo(128 + Math.sin(a) * 92, 128 - Math.cos(a) * 92); g.lineTo(128 + Math.sin(a) * 112, 128 - Math.cos(a) * 112); g.stroke(); }
  g.fillStyle = '#2b2f3b'; g.font = `800 34px ${DISPLAY}`; g.textAlign = 'center'; g.fillText('12 s', 128, 176);
  const ct = new THREE.CanvasTexture(cc); ct.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.62, 32), nightMat(new THREE.MeshStandardMaterial({ map: ct, emissive: '#fff4d8', emissiveMap: ct, emissiveIntensity: 0.1 }), 0.1, 1.3));
  face.position.set(28, 3.55, ty1 + 0.02); addObj(face);
  clockHand = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.02), M('#c23b2e'));
  clockHand.geometry.translate(0, 0.22, 0);
  clockHand.position.set(28, 3.55, ty1 + 0.045); addObj(clockHand);
  // floating ether gem above the tower
  ethGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), new THREE.MeshStandardMaterial({ color: '#7d88ff', emissive: '#5b67ff', emissiveIntensity: 0.6, roughness: 0.25, metalness: 0.4, flatShading: true }));
  ethGem.scale.set(1, 1.55, 1); ethGem.position.set(28, 7.35, (ty0 + ty1) / 2); ethGem.castShadow = true;
  nightMat(ethGem.material, 0.6, 1.5); addObj(ethGem);
  // station name
  const tex = signTexture('MAINNET STATION', '#1d2340', '#ffd27a', { spacing: 6 });
  signPlane(tex, 'S', 25.1, y1 + 0.05, 1.95, 3.4, 0.46, [0.4, 2.0]);
  const tex2 = signTexture('ETHEREUM L1', '#1d2340', '#ffffff', { spacing: 6 });
  signPlane(tex2, 'S', 30.9, y1 + 0.05, 1.95, 3.0, 0.46, [0.4, 1.8]);
  // platform canopy
  box(22.75, 23.95, 34.25, 24.62, 1.72, 1.8, '#39404f', { r: 0.6 });
  for (let x = 23.3; x < 34.2; x += 2.2) cyl(x, 24.3, 0.05, 0.32, 1.72, '#39404f', {}, 6);
  box(22.9, 24.05, 34.1, 24.5, 1.66, 1.72, null, { material: LAMP_MAT, cast: false });
  CIVIC.station = endGroup();
  addProxy({ type: 'station' }, 22.6, 21.2, 34.4, 24.7, 5.5);
}

function buildVault() {
  beginGroup('vault');
  box(39.4, 11.6, 48.6, 15.8, 0, 0.35, '#d7d2c6');
  box(40, 12, 48, 14.8, 0.35, 3.0, '#e7e2d7', { r: 0.8 });
  for (let i = 0; i < 3; i++) box(40.2 - i * 0.06, 15.5 + i * 0.28, 47.8 + i * 0.06, 15.8 + i * 0.28, 0, 0.35 - i * 0.11, '#dcd7cb');
  for (let x = 40.45; x <= 47.6; x += 1.0) { cyl(x, 15.3, 0.17, 0.35, 2.72, '#f3efe7', { r: 0.6 }, 14); box(x - 0.24, 15.06, x + 0.24, 15.54, 2.72, 2.8, '#e2ddd1'); }
  box(39.85, 12, 48.15, 15.62, 2.8, 3.25, '#e2ddd1');
  // pediment + roof
  const s = new THREE.Shape(); s.moveTo(-4.25, 0); s.lineTo(4.25, 0); s.lineTo(0, 1.15); s.closePath();
  const pg = new THREE.ExtrudeGeometry(s, { depth: 3.75, bevelEnabled: false }); pg.translate(44, 3.25, 11.9);
  put(pg, '#b9b09f', { flat: true, r: 0.7 });
  const tex = signTexture('BEACON VAULT', '#e2ddd1', '#3a3f4d', { spacing: 10, weight: 900 });
  signPlane(tex, 'S', 44, 15.63, 3.02, 5.2, 0.4, [0.05, 0.6]);
  // glowing doors
  vaultDoors = nightMat(new THREE.MeshStandardMaterial({ color: '#dfe8ff', emissive: '#bcd0ff', emissiveIntensity: 0.4 }), 0.4, 1.2);
  box(41.45, 14.78, 42.35, 14.84, 0.35, 2.05, null, { material: vaultDoors, cast: false });
  box(45.65, 14.78, 46.55, 14.84, 0.35, 2.05, null, { material: vaultDoors, cast: false });
  windowGrid(40, 12, 48, 14.8, ['E', 'W', 'N'], 0.8, 2.7, 0.9, 0.9, 400);
  // door signs: the entry line goes IN to stake, the exit row comes OUT
  // (hung in front of the colonnade so they read from the street)
  signPlane(signTexture('IN · STAKE', '#2b4fae', '#ffffff', { w: 512, h: 150, spacing: 3 }), 'S', 41.95, 15.66, 2.42, 0.96, 0.3, [0.35, 1.0]);
  signPlane(signTexture('OUT · EXIT', '#4b5263', '#ffffff', { w: 512, h: 150, spacing: 3 }), 'S', 45.95, 15.66, 2.42, 0.96, 0.3, [0.35, 1.0]);
  for (const x of [41.6, 42.3, 45.6, 46.3]) box(x - 0.012, 15.65, x + 0.012, 15.67, 2.57, 2.74, '#6b6f78', { cast: false });
  CIVIC.vault = endGroup();
  // queue stanchions (entry: 4 serpentine rows, blue ropes; exit: 1 row, grey rope)
  const rope = M('#3d5fc4', { r: 0.6 }), ropeOut = M('#8a909c', { r: 0.6 });
  for (let r = 0; r < 4; r++) {
    const yy = 16.64 + r * 0.28;
    box(40.25, yy - 0.012, 46.15, yy + 0.012, 0.27, 0.3, null, { material: rope, cast: false });
    for (let x = 40.25; x <= 46.2; x += 1.475) cyl(x, yy, 0.022, 0, 0.33, '#c9a54a', { m: 0.7, r: 0.3 }, 6);
  }
  box(46.5, 16.9 - 0.012, 48.5, 16.9 + 0.012, 0.27, 0.3, null, { material: ropeOut, cast: false });
  for (let x = 46.5; x <= 48.55; x += 1.0) cyl(x, 16.9, 0.022, 0, 0.33, '#c9a54a', { m: 0.7, r: 0.3 }, 6);
  addProxy({ type: 'vault' }, 39.4, 11.6, 48.6, 17.4, 4.5);
  for (const x of [39.7, 48.3]) LAMPS.push({ x, y: 16.4 });
}

/* the corner lot next to the vault: a small pocket park */
function buildPocketPark() {
  box(33.05, 14.65, 35.95, 17.35, 0.025, 0.05, COLORS.park, { cast: false });
  box(33.05, 15.85, 35.95, 16.15, 0.05, 0.058, COLORS.paved, { cast: false });
  for (const [x, y] of [[33.55, 15.1], [35.35, 15.2], [33.7, 16.85], [35.2, 16.9], [34.45, 14.95]]) addTree(x, y, R(0.75, 1.0), 'round');
  for (const x of [33.9, 35.0]) { box(x - 0.28, 16.22, x + 0.28, 16.34, 0.2, 0.24, '#8a6a4d'); box(x - 0.28, 16.32, x + 0.28, 16.36, 0.24, 0.42, '#8a6a4d', { cast: false }); }
  LAMPS.push({ x: 32.65, y: 18.4 });
}

function buildBurn() {
  const x0 = 40, x1 = 43, y0 = 21.3, y1 = 24.3, h = 2.1;
  beginGroup('burn');
  box(x0, y0, x1, y1, 0, h, '#9a5a45', { r: 0.95 });
  box(x0 - 0.05, y0 - 0.05, x1 + 0.05, y1 + 0.05, h, h + 0.15, '#6b3f31');
  for (let v = 0.35; v < h; v += 0.35) box(x0 - 0.01, y1 - 0.005, x1 + 0.01, y1 + 0.01, v, v + 0.02, '#7d4636', { cast: false });
  cyl(42.2, 22.0, 0.46, h, 6.6, '#8a4d3b', { r: 0.95 }, 14, 0.36);
  cyl(42.2, 22.0, 0.52, 6.2, 6.6, '#5c3328', {}, 14);
  furnaceMouth = new THREE.MeshStandardMaterial({ color: '#2a1410', emissive: '#ff6a1a', emissiveIntensity: 1.5 });
  box(40.7, y1 - 0.005, 41.9, y1 + 0.04, 0.12, 1.05, null, { material: furnaceMouth, cast: false });
  const tex = signTexture('THE BURN', '#2b1a14', '#ffb46b', { spacing: 10 });
  signPlane(tex, 'S', 41.3, y1 + 0.05, 1.5, 1.9, 0.38, [0.5, 2]);
  windowOn('E', x0, y0, x1, y1, 0.6, 1.4, 0.6, 1.5, WIN_LIT); windowOn('E', x0, y0, x1, y1, 1.8, 2.6, 0.6, 1.5, WIN_LIT);
  // supply tower
  const tx0 = 44.2, tx1 = 46.2, ty0 = 21.8, ty1 = 23.8, th = 7.2;
  box(tx0, ty0, tx1, ty1, 0, th, '#d7cfbf', { r: 0.85 });
  for (const u of [0.35, 1.0, 1.65]) box(tx0 + u - 0.04, ty1, tx0 + u + 0.04, ty1 + 0.05, 0.3, 5.3, '#c6bca9');
  box(tx0 - 0.08, ty0 - 0.08, tx1 + 0.08, ty1 + 0.08, th, th + 0.15, '#bdb19b');
  pyramid(45.2, 22.8, 2.2, th + 0.15, 1.5, '#4251c4', { flat: true, r: 0.6 });
  const sc = textCanvas(1024, 256); const st = new THREE.CanvasTexture(sc); st.colorSpace = THREE.SRGBColorSpace;
  supplyScreen = { canvas: sc, tex: st, last: '' };
  const sm = new THREE.MeshStandardMaterial({ map: st, emissive: '#ffffff', emissiveMap: st, emissiveIntensity: 0.9 }); nightMat(sm, 0.9, 1.7);
  const scr = new THREE.Mesh(SIGN_GEO, sm); scr.scale.set(1.9, 0.48, 1); scr.position.set(45.2, 6.1, ty1 + 0.06); addObj(scr);
  const tex2 = signTexture('ETH SUPPLY', '#1d2340', '#ffffff', { spacing: 8 });
  signPlane(tex2, 'S', 45.2, ty1 + 0.06, 6.7, 1.9, 0.34, [0.4, 1.8]);
  windowOn('S', tx0, ty0, tx1, ty1, 0.7, 1.3, 0.2, 1.4, WIN_LIT);
  CIVIC.burn = endGroup();
  addProxy({ type: 'burn' }, 40, 21.3, 46.2, 24.3, 8);
  LAMPS.push({ x: 39.6, y: 24.4 }, { x: 43.6, y: 24.4 });
}

/* ================= crossing gates ================= */
const GATES = [];
function buildGates() {
  for (const [px, py, dir] of [[36.75, 24.45, 1], [39.25, 26.35, -1]]) {
    cyl(px, py, 0.06, 0, 1.05, '#e8e8ea', { m: 0.3, r: 0.4 }, 8);
    const g = new THREE.Group(); g.position.set(px, 0.95, py);
    for (let i = 0; i < 7; i++) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 0.07), M(i % 2 ? '#ffffff' : '#d7263d', { r: 0.6 }));
      seg.position.set(dir * (0.2 + i * 0.28), 0, 0); seg.castShadow = true; g.add(seg);
    }
    scene.add(g);
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshStandardMaterial({ color: '#400', emissive: '#ff2b1a', emissiveIntensity: 0 }));
    light.position.set(px, 1.18, py); scene.add(light);
    GATES.push({ g, dir, light, angle: Math.PI / 2 });
  }
}

/* ================= clouds & birds ================= */
const CLOUDS = [];
function buildClouds() {
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true, transparent: true, opacity: 0.9 });
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Group();
    const n = 4 + Math.floor(rand() * 4);
    for (let j = 0; j < n; j++) {
      const s = R(0.9, 1.7);
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), mat);
      m.position.set(R(-2.8, 2.8), R(-0.2, 0.9), R(-1.6, 1.6)); m.scale.y = 0.62;
      m.castShadow = true; g.add(m);
    }
    g.position.set(R(-10, 62), R(23, 27), R(-6, 30));
    g.userData.v = R(0.18, 0.34);
    scene.add(g); CLOUDS.push(g);
  }
}

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* =====================================================================
   Ethereum Town — a live miniature of the Ethereum network
   ===================================================================== */
const D = window.ETH_TOWN_DATA;
const $ = (s) => document.querySelector(s);
const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SMALL = window.matchMedia('(max-width: 760px)').matches;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rand = rng(20260928);
const R = (a, b) => a + (b - a) * rand();
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const fmt = (n, d = 0) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
function compact(n, d = 1) { const a = Math.abs(n); if (a >= 1e9) return (n / 1e9).toFixed(d) + 'B'; if (a >= 1e6) return (n / 1e6).toFixed(d) + 'M'; if (a >= 1e4) return Math.round(n / 1e3) + 'K'; if (a >= 1e3) return (n / 1e3).toFixed(1) + 'K'; return fmt(n, 0); }
function usd(n) { const a = Math.abs(n); if (a >= 1e9) return '$' + (n / 1e9).toFixed(a >= 1e10 ? 1 : 2) + 'B'; if (a >= 1e6) return '$' + (n / 1e6).toFixed(0) + 'M'; return '$' + fmt(n); }
function hash01(n) { n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); n ^= n >>> 16; return (n >>> 0) / 4294967296; }

/* ---------------- renderer, scene, camera ---------------- */
const canvas = $('#town');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
const PR = Math.min(window.devicePixelRatio || 1, SMALL ? 1.6 : 2);
renderer.setPixelRatio(PR);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.localClippingEnabled = true;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 700);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.085;
controls.screenSpacePanning = false;
controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
controls.minDistance = 7;
controls.maxDistance = 125;
controls.minPolarAngle = 0.28;
controls.maxPolarAngle = 1.22;
controls.zoomSpeed = 0.9;
controls.panSpeed = 0.9;
controls.rotateSpeed = 0.6;
controls.target.set(26.5, 0, 17);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.25, 0.38, 0.88);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* ---------------- lights & sky ---------------- */
const hemi = new THREE.HemisphereLight(0xdfeeff, 0x8a7a62, 1.0);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2de, 2.6);
sun.castShadow = true;
const SHADOW = SMALL ? 1536 : 3072;
sun.shadow.mapSize.set(SHADOW, SHADOW);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 220 });
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.035;
sun.shadow.radius = 2.5;
scene.add(sun, sun.target);
sun.target.position.set(26, 0, 15.5);

const skyUniforms = { top: { value: new THREE.Color('#8fb8dc') }, mid: { value: new THREE.Color('#dce9f1') }, bot: { value: new THREE.Color('#c9d9e4') } };
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(360, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, uniforms: skyUniforms,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.55, h)) : mix(mid, bot, smoothstep(0.0, -0.35, h)); gl_FragColor = vec4(c, 1.0); }'
  })
);
sky.position.set(26, 0, 15.5);
scene.add(sky);
scene.fog = new THREE.Fog('#cfe3ee', 120, 330);

// stars
const starGeo = new THREE.BufferGeometry();
{
  const n = 900, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = rand(), v = rand() * 0.9 + 0.08;
    const th = u * Math.PI * 2, ph = Math.acos(1 - v);
    pos[i * 3] = 26 + 330 * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = 330 * Math.cos(ph);
    pos[i * 3 + 2] = 15.5 + 330 * Math.sin(ph) * Math.sin(th);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
}
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
const stars = new THREE.Points(starGeo, starMat);
scene.add(stars);

// soft ground shadow under the diorama
{
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(128, 128, 20, 128, 128, 128);
  gr.addColorStop(0, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(95, 70), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(26, -2.6, 15.5);
  scene.add(m);
}

/* ---------------- static geometry buckets ---------------- */
const BUCKETS = new Map();
const MATS = new Map();
function M(hex, o = {}) {
  const k = hex + '|' + (o.r ?? 0.9) + '|' + (o.m ?? 0) + '|' + (o.e || '') + '|' + (o.flat ? 1 : 0);
  let m = MATS.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: hex, roughness: o.r ?? 0.9, metalness: o.m ?? 0, flatShading: !!o.flat });
    if (o.e) { m.emissive = new THREE.Color(o.e); m.emissiveIntensity = o.ei ?? 1; }
    MATS.set(k, m);
  }
  return m;
}
let CAPTURE = null; // when set, geometry goes into a per-building group (so it can fade when it blocks the view)
const GROUPS = [];
function putM(geo, material, cast = true, recv = true, key) {
  const k = (key || material.uuid) + (cast ? 'c' : '') + (recv ? 'r' : '');
  const map = CAPTURE ? CAPTURE.buckets : BUCKETS;
  let b = map.get(k);
  if (!b) { b = { material, geos: [], cast, recv }; map.set(k, b); }
  b.geos.push(geo.index ? geo.toNonIndexed() : geo);
}
function addObj(o) { scene.add(o); if (CAPTURE) CAPTURE.extra.push(o); return o; }
function beginGroup(name) { CAPTURE = { name, buckets: new Map(), extra: [] }; }
function endGroup() {
  const cap = CAPTURE; CAPTURE = null;
  const group = new THREE.Group(); group.name = cap.name;
  const mats = [];
  for (const b of cap.buckets.values()) {
    const geo = mergeGeometries(b.geos, false); if (!geo) continue;
    const mat = b.material.clone();
    const nm = NIGHT_MATS.find((n) => n.m === b.material); if (nm) NIGHT_MATS.push({ m: mat, day: nm.day, night: nm.night });
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = b.cast; mesh.receiveShadow = b.recv;
    group.add(mesh); mats.push(mat);
  }
  const cached = new Set(MATS.values());
  for (const o of cap.extra) {
    scene.remove(o); group.add(o);
    o.traverse((c) => {
      if (!c.material) return;
      if (cached.has(c.material)) c.material = c.material.clone();
      if (!mats.includes(c.material)) mats.push(c.material);
    });
  }
  scene.add(group);
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  const g = { group, mats, box, fade: 1, name: cap.name };
  GROUPS.push(g);
  return g;
}
function setGroupFade(g, f) {
  if (Math.abs(g.fade - f) < 0.002) return;
  g.fade = f;
  for (const m of g.mats) { m.transparent = f < 0.995; m.opacity = f; m.depthWrite = f > 0.6; m.needsUpdate = true; }
}
function put(geo, hex, o = {}) { putM(geo, M(hex, o), o.cast !== false, o.recv !== false); }
// world coords: x = east, y = south (three Z), h = up (three Y)
function box(x0, y0, x1, y1, h0, h1, hex, o) {
  const g = new THREE.BoxGeometry(Math.max(0.001, x1 - x0), Math.max(0.001, h1 - h0), Math.max(0.001, y1 - y0));
  g.translate((x0 + x1) / 2, (h0 + h1) / 2, (y0 + y1) / 2);
  if (o && o.material) putM(g, o.material, o.cast !== false, o.recv !== false); else put(g, hex, o);
  return g;
}
function cyl(x, y, r, h0, h1, hex, o = {}, seg = 12, r2) {
  const g = new THREE.CylinderGeometry(r2 ?? r, r, h1 - h0, seg);
  g.translate(x, (h0 + h1) / 2, y);
  if (o.material) putM(g, o.material, o.cast !== false, o.recv !== false); else put(g, hex, o);
}
function gable(x0, y0, x1, y1, h, rh, hex, o = {}) { // ridge along x
  const d = y1 - y0, s = new THREE.Shape();
  s.moveTo(-d / 2 - 0.08, 0); s.lineTo(d / 2 + 0.08, 0); s.lineTo(0, rh); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: x1 - x0 + 0.16, bevelEnabled: false });
  g.rotateY(Math.PI / 2); g.translate(x0 - 0.08, h, (y0 + y1) / 2);
  put(g, hex, o);
}
function gableY(x0, y0, x1, y1, h, rh, hex, o = {}) { // ridge along y
  const d = x1 - x0, s = new THREE.Shape();
  s.moveTo(-d / 2 - 0.08, 0); s.lineTo(d / 2 + 0.08, 0); s.lineTo(0, rh); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: y1 - y0 + 0.16, bevelEnabled: false });
  g.translate((x0 + x1) / 2, h, y0 - 0.08);
  put(g, hex, o);
}
function pyramid(cx, cy, w, h0, ph, hex, o = {}) {
  const g = new THREE.ConeGeometry(w / Math.SQRT2, ph, 4, 1);
  g.rotateY(Math.PI / 4); g.translate(cx, h0 + ph / 2, cy);
  put(g, hex, o);
}
function flushStatic() {
  for (const b of BUCKETS.values()) {
    const geo = mergeGeometries(b.geos, false);
    if (!geo) continue;
    const mesh = new THREE.Mesh(geo, b.material);
    mesh.castShadow = b.cast; mesh.receiveShadow = b.recv;
    mesh.matrixAutoUpdate = false; mesh.updateMatrix();
    scene.add(mesh);
  }
  BUCKETS.clear();
}

/* ---------------- night-reactive materials ---------------- */
const NIGHT_MATS = []; // {mat, day, night}
function nightMat(m, dayI, nightI) { NIGHT_MATS.push({ m, day: dayI, night: nightI }); return m; }
const WIN_LIT = nightMat(new THREE.MeshStandardMaterial({ color: '#a7bccf', roughness: 0.28, metalness: 0.35, emissive: '#ffc774', emissiveIntensity: 0 }), 0, 0.95);
const WIN_LIT2 = nightMat(new THREE.MeshStandardMaterial({ color: '#a7bccf', roughness: 0.28, metalness: 0.35, emissive: '#fff0cc', emissiveIntensity: 0 }), 0, 0.72);
const WIN_TV = nightMat(new THREE.MeshStandardMaterial({ color: '#a7bccf', roughness: 0.28, metalness: 0.35, emissive: '#8fb6ff', emissiveIntensity: 0 }), 0, 0.6);
const WIN_DARK = new THREE.MeshStandardMaterial({ color: '#8fa4b8', roughness: 0.3, metalness: 0.4 });
const LAMP_MAT = nightMat(new THREE.MeshStandardMaterial({ color: '#fff4d6', emissive: '#ffd89a', emissiveIntensity: 0.1, roughness: 0.4 }), 0.1, 2.6);
const glowCache = new Map();
function glowMat(hex, dayI = 0.25, nightI = 1.4) {
  const k = hex + dayI + nightI;
  if (!glowCache.has(k)) glowCache.set(k, nightMat(new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: dayI, roughness: 0.5 }), dayI, nightI));
  return glowCache.get(k);
}

/* window helper — face: 'S' (+y), 'N' (-y), 'E' (+x), 'W' (-x) */
function winMat(seed) {
  const r = hash01(seed);
  if (r < 0.40) return WIN_LIT;
  if (r < 0.55) return WIN_LIT2;
  if (r < 0.60) return WIN_TV;
  return WIN_DARK;
}
function windowOn(face, x0, y0, x1, y1, u0, u1, v0, v1, material) {
  const t = 0.035, o = 0.012;
  let g;
  if (face === 'S') g = box(x0 + u0, y1 - o, x0 + u1, y1 + t, v0, v1, null, { material, cast: false });
  else if (face === 'N') g = box(x1 - u1, y0 - t, x1 - u0, y0 + o, v0, v1, null, { material, cast: false });
  else if (face === 'E') g = box(x1 - o, y1 - u1, x1 + t, y1 - u0, v0, v1, null, { material, cast: false });
  else g = box(x0 - t, y0 + u0, x0 + o, y0 + u1, v0, v1, null, { material, cast: false });
  return g;
}
function windowGrid(x0, y0, x1, y1, faces, vStart, vEnd, rowH, colW, seed, opts = {}) {
  let n = 0;
  for (const f of faces) {
    const L = (f === 'S' || f === 'N') ? x1 - x0 : y1 - y0;
    const cols = Math.max(1, Math.floor((L - 0.3) / colW));
    const gap = (L - cols * colW) / (cols + 1);
    for (let v = vStart; v + rowH * 0.62 <= vEnd; v += rowH) {
      for (let c = 0; c < cols; c++) {
        const u0 = gap + c * (colW + gap) + colW * 0.12, u1 = u0 + colW * 0.76;
        windowOn(f, x0, y0, x1, y1, u0, u1, v, v + rowH * 0.6, opts.material || winMat(seed * 131 + n++));
      }
    }
  }
}

/* ---------------- text textures ---------------- */
const DISPLAY = '"Big Shoulders Display","Arial Narrow",Impact,sans-serif';
const UI = '"Figtree",system-ui,sans-serif';
function textCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function lum(hex) { const c = new THREE.Color(hex); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; }
function signTexture(text, bg, fg, opts = {}) {
  const w = opts.w || 1024, h = opts.h || 200;
  const c = textCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  if (opts.border) { g.strokeStyle = opts.border; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16); }
  let size = opts.size || Math.round(h * 0.66);
  g.font = `${opts.weight || 800} ${size}px ${opts.family || DISPLAY}`;
  const maxW = w * 0.9;
  while (g.measureText(text).width > maxW && size > 20) { size -= 4; g.font = `${opts.weight || 800} ${size}px ${opts.family || DISPLAY}`; }
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (opts.spacing && g.letterSpacing !== undefined) g.letterSpacing = opts.spacing + 'px';
  g.fillText(text, w / 2, h / 2 + size * 0.04);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
const SIGN_GEO = new THREE.PlaneGeometry(1, 1);
function signPlane(tex, face, x, y, h, w, hh, glow = [0.25, 1.0]) {
  glow = [glow[0], Math.min(glow[1], 1.05)];
  const m = new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: glow[0], roughness: 0.6 });
  nightMat(m, glow[0], glow[1]);
  const mesh = new THREE.Mesh(SIGN_GEO, m);
  mesh.scale.set(w, hh, 1);
  mesh.position.set(x, h, y);
  if (face === 'E') mesh.rotation.y = Math.PI / 2;
  else if (face === 'W') mesh.rotation.y = -Math.PI / 2;
  else if (face === 'N') mesh.rotation.y = Math.PI;
  addObj(mesh);
  return mesh;
}

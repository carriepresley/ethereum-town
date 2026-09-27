import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

/**
 * An original miniature financial city. Buildings, people and streetcars are
 * illustrative, never institution volumes, market shares or validator counts.
 * Only explicitly supplied, deduplicated network observations create pulses.
 */
export function mountFinancialCity(container, places, onSelect = () => {}) {
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.4));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.domElement.style.cssText =
    "display:block;width:100%;height:100%;touch-action:none;cursor:grab;outline:none";
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute(
    "aria-label",
    "Interactive financial city. Select a connected product storefront, Ethereum town hall, a network station, or a wider financial sector. Drag to explore and scroll to zoom. Street life is illustrative; illuminated network pulses represent observed blockchain events.",
  );
  container.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 260);
  // Original scene; the reference's public implementation confirmed that a
  // narrow perspective lens, contact shadows and restrained bloom matter more
  // than filling the frame with a flat orthographic grid.
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  const ambientOcclusion = new GTAOPass(
    scene,
    camera,
    1,
    1,
    undefined,
    { radius: 1.6, thickness: 0.8, distanceFallOff: 1, scale: 1, samples: 8 },
    { samples: 8, radius: 4 },
  );
  ambientOcclusion.blendIntensity = 0.46;
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.38, 0.45, 1.02);
  const depthOfField = new BokehPass(scene, camera, {
    focus: 105,
    aperture: 0.00011,
    maxblur: 0.004,
  });
  const outputPass = new OutputPass();
  for (const pass of [
    renderPass,
    ambientOcclusion,
    bloom,
    depthOfField,
    outputPass,
  ])
    composer.addPass(pass);
  const city = new THREE.Group();
  scene.add(city);
  const connectedGroup = new THREE.Group();
  city.add(connectedGroup);
  const contextGroup = new THREE.Group();
  city.add(contextGroup);
  const infrastructureGroup = new THREE.Group();
  city.add(infrastructureGroup);
  const decorations = new THREE.Group();
  city.add(decorations);
  const geometries = new Set(),
    materials = new Set(),
    textures = new Set(),
    materialCache = new Map(),
    instances = new Set();
  const geo = (geometry) => (geometries.add(geometry), geometry);
  const material = (mat) => (materials.add(mat), mat);
  const boxGeometry = geo(new THREE.BoxGeometry(1, 1, 1));
  const cylinderGeometry = geo(new THREE.CylinderGeometry(1, 1, 1, 12));
  const sphereGeometry = geo(new THREE.IcosahedronGeometry(1, 0));
  const planeGeometry = geo(new THREE.PlaneGeometry(1, 1));
  const coneGeometry = geo(new THREE.ConeGeometry(1, 1, 4));
  function paint(color, roughness = 0.85, metalness = 0) {
    const key = `${color}:${roughness}:${metalness}`;
    if (!materialCache.has(key))
      materialCache.set(
        key,
        material(
          new THREE.MeshStandardMaterial({ color, roughness, metalness }),
        ),
      );
    return materialCache.get(key);
  }
  function cube(parent, x, y, z, w, h, d, color, shadow = true) {
    const mesh = new THREE.Mesh(
      boxGeometry,
      typeof color === "string" ? paint(color) : color,
    );
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function roundedCube(parent, x, y, z, w, h, d, color) {
    const mesh = new THREE.Mesh(
      geo(new RoundedBoxGeometry(w, h, d, 2, Math.min(0.13, h * 0.12))),
      typeof color === "string" ? paint(color) : color,
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function cylinder(parent, x, y, z, r, h, color, shadow = true) {
    const mesh = new THREE.Mesh(
      cylinderGeometry,
      typeof color === "string" ? paint(color) : color,
    );
    mesh.position.set(x, y, z);
    mesh.scale.set(r, h, r);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function leaf(parent, x, y, z, r, color, ys = 1) {
    const mesh = new THREE.Mesh(sphereGeometry, paint(color));
    mesh.position.set(x, y, z);
    mesh.scale.set(r, r * ys, r);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }
  const hemi = new THREE.HemisphereLight("#97a7d8", "#494654", 2.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight("#f3b996", 2.6);
  sun.position.set(-38, 55, 35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -58,
    right: 58,
    top: 62,
    bottom: -54,
    near: 1,
    far: 165,
  });
  sun.shadow.normalBias = 0.045;
  sun.shadow.bias = -0.00015;
  scene.add(sun);
  const rim = new THREE.DirectionalLight("#84a9f0", 1.2);
  rim.position.set(30, 30, -40);
  scene.add(rim);
  const warmGlass = material(
    new THREE.MeshStandardMaterial({
      color: "#c8aa78",
      emissive: "#ffbd64",
      emissiveIntensity: 0.78,
      roughness: 0.52,
    }),
  );
  const contextWarmGlass = material(
    new THREE.MeshStandardMaterial({
      color: "#b7bba7",
      emissive: "#a4b2a7",
      emissiveIntensity: 0.16,
      roughness: 0.5,
    }),
  );
  const contextGlass = material(
    new THREE.MeshStandardMaterial({
      color: "#889da9",
      emissive: "#b5c5cf",
      emissiveIntensity: 0.1,
      roughness: 0.4,
      metalness: 0.1,
    }),
  );
  const darkGlass = paint("#25434c", 0.28, 0.14);
  const lampMaterial = material(
    new THREE.MeshStandardMaterial({
      color: "#ffdf9f",
      emissive: "#ffb452",
      emissiveIntensity: 2.0,
    }),
  );
  const blueLight = material(
    new THREE.MeshStandardMaterial({
      color: "#a9ddff",
      emissive: "#78c8ff",
      emissiveIntensity: 0.9,
    }),
  );
  const routeMaterial = material(
    new THREE.MeshStandardMaterial({
      color: "#84c2d5",
      emissive: "#4b9dbf",
      emissiveIntensity: 0.16,
      roughness: 0.6,
    }),
  );
  const selectedMaterial = material(
    new THREE.MeshBasicMaterial({
      color: "#ffdf99",
      transparent: true,
      opacity: 0.83,
      depthWrite: false,
      toneMapped: false,
    }),
  );

  // A single civic plaza with walkable streets. Dimensions are composition,
  // never economic weight. The hall is the visual anchor, not a market-cap bar.
  const HALL = { x: 4, z: -3 };
  const networkDefinitions = [
    [
      "base",
      "Base",
      "#4f87ff",
      -22,
      8,
      [
        [-22, 12],
        [-22, 16],
        [-7, 16],
        [-7, 7],
        [4, 7],
        [4, 3.7],
      ],
    ],
    [
      "arbitrum",
      "Arbitrum",
      "#7fcfe8",
      24,
      7,
      [
        [24, 11],
        [24, 16],
        [13, 16],
        [13, 7],
        [4, 7],
        [4, 3.7],
      ],
    ],
    [
      "optimism",
      "OP Mainnet",
      "#fa8b7d",
      -24,
      -11,
      [
        [-24, -7],
        [-17, -7],
        [-17, 7],
        [4, 7],
        [4, 3.7],
      ],
    ],
    [
      "starknet",
      "Starknet",
      "#bd9fe7",
      25,
      -12,
      [
        [25, -8],
        [17, -8],
        [17, 7],
        [4, 7],
        [4, 3.7],
      ],
    ],
    [
      "zksync-era",
      "ZKsync",
      "#a9ace9",
      -12,
      -26,
      [
        [-12, -22],
        [-12, -16],
        [-7, -16],
        [-7, 7],
        [4, 7],
        [4, 3.7],
      ],
    ],
    [
      "linea",
      "Linea",
      "#b0cf9b",
      7,
      -27,
      [
        [7, -23],
        [7, -17],
        [17, -17],
        [17, 7],
        [4, 7],
        [4, 3.7],
      ],
    ],
    [
      "mantle",
      "Mantle",
      "#8fd4c3",
      33,
      -29,
      [
        [33, -25],
        [33, -18],
        [17, -18],
        [17, 7],
        [4, 7],
        [4, 3.7],
      ],
    ],
    [
      "ink",
      "Ink",
      "#b68be9",
      -32,
      -28,
      [
        [-32, -24],
        [-32, -18],
        [-17, -18],
        [-17, 7],
        [4, 7],
        [4, 3.7],
      ],
    ],
    [
      "unichain",
      "Unichain",
      "#f0a4ca",
      -1,
      24,
      [
        [-1, 28],
        [-7, 28],
        [-7, 7],
        [4, 7],
        [4, 3.7],
      ],
    ],
  ];
  const shopSlots = [
    [-24, 29],
    [-13, 29],
    [-30, 17],
    [18, 29],
    [30, 28],
    [31, 17],
    [-32, 1],
    [30, -2],
    [-3, -14],
  ];
  const blockDefs = [
    ...networkDefinitions.map(([, , , x, z]) => [x, z, 9.8, 9.8]),
    ...shopSlots.map(([x, z]) => [x, z, 7.2, 7.2]),
    [4, -3, 19.5, 15.4],
  ];
  cube(city, 0, -1.3, -8, 87, 2, 96, "#293640");
  cube(city, 0, -0.24, -8, 86, 0.24, 95, "#445554");
  cube(scene, 0, -2.4, 0, 900, 0.15, 900, "#15242e", false);
  const roadColor = "#25343d";
  function streetSegment(parent, a, b, width, y, height, surface) {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz);
    if (!length) return;
    const strip = cube(
      parent,
      (a[0] + b[0]) / 2,
      y,
      (a[1] + b[1]) / 2,
      width,
      height,
      length,
      surface,
      false,
    );
    strip.rotation.y = Math.atan2(dx, dz);
    return strip;
  }
  // A quiet perimeter avenue makes the separate neighborhoods one city.
  for (const [a, b] of [
    [
      [-38, 34],
      [38, 34],
    ],
    [
      [-38, 34],
      [-38, -42],
    ],
    [
      [38, 34],
      [38, -42],
    ],
    [
      [-38, -42],
      [38, -42],
    ],
  ])
    streetSegment(city, a, b, 3.5, 0.015, 0.045, roadColor);
  for (const [, , , , , path] of networkDefinitions)
    for (let i = 1; i < path.length; i++) {
      streetSegment(city, path[i - 1], path[i], 3.8, 0.025, 0.05, "#899488");
      streetSegment(city, path[i - 1], path[i], 3.1, 0.061, 0.03, roadColor);
    }
  for (const [x, z, w, d] of blockDefs) {
    cube(city, x, 0.2, z, w, 0.28, d, "#93998a", false);
    cube(city, x, 0.351, z, w - 0.28, 0.022, d - 0.28, "#b4b39d", false);
    for (let j = -Math.floor(w / 2) + 1; j < w / 2; j += 2)
      cube(city, x + j, 0.367, z, 0.018, 0.009, d - 0.4, "#999d8d", false);
  }
  // Circular paving around the hall reads as a civic square, with no radial
  // ranking or implication that every L2 uses the same data-availability model.
  cylinder(city, HALL.x, 0.13, HALL.z + 5.6, 10.7, 0.16, "#7f9188", false);
  cylinder(city, HALL.x, 0.23, HALL.z + 5.6, 9.7, 0.09, "#aaa990", false);
  for (const x of [-17, 17])
    for (let stripe = 0; stripe < 5; stripe++)
      cube(
        city,
        x - 1.25 + stripe * 0.62,
        0.39,
        7,
        0.28,
        0.025,
        1.15,
        "#d4cfb4",
        false,
      );

  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = 128;
  glowCanvas.height = 128;
  const glowContext = glowCanvas.getContext("2d");
  const gradient = glowContext.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,211,123,.82)");
  gradient.addColorStop(0.35, "rgba(255,187,89,.26)");
  gradient.addColorStop(1, "rgba(255,170,80,0)");
  glowContext.fillStyle = gradient;
  glowContext.fillRect(0, 0, 128, 128);
  const glowTexture = new THREE.CanvasTexture(glowCanvas);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  textures.add(glowTexture);
  const glowMaterial = material(
    new THREE.MeshBasicMaterial({
      map: glowTexture,
      transparent: true,
      opacity: 0.69,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  function glow(parent, x, z, size = 4) {
    const mesh = new THREE.Mesh(planeGeometry, glowMaterial);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.469, z);
    mesh.scale.set(size, size, 1);
    parent.add(mesh);
  }
  function lamp(x, z) {
    cylinder(decorations, x, 2.25, z, 0.055, 3.8, "#43535a");
    cube(decorations, x + 0.38, 4.14, z, 0.87, 0.08, 0.11, "#43535a");
    cube(decorations, x + 0.75, 4.06, z, 0.4, 0.14, 0.37, lampMaterial, false);
    glow(decorations, x + 0.65, z, 5.4);
  }
  function tree(x, z, s = 1, parent = decorations) {
    cube(parent, x, 0.56, z, 1.45 * s, 0.27, 1.45 * s, "#777c71");
    cylinder(parent, x, 1.37 * s + 0.4, z, 0.135 * s, 1.8 * s, "#7b6451");
    leaf(parent, x, 2.55 * s + 0.4, z, 1.12 * s, "#708c76", 1.16);
    leaf(
      parent,
      x + 0.48 * s,
      2.45 * s + 0.4,
      z + 0.15 * s,
      0.7 * s,
      "#95a17c",
      1.16,
    );
  }
  function planter(parent, x, z, w = 1.7, y = 0.48) {
    cube(parent, x, y + 0.18, z, w, 0.36, 0.5, "#8b796a");
    cube(parent, x, y + 0.37, z, w - 0.12, 0.08, 0.38, "#476456");
    for (let i = 0; i < 3; i++) {
      leaf(parent, x + (i - 1) * w * 0.29, y + 0.5, z, 0.23, "#6b8a68", 0.8);
      leaf(
        parent,
        x + (i - 1) * w * 0.29 + 0.08,
        y + 0.68,
        z,
        0.065,
        i % 2 ? "#e1b47f" : "#ca91a1",
        0.9,
      );
    }
  }
  function bench(parent, x, z, rotation = 0) {
    const group = new THREE.Group();
    group.position.set(x, 0.46, z);
    group.rotation.y = rotation;
    parent.add(group);
    cube(group, 0, 0.5, 0, 1.7, 0.12, 0.47, "#9c7d5c");
    cube(group, 0, 0.84, -0.19, 1.7, 0.47, 0.09, "#9c7d5c");
    for (const xx of [-0.62, 0.62])
      cube(group, xx, 0.24, 0, 0.09, 0.48, 0.43, "#475351");
  }
  function cafe(parent, x, z, color) {
    const group = new THREE.Group();
    group.position.set(x, 0.47, z);
    parent.add(group);
    cylinder(group, 0, 0.52, 0, 0.06, 1.04, "#5c675f");
    cylinder(group, 0, 1.05, 0, 0.6, 0.1, "#c5af83");
    cylinder(group, 0, 1.3, 0, 0.035, 2.6, "#b6a17b");
    const umbrella = new THREE.Mesh(
      geo(new THREE.ConeGeometry(1.22, 0.36, 8)),
      paint(color),
    );
    umbrella.position.y = 2.78;
    umbrella.castShadow = true;
    group.add(umbrella);
    for (const xx of [-0.88, 0.88]) {
      cube(group, xx, 0.52, 0, 0.43, 0.11, 0.5, "#b9976d");
      cube(group, xx, 0.28, 0, 0.1, 0.53, 0.33, "#657568");
      cube(group, xx * 1.16, 0.83, 0, 0.075, 0.53, 0.47, "#b9976d");
    }
  }
  function bicycle(parent, x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0.51, z);
    parent.add(group);
    const wheelGeometry = geo(new THREE.TorusGeometry(0.28, 0.038, 5, 10));
    for (const xx of [-0.45, 0.45]) {
      const wheel = new THREE.Mesh(wheelGeometry, paint("#415251"));
      wheel.position.set(xx, 0.28, 0);
      group.add(wheel);
    }
    const lineGeometry = geo(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.45, 0.28, 0),
        new THREE.Vector3(-0.08, 0.68, 0),
        new THREE.Vector3(0.2, 0.28, 0),
        new THREE.Vector3(-0.45, 0.28, 0),
        new THREE.Vector3(0.2, 0.28, 0),
        new THREE.Vector3(0.3, 0.66, 0),
        new THREE.Vector3(-0.08, 0.68, 0),
        new THREE.Vector3(0.3, 0.66, 0),
        new THREE.Vector3(0.45, 0.28, 0),
      ]),
    );
    group.add(
      new THREE.Line(
        lineGeometry,
        material(new THREE.LineBasicMaterial({ color: "#be9670" })),
      ),
    );
    cube(group, -0.08, 0.74, 0, 0.24, 0.06, 0.12, "#36484a");
    cube(group, 0.28, 0.88, 0, 0.24, 0.04, 0.08, "#6b7978");
  }
  const hits = [],
    roots = new Map(),
    locations = new Map(),
    buildingRoots = [],
    routeRoots = [];
  function register(group, id, x, z, height = 3) {
    group.userData.placeId = id;
    roots.set(id, group);
    locations.set(id, new THREE.Vector3(x, height, z));
    group.traverse((child) => {
      if (child.isMesh) {
        child.userData.placeId = id;
        hits.push(child);
      }
    });
  }
  function label(parent, text, subtitle, w, h, y, z, color, rotation = 0) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1024, 256);
    ctx.fillStyle = "rgba(255,255,255,.26)";
    ctx.fillRect(10, 10, 1004, 2);
    ctx.fillRect(10, 244, 1004, 2);
    ctx.fillStyle = "#fffaf0";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let size = subtitle ? 106 : 132;
    ctx.font = `700 ${size}px Arial, sans-serif`;
    const cleanText = String(text).toUpperCase();
    while (ctx.measureText(cleanText).width > 934 && size > 25) {
      size -= 2;
      ctx.font = `700 ${size}px Arial, sans-serif`;
    }
    ctx.fillText(cleanText, 512, subtitle ? 95 : 132);
    if (subtitle) {
      let subSize = 37;
      ctx.font = `600 ${subSize}px Arial, sans-serif`;
      while (
        ctx.measureText(String(subtitle).toUpperCase()).width > 934 &&
        subSize > 22
      ) {
        subSize--;
        ctx.font = `600 ${subSize}px Arial, sans-serif`;
      }
      ctx.fillStyle = "#eee9dc";
      ctx.fillText(String(subtitle).toUpperCase(), 512, 194);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    textures.add(texture);
    const mesh = new THREE.Mesh(
      planeGeometry,
      material(
        new THREE.MeshBasicMaterial({
          map: texture,
          toneMapped: false,
          side: THREE.DoubleSide,
        }),
      ),
    );
    mesh.position.set(0, y, z);
    mesh.scale.set(w, h, 1);
    mesh.rotation.y = rotation;
    parent.add(mesh);
    return mesh;
  }

  const connectedPlaces = places.filter((p) => p.status !== "context");
  const contextPlaces = places.filter((p) => p.status === "context");
  const palettes = [
    "#dcc49d",
    "#d4c6a5",
    "#dfb79a",
    "#c5c4a4",
    "#d3c0a0",
    "#c6c4a2",
    "#d7ba91",
    "#d1bca7",
  ];
  function storefront(place, index) {
    const [x, z] = shopSlots[index % shopSlots.length];
    const shopScale = 0.63;
    const group = new THREE.Group();
    group.position.set(x, 0.06, z);
    group.scale.setScalar(shopScale);
    connectedGroup.add(group);
    buildingRoots.push({ group, status: place.status });
    const w = index % 4 === 0 || index % 4 === 3 ? 8.6 : 8.1,
      d = 7.5,
      h = 7.35 + (index % 3) * 0.4,
      color = place.color || "#677f8c",
      bodyColor = palettes[index % palettes.length];
    roundedCube(group, 0, h / 2 + 0.47, 0, w, h, d, bodyColor);
    cube(group, 0, 0.68, 0, w + 0.14, 0.42, d + 0.14, "#9d9d8d");
    cube(group, 0, h + 0.5, 0, w + 0.33, 0.24, d + 0.35, "#d8cfb6");
    cube(group, 0, h + 0.7, 0, w - 0.2, 0.16, d - 0.2, "#818d85");
    for (const sx of [-1, 1])
      cube(group, sx * (w / 2 - 0.02), h + 0.9, 0, 0.14, 0.55, d, "#bcb8a3");
    for (const sz of [-1, 1])
      cube(group, 0, h + 0.9, sz * (d / 2 - 0.03), w, 0.55, 0.14, "#cbc3aa");
    // Warm lit display windows, inset door and a striped, tactile shop awning.
    for (const xx of [-w * 0.31, w * 0.31]) {
      cube(
        group,
        xx,
        1.95,
        d / 2 + 0.035,
        w * 0.26,
        2.44,
        0.065,
        warmGlass,
        false,
      );
      cube(group, xx, 1.95, d / 2 + 0.08, 0.06, 2.44, 0.035, "#dfceb1", false);
      cube(
        group,
        xx,
        1.75,
        d / 2 + 0.085,
        w * 0.26,
        0.07,
        0.035,
        "#dfceb1",
        false,
      );
      cube(group, xx, 2.66, d / 2 + 0.1, w * 0.18, 0.11, 0.1, "#d2bc94", false);
      for (const a of [-0.35, 0.35])
        cube(
          group,
          xx + a,
          1.34,
          d / 2 + 0.1,
          0.24,
          0.35,
          0.09,
          index % 2 ? "#638b89" : "#af796a",
          false,
        );
    }
    cube(group, 0, 1.85, d / 2 + 0.045, 1.38, 2.4, 0.085, darkGlass, false);
    cube(group, 0.44, 1.84, d / 2 + 0.1, 0.06, 0.51, 0.06, "#dcc086", false);
    cube(group, 0, 0.56, d / 2 + 0.45, 1.8, 0.16, 0.9, "#d8d0b8");
    for (let stripe = 0; stripe < 16; stripe++) {
      const stripeColor = stripe % 2 === 0 ? color : "#eee1c3";
      const awning = cube(
        group,
        -w / 2 + 0.27 + (stripe * w) / 16,
        3.5,
        d / 2 + 0.66,
        w / 16 + 0.005,
        0.1,
        1.55,
        stripeColor,
      );
      awning.rotation.x = 0.16;
      cube(
        group,
        -w / 2 + 0.27 + (stripe * w) / 16,
        3.26,
        d / 2 + 1.4,
        w / 16 + 0.005,
        0.3,
        0.075,
        stripeColor,
      );
    }
    label(
      group,
      place.name,
      place.product,
      w - 0.32,
      1.26,
      4.34,
      d / 2 + 0.11,
      color,
    );
    const upperY = 6.24 + (index % 3) * 0.19;
    for (const xx of [-w * 0.28, w * 0.28]) {
      cube(
        group,
        xx,
        upperY,
        d / 2 + 0.038,
        1.85,
        1.83,
        0.065,
        warmGlass,
        false,
      );
      cube(
        group,
        xx,
        upperY,
        d / 2 + 0.089,
        0.068,
        1.85,
        0.042,
        "#daceaa",
        false,
      );
      cube(
        group,
        xx,
        upperY - 0.18,
        d / 2 + 0.09,
        1.85,
        0.075,
        0.043,
        "#daceaa",
        false,
      );
      cube(group, xx, upperY - 0.98, d / 2 + 0.18, 2.1, 0.15, 0.42, "#ded0aa");
      cube(group, xx, upperY + 0.98, d / 2 + 0.12, 2.15, 0.15, 0.22, "#ddccaa");
      planter(group, xx, d / 2 + 0.22, 1.7, upperY - 1.02);
    }
    for (const sx of [-1, 1])
      for (const zz of [-2, 1.15]) {
        cube(
          group,
          sx * (w / 2 + 0.02),
          2.5,
          zz,
          0.055,
          2.25,
          1.35,
          warmGlass,
          false,
        );
        cube(
          group,
          sx * (w / 2 + 0.021),
          upperY,
          zz,
          0.055,
          1.83,
          1.35,
          warmGlass,
          false,
        );
        cube(
          group,
          sx * (w / 2 + 0.07),
          upperY,
          zz,
          0.035,
          1.85,
          0.055,
          "#daceaa",
          false,
        );
      }
    // Each product gets its actual observed network as a station-style plaque.
    const statusGroup = new THREE.Group();
    statusGroup.position.set(w / 2 - 0.73, 0, d / 2 + 1.6);
    group.add(statusGroup);
    cylinder(statusGroup, 0, 1.24, 0, 0.035, 1.55, "#617571");
    label(
      statusGroup,
      place.status === "pilot" ? "PILOT" : "CONNECTED",
      place.networkId ? networkName(place.networkId) : "SELECTED PRODUCT",
      2.15,
      0.62,
      2.13,
      0.05,
      place.status === "pilot" ? "#94773f" : "#416d66",
    );
    glow(group, -w * 0.26, d / 2 + 1.3, 6.6);
    glow(group, w * 0.26, d / 2 + 1.3, 6.6);
    planter(group, -w / 2 - 0.6, d / 2 - 0.05, 1.3);
    bicycle(group, w / 2 + 0.8, 0.8);
    if (index % 2 === 0)
      cafe(group, -w / 2 - 0.25, -1.4, index % 3 ? "#b2b9a1" : "#dab98a");
    cube(group, -1.8, h + 1.13, -1.25, 1.5, 0.7, 1.65, "#88978e");
    for (let j = 0; j < 4; j++)
      cube(
        group,
        -2.31 + j * 0.34,
        h + 1.5,
        -1.25,
        0.13,
        0.025,
        1.24,
        "#57696a",
        false,
      );
    if (index % 3 === 1) {
      cafe(group, 1.45, -0.75, color);
      const terrace = group.children[group.children.length - 1];
      terrace.position.y = h + 0.93;
    }
    planter(group, 1.5, -d / 2 + 0.55, 2.0, h + 0.95);
    register(group, place.id, x, z, 2.2);
  }
  connectedPlaces.slice(0, 9).forEach(storefront);

  // Wider finance remains inhabited and operating. Muted materials indicate
  // contextual sectors, not empty lots or a prediction that they will migrate.
  const contextSlots = [
    [-32, -49],
    [-19, -50],
    [-6, -50],
    [8, -50],
    [22, -50],
    [35, -49],
  ];
  contextPlaces.slice(0, 6).forEach((place, index) => {
    const [x, z] = contextSlots[index];
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    contextGroup.add(group);
    buildingRoots.push({ group, status: "context" });
    const w = 7.0,
      d = 6.4,
      h = 6.0 + (index % 3) * 1.25;
    cube(
      group,
      0,
      h / 2 + 0.48,
      0,
      w,
      h,
      d,
      ["#4f646d", "#536870", "#4e646d", "#5b6e74"][index % 4],
    );
    cube(group, 0, 0.68, 0, w + 0.3, 0.45, d + 0.3, "#a0a8a3");
    cube(group, 0, h + 0.66, 0, w + 0.15, 0.32, d + 0.15, "#a0aaa8");
    for (const xx of [-w * 0.32, 0, w * 0.32])
      for (let floor = 0; floor < Math.floor(h / 2.15); floor++)
        cube(
          group,
          xx,
          1.6 + floor * 2.05,
          d / 2 + 0.025,
          1.65,
          1.19,
          0.05,
          (floor + index) % 4 === 0 ? contextWarmGlass : contextGlass,
          false,
        );
    for (const sx of [-1, 1])
      for (const zz of [-1.9, 1.1])
        cube(
          group,
          sx * (w / 2 + 0.026),
          h / 2 + 0.5,
          zz,
          0.052,
          h - 1.15,
          1.0,
          contextGlass,
          false,
        );
    cube(group, 0, h + 1.25, -0.4, w * 0.55, 1.0, d * 0.55, "#647881");
    label(
      group,
      place.name,
      "WIDER FINANCE",
      w - 0.3,
      1.2,
      3.17,
      d / 2 + 0.08,
      "#546c79",
    );
    cube(group, 0, 1.35, d / 2 + 0.09, 1.2, 1.65, 0.055, darkGlass, false);
    tree(x - w / 2 - 0.7, z + 2.8, 0.73);
    bench(group, w / 2 + 0.5, -1.7, Math.PI / 2);
    register(group, place.id, x, z, h * 0.45);
  });

  // Ethereum is a civic anchor of the connected quarter, rather than a giant
  // tallest-building metric. Staking appears as an illuminated foundation.
  const hall = new THREE.Group();
  hall.position.set(HALL.x, 0, HALL.z);
  infrastructureGroup.add(hall);
  cube(hall, 0, 0.71, 0, 15.5, 0.6, 10.5, "#afa98f");
  cube(hall, 0, 1.08, 0, 14.65, 0.21, 10.0, "#d0c8ad");
  roundedCube(hall, 0, 4.7, -0.6, 12.5, 7.2, 7.7, "#d9ceae");
  for (let step = 0; step < 4; step++)
    cube(
      hall,
      0,
      0.54 + step * 0.19,
      6.65 - step * 0.46,
      13.4 - step * 0.33,
      0.23,
      1.3,
      "#c9c2a9",
    );
  for (const xx of [-5.2, -2.6, 0, 2.6, 5.2]) {
    cylinder(hall, xx, 4.03, 4.45, 0.28, 5.72, "#e2d6b9");
    cylinder(hall, xx, 1.16, 4.45, 0.43, 0.24, "#bcbaaa");
    cylinder(hall, xx, 6.96, 4.45, 0.43, 0.23, "#e8dabb");
  }
  for (const xx of [-3.7, 0, 3.7]) {
    const shape = new THREE.Shape(),
      w = 1.72,
      h = 4.8,
      r = w / 2;
    shape.moveTo(-r, 0);
    shape.lineTo(r, 0);
    shape.lineTo(r, h - r);
    shape.absarc(0, h - r, r, 0, Math.PI, false);
    shape.lineTo(-r, 0);
    const windowMesh = new THREE.Mesh(
      geo(new THREE.ShapeGeometry(shape, 20)),
      warmGlass,
    );
    windowMesh.position.set(xx, 1.58, 3.31);
    hall.add(windowMesh);
    cube(hall, xx, 3.35, 3.38, 0.075, 3.6, 0.04, "#a7956f", false);
    cube(hall, xx, 3.08, 3.39, w, 0.075, 0.04, "#a7956f", false);
    cube(hall, xx, 1.97, 3.4, w - 0.22, 0.52, 0.07, "#665f4d", false);
    cube(hall, xx, 2.32, 3.43, w - 0.15, 0.08, 0.2, "#b49b70", false);
    for (const offset of [-0.36, 0.36])
      cube(hall, xx + offset, 2.72, 3.41, 0.2, 0.43, 0.1, "#76694d", false);
  }
  cube(hall, 0, 7.37, 4.45, 13.2, 0.64, 1.1, "#d2c7ab");
  label(
    hall,
    "ETHEREUM",
    "SETTLEMENT + SECURITY",
    12.0,
    1.15,
    7.27,
    5.03,
    "#4f697e",
  );
  cube(hall, 0, 8.36, -0.18, 13.75, 0.3, 10.12, "#a3a894");
  const hallRoof = new THREE.Mesh(coneGeometry, paint("#698492", 0.67, 0.12));
  hallRoof.rotation.y = Math.PI / 4;
  hallRoof.scale.set(9.6, 2.9, 6.9);
  hallRoof.position.set(0, 9.9, -0.55);
  hallRoof.castShadow = true;
  hall.add(hallRoof);
  cylinder(hall, 0, 11.13, -0.55, 2.0, 1.3, "#c7c6ac");
  cylinder(hall, 0, 11.85, -0.55, 2.27, 0.2, "#abae9f");
  const dome = new THREE.Mesh(
    geo(new THREE.SphereGeometry(1.4, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)),
    paint("#84a3ad", 0.55, 0.12),
  );
  dome.position.set(0, 11.99, -0.55);
  dome.castShadow = true;
  hall.add(dome);
  const symbol = new THREE.Group();
  symbol.position.set(0, 16.14, -0.55);
  symbol.scale.setScalar(0.9);
  hall.add(symbol);
  const topGem = new THREE.Mesh(
    geo(new THREE.ConeGeometry(1.1, 2.7, 4)),
    material(
      new THREE.MeshStandardMaterial({
        color: "#c5d3ff",
        emissive: "#a5b5ee",
        emissiveIntensity: 0.65,
        roughness: 0.3,
        metalness: 0.15,
      }),
    ),
  );
  topGem.rotation.y = Math.PI / 4;
  symbol.add(topGem);
  const lowerGem = new THREE.Mesh(
    geo(new THREE.ConeGeometry(1.1, 1.3, 4)),
    paint("#7698c4", 0.3, 0.15),
  );
  lowerGem.rotation.set(Math.PI, Math.PI / 4, 0);
  lowerGem.position.y = -2.12;
  symbol.add(lowerGem);
  for (const xx of [-9.5, 9.5]) {
    tree(HALL.x + xx, HALL.z - 2.5, 0.85);
    bench(hall, xx, 3.4, xx > 0 ? -Math.PI / 2 : Math.PI / 2);
  }
  register(hall, "ethereum", HALL.x, HALL.z, 6.0);
  const staking = new THREE.Group();
  staking.position.set(HALL.x, 0, HALL.z);
  infrastructureGroup.add(staking);
  for (let side = -1; side <= 1; side += 2)
    for (let i = 0; i < 9; i++) {
      const x = side * 7.7,
        z = -4.2 + i * 1.16;
      cylinder(staking, x, 0.8, z, 0.14, 0.8, "#708697");
      cylinder(staking, x, 1.27, z, 0.16, 0.17, blueLight, false);
    }
  for (let i = 0; i < 11; i++)
    cylinder(
      staking,
      -6.2 + i * 1.24,
      0.82,
      -5.5,
      0.15,
      0.28,
      blueLight,
      false,
    );
  const stakingSign = new THREE.Group();
  stakingSign.position.set(0, 0, 7.7);
  staking.add(stakingSign);
  label(
    stakingSign,
    "ETH STAKING",
    "THE SECURITY FOUNDATION",
    5.3,
    0.83,
    0.77,
    0.0,
    "#42657c",
  );
  register(staking, "staking", HALL.x, HALL.z + 3, 1.5);

  function networkName(id) {
    if (id === "ethereum") return "Ethereum";
    return (
      {
        base: "Base",
        arbitrum: "Arbitrum",
        optimism: "OP Mainnet",
        op: "OP Mainnet",
        starknet: "Starknet",
        "zksync-era": "ZKsync",
        zksync: "ZKsync",
        linea: "Linea",
        mantle: "Mantle",
        ink: "Ink",
        unichain: "Unichain",
      }[id] || id
    );
  }
  const stations = new Map(),
    stationLamps = new Map(),
    lastBlockHashes = new Map(),
    blockPulseTimes = new Map();
  const networkRouteMaterials = new Map(),
    productRouteMaterials = new Map();
  const routePaths = new Map();
  function drawRoute(points, color, width = 0.11) {
    const route = new THREE.Group();
    infrastructureGroup.add(route);
    const surface = material(
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.3,
        roughness: 0.65,
        transparent: true,
        opacity: 0.54,
      }),
    );
    for (let i = 1; i < points.length; i++)
      streetSegment(
        route,
        points[i - 1],
        points[i],
        width,
        0.408,
        0.04,
        surface,
      );
    return surface;
  }
  networkDefinitions.forEach(([id, name, color, x, z, path], i) => {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    infrastructureGroup.add(group);
    // Every network has an actual neighborhood hub: a generous illuminated
    // nameplate, warm doors, its own roof silhouette and a track to the hall.
    const h = 4.6 + (i % 3) * 0.45,
      w = 7.2,
      d = 5.6;
    cube(group, 0, 0.55, 0, w + 0.5, 0.34, d + 0.5, "#9f9e85");
    roundedCube(
      group,
      0,
      h / 2 + 0.68,
      0,
      w,
      h,
      d,
      ["#b8b897", "#b8ab93", "#c4b397"][i % 3],
    );
    cube(group, 0, h + 0.82, 0, w + 0.7, 0.3, d + 0.7, "#d0c3a1");
    for (const xx of [-2.35, 0, 2.35]) {
      cube(group, xx, 2.1, d / 2 + 0.04, 1.35, 2.6, 0.1, warmGlass, false);
      cube(group, xx, 2.1, d / 2 + 0.13, 0.055, 2.6, 0.04, "#cfc4a5", false);
    }
    cube(group, 0, 3.47, d / 2 + 0.8, w + 0.75, 0.12, 1.8, color);
    cube(group, 0, 3.32, d / 2 + 1.64, w + 0.75, 0.2, 0.11, color);
    label(
      group,
      name,
      "L2 NEIGHBORHOOD",
      w + 1.15,
      1.32,
      h - 0.05,
      d / 2 + 0.18,
      color,
    );
    if (i % 3 === 0) {
      const roof = new THREE.Mesh(coneGeometry, paint("#4d7072"));
      roof.rotation.y = Math.PI / 4;
      roof.scale.set(5.35, 2.15, 4.15);
      roof.position.set(0, h + 2.02, 0);
      roof.castShadow = true;
      group.add(roof);
    } else if (i % 3 === 1) {
      cylinder(group, 0, h + 1.55, 0, 2.25, 1.18, "#8aa6a2");
      const dome = new THREE.Mesh(
        geo(
          new THREE.SphereGeometry(2.25, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        ),
        paint("#557781"),
      );
      dome.position.set(0, h + 2.13, 0);
      dome.castShadow = true;
      group.add(dome);
    } else {
      cube(group, 0, h + 1.25, 0, 5.4, 0.55, 4.0, "#798d81");
      planter(group, 0, -1.45, 4.5, h + 1.53);
      cube(group, 1.6, h + 2.06, 0, 1.25, 1.6, 1.25, "#afb596");
    }
    const light = material(
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.18,
        roughness: 0.25,
      }),
    );
    cylinder(group, -3.55, 1.2, 3.9, 0.07, 1.55, "#647976");
    cylinder(group, -3.55, 2.02, 3.9, 0.22, 0.23, light, false);
    stationLamps.set(id, light);
    glow(group, -2, 3.9, 6);
    glow(group, 2, 3.9, 6);
    planter(group, -4.1, 0.3, 1.2);
    bicycle(group, 4.1, 1.0);
    register(group, id, x, z, 3.5);
    const station = { x, z, color, path };
    stations.set(id, station);
    routePaths.set(id, path);
    networkRouteMaterials.set(id, drawRoute(path, color, 0.14));
  });
  // Product routes express documented deployment only. They never manufacture
  // token transfers or institutional traffic. Selection highlights this path.
  const ethEntrance = [HALL.x, HALL.z + 6.7];
  const productPaths = {
    usdc: [[-24, 31.7], [-24, 34], [-7, 34], [-7, 7], [4, 7], ethEntrance],
    usdt: [[-13, 31.7], [-13, 34], [-7, 34], [-7, 7], [4, 7], ethEntrance],
    uniswap: [
      [-30, 19.7],
      [-30, 16],
      [-22, 16],
      [-22, 12],
    ],
    aave: [[18, 31.7], [18, 34], [13, 34], [13, 7], [4, 7], ethEntrance],
    buidl: [[30, 30.7], [30, 34], [13, 34], [13, 7], [4, 7], ethEntrance],
    benji: [
      [31, 19.7],
      [31, 16],
      [24, 16],
      [24, 11],
    ],
    jpmcoin: [
      [-32, 3.7],
      [-32, 12],
      [-22, 12],
    ],
    visa: [[30, 0.7], [35, 0.7], [35, 7], [4, 7], ethEntrance],
    lido: [[-3, -11.3], [-7, -11.3], [-7, 7], [4, 7], ethEntrance],
  };
  for (const place of connectedPlaces) {
    const path = productPaths[place.id];
    if (!path) continue;
    productRouteMaterials.set(
      place.id,
      drawRoute(path, place.status === "pilot" ? "#d3b275" : "#bfcea8", 0.09),
    );
  }
  // A status beacon has no implied score. It is gray until verified health
  // arrives, amber for the caller's defined attention state, and mint otherwise.
  const healthMaterial = material(
    new THREE.MeshStandardMaterial({
      color: "#a3adb5",
      emissive: "#a3adb5",
      emissiveIntensity: 0.15,
      roughness: 0.3,
    }),
  );
  const healthBeacon = new THREE.Mesh(
    geo(new THREE.SphereGeometry(0.36, 12, 8)),
    healthMaterial,
  );
  healthBeacon.position.set(0, 17.8, -0.55);
  hall.add(healthBeacon);
  const heartbeatRing = new THREE.Mesh(
    geo(new THREE.RingGeometry(9.8, 10.02, 80)),
    material(
      new THREE.MeshBasicMaterial({
        color: "#c5f3d5",
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      }),
    ),
  );
  heartbeatRing.rotation.x = -Math.PI / 2;
  heartbeatRing.position.set(HALL.x, 0.45, HALL.z + 2);
  infrastructureGroup.add(heartbeatRing);
  let healthStatus = "unknown",
    healthHash = null,
    heartbeatAt = null;

  // Human-scale details repeat predictably rather than introducing arbitrary
  // telemetry. Street life is an explicitly decorative miniature-city layer.
  for (const [x, z, s] of [
    [-35, 27, 0.8],
    [35, 27, 0.85],
    [-11, 21, 0.8],
    [12, 21, 0.75],
    [-12, -6, 0.75],
    [13, -6, 0.75],
    [-27, -20, 0.85],
    [25, -21, 0.8],
    [-2, -30, 0.8],
    [18, -32, 0.7],
    [-22, -39, 0.85],
    [25, -39, 0.85],
  ])
    tree(x, z, s);
  for (const [x, z] of [
    [-17, 18],
    [17, 18],
    [-17, 4],
    [17, 4],
    [-17, -15],
    [17, -15],
    [-8, 31],
    [9, 31],
    [-35, -18],
    [36, -18],
    [-8, -35],
    [17, -35],
  ])
    lamp(x, z);
  for (const [x, z] of [
    [-8, 11],
    [13, 11],
    [-10, 22],
    [13, 22],
  ])
    bench(decorations, x, z);
  cafe(decorations, -11, 9, "#c0b59a");
  cafe(decorations, 15, 11, "#aab894");
  // Newspaper kiosk and flower stall enrich the city without posing as data.
  const kiosk = new THREE.Group();
  kiosk.position.set(35, 0.46, 35);
  decorations.add(kiosk);
  cube(kiosk, 0, 0.98, 0, 2.4, 1.95, 1.8, "#748783");
  cube(kiosk, 0, 2.1, 0, 2.7, 0.22, 2.15, "#c1b997");
  cube(kiosk, 0, 1.15, 0.92, 1.9, 1.13, 0.06, warmGlass, false);
  label(kiosk, "CITY NEWS", null, 2.2, 0.47, 1.96, 1.1, "#57726e");
  const flowers = new THREE.Group();
  flowers.position.set(-35, 0.48, 35);
  decorations.add(flowers);
  cube(flowers, 0, 0.7, 0, 2.4, 1.1, 1.05, "#a88d71");
  planter(flowers, -0.56, 0.06, 0.85, 1.25);
  planter(flowers, 0.56, 0.06, 0.85, 1.25);
  label(flowers, "FLOWERS", null, 2.38, 0.45, 0.82, 0.58, "#9b8476");

  // All ambient people are fixed in number; they are not transactions/users.
  const personCount = 54,
    dummy = new THREE.Object3D();
  const bodies = new THREE.InstancedMesh(
    geo(new THREE.BoxGeometry(0.32, 0.46, 0.24)),
    paint("#ffffff"),
    personCount,
  );
  const heads = new THREE.InstancedMesh(
    geo(new THREE.IcosahedronGeometry(0.16, 1)),
    paint("#ffffff"),
    personCount,
  );
  const legs = new THREE.InstancedMesh(
    geo(new THREE.BoxGeometry(0.085, 0.29, 0.1)),
    paint("#465767"),
    personCount * 2,
  );
  for (const mesh of [bodies, heads, legs]) {
    instances.add(mesh);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    decorations.add(mesh);
  }
  const people = [];
  function random(seed) {
    const n = Math.sin(seed * 127.1 + 17.8) * 43758.5453;
    return n - Math.floor(n);
  }
  const coats = [
      "#bd8e74",
      "#809d9c",
      "#b0bfa8",
      "#7f92ba",
      "#d2b36f",
      "#c6a29e",
      "#9b87ad",
      "#d9d1b3",
    ],
    skin = ["#e2b994", "#b5825d", "#7d5d4b", "#deb08b", "#edc9a0"];
  for (let i = 0; i < personCount; i++) {
    people.push({
      block: blockDefs[i % blockDefs.length],
      offset: random(i + 1) * 70,
      speed: (0.4 + random(i + 50) * 0.35) * (i % 3 === 0 ? -1 : 1),
      size: 0.92 + random(i + 80) * 0.32,
      phase: random(i + 91) * 6.3,
    });
    bodies.setColorAt(i, new THREE.Color(coats[i % coats.length]));
    heads.setColorAt(i, new THREE.Color(skin[i % skin.length]));
  }
  function loopPosition(time, w, d) {
    let p = ((time % (2 * w + 2 * d)) + 2 * w + 2 * d) % (2 * w + 2 * d);
    if (p < w) return { x: -w / 2 + p, z: d / 2, a: Math.PI / 2 };
    p -= w;
    if (p < d) return { x: w / 2, z: d / 2 - p, a: Math.PI };
    p -= d;
    if (p < w) return { x: w / 2 - p, z: -d / 2, a: -Math.PI / 2 };
    p -= w;
    return { x: -w / 2, z: -d / 2 + p, a: 0 };
  }
  function updatePeople(time) {
    people.forEach((person, i) => {
      const [x, z, w, d] = person.block,
        pos = loopPosition(
          person.offset + time * person.speed,
          w - 0.85,
          d - 0.95,
        ),
        scale = person.size,
        angle = pos.a + (person.speed < 0 ? Math.PI : 0),
        px = x + pos.x,
        pz = z + pos.z;
      dummy.rotation.set(0, angle, 0);
      dummy.scale.setScalar(scale);
      dummy.position.set(px, 0.47 + 0.53 * scale, pz);
      dummy.updateMatrix();
      bodies.setMatrixAt(i, dummy.matrix);
      dummy.position.y = 0.47 + 0.89 * scale;
      dummy.updateMatrix();
      heads.setMatrixAt(i, dummy.matrix);
      for (let leg = 0; leg < 2; leg++) {
        const side = leg ? -1 : 1;
        dummy.position.set(
          px + Math.cos(angle) * side * 0.09 * scale,
          0.47 + 0.16 * scale,
          pz - Math.sin(angle) * side * 0.09 * scale,
        );
        dummy.rotation.set(
          Math.sin(time * 5.9 + person.phase + leg * Math.PI) * 0.32,
          angle,
          0,
        );
        dummy.updateMatrix();
        legs.setMatrixAt(i * 2 + leg, dummy.matrix);
      }
    });
    bodies.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    legs.instanceMatrix.needsUpdate = true;
  }
  const vehicles = [];
  for (let i = 0; i < 5; i++) {
    const group = new THREE.Group();
    decorations.add(group);
    const bus = i === 0;
    cube(
      group,
      0,
      0.63,
      0,
      bus ? 3.3 : 1.95,
      0.73,
      0.91,
      ["#b3baa1", "#c4a079", "#7d9f9f", "#b08b82", "#8b9bae"][i],
    );
    cube(
      group,
      bus ? 0 : -0.14,
      1.15,
      0,
      bus ? 2.65 : 1.17,
      0.52,
      0.78,
      "#b9c8c3",
    );
    for (const side of [-1, 1])
      cube(
        group,
        bus ? 0 : -0.14,
        1.18,
        side * 0.407,
        bus ? 2.3 : 0.98,
        0.28,
        0.025,
        darkGlass,
        false,
      );
    for (const xx of [bus ? -1.08 : -0.62, bus ? 1.08 : 0.62])
      for (const zz of [-0.46, 0.46]) {
        const wheel = cylinder(
          group,
          xx,
          0.35,
          zz,
          0.19,
          0.1,
          "#324750",
          false,
        );
        wheel.rotation.x = Math.PI / 2;
      }
    for (const zz of [-0.3, 0.3])
      cube(
        group,
        bus ? 1.67 : 1.0,
        0.66,
        zz,
        0.035,
        0.14,
        0.16,
        lampMaterial,
        false,
      );
    vehicles.push({
      group,
      offset: i * 21,
      speed: i % 2 ? -0.9 : 1.1,
      row: i < 3 ? 34 : -42,
    });
  }

  // Repeated windows, paving, leaves and trim share instanced draw calls. Keep
  // each product's batches separate so picking still selects the right shop.
  const movingGroups = new Set(vehicles.map((vehicle) => vehicle.group));
  function batchStatic(group) {
    if (movingGroups.has(group)) return;
    for (const child of [...group.children])
      if (child.isGroup) batchStatic(child);
    const buckets = new Map();
    for (const mesh of [...group.children]) {
      if (!mesh.isMesh || mesh.isInstancedMesh || Array.isArray(mesh.material))
        continue;
      if (
        ![boxGeometry, cylinderGeometry, sphereGeometry].includes(mesh.geometry)
      )
        continue;
      const key = `${mesh.geometry.uuid}:${mesh.material.uuid}:${mesh.castShadow}:${mesh.userData.placeId || ""}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(mesh);
    }
    for (const meshes of buckets.values()) {
      if (meshes.length < 3) continue;
      const first = meshes[0],
        batch = new THREE.InstancedMesh(
          first.geometry,
          first.material,
          meshes.length,
        );
      instances.add(batch);
      batch.castShadow = first.castShadow;
      batch.receiveShadow = first.receiveShadow;
      batch.userData = { ...first.userData };
      meshes.forEach((mesh, i) => {
        mesh.updateMatrix();
        batch.setMatrixAt(i, mesh.matrix);
        group.remove(mesh);
      });
      batch.instanceMatrix.needsUpdate = true;
      batch.computeBoundingSphere();
      group.add(batch);
    }
  }
  batchStatic(city);
  // Focus materials are cloned once per registered building and source
  // material, not on selection. Shared global paints and telemetry lamps stay
  // untouched. Every clone is tracked by the existing disposal collection.
  const buildingFocus = [];
  const liveLightMaterials = new Set([
    healthMaterial,
    blueLight,
    ...stationLamps.values(),
  ]);
  for (const [id, group] of roots) {
    const clones = new Map();
    const entry = { id, weight: 1, target: 1, materials: [] };
    group.traverse((object) => {
      if (
        !object.isMesh ||
        Array.isArray(object.material) ||
        liveLightMaterials.has(object.material)
      )
        return;
      const source = object.material;
      if (!source.color) return;
      let clone = clones.get(source);
      if (!clone) {
        clone = material(source.clone());
        const saturation = { value: 1 };
        // Signs use canvas maps. This tiny map-stage treatment keeps their
        // lettering readable while quieting unselected coloured fascia.
        if (clone.map) {
          clone.onBeforeCompile = (shader) => {
            shader.uniforms.cityFocusSaturation = saturation;
            shader.fragmentShader =
              "uniform float cityFocusSaturation;\n" +
              shader.fragmentShader.replace(
                "#include <map_fragment>",
                "#include <map_fragment>\nfloat cityFocusLuma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));\ndiffuseColor.rgb = mix(vec3(cityFocusLuma), diffuseColor.rgb, cityFocusSaturation);",
              );
          };
          clone.customProgramCacheKey = () => "ethereum-town-building-focus-v1";
        }
        clones.set(source, clone);
        entry.materials.push({
          source,
          clone,
          saturation,
          baseColor: source.color.clone(),
        });
      }
      object.material = clone;
    });
    buildingFocus.push(entry);
  }
  function setBuildingFocus(id) {
    const product = connectedPlaces.find((place) => place.id === id);
    const selectedNetwork = stations.has(id) ? id : product?.networkId;
    for (const entry of buildingFocus) {
      entry.target = !id || entry.id === id ? 1 : 0;
      if (
        (id === "ethereum" || id === "staking") &&
        (entry.id === "ethereum" || entry.id === "staking")
      )
        entry.target = 1;
      else if (id && entry.id === "ethereum") entry.target = 0.65;
      else if (product && entry.id === selectedNetwork) entry.target = 0.85;
      else if (
        stations.has(id) &&
        connectedPlaces.some(
          (place) => place.id === entry.id && place.networkId === id,
        )
      )
        entry.target = 0.45;
    }
  }
  const focusGray = new THREE.Color();
  function updateBuildingFocus(delta) {
    const ease = 1 - Math.exp(-delta * 4.2);
    for (const entry of buildingFocus) {
      entry.weight += (entry.target - entry.weight) * ease;
      const saturation = 0.28 + entry.weight * 0.72,
        brightness = 0.72 + entry.weight * 0.28,
        glow = 0.32 + entry.weight * 0.68;
      for (const record of entry.materials) {
        const base = record.baseColor;
        const gray = base.r * 0.2126 + base.g * 0.7152 + base.b * 0.0722;
        focusGray.setRGB(gray, gray, gray);
        record.clone.color
          .copy(focusGray)
          .lerp(base, saturation)
          .multiplyScalar(brightness);
        record.saturation.value = saturation;
        if (record.clone.emissive)
          record.clone.emissiveIntensity =
            record.source.emissiveIntensity * glow;
      }
    }
  }
  hits.length = 0;
  city.traverse((object) => {
    if (object.isMesh && object.userData.placeId) hits.push(object);
  });

  const selection = new THREE.Mesh(
    geo(new THREE.RingGeometry(1, 1.035, 64)),
    selectedMaterial,
  );
  selection.rotation.x = -Math.PI / 2;
  selection.position.y = 0.48;
  selection.visible = false;
  city.add(selection);
  const packetGeometry = geo(new THREE.SphereGeometry(0.22, 8, 6));
  const packetMaterials = new Map(),
    packets = [],
    seenEvents = new Set();
  let simulationTime = 0,
    paused = false,
    speed = 1,
    night = true,
    disposed = false,
    layer = "all",
    selectedId = null;
  function applyNight() {
    scene.background = new THREE.Color(night ? "#15242e" : "#dfe2d6");
    scene.fog = new THREE.Fog(night ? "#15242e" : "#dfe2d6", 118, 166);
    hemi.color.set(night ? "#a2b0d2" : "#edf0df");
    hemi.groundColor.set(night ? "#484755" : "#86927c");
    hemi.intensity = night ? 1.55 : 2.8;
    sun.color.set(night ? "#e8ad8d" : "#ffebc5");
    sun.intensity = night ? 2.5 : 3.2;
    rim.intensity = night ? 0.8 : 0.65;
    warmGlass.emissiveIntensity = night ? 0.78 : 0.1;
    contextGlass.emissiveIntensity = night ? 0.11 : 0;
    contextWarmGlass.emissiveIntensity = night ? 0.16 : 0.02;
    lampMaterial.emissiveIntensity = night ? 2.2 : 0.35;
    glowMaterial.opacity = night ? 0.69 : 0.08;
    renderer.toneMappingExposure = night ? 1.05 : 1.05;
  }
  applyNight();
  const overviewTarget = new THREE.Vector3(HALL.x, 5, HALL.z),
    target = overviewTarget.clone(),
    desiredTarget = overviewTarget.clone();
  let yaw = 0.24,
    desiredYaw = 0.24,
    pitch = 0.54,
    desiredPitch = 0.54,
    zoom = 1,
    desiredZoom = 1,
    overviewZoom = 1;
  let width = 1,
    height = 1,
    pointerDown = null,
    pinch = null,
    moved = false,
    lastFrame = 0,
    raf = 0;
  const activePointers = new Map();
  function clampZoom(value) {
    return Math.max(
      Math.min(overviewZoom * 0.65, Math.max(0.18, (width / height) * 0.45)),
      Math.min(4.2, value),
    );
  }
  function updateDistrictView() {
    const mobile = width < 600;
    if (layer === "context") {
      overviewTarget.set(0, 3, -40);
      overviewZoom = mobile ? 1.2 : 1.6;
    } else if (layer === "connected") {
      overviewTarget.set(0, 2, 17);
      overviewZoom = mobile ? 1.6 : 2;
    } else {
      overviewTarget.set(HALL.x, 5, HALL.z);
      overviewZoom = mobile ? 1.5 : 1.58;
    }
  }
  function resize() {
    const bounds = container.getBoundingClientRect();
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.setViewOffset(
      width,
      height,
      width < 600 ? 0 : -width * 0.09,
      width < 600 ? height * 0.105 : height * 0.055,
      width,
      height,
    );
    composer.setSize(width, height);
    ambientOcclusion.setSize(
      Math.ceil(width * renderer.getPixelRatio() * 0.55),
      Math.ceil(height * renderer.getPixelRatio() * 0.55),
    );
    ambientOcclusion.enabled = width >= 600;
    depthOfField.enabled = width >= 600;
    updateDistrictView();
    if (!selectedId) {
      zoom = desiredZoom = overviewZoom;
      desiredTarget.copy(overviewTarget);
    } else {
      focus(selectedId);
    }
    camera.updateProjectionMatrix();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();
  function updateCamera(delta) {
    const ease = 1 - Math.exp(-delta * 5.5);
    target.lerp(desiredTarget, ease);
    yaw += (desiredYaw - yaw) * ease;
    pitch += (desiredPitch - pitch) * ease;
    zoom += (desiredZoom - zoom) * ease;
    const radius = 105;
    camera.position.set(
      target.x + Math.sin(yaw) * Math.cos(pitch) * radius,
      target.y + Math.sin(pitch) * radius,
      target.z + Math.cos(yaw) * Math.cos(pitch) * radius,
    );
    camera.lookAt(target);
    depthOfField.uniforms.focus.value = camera.position.distanceTo(target);
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
  }
  function highlightRoutes(id) {
    const place = connectedPlaces.find((p) => p.id === id);
    const network = stations.has(id) ? id : place?.networkId;
    for (const [key, mat] of networkRouteMaterials) {
      const active = key === network;
      mat.opacity = active
        ? 0.98
        : id === "ethereum" || id === "staking"
          ? 0.64
          : 0.34;
      mat.emissiveIntensity = active ? 1.55 : 0.24;
    }
    for (const [key, mat] of productRouteMaterials) {
      mat.opacity = key === id ? 0.98 : 0.15;
      mat.emissiveIntensity = key === id ? 1.4 : 0.12;
    }
  }
  function focus(id) {
    selectedId = id;
    const location = id ? locations.get(id) : null;
    highlightRoutes(id);
    setBuildingFocus(id);
    if (location) {
      desiredTarget.copy(location);
      desiredTarget.y = Math.min(6, location.y);
      const isContext = contextPlaces.some((p) => p.id === id),
        isNetwork = stations.has(id);
      if (id === "ethereum" || id === "staking") {
        desiredTarget.set(HALL.x, width < 600 ? 6.25 : 5.4, HALL.z + 0.8);
        desiredZoom = width < 600 ? 1.08 : 1.94;
        desiredYaw = 0.24;
        desiredPitch = 0.54;
      } else if (isNetwork) {
        // Fit the selected neighborhood and its complete route to the hall.
        const station = stations.get(id);
        desiredTarget.set(
          THREE.MathUtils.lerp(station.x, HALL.x, 0.18),
          3.7,
          THREE.MathUtils.lerp(station.z, HALL.z, 0.18) + 1.5,
        );
        const distance = Math.hypot(station.x - HALL.x, station.z - HALL.z);
        desiredZoom =
          width < 600 ? 1.75 : Math.max(1.55, 2.04 - distance * 0.006);
        desiredYaw = station.x < HALL.x ? -0.38 : 0.48;
        desiredPitch = 0.57;
      } else {
        desiredZoom = width < 600 ? 2.1 : isContext ? 2.35 : 3.0;
        desiredYaw = 0.2;
        desiredPitch = 0.55;
      }
      selection.visible = true;
      selection.position.set(location.x, 0.49, location.z);
      selection.scale.setScalar(
        id === "ethereum" || id === "staking"
          ? 9
          : isNetwork
            ? 5.7
            : isContext
              ? 5
              : 4.1,
      );
    } else {
      desiredTarget.copy(overviewTarget);
      desiredZoom = overviewZoom;
      selection.visible = false;
    }
  }
  const raycaster = new THREE.Raycaster(),
    pointer = new THREE.Vector2();
  function pick(event) {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(hits, false).find((h) => {
      let node = h.object;
      while (node) {
        if (!node.visible) return false;
        node = node.parent;
      }
      return true;
    });
    return hit?.object.userData.placeId || null;
  }
  function down(event) {
    if (event.button !== 0) return;
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    renderer.domElement.setPointerCapture(event.pointerId);
    renderer.domElement.style.cursor = "grabbing";
    if (activePointers.size === 2) {
      const [a, b] = [...activePointers.values()];
      pinch = {
        distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        zoom: desiredZoom,
      };
      pointerDown = null;
      moved = true;
      return;
    }
    if (activePointers.size === 1) {
      pointerDown = {
        x: event.clientX,
        y: event.clientY,
        yaw: desiredYaw,
        pitch: desiredPitch,
      };
      moved = false;
    }
  }
  function move(event) {
    if (activePointers.has(event.pointerId))
      activePointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
    if (pinch && activePointers.size >= 2) {
      const [a, b] = [...activePointers.values()];
      desiredZoom = clampZoom(
        (pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.distance,
      );
      return;
    }
    if (pointerDown) {
      const dx = event.clientX - pointerDown.x,
        dy = event.clientY - pointerDown.y;
      if (Math.hypot(dx, dy) > 5) moved = true;
      desiredYaw = pointerDown.yaw - dx * 0.004;
      desiredPitch = Math.max(
        0.4,
        Math.min(1.14, pointerDown.pitch + dy * 0.0025),
      );
    } else renderer.domElement.style.cursor = pick(event) ? "pointer" : "grab";
  }
  function up(event) {
    activePointers.delete(event.pointerId);
    if (renderer.domElement.hasPointerCapture(event.pointerId))
      renderer.domElement.releasePointerCapture(event.pointerId);
    if (pinch) {
      if (activePointers.size === 0) pinch = null;
      pointerDown = null;
      renderer.domElement.style.cursor = "grab";
      return;
    }
    if (!pointerDown) return;
    const wasMoved = moved;
    pointerDown = null;
    renderer.domElement.style.cursor = "grab";
    if (!wasMoved) {
      const id = pick(event);
      focus(id);
      onSelect(id);
    }
  }
  function cancel(event) {
    activePointers.delete(event.pointerId);
    pinch = null;
    pointerDown = null;
    renderer.domElement.style.cursor = "grab";
    if (renderer.domElement.hasPointerCapture(event.pointerId))
      renderer.domElement.releasePointerCapture(event.pointerId);
  }
  function wheel(event) {
    event.preventDefault();
    desiredZoom = clampZoom(desiredZoom * Math.exp(-event.deltaY * 0.0012));
  }
  function keyboard(event) {
    if (event.key === "Escape" || event.key === "Home") {
      focus(null);
      desiredYaw = 0.24;
      desiredPitch = 0.54;
      onSelect(null);
      event.preventDefault();
    }
    if (event.key === "+" || event.key === "=") {
      desiredZoom = Math.min(4.2, desiredZoom * 1.15);
      event.preventDefault();
    }
    if (event.key === "-") {
      desiredZoom = clampZoom(desiredZoom / 1.15);
      event.preventDefault();
    }
    if (event.key === "ArrowLeft") {
      desiredYaw -= 0.12;
      event.preventDefault();
    }
    if (event.key === "ArrowRight") {
      desiredYaw += 0.12;
      event.preventDefault();
    }
  }
  const canvas = renderer.domElement;
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", cancel);
  canvas.addEventListener("wheel", wheel, { passive: false });
  canvas.addEventListener("keydown", keyboard);
  function addEvents(events) {
    for (const event of events) {
      if (!event || typeof event.id !== "string" || seenEvents.has(event.id))
        continue;
      seenEvents.add(event.id);
      if (seenEvents.size > 2500)
        seenEvents.delete(seenEvents.values().next().value);
      const station = stations.get(event.networkId);
      if (!station || packets.length >= 60) continue;
      const key = event.kind === "bridge" ? "#e9bd7e" : station.color;
      if (!packetMaterials.has(key))
        packetMaterials.set(
          key,
          material(
            new THREE.MeshBasicMaterial({ color: key, toneMapped: false }),
          ),
        );
      const mesh = new THREE.Mesh(packetGeometry, packetMaterials.get(key));
      infrastructureGroup.add(mesh);
      packets.push({
        mesh,
        station,
        start: simulationTime + packets.length * 0.18,
        duration: 6.0 + station.path.length * 0.55,
        reverse: event.direction === "to-l2",
      });
    }
  }
  function updatePackets() {
    for (let i = packets.length - 1; i >= 0; i--) {
      const p = packets[i],
        progress = (simulationTime - p.start) / p.duration;
      if (progress > 1) {
        p.mesh.removeFromParent();
        packets.splice(i, 1);
        continue;
      }
      p.mesh.visible = progress >= 0;
      if (progress < 0) continue;
      const t = p.reverse ? 1 - progress : progress;
      const path = p.station.path,
        distances = [];
      let total = 0;
      for (let j = 1; j < path.length; j++) {
        const length = Math.hypot(
          path[j][0] - path[j - 1][0],
          path[j][1] - path[j - 1][1],
        );
        distances.push(length);
        total += length;
      }
      let travel = t * total;
      for (let j = 1; j < path.length; j++) {
        const length = distances[j - 1];
        if (travel <= length || j === path.length - 1) {
          const portion = length ? Math.min(1, travel / length) : 1;
          p.mesh.position.set(
            THREE.MathUtils.lerp(path[j - 1][0], path[j][0], portion),
            0.72,
            THREE.MathUtils.lerp(path[j - 1][1], path[j][1], portion),
          );
          break;
        }
        travel -= length;
      }
    }
  }
  function frame(timestamp) {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    if (document.hidden) {
      lastFrame = timestamp;
      return;
    }
    const delta = Math.min((timestamp - lastFrame) / 1000 || 0.016, 0.06);
    lastFrame = timestamp;
    if (!paused) simulationTime += delta * speed;
    updateCamera(delta);
    updateBuildingFocus(delta);
    updatePeople(simulationTime);
    vehicles.forEach(({ group, offset, speed: velocity, row }) => {
      const p = ((simulationTime * velocity + offset + 200) % 74) - 37;
      group.position.set(p, 0.18, row + (velocity < 0 ? -0.85 : 0.85));
      group.rotation.y = velocity < 0 ? Math.PI : 0;
    });
    for (const [id, lamp] of stationLamps) {
      const when = blockPulseTimes.get(id);
      lamp.emissiveIntensity =
        when === undefined
          ? 0.1
          : 0.1 + Math.max(0, 1 - (simulationTime - when) / 2.6) * 1.2;
    }
    const heartbeatAge =
      heartbeatAt === null ? Infinity : simulationTime - heartbeatAt;
    const heartbeatStrength = Math.max(0, 1 - heartbeatAge / 3.4);
    healthMaterial.emissiveIntensity =
      (healthStatus === "unknown" ? 0.12 : 0.6) + heartbeatStrength * 1.8;
    heartbeatRing.material.opacity =
      healthStatus === "unknown" ? 0 : heartbeatStrength * 0.7;
    heartbeatRing.scale.setScalar(1 + Math.min(1, heartbeatAge / 3.4) * 0.26);
    updatePackets();
    composer.render(delta);
  }
  updatePeople(0);
  updateCamera(1);
  raf = requestAnimationFrame(frame);
  return {
    select: focus,
    setPaused(value) {
      paused = Boolean(value);
    },
    setNight(value) {
      night = Boolean(value);
      applyNight();
    },
    setSpeed(value) {
      speed = Math.max(0.1, Math.min(3, Number(value) || 1));
    },
    setLayers(value) {
      layer = ["all", "connected", "context"].includes(value) ? value : "all";
      updateDistrictView();
      if (!selectedId) {
        desiredTarget.copy(overviewTarget);
        desiredZoom = overviewZoom;
      }
    },
    setObservedEvents: addEvents,
    setHealth(value) {
      healthStatus = ["normal", "attention", "unknown"].includes(value?.status)
        ? value.status
        : "unknown";
      const color =
        healthStatus === "normal"
          ? "#b9eccd"
          : healthStatus === "attention"
            ? "#ffc27c"
            : "#99a4af";
      healthMaterial.color.set(color);
      healthMaterial.emissive.set(color);
      heartbeatRing.material.color.set(color);
      const hash =
        typeof value?.blockHash === "string" &&
        /^0x[0-9a-fA-F]{64}$/.test(value.blockHash)
          ? value.blockHash
          : null;
      if (healthStatus !== "unknown" && hash) {
        if (healthHash && healthHash !== hash) heartbeatAt = simulationTime;
        healthHash = hash;
      }
    },
    setNetworkActivity(records) {
      for (const record of records) {
        if (
          !record ||
          typeof record.id !== "string" ||
          typeof record.blockHash !== "string" ||
          !record.blockHash
        )
          continue;
        const previous = lastBlockHashes.get(record.id);
        lastBlockHashes.set(record.id, record.blockHash);
        if (previous && previous !== record.blockHash)
          blockPulseTimes.set(record.id, simulationTime);
      }
    },
    resetView() {
      focus(null);
      desiredYaw = 0.24;
      desiredPitch = 0.54;
    },
    getCanvas() {
      return canvas;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", cancel);
      canvas.removeEventListener("wheel", wheel);
      canvas.removeEventListener("keydown", keyboard);
      instances.forEach((i) => i.dispose());
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      for (const pass of [
        renderPass,
        ambientOcclusion,
        bloom,
        depthOfField,
        outputPass,
      ])
        pass.dispose();
      // Three r170 GTAOPass.dispose omits these two owned shader materials.
      ambientOcclusion.gtaoMaterial.dispose();
      ambientOcclusion.blendMaterial.dispose();
      composer.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}

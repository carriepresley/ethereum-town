import * as THREE from "three";

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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  renderer.domElement.style.cssText =
    "display:block;width:100%;height:100%;touch-action:none;cursor:grab;outline:none";
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute(
    "aria-label",
    "Interactive financial city. Select a connected product storefront, Ethereum town hall, a network station, or a wider financial sector. Drag to explore and scroll to zoom. Street life is illustrative; illuminated network pulses represent observed blockchain events.",
  );
  container.appendChild(renderer.domElement);

  const camera = new THREE.OrthographicCamera(-50, 50, 34, -34, 0.1, 260);
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
  sun.shadow.mapSize.set(1536, 1536);
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
      color: "#ffd898",
      emissive: "#ffbd64",
      emissiveIntensity: 1.28,
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

  // All streets share one piece of ground: connected products are a quarter of
  // a much broader city, not a disconnected ring of chain-shaped islands.
  cube(city, 0, -1.1, -6, 83, 2, 77, "#364852");
  cube(city, 0, -0.03, -6, 82, 0.28, 76, "#737d81");
  cube(scene, 0, -2.25, 0, 900, 0.15, 900, "#24323f", false);
  const roadColor = "#303d45",
    sidewalkColor = "#b7b6a7";
  const streets = [25, 8, -10, -28];
  streets.forEach((z) =>
    cube(city, 0, 0.135, z, 81, 0.07, 4.5, roadColor, false),
  );
  [-33, -16, 0, 16, 33].forEach((x) =>
    cube(city, x, 0.139, -6, 4.1, 0.07, 75, roadColor, false),
  );
  // City blocks, generous sidewalks and quieter back-office blocks.
  const blockDefs = [
    [-24.5, 16.4, 12.8, 12.4],
    [-8.1, 16.4, 11.4, 12.4],
    [8.1, 16.4, 11.4, 12.4],
    [24.5, 16.4, 12.8, 12.4],
    [-24.5, -0.8, 12.8, 12.3],
    [-8.1, -0.8, 11.4, 12.3],
    [8.1, -0.8, 11.4, 12.3],
    [24.5, -0.8, 12.8, 12.3],
    [-24.5, -19.1, 12.8, 12.4],
    [0, -19.1, 25.6, 12.4],
    [24.5, -19.1, 12.8, 12.4],
    [-25, -36, 12.8, 10.7],
    [-8.5, -36, 11.4, 10.7],
    [8.5, -36, 11.4, 10.7],
    [25, -36, 12.8, 10.7],
  ];
  blockDefs.forEach(([x, z, w, d]) => {
    cube(city, x, 0.29, z, w, 0.28, d, sidewalkColor, false);
    cube(city, x, 0.438, z, w - 0.35, 0.018, d - 0.35, "#c5c2b3", false);
  });
  // Thin paving joints instead of heavy visual grids.
  for (const [x, z, w, d] of blockDefs)
    for (let j = -Math.floor(w / 2) + 1; j < w / 2; j += 2.0)
      cube(city, x + j, 0.454, z, 0.018, 0.014, d - 0.2, "#afaf9f", false);
  for (const z of streets)
    for (let x = -39; x < 40; x += 4)
      if (![-33, -16, 0, 16, 33].some((xx) => Math.abs(x - xx) < 3))
        cube(city, x, 0.188, z, 1.65, 0.012, 0.09, "#9ca99e", false);
  for (const x of [-33, -16, 0, 16, 33])
    for (const z of [8, 25, -10, -28]) {
      for (let i = 0; i < 5; i++) {
        cube(
          city,
          x - 1.3 + i * 0.65,
          0.191,
          z + 2.82,
          0.34,
          0.015,
          1.1,
          "#d8d4bf",
          false,
        );
        cube(
          city,
          x - 1.3 + i * 0.65,
          0.191,
          z - 2.82,
          0.34,
          0.015,
          1.1,
          "#d8d4bf",
          false,
        );
      }
    }

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
  const shopSlots = [
    [-24.5, 16.1],
    [-8.1, 16.1],
    [8.1, 16.1],
    [24.5, 16.1],
    [-24.5, -1.3],
    [-8.1, -1.3],
    [8.1, -1.3],
    [24.5, -1.3],
    [-24.5, -19.3],
    [24.5, -19.3],
    [-37, 15],
    [-37, -2],
  ];
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
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    connectedGroup.add(group);
    buildingRoots.push({ group, status: place.status });
    const w = index % 4 === 0 || index % 4 === 3 ? 8.6 : 8.1,
      d = 7.5,
      h = 7.35 + (index % 3) * 0.4,
      color = place.color || "#677f8c",
      bodyColor = palettes[index % palettes.length];
    cube(group, 0, h / 2 + 0.47, 0, w, h, d, bodyColor);
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
    register(group, place.id, x, z, 3.1);
    // A short fixed utility connection joins a shared street. It is a topology
    // cue, never animated product traffic or a quantified capital-flow line.
    const lineGroup = new THREE.Group();
    connectedGroup.add(lineGroup);
    routeRoots.push({ group: lineGroup, status: place.status });
    const roadZ = index < 4 ? 25 : index < 8 ? 8 : -10;
    const startZ = z + d / 2 + 1.8;
    const endZ = roadZ - 1.6;
    if (Math.abs(endZ - startZ) > 0.1)
      cube(
        lineGroup,
        x,
        0.475,
        (startZ + endZ) / 2,
        0.105,
        0.022,
        Math.abs(endZ - startZ),
        place.status === "pilot" ? "#c4ac79" : "#91beb0",
        false,
      );
    cylinder(
      lineGroup,
      x,
      0.49,
      endZ,
      0.18,
      0.04,
      place.status === "pilot" ? "#c4ac79" : "#a2cfc0",
      false,
    );
  }
  connectedPlaces.slice(0, 12).forEach(storefront);

  // Wider finance remains inhabited and operating. Muted materials indicate
  // contextual sectors, not empty lots or a prediction that they will migrate.
  const contextSlots = [
    [-25, -36.1],
    [-8.4, -36.6],
    [8.3, -36.6],
    [25, -36.1],
    [-37, -19],
    [37, -19],
    [-37, -1],
    [37, -1],
  ];
  contextPlaces.slice(0, 8).forEach((place, index) => {
    const [x, z] = contextSlots[index];
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    contextGroup.add(group);
    buildingRoots.push({ group, status: "context" });
    const w = index < 4 ? 9.0 : 6.4,
      d = 7.2,
      h = 11.5 + (index % 3) * 3;
    cube(
      group,
      0,
      h / 2 + 0.48,
      0,
      w,
      h,
      d,
      ["#72818b", "#7f898f", "#76878c", "#829195"][index % 4],
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
  hall.position.set(0, 0, -19);
  infrastructureGroup.add(hall);
  cube(hall, 0, 0.71, 0, 15.5, 0.6, 10.5, "#afa98f");
  cube(hall, 0, 1.08, 0, 14.65, 0.21, 10.0, "#d0c8ad");
  cube(hall, 0, 4.7, -0.6, 12.5, 7.2, 7.7, "#d9ceae");
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
  for (const xx of [-3.7, 0, 3.7])
    cube(hall, xx, 3.98, 3.28, 1.7, 4.8, 0.09, warmGlass, false);
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
    geo(new THREE.SphereGeometry(2.21, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)),
    paint("#84a3ad", 0.55, 0.12),
  );
  dome.position.set(0, 11.99, -0.55);
  dome.castShadow = true;
  hall.add(dome);
  const symbol = new THREE.Group();
  symbol.position.set(0, 15.24, -0.55);
  hall.add(symbol);
  const topGem = new THREE.Mesh(
    geo(new THREE.ConeGeometry(1.1, 2.7, 4)),
    material(
      new THREE.MeshStandardMaterial({
        color: "#b7d1ed",
        emissive: "#5e8fbb",
        emissiveIntensity: 0.24,
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
    tree(xx, -21.5, 0.85);
    bench(hall, xx, 3.4, xx > 0 ? -Math.PI / 2 : Math.PI / 2);
  }
  register(hall, "ethereum", 0, -19, 5.0);
  const staking = new THREE.Group();
  staking.position.set(0, 0, -19);
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
  register(staking, "staking", 0, -16, 1.5);

  const networkDefinitions = [
    ["base", "Base", "#4d80f4"],
    ["arbitrum", "Arbitrum", "#7fb6d3"],
    ["optimism", "OP Mainnet", "#d88b82"],
    ["starknet", "Starknet", "#bd9dcf"],
    ["zksync-era", "ZKsync", "#8a98ca"],
    ["linea", "Linea", "#a5b99d"],
    ["mantle", "Mantle", "#84b4a8"],
    ["ink", "Ink", "#a389ce"],
    ["unichain", "Unichain", "#cd99b6"],
  ];
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
  // A single transit corridor carries rollup connections. Individual observed
  // pulses join this trunk; institution storefronts never emit fake packets.
  for (const offset of [-0.4, 0.4])
    cube(
      infrastructureGroup,
      0,
      0.27,
      -10 + offset,
      61,
      0.065,
      0.075,
      "#8ca2a8",
      false,
    );
  for (let x = -30; x < 31; x += 0.9)
    cube(
      infrastructureGroup,
      x,
      0.24,
      -10,
      0.12,
      0.055,
      1.08,
      "#566a70",
      false,
    );
  cube(
    infrastructureGroup,
    0,
    0.26,
    -12.7,
    0.095,
    0.09,
    5.1,
    routeMaterial,
    false,
  );
  const trunkSign = new THREE.Group();
  trunkSign.position.set(0, 0, -10.35);
  infrastructureGroup.add(trunkSign);
  label(
    trunkSign,
    "ETHEREUM L2 TRANSIT",
    "OBSERVED NETWORK CONNECTIONS",
    9.4,
    0.81,
    1.42,
    0,
    "#425f70",
  );
  networkDefinitions.forEach(([id, name, color], i) => {
    const x = -28 + i * 7;
    const group = new THREE.Group();
    group.position.set(x, 0, -10);
    infrastructureGroup.add(group);
    cube(group, 0, 0.46, 1.07, 3.3, 0.18, 1.35, "#7d959b");
    cube(group, 0, 0.59, 1.1, 3.12, 0.08, 1.15, "#b0bdba");
    for (const xx of [-1.35, 1.35])
      cylinder(group, xx, 1.2, 1.52, 0.055, 1.31, "#7e959a");
    label(group, name, "L2", 3.36, 0.75, 2.1, 1.54, color);
    const light = material(
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.1,
      }),
    );
    cylinder(group, 0, 0.77, 1.1, 0.24, 0.12, light, false);
    stationLamps.set(id, light);
    stations.set(id, { x, z: -10, color });
    register(group, id, x, -10, 1.0);
  });

  // Human-scale details repeat predictably rather than introducing arbitrary
  // telemetry. Street life is an explicitly decorative miniature-city layer.
  for (const [x, z, s] of [
    [-29, 21, 0.9],
    [-19, 20.5, 0.85],
    [-12.4, 21, 0.85],
    [12.7, 20.6, 0.9],
    [29, 21, 0.9],
    [-29, 4, 0.8],
    [29, 4, 0.8],
    [-12.5, 3.8, 0.75],
    [12.5, 3.8, 0.75],
    [-29, -6, 0.75],
    [29, -6, 0.75],
    [-37, 29, 0.9],
    [37, 29, 0.9],
    [-21, -30, 0.75],
    [21, -30, 0.75],
    [-4, -31, 0.65],
    [4, -31, 0.65],
  ])
    tree(x, z, s);
  for (const [x, z] of [
    [-30, 22.3],
    [-13, 22.3],
    [13, 22.3],
    [30, 22.3],
    [-30, 5.5],
    [-13, 5.5],
    [13, 5.5],
    [30, 5.5],
    [-13, -12.3],
    [13, -12.3],
    [-30, -25.5],
    [30, -25.5],
    [-37, 5],
    [37, 5],
  ])
    lamp(x, z);
  for (const [x, z] of [
    [-19, 21.5],
    [19, 21.5],
    [-19, 4.5],
    [19, 4.5],
  ])
    bench(decorations, x, z);
  // Newspaper kiosk and flower stall enrich the city without posing as data.
  const kiosk = new THREE.Group();
  kiosk.position.set(37, 0.46, 22);
  decorations.add(kiosk);
  cube(kiosk, 0, 0.98, 0, 2.4, 1.95, 1.8, "#748783");
  cube(kiosk, 0, 2.1, 0, 2.7, 0.22, 2.15, "#c1b997");
  cube(kiosk, 0, 1.15, 0.92, 1.9, 1.13, 0.06, warmGlass, false);
  label(kiosk, "CITY NEWS", null, 2.2, 0.47, 1.96, 1.1, "#57726e");
  const flowers = new THREE.Group();
  flowers.position.set(-37, 0.48, 22);
  decorations.add(flowers);
  cube(flowers, 0, 0.7, 0, 2.4, 1.1, 1.05, "#a88d71");
  planter(flowers, -0.56, 0.06, 0.85, 1.25);
  planter(flowers, 0.56, 0.06, 0.85, 1.25);
  label(flowers, "FLOWERS", null, 2.38, 0.45, 0.82, 0.58, "#9b8476");

  // All ambient people are fixed in number; they are not transactions/users.
  const personCount = 72,
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
      block: blockDefs[i % 11],
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
      row: i < 3 ? 25 : -28,
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
    scene.background = new THREE.Color(night ? "#243441" : "#dfe2d6");
    hemi.color.set(night ? "#a2b0d2" : "#edf0df");
    hemi.groundColor.set(night ? "#484755" : "#86927c");
    hemi.intensity = night ? 2.1 : 2.8;
    sun.color.set(night ? "#e8ad8d" : "#ffebc5");
    sun.intensity = night ? 2.15 : 3.2;
    rim.intensity = night ? 1.1 : 0.65;
    warmGlass.emissiveIntensity = night ? 1.28 : 0.1;
    contextGlass.emissiveIntensity = night ? 0.11 : 0;
    contextWarmGlass.emissiveIntensity = night ? 0.16 : 0.02;
    lampMaterial.emissiveIntensity = night ? 2.2 : 0.35;
    glowMaterial.opacity = night ? 0.69 : 0.08;
    renderer.toneMappingExposure = night ? 1.18 : 1.05;
  }
  applyNight();
  const overviewTarget = new THREE.Vector3(0, 2.0, -7.5),
    target = overviewTarget.clone(),
    desiredTarget = overviewTarget.clone();
  let yaw = 0.5,
    desiredYaw = 0.5,
    pitch = 0.69,
    desiredPitch = 0.69,
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
    const aspect = width / height,
      mobile = width < 600;
    if (layer === "context") {
      overviewTarget.set(mobile ? 0 : 1, 5.3, -30);
      overviewZoom = mobile
        ? Math.min(1.02, Math.max(0.77, aspect * 1.52))
        : Math.min(1.55, Math.max(0.8, aspect * 0.92));
    } else if (layer === "connected") {
      overviewTarget.set(mobile ? -7.5 : 0, 3.2, 8);
      overviewZoom = mobile
        ? Math.min(1.14, Math.max(0.86, aspect * 1.77))
        : Math.min(1.43, Math.max(0.8, aspect * 0.88));
    } else if (mobile) {
      // A phone starts inside the connected neighborhood, not so far away that
      // the whole financial city is reduced to an unreadable postage stamp.
      overviewTarget.set(-7.5, 3.4, 3.5);
      overviewZoom = Math.min(1.04, Math.max(0.81, aspect * 1.6));
    } else {
      overviewTarget.set(0, 2.0, -7.5);
      overviewZoom = Math.min(1.04, Math.max(0.55, aspect * 0.62));
    }
  }
  function resize() {
    const bounds = container.getBoundingClientRect();
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    renderer.setSize(width, height, false);
    const aspect = width / height,
      vertical = 65,
      verticalOffset = width < 600 ? 5.2 : 0;
    camera.left = (-vertical * aspect) / 2;
    camera.right = (vertical * aspect) / 2;
    camera.top = vertical / 2 - verticalOffset;
    camera.bottom = -vertical / 2 - verticalOffset;
    updateDistrictView();
    if (!selectedId) {
      zoom = desiredZoom = overviewZoom;
      desiredTarget.copy(overviewTarget);
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
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
  }
  function focus(id) {
    selectedId = id;
    const location = id ? locations.get(id) : null;
    if (location) {
      desiredTarget.copy(location);
      desiredTarget.y = Math.min(5, location.y);
      desiredZoom = width < 600 ? 1.55 : 2.48;
      selection.visible = true;
      selection.position.set(location.x, 0.49, location.z);
      const isContext = contextPlaces.some((p) => p.id === id),
        isNetwork = stations.has(id);
      selection.scale.setScalar(
        id === "ethereum" || id === "staking"
          ? 9
          : isNetwork
            ? 2.55
            : isContext
              ? 6.2
              : 6.1,
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
      desiredYaw = 0.5;
      desiredPitch = 0.69;
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
        duration: 4.5 + Math.abs(station.x) * 0.06,
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
      if (t < 0.73)
        p.mesh.position.set(p.station.x * (1 - t / 0.73), 0.62, -10);
      else p.mesh.position.set(0, 0.62, -10 - ((t - 0.73) / 0.27) * 4.1);
    }
  }
  function frame(timestamp) {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const delta = Math.min((timestamp - lastFrame) / 1000 || 0.016, 0.06);
    lastFrame = timestamp;
    if (!paused) simulationTime += delta * speed;
    updateCamera(delta);
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
    updatePackets();
    renderer.render(scene, camera);
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
      desiredYaw = 0.5;
      desiredPitch = 0.69;
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
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}

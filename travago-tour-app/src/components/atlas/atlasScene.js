// 3D atlas of Albania (three.js): relief with holographic contour lines, an
// animated sea, glowing beacons for every destination, the route network, and
// light-trail routes the camera can fly along.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const EXAG = 9; // vertical exaggeration (km → scene units are 1:1 horizontally)
const CAT_COLOR = {
  city: "#f4b63f", beach: "#3fd3cf", history: "#e07a52", nature: "#8fd16a", viewpoint: "#c9a7ff",
  boat: "#5fb4e8", hub: "#ffffff", food: "#ff8fa3", village: "#f9d27f",
};
const MODE_COLOR = { drive: "#f4b63f", ferry: "#5fb4e8", boat: "#3fd3cf" };

const decode = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function webglSupported() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function createAtlas(container, { atlas, nodes, edges, onHover, onSelect, onFlight, reduced = false }) {
  const [NX, NY] = atlas.size;
  const { bbox } = atlas;
  const [KX, KY] = atlas.kmPerDeg;
  const W = (bbox.e - bbox.w) * KX;
  const H = (bbox.n - bbox.s) * KY;
  const mask = decode(atlas.mask);
  // One 3×3 blur pass: keeps the crags, removes single-cell speckle in the lowlands.
  const height = (() => {
    const raw = decode(atlas.height);
    const out = new Uint8Array(raw.length);
    for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
      const i = y * NX + x;
      if (!mask[i]) continue;
      let sum = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= NX || yy >= NY || !mask[yy * NX + xx]) continue;
        sum += raw[yy * NX + xx] * (dx || dy ? 1 : 2);
        n += dx || dy ? 1 : 2;
      }
      out[i] = Math.round(sum / n);
    }
    return out;
  })();
  // Land fades down towards the edge of the mapped area (no hard rectangular cliff).
  const edgeFade = (x, y) => {
    const d = Math.min(x, y, NX - 1 - x, NY - 1 - y) * atlas.cellKm;
    const t = Math.min(1, Math.max(0, d / 16));
    return t * t * (3 - 2 * t);
  };
  const hScale = (atlas.maxMetres / 1000) * EXAG;

  // lng/lat → scene x/z (north is −z)
  const toXZ = (lat, lng) => [(lng - bbox.w) * KX - W / 2, (bbox.n - lat) * KY - H / 2];
  const sample = (arr, x, z) => {
    const gx = ((x + W / 2) / W) * NX - 0.5;
    const gy = ((z + H / 2) / H) * NY - 0.5;
    const x0 = Math.max(0, Math.min(NX - 1, Math.floor(gx))), y0 = Math.max(0, Math.min(NY - 1, Math.floor(gy)));
    const x1 = Math.min(NX - 1, x0 + 1), y1 = Math.min(NY - 1, y0 + 1);
    const fx = Math.min(1, Math.max(0, gx - x0)), fy = Math.min(1, Math.max(0, gy - y0));
    const v = (xx, yy) => arr[yy * NX + xx];
    return (v(x0, y0) * (1 - fx) + v(x1, y0) * fx) * (1 - fy) + (v(x0, y1) * (1 - fx) + v(x1, y1) * fx) * fy;
  };
  const groundY = (x, z) => {
    const land = sample(mask, x, z);
    if (land < 0.5) return 0;
    return (sample(height, x, z) / 255) * hScale;
  };

  // ---- renderer / scene / camera ----------------------------------------
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  renderer.domElement.className = "atlas-canvas";

  const scene = new THREE.Scene();
  // Custom shaders write display colours directly, so the fog colour is given as-is.
  scene.fog = new THREE.FogExp2(new THREE.Color().setRGB(0.024, 0.1, 0.15, THREE.LinearSRGBColorSpace), 0.0028);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 2000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = 1.32;
  controls.minDistance = 18;
  controls.maxDistance = 520;
  controls.screenSpacePanning = false;
  controls.autoRotateSpeed = 0.35;
  const HOME = { pos: new THREE.Vector3(-120, 150, 225), target: new THREE.Vector3(12, 0, 25) };
  camera.position.copy(HOME.pos);
  controls.target.copy(HOME.target);

  const uniforms = {
    uTime: { value: 0 },
    uContours: { value: 1 },
    uScan: { value: 1 },
    uSun: { value: new THREE.Vector3(-0.5, 0.75, 0.35).normalize() },
    uMask: { value: null },
    uSize: { value: new THREE.Vector2(W, H) },
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
  };

  // Land mask as a texture (sea shader uses it to find shallow water near coasts).
  const maskTex = new THREE.DataTexture(Uint8Array.from(mask, (m) => (m ? 255 : 0)), NX, NY, THREE.RedFormat);
  maskTex.magFilter = THREE.LinearFilter;
  maskTex.minFilter = THREE.LinearFilter;
  maskTex.needsUpdate = true;
  uniforms.uMask.value = maskTex;

  // ---- terrain ------------------------------------------------------------
  const geo = new THREE.PlaneGeometry(W, H, NX - 1, NY - 1);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const aLand = new Float32Array(NX * NY);
  const aH = new Float32Array(NX * NY);
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
    const i = y * NX + x;
    const land = mask[i];
    aLand[i] = land / 2;
    aH[i] = height[i] / 255;
    pos.setY(i, land ? aH[i] * hScale * edgeFade(x, y) + (edgeFade(x, y) - 1) * 1.2 : -1.2);
  }
  geo.setAttribute("aLand", new THREE.BufferAttribute(aLand, 1));
  geo.setAttribute("aH", new THREE.BufferAttribute(aH, 1));
  geo.computeVertexNormals();

  const terrainMat = new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    vertexShader: /* glsl */ `
      attribute float aLand; attribute float aH;
      varying float vLand; varying float vH; varying vec3 vN; varying vec3 vW;
      #include <fog_pars_vertex>
      void main() {
        vLand = aLand; vH = aH; vN = normal;
        vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uContours; uniform float uScan; uniform vec3 uSun; uniform vec2 uSize;
      varying float vLand; varying float vH; varying vec3 vN; varying vec3 vW;
      #include <fog_pars_fragment>
      vec3 ramp(float h) {
        vec3 sand = vec3(0.86, 0.78, 0.58), olive = vec3(0.42, 0.52, 0.27), maquis = vec3(0.20, 0.34, 0.20);
        vec3 rock = vec3(0.58, 0.56, 0.52), snow = vec3(0.96, 0.97, 1.0);
        vec3 c = mix(sand, olive, smoothstep(0.0, 0.08, h));
        c = mix(c, maquis, smoothstep(0.12, 0.38, h));
        c = mix(c, rock, smoothstep(0.45, 0.72, h));
        return mix(c, snow, smoothstep(0.84, 0.95, h));
      }
      void main() {
        if (vLand < 0.25) discard;
        vec3 n = normalize(vN);
        float diff = max(dot(n, uSun), 0.0);
        float hemi = 0.5 + 0.5 * n.y;
        vec3 base = ramp(vH);
        float albania = smoothstep(0.6, 0.9, vLand);
        vec3 other = mix(vec3(0.16, 0.22, 0.27), vec3(0.32, 0.38, 0.42), vH);
        base = mix(other, base, albania);
        vec3 col = base * (0.28 + 0.62 * diff + 0.22 * hemi);
        // holographic contour lines every ~110 m
        float k = vH * 18.0;
        float c2 = abs(fract(k) - 0.5);
        float fw = fwidth(k);
        float iso = (1.0 - smoothstep(0.0, fw * 1.2, 0.5 - c2)) * smoothstep(0.004, 0.02, fw);
        col += vec3(0.25, 0.95, 0.9) * iso * uContours * (0.22 + 0.4 * albania) * smoothstep(0.02, 0.06, vH);
        // scanner sweep
        float sweep = mod(uTime * 38.0, 900.0) - 450.0;
        float band = exp(-pow((vW.z - sweep) / 6.0, 2.0));
        col += vec3(0.2, 0.9, 1.0) * band * 0.35 * uScan * albania;
        vec2 e2 = min(vW.xz + uSize * 0.5, uSize * 0.5 - vW.xz);
        col = mix(vec3(0.03, 0.12, 0.18), col, smoothstep(0.0, 18.0, min(e2.x, e2.y)));
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
  const terrain = new THREE.Mesh(geo, terrainMat);
  scene.add(terrain);

  // ---- sea ----------------------------------------------------------------
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 14, H * 10, 1, 1).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      fog: true,
      vertexShader: /* glsl */ `
        varying vec3 vW;
        #include <fog_pars_vertex>
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
          vec4 mvPosition = viewMatrix * w;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform sampler2D uMask; uniform vec2 uSize;
        varying vec3 vW;
        #include <fog_pars_fragment>
        float h21(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
        float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
        void main() {
          vec2 uv = (vW.xz + uSize * 0.5) / uSize;
          float near = 0.0;
          for (int i = 0; i < 8; i++) {
            float a = float(i) * 0.785;
            near += texture2D(uMask, uv + vec2(cos(a), sin(a)) * 0.012).r;
            near += texture2D(uMask, uv + vec2(cos(a), sin(a)) * 0.028).r * 0.6;
          }
          near = clamp(near / 9.0, 0.0, 1.0);
          if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) near = 0.0;
          vec3 deep = vec3(0.02, 0.10, 0.17), mid = vec3(0.03, 0.28, 0.40), shallow = vec3(0.10, 0.62, 0.66);
          vec3 col = mix(deep, mid, smoothstep(0.0, 0.25, near));
          col = mix(col, shallow, smoothstep(0.35, 0.9, near));
          float caust = n2(vW.xz * 0.25 + uTime * 0.25) * n2(vW.xz * 0.31 - uTime * 0.2);
          col += vec3(0.25, 0.7, 0.8) * pow(caust, 3.0) * (0.25 + 0.6 * near);
          // faint holographic grid
          vec2 g = abs(fract(vW.xz / 25.0) - 0.5);
          float grid = 1.0 - smoothstep(0.0, fwidth(vW.x / 25.0) * 1.5, min(g.x, g.y));
          col += vec3(0.15, 0.6, 0.7) * grid * 0.12;
          gl_FragColor = vec4(col, 0.96);
          #include <fog_fragment>
        }`,
    })
  );
  sea.position.y = -0.05;
  scene.add(sea);

  // ---- Albania border glow --------------------------------------------------
  const borderMat = new THREE.LineBasicMaterial({ color: 0x5ff0e6, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const ring of atlas.outline) {
    const pts = ring.map(([lng, lat]) => {
      const [x, z] = toXZ(lat, lng);
      return new THREE.Vector3(x, groundY(x, z) + 0.35, z);
    });
    scene.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), borderMat));
  }

  // ---- stars ----------------------------------------------------------------
  {
    const n = 900;
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.random() * 0.45 * Math.PI;
      const r = 900;
      p.set([Math.cos(th) * Math.sin(ph) * r, Math.cos(ph) * r * 0.6 + 120, Math.sin(th) * Math.sin(ph) * r], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xbfe9ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.7, fog: false })));
  }

  // ---- route network ----------------------------------------------------------
  const network = new THREE.Group();
  const drape = (coords, mode, lift = 0.5) => {
    const out = [];
    for (let k = 0; k + 1 < coords.length; k++) {
      const [a, b] = [toXZ(...coords[k]), toXZ(...coords[k + 1])];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const steps = Math.max(2, Math.ceil(len / 2));
      for (let s = k ? 1 : 0; s <= steps; s++) {
        const t = s / steps;
        const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
        const y = mode === "drive" ? groundY(x, z) + lift : 0.4 + Math.sin(Math.PI * t) * Math.min(6, len * 0.08);
        out.push(new THREE.Vector3(x, y, z));
      }
    }
    return out;
  };
  for (const e of edges) {
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(drape(e.coords, e.mode)),
      new THREE.LineBasicMaterial({ color: MODE_COLOR[e.mode] || "#ffffff", transparent: true, opacity: 0.32, depthWrite: false })
    );
    network.add(line);
  }
  scene.add(network);

  // ---- beacons ----------------------------------------------------------------
  const glowTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.25, "rgba(255,255,255,0.85)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const pillarGeo = new THREE.CylinderGeometry(0.22, 0.22, 1, 8, 1, true).translate(0, 0.5, 0);
  const pillarMat = (color) => new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: uniforms.uTime },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: "varying float vY; void main(){ vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: "uniform vec3 uColor; uniform float uTime; varying float vY; void main(){ float a = (1.0 - vY) * (0.55 + 0.25 * sin(uTime * 3.0 + vY * 8.0)); gl_FragColor = vec4(uColor * 1.4, a); }",
  });
  const ringGeo = new THREE.RingGeometry(0.8, 1.0, 40).rotateX(-Math.PI / 2);
  const beacons = nodes.map((n, idx) => {
    const [x, z] = toXZ(n.lat, n.lng);
    const y = Math.max(groundY(x, z), 0.2);
    const color = CAT_COLOR[n.category] || "#ffffff";
    const tall = n.base ? 14 : n.category === "hub" ? 9 : 8;
    const group = new THREE.Group();
    group.position.set(x, y, z);
    const pillar = new THREE.Mesh(pillarGeo, pillarMat(color));
    pillar.scale.set(1, tall, 1);
    const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    head.position.y = tall;
    head.scale.setScalar(n.base ? 4.2 : 3);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    ring.position.y = 0.25;
    group.add(pillar, head, ring);
    scene.add(group);
    return { node: n, group, head, ring, pillar, tall, phase: idx * 0.37, top: new THREE.Vector3(x, y + tall, z) };
  });

  // ---- active route (light trail) -----------------------------------------------
  let route = null;
  const trailMat = new THREE.ShaderMaterial({
    uniforms: { uTime: uniforms.uTime, uLen: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uLen; varying vec2 vUv;
      void main() {
        float s = vUv.x * uLen;
        float dash = 0.55 + 0.45 * smoothstep(0.35, 0.5, fract(s / 6.0 - uTime * 1.6));
        float head = exp(-pow((fract(vUv.x - uTime * 0.08) - 0.98) * 40.0, 2.0));
        vec3 c = mix(vec3(1.0, 0.72, 0.25), vec3(0.3, 1.0, 0.95), vUv.x);
        gl_FragColor = vec4(c * (dash + head * 2.5), 0.9);
      }`,
  });

  function clearRoute() {
    if (!route) return;
    scene.remove(route.mesh);
    route.mesh.geometry.dispose();
    route = null;
    network.visible = layers.network;
  }

  function setRoute(result) {
    clearRoute();
    if (!result?.legs?.length) return;
    const idx = Object.fromEntries(nodes.map((n) => [n.slug, n]));
    const pts = [];
    for (const leg of result.legs) {
      const a = idx[leg.from], b = idx[leg.to];
      if (!a || !b) continue;
      const seg = drape([[a.lat, a.lng], [b.lat, b.lng]], leg.mode, 0.9);
      pts.push(...(pts.length ? seg.slice(1) : seg));
    }
    if (pts.length < 2) return;
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal", 0.2);
    const len = curve.getLength();
    const tube = new THREE.TubeGeometry(curve, Math.min(1200, Math.max(60, Math.round(len * 2))), 0.42, 8, false);
    trailMat.uniforms.uLen.value = len;
    const mesh = new THREE.Mesh(tube, trailMat);
    scene.add(mesh);
    route = { mesh, curve, len };
    network.visible = false;
    fitPoints(pts);
  }

  // ---- camera moves ---------------------------------------------------------------
  let tween = null;
  function moveTo(target, position, ms = 1400) {
    if (reduced) ms = 0;
    tween = { t0: performance.now(), ms, from: { p: camera.position.clone(), t: controls.target.clone() }, to: { p: position, t: target } };
    if (!ms) {
      camera.position.copy(position);
      controls.target.copy(target);
      tween = null;
    }
  }
  function fitPoints(pts) {
    const box = new THREE.Box3().setFromPoints(pts);
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const r = Math.max(30, Math.hypot(size.x, size.z) * 0.85);
    moveTo(c.clone().setY(0), new THREE.Vector3(c.x - r * 0.55, r * 0.95, c.z + r * 0.9));
  }
  function focus(slug) {
    const b = beacons.find((x) => x.node.slug === slug);
    if (!b) return;
    const p = b.group.position;
    moveTo(new THREE.Vector3(p.x, p.y, p.z), new THREE.Vector3(p.x - 22, p.y + 34, p.z + 46));
  }

  let flight = null;
  function fly() {
    if (!route) return false;
    if (reduced) {
      fitPoints(route.curve.getPoints(20));
      return false;
    }
    controls.enabled = false;
    controls.autoRotate = false;
    flight = { t0: performance.now(), ms: Math.min(28000, Math.max(9000, route.len * 70)) };
    onFlight?.({ progress: 0, flying: true });
    return true;
  }
  function stopFlight() {
    if (!flight) return;
    flight = null;
    controls.enabled = true;
    onFlight?.({ progress: 0, flying: false });
    if (route) fitPoints(route.curve.getPoints(20));
  }

  // ---- interaction ------------------------------------------------------------------
  const v = new THREE.Vector3();
  let hovered = null;
  function pick(clientX, clientY) {
    const r = renderer.domElement.getBoundingClientRect();
    let best = null, bestD = 26;
    for (const b of beacons) {
      v.copy(b.top).project(camera);
      if (v.z > 1) continue;
      const sx = (v.x * 0.5 + 0.5) * r.width + r.left, sy = (-v.y * 0.5 + 0.5) * r.height + r.top;
      const d = Math.hypot(sx - clientX, sy - clientY);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }
  let down = null;
  const el = renderer.domElement;
  const onMove = (e) => {
    if (flight) return;
    const b = pick(e.clientX, e.clientY);
    if (b !== hovered) {
      hovered = b;
      el.style.cursor = b ? "pointer" : "grab";
      onHover?.(b ? b.node.slug : null);
    }
  };
  const onDown = (e) => { down = { x: e.clientX, y: e.clientY }; };
  const onUp = (e) => {
    if (!down || flight) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved > 6) return;
    const b = pick(e.clientX, e.clientY);
    onSelect?.(b ? b.node.slug : null);
  };
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointerup", onUp);
  controls.addEventListener("start", () => { if (tween) tween = null; });

  // ---- labels (screen positions for the HTML overlay) ----------------------------------
  const screen = {};
  function project() {
    const r = el.getBoundingClientRect();
    for (const b of beacons) {
      v.copy(b.top).project(camera);
      const dist = camera.position.distanceTo(b.top);
      screen[b.node.slug] = { x: (v.x * 0.5 + 0.5) * r.width, y: (-v.y * 0.5 + 0.5) * r.height, visible: v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1, dist };
    }
    return screen;
  }

  // ---- layers ---------------------------------------------------------------------------
  const layers = { contours: true, network: true, scan: true, rotate: false };
  function setLayer(name, on) {
    layers[name] = on;
    if (name === "contours") uniforms.uContours.value = on ? 1 : 0;
    if (name === "scan") uniforms.uScan.value = on ? 1 : 0;
    if (name === "network") network.visible = on && !route;
    if (name === "rotate") controls.autoRotate = on && !reduced;
  }

  // ---- loop ------------------------------------------------------------------------------
  let raf = 0, running = true, onFrame = null, selected = null;
  let lastT = performance.now();
  const tick = () => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    return dt;
  };
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  function frame() {
    raf = requestAnimationFrame(frame);
    if (!running) return;
    const dt = tick();
    uniforms.uTime.value += reduced ? 0 : dt;
    const t = uniforms.uTime.value;
    for (const b of beacons) {
      const s = 1 + ((t * 0.6 + b.phase) % 1) * 2.4;
      b.ring.scale.setScalar(s);
      b.ring.material.opacity = 0.8 * (1 - (s - 1) / 2.4);
      const hot = b === hovered || b.node.slug === selected;
      b.head.scale.setScalar((b.node.base ? 4.2 : 3) * (hot ? 1.6 : 1) * (1 + 0.08 * Math.sin(t * 3 + b.phase * 5)));
    }
    if (tween) {
      const k = Math.min(1, (performance.now() - tween.t0) / tween.ms);
      const e = ease(k);
      camera.position.lerpVectors(tween.from.p, tween.to.p, e);
      controls.target.lerpVectors(tween.from.t, tween.to.t, e);
      if (k >= 1) tween = null;
    }
    if (flight && route) {
      const k = Math.min(1, (performance.now() - flight.t0) / flight.ms);
      const e = ease(k) * 0.985;
      const p = route.curve.getPointAt(e);
      const ahead = route.curve.getPointAt(Math.min(1, e + 0.05));
      const dir = ahead.clone().sub(p).setY(0).normalize();
      const kc = 1 - Math.exp(-dt * 2.2), kt = 1 - Math.exp(-dt * 4);
      camera.position.lerp(p.clone().add(new THREE.Vector3(-dir.x * 78 - dir.z * 18, 66, -dir.z * 78 + dir.x * 18)), kc);
      controls.target.lerp(ahead, kt);
      camera.lookAt(controls.target);
      onFlight?.({ progress: k, flying: true, point: p });
      if (k >= 1) stopFlight();
    } else {
      controls.update();
    }
    renderer.render(scene, camera);
    onFrame?.(project());
  }
  frame();

  const io = new IntersectionObserver(([e]) => { running = e.isIntersecting; tick(); });
  io.observe(container);
  const onVis = () => { running = !document.hidden; tick(); };
  document.addEventListener("visibilitychange", onVis);

  return {
    setRoute, clearRoute, focus, fly, stopFlight, setLayer,
    select(slug) { selected = slug; if (slug) focus(slug); },
    home() { stopFlight(); moveTo(HOME.target.clone(), HOME.pos.clone()); },
    onFrame(fn) { onFrame = fn; },
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      controls.dispose();
      scene.traverse((o) => {
        o.geometry?.dispose?.();
        const m = o.material;
        (Array.isArray(m) ? m : m ? [m] : []).forEach((mm) => { mm.map?.dispose?.(); mm.dispose?.(); });
      });
      maskTex.dispose();
      glowTex.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      el.remove();
    },
  };
}

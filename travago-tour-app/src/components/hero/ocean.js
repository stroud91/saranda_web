// Real-time Ionian Sea, drawn by a single WebGL2 fragment shader (no libraries).
// Looking west from Sarandë: Corfu on the horizon, the town's hills on the right.
// Interactive: time of day (sun, golden hour, night with stars and town lights),
// ripples where the water is tapped, shooting stars when the night sky is tapped,
// gentle parallax with the pointer and a "dive" as the page scrolls.

const VERT = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uSun;
uniform vec2 uLook;
uniform float uScroll;
uniform vec4 uRip[6];
uniform vec3 uStar;
out vec4 outColor;

#define PI 3.14159265

float h11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float h21(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float n1(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h11(i), h11(i + 1.0), f); }
float fbm1(float x) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * n1(x); x *= 2.03; a *= 0.5; } return s; }

struct Sky { vec3 zen; vec3 hor; vec3 sunCol; vec3 sunDir; float night; float light; float golden; };

Sky makeSky() {
  Sky s;
  s.sunDir = normalize(uSun);
  float e = s.sunDir.y;
  s.night = smoothstep(0.03, -0.16, e);
  s.golden = smoothstep(0.5, 0.02, e) * (1.0 - s.night);
  s.light = clamp(e * 3.0 + 0.15, 0.0, 1.0);
  vec3 dz = vec3(0.04, 0.24, 0.66), dh = vec3(0.52, 0.76, 0.95);
  vec3 gz = vec3(0.09, 0.11, 0.34), gh = vec3(1.15, 0.40, 0.13);
  vec3 nz = vec3(0.008, 0.016, 0.05), nh = vec3(0.03, 0.06, 0.13);
  s.zen = mix(mix(dz, gz, s.golden), nz, s.night);
  s.hor = mix(mix(dh, gh, s.golden), nh, s.night);
  s.sunCol = mix(vec3(1.0, 0.95, 0.86), vec3(1.0, 0.50, 0.20), s.golden) * (1.0 - s.night);
  return s;
}

vec3 skyCol(vec3 rd, Sky s) {
  float t = pow(max(rd.y, 0.0), 0.45);
  vec3 c = mix(s.hor, s.zen, t);
  float d = max(dot(rd, s.sunDir), 0.0);
  c += s.sunCol * (pow(d, 10.0) * 0.22 + pow(d, 60.0) * 0.9) * (0.35 + 0.65 * s.golden);
  c += s.sunCol * smoothstep(0.9989, 0.99935, d) * 7.0 * step(-0.02, s.sunDir.y);
  // night: stars + moon
  if (s.night > 0.0) {
    vec2 g = vec2(atan(rd.x, -rd.z), rd.y) * vec2(180.0, 180.0);
    vec2 cell = floor(g);
    float r = h21(cell);
    vec2 f = fract(g) - 0.5 - (vec2(h21(cell + 7.1), h21(cell + 3.3)) - 0.5) * 0.6;
    float star = step(0.985, r) * smoothstep(0.12, 0.0, length(f));
    star *= 0.6 + 0.4 * sin(uTime * (1.0 + r * 4.0) + r * 60.0);
    c += vec3(0.85, 0.9, 1.0) * star * s.night * smoothstep(0.02, 0.2, rd.y) * 1.4;
    vec3 md = normalize(vec3(-0.55, 0.42, -1.0));
    float m = dot(rd, md);
    c += vec3(0.85, 0.88, 0.95) * (smoothstep(0.99955, 0.9997, m) * 1.6 + pow(max(m, 0.0), 300.0) * 0.25) * s.night;
    // shooting star
    float age = uTime - uStar.z;
    if (age > 0.0 && age < 1.2) {
      vec2 a = vec2(atan(rd.x, -rd.z), rd.y);
      vec2 head = uStar.xy + vec2(0.55, -0.22) * age;
      vec2 dir = normalize(vec2(0.55, -0.22));
      vec2 rel = a - head;
      float along = dot(rel, -dir);
      float across = abs(dot(rel, vec2(-dir.y, dir.x)));
      float trail = smoothstep(0.0025, 0.0, across) * smoothstep(0.18, 0.0, along) * step(0.0, along);
      c += vec3(1.0, 0.95, 0.85) * trail * (1.0 - age / 1.2) * 2.0 * s.night;
    }
  }
  return c;
}

// Sky plus the far island (Corfu) and Sarandë's hills with town lights.
vec3 scene(vec3 rd, Sky s) {
  vec3 c = skyCol(rd, s);
  float x = atan(rd.x, -rd.z);
  float y = rd.y;
  float hc = 0.026 * smoothstep(-0.22, 0.02, x) * smoothstep(0.34, 0.12, x) * (0.45 + 0.55 * fbm1(x * 9.0 + 3.0));
  hc += 0.008 * smoothstep(-0.3, -0.15, x) * smoothstep(0.0, -0.1, x);
  if (y < hc) {
    vec3 isl = mix(s.hor * 0.62 + s.zen * 0.12, s.hor, 0.35 + 0.25 * (1.0 - s.night));
    float lt = step(0.992, h21(floor(vec2(x * 420.0, y * 1400.0)))) * s.night * step(y, hc * 0.55);
    c = isl + vec3(1.0, 0.72, 0.42) * lt * 0.8;
  }
  float hs = smoothstep(0.3, 0.62, x) * (0.03 + 0.17 * smoothstep(0.38, 0.75, x)) * (0.7 + 0.3 * fbm1(x * 6.0 + 1.0));
  hs += 0.01 * smoothstep(0.32, 0.45, x) * fbm1(x * 31.0);
  if (y < hs) {
    vec3 hill = mix(vec3(0.17, 0.22, 0.15) * (0.25 + 0.75 * s.light), s.hor * 0.45, 0.35);
    hill = mix(hill, vec3(0.30, 0.18, 0.12), s.golden * 0.35);
    hill *= 1.0 - 0.75 * s.night;
    vec2 g = vec2(x * 300.0, y * 620.0);
    vec2 cell = floor(g);
    float r = h21(cell);
    float band = smoothstep(hs, hs * 0.15, y);
    float on = step(0.83 - 0.18 * band, r);
    float dotm = smoothstep(0.32, 0.0, length(fract(g) - 0.5));
    float flick = 0.8 + 0.2 * sin(uTime * (1.5 + r * 4.0) + r * 40.0);
    vec3 lamp = mix(vec3(1.0, 0.70, 0.36), vec3(0.85, 0.92, 1.0), step(0.97, r));
    c = hill + lamp * dotm * on * flick * band * (s.night * 1.8 + s.golden * 0.25);
  }
  return c;
}

vec3 waves(vec2 p, float t) {
  float h = 0.0;
  vec2 g = vec2(0.0);
  float a = 0.085, f = 0.6, sp = 1.0;
  vec2 d = normalize(vec2(0.35, 1.0));
  for (int i = 0; i < 7; i++) {
    float ph = dot(d, p) * f + t * sp * sqrt(f) * 1.25 + float(i) * 1.7;
    float e = exp(sin(ph) - 1.0);
    h += a * e;
    g += a * e * cos(ph) * f * d;
    d = mat2(0.8, -0.6, 0.6, 0.8) * d;
    a *= 0.6; f *= 1.72; sp *= 1.03;
  }
  return vec3(h, g);
}

vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float yaw = uLook.x * 0.12;
  float pitch = 0.05 + uLook.y * 0.035 - uScroll * 0.32;
  vec3 ro = vec3(0.0, 1.5 - uScroll * 0.9, 0.0);
  vec3 rd = normalize(vec3(uv.x, uv.y + pitch, -1.5));
  rd.xz = mat2(cos(yaw), -sin(yaw), sin(yaw), cos(yaw)) * rd.xz;
  Sky s = makeSky();
  vec3 col;
  if (rd.y >= 0.0) {
    col = scene(rd, s);
  } else {
    float t = ro.y / -rd.y;
    vec3 p = ro + rd * t;
    vec3 w = waves(p.xz, uTime);
    float k = exp(-t * 0.018);
    vec2 g = w.yz * k;
    float foam = 0.0;
    for (int i = 0; i < 6; i++) {
      vec4 r = uRip[i];
      float age = uTime - r.z;
      if (r.w <= 0.0 || age < 0.0 || age > 6.0) continue;
      vec2 dv = p.xz - r.xy;
      float d = length(dv) + 1e-4;
      float front = age * 2.4;
      float env = exp(-age * 0.6) * smoothstep(front + 0.8, front - 0.4, d) / (1.0 + d * 0.35);
      float dh = cos(d * 4.5 - age * 7.0) * 0.6 * env * r.w;
      g += dh * dv / d;
      foam += smoothstep(0.35, 0.0, abs(d - front)) * exp(-age * 0.9) * r.w;
    }
    vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
    vec3 rr = reflect(rd, n);
    rr.y = abs(rr.y);
    vec3 refl = scene(rr, s);
    float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
    vec3 deep = vec3(0.0, 0.08, 0.16), lagoon = vec3(0.0, 0.5, 0.55);
    vec3 body = mix(lagoon, deep, smoothstep(2.0, 24.0, t));
    body *= 0.12 + 0.88 * s.light;
    body = mix(body, body * vec3(1.25, 0.9, 0.75), s.golden * 0.4);
    float sss = pow(max(w.x * 6.0, 0.0), 2.0) * 0.08 * s.light;
    col = mix(body + vec3(0.0, 0.35, 0.3) * sss, refl, fres);
    float spec = pow(max(dot(rr, s.sunDir), 0.0), 380.0);
    col += s.sunCol * spec * 5.0 * step(-0.02, s.sunDir.y);
    vec3 md = normalize(vec3(-0.55, 0.42, -1.0));
    col += vec3(0.7, 0.75, 0.85) * pow(max(dot(rr, md), 0.0), 500.0) * s.night * 1.5;
    col += vec3(0.8, 0.95, 1.0) * clamp(foam, 0.0, 1.0) * 0.35 * (0.3 + 0.7 * s.light);
    col = mix(col, s.hor, 1.0 - exp(-t * 0.0045));
  }
  col = aces(col * (1.05 - 0.18 * s.golden));
  col = pow(col, vec3(1.0 / 2.2));
  col += (h21(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}`;

const PITCH0 = 0.05;

/** Hour (0–24) → sun direction in camera space (looking west over the sea). */
export function sunFromHour(hour) {
  const phase = (hour - 6) / 13.75; // 06:00 → 0, 19:45 (summer sunset over Corfu) → 1
  const el = 0.8 * Math.sin(Math.PI * Math.min(Math.max(phase, -0.35), 1.35));
  const az = -1.0 + 1.12 * Math.min(Math.max(phase, 0), 1);
  return [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
}

export function webgl2Supported() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2"));
  } catch {
    return false;
  }
}

/**
 * createOcean(canvas, {animate}) → controller
 * controller: setHour(h), setLook(x, y), setScroll(s), tap(clientX, clientY) → "water"|"sky", destroy()
 */
export function createOcean(canvas, { animate = true } = {}) {
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, depth: false, powerPreference: "high-performance", preserveDrawingBuffer: false });
  if (!gl) throw new Error("WebGL2 unavailable");

  const compile = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || "shader error");
    return sh;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.bindAttribLocation(prog, 0, "p");
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || "link error");
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const U = Object.fromEntries(["uRes", "uTime", "uSun", "uLook", "uScroll", "uRip", "uStar"].map((n) => [n, gl.getUniformLocation(prog, n)]));

  const state = {
    hour: 12, hourTarget: 12, look: [0, 0], lookTarget: [0, 0], scroll: 0,
    ripples: new Float32Array(24), rip: 0, star: [0, 0.3, -10],
    scale: Math.min(window.devicePixelRatio || 1, 1.5) * 0.75, w: 0, h: 0,
    t0: performance.now(), raf: 0, visible: true, frames: [], dirty: true,
  };
  const now = () => (performance.now() - state.t0) / 1000;

  function resize() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * state.scale));
    const h = Math.max(1, Math.round(r.height * state.scale));
    if (w !== state.w || h !== state.h) {
      state.w = canvas.width = w;
      state.h = canvas.height = h;
      gl.viewport(0, 0, w, h);
      state.dirty = true;
    }
  }

  function draw(t, dt = 1 / 60) {
    // Frame-rate independent easing (same feel at 30 or 144 fps).
    const kh = 1 - Math.exp(-dt * 5);
    const kl = 1 - Math.exp(-dt * 3.5);
    state.hour += (state.hourTarget - state.hour) * kh;
    state.look[0] += (state.lookTarget[0] - state.look[0]) * kl;
    state.look[1] += (state.lookTarget[1] - state.look[1]) * kl;
    gl.uniform2f(U.uRes, state.w, state.h);
    gl.uniform1f(U.uTime, t);
    gl.uniform3fv(U.uSun, sunFromHour(state.hour));
    gl.uniform2f(U.uLook, state.look[0], state.look[1]);
    gl.uniform1f(U.uScroll, state.scroll);
    gl.uniform4fv(U.uRip, state.ripples);
    gl.uniform3fv(U.uStar, state.star);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // Keep ~50 fps by trading resolution; never below 0.4× or above 1.5× CSS pixels.
  function adapt(dt) {
    const f = state.frames;
    f.push(dt);
    if (f.length < 40) return;
    const avg = f.reduce((a, b) => a + b, 0) / f.length;
    f.length = 0;
    const max = Math.min(window.devicePixelRatio || 1, 1.5);
    if (avg > 22 && state.scale > 0.4) state.scale = Math.max(0.4, state.scale * 0.8);
    else if (avg < 13 && state.scale < max) state.scale = Math.min(max, state.scale * 1.1);
    else return;
    resize();
  }

  let last = performance.now();
  function loop() {
    state.raf = requestAnimationFrame(loop);
    if (!state.visible) return;
    const p = performance.now();
    const dt = Math.min(0.1, (p - last) / 1000);
    adapt(p - last);
    last = p;
    draw(now(), dt);
  }

  function still() {
    // Reduced motion: draw a single frame whenever something changes.
    state.hour = state.hourTarget;
    state.look = [...state.lookTarget];
    resize();
    draw(4.0);
  }

  const ro = new ResizeObserver(() => (animate ? resize() : still()));
  ro.observe(canvas);
  const io = new IntersectionObserver(([e]) => {
    state.visible = e.isIntersecting && !document.hidden;
  });
  io.observe(canvas);
  const onVis = () => {
    state.visible = !document.hidden;
    last = performance.now();
  };
  document.addEventListener("visibilitychange", onVis);
  resize();
  if (animate) loop();
  else still();

  // Same camera as the shader, to find where a tap lands.
  function rayAt(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    const ux = (clientX - r.left - r.width / 2) / r.height;
    const uy = (r.height / 2 - (clientY - r.top)) / r.height;
    const yaw = state.look[0] * 0.12;
    const pitch = PITCH0 + state.look[1] * 0.035 - state.scroll * 0.32;
    let [x, y, z] = [ux, uy + pitch, -1.5];
    const len = Math.hypot(x, y, z);
    [x, y, z] = [x / len, y / len, z / len];
    const c = Math.cos(yaw), s = Math.sin(yaw);
    return [c * x - s * z, y, s * x + c * z];
  }

  return {
    setHour(h, immediate = false) {
      state.hourTarget = h;
      if (immediate) state.hour = h;
      if (!animate) still();
    },
    setLook(x, y) {
      state.lookTarget = [x, y];
      if (!animate) still();
    },
    setScroll(s) {
      state.scroll = s;
      if (!animate) still();
    },
    /** Returns "water" (ripple started) or "sky" (shooting star at night). */
    tap(clientX, clientY, strength = 1) {
      const [x, y, z] = rayAt(clientX, clientY);
      const t = now();
      if (y < 0) {
        const camY = 1.5 - state.scroll * 0.9;
        const d = camY / -y;
        const i = (state.rip++ % 6) * 4;
        state.ripples.set([x * d, z * d, t, strength], i);
        return { kind: "water", distance: d };
      }
      state.star = [Math.atan2(x, -z) - 0.1, y + 0.05, t];
      return { kind: "sky" };
    },
    destroy() {
      cancelAnimationFrame(state.raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}

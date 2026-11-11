// Ambient sea, synthesised with Web Audio — no audio files to download.
// Filtered noise swells like waves on a pebble beach; taps make a soft "plip".
let ctx = null;
let master = null;
let running = false;

function noiseBuffer(ac, seconds = 4) {
  const len = ac.sampleRate * seconds;
  const buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    // Brown-ish noise: integrate white noise, softly leaking back to zero.
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
  }
  return buf;
}

function build() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  const buffer = noiseBuffer(ctx);
  // Three overlapping "wave" layers with different swell periods.
  [[7.5, 0.0, 520], [11, 2.5, 380], [5.2, 1.2, 900]].forEach(([period, phase, cutoff], i) => {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.playbackRate.value = 0.9 + i * 0.07;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = cutoff;
    lp.Q.value = 0.4;
    const swell = ctx.createGain();
    swell.gain.value = 0.25;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 1 / period;
    const depth = ctx.createGain();
    depth.gain.value = 0.22;
    lfo.connect(depth).connect(swell.gain);
    // The swell also opens the filter, like a breaking wave brightening.
    const fdepth = ctx.createGain();
    fdepth.gain.value = cutoff * 0.6;
    lfo.connect(fdepth).connect(lp.frequency);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) pan.pan.value = [-0.4, 0.35, 0][i];
    src.connect(lp).connect(swell).connect(pan || master);
    if (pan) pan.connect(master);
    const t = ctx.currentTime + phase;
    src.start(0, Math.random() * 3);
    lfo.start(t);
  });
  return true;
}

export const soundAvailable = () => typeof window !== "undefined" && Boolean(window.AudioContext || window.webkitAudioContext);
export const isSoundOn = () => running;

export async function setSound(on) {
  if (on && !ctx && !build()) return false;
  if (!ctx) return false;
  if (on) await ctx.resume();
  const t = ctx.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setValueAtTime(master.gain.value, t);
  master.gain.linearRampToValueAtTime(on ? 0.5 : 0, t + (on ? 1.5 : 0.4));
  running = on;
  return true;
}

/** A droplet on the water. `pan` −1…1, `distance` makes far taps duller. */
export function plip(pan = 0, distance = 5) {
  if (!running || !ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  const f0 = 900 + Math.random() * 500;
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(f0 * 2.2, t + 0.08);
  const g = ctx.createGain();
  const vol = Math.max(0.04, 0.22 / (1 + distance * 0.08));
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (p) p.pan.value = Math.max(-1, Math.min(1, pan));
  osc.connect(g).connect(p || master);
  if (p) p.connect(master);
  osc.start(t);
  osc.stop(t + 0.3);
}

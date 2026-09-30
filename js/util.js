'use strict';
/* ===== Утилиты, шум, звук ===== */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const pad2 = n => String(Math.floor(n)).padStart(2, '0');
const fmt = n => Math.floor(n).toLocaleString('ru-RU');
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; }

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hash2(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  h = (h ^ (h >>> 13)) * 1274126177 | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function valueNoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const s = t => t * t * (3 - 2 * t);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return lerp(lerp(a, b, s(xf)), lerp(c, d, s(xf)), s(yf));
}
function fbm(x, y, seed, oct = 4) {
  let v = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { v += a * valueNoise(x * f, y * f, seed + i * 17); n += a; a *= 0.5; f *= 2; }
  return v / n;
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(((n >> 16) & 255) + amt, 0, 255), g = clamp(((n >> 8) & 255) + amt, 0, 255), b = clamp((n & 255) + amt, 0, 255);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
function mix(h1, h2, t) {
  const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
  const r = Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, t)), g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t)), bl = Math.round(lerp(a & 255, b & 255, t));
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}

/* ===== Звук (Web Audio, всё синтезируется) ===== */
const Snd = {
  ctx: null, vol: { master: 0.8, music: 0.5, sfx: 0.7 }, mood: 'day', timer: null, step: 0,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      this.ctx = new C();
      this.master = this.ctx.createGain(); this.mus = this.ctx.createGain(); this.sfx = this.ctx.createGain();
      this.mus.connect(this.master); this.sfx.connect(this.master); this.master.connect(this.ctx.destination);
      this.apply();
    } catch (e) { this.ctx = null; }
  },
  apply() { if (!this.ctx) return; this.master.gain.value = this.vol.master; this.mus.gain.value = this.vol.music * 0.35; this.sfx.gain.value = this.vol.sfx; },
  tone(f, d, type = 'square', v = 0.15, slide = 0, delay = 0, dest) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + Math.min(0.02, d / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(dest || this.sfx); o.start(t); o.stop(t + d + 0.05);
  },
  noise(d, v = 0.2, freq = 1500, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay, n = Math.floor(this.ctx.sampleRate * d);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = buf; f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = v;
    s.connect(f); f.connect(g); g.connect(this.sfx); s.start(t);
  },
  play(n) {
    if (!this.ctx) return;
    switch (n) {
      case 'click': this.tone(660, 0.06, 'triangle', 0.1); break;
      case 'error': this.tone(160, 0.15, 'sawtooth', 0.1); break;
      case 'swing': this.noise(0.12, 0.12, 2500); break;
      case 'hit': this.noise(0.1, 0.25, 900); this.tone(140, 0.1, 'square', 0.12, -60); break;
      case 'hurt': this.tone(220, 0.18, 'sawtooth', 0.15, -120); break;
      case 'die': this.tone(300, 0.5, 'sawtooth', 0.12, -250); break;
      case 'bow': this.tone(500, 0.12, 'triangle', 0.1, -300); this.noise(0.08, 0.1, 3000); break;
      case 'cast': this.tone(420, 0.3, 'sine', 0.14, 500); break;
      case 'fire': this.noise(0.35, 0.22, 700); this.tone(200, 0.3, 'sawtooth', 0.08, 200); break;
      case 'ice': this.tone(1200, 0.4, 'sine', 0.1, -800); this.tone(1800, 0.3, 'triangle', 0.06, -1000); break;
      case 'zap': this.tone(900, 0.15, 'sawtooth', 0.1, -600); this.noise(0.15, 0.15, 5000); break;
      case 'heal': [523, 659, 784].forEach((f, i) => this.tone(f, 0.25, 'sine', 0.12, 0, i * 0.08)); break;
      case 'coin': this.tone(988, 0.08, 'square', 0.08); this.tone(1319, 0.18, 'square', 0.08, 0, 0.07); break;
      case 'pickup': this.tone(700, 0.08, 'triangle', 0.1); this.tone(900, 0.1, 'triangle', 0.1, 0, 0.06); break;
      case 'levelup': [392, 494, 587, 784].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.16, 0, i * 0.11)); break;
      case 'quest': [440, 554, 659].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.13, 0, i * 0.1)); break;
      case 'roar': this.tone(90, 0.6, 'sawtooth', 0.2, -30); this.noise(0.5, 0.2, 500); break;
      case 'transform': this.noise(0.4, 0.2, 1200); this.tone(200, 0.4, 'sawtooth', 0.12, 400); break;
      case 'whoosh': this.noise(0.2, 0.15, 3500); break;
      case 'boom': this.noise(0.5, 0.35, 400); this.tone(70, 0.4, 'sine', 0.3, -30); break;
      case 'tame': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.2, 'sine', 0.13, 0, i * 0.09)); break;
      case 'bell': this.tone(880, 1.2, 'sine', 0.12); this.tone(1320, 0.9, 'sine', 0.06); break;
    }
  },
  startMusic() {
    if (!this.ctx || this.timer) return;
    const roots = { day: [146.8, 196, 220, 174.6], night: [110, 130.8, 146.8, 98], battle: [110, 123.5, 130.8, 110] };
    const scale = [1, 9 / 8, 6 / 5, 4 / 3, 3 / 2, 5 / 3, 16 / 9, 2];
    this.timer = setInterval(() => {
      if (!this.ctx || this.vol.music <= 0) return;
      const r = roots[this.mood] || roots.day, root = r[Math.floor(this.step / 2) % r.length]; this.step++;
      const dest = this.mus;
      [1, 1.5, 2].forEach((m, i) => this.tone(root * m, 3.6, 'triangle', 0.09, 0, i * 0.05, dest));
      const notes = this.mood === 'battle' ? 4 : 2;
      for (let i = 0; i < notes; i++) if (Math.random() < 0.8) this.tone(root * 2 * pick(scale), 1.2, 'sine', 0.07, 0, i * (3.6 / notes) + Math.random() * 0.3, dest);
    }, 3600);
  }
};

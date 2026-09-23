/** Процедурный звук на WebAudio: эффекты синтезируются, музыка генерируется по сцене. */

type Wave = OscillatorType;

interface Tone {
  wave: Wave;
  f0: number;
  f1?: number;
  dur: number;
  vol?: number;
  delay?: number;
}
interface Noise {
  noise: true;
  dur: number;
  vol?: number;
  lp?: number;
  hp?: number;
  lp1?: number;
  delay?: number;
}
type Part = Tone | Noise;

const SFX: Record<string, Part[]> = {
  swing: [{ noise: true, dur: 0.12, vol: 0.25, hp: 1200, lp: 5000, lp1: 1500 }],
  heavy: [{ noise: true, dur: 0.22, vol: 0.35, hp: 400, lp: 3000, lp1: 600 }, { wave: 'sine', f0: 180, f1: 80, dur: 0.2, vol: 0.2 }],
  eswing: [{ noise: true, dur: 0.14, vol: 0.18, hp: 600, lp: 2500, lp1: 900 }],
  hit: [{ noise: true, dur: 0.08, vol: 0.4, lp: 2400 }, { wave: 'square', f0: 220, f1: 90, dur: 0.07, vol: 0.12 }],
  crit: [{ noise: true, dur: 0.1, vol: 0.45, lp: 4000 }, { wave: 'square', f0: 660, f1: 220, dur: 0.12, vol: 0.14 }],
  hurt: [{ wave: 'sawtooth', f0: 300, f1: 90, dur: 0.18, vol: 0.2 }, { noise: true, dur: 0.1, vol: 0.3, lp: 1500 }],
  block: [{ wave: 'square', f0: 900, f1: 500, dur: 0.06, vol: 0.12 }, { noise: true, dur: 0.06, vol: 0.25, hp: 2000 }],
  parry: [{ wave: 'triangle', f0: 1400, f1: 1800, dur: 0.18, vol: 0.25 }, { wave: 'square', f0: 700, dur: 0.1, vol: 0.1 }],
  dodge: [{ noise: true, dur: 0.18, vol: 0.18, hp: 300, lp: 1200, lp1: 400 }],
  die: [{ wave: 'square', f0: 260, f1: 60, dur: 0.25, vol: 0.14 }, { noise: true, dur: 0.2, vol: 0.2, lp: 900 }],
  bossdie: [{ wave: 'sawtooth', f0: 200, f1: 30, dur: 1.4, vol: 0.25 }, { noise: true, dur: 1.2, vol: 0.3, lp: 700, lp1: 100 }],
  death: [{ wave: 'triangle', f0: 440, f1: 110, dur: 1.2, vol: 0.25 }, { wave: 'sine', f0: 220, f1: 55, dur: 1.4, vol: 0.2 }],
  pickup: [{ wave: 'square', f0: 660, f1: 990, dur: 0.06, vol: 0.08 }],
  coin: [{ wave: 'square', f0: 988, dur: 0.05, vol: 0.08 }, { wave: 'square', f0: 1319, dur: 0.12, vol: 0.08, delay: 0.05 }],
  rare: [{ wave: 'triangle', f0: 660, dur: 0.08, vol: 0.15 }, { wave: 'triangle', f0: 880, dur: 0.08, vol: 0.15, delay: 0.08 }, { wave: 'triangle', f0: 1320, dur: 0.2, vol: 0.15, delay: 0.16 }],
  chest: [{ wave: 'square', f0: 330, f1: 660, dur: 0.15, vol: 0.1 }, { wave: 'triangle', f0: 990, dur: 0.25, vol: 0.12, delay: 0.12 }],
  door: [{ noise: true, dur: 0.25, vol: 0.2, lp: 600 }, { wave: 'sine', f0: 120, f1: 90, dur: 0.2, vol: 0.15 }],
  stairs: [{ noise: true, dur: 0.1, vol: 0.2, lp: 800 }, { noise: true, dur: 0.1, vol: 0.2, lp: 700, delay: 0.15 }, { noise: true, dur: 0.1, vol: 0.2, lp: 600, delay: 0.3 }],
  lift: [{ wave: 'sawtooth', f0: 60, f1: 50, dur: 0.8, vol: 0.12 }, { noise: true, dur: 0.8, vol: 0.12, lp: 400 }],
  talk: [{ wave: 'triangle', f0: 520, f1: 600, dur: 0.05, vol: 0.06 }],
  heal: [{ wave: 'sine', f0: 523, dur: 0.12, vol: 0.12 }, { wave: 'sine', f0: 659, dur: 0.12, vol: 0.12, delay: 0.1 }, { wave: 'sine', f0: 784, dur: 0.25, vol: 0.12, delay: 0.2 }],
  eat: [{ noise: true, dur: 0.05, vol: 0.2, lp: 1500 }, { noise: true, dur: 0.05, vol: 0.2, lp: 1500, delay: 0.12 }],
  drink: [{ wave: 'sine', f0: 300, f1: 600, dur: 0.15, vol: 0.12 }, { wave: 'sine', f0: 350, f1: 700, dur: 0.15, vol: 0.12, delay: 0.15 }],
  equip: [{ wave: 'square', f0: 400, f1: 300, dur: 0.06, vol: 0.08 }, { noise: true, dur: 0.06, vol: 0.12, hp: 3000 }],
  levelup: [0, 4, 7, 12].map((s, i) => ({ wave: 'square' as Wave, f0: 440 * 2 ** (s / 12), dur: 0.14, vol: 0.09, delay: i * 0.09 })),
  lore: [{ wave: 'sine', f0: 392, dur: 0.4, vol: 0.12 }, { wave: 'sine', f0: 587, dur: 0.6, vol: 0.1, delay: 0.15 }],
  pot: [{ noise: true, dur: 0.15, vol: 0.3, hp: 1500 }, { wave: 'square', f0: 1200, f1: 600, dur: 0.05, vol: 0.06 }],
  pick: [{ wave: 'square', f0: 1500, f1: 900, dur: 0.04, vol: 0.1 }, { noise: true, dur: 0.05, vol: 0.2, hp: 2500 }],
  rockbreak: [{ noise: true, dur: 0.3, vol: 0.35, lp: 1200, lp1: 300 }],
  hollow: [{ wave: 'sine', f0: 160, f1: 120, dur: 0.2, vol: 0.2 }, { noise: true, dur: 0.1, vol: 0.15, lp: 900 }],
  boom: [{ noise: true, dur: 0.4, vol: 0.35, lp: 900, lp1: 100 }, { wave: 'sine', f0: 90, f1: 40, dur: 0.35, vol: 0.25 }],
  bow: [{ wave: 'triangle', f0: 200, f1: 700, dur: 0.08, vol: 0.12 }, { noise: true, dur: 0.1, vol: 0.12, hp: 2500 }],
  cast: [{ wave: 'sine', f0: 600, f1: 1200, dur: 0.15, vol: 0.12 }, { noise: true, dur: 0.15, vol: 0.08, hp: 3000 }],
  skill: [{ wave: 'triangle', f0: 300, f1: 900, dur: 0.2, vol: 0.14 }],
  windup: [{ wave: 'sine', f0: 200, f1: 320, dur: 0.12, vol: 0.05 }],
  lunge: [{ noise: true, dur: 0.18, vol: 0.18, hp: 500, lp: 2000 }],
  summon: [{ wave: 'sawtooth', f0: 80, f1: 160, dur: 0.5, vol: 0.12 }, { noise: true, dur: 0.4, vol: 0.12, lp: 600 }],
  roar: [{ wave: 'sawtooth', f0: 110, f1: 60, dur: 0.9, vol: 0.25 }, { noise: true, dur: 0.8, vol: 0.2, lp: 500 }],
  ui: [{ wave: 'square', f0: 700, dur: 0.03, vol: 0.05 }],
  thunder: [{ noise: true, dur: 1.8, vol: 0.35, lp: 400, lp1: 60 }, { noise: true, dur: 1.2, vol: 0.25, lp: 900, lp1: 100, delay: 0.15 }],
  craft: [{ wave: 'square', f0: 900, f1: 600, dur: 0.05, vol: 0.08 }, { noise: true, dur: 0.08, vol: 0.2, hp: 2000, delay: 0.06 }],
  uiback: [{ wave: 'square', f0: 500, dur: 0.03, vol: 0.05 }],
  trap: [{ wave: 'square', f0: 1800, f1: 1200, dur: 0.03, vol: 0.07 }, { wave: 'square', f0: 900, dur: 0.03, vol: 0.05, delay: 0.05 }],
  flame: [{ noise: true, dur: 0.5, vol: 0.28, lp: 1400, lp1: 300 }, { wave: 'sawtooth', f0: 70, f1: 50, dur: 0.4, vol: 0.08 }],
  plate: [{ noise: true, dur: 0.08, vol: 0.25, lp: 700 }, { wave: 'sine', f0: 220, f1: 180, dur: 0.1, vol: 0.12 }],
  solve: [0, 7, 12, 16, 19].map((s, i) => ({ wave: 'triangle' as Wave, f0: 392 * 2 ** (s / 12), dur: 0.22, vol: 0.1, delay: i * 0.08 })),
};

const SCALES = {
  town: [0, 2, 4, 7, 9, 12, 14, 16],
  night: [0, 3, 5, 7, 10, 12],
  dungeon: [0, 1, 3, 5, 7, 8, 12],
};

export class Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicGain!: GainNode;
  private noiseBuf!: AudioBuffer;
  private volume = 0.6;
  private musicMood: keyof typeof SCALES | null = null;
  private musicTimer: number | null = null;
  private drone: OscillatorNode[] = [];
  private lastPlayed = new Map<string, number>();

  /** Создать контекст по первому действию пользователя. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      this.ctx = new AudioContext();
    } catch {
      return;
    }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(c.destination);
    this.musicGain = c.createGain();
    this.musicGain.gain.value = 0.35;
    this.musicGain.connect(this.master);
    const len = c.sampleRate * 1;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    if (this.musicMood) this.startMusic(this.musicMood, true);
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.ctx) this.master.gain.value = v;
  }

  play(id: string, vol = 1): void {
    const c = this.ctx;
    const parts = SFX[id];
    if (!c || !parts || this.volume <= 0) return;
    const now = c.currentTime;
    const last = this.lastPlayed.get(id) ?? 0;
    if (now - last < 0.03) return; // не складываем одинаковые звуки в один кадр
    this.lastPlayed.set(id, now);
    for (const p of parts) {
      const t0 = now + (p.delay ?? 0);
      const g = c.createGain();
      const v = (p.vol ?? 0.2) * vol;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t0 + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + p.dur);
      if ('noise' in p) {
        const src = c.createBufferSource();
        src.buffer = this.noiseBuf;
        let node: AudioNode = src;
        if (p.hp) {
          const f = c.createBiquadFilter();
          f.type = 'highpass';
          f.frequency.value = p.hp;
          node.connect(f);
          node = f;
        }
        if (p.lp) {
          const f = c.createBiquadFilter();
          f.type = 'lowpass';
          f.frequency.setValueAtTime(p.lp, t0);
          if (p.lp1) f.frequency.exponentialRampToValueAtTime(p.lp1, t0 + p.dur);
          node.connect(f);
          node = f;
        }
        node.connect(g);
        src.start(t0, Math.random() * 0.5);
        src.stop(t0 + p.dur + 0.02);
      } else {
        const o = c.createOscillator();
        o.type = p.wave;
        o.frequency.setValueAtTime(p.f0, t0);
        if (p.f1) o.frequency.exponentialRampToValueAtTime(p.f1, t0 + p.dur);
        o.connect(g);
        o.start(t0);
        o.stop(t0 + p.dur + 0.02);
      }
      g.connect(this.master);
    }
  }

  /** Генеративная музыка: мягкий дрон + редкие ноты лада настроения. */
  startMusic(mood: keyof typeof SCALES, force = false): void {
    if (this.musicMood === mood && !force) return;
    this.musicMood = mood;
    const c = this.ctx;
    if (!c) return;
    for (const d of this.drone) {
      try {
        d.stop();
      } catch {
        /* уже остановлен */
      }
    }
    this.drone = [];
    if (this.musicTimer !== null) clearInterval(this.musicTimer);
    const root = mood === 'dungeon' ? 55 : mood === 'night' ? 98 : 131;
    for (const mul of mood === 'dungeon' ? [1, 1.5] : [1, 2]) {
      const o = c.createOscillator();
      o.type = mood === 'dungeon' ? 'sawtooth' : 'sine';
      o.frequency.value = root * mul;
      const g = c.createGain();
      g.gain.value = mood === 'dungeon' ? 0.02 : 0.025;
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = mood === 'dungeon' ? 300 : 800;
      o.connect(f);
      f.connect(g);
      g.connect(this.musicGain);
      o.start();
      this.drone.push(o);
    }
    const scale = SCALES[mood];
    const tempo = mood === 'town' ? 520 : mood === 'night' ? 800 : 1100;
    let step = 0;
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx) return;
      step++;
      const chance = mood === 'town' ? 0.7 : mood === 'night' ? 0.45 : 0.3;
      if (Math.random() > chance) return;
      const note = scale[Math.floor(Math.random() * scale.length)]!;
      const oct = mood === 'dungeon' ? 4 : step % 8 < 4 ? 4 : 2;
      this.pluck(root * oct * 2 ** (note / 12), mood === 'dungeon' ? 2.5 : 1.2, mood === 'dungeon' ? 0.05 : 0.07);
    }, tempo);
  }

  private pluck(freq: number, dur: number, vol: number): void {
    const c = this.ctx!;
    const t0 = c.currentTime;
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(this.musicGain);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }
}

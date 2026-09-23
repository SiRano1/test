import type { Fx } from '../../game/events';
import { rgba, type Ctx } from './pixel';

interface Particle {
  kind: 'px' | 'dmg' | 'text' | 'ring' | 'slash';
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  life: number;
  max: number;
  color: string;
  size: number;
  text?: string;
  crit?: boolean;
  r?: number;
  angle?: number;
  half?: number;
  heavy?: boolean;
}

/** Цифры 3×5 для чисел урона (пиксельно-чёткие). */
const DIGITS: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'], '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '011', '001', '111'], '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'], '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'], '+': ['000', '010', '111', '010', '000'], '!': ['010', '010', '010', '000', '010'],
};

export function drawDigits(ctx: Ctx, text: string, x: number, y: number, color: string, scale = 1): void {
  const w = text.length * 4 * scale - scale;
  let cx = Math.round(x - w / 2);
  const cy = Math.round(y);
  for (const ch of text) {
    const glyph = DIGITS[ch];
    if (glyph) {
      for (let pass = 0; pass < 2; pass++) {
        ctx.fillStyle = pass === 0 ? '#1a1014' : color;
        for (let j = 0; j < 5; j++)
          for (let i = 0; i < 3; i++) {
            if (glyph[j]![i] !== '1') continue;
            if (pass === 0) ctx.fillRect(cx + i * scale - scale, cy + j * scale - scale, scale * 3, scale * 3);
            else ctx.fillRect(cx + i * scale, cy + j * scale, scale, scale);
          }
      }
    }
    cx += 4 * scale;
  }
}

export class Particles {
  list: Particle[] = [];
  font = '"Pixelify Sans", monospace';

  spawn(fx: Fx): void {
    const L = this.list;
    const r = Math.random;
    switch (fx.t) {
      case 'dmg':
        L.push({ kind: 'dmg', x: fx.x, y: fx.y, vx: (r() - 0.5) * 20, vy: -45, g: 90, life: 0.8, max: 0.8, color: fx.color ?? '#fff', size: fx.crit ? 2 : 1, text: String(fx.n), crit: fx.crit });
        break;
      case 'text':
        L.push({ kind: 'text', x: fx.x, y: fx.y, vx: 0, vy: -18, g: 0, life: 1, max: 1, color: fx.color, size: 1, text: fx.text });
        break;
      case 'hit':
        for (let i = 0; i < 6; i++) {
          const a = Math.atan2(fx.dy, fx.dx) + (r() - 0.5) * 1.6;
          const s = 40 + r() * 70;
          L.push({ kind: 'px', x: fx.x, y: fx.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, g: 200, life: 0.3 + r() * 0.2, max: 0.5, color: i % 2 ? '#ffffff' : fx.color, size: 1 });
        }
        break;
      case 'death':
        for (let i = 0; i < (fx.big ? 40 : 16); i++) {
          const a = r() * Math.PI * 2, s = 20 + r() * (fx.big ? 90 : 50);
          L.push({ kind: 'px', x: fx.x, y: fx.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, g: 120, life: 0.5 + r() * 0.5, max: 1, color: r() < 0.3 ? '#ffffff' : fx.color, size: r() < 0.3 ? 2 : 1 });
        }
        break;
      case 'dust':
        for (let i = 0; i < (fx.n ?? 2); i++)
          L.push({ kind: 'px', x: fx.x + (r() - 0.5) * 6, y: fx.y, vx: (r() - 0.5) * 20, vy: -8 - r() * 10, g: 0, life: 0.35, max: 0.35, color: 'rgba(200,190,170,0.7)', size: 2 });
        break;
      case 'debris':
        for (let i = 0; i < (fx.n ?? 6); i++) {
          const a = -Math.PI / 2 + (r() - 0.5) * 2.6, s = 30 + r() * 60;
          L.push({ kind: 'px', x: fx.x, y: fx.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 260, life: 0.4 + r() * 0.3, max: 0.7, color: fx.color, size: r() < 0.4 ? 2 : 1 });
        }
        break;
      case 'sparkle':
        for (let i = 0; i < (fx.n ?? 6); i++) {
          const a = r() * Math.PI * 2, s = 10 + r() * 30;
          L.push({ kind: 'px', x: fx.x, y: fx.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, g: -10, life: 0.5 + r() * 0.5, max: 1, color: r() < 0.5 ? '#ffffff' : fx.color, size: 1 });
        }
        break;
      case 'slash':
        L.push({ kind: 'slash', x: fx.x, y: fx.y, vx: 0, vy: 0, g: 0, life: (fx.dur ?? 0.15) + 0.08, max: (fx.dur ?? 0.15) + 0.08, color: fx.color, size: 1, r: fx.r, angle: fx.angle, half: fx.half, heavy: fx.heavy });
        break;
      case 'ring':
        L.push({ kind: 'ring', x: fx.x, y: fx.y, vx: 0, vy: 0, g: 0, life: fx.dur ?? 0.3, max: fx.dur ?? 0.3, color: fx.color, size: 1, r: fx.r });
        break;
      case 'parry':
        L.push({ kind: 'ring', x: fx.x, y: fx.y, vx: 0, vy: 0, g: 0, life: 0.25, max: 0.25, color: '#ffffff', size: 2, r: 18 });
        for (let i = 0; i < 12; i++) {
          const a = r() * Math.PI * 2, s = 60 + r() * 60;
          L.push({ kind: 'px', x: fx.x, y: fx.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0, life: 0.3, max: 0.3, color: '#fff0a0', size: 1 });
        }
        break;
      case 'block':
        for (let i = 0; i < 5; i++) {
          const a = r() * Math.PI * 2, s = 30 + r() * 30;
          L.push({ kind: 'px', x: fx.x, y: fx.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0, life: 0.2, max: 0.2, color: '#c8d8ff', size: 1 });
        }
        break;
      default:
        break;
    }
    if (L.length > 900) L.splice(0, L.length - 900);
  }

  update(dt: number): void {
    for (const p of this.list) {
      p.life -= dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'dmg') {
        p.vx *= 0.9;
        if (p.vy > 0) p.vy *= 0.6;
      }
    }
    this.list = this.list.filter((p) => p.life > 0);
  }

  clear(): void {
    this.list = [];
  }

  draw(ctx: Ctx, camX: number, camY: number): void {
    for (const p of this.list) {
      const t = p.life / p.max;
      const x = p.x - camX, y = p.y - camY;
      switch (p.kind) {
        case 'px':
          ctx.globalAlpha = Math.min(1, t * 2);
          ctx.fillStyle = p.color;
          ctx.fillRect(Math.round(x), Math.round(y), p.size, p.size);
          break;
        case 'dmg':
          ctx.globalAlpha = Math.min(1, t * 3);
          drawDigits(ctx, p.text!, x, y, p.color, p.crit ? 2 : 1);
          break;
        case 'text':
          ctx.globalAlpha = Math.min(1, t * 2);
          ctx.font = `8px ${this.font}`;
          ctx.textAlign = 'center';
          ctx.fillStyle = '#1a1014';
          ctx.fillText(p.text!, Math.round(x) + 1, Math.round(y) + 1);
          ctx.fillStyle = p.color;
          ctx.fillText(p.text!, Math.round(x), Math.round(y));
          break;
        case 'ring': {
          const k = 1 - t;
          ctx.globalAlpha = t;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size * (1 + t * 2);
          ctx.beginPath();
          ctx.arc(x, y, Math.max(1, p.r! * (0.3 + 0.7 * k)), 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case 'slash': {
          const k = 1 - t;
          ctx.globalAlpha = Math.min(1, t * 2.5);
          const r0 = p.r! * 0.55, r1 = p.r!;
          const a0 = p.angle! - p.half!, a1 = p.angle! + p.half!;
          // «серп» удара: заливка между дугами
          ctx.fillStyle = rgba(p.color, p.heavy ? 0.85 : 0.7);
          ctx.beginPath();
          const sweep = Math.min(1, k * 2.2);
          const end = a0 + (a1 - a0) * sweep;
          ctx.arc(x, y, r1, a0, end);
          ctx.arc(x, y, r0 + (r1 - r0) * 0.5 * (1 - sweep), end, a0, true);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(x, y, r1, a0, end);
          ctx.stroke();
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
  }
}

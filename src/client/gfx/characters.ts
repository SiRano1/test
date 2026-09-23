import type { Look } from '../../data/npcs';
import { Grid, shade } from './pixel';

export type Dir = 'down' | 'up' | 'side';
const OUT = '#1c1418';
const BOOT = '#3a2a22';
const EYE = '#2a1a1a';

/** Гуманоид 16×20: 3 направления × 3 кадра (стойка, шаг А, шаг Б). */
export function humanoid(look: Look, dir: Dir, frame: 0 | 1 | 2): Grid {
  const g = new Grid(16, 20);
  const skin = look.skin, skinS = shade(skin, -0.15);
  const hair = look.hair, hairS = shade(hair, -0.28);
  const top = look.top, topS = shade(top, -0.28);
  const bot = look.bottom, botS = shade(bot, -0.25);
  const acc = look.accent;
  const robe = !!look.robe;

  // ── ноги ──
  if (!robe) {
    if (dir === 'side') {
      const back = frame === 0 ? 6 : frame === 1 ? 5 : 8;
      const front = frame === 0 ? 8 : frame === 1 ? 9 : 6;
      g.rect(back, 16, 2, 2, botS).rect(back, 18, 2, 2, shade(BOOT, -0.2));
      g.rect(front, 16, 2, 2, bot).rect(front, 18, 2, 2, BOOT);
    } else {
      const lUp = frame === 1 ? 1 : 0, rUp = frame === 2 ? 1 : 0;
      g.rect(5, 16, 2, 2 - lUp, bot).rect(5, 18 - lUp, 2, 2, BOOT);
      g.rect(9, 16, 2, 2 - rUp, bot).rect(9, 18 - rUp, 2, 2, BOOT);
      g.set(6, 16, botS).set(10, 16, botS);
    }
  }

  // ── туловище ──
  if (dir === 'side') {
    g.rect(5, 11, 6, 5, top);
    g.rect(5, 15, 6, 1, topS);
    if (robe) g.rect(5, 16, 6, 3, top).rect(4, 17, 8, 2, top).rect(4, 19, 3, 1, BOOT).rect(8, 19, 3, 1, BOOT).rect(4, 18, 8, 1, topS);
    g.rect(5, 14, 6, 1, acc);
    if (look.apron) g.rect(9, 12, 2, 6, '#d8c8a8');
    const ax = frame === 1 ? 8 : frame === 2 ? 6 : 7;
    g.rect(ax, 11, 2, 4, topS).rect(ax, 15, 2, 1, skin);
  } else {
    g.rect(4, 11, 8, 5, top);
    g.rect(11, 11, 1, 5, topS).rect(4, 15, 8, 1, topS);
    if (robe) {
      g.rect(4, 16, 8, 3, top).rect(3, 17, 10, 2, top).rect(3, 18, 10, 1, topS);
      g.rect(5, 19, 2, 1, BOOT).rect(9, 19, 2, 1, BOOT);
      if (dir === 'down') g.rect(7, 11, 2, 8, shade(top, 0.12));
    }
    if (dir === 'down') g.rect(4, 14, 8, 1, acc);
    else g.rect(4, 14, 8, 1, shade(acc, -0.2));
    if (look.apron && dir === 'down') g.rect(5, 12, 6, 6, '#d8c8a8').rect(5, 12, 6, 1, shade('#d8c8a8', -0.15));
    // руки с покачиванием
    const la = frame === 1 ? -1 : frame === 2 ? 1 : 0;
    g.rect(3, 11 + Math.max(0, la), 1, 4, topS).set(3, 15 + la, skin);
    g.rect(12, 11 + Math.max(0, -la), 1, 4, topS).set(12, 15 - la, skin);
  }

  // ── голова ──
  if (dir === 'side') {
    g.rect(4, 3, 8, 7, skin).rect(5, 2, 6, 1, skin).rect(5, 10, 5, 1, skinS);
    g.set(12, 7, skin); // нос
    g.set(10, 6, EYE).set(10, 7, EYE);
    g.set(7, 11, skinS);
    // волосы: макушка и затылок
    g.rect(4, 2, 7, 3, hair).rect(5, 1, 5, 1, hair).rect(4, 5, 3, 4, hair).rect(4, 5, 1, 4, hairS);
    g.set(6, 7, skin); // ухо
  } else {
    g.rect(3, 3, 10, 7, skin).rect(4, 2, 8, 1, skin).rect(5, 10, 6, 1, skinS);
    if (dir === 'down') {
      g.set(6, 6, EYE).set(6, 7, EYE).set(9, 6, EYE).set(9, 7, EYE);
      g.set(5, 8, shade('#e87070', 0.3)).set(10, 8, shade('#e87070', 0.3));
      g.rect(7, 11, 2, 1, skinS);
      g.rect(3, 2, 10, 3, hair).rect(4, 1, 8, 1, hair).rect(3, 5, 2, 2, hair).rect(11, 5, 2, 2, hair);
      g.rect(3, 4, 10, 1, hairS);
      g.set(5, 5, hairS).set(10, 5, hairS);
    } else {
      g.rect(3, 2, 10, 8, hair).rect(4, 1, 8, 1, hair).rect(4, 9, 8, 1, hairS);
      g.set(2, 6, skin).set(13, 6, skin);
    }
  }

  // ── причёски и головные уборы ──
  switch (look.style) {
    case 'long':
      if (dir === 'down') g.rect(2, 4, 2, 9, hair).rect(12, 4, 2, 9, hair).rect(2, 12, 2, 1, hairS).rect(12, 12, 2, 1, hairS);
      else if (dir === 'up') g.rect(3, 9, 10, 4, hair).rect(3, 12, 10, 1, hairS);
      else g.rect(3, 5, 3, 8, hair).rect(3, 12, 3, 1, hairS);
      break;
    case 'bald':
      if (dir === 'down') g.rect(4, 1, 8, 4, skin).rect(3, 3, 10, 2, skin).set(4, 2, skinS).set(3, 5, hair).set(12, 5, hair);
      else if (dir === 'up') g.rect(4, 1, 8, 5, skin).rect(3, 6, 10, 3, hair);
      else g.rect(5, 1, 6, 4, skin).rect(4, 5, 3, 3, hair);
      break;
    case 'hood': {
      const hc = shade(look.top, -0.1), hs = shade(look.top, -0.35);
      if (dir === 'down') {
        g.rect(2, 1, 12, 5, hc).rect(2, 6, 2, 6, hc).rect(12, 6, 2, 6, hc).rect(6, 0, 4, 1, hc);
        g.rect(4, 5, 8, 1, hs);
      } else if (dir === 'up') g.rect(2, 1, 12, 12, hc).rect(6, 0, 4, 1, hc).rect(3, 12, 10, 1, hs);
      else g.rect(3, 1, 9, 4, hc).rect(3, 5, 4, 7, hc).rect(4, 0, 5, 1, hc).rect(3, 11, 4, 1, hs);
      break;
    }
    case 'helmet': {
      const m = '#9aa0a8', ms = '#6a707a';
      if (dir === 'side') g.rect(4, 1, 8, 5, m).rect(4, 5, 8, 1, ms).rect(11, 5, 1, 3, m);
      else {
        g.rect(3, 1, 10, 5, m).rect(3, 5, 10, 1, ms).rect(4, 0, 8, 1, m);
        if (dir === 'down') g.rect(7, 5, 2, 3, m);
        else g.rect(3, 6, 10, 3, ms);
      }
      break;
    }
    case 'bun':
      if (dir === 'side') g.rect(4, 0, 3, 2, hair);
      else g.rect(6, 0, 4, 2, hair).set(6, 0, hairS);
      break;
    case 'wild':
      for (const x of [4, 6, 8, 10]) g.set(dir === 'side' ? x : x, 0, hair);
      if (dir !== 'up') g.set(dir === 'side' ? 11 : 12, 3, hair);
      break;
    case 'cap': {
      const c = look.accent, cs = shade(look.accent, -0.3);
      if (dir === 'side') g.rect(4, 1, 7, 3, c).rect(8, 4, 5, 1, cs);
      else {
        g.rect(3, 1, 10, 3, c).rect(4, 0, 8, 1, c);
        if (dir === 'down') g.rect(3, 4, 10, 1, cs);
      }
      break;
    }
    default:
      break;
  }
  if (look.beard) {
    if (dir === 'down') g.rect(4, 8, 8, 3, hair).rect(5, 11, 6, 1, hair).set(7, 8, skinS).set(8, 8, skinS);
    else if (dir === 'side') g.rect(8, 8, 4, 3, hair).rect(9, 11, 2, 1, hair);
  }

  let out = g;
  if (look.short) out = compress(g, [12, 13, 16]);
  return out.outline(OUT);
}

/** Удалить строки и дополнить сверху — «низкорослый» персонаж. */
function compress(g: Grid, rows: number[]): Grid {
  const out = new Grid(g.w, g.h);
  let dy = g.h - 1;
  for (let y = g.h - 1; y >= 0; y--) {
    if (rows.includes(y)) continue;
    for (let x = 0; x < g.w; x++) out.set(x, dy, g.get(x, y));
    dy--;
  }
  return out;
}

// ─────────────────────────── Монстры ───────────────────────────

const BONE = '#e8e0c8', BONE_S = '#b0a690', DARK = '#2a2226';

function skeletonBase(frame: number, w = 16, h = 20, ox = 0, oy = 0): Grid {
  const g = new Grid(w, h);
  const x = (v: number) => v + ox, y = (v: number) => v + oy;
  // череп
  g.rect(x(4), y(2), 8, 7, BONE).rect(x(5), y(1), 6, 1, BONE).rect(x(5), y(9), 6, 1, BONE_S);
  g.rect(x(5), y(4), 2, 2, DARK).rect(x(9), y(4), 2, 2, DARK);
  g.set(x(6), y(5), '#ff5030').set(x(10), y(5), '#ff5030');
  g.set(x(8), y(6), DARK);
  for (let i = 5; i <= 10; i += 2) g.set(x(i), y(8), DARK);
  // позвоночник и рёбра
  g.rect(x(7), y(10), 2, 6, BONE_S);
  for (let r = 11; r <= 14; r += 1) g.rect(x(5), y(r), 6, 1, r % 2 ? BONE : null);
  g.rect(x(7), y(11), 2, 4, BONE);
  g.rect(x(5), y(15), 6, 1, BONE);
  // руки
  const a = frame === 1 ? 1 : 0;
  g.rect(x(3), y(11 + a), 1, 4, BONE).rect(x(12), y(11 + (1 - a)), 1, 4, BONE);
  // ноги
  const l = frame === 1 ? 1 : 0, r2 = frame === 2 ? 1 : 0;
  g.rect(x(6), y(16), 1, 4 - l, BONE).rect(x(9), y(16), 1, 4 - r2, BONE);
  g.set(x(5), y(19 - l), BONE_S).set(x(10), y(19 - r2), BONE_S);
  return g;
}

export function monsterFrames(sprite: string): Grid[] {
  switch (sprite) {
    case 'skeleton':
      return [0, 1, 2].map((f) => skeletonBase(f).outline(OUT));
    case 'skeleton_archer':
      return [0, 1, 2].map((f) => {
        const g = skeletonBase(f);
        // лук
        const wood = '#8a5a33';
        g.line(13, 8, 14, 10, wood).line(14, 11, 14, 14, wood).line(14, 15, 13, 17, wood);
        g.line(13, 9, 13, 16, '#d8d0c0');
        g.rect(2, 9, 2, 5, '#5a3a24').set(2, 8, '#c8c0a0').set(3, 8, '#c8c0a0');
        return g.outline(OUT);
      });
    case 'bone_knight':
      return [0, 1, 2].map((f) => {
        const g = skeletonBase(f, 20, 24, 2, 4);
        const iron = '#5a5e68', ironS = '#3a3e48', ironL = '#8a90a0';
        g.rect(5, 2, 10, 6, iron).rect(6, 1, 8, 1, iron).rect(5, 7, 10, 1, ironS).rect(9, 3, 2, 6, ironL);
        g.rect(7, 5, 2, 1, '#ff5030').rect(11, 5, 2, 1, '#ff5030');
        g.rect(6, 14, 8, 5, iron).rect(6, 18, 8, 1, ironS).rect(9, 14, 2, 5, ironL);
        // щит
        g.rect(1, 13, 5, 7, '#6a3a2a').rect(2, 14, 3, 5, '#8a4a3a').rect(3, 15, 1, 3, '#d8c060');
        // меч
        g.line(17, 8, 17, 18, ironL).rect(16, 16, 3, 1, '#8a6a3a');
        return g.outline(OUT);
      });
    case 'rat':
      return [0, 1].map((f) => {
        const g = new Grid(16, 12);
        const c = '#7a6a5e', cs = '#5a4a40';
        g.ellipse(3, 4, 10, 6, c).rect(4, 8, 8, 1, cs);
        g.ellipse(10, 4, 5, 5, c).set(13, 5, '#ff4040').set(14, 7, '#e8a0a0');
        g.rect(11, 3, 2, 2, '#c8908a');
        g.line(0, 5, 3, 7, '#c8908a');
        const l = f ? 1 : 0;
        g.rect(5 + l, 10, 1, 2, cs).rect(10 - l, 10, 1, 2, cs);
        return g.outline(OUT);
      });
    case 'bat':
      return [0, 1].map((f) => {
        const g = new Grid(16, 12);
        const c = '#4a3a5a', cs = '#2e2440', m = '#6a4a6a';
        g.ellipse(6, 4, 4, 5, c).set(7, 5, '#ff4040').set(8, 5, '#ff4040').set(6, 3, c).set(9, 3, c);
        if (f === 0) {
          g.line(5, 5, 0, 1, cs).line(5, 6, 1, 3, m).rect(1, 2, 4, 3, m).line(10, 5, 15, 1, cs).line(10, 6, 14, 3, m).rect(11, 2, 4, 3, m);
        } else {
          g.line(5, 6, 0, 9, cs).rect(1, 6, 4, 3, m).line(10, 6, 15, 9, cs).rect(11, 6, 4, 3, m);
        }
        return g.outline(OUT);
      });
    case 'slime':
      return [0, 1].map((f) => {
        const g = new Grid(16, 12);
        const c = '#5fa36a', cs = '#3a6e44', hl = '#a8e0a0';
        if (f === 0) g.ellipse(2, 3, 12, 9, c).rect(3, 10, 10, 1, cs).rect(4, 4, 2, 2, hl);
        else g.ellipse(1, 5, 14, 7, c).rect(2, 10, 12, 1, cs).rect(3, 6, 2, 1, hl);
        g.set(6, f ? 7 : 6, DARK).set(9, f ? 7 : 6, DARK);
        return g.outline(OUT);
      });
    case 'ghost':
      return [0, 1].map((f) => {
        const g = new Grid(16, 18);
        const c = '#9fe0d0', cs = '#6ab0a8';
        g.ellipse(3, 1, 10, 10, c).rect(3, 6, 10, 8, c);
        for (let x = 3; x < 13; x++) g.set(x, 14 + ((x + f) % 2), c).set(x, 13, cs);
        g.rect(5, 5, 2, 3, DARK).rect(9, 5, 2, 3, DARK).rect(7, 9, 2, 2, DARK);
        g.line(12, 8, 15, 3 + f, '#8a8070');
        return g.outline('#2a4a48');
      });
    case 'drowned':
      return [0, 1, 2].map((f) =>
        humanoid({ hair: '#3a4a3a', skin: '#8aa898', top: '#4a5a6a', bottom: '#3a3a44', accent: '#5a4a3a', style: 'wild' }, 'down', f as 0 | 1 | 2),
      );
    case 'crab':
      return [0, 1].map((f) => {
        const g = new Grid(18, 12);
        const c = '#c0583e', cs = '#7e2e22', hl = '#e08a6a';
        g.ellipse(4, 3, 10, 7, c).rect(5, 8, 8, 1, cs).rect(6, 4, 3, 1, hl);
        g.set(7, 3, DARK).set(10, 3, DARK).set(7, 2, c).set(10, 2, c);
        const o = f ? 1 : 0;
        g.ellipse(0, 2 - o, 4, 4, c).ellipse(14, 2 - o, 4, 4, c).set(1, 2 - o, null).set(16, 2 - o, null);
        for (const x of [5, 7, 10, 12]) g.set(x, 10 + ((x + f) % 2), cs);
        return g.outline(OUT);
      });
    case 'bone_abbot':
      return [0, 1].map((f) => {
        const g = new Grid(32, 34);
        const robe = '#4a3a5a', robeS = '#2e2440', trim = '#c8a860';
        const bob = f;
        g.rect(9, 12 + bob, 14, 18, robe).rect(7, 22 + bob, 18, 10, robe).rect(7, 30 + bob, 18, 2, robeS);
        g.rect(15, 12 + bob, 2, 18, trim).rect(9, 12 + bob, 1, 18, robeS);
        // капюшон и череп
        g.ellipse(9, 1 + bob, 14, 13, robeS).ellipse(11, 3 + bob, 10, 10, BONE);
        g.rect(12, 6 + bob, 3, 3, DARK).rect(17, 6 + bob, 3, 3, DARK).set(13, 7 + bob, '#8fd0ff').set(18, 7 + bob, '#8fd0ff');
        for (let x = 13; x <= 19; x += 2) g.set(x, 11 + bob, DARK);
        // руки и посох
        g.rect(5, 14 + bob, 4, 3, robe).rect(4, 16 + bob, 2, 2, BONE);
        g.line(4, 4, 4, 33, '#6a5040').ellipse(1, 0, 7, 7, '#8fd0ff').ellipse(2, 1, 5, 5, '#d0f0ff');
        g.rect(23, 14 + bob, 4, 3, robe).rect(26, 16 + bob, 2, 2, BONE);
        return g.outline(OUT);
      });
    case 'gorm':
      return [0, 1].map((f) => {
        const g = new Grid(34, 34);
        const skin = '#7a9a90', skinS = '#5a7a70', cloth = '#3a4a5a', clothS = '#2a3440';
        const b = f;
        g.ellipse(6, 11 + b, 22, 18, cloth).rect(8, 20 + b, 18, 8, cloth).rect(8, 27 + b, 18, 1, clothS);
        g.rect(9, 28, 6, 5, clothS).rect(19, 28, 6, 5, clothS).rect(8, 32, 7, 2, BOOT).rect(19, 32, 7, 2, BOOT);
        g.ellipse(10, 2 + b, 14, 12, skin).rect(12, 11 + b, 10, 2, skinS);
        g.rect(13, 6 + b, 2, 2, '#e8f0e8').rect(19, 6 + b, 2, 2, '#e8f0e8');
        g.rect(9, 1 + b, 16, 4, '#c8a040').rect(15, 0 + b, 4, 2, '#fff0a0');
        // руки и кирка
        g.ellipse(1, 13 + b, 7, 9, skin).ellipse(26, 13 + b, 7, 9, skin);
        g.line(31, 4, 29, 22, '#6a5040').line(24, 4, 33, 7, '#a0a8b0').line(24, 5, 33, 8, '#7a808a');
        return g.outline(OUT);
      });
    default:
      return extraMonsterFrames(sprite) ?? [new Grid(16, 16).rect(4, 4, 8, 8, '#ff00ff').outline(OUT)];
  }
}

import { extraMonsterFrames } from './monsters2';

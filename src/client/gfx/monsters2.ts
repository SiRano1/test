import type { Look } from '../../data/npcs';
import { humanoid } from './characters';
import { Grid, shade } from './pixel';

const OUT = '#1c1418';
const DARK = '#1a1216';

/** Бронированный гуманоид (стражи, рыцари, пустые доспехи). */
function armored(frame: number, metal: string, trim: string, eye: string, w = 18, h = 22, helmCrest = false): Grid {
  const g = new Grid(w, h);
  const ox = Math.floor((w - 16) / 2), oy = h - 20;
  const m = metal, ms = shade(metal, -0.3), ml = shade(metal, 0.25);
  const X = (v: number) => v + ox, Y = (v: number) => v + oy;
  // ноги
  const l = frame === 1 ? 1 : 0, r = frame === 2 ? 1 : 0;
  g.rect(X(5), Y(15), 2, 5 - l, ms).rect(X(9), Y(15), 2, 5 - r, ms).rect(X(4), Y(19 - l), 3, 1, DARK).rect(X(9), Y(19 - r), 3, 1, DARK);
  // корпус
  g.rect(X(3), Y(9), 10, 7, m).rect(X(3), Y(15), 10, 1, ms).rect(X(7), Y(9), 2, 6, ml).rect(X(3), Y(13), 10, 1, trim);
  g.rect(X(1), Y(9), 2, 3, ml).rect(X(13), Y(9), 2, 3, ml).rect(X(1), Y(12), 2, 3, ms).rect(X(13), Y(12), 2, 3, ms);
  // шлем
  g.rect(X(4), Y(1), 8, 8, m).rect(X(5), Y(0), 6, 1, m).rect(X(4), Y(8), 8, 1, ms).rect(X(4), Y(4), 8, 1, DARK);
  g.set(X(6), Y(4), eye).set(X(9), Y(4), eye).rect(X(7), Y(5), 2, 3, ms);
  if (helmCrest) g.rect(X(7), Y(0) - 1 < 0 ? 0 : Y(0) - 1, 2, 2, trim);
  return g;
}

/** Крылатый силуэт (серафимы). */
function winged(frame: number, body: string, wing: string, glow: string, w = 22, h = 20): Grid {
  const g = new Grid(w, h);
  const c = Math.floor(w / 2);
  const up = frame === 0;
  // крылья
  for (let i = 0; i < 8; i++) {
    const y = up ? 2 + i : 6 + i;
    const len = 8 - i;
    g.rect(c - 3 - len, y, len, 1, i % 2 ? wing : shade(wing, 0.2)).rect(c + 3, y, len, 1, i % 2 ? wing : shade(wing, 0.2));
  }
  g.ellipse(c - 3, 3, 6, 6, body).rect(c - 2, 8, 4, 8, body).rect(c - 3, 15, 6, 3, shade(body, -0.2));
  g.set(c - 2, 5, glow).set(c + 1, 5, glow).rect(c - 4, 1, 8, 1, glow);
  return g;
}

export function extraMonsterFrames(sprite: string): Grid[] | null {
  switch (sprite) {
    case 'sporeling':
      return [0, 1].map((f) => {
        const g = new Grid(16, 18);
        const cap = '#b8542a', capL = '#e08050', stem = '#e8dcc0';
        g.ellipse(1, 1 + f, 14, 8, cap).rect(2, 7 + f, 12, 1, shade(cap, -0.3));
        for (const [x, y] of [[4, 3], [9, 2], [11, 5], [6, 5]] as const) g.set(x, y + f, capL);
        g.rect(5, 8 + f, 6, 7 - f, stem).set(6, 10 + f, DARK).set(9, 10 + f, DARK).rect(7, 12 + f, 2, 1, shade(stem, -0.3));
        g.rect(3, 10 + f, 2, 3, stem).rect(11, 10 + f, 2, 3, stem).rect(5, 15, 2, 3, shade(stem, -0.2)).rect(9, 15, 2, 3, shade(stem, -0.2));
        return g.outline(OUT);
      });
    case 'shroom_runner':
      return [0, 1].map((f) => {
        const g = new Grid(14, 12);
        const cap = '#6a4a8a', capL = '#a080c0';
        g.ellipse(1, 0, 12, 6, cap).set(4, 2, capL).set(8, 1, capL).rect(4, 5, 6, 4, '#e0d8c8').set(5, 6, DARK).set(8, 6, DARK);
        g.rect(4 + f, 9, 2, 3, '#c8c0b0').rect(8 - f, 9, 2, 3, '#c8c0b0');
        return g.outline(OUT);
      });
    case 'spider':
      return [0, 1].map((f) => {
        const g = new Grid(18, 12);
        const b = '#2a3a3a', gl = '#6fe3d0';
        for (let i = 0; i < 4; i++) {
          const yy = 3 + i * 2 + (i % 2 === f ? 1 : 0);
          g.line(8, 6, 1, yy, b).line(9, 6, 16, yy, b);
        }
        g.ellipse(5, 2, 8, 7, b).ellipse(7, 1, 4, 3, gl).set(7, 6, '#ff4040').set(10, 6, '#ff4040').ellipse(6, 7, 6, 4, shade(b, 0.2));
        return g.outline(OUT);
      });
    case 'myco_golem':
      return [0, 1].map((f) => {
        const g = new Grid(26, 28);
        const moss = '#4a6a3a', bark = '#5a4a38', glow = '#c8e880';
        g.ellipse(3, 6 + f, 20, 16, bark).ellipse(6, 3 + f, 14, 8, moss);
        g.ellipse(1, 12 + f, 7, 10, bark).ellipse(18, 12 + f, 7, 10, bark);
        g.rect(7, 21, 4, 6, shade(bark, -0.2)).rect(15, 21, 4, 6, shade(bark, -0.2));
        g.set(10, 10 + f, glow).set(15, 10 + f, glow);
        for (const [x, y] of [[5, 4], [19, 6], [12, 2], [8, 17], [17, 16]] as const) g.ellipse(x, y + f, 4, 3, '#c85a4a').set(x + 1, y + f, '#ffffff');
        return g.outline(OUT);
      });
    case 'spore_mother':
      return [0, 1].map((f) => {
        const g = new Grid(40, 36);
        const cap = '#8a3a5a', capL = '#c86a8a', flesh = '#d8c8b0', glow = '#c8e880';
        g.ellipse(2, 2 - f, 36, 20 + f, cap);
        for (let i = 0; i < 9; i++) g.ellipse(4 + ((i * 7) % 30), 4 + ((i * 5) % 12) - f, 5, 4, capL);
        g.rect(4, 18, 32, 2, shade(cap, -0.35));
        g.ellipse(12, 16, 16, 18, flesh).rect(14, 30, 12, 5, shade(flesh, -0.2));
        g.ellipse(15, 21, 4, 3, DARK).ellipse(22, 21, 4, 3, DARK).set(16, 22, glow).set(23, 22, glow);
        g.rect(17, 26, 6, 2, shade(flesh, -0.4));
        for (const x of [6, 10, 28, 32]) g.line(x, 20, x - 2 + f * 2, 34, '#9a8a70');
        return g.outline(OUT);
      });
    case 'ember_golem':
      return [0, 1, 2].map((f) => {
        const g = new Grid(20, 22);
        const rock = '#4a3a34', lava = '#ff7030', hot = '#ffd040';
        const l = f === 1 ? 1 : 0, r = f === 2 ? 1 : 0;
        g.rect(5, 16, 4, 6 - l, rock).rect(11, 16, 4, 6 - r, rock);
        g.ellipse(2, 5, 16, 13, rock).ellipse(0, 7, 5, 9, rock).ellipse(15, 7, 5, 9, rock).ellipse(6, 0, 8, 7, rock);
        g.line(6, 8, 9, 12, lava).line(13, 7, 11, 13, lava).line(9, 12, 12, 15, lava).set(8, 3, hot).set(11, 3, hot).rect(9, 10, 2, 2, hot);
        return g.outline(OUT);
      });
    case 'clockwork':
      return [0, 1, 2].map((f) => {
        const g = new Grid(16, 20);
        const brass = '#b08a40', bs = '#7a5a28', steel = '#8a909a';
        const l = f === 1 ? 1 : 0, r = f === 2 ? 1 : 0;
        g.rect(4, 15, 2, 5 - l, steel).rect(10, 15, 2, 5 - r, steel);
        g.rect(3, 7, 10, 8, brass).rect(3, 14, 10, 1, bs).ellipse(5, 8, 6, 6, bs).ellipse(6, 9, 4, 4, '#ffd060');
        g.rect(4, 1, 8, 6, steel).rect(5, 3, 6, 2, DARK).set(6, 3, '#40c0ff').set(9, 3, '#40c0ff').rect(7, 0, 2, 1, brass);
        g.rect(0, 8, 3, 3, steel).rect(13, 8, 3, 3, steel).rect(13, 11, 3, 2, DARK);
        return g.outline(OUT);
      });
    case 'imp':
      return [0, 1].map((f) => {
        const g = new Grid(16, 14);
        const red = '#c83a2a', dk = '#7a1a14', fl = '#ffb040';
        g.ellipse(5, 4, 6, 7, red).set(6, 6, '#ffe060').set(9, 6, '#ffe060').set(5, 3, dk).set(10, 3, dk).set(4, 2, dk).set(11, 2, dk);
        if (f === 0) g.line(5, 6, 0, 2, dk).line(10, 6, 15, 2, dk).rect(1, 3, 3, 3, dk).rect(12, 3, 3, 3, dk);
        else g.line(5, 7, 0, 10, dk).line(10, 7, 15, 10, dk).rect(1, 7, 3, 3, dk).rect(12, 7, 3, 3, dk);
        g.line(8, 11, 11, 13, dk).set(12, 13, fl);
        return g.outline(OUT);
      });
    case 'hollow_armor':
      return [0, 1, 2].map((f) => {
        const g = armored(f, '#6a5a50', '#c8a040', '#ff9040', 20, 22);
        g.line(18, 4, 18, 18, '#8a8a90').rect(16, 3, 4, 3, '#a0a0a8');
        return g.outline(OUT);
      });
    case 'brodrik':
      return [0, 1].map((f) => {
        const g = new Grid(32, 32);
        const metal = '#5a4a44', ml = '#8a7a70', gold = '#d8a040', beard = '#c86a2a';
        g.ellipse(4, 10 + f, 24, 18, metal).rect(7, 26, 7, 6, shade(metal, -0.2)).rect(18, 26, 7, 6, shade(metal, -0.2));
        g.rect(10, 12 + f, 12, 3, gold).rect(14, 15 + f, 4, 8, ml);
        g.ellipse(9, 1 + f, 14, 13, metal).rect(10, 6 + f, 12, 2, DARK).set(13, 6 + f, '#ff7030').set(18, 6 + f, '#ff7030');
        g.ellipse(10, 9 + f, 12, 9, beard).rect(12, 16 + f, 8, 3, shade(beard, -0.2)).rect(8, 0 + f, 16, 2, gold);
        // молот
        g.line(28, 6, 26, 28, '#6a5040').rect(24, 1, 8, 7, '#7a7a82').rect(24, 1, 8, 2, '#a0a0aa');
        return g.outline(OUT);
      });
    case 'ice_wraith':
    case 'shade': {
      const ice = sprite === 'ice_wraith';
      return [0, 1].map((f) => {
        const g = new Grid(16, 18);
        const c = ice ? '#bfe8ff' : '#2a1a3a', cs = ice ? '#7ab0d8' : '#140a1e', eye = ice ? '#ffffff' : '#c040ff';
        g.ellipse(3, 1, 10, 10, c).rect(3, 6, 10, 7, c);
        for (let x = 3; x < 13; x++) g.set(x, 13 + ((x + f) % 3 === 0 ? 1 : 0) + (x % 2), c).set(x, 12, cs);
        g.rect(5, 5, 2, 2, eye).rect(9, 5, 2, 2, eye);
        if (!ice) g.rect(6, 9, 4, 1, eye);
        else g.line(1, 7 + f, 3, 9, c).line(14, 7 + f, 12, 9, c);
        return g.outline(ice ? '#3a5a7a' : '#000000');
      });
    }
    case 'book':
      return [0, 1].map((f) => {
        const g = new Grid(14, 10);
        const cov = '#6a2a3a', pg = '#e8e0c8';
        if (f === 0) g.line(0, 2, 6, 5, cov).line(13, 2, 7, 5, cov).rect(1, 2, 5, 3, pg).rect(8, 2, 5, 3, pg);
        else g.line(0, 8, 6, 5, cov).line(13, 8, 7, 5, cov).rect(1, 5, 5, 3, pg).rect(8, 5, 5, 3, pg);
        g.rect(6, 3, 2, 5, cov).set(3, f ? 6 : 3, '#8a7a5a').set(10, f ? 6 : 3, '#8a7a5a');
        return g.outline(OUT);
      });
    case 'wolf':
      return [0, 1].map((f) => {
        const g = new Grid(20, 14);
        const fur = '#c8d8e8', fs = '#8aa0b8';
        g.ellipse(3, 4, 12, 7, fur).rect(4, 9, 10, 1, fs).ellipse(12, 2, 7, 6, fur).rect(16, 5, 4, 3, fur).set(15, 4, '#40a0ff').set(19, 6, DARK);
        g.set(13, 1, fs).set(15, 1, fs).line(0, 5, 3, 6, fur);
        const l = f ? 1 : 0;
        for (const x of [4, 7, 11, 14]) g.rect(x + (x % 2 ? l : -l), 10, 1, 4, fs);
        return g.outline(OUT);
      });
    case 'page_keeper':
      return [0, 1, 2].map((f) =>
        humanoid({ hair: '#dfe8f0', skin: '#b8c8d8', top: '#3a4a6a', bottom: '#2a3450', accent: '#bfefff', style: 'hood', robe: true }, 'down', f as 0 | 1 | 2),
      );
    case 'keeper_silence':
      return [0, 1].map((f) => {
        const g = new Grid(30, 34);
        const robe = '#2a3a5a', rs = '#1a2440', ice = '#bfefff';
        g.ellipse(7, 2 + f, 16, 14, rs).ellipse(9, 4 + f, 12, 10, '#0a0e18').set(12, 9 + f, ice).set(17, 9 + f, ice);
        g.rect(8, 14 + f, 14, 12, robe);
        for (let x = 6; x < 24; x++) g.rect(x, 26 + f, 1, 4 + ((x + f) % 3), robe);
        g.line(7, 16, 1, 24 - f * 2, robe).line(22, 16, 28, 24 - f * 2, robe).line(0, 24 - f * 2, 4, 30, ice).line(29, 24 - f * 2, 25, 30, ice);
        g.rect(6, 0 + f, 18, 2, ice);
        return g.outline('#0a0e18');
      });
    case 'ash_acolyte':
      return [0, 1, 2].map((f) =>
        humanoid({ hair: '#4a4448', skin: '#8a7a70', top: '#5a4a48', bottom: '#3a3030', accent: '#ff8030', style: 'hood', robe: true }, 'down', f as 0 | 1 | 2),
      );
    case 'pilgrim':
      return [0, 1, 2].map((f) => {
        const g = humanoid({ hair: '#ff8030', skin: '#6a4a3a', top: '#4a3a34', bottom: '#3a2a24', accent: '#ffb040', style: 'wild', robe: true }, 'down', f as 0 | 1 | 2);
        for (const x of [4, 7, 10]) g.set(x, (f + x) % 2, '#ffd040');
        return g;
      });
    case 'inquisitor':
      return [0, 1, 2].map((f) => {
        const g = armored(f, '#8a7a6a', '#ffb040', '#ffffff', 20, 22, true);
        g.rect(1, 6, 2, 12, '#e8e0d0').rect(0, 9, 4, 2, '#e8e0d0');
        return g.outline(OUT);
      });
    case 'seraph':
      return [0, 1].map((f) => winged(f, '#ffb040', '#ff7030', '#fff0a0').outline(OUT));
    case 'ash_seraph':
      return [0, 1].map((f) => {
        const g = new Grid(40, 34);
        const body = '#e8d0a0', wing = '#6a6068', fire = '#ff8030', glow = '#fff0a0';
        const up = f === 0;
        for (let i = 0; i < 14; i++) {
          const y = (up ? 2 : 8) + i;
          const len = 16 - i;
          g.rect(20 - 4 - len, y, len, 1, i % 3 ? wing : fire).rect(24, y, len, 1, i % 3 ? wing : fire);
        }
        g.ellipse(16, 4, 8, 8, body).rect(17, 11, 6, 14, body).rect(15, 24, 10, 8, shade(body, -0.25));
        g.rect(17, 7, 2, 1, glow).rect(21, 7, 2, 1, glow).rect(14, 1, 12, 2, glow).rect(19, 13, 2, 8, fire);
        return g.outline(OUT);
      });
    case 'royal_guard':
      return [0, 1, 2].map((f) => {
        const g = armored(f, '#3a3448', '#8a6aaa', '#c040ff', 20, 22, true);
        g.line(18, 0, 18, 20, '#6a5040').rect(16, 0, 4, 4, '#9aa0ac');
        return g.outline(OUT);
      });
    case 'abyss_knight':
      return [0, 1, 2].map((f) => {
        const g = armored(f, '#1a1424', '#6a3aa0', '#ff40ff', 22, 24, true);
        g.line(20, 2, 20, 22, '#4a3a6a').rect(18, 1, 4, 2, '#8a60c0');
        g.rect(0, 10, 4, 10, '#2a1e3a').rect(1, 12, 2, 6, '#6a3aa0');
        return g.outline('#000000');
      });
    case 'halvard':
      return [0, 1].map((f) => {
        const g = new Grid(28, 36);
        const robe = '#3a2a4a', rs = '#241a30', gold = '#e0c060', skin = '#c8b8b0', chain = '#8a8a90';
        g.rect(7, 16, 14, 16, robe).rect(5, 26, 18, 8, robe).rect(5, 33, 18, 1, rs).rect(13, 16, 2, 16, gold);
        g.ellipse(8, 5 + f, 12, 12, skin).rect(10, 11 + f, 8, 4, '#8a8a90').set(11, 9 + f, '#c040ff').set(16, 9 + f, '#c040ff');
        g.rect(8, 2 + f, 12, 3, gold).set(9, 1 + f, gold).set(13, 0 + f, gold).set(18, 1 + f, gold).set(13, 1 + f, '#ff5a6a');
        g.rect(3, 17, 4, 9, robe).rect(21, 17, 4, 9, robe);
        for (let y = 20; y < 34; y += 2) g.set(2 + (y % 4 === 0 ? 1 : 0), y, chain).set(25 - (y % 4 === 0 ? 1 : 0), y, chain);
        g.line(24, 4, 24, 26, '#c8d0e0').rect(22, 24, 5, 2, gold);
        // тёмное пламя Голода
        g.set(13, 22 + f, '#1a0a2a').set(14, 21 + f, '#6a3aa0').set(12, 23, '#6a3aa0');
        return g.outline('#000000');
      });
    case 'hunger_avatar':
      return [0, 1].map((f) => {
        const g = new Grid(44, 40);
        const dark = '#140a1e', mid = '#2a1a3a', glow = '#c040ff', eye = '#ff60ff';
        g.ellipse(6, 4 + f, 32, 30, dark).ellipse(10, 6 + f, 24, 22, mid);
        for (let i = 0; i < 7; i++) {
          const x0 = 8 + i * 5;
          g.line(x0, 30, x0 + ((i + f) % 3) * 2 - 2, 39, dark).line(x0 + 1, 30, x0 + ((i + f) % 3) * 2 - 1, 38, mid);
        }
        g.line(6, 18, 0, 10 + f * 3, dark).line(38, 18, 43, 10 + f * 3, dark);
        for (const [x, y] of [[16, 14], [26, 14], [21, 9], [13, 21], [30, 21]] as const) g.ellipse(x - 1, y + f - 1, 4, 3, glow).set(x, y + f, eye);
        g.rect(15, 25 + f, 14, 3, '#000000');
        for (let x = 16; x < 29; x += 2) g.set(x, 25 + f, '#e8e0f0');
        return g.outline('#000000');
      });
    default:
      return null;
  }
}

export type { Look };

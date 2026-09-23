import { ITEMS } from '../../data/items';
import { BUILDINGS, type BuildingSpec } from '../../game/town/town';
import { Grid, hash2, makeCanvas, mix, shade, type Canvas } from './pixel';
import { townPalette } from './tiles';

export interface Art {
  frames: Canvas[];
  /** Точка привязки (ноги сущности) внутри кадра. */
  ax: number;
  ay: number;
  /** Кадров в секунду (для анимированных). */
  fps?: number;
}

const OUT = '#1a1216';
const WOOD = '#8a5a33', WOOD_S = '#5a3a20', WOOD_L = '#b07a4a';
const IRON = '#6a6e78', IRON_L = '#9aa0ac';

const art = (grids: Grid[], ax: number, ay: number, fps?: number): Art => ({ frames: grids.map((g) => g.toCanvas()), ax, ay, fps });

/** Окна зданий — для ночной подсветки. */
export const WINDOW_LIGHTS: Record<string, { x: number; y: number }[]> = {};

export function propArt(key: string, season: number): Art | null {
  const [kind, a, b] = key.split(':');
  switch (kind) {
    case 'chest':
    case 'chest_rare':
    case 'chest_epic':
    case 'chest_open':
    case 'chest_rare_open':
    case 'chest_epic_open':
      return chest(key);
    case 'ore':
      return ore(a!);
    case 'urn':
      return art([urn('#a07860')], 6, 13);
    case 'pod':
      return art([urn('#7a5a8a')], 6, 13);
    case 'crate':
      return art([crate()], 7, 13);
    case 'books':
      return art([books()], 7, 13);
    case 'barrel':
      return art([barrel()], 7, 14);
    case 'brazier':
      return art([0, 1, 2].map((f) => brazier(f)), 6, 15, 8);
    case 'elevator':
      return art([elevator()], 10, 22);
    case 'shrine':
    case 'shrine_used':
      return art([shrine(kind === 'shrine_used')], 8, 18);
    case 'lore_note':
    case 'lore_diary':
      return art([loreNote(kind === 'lore_diary')], 6, 8);
    case 'lore_fresco':
      return art([fresco()], 8, 2);
    case 'cracked':
      return art([cracks()], 8, 15);
    case 'decor':
      return decor(a!);
    case 'well':
      return art([well()], 13, 16);
    case 'stall':
      return art([stall(a!)], 17, 20);
    case 'lamppost':
      return art([lamppost()], 3, 26);
    case 'lamp_wall':
      return art([lampWall()], 3, 14);
    case 'grave0':
    case 'grave1':
    case 'grave2':
      return art([grave(Number(kind.slice(5)))], 6, 14);
    case 'tree':
      return tree(a as 'oak' | 'pine', Number(b), season);
    case 'bush':
      return art([bush(season)], 8, 13);
    case 'building':
      return building(BUILDINGS.find((x) => x.id === a)!, season);
    case 'furn':
      return furniture(a!, b!);
    default:
      return null;
  }
}

// ─────────────────────────── Подземелье ───────────────────────────

function chest(key: string): Art {
  const open = key.endsWith('_open');
  const q = key.startsWith('chest_epic') ? 2 : key.startsWith('chest_rare') ? 1 : 0;
  const body = q === 2 ? '#5a3a7a' : q === 1 ? '#3a5a8a' : WOOD;
  const trim = q === 2 ? '#ffd060' : q === 1 ? '#c8d0e0' : '#c8a040';
  const g = new Grid(16, 14);
  g.rect(1, 5, 14, 9, body).rect(1, 12, 14, 1, shade(body, -0.3));
  if (open) {
    g.rect(1, 1, 14, 4, shade(body, -0.25)).rect(2, 4, 12, 2, '#1a1010');
    g.rect(3, 4, 3, 1, '#ffd040').rect(9, 4, 2, 1, '#ffd040');
  } else {
    g.rect(1, 2, 14, 4, shade(body, 0.1)).rect(2, 1, 12, 1, shade(body, 0.1)).rect(1, 5, 14, 1, shade(body, -0.35));
    g.rect(7, 5, 2, 3, trim).set(7, 7, '#2a2020');
  }
  g.rect(1, 2, 1, 11, trim).rect(14, 2, 1, 11, trim).rect(4, 5, 1, 8, shade(body, -0.2)).rect(11, 5, 1, 8, shade(body, -0.2));
  return art([g.outline(OUT)], 8, 14);
}

function ore(id: string): Art {
  const c = ITEMS[id]?.icon.c1 ?? '#aaaaaa';
  const stone = id === 'stone' ? '#8a8f99' : '#6e6862';
  const g = new Grid(16, 14);
  g.ellipse(1, 2, 14, 12, stone).ellipse(3, 3, 8, 6, shade(stone, 0.15)).rect(2, 11, 12, 2, shade(stone, -0.25));
  if (id !== 'stone') {
    for (let i = 0; i < 5; i++) {
      const x = 3 + Math.floor(hash2(i, id.length, 3) * 9), y = 3 + Math.floor(hash2(i, id.length, 5) * 7);
      g.rect(x, y, 2, 2, c).set(x, y, shade(c, 0.4));
    }
  }
  return art([g.outline(OUT)], 8, 14);
}

function urn(c: string): Grid {
  const g = new Grid(12, 14);
  g.ellipse(1, 4, 10, 10, c).rect(3, 1, 6, 3, shade(c, -0.1)).rect(2, 1, 8, 1, shade(c, 0.1));
  g.rect(2, 7, 8, 1, shade(c, -0.3)).set(3, 5, shade(c, 0.35)).set(3, 6, shade(c, 0.35));
  return g.outline(OUT);
}

function crate(): Grid {
  const g = new Grid(14, 14);
  g.rect(1, 2, 12, 11, WOOD).rect(1, 2, 12, 1, WOOD_L).rect(1, 12, 12, 1, WOOD_S);
  g.line(2, 3, 11, 11, WOOD_S).line(2, 11, 11, 3, WOOD_S).rect(1, 2, 1, 11, WOOD_S).rect(12, 2, 1, 11, WOOD_S);
  return g.outline(OUT);
}

function books(): Grid {
  const g = new Grid(14, 14);
  const cols = ['#8a3a3a', '#3a5a8a', '#4a7a3a', '#8a6a2a'];
  for (let i = 0; i < 4; i++) g.rect(1 + i * 3, 3 + (i % 2), 3, 10 - (i % 2), cols[i]!).rect(1 + i * 3, 5, 3, 1, '#d8c890');
  return g.outline(OUT);
}

function barrel(): Grid {
  const g = new Grid(14, 15);
  g.ellipse(1, 1, 12, 14, WOOD).rect(1, 4, 12, 1, IRON).rect(1, 10, 12, 1, IRON).ellipse(3, 1, 8, 3, WOOD_L);
  g.rect(3, 3, 1, 10, WOOD_L).rect(10, 3, 1, 10, WOOD_S);
  return g.outline(OUT);
}

function brazier(f: number): Grid {
  const g = new Grid(12, 16);
  g.rect(2, 8, 8, 3, IRON).rect(1, 7, 10, 1, IRON_L).rect(5, 11, 2, 3, IRON).rect(3, 14, 6, 1, IRON);
  const fl = ['#ff5020', '#ffa030', '#fff0a0'];
  const hs = [[4, 3], [5, 1], [6, 2], [7, 3]];
  for (let i = 0; i < hs.length; i++) {
    const [x, y] = hs[i]!;
    const yy = y + ((i + f) % 3 === 0 ? 1 : 0);
    g.rect(x!, yy, 1, 7 - yy, fl[0]!);
  }
  g.rect(4, 4 + (f % 2), 4, 3, fl[1]!).rect(5, 5 + (f % 2), 2, 2, fl[2]!);
  return g.outline(OUT);
}

function elevator(): Grid {
  const g = new Grid(20, 24);
  g.rect(1, 2, 18, 20, '#2a2220').rect(1, 2, 2, 20, IRON).rect(17, 2, 2, 20, IRON).rect(1, 1, 18, 2, IRON_L);
  for (let x = 4; x < 17; x += 3) g.rect(x, 3, 1, 18, IRON);
  g.rect(3, 20, 14, 2, WOOD).rect(8, 0, 4, 2, '#c8a040');
  g.rect(15, 10, 2, 3, '#c83030');
  return g.outline(OUT);
}

function shrine(used: boolean): Grid {
  const g = new Grid(16, 20);
  const st = '#8a8a98', stS = '#5a5a68';
  g.rect(3, 12, 10, 7, st).rect(2, 18, 12, 1, stS).rect(5, 4, 6, 8, st).rect(5, 4, 1, 8, shade(st, 0.2));
  g.ellipse(4, 0, 8, 7, used ? '#4a5a6a' : '#a0e0ff').ellipse(6, 2, 4, 3, used ? '#5a6a7a' : '#ffffff');
  return g.outline(OUT);
}

function loreNote(diary: boolean): Grid {
  const g = new Grid(12, 10);
  if (diary) g.rect(1, 1, 10, 8, '#6a3a2a').rect(2, 2, 8, 6, '#e8d8a8').rect(6, 1, 1, 8, '#4a2a1a');
  else g.rect(1, 2, 10, 7, '#e8d8a8').rect(2, 1, 8, 1, '#e8d8a8').line(3, 4, 8, 4, '#8a7a5a').line(3, 6, 7, 6, '#8a7a5a');
  return g.outline(OUT);
}

function fresco(): Grid {
  const g = new Grid(16, 14);
  g.rect(0, 0, 16, 14, '#b8a078').rect(1, 1, 14, 12, '#d8c8a0');
  g.rect(6, 3, 4, 3, '#e0c040').rect(6, 6, 4, 5, '#8a3a4a').rect(5, 10, 6, 2, '#8a3a4a');
  g.rect(7, 7, 2, 2, '#1a1010');
  g.rect(2, 6, 2, 5, '#4a5a7a').rect(12, 6, 2, 5, '#4a5a7a');
  return g;
}

function cracks(): Grid {
  const g = new Grid(16, 16);
  const c = '#1a1414';
  g.line(3, 2, 7, 7, c).line(7, 7, 5, 12, c).line(7, 7, 12, 9, c).line(12, 9, 14, 14, c).line(9, 1, 8, 5, c);
  return g;
}

function decor(kind: string): Art {
  const g = new Grid(16, 12);
  switch (kind) {
    case 'bones':
      g.line(2, 8, 9, 6, '#d8d0b8').line(5, 10, 12, 9, '#c8c0a8').ellipse(10, 3, 4, 4, '#d8d0b8').set(11, 4, '#2a2020');
      break;
    case 'skull':
      g.ellipse(4, 3, 7, 6, '#e0d8c0').rect(5, 8, 5, 2, '#e0d8c0').set(6, 5, '#2a2020').set(9, 5, '#2a2020');
      break;
    case 'candles':
      for (const [x, h] of [[4, 5], [8, 7], [11, 4]] as const) g.rect(x, 11 - h, 2, h, '#e8e0c8').set(x, 10 - h, '#ffc040');
      g.rect(3, 10, 10, 2, '#c8b890');
      break;
    case 'coffin': {
      const c = new Grid(16, 12);
      c.rect(2, 2, 12, 9, '#4a3024').rect(3, 3, 10, 7, '#6a4630').line(8, 4, 8, 8, '#c8a040').line(6, 5, 10, 5, '#c8a040');
      return art([c.outline(OUT)], 8, 11);
    }
    case 'puddle':
      g.ellipse(1, 4, 14, 6, '#3a6a8a').ellipse(3, 5, 5, 2, '#6a9aba');
      return art([g], 8, 9);
    case 'beam':
      g.rect(2, 0, 3, 12, WOOD).rect(11, 0, 3, 12, WOOD).rect(1, 0, 14, 2, WOOD_L);
      break;
    case 'cart':
      g.rect(2, 3, 12, 6, WOOD).rect(2, 3, 12, 1, WOOD_L).ellipse(3, 8, 4, 4, IRON).ellipse(9, 8, 4, 4, IRON).rect(4, 4, 8, 2, '#6a6070');
      break;
    case 'lantern_broken':
      g.rect(6, 4, 4, 6, IRON).rect(7, 5, 2, 3, '#3a3020').rect(7, 2, 2, 2, IRON);
      break;
    case 'mushroom':
    case 'glowshroom': {
      const c = kind === 'glowshroom' ? '#6fe3d0' : '#c85a4a';
      g.rect(7, 6, 2, 5, '#e8e0d0').ellipse(3, 2, 10, 6, c).set(6, 3, '#ffffff').set(10, 4, '#ffffff');
      break;
    }
    default:
      g.ellipse(4, 5, 8, 6, '#6a6060');
  }
  return art([g.outline(OUT)], 8, 11);
}

// ─────────────────────────── Город ───────────────────────────

function well(): Grid {
  const g = new Grid(26, 30);
  const st = '#8a8a90', stS = '#5a5a62';
  g.ellipse(1, 16, 24, 14, st).ellipse(4, 18, 18, 8, '#1a2838').rect(1, 23, 24, 5, st).rect(1, 27, 24, 1, stS);
  for (let x = 2; x < 25; x += 5) g.rect(x, 23, 1, 5, stS);
  g.rect(3, 2, 2, 20, WOOD).rect(21, 2, 2, 20, WOOD).rect(1, 0, 24, 4, '#7a3a2a').rect(2, 3, 22, 1, '#5a2a1a');
  g.line(13, 4, 13, 18, '#c8b890').rect(11, 16, 5, 4, WOOD);
  return g.outline(OUT);
}

function stall(color: string): Grid {
  const g = new Grid(34, 26);
  g.rect(2, 12, 30, 12, WOOD).rect(2, 12, 30, 2, WOOD_L).rect(2, 22, 30, 2, WOOD_S);
  g.rect(3, 2, 2, 12, WOOD_S).rect(29, 2, 2, 12, WOOD_S);
  for (let x = 1; x < 33; x += 4) g.rect(x, 0, 4, 6, x % 8 < 4 ? color : '#f0e8d8');
  for (let x = 1; x < 33; x += 4) g.rect(x, 6, 4, 1, shade(color, -0.3));
  const goods = ['#d83838', '#f0d060', '#6ab040', '#c08040', '#e8e0d0'];
  for (let i = 0; i < 7; i++) g.ellipse(4 + i * 4, 9, 4, 4, goods[i % goods.length]!);
  return g.outline(OUT);
}

function lamppost(): Grid {
  const g = new Grid(8, 28);
  g.rect(3, 6, 2, 21, '#2a2a30').rect(2, 26, 4, 2, '#2a2a30').rect(1, 1, 6, 6, '#2a2a30').rect(2, 2, 4, 4, '#ffd070').rect(3, 0, 2, 1, '#2a2a30');
  return g.outline(OUT);
}

function lampWall(): Grid {
  const g = new Grid(7, 10);
  g.rect(1, 1, 5, 6, '#2a2a30').rect(2, 2, 3, 4, '#ffd070').rect(3, 7, 1, 3, '#2a2a30');
  return g.outline(OUT);
}

function grave(v: number): Grid {
  const g = new Grid(12, 16);
  const st = ['#9a9aa0', '#8a8490', '#a0988a'][v]!;
  if (v === 1) g.rect(5, 1, 2, 13, st).rect(2, 4, 8, 2, st);
  else if (v === 2) g.rect(2, 6, 8, 8, st).ellipse(2, 2, 8, 8, st);
  else g.rect(2, 4, 8, 10, st).rect(3, 2, 6, 2, st);
  g.rect(1, 13, 10, 2, '#5a6a4a');
  if (v !== 1) g.line(4, 7, 7, 7, shade(st, -0.3)).line(4, 9, 7, 9, shade(st, -0.3));
  return g.outline(OUT);
}

function bush(season: number): Grid {
  const P = townPalette(season);
  const g = new Grid(16, 14);
  const c = season === 3 ? '#9ab0b0' : P.hedge;
  g.ellipse(1, 3, 14, 11, c).ellipse(3, 1, 8, 7, shade(c, 0.12)).set(5, 3, shade(c, 0.3)).set(9, 4, shade(c, 0.3));
  if (season === 0) g.set(4, 6, '#f08ab0').set(10, 7, '#ffffff').set(7, 9, '#f0e060');
  if (season === 3) g.rect(3, 1, 8, 2, '#ffffff');
  return g.outline(OUT);
}

function tree(kind: 'oak' | 'pine', v: number, season: number): Art {
  const W = 34, H = 46;
  const g = new Grid(W, H);
  const trunk = '#6a4a30', trunkS = '#4a3020';
  g.rect(14, 30, 6, 14, trunk).rect(18, 30, 2, 14, trunkS).rect(12, 42, 10, 2, trunkS);
  const leaves: string[][] = [
    ['#3e7a32', '#4f9a3c', '#2e5e26'],
    ['#387030', '#488a38', '#285422'],
    ['#b8702a', '#d8983a', '#8a4a20'],
    ['#dfe8f0', '#ffffff', '#b0c0cc'],
  ];
  const [c, hl, dk] = leaves[season]!;
  if (kind === 'oak') {
    if (season === 3) {
      // голые ветви со снегом
      g.line(17, 30, 8, 12, trunk).line(17, 30, 26, 10, trunk).line(17, 28, 17, 6, trunk).line(12, 20, 6, 18, trunk).line(22, 18, 29, 17, trunk);
      g.ellipse(5, 8, 10, 6, c!).ellipse(20, 5, 11, 6, c!).ellipse(12, 3, 10, 5, hl!);
    } else {
      g.ellipse(2, 8 + v, 30, 26 - v, dk!).ellipse(4, 4 + v, 26, 24 - v, c!).ellipse(9, 3 + v, 16, 12, hl!);
      for (let i = 0; i < 14; i++) g.set(4 + Math.floor(hash2(i, v, 1) * 26), 6 + Math.floor(hash2(i, v, 2) * 20), i % 2 ? hl! : dk!);
      if (season === 2) for (let i = 0; i < 5; i++) g.set(6 + i * 5, 12 + (i % 3) * 5, '#e05a30');
    }
  } else {
    const pc = season === 3 ? '#2e5e40' : season === 2 ? '#3a5a30' : '#2e6038';
    for (let layer = 0; layer < 4; layer++) {
      const y0 = 4 + layer * 7, w0 = 10 + layer * 5;
      for (let j = 0; j < 9; j++) {
        const w = Math.round((w0 * (j + 1)) / 9);
        g.rect(17 - w, y0 + j, w * 2, 1, j < 2 ? shade(pc, 0.15) : pc);
      }
      if (season === 3) g.rect(17 - Math.round(w0 / 3), y0 + 1, Math.round((w0 * 2) / 3), 2, '#ffffff');
    }
    g.rect(16, 1, 2, 4, pc);
  }
  return art([g.outline(OUT)], 17, 44);
}

function building(b: BuildingSpec, season: number): Art {
  const W = b.w * 16, H = (b.h + b.roofH) * 16;
  const [c, ctx] = makeCanvas(W, H);
  const wallH = b.style === 'church' ? 44 : b.style === 'crypt' ? 30 : b.style === 'tower' ? H - 46 : 30;
  const wallY = H - wallH;
  const wins: { x: number; y: number }[] = [];

  // ── крыша ──
  const roof = b.roof, roofS = shade(roof, -0.3), roofL = shade(roof, 0.2);
  if (b.style === 'tower') {
    // конусная крыша
    for (let y = 0; y < wallY; y++) {
      const t = y / wallY;
      const w = Math.round(4 + t * (W - 4));
      ctx.fillStyle = y % 4 === 0 ? roofS : mix(roof, roofL, (y % 4) / 6);
      ctx.fillRect((W - w) / 2, y, w, 1);
    }
    ctx.fillStyle = '#c8a040';
    ctx.fillRect(W / 2 - 1, 0, 2, 6);
  } else if (b.style === 'crypt') {
    ctx.fillStyle = shade(b.wall, -0.15);
    ctx.fillRect(4, wallY - 22, W - 8, 22);
    ctx.fillStyle = b.wall;
    ctx.beginPath();
    ctx.moveTo(2, wallY - 20);
    ctx.lineTo(W / 2, wallY - 34);
    ctx.lineTo(W - 2, wallY - 20);
    ctx.fill();
    ctx.fillStyle = shade(b.wall, -0.3);
    ctx.fillRect(2, wallY - 20, W - 4, 3);
    ctx.fillRect(W / 2 - 2, wallY - 30, 4, 6);
  } else {
    const top = b.style === 'church' ? 18 : 6;
    ctx.fillStyle = roofS;
    ctx.fillRect(0, top, W, wallY - top + 4);
    for (let y = top; y < wallY; y += 4) {
      for (let x = ((y / 4) % 2) * 4 - 4; x < W; x += 8) {
        const k = hash2(x, y, b.w);
        ctx.fillStyle = mix(roof, roofL, k * 0.6);
        ctx.fillRect(x + 1, y, 7, 3);
      }
    }
    // конёк
    ctx.fillStyle = shade(roof, -0.45);
    ctx.fillRect(0, top, W, 2);
    // карниз
    ctx.fillStyle = shade(roof, -0.5);
    ctx.fillRect(-1, wallY, W + 2, 3);
    if (season === 3) {
      ctx.fillStyle = '#f4f8fc';
      ctx.fillRect(0, top, W, 6);
      for (let x = 0; x < W; x += 3) ctx.fillRect(x, top + 6, 2, 1 + (x % 5 === 0 ? 2 : 0));
    }
    if (b.style === 'manor') {
      // провалы в крыше
      ctx.fillStyle = '#1a1210';
      ctx.fillRect(W * 0.25, top + 10, 12, 8);
      ctx.fillRect(W * 0.65, top + 18, 8, 6);
      ctx.fillStyle = '#3a6a2a';
      for (let i = 0; i < 12; i++) ctx.fillRect(Math.floor(hash2(i, 1, 9) * W), top + Math.floor(hash2(i, 2, 9) * (wallY - top)), 2, 2);
    }
    if (b.style === 'church') {
      // колокольня
      const tw = 22, tx = W / 2 - tw / 2;
      ctx.fillStyle = b.wall;
      ctx.fillRect(tx, 10, tw, wallY - 10);
      ctx.fillStyle = shade(b.wall, -0.2);
      ctx.fillRect(tx + tw - 3, 10, 3, wallY - 10);
      ctx.fillStyle = '#1a1418';
      ctx.fillRect(tx + 7, 18, 8, 10);
      ctx.fillStyle = '#c8a040';
      ctx.fillRect(tx + 9, 22, 4, 4);
      ctx.fillStyle = roof;
      ctx.beginPath();
      ctx.moveTo(tx - 3, 12);
      ctx.lineTo(W / 2, -2);
      ctx.lineTo(tx + tw + 3, 12);
      ctx.fill();
      ctx.fillStyle = '#e0c060';
      ctx.fillRect(W / 2 - 1, 0, 2, 5);
    } else if (b.style !== 'manor') {
      // труба
      ctx.fillStyle = '#6a4a40';
      ctx.fillRect(W - 22, top - 2, 7, 12);
      ctx.fillStyle = '#4a3028';
      ctx.fillRect(W - 23, top - 3, 9, 2);
    }
  }

  // ── стена ──
  ctx.fillStyle = b.wall;
  ctx.fillRect(0, wallY, W, wallH);
  if (b.style === 'timber' || b.style === 'shop' || b.style === 'manor') {
    ctx.fillStyle = b.style === 'manor' ? '#3a2a20' : '#5a3a24';
    ctx.fillRect(0, wallY, W, 2);
    ctx.fillRect(0, wallY + 13, W, 2);
    for (let x = 0; x < W; x += 16) ctx.fillRect(x, wallY, 2, wallH);
    ctx.fillRect(W - 2, wallY, 2, wallH);
  } else {
    for (let y = wallY; y < H; y += 5)
      for (let x = ((y - wallY) / 5) % 2 ? -4 : 0; x < W; x += 8) {
        ctx.fillStyle = mix(b.wall, shade(b.wall, -0.15), hash2(x, y, 3));
        ctx.fillRect(x + 1, y + 1, 7, 4);
      }
  }
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, H - 3, W, 3);

  // ── окна ──
  const doorX = b.door * 16;
  for (let x = 6; x < W - 10; x += 16) {
    if (Math.abs(x - doorX) < 14) continue;
    const wy = wallY + (b.style === 'church' ? 12 : 8);
    const wh = b.style === 'church' ? 18 : 10;
    ctx.fillStyle = '#3a2a20';
    ctx.fillRect(x - 1, wy - 1, 10, wh + 2);
    if (b.style === 'church') {
      const glass = ['#c83a3a', '#3a6ac8', '#e0c040', '#3aa060'];
      for (let j = 0; j < wh; j += 3) for (let i = 0; i < 8; i += 4) {
        ctx.fillStyle = glass[(i + j) % 4]!;
        ctx.fillRect(x + i, wy + j, 4, 3);
      }
    } else if (b.style === 'manor') {
      ctx.fillStyle = '#1a1410';
      ctx.fillRect(x, wy, 8, wh);
      ctx.fillStyle = WOOD;
      ctx.fillRect(x - 1, wy + 2, 10, 2);
      ctx.fillRect(x - 1, wy + 6, 10, 2);
    } else {
      ctx.fillStyle = '#28364a';
      ctx.fillRect(x, wy, 8, wh);
      ctx.fillStyle = '#4a6a8a';
      ctx.fillRect(x, wy, 3, 3);
      ctx.fillStyle = '#3a2a20';
      ctx.fillRect(x + 3, wy, 2, wh);
      ctx.fillRect(x, wy + 4, 8, 1);
      wins.push({ x: x + 4 - W / 2, y: wy + wh / 2 - H });
    }
  }

  // ── дверь ──
  const dh = b.style === 'church' ? 24 : 18;
  ctx.fillStyle = '#2a1a12';
  ctx.fillRect(doorX + 1, H - dh - 1, 14, dh + 1);
  ctx.fillStyle = b.style === 'crypt' ? '#0a0808' : '#6a4028';
  ctx.fillRect(doorX + 2, H - dh, 12, dh);
  if (b.style !== 'crypt') {
    ctx.fillStyle = '#4a2a18';
    ctx.fillRect(doorX + 7, H - dh, 1, dh);
    ctx.fillStyle = '#e0c060';
    ctx.fillRect(doorX + 10, H - dh / 2, 2, 2);
  } else {
    // ступени вниз
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = shade('#5a5458', -i * 0.15);
      ctx.fillRect(doorX + 2 + i, H - 12 + i * 3, 12 - i * 2, 2);
    }
  }
  if (b.style === 'shop') {
    for (let x = doorX - 6; x < doorX + 22; x += 4) {
      ctx.fillStyle = (x / 4) % 2 ? '#c83a3a' : '#f0e8d8';
      ctx.fillRect(x, H - dh - 8, 4, 6);
    }
  }
  if (b.sign) {
    const sx = doorX + 18, sy = H - dh - 4;
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(sx, sy - 2, 12, 1);
    ctx.fillStyle = '#c8a870';
    ctx.fillRect(sx + 1, sy, 10, 8);
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(sx + 3, sy + 2, 6, 4);
  }
  WINDOW_LIGHTS[b.id] = wins;
  return { frames: [c], ax: W / 2, ay: H };
}

// ─────────────────────────── Интерьер ───────────────────────────

function furniture(name: string, size: string): Art {
  const [tw, th] = size.split('x').map(Number) as [number, number];
  const W = tw * 16, H = th * 16 + 10;
  const g = new Grid(W, H);
  const y0 = 10;
  switch (name) {
    case 'bed':
      g.rect(1, y0 - 4, W - 2, H - y0 + 2, WOOD).rect(2, y0 - 2, W - 4, H - y0 - 2, '#e8e0d0').rect(2, y0 - 2, W - 4, 6, '#f8f4ec');
      g.rect(2, y0 + 8, W - 4, H - y0 - 12, '#6a3a5a').rect(2, y0 + 8, W - 4, 2, '#8a5a7a');
      break;
    case 'fireplace':
      g.rect(0, 0, W, H, '#7a7078').rect(4, 8, W - 8, H - 10, '#1a1010').rect(0, 0, W, 3, '#9a9098');
      g.rect(8, H - 8, W - 16, 4, '#ff7030').rect(11, H - 11, W - 22, 4, '#ffb040').rect(13, H - 12, W - 26, 2, '#fff0a0');
      break;
    case 'table':
    case 'desk':
      g.rect(0, y0 - 2, W, 8, WOOD_L).rect(0, y0 + 6, W, 2, WOOD_S).rect(2, y0 + 8, 2, H - y0 - 8, WOOD_S).rect(W - 4, y0 + 8, 2, H - y0 - 8, WOOD_S);
      if (name === 'desk') g.rect(4, y0 - 4, 6, 3, '#e8d8a8').rect(W - 10, y0 - 5, 4, 4, '#3a5a8a');
      break;
    case 'shelf_broken':
    case 'bookshelf':
    case 'shelf_food':
    case 'weapon_rack': {
      g.rect(0, 0, W, H, WOOD_S).rect(1, 1, W - 2, H - 2, '#3a2418');
      for (let y = 6; y < H; y += 8) g.rect(1, y, W - 2, 2, WOOD);
      if (name === 'bookshelf') {
        const cols = ['#8a3a3a', '#3a5a8a', '#4a7a3a', '#8a6a2a', '#6a3a7a'];
        for (let y = 0; y < H - 6; y += 8) for (let x = 2; x < W - 3; x += 3) g.rect(x, y + 1, 2, 5, cols[(x + y) % 5]!);
      } else if (name === 'shelf_food') {
        const cols = ['#d8a050', '#f0d060', '#d83838', '#6ab040'];
        for (let y = 0; y < H - 6; y += 8) for (let x = 2; x < W - 4; x += 5) g.ellipse(x, y + 2, 4, 4, cols[(x + y) % 4]!);
      } else if (name === 'weapon_rack') {
        for (let x = 4; x < W - 2; x += 6) g.line(x, 2, x + 2, H - 4, IRON_L).rect(x, H - 8, 3, 2, WOOD_L);
      } else {
        g.line(2, 4, W - 3, H - 3, '#1a1010').rect(3, 10, 4, 3, '#8a3a3a');
      }
      break;
    }
    case 'window':
      g.rect(2, 2, W - 4, 12, '#3a2a20').rect(3, 3, W - 6, 10, '#6a9ac8').rect(W / 2 - 1, 3, 1, 10, '#3a2a20');
      return art([g], W / 2, H);
    case 'rug':
    case 'rug_long':
      g.rect(1, y0, W - 2, H - y0 - 1, '#8a2a3a').rect(3, y0 + 2, W - 6, H - y0 - 5, '#a83a4a').rect(5, y0 + 4, W - 10, H - y0 - 9, '#c8a060');
      return art([g], W / 2, H);
    case 'crate':
      return art([crate()], 7, 13);
    case 'barrel':
      return art([barrel()], 7, 14);
    case 'sacks':
      g.ellipse(1, y0 - 2, 9, 12, '#c8b080').ellipse(6, y0, 9, 10, '#b8a070').rect(3, y0 - 2, 4, 1, '#8a7a50');
      break;
    case 'cobweb':
      g.line(0, 0, W - 1, H - 1, '#c8c8d0').line(W - 1, 0, 0, H - 1, '#c8c8d0').line(W / 2, 0, W / 2, H / 2, '#c8c8d0');
      return art([g], W / 2, H);
    case 'candle_stand':
      g.rect(W / 2 - 1, 6, 2, H - 8, IRON).rect(W / 2 - 4, H - 3, 8, 2, IRON).rect(W / 2 - 1, 2, 2, 4, '#e8e0c8').set(W / 2, 1, '#ffc040');
      break;
    case 'candle':
      g.rect(W / 2 - 1, H - 8, 2, 5, '#e8e0c8').set(W / 2, H - 9, '#ffc040').rect(W / 2 - 3, H - 3, 6, 1, '#c8a040');
      return art([g], W / 2, H);
    case 'forge':
      g.rect(0, 4, W, H - 4, '#5a5058').rect(4, 14, W - 8, H - 18, '#2a1010').rect(6, H - 10, W - 12, 5, '#ff7030').rect(9, H - 12, W - 18, 3, '#ffd040');
      g.rect(W / 2 - 4, 0, 8, 6, '#3a3038');
      break;
    case 'anvil':
      g.rect(2, y0, W - 4, 4, '#4a4e58').rect(0, y0 - 1, W - 3, 2, IRON_L).rect(5, y0 + 4, 6, 4, '#3a3e48').rect(3, H - 3, 10, 3, '#3a3e48');
      break;
    case 'armor_stand':
      g.rect(W / 2 - 1, 4, 2, H - 6, WOOD).rect(3, 8, W - 6, 9, IRON_L).ellipse(W / 2 - 3, 1, 6, 6, IRON).rect(4, H - 3, W - 8, 2, WOOD);
      break;
    case 'globe':
      g.ellipse(2, 2, 12, 12, '#3a6a9a').rect(5, 5, 4, 3, '#6a9a4a').rect(7, 14, 2, 6, WOOD).rect(4, H - 3, 8, 2, WOOD);
      break;
    case 'altar':
      g.rect(0, y0 - 2, W, H - y0 + 2, '#e8e0d0').rect(0, y0 - 2, W, 3, '#f8f4ec').rect(4, y0 + 2, W - 8, 4, '#c8a040');
      g.rect(W / 2 - 2, 0, 4, y0 - 2, '#e0c060').rect(W / 2 - 5, 3, 10, 2, '#e0c060');
      break;
    case 'pew':
      g.rect(0, y0 - 4, W, 4, WOOD).rect(0, y0, W, 5, WOOD_L).rect(0, y0 + 5, W, 2, WOOD_S).rect(1, y0 + 7, 2, H - y0 - 7, WOOD_S).rect(W - 3, y0 + 7, 2, H - y0 - 7, WOOD_S);
      break;
    case 'cot':
      g.rect(1, y0 - 2, W - 2, H - y0, WOOD_S).rect(2, y0 - 1, W - 4, H - y0 - 3, '#e8e8e0').rect(2, y0 - 1, W - 4, 4, '#ffffff');
      break;
    case 'counter':
      g.rect(0, y0 - 4, W, H - y0 + 4, WOOD).rect(0, y0 - 4, W, 3, WOOD_L).rect(0, H - 3, W, 3, WOOD_S);
      for (let x = 8; x < W; x += 16) g.rect(x, y0, 1, H - y0 - 3, WOOD_S);
      break;
    case 'chest_home':
      g.rect(1, y0 - 2, W - 2, H - y0, '#7a4a28').rect(1, y0 - 4, W - 2, 4, '#9a6038').rect(1, y0, W - 2, 1, '#4a2a18');
      g.rect(W / 2 - 1, y0, 2, 3, '#e0c060').rect(1, y0 - 4, 1, H - y0 + 4, '#c8a040').rect(W - 2, y0 - 4, 1, H - y0 + 4, '#c8a040');
      break;
    case 'stove':
      g.rect(0, y0 - 6, W, H - y0 + 6, '#5a5058').rect(0, y0 - 6, W, 2, '#7a7078').rect(3, y0, 10, 8, '#1a1010').rect(5, y0 + 4, 6, 3, '#ff7030').rect(6, y0 + 3, 4, 2, '#ffd040');
      g.ellipse(W - 13, y0 - 10, 10, 6, '#3a3a40').rect(W - 12, y0 - 8, 8, 2, '#6a6a72');
      break;
    case 'furnace':
      g.rect(0, 0, W, H, '#6a5a58').rect(2, 2, W - 4, 3, '#8a7a78').rect(6, y0 + 2, W - 12, H - y0 - 4, '#1a0e0a');
      g.rect(8, H - 8, W - 16, 4, '#ff6020').rect(10, H - 10, W - 20, 3, '#ffc040').rect(W / 2 - 3, 0, 6, 4, '#4a3a38');
      break;
    case 'alchemy_table':
      g.rect(0, y0, W, 6, WOOD_L).rect(0, y0 + 6, W, 2, WOOD_S).rect(2, y0 + 8, 2, H - y0 - 8, WOOD_S).rect(W - 4, y0 + 8, 2, H - y0 - 8, WOOD_S);
      g.ellipse(3, y0 - 8, 7, 9, '#a8e0ff').ellipse(4, y0 - 5, 5, 5, '#60e080').rect(5, y0 - 10, 3, 3, '#d8e8f0');
      g.ellipse(14, y0 - 6, 6, 7, '#d8e8f0').ellipse(15, y0 - 4, 4, 4, '#e04860').rect(22, y0 - 7, 4, 7, '#c8a870');
      break;
    case 'potion_shelf': {
      g.rect(0, 0, W, H, WOOD_S).rect(1, 1, W - 2, H - 2, '#3a2418');
      for (let y = 6; y < H; y += 8) g.rect(1, y, W - 2, 2, WOOD);
      const cols = ['#e04848', '#48c060', '#4870e0', '#c0e040', '#c07bff'];
      for (let y = 0; y < H - 6; y += 8) for (let x = 2; x < W - 3; x += 4) g.rect(x, y + 2, 3, 4, cols[(x + y) % 5]!).set(x + 1, y + 1, '#d8e8f0');
      break;
    }
    case 'cauldron':
      g.ellipse(0, y0 - 2, W, H - y0 + 2, '#2a2a30').ellipse(2, y0 - 4, W - 4, 6, '#60e080').set(5, y0 - 2, '#c0ffc0').set(9, y0 - 3, '#c0ffc0');
      break;
    case 'stage':
      g.rect(0, y0 + 2, W, H - y0 - 2, '#6a3a2a').rect(0, y0 + 2, W, 2, '#8a5a3a').rect(0, 0, 2, y0 + 2, '#8a2a3a').rect(W - 2, 0, 2, y0 + 2, '#8a2a3a');
      return art([g], W / 2, H);
    case 'map_table':
      g.rect(0, y0 - 2, W, 8, WOOD).rect(2, y0 - 1, W - 4, 5, '#d8c890').line(6, y0, 14, y0 + 3, '#8a3a2a').line(20, y0 + 1, 30, y0 + 2, '#3a5a8a');
      g.rect(2, y0 + 6, 2, H - y0 - 6, WOOD_S).rect(W - 4, y0 + 6, 2, H - y0 - 6, WOOD_S);
      break;
    case 'magic_circle':
      g.ellipse(2, y0, W - 4, H - y0 - 2, '#3a2a5a').ellipse(5, y0 + 3, W - 10, H - y0 - 8, '#241a3a');
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        g.set(Math.round(W / 2 + Math.cos(a) * (W / 2 - 4)), Math.round(y0 + (H - y0) / 2 + Math.sin(a) * ((H - y0) / 2 - 3)), '#b090ff');
      }
      return art([g], W / 2, H);
    case 'crystal':
      g.rect(4, H - 4, 8, 4, '#5a4a6a').line(8, y0 - 6, 12, y0 + 2, '#80c0ff').line(8, y0 - 6, 4, y0 + 2, '#80c0ff');
      g.ellipse(4, y0 - 6, 8, 12, '#80c0ff').ellipse(6, y0 - 4, 3, 5, '#e0f0ff');
      break;
    default:
      g.rect(0, y0, W, H - y0, '#8a8a8a');
  }
  return art([g.outline(OUT)], W / 2, H);
}

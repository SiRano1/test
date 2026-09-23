import type { IconSpec } from '../../data/items';
import { Grid, shade } from './pixel';

const OUT = '#1a1216';
const WOOD = '#8a5a33', WOOD_S = '#5a3a20';

/** Иконка предмета 16×16 по форме и двум цветам. */
export function iconGrid(spec: IconSpec): Grid {
  const g = new Grid(16, 16);
  const c1 = spec.c1, c2 = spec.c2 ?? shade(c1, -0.3);
  const hl = shade(c1, 0.35), dk = shade(c1, -0.35);
  switch (spec.shape) {
    case 'sword':
      g.line(3, 12, 12, 3, c1).line(4, 12, 12, 4, hl).line(3, 11, 11, 3, dk);
      g.line(2, 10, 5, 13, '#c8a040').rect(1, 13, 2, 2, WOOD).set(2, 12, WOOD);
      g.set(13, 2, hl);
      break;
    case 'spear':
      g.line(2, 13, 10, 5, WOOD).line(3, 13, 10, 6, WOOD_S);
      g.rect(10, 3, 3, 3, c1).set(13, 2, hl).set(12, 3, hl).set(10, 5, dk).set(11, 6, dk);
      g.rect(9, 6, 2, 1, '#c8a040');
      break;
    case 'bow':
      for (let i = 0; i < 12; i++) {
        const t = i / 11;
        const x = Math.round(4 + Math.sin(t * Math.PI) * 7), y = 2 + i;
        g.set(x, y, c1).set(x - 1, y, dk);
      }
      g.line(4, 2, 4, 13, '#e8e0d0');
      g.rect(8, 7, 2, 2, WOOD);
      break;
    case 'staff':
      g.line(3, 14, 10, 5, WOOD).line(4, 14, 11, 5, WOOD_S);
      g.ellipse(9, 1, 6, 6, c1).ellipse(10, 2, 3, 3, hl).set(12, 5, dk);
      break;
    case 'shield':
      g.rect(3, 2, 9, 8, c1).rect(4, 10, 7, 2, c1).rect(5, 12, 5, 1, c1).rect(6, 13, 3, 1, c1);
      g.rect(3, 2, 9, 1, hl).rect(7, 3, 1, 10, c2).rect(4, 6, 7, 1, c2);
      g.line(11, 9, 14, 14, WOOD).rect(12, 8, 3, 2, '#8a8a90');
      break;
    case 'helm':
      g.ellipse(3, 2, 10, 10, c1).rect(3, 8, 10, 4, c1).rect(3, 7, 10, 1, dk);
      g.rect(7, 7, 2, 5, dk).rect(5, 3, 2, 3, hl);
      g.rect(3, 12, 3, 1, c2).rect(10, 12, 3, 1, c2);
      break;
    case 'armor':
      g.rect(3, 3, 10, 10, c1).rect(1, 3, 3, 4, c1).rect(12, 3, 3, 4, c1);
      g.rect(6, 2, 4, 2, null).rect(3, 12, 10, 1, dk).rect(7, 4, 2, 8, c2).rect(4, 4, 2, 2, hl);
      g.rect(3, 9, 10, 1, '#8a6a3a');
      break;
    case 'boots':
      g.rect(3, 3, 4, 8, c1).rect(3, 10, 6, 3, c1).rect(9, 3, 4, 8, c1).rect(9, 10, 6, 3, c1);
      g.rect(3, 12, 6, 1, dk).rect(9, 12, 6, 1, dk).rect(4, 4, 1, 5, hl).rect(10, 4, 1, 5, hl);
      break;
    case 'ring':
      g.ellipse(3, 5, 10, 9, c1).ellipse(5, 7, 6, 5, null).set(4, 7, hl);
      g.ellipse(6, 1, 5, 5, c2).set(7, 2, '#ffffff');
      break;
    case 'amulet':
      g.line(3, 1, 8, 8, c1).line(13, 1, 8, 8, c1);
      g.ellipse(5, 7, 7, 8, c1).ellipse(6, 8, 5, 6, c2).set(7, 9, '#ffffff');
      break;
    case 'potion':
      g.rect(6, 1, 4, 2, '#a07850').rect(6, 3, 4, 2, '#d8e8f0');
      g.ellipse(3, 5, 10, 10, '#d8e8f0').ellipse(4, 7, 8, 7, c1).rect(4, 8, 8, 1, c2);
      g.set(5, 8, '#ffffff').set(5, 9, hl);
      break;
    case 'vial':
      g.rect(6, 1, 4, 3, '#a07850').rect(5, 4, 6, 10, c1).rect(6, 5, 1, 7, '#ffffff').rect(5, 13, 6, 1, c2);
      break;
    case 'ore':
      g.ellipse(2, 4, 12, 10, '#6a6460').ellipse(3, 5, 9, 7, '#8a8480');
      g.rect(5, 6, 2, 2, c1).rect(9, 8, 2, 2, c1).set(7, 10, c1).set(10, 6, hl).set(5, 6, hl);
      break;
    case 'rock':
      g.ellipse(2, 4, 12, 10, c1).ellipse(4, 5, 6, 4, c2).set(5, 6, shade(c2, 0.3));
      break;
    case 'bar':
      g.rect(2, 7, 12, 5, c1).rect(4, 5, 8, 2, hl).rect(2, 11, 12, 1, c2).rect(3, 8, 3, 1, hl);
      break;
    case 'bone':
      g.line(3, 12, 12, 3, c1).line(4, 12, 12, 4, c1);
      g.ellipse(1, 10, 4, 4, c1).ellipse(3, 12, 4, 3, c1).ellipse(11, 1, 4, 4, c1).ellipse(12, 3, 3, 4, c1);
      g.line(4, 13, 13, 4, c2);
      break;
    case 'cloth':
      g.rect(2, 4, 12, 8, c1).rect(3, 3, 5, 1, c1).rect(9, 12, 4, 1, c1);
      g.line(2, 7, 13, 7, c2).set(6, 5, hl).set(11, 9, c2).set(4, 10, c2);
      break;
    case 'herb':
      g.line(8, 14, 8, 6, '#3a6a2a');
      g.ellipse(3, 3, 6, 5, c1).ellipse(8, 1, 6, 5, c1).ellipse(6, 7, 6, 5, c2).set(5, 4, hl).set(10, 2, hl);
      break;
    case 'wing':
      g.line(2, 12, 13, 3, c2).rect(4, 5, 8, 6, c1).line(4, 11, 12, 5, c2).set(5, 6, hl);
      break;
    case 'blob':
      g.ellipse(2, 5, 12, 9, c1).rect(3, 12, 10, 1, c2).rect(5, 6, 2, 2, hl);
      break;
    case 'gem':
      g.rect(4, 3, 8, 2, hl).rect(3, 5, 10, 3, c1).rect(4, 8, 8, 2, c1).rect(5, 10, 6, 2, c2).rect(7, 12, 2, 2, c2);
      g.set(5, 4, '#ffffff').set(6, 5, '#ffffff');
      break;
    case 'shell':
      g.ellipse(2, 3, 12, 11, c1);
      for (let i = 4; i < 13; i += 3) g.line(8, 13, i, 4, c2);
      g.set(5, 5, hl);
      break;
    case 'dust':
      g.ellipse(2, 8, 12, 6, c1).ellipse(5, 6, 6, 4, c1).set(5, 9, hl).set(9, 8, hl).set(11, 11, c2).set(4, 11, c2);
      g.set(3, 4, c1).set(12, 5, c1).set(8, 3, hl);
      break;
    case 'mushroom':
      g.rect(6, 8, 4, 6, '#e8e0d0').ellipse(2, 2, 12, 8, c1).rect(2, 7, 12, 1, c2).set(5, 4, hl).set(10, 3, hl);
      break;
    case 'scroll':
      g.rect(3, 3, 10, 10, c1).rect(2, 2, 12, 2, c2).rect(2, 12, 12, 2, c2);
      for (let y = 5; y < 11; y += 2) g.line(5, y, 11, y, shade(c2, -0.2));
      break;
    case 'flame':
      g.ellipse(4, 5, 8, 10, c2).ellipse(5, 3, 6, 9, c1).ellipse(6, 7, 4, 6, '#fff0a0').set(8, 1, c1);
      break;
    case 'bread':
      g.ellipse(1, 5, 14, 9, c1).rect(2, 11, 12, 2, c2).line(4, 7, 6, 5, hl).line(8, 7, 10, 5, hl);
      break;
    case 'cheese':
      g.rect(2, 7, 12, 6, c1).line(2, 7, 12, 3, c1).rect(3, 6, 10, 1, c1).rect(2, 12, 12, 1, c2);
      g.set(5, 9, c2).set(9, 10, c2).set(11, 8, c2);
      break;
    case 'apple':
      g.ellipse(2, 4, 12, 11, c1).set(5, 6, hl).set(4, 7, hl).line(8, 1, 8, 4, WOOD).rect(9, 1, 3, 2, c2);
      break;
    case 'bowl':
      g.ellipse(1, 5, 14, 9, shade(c1, -0.2)).rect(1, 5, 14, 4, null).ellipse(2, 4, 12, 4, c2).rect(1, 8, 14, 1, c1);
      g.set(5, 2, '#e8e8e8').set(9, 1, '#e8e8e8');
      break;
    case 'pie':
      g.ellipse(1, 5, 14, 9, c1).ellipse(3, 5, 10, 6, shade(c1, 0.2));
      g.line(4, 7, 11, 7, c2).line(7, 5, 7, 10, c2).set(5, 6, hl);
      break;
    case 'log':
      g.rect(1, 5, 12, 7, c1).ellipse(10, 5, 5, 7, c2).set(12, 8, shade(c2, 0.3)).line(2, 7, 9, 7, shade(c1, -0.2));
      break;
    case 'shard':
      g.line(8, 1, 13, 7, c1).line(13, 7, 8, 14, c1).line(8, 14, 3, 7, c1).line(3, 7, 8, 1, c1);
      for (let y = 2; y < 14; y++) {
        const hw = y < 7 ? (y - 1) * 0.8 : (14 - y) * 0.7;
        for (let x = Math.round(8 - hw); x <= Math.round(8 + hw); x++) g.set(x, y, x < 8 ? c1 : c2);
      }
      g.set(7, 4, '#ffffff').set(6, 6, '#ffffff');
      break;
    case 'coin':
      g.ellipse(3, 3, 10, 10, '#ffd040').ellipse(5, 5, 6, 6, '#e0a820').set(6, 6, '#fff0a0');
      break;
    default:
      g.rect(3, 3, 10, 10, c1);
  }
  return g.outline(OUT);
}

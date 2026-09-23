import { TILE } from '../../core/math';
import { hashSeed } from '../../core/rng';
import { Tile, TileMap } from '../../core/tilemap';
import { tr } from '../../data/strings';
import { Npc } from '../entities/npc';
import { door, Prop, Spot } from '../entities/props';
import { World, type GameApi, type SpawnSpec } from '../world';
import { doorSpawn } from './town';

interface Furniture {
  x: number;
  y: number;
  sprite: string;
  w?: number;
  h?: number;
  block?: boolean;
  light?: { r: number; color: string; flicker?: number };
}

interface InteriorSpec {
  w: number;
  h: number;
  floor: number;
  furniture: Furniture[];
  npcs: { id: string; x: number; y: number; roam?: number; facing?: 0 | 1 | 2 | 3 }[];
  /** Кровать (сон) и прилавок (торговля) задаются отдельно. */
  bed?: { x: number; y: number };
  counter?: { x: number; y: number; w: number; shop: string; npc: string };
  darkness: number;
}

const INTERIORS: Record<string, InteriorSpec> = {
  manor: {
    w: 16, h: 11, floor: Tile.WOOD, darkness: 0.35,
    furniture: [
      { x: 2, y: 3, sprite: 'bed', w: 2, h: 2, block: true },
      { x: 5, y: 2, sprite: 'fireplace', w: 2, h: 1, block: true, light: { r: 60, color: '#ff9a40', flicker: 0.15 } },
      { x: 10, y: 5, sprite: 'table', w: 2, h: 1, block: true },
      { x: 12, y: 2, sprite: 'shelf_broken', w: 2, h: 1, block: true },
      { x: 9, y: 2, sprite: 'window', w: 1, h: 1 },
      { x: 3, y: 7, sprite: 'rug', w: 3, h: 2 },
      { x: 13, y: 8, sprite: 'crate', w: 1, h: 1, block: true },
      { x: 14, y: 8, sprite: 'cobweb', w: 1, h: 1 },
      { x: 1, y: 9, sprite: 'cobweb', w: 1, h: 1 },
      { x: 7, y: 5, sprite: 'candle_stand', w: 1, h: 1, block: true, light: { r: 36, color: '#ffd080', flicker: 0.1 } },
    ],
    npcs: [], bed: { x: 2, y: 3 },
  },
  smithy: {
    w: 13, h: 10, floor: Tile.STONE, darkness: 0.25,
    furniture: [
      { x: 1, y: 2, sprite: 'forge', w: 2, h: 2, block: true, light: { r: 70, color: '#ff7030', flicker: 0.2 } },
      { x: 4, y: 3, sprite: 'anvil', w: 1, h: 1, block: true },
      { x: 8, y: 2, sprite: 'weapon_rack', w: 2, h: 1, block: true },
      { x: 10, y: 2, sprite: 'armor_stand', w: 1, h: 1, block: true },
      { x: 11, y: 6, sprite: 'barrel', w: 1, h: 1, block: true },
      { x: 1, y: 7, sprite: 'crate', w: 1, h: 1, block: true },
    ],
    npcs: [{ id: 'hilda', x: 6, y: 3, roam: 12, facing: 0 }],
    counter: { x: 4, y: 5, w: 5, shop: 'smith', npc: 'hilda' },
  },
  archive: {
    w: 15, h: 10, floor: Tile.WOOD, darkness: 0.3,
    furniture: [
      { x: 1, y: 2, sprite: 'bookshelf', w: 2, h: 1, block: true },
      { x: 3, y: 2, sprite: 'bookshelf', w: 2, h: 1, block: true },
      { x: 10, y: 2, sprite: 'bookshelf', w: 2, h: 1, block: true },
      { x: 12, y: 2, sprite: 'bookshelf', w: 2, h: 1, block: true },
      { x: 6, y: 4, sprite: 'desk', w: 3, h: 1, block: true },
      { x: 2, y: 6, sprite: 'desk', w: 2, h: 1, block: true },
      { x: 11, y: 6, sprite: 'globe', w: 1, h: 1, block: true },
      { x: 7, y: 4, sprite: 'candle', w: 1, h: 1, light: { r: 44, color: '#ffd080', flicker: 0.12 } },
      { x: 5, y: 7, sprite: 'rug', w: 5, h: 2 },
    ],
    npcs: [{ id: 'mira', x: 7, y: 3, roam: 20, facing: 0 }],
  },
  grocer: {
    w: 12, h: 9, floor: Tile.WOOD, darkness: 0.2,
    furniture: [
      { x: 1, y: 2, sprite: 'shelf_food', w: 2, h: 1, block: true },
      { x: 3, y: 2, sprite: 'shelf_food', w: 2, h: 1, block: true },
      { x: 8, y: 2, sprite: 'shelf_food', w: 2, h: 1, block: true },
      { x: 10, y: 5, sprite: 'barrel', w: 1, h: 1, block: true },
      { x: 1, y: 6, sprite: 'sacks', w: 1, h: 1, block: true },
      { x: 1, y: 5, sprite: 'crate', w: 1, h: 1, block: true },
      { x: 6, y: 2, sprite: 'candle', w: 1, h: 1, light: { r: 40, color: '#ffd080', flicker: 0.1 } },
    ],
    npcs: [{ id: 'marta', x: 6, y: 3, roam: 10, facing: 0 }],
    counter: { x: 4, y: 4, w: 4, shop: 'grocer', npc: 'marta' },
  },
  church: {
    w: 17, h: 13, floor: Tile.STONE, darkness: 0.3,
    furniture: [
      { x: 7, y: 2, sprite: 'altar', w: 3, h: 1, block: true, light: { r: 70, color: '#fff0c0', flicker: 0.05 } },
      { x: 5, y: 2, sprite: 'candle_stand', w: 1, h: 1, block: true, light: { r: 40, color: '#ffd080', flicker: 0.1 } },
      { x: 11, y: 2, sprite: 'candle_stand', w: 1, h: 1, block: true, light: { r: 40, color: '#ffd080', flicker: 0.1 } },
      { x: 5, y: 5, sprite: 'pew', w: 3, h: 1, block: true },
      { x: 9, y: 5, sprite: 'pew', w: 3, h: 1, block: true },
      { x: 5, y: 7, sprite: 'pew', w: 3, h: 1, block: true },
      { x: 9, y: 7, sprite: 'pew', w: 3, h: 1, block: true },
      { x: 1, y: 3, sprite: 'cot', w: 1, h: 2, block: true },
      { x: 1, y: 6, sprite: 'cot', w: 1, h: 2, block: true },
      { x: 15, y: 3, sprite: 'cot', w: 1, h: 2, block: true },
      { x: 8, y: 9, sprite: 'rug_long', w: 1, h: 3 },
    ],
    npcs: [{ id: 'agatha', x: 3, y: 5, roam: 16, facing: 2 }],
  },
};

export const interiorIds = Object.keys(INTERIORS);

/** Где появляется герой, войдя внутрь. */
export function interiorEntry(id: string): SpawnSpec {
  const s = INTERIORS[id]!;
  return { x: Math.floor(s.w / 2) * TILE, y: (s.h - 2) * TILE + 6, facing: 3 };
}

/** Точка у кровати в усадьбе (просыпание). */
export function bedSpawn(): SpawnSpec {
  const b = INTERIORS.manor!.bed!;
  return { x: (b.x + 2) * TILE + 8, y: (b.y + 1) * TILE + 10, facing: 0 };
}

export function infirmarySpawn(): SpawnSpec {
  return { x: 2 * TILE + 12, y: 5 * TILE + 8, facing: 2 };
}

export function buildInterior(game: GameApi, id: string): World {
  const s = INTERIORS[id];
  if (!s) throw new Error(`Unknown interior ${id}`);
  const map = new TileMap(s.w, s.h, Tile.VOID);
  map.fillRect(1, 1, s.w - 2, s.h - 2, s.floor);
  map.fillRect(1, 0, s.w - 2, 2, Tile.IWALL); // задняя стена (2 ряда: верх + лицевая)
  for (let y = 0; y < s.h; y++) {
    map.set(0, y, Tile.IWALL);
    map.set(s.w - 1, y, Tile.IWALL);
  }
  map.fillRect(0, s.h - 1, s.w, 1, Tile.IWALL);
  const dx = Math.floor(s.w / 2) - 1;
  map.fillRect(dx, s.h - 1, 2, 1, s.floor); // проём двери
  const w = new World(game, 'interior', map, hashSeed(game.state.seed, id), `interior:${id}`);
  w.darkness = s.darkness;

  for (const f of s.furniture) {
    const fw = f.w ?? 1, fh = f.h ?? 1;
    const p = new Prop((f.x + fw / 2) * TILE, (f.y + fh) * TILE, `furn:${f.sprite}:${fw}x${fh}`, { hw: (fw * TILE) / 2, hh: 3, layer: f.block ? 1 : 0 });
    if (f.block) p.blockRect(f.x, f.y, fw, fh);
    if (f.light) p.light = { ...f.light, power: 0.9 };
    w.addNow(p);
  }
  if (s.bed) {
    w.addNow(new Spot((s.bed.x + 1) * TILE, (s.bed.y + 2) * TILE, { label: () => tr('sleep'), range: 12, act: (ww) => ww.game.sleep() }, '', 14, 8));
  }
  if (s.counter) {
    const c = s.counter;
    const p = new Prop((c.x + c.w / 2) * TILE, (c.y + 1) * TILE, `furn:counter:${c.w}x1`, { hw: (c.w * TILE) / 2, hh: 3 });
    p.blockRect(c.x, c.y, c.w, 1);
    p.interaction = { label: () => tr('trade'), range: 10, act: (ww) => ww.game.talk(c.npc) };
    w.addNow(p);
  }
  for (const n of s.npcs) w.addNow(new Npc(n.id, n.x * TILE + 8, n.y * TILE + 10, n.roam ?? 0, n.facing ?? 0));
  const exitSpawn = doorSpawn(id === 'church' ? 'church' : id);
  w.addNow(door(dx * TILE, (s.h - 1) * TILE + 4, 2 * TILE, 14, { kind: 'town' }, exitSpawn));
  return w;
}

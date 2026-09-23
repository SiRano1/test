import { TILE } from '../../core/math';
import { hashSeed } from '../../core/rng';
import { Tile, TileMap } from '../../core/tilemap';
import type { Station } from '../../data/recipes';
import { tr } from '../../data/strings';
import { door, Prop, Spot } from '../entities/props';
import type { GameState } from '../state';
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
  station?: Station;
  storage?: boolean;
}

interface InteriorSpec {
  w: number;
  h: number;
  floor: number;
  furniture: Furniture[];
  bed?: { x: number; y: number };
  counter?: { x: number; y: number; w: number; shop: string; npc: string };
  darkness: number;
}

const candle = (x: number, y: number): Furniture => ({ x, y, sprite: 'candle_stand', block: true, light: { r: 40, color: '#ffd080', flicker: 0.1 } });

const INTERIORS: Record<string, InteriorSpec> = {
  manor: {
    w: 16, h: 11, floor: Tile.WOOD, darkness: 0.35,
    furniture: [
      { x: 2, y: 3, sprite: 'bed', w: 2, h: 2, block: true },
      { x: 5, y: 2, sprite: 'fireplace', w: 2, h: 1, block: true, light: { r: 60, color: '#ff9a40', flicker: 0.15 } },
      { x: 9, y: 2, sprite: 'window', w: 1, h: 1 },
      candle(4, 2),
      { x: 6, y: 5, sprite: 'chest_home', w: 1, h: 1, block: true, storage: true },
    ],
    bed: { x: 2, y: 3 },
  },
  smithy: {
    w: 13, h: 10, floor: Tile.STONE, darkness: 0.25,
    furniture: [
      { x: 1, y: 2, sprite: 'forge', w: 2, h: 2, block: true, light: { r: 70, color: '#ff7030', flicker: 0.2 } },
      { x: 4, y: 3, sprite: 'anvil', block: true },
      { x: 8, y: 2, sprite: 'weapon_rack', w: 2, block: true },
      { x: 10, y: 2, sprite: 'armor_stand', block: true },
      { x: 11, y: 6, sprite: 'barrel', block: true },
      { x: 1, y: 7, sprite: 'crate', block: true },
    ],
    counter: { x: 4, y: 5, w: 5, shop: 'smith', npc: 'hilda' },
  },
  archive: {
    w: 15, h: 10, floor: Tile.WOOD, darkness: 0.3,
    furniture: [
      { x: 1, y: 2, sprite: 'bookshelf', w: 2, block: true }, { x: 3, y: 2, sprite: 'bookshelf', w: 2, block: true },
      { x: 10, y: 2, sprite: 'bookshelf', w: 2, block: true }, { x: 12, y: 2, sprite: 'bookshelf', w: 2, block: true },
      { x: 6, y: 4, sprite: 'desk', w: 3, block: true }, { x: 2, y: 6, sprite: 'desk', w: 2, block: true },
      { x: 11, y: 6, sprite: 'globe', block: true },
      { x: 7, y: 4, sprite: 'candle', light: { r: 44, color: '#ffd080', flicker: 0.12 } },
      { x: 5, y: 7, sprite: 'rug', w: 5, h: 2 },
    ],
  },
  grocer: {
    w: 12, h: 9, floor: Tile.WOOD, darkness: 0.2,
    furniture: [
      { x: 1, y: 2, sprite: 'shelf_food', w: 2, block: true }, { x: 3, y: 2, sprite: 'shelf_food', w: 2, block: true },
      { x: 8, y: 2, sprite: 'shelf_food', w: 2, block: true }, { x: 10, y: 5, sprite: 'barrel', block: true },
      { x: 1, y: 6, sprite: 'sacks', block: true }, { x: 1, y: 5, sprite: 'crate', block: true },
      { x: 6, y: 2, sprite: 'candle', light: { r: 40, color: '#ffd080', flicker: 0.1 } },
    ],
    counter: { x: 4, y: 4, w: 4, shop: 'grocer', npc: 'marta' },
  },
  church: {
    w: 17, h: 13, floor: Tile.STONE, darkness: 0.3,
    furniture: [
      { x: 7, y: 2, sprite: 'altar', w: 3, block: true, light: { r: 70, color: '#fff0c0', flicker: 0.05 } },
      candle(5, 2), candle(11, 2),
      { x: 5, y: 6, sprite: 'pew', w: 3, block: true }, { x: 9, y: 6, sprite: 'pew', w: 3, block: true },
      { x: 5, y: 8, sprite: 'pew', w: 3, block: true }, { x: 9, y: 8, sprite: 'pew', w: 3, block: true },
      { x: 1, y: 3, sprite: 'cot', h: 2, block: true }, { x: 1, y: 7, sprite: 'cot', h: 2, block: true }, { x: 15, y: 3, sprite: 'cot', h: 2, block: true },
      { x: 8, y: 9, sprite: 'rug_long', h: 3 },
    ],
  },
  alchemy: {
    w: 12, h: 9, floor: Tile.STONE, darkness: 0.3,
    furniture: [
      { x: 1, y: 2, sprite: 'potion_shelf', w: 2, block: true }, { x: 8, y: 2, sprite: 'potion_shelf', w: 2, block: true },
      { x: 10, y: 5, sprite: 'cauldron', block: true, light: { r: 36, color: '#80ff90', flicker: 0.2 } },
      { x: 1, y: 6, sprite: 'sacks', block: true }, { x: 5, y: 2, sprite: 'candle', light: { r: 40, color: '#ffd080', flicker: 0.1 } },
    ],
    counter: { x: 3, y: 4, w: 5, shop: 'alchemist', npc: 'osbert' },
  },
  tavern: {
    w: 18, h: 12, floor: Tile.WOOD, darkness: 0.25,
    furniture: [
      { x: 1, y: 2, sprite: 'shelf_food', w: 2, block: true }, { x: 5, y: 2, sprite: 'barrel', block: true }, { x: 6, y: 2, sprite: 'barrel', block: true },
      { x: 10, y: 2, sprite: 'fireplace', w: 2, block: true, light: { r: 70, color: '#ff9a40', flicker: 0.15 } },
      { x: 14, y: 2, sprite: 'stage', w: 3, block: false },
      { x: 8, y: 5, sprite: 'table', w: 2, block: true }, { x: 12, y: 5, sprite: 'table', w: 2, block: true },
      { x: 8, y: 8, sprite: 'table', w: 2, block: true }, { x: 12, y: 8, sprite: 'table', w: 2, block: true },
      { x: 3, y: 7, sprite: 'table', w: 2, block: true },
      candle(1, 9), candle(16, 9),
    ],
    counter: { x: 2, y: 4, w: 5, shop: 'tavern', npc: 'tilda' },
  },
  barracks: {
    w: 14, h: 10, floor: Tile.STONE, darkness: 0.3,
    furniture: [
      { x: 1, y: 2, sprite: 'cot', h: 2, block: true }, { x: 1, y: 5, sprite: 'cot', h: 2, block: true },
      { x: 12, y: 2, sprite: 'cot', h: 2, block: true }, { x: 12, y: 5, sprite: 'cot', h: 2, block: true },
      { x: 4, y: 2, sprite: 'weapon_rack', w: 2, block: true }, { x: 8, y: 2, sprite: 'armor_stand', block: true }, { x: 9, y: 2, sprite: 'armor_stand', block: true },
      { x: 6, y: 5, sprite: 'map_table', w: 3, block: true, light: { r: 40, color: '#ffd080', flicker: 0.1 } },
    ],
  },
  tower: {
    w: 11, h: 11, floor: Tile.STONE, darkness: 0.4,
    furniture: [
      { x: 1, y: 2, sprite: 'bookshelf', w: 2, block: true }, { x: 8, y: 2, sprite: 'bookshelf', w: 2, block: true },
      { x: 4, y: 3, sprite: 'magic_circle', w: 3, h: 3, light: { r: 60, color: '#b090ff', flicker: 0.1 } },
      { x: 1, y: 6, sprite: 'globe', block: true }, { x: 9, y: 6, sprite: 'crystal', block: true, light: { r: 36, color: '#80c0ff', flicker: 0.2 } },
    ],
    counter: { x: 3, y: 7, w: 5, shop: 'enchanter', npc: 'albin' },
  },
  trading: {
    w: 16, h: 11, floor: Tile.STONE, darkness: 0.25,
    furniture: [
      { x: 1, y: 2, sprite: 'bookshelf', w: 2, block: true }, { x: 13, y: 2, sprite: 'bookshelf', w: 2, block: true },
      { x: 9, y: 2, sprite: 'window', w: 1 }, { x: 11, y: 2, sprite: 'window', w: 1 },
      { x: 9, y: 6, sprite: 'desk', w: 3, block: true }, { x: 13, y: 7, sprite: 'globe', block: true },
      { x: 1, y: 7, sprite: 'crate', block: true }, { x: 2, y: 7, sprite: 'crate', block: true }, { x: 1, y: 8, sprite: 'barrel', block: true },
      { x: 6, y: 8, sprite: 'rug', w: 4, h: 2 },
      candle(8, 2), candle(12, 5),
    ],
    counter: { x: 3, y: 4, w: 4, shop: 'auction', npc: 'livia' },
  },
  fence: {
    w: 10, h: 8, floor: Tile.WOOD, darkness: 0.45,
    furniture: [
      { x: 1, y: 2, sprite: 'crate', block: true }, { x: 2, y: 2, sprite: 'crate', block: true }, { x: 8, y: 2, sprite: 'barrel', block: true },
      { x: 1, y: 5, sprite: 'sacks', block: true }, { x: 8, y: 5, sprite: 'crate', block: true },
      { x: 5, y: 2, sprite: 'candle', light: { r: 36, color: '#ffc070', flicker: 0.15 } },
    ],
    counter: { x: 3, y: 4, w: 4, shop: 'fence', npc: 'lis' },
  },
};

/** Мебель усадьбы в зависимости от улучшений. */
function manorFurniture(s: GameState): Furniture[] {
  const up = new Set(s.manor.upgrades);
  const f: Furniture[] = [];
  if (up.has('hall')) {
    f.push(
      { x: 12, y: 2, sprite: 'stove', w: 2, block: true, station: 'kitchen', light: { r: 40, color: '#ff9040', flicker: 0.15 } },
      { x: 10, y: 5, sprite: 'table', w: 2, block: true },
      { x: 3, y: 7, sprite: 'rug', w: 3, h: 2 },
      { x: 8, y: 2, sprite: 'bookshelf', block: true },
    );
  } else {
    f.push(
      { x: 10, y: 5, sprite: 'table', w: 2, block: true },
      { x: 12, y: 2, sprite: 'shelf_broken', w: 2, block: true },
      { x: 3, y: 7, sprite: 'rug', w: 3, h: 2 },
      { x: 13, y: 8, sprite: 'crate', block: true },
      { x: 14, y: 8, sprite: 'cobweb' }, { x: 1, y: 9, sprite: 'cobweb' },
    );
  }
  if (up.has('forge')) {
    f.push(
      { x: 13, y: 6, sprite: 'furnace', w: 2, block: true, station: 'furnace', light: { r: 50, color: '#ff7030', flicker: 0.2 } },
      { x: 11, y: 8, sprite: 'anvil', block: true, station: 'anvil' },
    );
  }
  if (up.has('lab')) f.push({ x: 1, y: 6, sprite: 'alchemy_table', w: 2, block: true, station: 'alchemy', light: { r: 34, color: '#80ff90', flicker: 0.2 } });
  return f;
}

export const interiorIds = Object.keys(INTERIORS);

export function interiorSize(id: string): { w: number; h: number } {
  const s = INTERIORS[id]!;
  return { w: s.w, h: s.h };
}

/** Где появляется герой, войдя внутрь. */
export function interiorEntry(id: string): SpawnSpec {
  const s = INTERIORS[id]!;
  return { x: Math.floor(s.w / 2) * TILE, y: (s.h - 2) * TILE + 6, facing: 3 };
}

/** Тайл двери интерьера (для NPC, уходящих наружу). */
export function interiorDoorTile(id: string): [number, number] {
  const s = INTERIORS[id]!;
  return [Math.floor(s.w / 2) - 1, s.h - 2];
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
  map.fillRect(1, 0, s.w - 2, 2, Tile.IWALL);
  for (let y = 0; y < s.h; y++) {
    map.set(0, y, Tile.IWALL);
    map.set(s.w - 1, y, Tile.IWALL);
  }
  map.fillRect(0, s.h - 1, s.w, 1, Tile.IWALL);
  const dx = Math.floor(s.w / 2) - 1;
  map.fillRect(dx, s.h - 1, 2, 1, s.floor);
  const w = new World(game, 'interior', map, hashSeed(game.state.seed, id), `interior:${id}`);
  w.darkness = s.darkness;
  w.meta.interior = id;

  const furniture = id === 'manor' ? [...s.furniture, ...manorFurniture(game.state)] : s.furniture;
  for (const f of furniture) {
    const fw = f.w ?? 1, fh = f.h ?? 1;
    const p = new Prop((f.x + fw / 2) * TILE, (f.y + fh) * TILE, `furn:${f.sprite}:${fw}x${fh}`, { hw: (fw * TILE) / 2, hh: 3, layer: f.block ? 1 : 0 });
    if (f.block) p.blockRect(f.x, f.y, fw, fh);
    if (f.light) p.light = { ...f.light, power: 0.9 };
    if (f.station) {
      const st = f.station;
      p.interaction = { label: () => tr('craft'), range: 10, act: (ww) => ww.game.openCrafting(st) };
    }
    if (f.storage) p.interaction = { label: () => tr('storage'), range: 10, act: (ww) => ww.game.openStorage() };
    w.addNow(p);
  }
  if (s.bed) {
    w.addNow(new Spot((s.bed.x + 1) * TILE, (s.bed.y + 2) * TILE, { label: () => tr('sleep'), range: 12, act: (ww) => ww.game.sleep() }, '', 14, 8));
  }
  if (s.counter) {
    const c = s.counter;
    const p = new Prop((c.x + c.w / 2) * TILE, (c.y + 1) * TILE, `furn:counter:${c.w}x1`, { hw: (c.w * TILE) / 2, hh: 3 });
    p.blockRect(c.x, c.y, c.w, 1);
    p.interaction = { label: () => tr('trade'), range: 10, act: (ww) => ww.game.counter(c.npc) };
    w.addNow(p);
  }
  w.addNow(door(dx * TILE, (s.h - 1) * TILE + 4, 2 * TILE, 14, { kind: 'town' }, doorSpawn(id)));
  return w;
}

import { TILE } from '../../core/math';
import { hashSeed, Rng } from '../../core/rng';
import { Tile, TileMap } from '../../core/tilemap';
import { L, t, type Loc } from '../../data/loc';
import { tr } from '../../data/strings';
import { GARDEN_PLOTS } from '../../data/manor';
import { door, GardenPlot, Prop, Trigger } from '../entities/props';
import type { SceneRef } from '../state';
import { World, type GameApi, type SpawnSpec } from '../world';

export interface BuildingSpec {
  id: string;
  name: Loc;
  /** Основание (тайлы). */
  x: number;
  y: number;
  w: number;
  h: number;
  style: 'timber' | 'stone' | 'church' | 'tower' | 'manor' | 'crypt' | 'shop';
  wall: string;
  roof: string;
  /** Смещение двери от левого края (тайлы). */
  door: number;
  interior?: string;
  /** Высота крыши над основанием (тайлы). */
  roofH: number;
  sign?: string;
}

export const TOWN_W = 64;
export const TOWN_H = 46;

export const BUILDINGS: BuildingSpec[] = [
  { id: 'crypt', name: L('Склеп Основателей', "Founders' Crypt"), x: 9, y: 6, w: 6, h: 4, style: 'crypt', wall: '#7a7470', roof: '#4a4450', door: 2, roofH: 2 },
  { id: 'church', name: L('Храм Неугасимого Света', 'Temple of the Undying Light'), x: 26, y: 5, w: 11, h: 7, style: 'church', wall: '#d8cfc0', roof: '#5a4a6a', door: 5, interior: 'church', roofH: 4 },
  { id: 'manor', name: L('Усадьба Эшгроув', 'Ashgrove Manor'), x: 47, y: 5, w: 11, h: 6, style: 'manor', wall: '#8a7a68', roof: '#4a3a3a', door: 5, interior: 'manor', roofH: 3 },
  { id: 'smithy', name: L('Кузница Хильды', "Hilda's Smithy"), x: 5, y: 19, w: 8, h: 5, style: 'stone', wall: '#8a8078', roof: '#6a3a2a', door: 3, interior: 'smithy', roofH: 3, sign: 'anvil' },
  { id: 'archive', name: L('Городской архив', 'Town Archive'), x: 44, y: 18, w: 8, h: 5, style: 'timber', wall: '#e0d4b8', roof: '#3a5a7a', door: 3, interior: 'archive', roofH: 3, sign: 'book' },
  { id: 'alchemy', name: L('Алхимия Осберта', "Osbert's Alchemy"), x: 14, y: 19, w: 6, h: 5, style: 'timber', wall: '#d8d0b0', roof: '#3a6a4a', door: 2, interior: 'alchemy', roofH: 3, sign: 'potion' },
  { id: 'tavern', name: L('Таверна «Кривой Фонарь»', 'The Crooked Lantern'), x: 12, y: 29, w: 9, h: 5, style: 'timber', wall: '#d8c8a0', roof: '#7a3a2a', door: 4, interior: 'tavern', roofH: 3, sign: 'mug' },
  { id: 'trading', name: L('Торговый дом Кроу', 'House of Crowe'), x: 36, y: 29, w: 9, h: 5, style: 'stone', wall: '#b8a890', roof: '#2a2a3a', door: 4, roofH: 3, sign: 'coin' },
  { id: 'barracks', name: L('Казармы Стражи', 'Watch Barracks'), x: 48, y: 29, w: 10, h: 5, style: 'stone', wall: '#8a8a90', roof: '#6a2a2a', door: 5, interior: 'barracks', roofH: 3, sign: 'shield' },
  { id: 'tower', name: L('Башня Серого Круга', 'Tower of the Grey Circle'), x: 56, y: 18, w: 5, h: 5, style: 'tower', wall: '#6a6a80', roof: '#3a2a5a', door: 2, interior: 'tower', roofH: 5 },
  { id: 'fence', name: L('Лавка Лис', "Lis's Den"), x: 3, y: 29, w: 6, h: 5, style: 'timber', wall: '#a89878', roof: '#4a3a3a', door: 2, interior: 'fence', roofH: 3, sign: 'coin' },
  { id: 'house1', name: L('Дом Холтов', 'The Holt House'), x: 38, y: 6, w: 7, h: 5, style: 'timber', wall: '#e0d0b8', roof: '#5a4a6a', door: 3, roofH: 3 },
  { id: 'cottage', name: L('Домик вдовы Ханны', "Widow Hanna's Cottage"), x: 58, y: 29, w: 4, h: 5, style: 'timber', wall: '#d8c8a8', roof: '#6a5a2a', door: 1, roofH: 3 },
  { id: 'hut', name: L('Сторожка Йорна', "Yorn's Lodge"), x: 15, y: 5, w: 4, h: 4, style: 'timber', wall: '#9a8a70', roof: '#4a4038', door: 1, roofH: 2 },
  { id: 'grocer', name: L('Лавка Марты', "Marta's Provisions"), x: 22, y: 29, w: 7, h: 5, style: 'shop', wall: '#e0c8a0', roof: '#8a6a3a', door: 3, interior: 'grocer', roofH: 3, sign: 'bread' },
];

export const buildingById = (id: string) => BUILDINGS.find((b) => b.id === id)!;

/** Точка появления у двери здания (на улице). */
export function doorSpawn(id: string): SpawnSpec {
  const b = buildingById(id);
  return { x: (b.x + b.door) * TILE + 8, y: (b.y + b.h) * TILE + 10, facing: 0 };
}

export function buildTownMap(): TileMap {
  const m = new TileMap(TOWN_W, TOWN_H, Tile.GRASS);
  const rng = new Rng(hashSeed('valmark-flowers'));
  // цветы
  for (let i = 0; i < 160; i++) m.set(rng.int(2, TOWN_W - 3), rng.int(2, TOWN_H - 3), Tile.FLOWERS);
  // кладбище
  m.fillRect(4, 4, 16, 12, Tile.GRAVE_DIRT);
  for (let x = 3; x <= 20; x++) {
    m.set(x, 3, Tile.FENCE);
    if (x < 10 || x > 13) m.set(x, 16, Tile.FENCE);
  }
  for (let y = 3; y <= 16; y++) {
    m.set(3, y, Tile.FENCE);
    m.set(20, y, Tile.FENCE);
  }
  // река
  m.fillRect(0, 37, TOWN_W, 4, Tile.WATER);
  m.fillRect(0, 38, TOWN_W, 2, Tile.DEEPWATER);
  m.fillRect(0, 36, TOWN_W, 1, Tile.SAND);
  m.fillRect(0, 41, TOWN_W, 1, Tile.SAND);
  m.fillRect(30, 36, 3, 6, Tile.BRIDGE);
  // южный берег: поля Ханны
  m.fillRect(6, 43, 16, 3, Tile.FARMLAND);
  // дороги
  m.fillRect(30, 12, 3, 24, Tile.PATH); // главная С–Ю
  m.fillRect(30, 42, 3, 4, Tile.PATH);
  m.fillRect(3, 26, 58, 2, Tile.PATH); // Восток–Запад
  m.fillRect(3, 34, 58, 2, Tile.PATH); // набережная
  m.fillRect(24, 15, 15, 10, Tile.PLAZA); // площадь
  // тропинки к дверям
  const lane = (x: number, y0: number, y1: number, w = 2) => m.fillRect(x, Math.min(y0, y1), w, Math.abs(y1 - y0) + 1, Tile.PATH);
  lane(10, 16, 25); // кладбищенские ворота → дорога
  lane(11, 10, 15, 2); // склеп → ворота
  lane(8, 24, 25); // кузница
  lane(16, 24, 25); // алхимия
  lane(47, 23, 25); // архив
  lane(58, 23, 25); // башня
  m.fillRect(51, 11, 3, 1, Tile.DIRT); // двор усадьбы
  m.fillRect(46, 11, 13, 2, Tile.DIRT);
  lane(52, 13, 25); // усадьба → дорога
  m.fillRect(33, 12, 19, 2, Tile.PATH); // храм ↔ усадьба
  lane(41, 11, 12, 1); // дом Холтов
  lane(16, 9, 10, 1); // сторожка Йорна
  // заросший двор усадьбы
  for (let i = 0; i < 18; i++) m.set(rng.int(45, 59), rng.int(3, 12), Tile.DIRT);
  return m;
}

/** Собрать мир города со всеми объектами. */
export function buildTown(game: GameApi): World {
  const map = buildTownMap();
  const w = new World(game, 'town', map, hashSeed(game.state.seed, 'town', game.state.time.totalDays), 'town');
  const rng = new Rng(hashSeed('valmark-props'));

  // здания
  for (const b of BUILDINGS) {
    const base = new Prop((b.x + b.w / 2) * TILE, (b.y + b.h) * TILE, `building:${b.id}`, { hw: (b.w * TILE) / 2, hh: 4 });
    base.blockRect(b.x, b.y, b.w, b.h);
    // дверной проём не блокируем
    base.blocks = base.blocks.filter(([tx, ty]) => !(tx === b.x + b.door && ty === b.y + b.h - 1));
    w.addNow(base);
    const dx = (b.x + b.door) * TILE, dy = (b.y + b.h - 1) * TILE;
    if (b.id === 'crypt') {
      w.addNow(new Trigger(dx + 2, dy + 2, 12, 12, (ww) => ww.game.openElevator()));
    } else if (b.interior) {
      w.addNow(door(dx + 2, dy + 2, 12, 12, { kind: 'interior', id: b.interior } as SceneRef));
    } else {
      const name = b.name;
      w.addNow(new Trigger(dx + 2, dy + 2, 12, 12, (ww) => ww.game.toast(`${t(name)} — ${tr('closed')}`)));
    }
    // фонари у дверей
    if (b.style !== 'crypt') {
      const lamp = new Prop((b.x + b.door) * TILE + (b.door > 1 ? -6 : 22), (b.y + b.h) * TILE + 2, 'lamp_wall', { layer: 1, hw: 2, hh: 2 });
      lamp.light = { r: 40, color: '#ffc070', power: 0.9, flicker: 0.1 };
      (lamp as any).nightOnly = true;
      w.addNow(lamp);
    }
  }

  // сад усадьбы
  if (game.state.manor.upgrades.includes('garden')) {
    GARDEN_PLOTS.forEach(([gx, gy], i) => {
      map.set(gx, gy, Tile.FARMLAND);
      w.addNow(new GardenPlot(gx * TILE + 8, gy * TILE + 8, i));
    });
  }

  // колодец на площади
  const well = new Prop(31 * TILE + 8, 20 * TILE + 12, 'well', { block: true, hw: 10, hh: 6 });
  well.blockRect(30, 19, 3, 2);
  w.addNow(well);
  // рыночные прилавки
  for (const [sx, sy, c] of [[25, 17, '#a83a3a'], [36, 17, '#3a6aa8'], [25, 22, '#3a8a4a'], [36, 22, '#c8a040']] as const) {
    const st = new Prop(sx * TILE + 16, sy * TILE + 14, `stall:${c}`, { hw: 14, hh: 6 });
    st.blockRect(sx, sy, 2, 1);
    w.addNow(st);
  }
  // уличные фонари вдоль дорог
  for (const [lx, ly] of [[29, 14], [33, 14], [29, 25], [33, 25], [20, 25], [42, 25], [8, 28], [55, 28], [29, 33], [33, 33], [20, 33], [44, 33]] as const) {
    const lp = new Prop(lx * TILE + 8, ly * TILE + 14, 'lamppost', { block: true, hw: 2, hh: 2 });
    lp.light = { r: 46, color: '#ffc870', power: 0.9, flicker: 0.06 };
    (lp as any).nightOnly = true;
    w.addNow(lp);
  }
  // надгробия
  for (let gy = 11; gy <= 14; gy += 3)
    for (let gx = 5; gx <= 18; gx += 2) {
      if (gx >= 10 && gx <= 13) continue;
      if (rng.chance(0.2)) continue;
      w.addNow(new Prop(gx * TILE + 8, gy * TILE + 14, `grave${rng.int(0, 2)}`, { block: true, hw: 5, hh: 3 }));
    }
  for (const [gx, gy] of [[5, 5], [7, 5], [5, 8], [17, 10]] as const)
    w.addNow(new Prop(gx * TILE + 8, gy * TILE + 14, `grave${rng.int(0, 2)}`, { block: true, hw: 5, hh: 3 }));

  // деревья по краям и в сквере
  const occupied = (tx: number, ty: number) =>
    map.solid(tx, ty) || [Tile.PATH, Tile.PLAZA, Tile.BRIDGE, Tile.DIRT, Tile.GRAVE_DIRT, Tile.FARMLAND, Tile.SAND].includes(map.get(tx, ty) as never) ||
    BUILDINGS.some((b) => tx >= b.x - 1 && tx <= b.x + b.w && ty >= b.y - b.roofH && ty <= b.y + b.h + 1);
  const placeTree = (tx: number, ty: number) => {
    if (occupied(tx, ty) || occupied(tx, ty - 1)) return;
    const kind = rng.chance(0.35) ? 'pine' : 'oak';
    const tr2 = new Prop(tx * TILE + 8, ty * TILE + 14, `tree:${kind}:${rng.int(0, 2)}`, { block: true, hw: 5, hh: 3 });
    w.addNow(tr2);
  };
  for (let x = 0; x < TOWN_W; x += 2) {
    placeTree(x, 1 + (x % 4 === 0 ? 0 : 1));
    if (x < 30 || x > 33) placeTree(x, TOWN_H - 1);
  }
  for (let y = 3; y < TOWN_H - 2; y += 2) {
    placeTree(1, y);
    placeTree(TOWN_W - 2, y);
  }
  for (let i = 0; i < 70; i++) placeTree(rng.int(2, TOWN_W - 3), rng.int(2, TOWN_H - 3));
  // кусты и бочки
  for (let i = 0; i < 30; i++) {
    const tx = rng.int(2, TOWN_W - 3), ty = rng.int(2, TOWN_H - 3);
    if (occupied(tx, ty)) continue;
    w.addNow(new Prop(tx * TILE + 8, ty * TILE + 13, 'bush', { block: true, hw: 5, hh: 3 }));
  }
  for (const [bx, by] of [[13, 24], [4, 24], [21, 34], [44, 34], [59, 34]] as const)
    w.addNow(new Prop(bx * TILE + 8, by * TILE + 13, 'barrel', { block: true, hw: 5, hh: 3 }));

  return w;
}

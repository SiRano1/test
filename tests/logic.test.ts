import { describe, expect, it } from 'vitest';
import { bfsDistances } from '../src/core/pathfind';
import { hashSeed, Rng } from '../src/core/rng';
import { Tile, TileMap } from '../src/core/tilemap';
import { ITEMS, itemDef } from '../src/data/items';
import { setLang } from '../src/data/loc';
import { generateBossFloor, generateFloor } from '../src/game/dungeon/generator';
import { addToContainer, countItem, removeItem, sortContainer } from '../src/game/systems/inventory';
import { itemName, makeItem, rollChest, rollRarity } from '../src/game/systems/loot';
import { computeStats, classLevel } from '../src/game/systems/stats';
import { newGameState } from '../src/game/state';
import { listSaves, loadGame, MemoryKV, saveGame } from '../src/game/systems/save';
import { advanceDay } from '../src/game/systems/calendar';
import { buyPrice, dailyEconomy, recordSale, sellPrice } from '../src/game/systems/economy';
import { SHOPS } from '../src/data/shops';

describe('Rng', () => {
  it('детерминирован', () => {
    const a = new Rng(42), b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
  it('int в границах', () => {
    const r = new Rng(1);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
    }
  });
});

describe('TileMap', () => {
  it('тело не проходит сквозь стену', () => {
    const m = new TileMap(10, 10, Tile.FLOOR);
    m.fillRect(5, 0, 1, 10, Tile.WALL);
    const b = { x: 40, y: 40, hw: 5, hh: 3 };
    for (let i = 0; i < 60; i++) m.move(b, 3, 0);
    expect(b.x + b.hw).toBeLessThanOrEqual(80);
  });
  it('скольжение вдоль стены', () => {
    const m = new TileMap(10, 10, Tile.FLOOR);
    m.fillRect(5, 0, 1, 10, Tile.WALL);
    const b = { x: 70, y: 40, hw: 5, hh: 3 };
    m.move(b, 10, 10);
    expect(b.y).toBeCloseTo(50);
  });
});

describe('Генератор подземелья', () => {
  it('выход достижим со старта на 200 этажах', () => {
    for (let f = 1; f <= 200; f++) {
      if (f % 10 === 0) continue;
      const L = generateFloor(hashSeed('test', f), f);
      const d = bfsDistances(L.map, L.start[0], L.start[1]);
      expect(d[L.exit[1] * L.map.w + L.exit[0]], `этаж ${f}`).toBeGreaterThan(0);
      expect(L.rooms.length).toBeGreaterThanOrEqual(5);
    }
  });
  it('детерминирован по seed', () => {
    const a = generateFloor(123, 3), b = generateFloor(123, 3);
    expect(Array.from(a.map.tiles)).toEqual(Array.from(b.map.tiles));
  });
  it('тайник закрыт треснувшей стеной', () => {
    let found = 0;
    for (let s = 0; s < 60; s++) {
      const L = generateFloor(s, 5);
      for (const [x, y] of L.cracked) {
        expect(L.map.get(x, y)).toBe(Tile.CRACKED);
        found++;
      }
    }
    expect(found).toBeGreaterThan(10);
  });
  it('этаж босса связан', () => {
    const L = generateBossFloor();
    const d = bfsDistances(L.map, L.start[0], L.start[1]);
    expect(d[L.exit[1] * L.map.w + L.exit[0]]).toBeGreaterThan(0);
  });
});

describe('Инвентарь', () => {
  it('складывает стаки и уважает лимит', () => {
    const inv = new Array(3).fill(null);
    const rng = new Rng(1);
    addToContainer(inv, makeItem(rng, 'bone', 0, 150));
    expect(countItem(inv, 'bone')).toBe(150);
    expect(inv.filter(Boolean).length).toBe(2);
    const rest = makeItem(rng, 'bone', 0, 200);
    addToContainer(inv, rest);
    expect(countItem(inv, 'bone')).toBe(99 * 3);
    expect(rest.qty).toBe(150 + 200 - 297);
  });
  it('remove и sort', () => {
    const inv = new Array(6).fill(null);
    const rng = new Rng(2);
    addToContainer(inv, makeItem(rng, 'copper_ore', 0, 10));
    addToContainer(inv, makeItem(rng, 'copper_sword', 1));
    expect(removeItem(inv, 'copper_ore', 4)).toBe(true);
    expect(countItem(inv, 'copper_ore')).toBe(6);
    sortContainer(inv);
    expect(inv[0]!.def).toBe('copper_sword');
  });
});

describe('Лут', () => {
  it('имена согласуются по роду', () => {
    setLang('ru');
    const s = { uid: 'x', def: 'iron_spear', qty: 1, rarity: 1 as const, affixes: [{ id: 'sharp', value: 5 }, { id: 'bear', value: 10 }], upgrade: 0 };
    expect(itemName(s)).toBe('Острое железное копьё медведя');
    const b = { ...s, def: 'copper_feet', affixes: [{ id: 'swift', value: 0.1 }] };
    expect(itemName(b)).toBe('Быстрые медные сапоги');
  });
  it('редкость растёт с глубиной', () => {
    const rng = new Rng(7);
    const count = (floor: number) => {
      let n = 0;
      for (let i = 0; i < 4000; i++) if (rollRarity(rng, floor, 0) >= 2) n++;
      return n;
    };
    expect(count(60)).toBeGreaterThan(count(1));
  });
  it('сундуки содержат предметы', () => {
    const r = rollChest(new Rng(3), { floor: 5, tier: 1, luck: 0 }, 1);
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items[0]!.rarity).toBeGreaterThanOrEqual(1);
  });
  it('у всех предметов корректные данные', () => {
    for (const d of Object.values(ITEMS)) {
      expect(d.name.ru.length).toBeGreaterThan(0);
      expect(d.name.en.length).toBeGreaterThan(0);
      expect(d.stack).toBeGreaterThan(0);
    }
  });
});

describe('Характеристики и экономика', () => {
  it('экипировка добавляет защиту', () => {
    const s = newGameState('T', 1);
    const base = computeStats(s).def;
    s.equipment.body = makeItem(new Rng(1), 'iron_body');
    expect(computeStats(s).def).toBeGreaterThan(base);
  });
  it('уровень класса растёт', () => {
    expect(classLevel(0)).toBe(1);
    expect(classLevel(10000)).toBeGreaterThan(5);
  });
  it('спрос падает при продаже и восстанавливается', () => {
    const s = newGameState('T', 1);
    const st = makeItem(new Rng(1), 'copper_ore', 0, 1);
    const p0 = sellPrice(s, st, SHOPS.smith!);
    recordSale(s, 'copper_ore', 10);
    expect(sellPrice(s, st, SHOPS.smith!)).toBeLessThan(p0);
    for (let i = 0; i < 10; i++) dailyEconomy(s);
    expect(sellPrice(s, st, SHOPS.smith!)).toBe(p0);
    expect(buyPrice(s, 'copper_sword', SHOPS.smith!)).toBe(itemDef('copper_sword').price);
  });
});

describe('Календарь и сохранения', () => {
  it('сезоны сменяются через 28 дней', () => {
    const s = newGameState('T', 1);
    for (let i = 0; i < 28; i++) advanceDay(s);
    expect(s.time.season).toBe(1);
    expect(s.time.day).toBe(1);
  });
  it('сохранение и загрузка', () => {
    const kv = new MemoryKV();
    const s = newGameState('Эрин', 99);
    s.hero.gold = 777;
    saveGame(kv, 1, s);
    const l = loadGame(kv, 1)!;
    expect(l.hero.gold).toBe(777);
    expect(listSaves(kv)[1]!.name).toBe('Эрин');
    expect(listSaves(kv)[0]).toBeNull();
  });
});

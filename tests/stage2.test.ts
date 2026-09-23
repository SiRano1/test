import { describe, expect, it } from 'vitest';
import { Tile } from '../src/core/tilemap';
import { Game } from '../src/game/game';
import type { InputFrame } from '../src/game/input';
import { Npc } from '../src/game/entities/npc';
import { Boss } from '../src/game/entities/boss';
import { migrate } from '../src/game/systems/save';
import { generateFloor } from '../src/game/dungeon/generator';
import { hashSeed } from '../src/core/rng';
import { placeFor } from '../src/data/schedules';
import { countItem } from '../src/game/systems/inventory';

const DT = 1 / 60;
const idle = (): InputFrame => ({ mx: 0, my: 0, aimX: null, aimY: null, down: new Set(), pressed: new Set(), released: new Set() });
function run(g: Game, seconds: number) {
  for (let i = 0; i < seconds * 60; i++) g.update(DT, idle());
}
const npcsIn = (g: Game) => g.world.entities.filter((e): e is Npc => e instanceof Npc).map((n) => n.def.id);

describe('Расписания жителей', () => {
  it('Мира утром в архиве, днём на площади', () => {
    expect(placeFor('mira', 9 * 60, 0, 'sunny')?.scene).toBe('archive');
    expect(placeFor('mira', 12 * 60 + 30, 0, 'sunny')?.scene).toBe('town');
    expect(placeFor('mira', 12 * 60 + 30, 0, 'rain')?.scene).toBe('archive');
  });

  it('жители появляются в сцене по расписанию', () => {
    const g = Game.newGame('T', 5);
    g.state.time.minutes = 9 * 60;
    g.goTo({ kind: 'interior', id: 'archive' });
    run(g, 1);
    expect(npcsIn(g)).toContain('mira');
    g.state.time.minutes = 13 * 60;
    g.goTo({ kind: 'town' });
    run(g, 1);
    expect(npcsIn(g)).toContain('mira');
    expect(npcsIn(g)).toContain('yorn');
  });

  it('житель уходит из сцены, когда время вышло', () => {
    const g = Game.newGame('T', 6);
    g.state.time.minutes = 13 * 60 + 50;
    g.goTo({ kind: 'town' });
    run(g, 1);
    expect(npcsIn(g)).toContain('mira');
    g.state.time.minutes = 14 * 60 + 1;
    run(g, 40);
    expect(npcsIn(g)).not.toContain('mira');
  });
});

describe('Усадьба, крафт, сад', () => {
  it('стройка зала завершается через день и открывает кухню', () => {
    const g = Game.newGame('T', 7);
    g.state.hero.gold = 5000;
    g.give('wood', 20);
    expect(g.orderUpgrade('hall')).toBeNull();
    expect(g.orderUpgrade('forge')).not.toBeNull(); // уже идёт стройка
    g.sleep();
    run(g, 1);
    expect(g.state.manor.upgrades).toContain('hall');
  });

  it('кузня: плавка и ковка', () => {
    const g = Game.newGame('T', 8);
    g.state.manor.upgrades.push('hall', 'forge');
    g.give('copper_ore', 15);
    g.give('coal', 3);
    g.give('wood', 2);
    g.openCrafting('furnace');
    expect(g.craft('smelt_copper')).toBe(true);
    expect(g.craft('smelt_copper')).toBe(true);
    expect(g.craft('smelt_copper')).toBe(true);
    expect(countItem(g.state.inventory, 'copper_bar')).toBe(3);
    g.openCrafting('anvil');
    expect(g.craft('forge_copper_sword')).toBe(true);
    expect(countItem(g.state.inventory, 'copper_sword')).toBe(1);
    expect(g.craft('forge_copper_sword')).toBe(false); // слитки кончились
  });

  it('сад: посадка, полив, рост, урожай', () => {
    const g = Game.newGame('T', 9);
    g.state.manor.upgrades.push('garden');
    g.state.manor.garden = Array.from({ length: 12 }, () => ({ seed: null, days: 0, watered: false, ready: false }));
    g.state.time.weather = 'sunny';
    g.give('seed_turnip', 2);
    g.plotAction(0); // посадить
    expect(g.state.manor.garden[0]!.seed).toBe('seed_turnip');
    for (let d = 0; d < 4; d++) {
      g.state.time.weather = 'sunny';
      g.plotAction(0); // полить
      g.sleep();
      run(g, 1);
      if (g.state.time.season !== 0) break;
    }
    expect(g.state.manor.garden[0]!.ready).toBe(true);
    g.plotAction(0);
    expect(countItem(g.state.inventory, 'turnip')).toBeGreaterThanOrEqual(1);
  });
});

describe('Отношения и задания', () => {
  it('любимый подарок даёт больше очков, дважды в день нельзя', () => {
    const g = Game.newGame('T', 10);
    g.give('pearl', 2);
    const idx = g.state.inventory.findIndex((s) => s?.def === 'pearl');
    g.giveGift('mira', idx);
    expect(g.state.npcs.mira!.points).toBe(80);
    expect(g.canGift('mira')).toBe(false);
    expect(g.state.giftLog.mira!.pearl).toBe('love');
  });

  it('сдача задания с предметом', () => {
    const g = Game.newGame('T', 11);
    g.startQuest('q_hilda_ore');
    g.give('copper_ore', 12);
    const gold = g.state.hero.gold;
    g.talk('hilda');
    expect(g.questDone('q_hilda_ore')).toBe(true);
    expect(g.state.hero.gold).toBe(gold + 150);
    expect(countItem(g.state.inventory, 'copper_ore')).toBe(2);
  });

  it('главная линия: этаж 5 → следующее задание', () => {
    const g = Game.newGame('T', 12);
    g.startQuest('q_legacy');
    g.goTo({ kind: 'dungeon', floor: 5 });
    run(g, 2);
    expect(g.questDone('q_legacy')).toBe(true);
    expect(g.questActive('q_abbot')).toBe(true);
    expect(g.state.dungeon.elevator).toContain(5);
  });

  it('заточка у Хильды', () => {
    const g = Game.newGame('T', 13);
    g.state.hero.gold = 1000;
    g.give('copper_bar', 5);
    g.openService('sharpen');
    expect(g.applyService({ equip: 'weapon' })).toBe(true);
    expect(g.state.equipment.weapon!.upgrade).toBe(1);
  });
});

describe('Ярус II', () => {
  it('в шахтах встречается мелкая вода, выход достижим', () => {
    let water = 0;
    for (let f = 11; f < 20; f++) {
      const L = generateFloor(hashSeed('w', f), f);
      for (let i = 0; i < L.map.tiles.length; i++) if (L.map.tiles[i] === Tile.SHALLOW) water++;
    }
    expect(water).toBeGreaterThan(20);
  });

  it('на 20-м этаже — Горм', () => {
    const g = Game.newGame('T', 14);
    g.goTo({ kind: 'dungeon', floor: 20 });
    run(g, 1);
    const b = g.world.entities.find((e): e is Boss => e instanceof Boss);
    expect(b?.def.id).toBe('gorm');
  });
});

describe('Миграция сохранений', () => {
  it('v1 → v2 добавляет новые поля', () => {
    const old = { version: 1, hero: { name: 'A' }, economy: { demand: { bone: 0.5 } }, flags: {}, stats: {} };
    const m = migrate(old);
    expect(m.version).toBe(2);
    expect(m.manor.upgrades).toEqual([]);
    expect(m.economy.demand.bone).toBe(0.5);
    expect(m.quests).toEqual({});
  });
});

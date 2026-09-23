import { describe, expect, it } from 'vitest';
import { Game } from '../src/game/game';
import type { Action, InputFrame } from '../src/game/input';
import { Enemy } from '../src/game/entities/enemy';
import { Boss } from '../src/game/entities/boss';
import { Chest } from '../src/game/entities/props';

const DT = 1 / 60;

function input(opts: Partial<{ mx: number; my: number; down: Action[]; pressed: Action[]; aimX: number; aimY: number }> = {}): InputFrame {
  return {
    mx: opts.mx ?? 0, my: opts.my ?? 0, aimX: opts.aimX ?? null, aimY: opts.aimY ?? null,
    down: new Set(opts.down ?? []), pressed: new Set(opts.pressed ?? []), released: new Set(),
  };
}

function run(g: Game, seconds: number, inp: InputFrame = input()) {
  for (let i = 0; i < seconds * 60; i++) g.update(DT, i === 0 ? inp : { ...inp, pressed: new Set() });
}

describe('Симуляция игры (без браузера)', () => {
  it('новая игра начинается в усадьбе с оружием', () => {
    const g = Game.newGame('Тест', 1234);
    expect(g.scene).toEqual({ kind: 'interior', id: 'manor' });
    expect(g.state.equipment.weapon?.def).toBe('rusty_sword');
    run(g, 0.5);
    expect(g.player.hp).toBeGreaterThan(0);
  });

  it('герой ходит и упирается в стены', () => {
    const g = Game.newGame('Тест', 1);
    const x0 = g.player.x;
    run(g, 0.5, input({ mx: 1 }));
    expect(g.player.x).toBeGreaterThan(x0);
    run(g, 5, input({ mx: 1 }));
    expect(g.player.x).toBeLessThan(g.world.map.w * 16);
  });

  it('спуск в подземелье, бой и лут', () => {
    const g = Game.newGame('Тест', 777);
    g.goTo({ kind: 'dungeon', floor: 1 });
    run(g, 1);
    expect(g.scene.kind).toBe('dungeon');
    expect(g.state.dungeon.deepest).toBe(1);
    const enemies = g.world.entities.filter((e): e is Enemy => e instanceof Enemy);
    expect(enemies.length).toBeGreaterThan(0);
    // телепортируем врага к герою и бьём
    const e = enemies[0]!;
    e.x = g.player.x + 14;
    e.y = g.player.y;
    const hp0 = e.hp;
    run(g, 0.4, input({ pressed: ['attack'], aimX: e.x, aimY: e.y - 4 }));
    expect(e.hp).toBeLessThan(hp0);
    // добиваем
    for (let i = 0; i < 40 && !e.dead; i++) {
      e.x = g.player.x + 14;
      e.y = g.player.y;
      run(g, 0.35, input({ pressed: ['attack'], aimX: e.x, aimY: e.y - 4 }));
    }
    expect(e.dead).toBe(true);
    expect(g.state.hero.xp + (g.state.hero.level - 1) * 1000).toBeGreaterThan(0);
  });

  it('сундук выбрасывает предметы, которые подбираются', () => {
    const g = Game.newGame('Тест', 5);
    g.goTo({ kind: 'dungeon', floor: 3 });
    run(g, 1);
    for (const e of g.world.entities) if (e instanceof Enemy) e.removed = true;
    run(g, 0.1);
    const chest = new Chest(g.player.x + 20, g.player.y, 1);
    g.world.add(chest);
    run(g, 0.1);
    const invBefore = g.state.inventory.filter(Boolean).length;
    chest.open(g.world);
    run(g, 3);
    expect(g.state.inventory.filter(Boolean).length).toBeGreaterThan(invBefore);
  });

  it('перекат даёт неуязвимость', () => {
    const g = Game.newGame('Тест', 9);
    run(g, 0.2);
    run(g, 0.05, input({ pressed: ['dodge'], mx: 1 }));
    expect(g.player.state).toBe('dodge');
    expect(g.player.invuln).toBeGreaterThan(0);
  });

  it('смерть: лазарет, потеря золота, новый день', () => {
    const g = Game.newGame('Тест', 11);
    g.state.hero.gold = 1000;
    g.goTo({ kind: 'dungeon', floor: 2 });
    run(g, 1);
    const day = g.state.time.totalDays;
    g.player.hp = 1;
    g.player.die(g.world);
    run(g, 4);
    expect(g.scene).toEqual({ kind: 'interior', id: 'church' });
    expect(g.state.hero.gold).toBe(900);
    expect(g.state.time.totalDays).toBe(day + 1);
    expect(g.state.stats.deaths).toBe(1);
  });

  it('босс этажа 10 и осколок', () => {
    const g = Game.newGame('Тест', 13);
    g.goTo({ kind: 'dungeon', floor: 10 });
    run(g, 1);
    const boss = g.world.entities.find((e): e is Boss => e instanceof Boss)!;
    expect(boss).toBeTruthy();
    boss.hp = 1;
    boss.awake = true;
    boss.die(g.world);
    run(g, 3);
    expect(g.state.dungeon.bosses).toContain(10);
    // осколок подобран или лежит рядом
    const has = g.state.inventory.some((s) => s?.def === 'shard_1');
    const onGround = g.world.entities.some((e: any) => e.stack?.def === 'shard_1');
    expect(has || onGround).toBe(true);
  });

  it('диалог с NPC и торговля', () => {
    const g = Game.newGame('Тест', 21);
    g.goTo({ kind: 'interior', id: 'smithy' });
    run(g, 1);
    g.talk('hilda');
    expect(g.mode).toBe('dialogue');
    while (g.dialogue && g.dialogue.choices.length === 0) g.dialogueAdvance();
    g.dialogueChoose(0); // Торговать
    expect(g.mode).toBe('shop');
    g.state.hero.gold = 1000;
    expect(g.buy('copper_sword')).toBe(true);
    const idx = g.state.inventory.findIndex((s) => s?.def === 'copper_sword');
    expect(idx).toBeGreaterThanOrEqual(0);
    const gold = g.state.hero.gold;
    expect(g.sell(idx)).toBe(true);
    expect(g.state.hero.gold).toBeGreaterThan(gold);
  });

  it('сон переводит день и восстанавливает бодрость', () => {
    const g = Game.newGame('Тест', 3);
    g.state.hero.energy = 10;
    g.sleep();
    run(g, 1);
    expect(g.state.time.totalDays).toBe(2);
    expect(g.state.hero.energy).toBe(g.state.hero.maxEnergy);
  });
});

import { describe, expect, it } from 'vitest';
import { Game } from '../src/game/game';
import type { InputFrame } from '../src/game/input';
import { Boss } from '../src/game/entities/boss';
import { Companion } from '../src/game/entities/companion';
import { makeStack } from '../src/game/systems/inventory';
import { talentBlock, talentPoints } from '../src/game/systems/talents';
import { TALENTS } from '../src/data/talents';
import { endingConditions } from '../src/data/endings';
import { npcState } from '../src/game/state';
import { Enemy } from '../src/game/entities/enemy';
import type { Hitbox } from '../src/game/combat/combat';
import { BrazierPuzzle, DartTrap, FireGrate, PlatePuzzle, PressurePlate, PuzzleBrazier, RuneTrap, SealedChest, SpikeTrap } from '../src/game/entities/traps';

const DT = 1 / 60;
const idle = (): InputFrame => ({ mx: 0, my: 0, aimX: null, aimY: null, down: new Set(), pressed: new Set(), released: new Set() });
function run(g: Game, seconds: number) {
  for (let i = 0; i < seconds * 60; i++) g.update(DT, idle());
}
const bossOn = (g: Game) => g.world.entities.find((e): e is Boss => e instanceof Boss);

describe('Таланты', () => {
  it('по 9 талантов на класс, по 3 на ступень', () => {
    for (const cls of ['sword', 'spear', 'bow', 'staff', 'shield'] as const) {
      const list = TALENTS.filter((d) => d.cls === cls);
      expect(list).toHaveLength(9);
      for (const tier of [1, 2, 3]) expect(list.filter((d) => d.tier === tier)).toHaveLength(3);
    }
  });

  it('очки от уровня класса, ступени по порядку', () => {
    const g = Game.newGame('T', 21);
    expect(talentPoints(g.state, 'sword').total).toBe(0);
    expect(g.learnTalent('sw_edge')).toBe(false);
    g.state.hero.classXp.sword = 400; // несколько уровней
    const pts = talentPoints(g.state, 'sword');
    expect(pts.total).toBeGreaterThanOrEqual(3);
    expect(talentBlock(g.state, 'sw_bleed')).toBe('prereq');
    expect(g.learnTalent('sw_edge')).toBe(true);
    expect(g.learnTalent('sw_edge')).toBe(false);
    expect(g.learnTalent('sw_bleed')).toBe(true);
    expect(talentPoints(g.state, 'sword').spent).toBe(3);
  });

  it('прибавки работают только с оружием своего класса', () => {
    const g = Game.newGame('T', 22);
    g.state.hero.classXp.sword = 5000;
    g.refreshStats();
    const base = g.stats().dmgPct;
    g.learnTalent('sw_edge');
    expect(g.stats().dmgPct).toBeCloseTo(base + 10);
    g.state.equipment.weapon = makeStack('copper_bow', 1);
    g.refreshStats();
    const bowPct = g.stats().dmgPct;
    g.state.equipment.weapon = makeStack('rusty_sword', 1);
    g.refreshStats();
    expect(g.stats().dmgPct - bowPct).toBeGreaterThanOrEqual(10);
  });

  it('поведенческие таланты меняют профиль игрока', () => {
    const g = Game.newGame('T', 23);
    g.state.hero.classXp.sword = 5000;
    const p = g.player;
    expect(p.profile.combo).toHaveLength(3);
    g.learnTalent('sw_edge');
    g.learnTalent('sw_fourth');
    expect(p.profile.combo).toHaveLength(4);

    g.state.hero.classXp.shield = 5000;
    g.state.equipment.weapon = makeStack('copper_shield', 1);
    g.learnTalent('sh_bastion');
    g.refreshStats();
    expect(p.blockRatio).toBeCloseTo(0.95);
    expect(p.profile.combo).toHaveLength(2);

    g.state.hero.classXp.bow = 5000;
    g.state.equipment.weapon = makeStack('copper_bow', 1);
    g.learnTalent('bw_draw');
    expect(p.chargeTime).toBeLessThan(0.4);
  });

  it('сброс талантов стоит золота и возвращает очки', () => {
    const g = Game.newGame('T', 24);
    g.state.hero.classXp.sword = 5000;
    g.learnTalent('sw_edge');
    g.learnTalent('sw_riposte');
    const cost = g.talentResetCost('sword');
    expect(cost).toBeGreaterThan(0);
    g.state.hero.gold = cost;
    expect(g.resetTalents('sword')).toBe(true);
    expect(g.state.hero.gold).toBe(0);
    expect(talentPoints(g.state, 'sword').spent).toBe(0);
  });
});

describe('Ярусы III–VII', () => {
  const expected: [number, string][] = [[30, 'spore_mother'], [40, 'brodrik'], [50, 'keeper_silence'], [60, 'ash_seraph'], [70, 'halvard']];
  for (const [floor, id] of expected)
    it(`этаж ${floor}: ${id}`, () => {
      const g = Game.newGame('T', 30 + floor);
      g.goTo({ kind: 'dungeon', floor });
      run(g, 0.5);
      expect(bossOn(g)?.def.id).toBe(id);
    });

  it('обычные этажи глубоких ярусов генерируются и населены', () => {
    for (const floor of [33, 47, 58, 66]) {
      const g = Game.newGame('T', 100 + floor);
      g.goTo({ kind: 'dungeon', floor });
      run(g, 1);
      expect(g.world.enemies().length).toBeGreaterThan(3);
    }
  });
});

describe('Спутники и финалы', () => {
  it('житель с 4♥ спускается с героем', () => {
    const g = Game.newGame('T', 41);
    g.state.time.minutes = 10 * 60;
    expect(g.canInvite('kai')).toBe(false);
    npcState(g.state, 'kai').points = 4 * 250;
    expect(g.canInvite('kai')).toBe(true);
    g.inviteCompanion('kai');
    g.goTo({ kind: 'dungeon', floor: 1 });
    run(g, 1);
    expect(g.world.entities.some((e) => e instanceof Companion)).toBe(true);
  });

  it('условия доброго финала', () => {
    const g = Game.newGame('T', 42);
    expect(endingConditions(g.state).free).toBe(false);
    g.state.flags.edmund_letter_read = true;
    g.state.flags.chronicle_mira = true;
    npcState(g.state, 'mira').points = 6 * 250;
    g.state.factions.watch = 30;
    expect(endingConditions(g.state).free).toBe(true);
  });

  it('без условий «освобождение» ведёт к плохому финалу', () => {
    const g = Game.newGame('T', 43);
    let ending: string | null = null;
    g.events.on('ending', (e) => (ending = e?.id ?? null));
    g.chooseEnding('free');
    expect(ending).toBe('bad');
    expect(g.state.ending).toBe('bad');
  });

  it('свадьба: лента, амулет, три дня', () => {
    const g = Game.newGame('T', 44);
    g.state.manor.upgrades.push('hall');
    npcState(g.state, 'mira').points = 10 * 250;
    g.give('silver_ribbon');
    g.giveGift('mira', g.state.inventory.findIndex((s) => s?.def === 'silver_ribbon'));
    expect(g.state.romance.stage).toBe('dating');
    g.give('oath_amulet');
    g.giveGift('mira', g.state.inventory.findIndex((s) => s?.def === 'oath_amulet'));
    expect(g.state.romance.stage).toBe('engaged');
    for (let i = 0; i < 3; i++) g.sleep();
    expect(g.state.romance.stage).toBe('married');
  });
});

describe('Ловушки и головоломки', () => {
  const clearEnemies = (g: Game) => {
    for (const e of g.world.enemies()) g.world.remove(e);
  };
  const tileOf = (g: Game) => [Math.floor(g.player.x / 16), Math.floor(g.player.y / 16)] as const;

  it('шипы ранят героя, стоящего на плите, а перекат спасает', () => {
    const g = Game.newGame('T', 51);
    g.goTo({ kind: 'dungeon', floor: 5 });
    run(g, 1);
    clearEnemies(g);
    const [tx, ty] = tileOf(g);
    g.world.add(new SpikeTrap(tx, ty, 0));
    const hp0 = g.player.hp;
    run(g, 3);
    expect(g.player.hp).toBeLessThan(hp0);
  });

  it('ловушки бьют и чудовищ', () => {
    const g = Game.newGame('T', 52);
    g.goTo({ kind: 'dungeon', floor: 5 });
    run(g, 1);
    clearEnemies(g);
    const [tx, ty] = tileOf(g);
    const rat = new Enemy('grave_rat', g.player.x + 32, g.player.y, 5);
    rat.stun = 99;
    g.world.add(rat);
    g.world.add(new FireGrate(tx + 2, ty, 0));
    const hp0 = rat.hp;
    run(g, 4);
    expect(rat.hp).toBeLessThan(hp0);
  });

  it('плиты: ошибка сбрасывает, верный порядок снимает печать', () => {
    const g = Game.newGame('T', 53);
    g.goTo({ kind: 'dungeon', floor: 5 });
    run(g, 1);
    clearEnemies(g);
    const [tx, ty] = tileOf(g);
    const chest = new SealedChest(g.player.x, g.player.y - 40);
    const puzzle = new PlatePuzzle([2, 0, 3, 1], chest);
    const plates = [0, 1, 2, 3].map((s) => new PressurePlate(tx + 40 + s * 2, ty, s, puzzle));
    for (const p of plates) g.world.add(p);
    run(g, 0.1);
    puzzle.press(g.world, plates[2]!);
    puzzle.press(g.world, plates[1]!); // неверно
    expect(puzzle.progress).toBe(0);
    expect(plates[2]!.pressed).toBe(false);
    for (const s of [2, 0, 3, 1]) puzzle.press(g.world, plates[s]!);
    expect(puzzle.solved).toBe(true);
    expect(chest.sealed).toBe(false);
  });

  it('жаровни: зажечь все сразу', () => {
    const g = Game.newGame('T', 54);
    g.goTo({ kind: 'dungeon', floor: 5 });
    run(g, 1);
    const chest = new SealedChest(0, 0);
    const puzzle = new BrazierPuzzle(chest);
    const bs = [0, 1, 2].map((i) => new PuzzleBrazier(40 + i * 3, 3, puzzle, 3));
    const hb = { owner: g.player } as unknown as Hitbox;
    bs[0]!.onStruck(g.world, hb);
    bs[1]!.onStruck(g.world, hb);
    for (const b of bs) b.update(g.world, 4); // первые две погасли
    bs[2]!.onStruck(g.world, hb);
    expect(puzzle.solved).toBe(false);
    for (const b of bs) b.onStruck(g.world, hb);
    expect(puzzle.solved).toBe(true);
    expect(chest.sealed).toBe(false);
  });

  it('на этажах встречаются ловушки и головоломки, но не у входа', () => {
    let traps = 0, puzzles = 0;
    for (let i = 0; i < 24; i++) {
      const g = Game.newGame('T', 600 + i);
      const floor = 3 + ((i * 7) % 60);
      if (floor % 10 === 0) continue;
      g.goTo({ kind: 'dungeon', floor });
      run(g, 0.6);
      const ts = g.world.entities.filter((e) => e instanceof SpikeTrap || e instanceof FireGrate || e instanceof RuneTrap || e instanceof DartTrap);
      traps += ts.length;
      puzzles += g.world.entities.filter((e) => e instanceof SealedChest).length;
      const p = g.player;
      for (const t of ts) expect(Math.hypot(t.x - p.x, t.y - p.y)).toBeGreaterThan(40);
    }
    expect(traps).toBeGreaterThan(20);
    expect(puzzles).toBeGreaterThan(2);
  });
});

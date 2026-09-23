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
import { Npc } from '../src/game/entities/npc';
import { Pickup } from '../src/game/entities/pickup';
import { migrate } from '../src/game/systems/save';
import { SpiritProp } from '../src/game/systems/festivals';
import { sellPrice } from '../src/game/systems/economy';
import { SHOPS } from '../src/data/shops';
import { GIFT_POINTS, giftReaction } from '../src/game/systems/relations';
import { npcDef } from '../src/data/npcs';
import { marketValue, reactTo } from '../src/game/systems/playershop';
import { auctionValue, minBid } from '../src/game/systems/auction';
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

describe('Праздники', () => {
  const festDay = (g: Game, season: number, day: number, minutes: number) => {
    g.state.time.season = season;
    g.state.time.day = day;
    g.state.time.minutes = minutes;
    g.goTo({ kind: 'town' });
    run(g, 1.5);
  };
  const npcIds = (g: Game) => g.world.entities.filter((e): e is Npc => e instanceof Npc).map((n) => n.def.id);

  it('в день турнира горожане на площади, лавки и склеп закрыты', () => {
    const g = Game.newGame('T', 71);
    festDay(g, 0, 13, 11 * 60);
    const ids = npcIds(g);
    expect(ids).toContain('bran');
    expect(ids.length).toBeGreaterThan(15);
    g.openShop('smith');
    expect(g.mode).toBe('play');
    g.openElevator();
    expect(g.mode).toBe('play');
    expect(g.scene.kind).toBe('town');
  });

  it('турнир: три раунда и приз', () => {
    const g = Game.newGame('T', 72);
    festDay(g, 0, 13, 11 * 60);
    const gold0 = g.state.hero.gold;
    g.festival('tourney');
    for (let round = 0; round < 3; round++) {
      run(g, 3);
      const foes = g.fest.duel?.foes ?? [];
      expect(foes.length).toBeGreaterThan(0);
      for (const f of foes) f.die(g.world);
      run(g, 0.2);
    }
    expect(g.fest.duel).toBeNull();
    expect(g.state.hero.gold).toBeGreaterThanOrEqual(gold0 + 300);
    expect(g.state.flags.tourney_won_1).toBe(true);
    expect(g.state.inventory.some((s) => s && s.rarity === 2)).toBe(true);
  });

  it('поражение на турнире — не смерть', () => {
    const g = Game.newGame('T', 73);
    festDay(g, 0, 13, 11 * 60);
    g.festival('tourney');
    run(g, 3);
    g.player.die(g.world);
    expect(g.player.dead).toBe(false);
    expect(g.mode).not.toBe('dead');
    expect(g.fest.duel).toBeNull();
  });

  it('ярмарка: конкурс урожая и тройная цена', () => {
    const g = Game.newGame('T', 74);
    festDay(g, 1, 11, 12 * 60);
    g.give('pumpkin', 2);
    const gold0 = g.state.hero.gold;
    g.festival('contest');
    expect(g.state.hero.gold).toBeGreaterThan(gold0);
    expect(g.fest.did('contest')).toBe(true);
    const pumpkin = g.state.inventory.find((s) => s?.def === 'pumpkin')!;
    expect(sellPrice(g.state, pumpkin, SHOPS.fair!)).toBeGreaterThan(sellPrice(g.state, pumpkin, SHOPS.grocer!) * 2);
  });

  it('Ночь духов: четыре шёпота дают запись и фонарь', () => {
    const g = Game.newGame('T', 75);
    festDay(g, 2, 27, 20 * 60);
    const spirits = g.world.entities.filter((e): e is SpiritProp => e instanceof SpiritProp);
    expect(spirits).toHaveLength(4);
    for (const sp of spirits) {
      sp.interaction!.act(g.world);
      while (g.dialogue) g.dialogueAdvance();
    }
    expect(g.state.lore).toContain('spirits_night');
    expect(g.state.inventory.some((s) => s?.def === 'spirit_lantern')).toBe(true);
  });

  it('Зимний пир: тайный даритель утраивает подарок', () => {
    const g = Game.newGame('T', 76);
    festDay(g, 3, 25, 17 * 60);
    g.festival('giver');
    expect(g.state.fest.target).toBeTruthy();
    // адресат случаен — для проверки множителя берём Миру (не именинница, очки не упираются в ноль)
    const target = (g.state.fest.target = 'mira');
    npcState(g.state, target).points = 1000;
    g.give('apple', 1);
    const p0 = npcState(g.state, target).points;
    g.giveGift(target, g.state.inventory.findIndex((s) => s?.def === 'apple'));
    const gained = npcState(g.state, target).points - p0;
    expect(gained).toBe(GIFT_POINTS[giftReaction(npcDef(target), 'apple')] * 3);
  });
});

describe('Своя лавка', () => {
  it('реакции по цене', () => {
    expect(reactTo(80, 100, 1)).toBe('cheap');
    expect(reactTo(100, 100, 1)).toBe('fair');
    expect(reactTo(120, 100, 1)).toBe('pricey');
    expect(reactTo(200, 100, 1)).toBe('robbery');
  });

  const shopGame = (seed: number) => {
    const g = Game.newGame('T', seed);
    g.state.manor.upgrades.push('hall', 'shop');
    g.state.time.minutes = 10 * 60;
    g.goTo({ kind: 'interior', id: 'ashshop' });
    run(g, 1);
    return g;
  };

  it('покупатели покупают по честной цене', () => {
    const g = shopGame(81);
    g.give('iron_bar', 10);
    for (let i = 0; i < 3; i++) g.give('potion_heal', 1);
    const bar = g.state.inventory.findIndex((s) => s?.def === 'iron_bar');
    g.placeOnDisplay(0, bar);
    const d = g.state.shop.displays[0]!;
    g.setDisplayPrice(0, Math.round(marketValue(g.state, d.stack) * 0.9));
    const gold0 = g.state.hero.gold;
    g.toggleShop();
    expect(g.shopOpen).toBe(true);
    run(g, 60);
    expect(g.state.shop.sales).toBeGreaterThan(0);
    expect(g.state.hero.gold).toBeGreaterThan(gold0);
    expect(g.state.shop.book.iron_bar?.ok).toBeGreaterThan(0);
  });

  it('грабительская цена отпугивает и роняет популярность', () => {
    const g = shopGame(82);
    g.give('iron_bar', 10);
    g.placeOnDisplay(0, g.state.inventory.findIndex((s) => s?.def === 'iron_bar'));
    const d = g.state.shop.displays[0]!;
    g.setDisplayPrice(0, marketValue(g.state, d.stack) * 5);
    const pop0 = g.state.shop.popularity;
    g.toggleShop();
    run(g, 40);
    expect(g.state.shop.sales).toBe(0);
    expect(g.state.shop.popularity).toBeLessThan(pop0);
  });

  it('вне часов работы лавка не открывается', () => {
    const g = shopGame(83);
    g.state.time.minutes = 18 * 60;
    g.toggleShop();
    expect(g.shopOpen).toBe(false);
  });
});

describe('Аукцион', () => {
  it('утренние лоты, выкуп и ставка', () => {
    const g = Game.newGame('T', 91);
    g.state.hero.gold = 100000;
    g.openAuction();
    const a = g.state.auction;
    expect(a.lots.length).toBeGreaterThanOrEqual(5);
    expect(a.lots.length).toBeLessThanOrEqual(15);
    const lot = a.lots[0]!;
    const gold0 = g.state.hero.gold;
    expect(g.auctionBuyout(lot.id)).toBe(true);
    expect(g.state.hero.gold).toBe(gold0 - lot.buyout);
    const other = a.lots[0]!;
    expect(g.auctionBid(other.id, minBid(other))).toBe(true);
    expect(other.mine).toBeGreaterThan(0);
  });

  it('свой лот: залог, продажа за ночь с комиссией или возврат на почту', () => {
    const g = Game.newGame('T', 92);
    g.state.hero.gold = 1000;
    g.give('iron_bar', 5);
    const idx = g.state.inventory.findIndex((s) => s?.def === 'iron_bar');
    const v = auctionValue(g.state.inventory[idx]!);
    // дёшево с выкупом — почти наверняка уйдёт
    expect(g.auctionList(idx, Math.round(v * 0.5), Math.round(v * 0.6), 1)).toBe(true);
    expect(g.state.hero.gold).toBeLessThan(1000);
    g.give('copper_bar', 5);
    const idx2 = g.state.inventory.findIndex((s) => s?.def === 'copper_bar');
    const v2 = auctionValue(g.state.inventory[idx2]!);
    // грабёж без выкупа — скорее всего вернётся
    expect(g.auctionList(idx2, v2 * 20, 0, 1)).toBe(true);
    const gold1 = g.state.hero.gold;
    g.sleep();
    run(g, 1);
    const a = g.state.auction;
    expect(a.mine.length).toBe(0);
    expect(g.state.hero.gold).toBeGreaterThan(gold1);
    expect(a.mail.some((s) => s.def === 'copper_bar')).toBe(true);
    g.auctionCollect();
    expect(a.mail.length).toBe(0);
  });
});

describe('Бездна', () => {
  it('ниже 70-го этажа — только после финала', () => {
    const g = Game.newGame('T', 101);
    g.goTo({ kind: 'dungeon', floor: 70 });
    run(g, 1);
    g.descend();
    run(g, 1);
    expect(g.scene.kind === 'dungeon' && g.scene.floor).toBe(70);
    g.state.ending = 'restore';
    g.descend();
    run(g, 1);
    expect(g.scene.kind === 'dungeon' && g.scene.floor).toBe(71);
    expect(g.world.tier?.id).toBe(8);
    expect(g.world.enemies().length).toBeGreaterThan(3);
    expect(g.state.stats.abyssDeepest).toBe(71);
  });

  it('эхо боссов по кругу, сильнее на глубине, без осколков Печати', () => {
    const hp: number[] = [];
    for (const [floor, id] of [[80, 'bone_abbot'], [90, 'gorm'], [140, 'bone_abbot']] as const) {
      const g = Game.newGame('T', 110 + floor);
      g.state.ending = 'free';
      g.goTo({ kind: 'dungeon', floor });
      run(g, 0.6);
      const b = bossOn(g)!;
      expect(b.def.id).toBe(id);
      hp.push(b.maxHp);
      if (floor === 90) {
        b.die(g.world);
        run(g, 0.2);
        const drops = g.world.entities.filter((e): e is Pickup => e instanceof Pickup && !!e.stack).map((p) => p.stack!.def);
        expect(drops.some((d) => d.startsWith('shard_'))).toBe(false);
        expect(drops).toContain('abyss_shard');
      }
    }
    expect(hp[2]).toBeGreaterThan(hp[0]!);
  });

  it('проклятия этажей встречаются', () => {
    const curses = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const g = Game.newGame('T', 130 + i);
      g.state.ending = 'restore';
      g.goTo({ kind: 'dungeon', floor: 73 + i });
      run(g, 0.6);
      curses.add(String(g.world.meta.curse));
    }
    expect(curses.size).toBeGreaterThanOrEqual(3);
  });
});

describe('Доступность', () => {
  it('сюжетный режим: вдвое меньше урона и смерть без потерь', () => {
    const hit = (story: boolean) => {
      const g = Game.newGame('T', 141);
      g.state.settings.story = story;
      g.refreshStats();
      g.goTo({ kind: 'dungeon', floor: 3 });
      run(g, 1);
      for (const e of g.world.enemies()) g.world.remove(e);
      const hp0 = g.player.hp;
      g.player.invuln = 0;
      g.world.spawnHitbox({ owner: g.player, team: 'trap', shape: 'circle', x: g.player.x, y: g.player.y - 4, r: 10, angle: 0, half: Math.PI, follow: false, ox: 0, oy: 0, t: 0.05, delay: 0, breaks: false, spec: { dmg: 40, crit: 0, critMul: 1, knock: 0, source: null, unblockable: true } });
      run(g, 0.1);
      return hp0 - g.player.hp;
    };
    const normal = hit(false), story = hit(true);
    expect(story).toBeLessThan(normal * 0.7);
  });

  it('старые сохранения получают настройки по умолчанию', () => {
    const m = migrate({ version: 2, hero: { name: 'A' }, settings: { lang: 'en', volume: 0.3, shake: false }, flags: {}, stats: {} });
    expect(m.settings.lang).toBe('en');
    expect(m.settings.speed).toBe(1);
    expect(m.settings.flashes).toBe(true);
  });
});

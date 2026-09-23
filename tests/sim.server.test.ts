import { describe, expect, it } from 'vitest';
import { glicko2, seasonReset } from '../src/server/sim/glicko';
import { ArenaSim } from '../src/server/sim/arena';
import { normalizeItem, type SimHero } from '../src/server/sim/hero';
import { leagueOf, type NetInput } from '../src/online/protocol';
import { Db } from '../src/server/db';
import { guestLogin } from '../src/server/auth';
import { createHero, heroById } from '../src/server/services/hero';
import { finishMatch, loadSimHero } from '../src/server/services/arena';

const hero = (id: string, cls: SimHero['cls'] = 'sword', level = 10): SimHero => ({
  id, name: id, cls, level, karma: 0, classXp: {}, talents: [],
  equipment: [
    { uid: `${id}-w`, def: `iron_${cls}`, qty: 1, rarity: 1, affixes: [{ id: 'sharp', value: 30 }], upgrade: 3, slot: 'weapon' },
    { uid: `${id}-b`, def: 'iron_body', qty: 1, rarity: 0, affixes: [], upgrade: 0, slot: 'body' },
  ],
});

let seq = 0;
const inp = (mx: number, my: number, p: string[] = [], d: string[] = [], ax: number | null = null, ay: number | null = null): NetInput => ({ seq: ++seq, mx, my, ax, ay, p, d });

describe('Glicko-2', () => {
  it('пример из статьи Глицкмана', () => {
    const r = glicko2({ rating: 1500, rd: 200, vol: 0.06 }, [
      { opp: { rating: 1400, rd: 30, vol: 0.06 }, score: 1 },
      { opp: { rating: 1550, rd: 100, vol: 0.06 }, score: 0 },
      { opp: { rating: 1700, rd: 300, vol: 0.06 }, score: 0 },
    ]);
    expect(r.rating).toBeCloseTo(1464.06, 1);
    expect(r.rd).toBeCloseTo(151.52, 1);
    expect(r.vol).toBeCloseTo(0.05999, 4);
  });

  it('лиги и мягкий сброс сезона', () => {
    expect(leagueOf(1400)).toBe('bronze');
    expect(leagueOf(1650)).toBe('gold');
    expect(leagueOf(2200)).toBe('legend');
    expect(seasonReset({ rating: 2000, rd: 60, vol: 0.06 }).rating).toBe(1850);
  });
});

describe('Нормализация в рейтинге', () => {
  it('оружие и броня — к эталону, аффиксы — к середине, заточка сброшена', () => {
    const n = normalizeItem({ uid: 'x', def: 'heart_sword', qty: 1, rarity: 3, affixes: [{ id: 'sharp', value: 999 }], upgrade: 5, slot: 'weapon' });
    expect(n.def).toBe('silver_sword');
    expect(n.upgrade).toBe(0);
    expect(n.affixes[0]!.value).toBeLessThan(20);
    // два героя с разной экипировкой в рейтинге получают одинаковую атаку
    const weak = { ...hero('w'), level: 3, equipment: [{ ...hero('w').equipment[0]!, def: 'copper_sword', upgrade: 0 }] };
    const strong = { ...hero('s'), level: 40 };
    const sim = new ArenaSim('duel', true, [{ hero: weak, team: 'A' }, { hero: strong, team: 'B' }], 1);
    const [a, b] = [sim.heroes.get('w')!, sim.heroes.get('s')!];
    expect(a.stats.atk).toBeCloseTo(b.stats.atk);
  });
});

describe('Арена (симуляция без сети)', () => {
  it('дуэль: отсчёт, бой, победа того, кто бьёт', () => {
    const sim = new ArenaSim('duel', false, [{ hero: hero('a'), team: 'A' }, { hero: { ...hero('b'), equipment: [] }, team: 'B' }], 3);
    const A = sim.heroes.get('a')!, B = sim.heroes.get('b')!;
    for (let i = 0; i < 30 * 3 + 3; i++) sim.step();
    expect(sim.phase).toBe('fight');
    B.x = A.x + 18;
    B.y = A.y;
    for (let i = 0; i < 30 * 60 && sim.phase !== 'over'; i++) {
      sim.input('a', inp(0, 0, i % 12 === 0 ? ['attack'] : [], [], B.x, B.y - 4));
      sim.step();
      B.x = A.x + 18;
      B.y = A.y;
    }
    expect(sim.phase).toBe('over');
    expect(sim.result!.winners).toEqual(['a']);
    expect(sim.result!.losers).toEqual(['b']);
  });

  it('ввод с неверными данными отбрасывается, старые seq игнорируются', () => {
    const sim = new ArenaSim('duel', false, [{ hero: hero('a'), team: 'A' }, { hero: hero('b'), team: 'B' }], 4);
    for (let i = 0; i < 100; i++) sim.step();
    const A = sim.heroes.get('a')!;
    const x0 = A.x;
    sim.input('a', { seq: 1000, mx: 50, my: 0, ax: null, ay: null, p: ['teleport', 'attack'], d: [] });
    expect(A.seq).toBe(1000);
    sim.input('a', { seq: 999, mx: -1, my: 0, ax: null, ay: null, p: [], d: [] });
    for (let i = 0; i < 30; i++) sim.step();
    // скорость не превышает обычную: вектор нормализован
    expect(A.x - x0).toBeLessThan(100);
    expect(A.x).toBeGreaterThan(x0);
    sim.input('a', { seq: 1001, mx: NaN, my: 0 } as unknown as NetInput);
    expect(A.seq).toBe(1000);
  });

  it('3×3: уничтожение команды', () => {
    const entrants = ['a1', 'a2', 'a3', 'b1', 'b2', 'b3'].map((id, i) => ({ hero: hero(id), team: (i < 3 ? 'A' : 'B') as 'A' | 'B' }));
    const sim = new ArenaSim('team', true, entrants, 5);
    for (let i = 0; i < 100; i++) sim.step();
    for (const id of ['b1', 'b2', 'b3']) sim.forfeit(id);
    sim.step();
    expect(sim.result!.winners.sort()).toEqual(['a1', 'a2', 'a3']);
  });

  it('волны: монстры появляются, растёт номер волны, конец — когда все пали', () => {
    const sim = new ArenaSim('waves', false, [{ hero: hero('solo', 'sword', 20), team: 'A' }], 6);
    for (let i = 0; i < 30 * 5; i++) sim.step();
    expect(sim.wave).toBe(1);
    expect(sim.world.enemies().length).toBeGreaterThanOrEqual(3);
    for (const e of sim.world.enemies()) e.die(sim.world, null);
    for (let i = 0; i < 30 * 6; i++) sim.step();
    expect(sim.wave).toBe(2);
    sim.forfeit('solo');
    sim.step();
    expect(sim.phase).toBe('over');
    expect(sim.result!.waves).toBe(1);
  });

  it('монстры в сетевом мире идут к ближайшему герою', () => {
    const sim = new ArenaSim('waves', false, [{ hero: hero('p1'), team: 'A' }, { hero: hero('p2'), team: 'A' }], 7);
    for (let i = 0; i < 30 * 5; i++) sim.step();
    const p2 = sim.heroes.get('p2')!;
    p2.x = 60;
    p2.y = 60;
    const e = sim.world.enemies()[0]!;
    e.x = 90;
    e.y = 70;
    const d0 = Math.hypot(e.x - p2.x, e.y - p2.y);
    for (let i = 0; i < 20; i++) sim.step();
    expect(Math.hypot(e.x - p2.x, e.y - p2.y)).toBeLessThan(d0);
  });

  it('снимок содержит героев, монстров и телеграфы', () => {
    const sim = new ArenaSim('waves', false, [{ hero: hero('p1'), team: 'A' }], 8);
    for (let i = 0; i < 30 * 6; i++) sim.step();
    const snap = sim.snapshot();
    expect(snap.some((e) => e.k === 'hero' && e.n === 'p1')).toBe(true);
    expect(snap.some((e) => e.k === 'mob')).toBe(true);
  });
});

describe('Итог матча в БД', () => {
  it('рейтинг, победы, награды', () => {
    const db = new Db();
    const mk = (d: string, n: string) => createHero(db, guestLogin(db, d, 0).id, n, 'sword', 0);
    const a = mk('dev-arena-01', 'Альфа'), b = mk('dev-arena-02', 'Бета');
    expect(loadSimHero(db, a.id).equipment.length).toBe(2);
    const r = finishMatch(db, { mode: 'duel', ranked: true, winners: [a.id], losers: [b.id], draw: false, waves: 0, duration: 30 }, 0, 1000);
    expect(r[a.id]!.delta).toBeGreaterThan(0);
    expect(r[b.id]!.delta).toBeLessThan(0);
    expect(heroById(db, a.id).wins).toBe(1);
    expect(heroById(db, a.id).gold).toBe(220);
    expect(heroById(db, a.id).tokens).toBe(2);
    finishMatch(db, { mode: 'waves', ranked: false, winners: [], losers: [b.id], draw: false, waves: 7, duration: 300 }, 0, 2000);
    expect(heroById(db, b.id).waves_best).toBe(7);
  });
});

import { WastesSim } from '../src/server/sim/wastes';
import { wastesHooks } from '../src/server/services/wastes';
import { giveToHero, inventory } from '../src/server/services/hero';
import { CAMP } from '../src/server/sim/core';
import { Pickup } from '../src/game/entities/pickup';

describe('Пепельные Пустоши', () => {
  const setup = () => {
    const db = new Db();
    let now = 1_000_000;
    const mk = (d: string, n: string) => createHero(db, guestLogin(db, d, 0).id, n, 'sword', 0);
    const a = mk('dev-waste-01', 'Хищник'), b = mk('dev-waste-02', 'Путник');
    for (let i = 0; i < 3; i++) giveToHero(db, b.id, { def: 'iron_bar', qty: 1 + i, rarity: 0 }, 't', 0);
    giveToHero(db, b.id, { def: 'copper_ore', qty: 5 }, 't', 0);
    const sim = new WastesSim(wastesHooks(db, () => now, () => 0.5), 3);
    const A = sim.join(loadSimHero(db, a.id)), B = sim.join(loadSimHero(db, b.id));
    return { db, sim, a, b, A, B, tick: (ms: number) => (now += ms) };
  };

  const outside = (sim: WastesSim, A: { x: number; y: number }, B: { x: number; y: number }) => {
    A.x = (CAMP.x - 6) * 16;
    A.y = (CAMP.y + 2) * 16;
    B.x = A.x + 18;
    B.y = A.y;
    for (const e of sim.world.enemies()) sim.world.remove(e);
  };

  it('в лагере драться нельзя', () => {
    const { sim, A, B } = setup();
    B.x = A.x + 16;
    B.y = A.y;
    const hp = B.hp;
    for (let i = 0; i < 60; i++) {
      sim.input(A.hero.id, inp(0, 0, i % 10 === 0 ? ['attack'] : [], [], B.x, B.y - 4));
      sim.step();
      B.x = A.x + 16;
      B.y = A.y;
    }
    expect(B.hp).toBe(hp);
  });

  it('убийство невинного: карма, фиолетовый флаг, потеря вещей жертвой, подбор добычи', () => {
    const { db, sim, a, b, A, B } = setup();
    outside(sim, A, B);
    const invB = inventory(db, b.id).length;
    B.hp = 5;
    for (let i = 0; i < 90 && !B.dead; i++) {
      sim.input(A.hero.id, inp(0, 0, i % 10 === 0 ? ['attack'] : [], [], B.x, B.y - 4));
      sim.step();
    }
    expect(B.dead).toBe(true);
    expect(sim.status(A)).toBe('purple');
    expect(heroById(db, a.id).karma).toBe(-50 - 150);
    // жертва потеряла 1–3 стопки (rand=0.5 → 2), они лежат на земле
    expect(inventory(db, b.id).length).toBe(invB - 2);
    const onGround = db.all("SELECT uid FROM items WHERE owner_kind = 'escrow' AND owner_id = 'wastes'");
    expect(onGround.length).toBe(2);
    // хищник подбирает добычу
    for (let i = 0; i < 60; i++) {
      const loot = sim.world.entities.find((e) => e instanceof Pickup && !e.removed);
      if (loot) {
        A.x = loot.x;
        A.y = loot.y + 4;
      }
      sim.step();
    }
    expect(db.all("SELECT uid FROM items WHERE owner_kind = 'escrow'").length).toBe(0);
    expect(inventory(db, a.id).length).toBe(1 + 2);
    // жертва воскресает в лагере
    for (let i = 0; i < 30 * 6; i++) sim.step();
    expect(B.dead).toBe(false);
  });

  it('монстры появляются вне лагеря', () => {
    const { sim } = setup();
    expect(sim.world.enemies().length).toBeGreaterThan(15);
    for (const e of sim.world.enemies()) {
      const tx = e.x / 16, ty = e.y / 16;
      expect(tx >= CAMP.x && tx < CAMP.x + CAMP.w && ty >= CAMP.y && ty < CAMP.y + CAMP.h).toBe(false);
    }
  });
});

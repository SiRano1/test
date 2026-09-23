import { TILE } from '../../core/math';
import { Tile } from '../../core/tilemap';
import { festKey, festivalNow, festivalToday, FESTIVALS, SPIRITS, type FestivalDef, type FestivalId } from '../../data/festivals';
import { ITEMS, itemDef } from '../../data/items';
import { L, t, type Loc } from '../../data/loc';
import { npcDef } from '../../data/npcs';
import type { Place } from '../../data/schedules';
import { scheduledNpcs } from '../../data/schedules';
import { Enemy } from '../entities/enemy';
import { Prop } from '../entities/props';
import type { Game } from '../game';
import { hearts } from '../state';
import { BUILDINGS, buildTownMap } from '../town/town';
import type { WeaponClass } from '../types';
import { WEAPON_CLASSES } from '../types';
import type { World } from '../world';
import { makeItem } from './loot';
import { classLevel } from './stats';

type Rect = { x: number; y: number; w: number; h: number };
const inRect = (r: Rect, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

/** Что стоит на площади всегда: колодец и прилавки. */
const PLAZA_FIXED: Rect[] = [
  { x: 30, y: 19, w: 3, h: 2 },
  { x: 25, y: 17, w: 2, h: 1 }, { x: 36, y: 17, w: 2, h: 1 }, { x: 25, y: 22, w: 2, h: 1 }, { x: 36, y: 22, w: 2, h: 1 },
];
/** Ристалище турнира (зрители вокруг, внутри — бой). */
export const LISTS: Rect = { x: 27, y: 15, w: 9, h: 4 };
const FEAST_TABLE: Rect = { x: 27, y: 16, w: 9, h: 1 };

const HOST_SPOT: Record<FestivalId, [number, number]> = {
  tourney: [36, 15], fair: [31, 18], spirits: [11, 12], feast: [31, 18],
};

/** Раунды турнира: кто выходит против героя. */
const ROUNDS: { foes: string[]; title: Loc }[] = [
  { foes: ['tourney_squire'], title: L('Раунд 1: оруженосец Тобиас', 'Round 1: Squire Tobias') },
  { foes: ['tourney_knight', 'tourney_squire'], title: L('Раунд 2: рыцарь и оруженосец', 'Round 2: a knight and a squire') },
  { foes: ['tourney_champion'], title: L('Финал: сэр Годрик', 'Final: Sir Godric') },
];

/** Праздники: сбор горожан, украшения, турнир, ярмарка, Ночь духов, Зимний пир. */
export class Festivals {
  duel: { round: number; foes: Enemy[]; wait: number } | null = null;
  private spots = new Map<FestivalId, [number, number][]>();

  constructor(private g: Game) {}

  private get s() {
    return this.g.state;
  }

  /** Запись о текущем празднике (сбрасывается с новым праздником). */
  rec() {
    const k = festKey(this.s);
    if (this.s.fest.key !== k) this.s.fest = { key: k, target: null, heard: [], done: [] };
    return this.s.fest;
  }

  did(what: string): boolean {
    return festivalToday(this.s) !== null && this.rec().done.includes(what);
  }

  private mark(what: string): void {
    this.rec().done.push(what);
  }

  today(): FestivalDef | null {
    return festivalToday(this.s);
  }

  now(): FestivalDef | null {
    return festivalNow(this.s);
  }

  /** Лавки закрыты весь праздничный день (кроме ярмарочного прилавка). */
  shopClosed(shop: string): boolean {
    return !!this.today() && shop !== 'fair';
  }

  /** Подземелье в праздник открывается только в 22:00. */
  dungeonLocked(): boolean {
    return !!this.today() && this.s.time.minutes < 22 * 60;
  }

  // ───── Сбор горожан ─────

  private spotsFor(def: FestivalDef): [number, number][] {
    const cached = this.spots.get(def.id);
    if (cached) return cached;
    const map = buildTownMap();
    const out: [number, number][] = [];
    const a = def.area;
    for (let y = a.y; y < a.y + a.h; y++)
      for (let x = a.x; x < a.x + a.w; x++) {
        if ((x + y) % 2 || map.solid(x, y)) continue;
        if (BUILDINGS.some((b) => inRect(b, x, y))) continue;
        if (def.id === 'spirits') {
          if (y === 11 || y === 14 || map.get(x, y) === Tile.FENCE || SPIRITS.some((sp) => sp.at[0] === x && sp.at[1] === y)) continue;
        } else if (PLAZA_FIXED.some((r) => inRect(r, x, y)) || inRect(LISTS, x, y)) continue;
        if (x === HOST_SPOT[def.id][0] && y === HOST_SPOT[def.id][1]) continue;
        out.push([x, y]);
      }
    const [cx, cy] = def.center;
    out.sort((p, q) => Math.hypot(p[0] - cx, p[1] - cy) - Math.hypot(q[0] - cx, q[1] - cy));
    this.spots.set(def.id, out);
    return out;
  }

  /** Куда идёт житель во время праздника (или null — обычное расписание). */
  placeFor(id: string): Place | null {
    const def = this.now();
    if (!def || npcDef(id).speakerOnly) return null;
    if (id === def.host) {
      const [x, y] = HOST_SPOT[def.id];
      return { scene: 'town', x, y, roam: 0, f: 0 };
    }
    const list = this.spotsFor(def);
    const others = scheduledNpcs().filter((n) => n !== def.host);
    const i = others.indexOf(id);
    const [x, y] = list[i % list.length]!;
    // зрители смотрят к центру праздника
    const f = y > def.center[1] ? 3 : 0;
    return { scene: 'town', x, y, roam: 0, f };
  }

  // ───── Украшения города ─────

  decorate(w: World): void {
    const def = this.today();
    if (!def) return;
    const at = (tx: number, ty: number, sprite: string, block = true) => {
      const p = new Prop(tx * TILE + 8, ty * TILE + 14, sprite, { block, hw: 5, hh: 3 });
      w.addNow(p);
      return p;
    };
    switch (def.id) {
      case 'tourney':
        for (const [x, y, c] of [[27, 15, '#c83a3a'], [35, 15, '#3a5aa8'], [27, 18, '#3a5aa8'], [35, 18, '#c83a3a']] as const) at(x, y, `banner:${c}`);
        break;
      case 'fair':
        for (const [x, y, c] of [[28, 23, '#c86ab0'], [33, 23, '#e0a030']] as const) {
          const st = new Prop(x * TILE + 16, y * TILE + 14, `stall:${c}`, { hw: 14, hh: 6 });
          st.blockRect(x, y, 2, 1);
          w.addNow(st);
        }
        for (const [x, y] of [[24, 16], [38, 16], [24, 23], [38, 23]] as const) at(x, y, 'pumpkins');
        for (const [x, y, c] of [[27, 15, '#e0a030'], [35, 15, '#3a8a4a']] as const) at(x, y, `banner:${c}`);
        break;
      case 'spirits':
        for (const [x, y] of [[5, 12], [9, 13], [13, 12], [18, 13], [4, 15], [11, 15], [19, 15]] as const) {
          const l = at(x, y, 'lantern', false);
          l.light = { r: 34, color: '#a8d8ff', power: 0.8, flicker: 0.15 };
        }
        for (const [x, y] of [[9, 17], [14, 17]] as const) {
          const p = at(x, y, 'pumpkins');
          p.light = { r: 22, color: '#ffa040', power: 0.6, flicker: 0.2 };
        }
        break;
      case 'feast': {
        const tbl = new Prop((FEAST_TABLE.x + FEAST_TABLE.w / 2) * TILE, (FEAST_TABLE.y + 1) * TILE - 1, 'feast_table', { hw: (FEAST_TABLE.w * TILE) / 2, hh: 6 });
        tbl.blockRect(FEAST_TABLE.x, FEAST_TABLE.y, FEAST_TABLE.w, FEAST_TABLE.h);
        tbl.light = { r: 60, color: '#ffc870', power: 0.7, flicker: 0.1 };
        tbl.interaction = {
          label: () => t(L('Сесть за общий стол', 'Sit at the shared table')),
          range: 6,
          enabled: () => !!this.now() && !this.did('feast_meal'),
          act: () => this.feastMeal(),
        };
        w.addNow(tbl);
        const fir = at(31, 23, 'fir');
        fir.light = { r: 40, color: '#ffe0a0', power: 0.7, flicker: 0.2 };
        break;
      }
    }
  }

  // ───── Каждый кадр ─────

  update(w: World, dt: number): void {
    if (w.kind !== 'town') return;
    this.updateSpirits(w);
    const d = this.duel;
    if (!d) return;
    if (d.wait > 0) {
      d.wait -= dt;
      if (d.wait <= 0) this.spawnRound(w);
      return;
    }
    if (d.foes.length && d.foes.every((f) => f.dead)) {
      if (d.round >= ROUNDS.length - 1) return this.winTourney();
      d.round++;
      d.foes = [];
      d.wait = 2.5;
      this.g.player.hp = Math.min(this.g.player.maxHp, this.g.player.hp + this.g.player.maxHp * 0.35);
      this.g.toast(t(L('Раунд за вами! Передышка…', 'Round won! Catch your breath…')), '#a0e0a0');
    }
  }

  /** Сила бойцов подстраивается под героя: «этаж» по его уровню и лучшему оружию. */
  private foeFloor(): number {
    const best = Math.max(...WEAPON_CLASSES.map((c) => classLevel(this.s.hero.classXp[c])));
    return Math.max(2, Math.round(this.s.hero.level * 1.6 + best * 0.5));
  }

  startTourney(): void {
    if (this.duel || this.did('tourney')) return;
    if (this.g.scene.kind !== 'town') return;
    this.mark('tourney');
    const p = this.g.player;
    p.x = (LISTS.x + 4) * TILE + 8;
    p.y = (LISTS.y + LISTS.h - 1) * TILE + 10;
    p.aim = -Math.PI / 2;
    p.hp = p.maxHp;
    this.duel = { round: 0, foes: [], wait: 2 };
    this.g.toast(t(L('Бран: «К барьеру! Бой до первой крови — ну, почти».', 'Bran: "To the lists! Fight to first blood — well, nearly."')), '#ffd080');
  }

  private spawnRound(w: World): void {
    const d = this.duel!;
    const r = ROUNDS[d.round]!;
    const floor = this.foeFloor();
    d.foes = r.foes.map((id, i) => {
      const e = new Enemy(id, (LISTS.x + 3 + i * 3) * TILE + 8, (LISTS.y) * TILE + 12, floor);
      w.add(e);
      return e;
    });
    this.g.toast(t(r.title), '#ffd080');
    w.fx({ t: 'sfx', id: 'roar' });
  }

  private winTourney(): void {
    const round = this.duel!.round;
    this.duel = null;
    void round;
    const cls: WeaponClass = WEAPON_CLASSES.reduce((a, c) => (this.s.hero.classXp[c] > this.s.hero.classXp[a] ? c : a), 'sword' as WeaponClass);
    const tier = Math.max(1, Math.min(7, Math.ceil(Math.max(1, this.s.dungeon.deepest) / 10)));
    const pool = Object.values(ITEMS).filter((d) => d.kind === 'weapon' && d.weapon?.cls === cls && d.tier === tier && !d.unique);
    const prize = pool.length ? makeItem(this.g.rng, pool[this.g.rng.int(0, pool.length - 1)]!.id, 2) : null;
    if (prize) this.g.giveItem(prize);
    this.g.giveGold(300);
    this.g.rep('watch', 12);
    this.s.flags[`tourney_won_${this.s.time.year}`] = true;
    this.s.stats.tourneys = (this.s.stats.tourneys ?? 0) + 1;
    this.g.world.fx({ t: 'sfx', id: 'levelup' });
    this.g.say('bran', [
      L('Годрик на песке! Вальмарк, вот ваш чемпион!', 'Godric is down! Valmark, behold your champion!'),
      L('Держите — оружие из арсенала Стражи и кошель от бургомистра. Заслужили.', 'Here — a weapon from the Watch armoury and a purse from the Mayor. You earned it.'),
    ]);
  }

  /** Герой упал на турнире — это поражение, а не смерть. */
  onPlayerDown(): boolean {
    if (!this.duel) return false;
    const round = this.duel.round;
    for (const f of this.duel.foes) if (!f.dead) this.g.world.remove(f);
    this.duel = null;
    const p = this.g.player;
    p.dead = false;
    p.state = 'free';
    p.hp = Math.round(p.maxHp * 0.3);
    p.invuln = 2;
    const purse = 40 * (round + 1);
    this.g.giveGold(purse);
    this.g.say('bran', [
      L('Лежите, лежите. Песок мягкий, я проверял.', "Stay down, stay down. The sand is soft, I've checked."),
      round >= 2
        ? L('Дошли до финала против Годрика — такого давно не было. Утешительный кошель ваш.', 'You reached the final against Godric — not seen in years. The consolation purse is yours.')
        : L('Для первого турнира — достойно. Держите утешительный кошель. На следующую весну — реванш.', 'A worthy first tourney. Take the consolation purse. Rematch next spring.'),
    ]);
    return true;
  }

  onSceneChange(): void {
    this.duel = null;
  }

  // ───── Ярмарка ─────

  /** Конкурс урожая: лучший продукт из рюкзака против соседей. */
  harvestContest(): void {
    if (this.did('contest')) return;
    const inv = this.s.inventory;
    let best = -1, bestScore = 0;
    inv.forEach((st, i) => {
      if (!st) return;
      const d = itemDef(st.def);
      if (d.kind !== 'food' && !d.tags?.some((x) => x === 'crop' || x === 'veg')) return;
      const score = d.price * (d.tags?.includes('crop') || d.tags?.includes('veg') ? 1.5 : 1);
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    });
    if (best < 0) {
      this.g.say('marta', [L('Выставлять-то нечего! Принесите овощ, пирог или хоть яблоко.', 'Nothing to show! Bring a vegetable, a pie, or at least an apple.')]);
      return;
    }
    this.mark('contest');
    const st = inv[best]!;
    const name = t(itemDef(st.def).name);
    st.qty--;
    if (st.qty <= 0) inv[best] = null;
    this.g.events.emit('inventory', undefined);
    const yearK = 1 + 0.35 * (this.s.time.year - 1);
    const rivals = [
      { npc: 'hanna', score: this.g.rng.range(40, 110) * yearK },
      { npc: 'veila', score: this.g.rng.range(30, 90) * yearK },
      { npc: 'borin', score: this.g.rng.range(20, 80) * yearK },
    ];
    const place = 1 + rivals.filter((r) => r.score > bestScore).length;
    const prize = [0, 500, 200, 80, 20][place]!;
    this.g.giveGold(prize);
    this.g.friendship('marta', place === 1 ? 120 : 40);
    if (place === 1) this.s.flags[`fair_won_${this.s.time.year}`] = true;
    const verdict: Record<number, Loc> = {
      1: L(`Первое место — ${name}! Даже Ханна аплодирует. Вот призовые, ${prize} золотом.`, `First place — the ${name}! Even Hanna is applauding. Here's the prize, ${prize} gold.`),
      2: L(`Второе место! ${name} — почти лучший на ярмарке. ${prize} золотом.`, `Second place! The ${name} was nearly the best at the fair. ${prize} gold.`),
      3: L(`Третье место. Не стыдно! ${prize} золотом.`, `Third place. Nothing to be ashamed of! ${prize} gold.`),
      4: L(`В этот раз без места. Утешительные ${prize} — на семена.`, `No place this time. A consolation ${prize} gold — for seeds.`),
    };
    this.g.say('marta', [L(`Судьи пробуют… ${name}…`, `The judges taste… the ${name}…`), verdict[place]!]);
  }

  /** Кольца на удачу: три броска за 20 золотых. */
  ringToss(): void {
    const h = this.s.hero;
    if (h.gold < 20) return this.g.toast(t(L('Недостаточно золота', 'Not enough gold')), '#ff8080');
    h.gold -= 20;
    const luck = this.g.stats().luck;
    let hits = 0;
    for (let i = 0; i < 3; i++) if (this.g.rng.chance(0.3 + luck * 0.01)) hits++;
    const prizes: [string, number][] = [['', 0], ['apple', 3], ['potion_heal', 1], ['silver_ribbon', 1]];
    const [item, qty] = prizes[hits]!;
    if (item) this.g.give(item, qty);
    this.g.toast(`${'◯'.repeat(hits)}${'·'.repeat(3 - hits)}  ${hits ? t(L('Приз!', 'A prize!')) : t(L('Мимо…', 'Missed…'))}`, hits ? '#ffd040' : '#c0a080');
  }

  // ───── Ночь духов ─────

  private updateSpirits(w: World): void {
    const on = this.now()?.id === 'spirits';
    const present = w.entities.filter((e): e is SpiritProp => e instanceof SpiritProp);
    if (on && !present.length) {
      for (const sp of SPIRITS) {
        const e = new SpiritProp(sp.at[0], sp.at[1], sp.id, this);
        w.add(e);
      }
    } else if (!on && present.length) for (const e of present) w.remove(e);
  }

  heard(id: string): boolean {
    return this.rec().heard.includes(id);
  }

  hearSpirit(id: string): void {
    const sp = SPIRITS.find((x) => x.id === id)!;
    const rec = this.rec();
    const first = !rec.heard.includes(id);
    if (first) rec.heard.push(id);
    const pages: Loc[] = [L(`${sp.name.ru}…`, `${sp.name.en}…`), sp.whisper];
    if (first && rec.heard.length === SPIRITS.length) {
      pages.push(L('Фонари вспыхивают разом. Четыре голоса сливаются в один: «Не повторяй».', 'The lanterns flare at once. Four voices merge into one: "Do not repeat it."'));
      this.g.say('founder_spirit', pages, () => this.spiritsReward());
    } else this.g.say('founder_spirit', pages);
  }

  private spiritsReward(): void {
    if (this.did('spirits')) return;
    this.mark('spirits');
    this.g.readLore('spirits_night');
    if (!this.s.flags.spirit_lantern) {
      this.s.flags.spirit_lantern = true;
      this.g.give('spirit_lantern');
    } else this.g.giveGold(250);
  }

  // ───── Зимний пир ─────

  private feastMeal(): void {
    if (this.did('feast_meal')) return;
    this.mark('feast_meal');
    this.s.hero.energy = this.s.hero.maxEnergy;
    this.g.addBuff('maxHp', 30, 900);
    this.g.addBuff('luck', 5, 900);
    this.g.world.fx({ t: 'sfx', id: 'eat' });
    this.g.toast(t(L('Жаркое, пироги и глинтвейн. Бодрость восстановлена, +30 здоровья и +5 удачи до конца дня.', 'Roast, pies and mulled wine. Energy restored, +30 health and +5 luck for the rest of the day.')), '#ffd0a0');
  }

  /** Тайный даритель: случайный житель, подарок которому сегодня ценится втрое. */
  secretGiver(): string | null {
    const rec = this.rec();
    if (rec.target) return rec.target;
    const pool = scheduledNpcs().filter((id) => id !== 'ogden' && !npcDef(id).speakerOnly);
    rec.target = pool[this.g.rng.int(0, pool.length - 1)]!;
    return rec.target;
  }

  giftMul(npc: string): number {
    return this.today()?.id === 'feast' && this.rec().target === npc ? 3 : 1;
  }

  /** Танец: с супругом(ой)/возлюбленным(ой) или с лучшим другом. */
  dance(): void {
    if (this.did('dance')) return;
    const rom = this.s.romance;
    const partner = rom.partner ?? scheduledNpcs().filter((id) => !npcDef(id).speakerOnly).sort((a, b) => hearts(this.s, b) - hearts(this.s, a))[0];
    if (!partner) return;
    this.mark('dance');
    this.g.friendship(partner, rom.partner === partner ? 200 : 100);
    const name = npcDef(partner).name;
    this.g.say(partner, [
      L(`${name.ru} берёт вас за руку. Эловиза играет «Снег над Вальмарком», и площадь кружится.`, `${name.en} takes your hand. Eloise plays "Snow over Valmark", and the plaza spins.`),
      rom.partner === partner
        ? L('Знаешь… Каждый год буду ждать этот танец.', "You know… I'll wait for this dance every year.")
        : L('Ты неплохо двигаешься для того, кто весь день лазает по склепам!', 'Not bad moves for someone who crawls through crypts all day!'),
    ]);
  }

  static all(): FestivalDef[] {
    return FESTIVALS;
  }
}

/** Дух Основателя: мерцающая фигура у фонарей. */
export class SpiritProp extends Prop {
  constructor(tx: number, ty: number, public spiritId: string, fest: Festivals) {
    super(tx * TILE + 8, ty * TILE + 14, 'spirit', { hw: 5, hh: 4 });
    this.light = { r: 30, color: '#c8e8ff', power: 0.7, flicker: 0.2 };
    this.interaction = {
      label: () => (fest.heard(spiritId) ? t(L('Слушать снова', 'Listen again')) : t(L('Слушать', 'Listen'))),
      act: () => fest.hearSpirit(spiritId),
    };
  }
}

import { AFFIX_BY_ID, affixScale } from '../../data/affixes';
import { ITEMS, itemDef } from '../../data/items';
import { EventBus } from '../../core/events';
import type { GameEvents } from '../../game/events';
import { Player } from '../../game/entities/player';
import { newGameState, type GameState } from '../../game/state';
import { computeStats } from '../../game/systems/stats';
import type { EquipSlot, ItemStack, Stats, WeaponClass } from '../../game/types';
import type { Fx } from '../../game/events';
import type { ItemDTO } from '../../online/protocol';
import type { GameApi } from '../../game/world';

/** Данные онлайн-героя, нужные симуляции. */
export interface SimHero {
  id: string;
  name: string;
  cls: WeaponClass;
  level: number;
  karma: number;
  classXp: Partial<Record<WeaponClass, number>>;
  talents: string[];
  equipment: ItemDTO[];
  guildTag?: string | null;
}

/** Эталон нормализации в рейтинге: ур. 30, серебро, аффиксы — середина диапазона яруса IV. */
export const REF_LEVEL = 30;
export const REF_TIER = 4;
const REF_METAL = 'silver';

function toStack(i: ItemDTO): ItemStack {
  return { uid: i.uid, def: i.def, qty: i.qty, rarity: i.rarity as 0, affixes: i.affixes, upgrade: i.upgrade };
}

/** Привести снаряжение к эталону: тип вещи и аффиксов сохраняется, сила — фиксированная. */
export function normalizeItem(i: ItemDTO): ItemDTO {
  const d = itemDef(i.def);
  let def = i.def;
  if (d.weapon) def = `${REF_METAL}_${d.weapon.cls}`;
  else if (d.armor && d.material !== 'leather') def = `${REF_METAL}_${d.armor.slot}`;
  if (!ITEMS[def]) def = i.def;
  return {
    ...i, def, upgrade: 0,
    affixes: i.affixes.map((a) => {
      const ad = AFFIX_BY_ID[a.id];
      if (!ad) return a;
      const v = ((ad.min + ad.max) / 2) * affixScale(REF_TIER, ad.frac);
      return { id: a.id, value: ad.frac ? Math.round(v * 1000) / 1000 : Math.round(v * 10) / 10 };
    }),
  };
}

export function heroState(h: SimHero, normalized: boolean): GameState {
  const s = newGameState(h.name, 1);
  s.hero.level = normalized ? REF_LEVEL : h.level;
  s.hero.classXp = { sword: 0, spear: 0, bow: 0, staff: 0, shield: 0, ...h.classXp };
  s.talents = [...h.talents];
  for (const i of h.equipment) {
    const it = normalized ? normalizeItem(i) : i;
    if (i.slot) s.equipment[i.slot as EquipSlot] = toStack(it);
  }
  const st = computeStats(s);
  s.hero.hp = Math.round(st.maxHp);
  s.hero.stamina = Math.round(st.maxStamina);
  s.hero.mana = Math.round(st.maxMana);
  return s;
}

/** Собирает эффекты мира, чтобы разослать их клиентам со снимком. */
export class FxSink {
  list: Fx[] = [];
  push(fx: Fx): void {
    // клиенту нужны только заметные эффекты; частицы пыли и тряску он дорисует сам
    if (fx.t === 'dust' || fx.t === 'shake' || fx.t === 'flash') return;
    if (this.list.length < 120) this.list.push(fx);
  }
  take(): Fx[] {
    const l = this.list;
    this.list = [];
    return l;
  }
}

const noop = () => {};

/** Минимальный «фасад игры» для мира на сервере и для каждого сетевого героя. */
export class NetGameApi implements GameApi {
  readonly events = new EventBus<GameEvents>();
  shopOpen = false;
  onDeath: () => void = noop;
  private cached: Stats | null = null;

  constructor(public state: GameState, fx: FxSink) {
    this.events.on('fx', (e) => fx.push(e));
  }

  stats(): Stats {
    return (this.cached ??= computeStats(this.state));
  }
  giveItem(): boolean {
    return false;
  }
  giveGold = noop;
  addXp = noop;
  addClassXp = noop;
  useEnergy(): boolean {
    return true;
  }
  onPlayerDeath(): void {
    this.onDeath();
  }
  toast = noop;
  goTo = noop;
  talk = noop;
  sleep = noop;
  readLore = noop;
  openElevator = noop;
  openShop = noop;
  descend = noop;
  ascendToTown = noop;
  bossDefeated = noop;
  setBoss = noop;
  markRunLoot = noop;
  openCrafting = noop;
  openStorage = noop;
  counter = noop;
  plotAction = noop;
  plotLabel(): string {
    return '';
  }
  openShopfront = noop;
}

/** Сетевой герой: обычный Player, но со своим фасадом и своим вводом. */
export class NetHero extends Player {
  readonly hero: SimHero;
  readonly api: NetGameApi;
  seq = 0;
  score = 0;
  /** Время последнего нападения на «синего» (фиолетовый флаг). */
  aggressedAt = -999;
  lastHitBy: NetHero | null = null;
  lastHitAt = -999;

  constructor(hero: SimHero, normalized: boolean, fx: FxSink) {
    const api = new NetGameApi(heroState(hero, normalized), fx);
    super(api);
    this.api = api;
    this.hero = hero;
    this.sprite = `hero:${hero.cls}`;
  }
}

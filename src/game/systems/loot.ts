import { AFFIXES, AFFIX_BY_ID, affixScale } from '../../data/affixes';
import { ITEMS, itemDef, type ItemDef } from '../../data/items';
import { t, tAdj, getLang } from '../../data/loc';
import { makeUid, type Rng } from '../../core/rng';
import type { Affix, ItemStack, Rarity } from '../types';

export const RARITY_NAMES = [
  { ru: 'Обычный', en: 'Common' },
  { ru: 'Редкий', en: 'Rare' },
  { ru: 'Эпический', en: 'Epic' },
  { ru: 'Легендарный', en: 'Legendary' },
];

/** Вероятности редкостей с учётом глубины, удачи и бонуса источника (сундук). */
export function rarityWeights(floor: number, luck: number, bonus = 0): [Rarity, number][] {
  const epic = 7 + 0.4 * floor + luck * 0.3 + bonus * 3;
  const leg = 1 + 0.08 * floor + luck * 0.05 + bonus * 0.8;
  const rare = 22 + luck * 0.5 + bonus * 6;
  const common = Math.max(5, 100 - rare - epic - leg - bonus * 10);
  return [[0, common], [1, rare], [2, epic], [3, leg]];
}

export function rollRarity(rng: Rng, floor: number, luck: number, bonus = 0, min: Rarity = 0): Rarity {
  const w = rarityWeights(floor, luck, bonus).filter(([r]) => r >= min);
  return rng.weighted(w);
}

const affixCount = (r: Rarity, rng: Rng) => (r === 0 ? 0 : r === 1 ? rng.int(1, 2) : r === 2 ? rng.int(2, 3) : 3);

export function rollAffixes(rng: Rng, def: ItemDef, rarity: Rarity): Affix[] {
  const n = affixCount(rarity, rng);
  const pool = AFFIXES.filter((a) => a.on.includes(def.kind));
  const out: Affix[] = [];
  let prefix = false, suffix = false;
  for (let i = 0; i < n * 4 && out.length < n; i++) {
    const a = rng.weighted(pool.map((p) => [p, p.weight] as const));
    if (out.some((o) => o.id === a.id)) continue;
    // один префикс и один суффикс дают имя, остальные — «скрытые» бонусы
    if (a.kind === 'prefix') prefix = true;
    if (a.kind === 'suffix') suffix = true;
    const scale = affixScale(Math.max(1, def.tier), a.frac);
    let v = rng.range(a.min, a.max) * scale;
    v = a.frac ? Math.round(v * 1000) / 1000 : Math.round(v * 10) / 10;
    out.push({ id: a.id, value: v });
  }
  void prefix; void suffix;
  return out;
}

export function makeItem(rng: Rng, def: string, rarity: Rarity = 0, qty = 1): ItemStack {
  const d = itemDef(def);
  const equip = d.kind === 'weapon' || d.kind === 'armor' || d.kind === 'accessory';
  const r: Rarity = equip ? rarity : 0;
  return { uid: makeUid(rng), def, qty, rarity: r, affixes: equip ? rollAffixes(rng, d, r) : [], upgrade: 0 };
}

/** Отображаемое имя с аффиксами: «Острый медный меч медведя». */
export function itemName(stack: ItemStack): string {
  const d = itemDef(stack.def);
  let base = t(d.name);
  const pre = stack.affixes.map((a) => AFFIX_BY_ID[a.id]).find((a) => a?.kind === 'prefix');
  const suf = stack.affixes.map((a) => AFFIX_BY_ID[a.id]).find((a) => a?.kind === 'suffix');
  if (pre?.adj) {
    const adjWord = tAdj(pre.adj, d.gender);
    base = getLang() === 'ru' ? `${adjWord} ${lowerFirst(base)}` : `${adjWord} ${base}`;
  }
  if (suf?.gen) base = `${base} ${t(suf.gen)}`;
  if (stack.upgrade > 0) base += ` +${stack.upgrade}`;
  return base;
}

function lowerFirst(s: string): string {
  // не опускаем регистр у имён собственных (второе слово с заглавной буквы — признак имени)
  return s.charAt(0).toLowerCase() + s.slice(1);
}

export function formatAffix(a: Affix): string {
  const def = AFFIX_BY_ID[a.id];
  if (!def) return a.id;
  const v = def.frac ? `${Math.round(a.value * 1000) / 10}%` : `${a.value}`;
  return `+${v}`;
}

/** Цена продажи торговцу (без динамики — её добавляет экономика). */
export function baseSellPrice(stack: ItemStack): number {
  const d = itemDef(stack.def);
  const rarityMul = [1, 2.5, 6, 15][stack.rarity]!;
  return Math.max(1, Math.round((d.price * rarityMul * (1 + 0.25 * stack.upgrade)) / 2));
}

// ───── Таблицы выпадения ─────

export interface DropContext {
  floor: number;
  tier: number;
  luck: number;
}

/** Случайный предмет экипировки подходящего яруса. */
export function rollEquipment(rng: Rng, ctx: DropContext, bonus = 0, minRarity: Rarity = 0): ItemStack {
  const tier = Math.max(1, Math.min(7, ctx.tier + (rng.chance(0.15) ? 1 : 0) - (rng.chance(0.2) ? 1 : 0)));
  const pool = Object.values(ITEMS).filter(
    (d) => (d.kind === 'weapon' || d.kind === 'armor' || d.kind === 'accessory') && !d.unique && (d.tier === tier || (d.kind === 'accessory' && d.tier <= tier)),
  );
  const def = rng.pick(pool);
  const rarity = rollRarity(rng, ctx.floor, ctx.luck, bonus, minRarity);
  return makeItem(rng, def.id, rarity);
}

/** Содержимое сундука. quality: 0 обычный, 1 редкий, 2 эпический. */
export function rollChest(rng: Rng, ctx: DropContext, quality: 0 | 1 | 2): { items: ItemStack[]; gold: number } {
  const items: ItemStack[] = [];
  const gold = Math.round(rng.range(8, 20) * (1 + ctx.floor * 0.25) * (1 + quality));
  items.push(rollEquipment(rng, ctx, quality * 2, quality as Rarity));
  const extra = rng.int(1, 2 + quality);
  for (let i = 0; i < extra; i++) {
    const r = rng.next();
    if (r < 0.35) items.push(makeItem(rng, ctx.tier >= 2 ? 'potion_heal' : 'potion_small', 0, 1));
    else if (r < 0.5) items.push(makeItem(rng, 'potion_stamina', 0, 1));
    else if (r < 0.75) {
      const bars = ['copper_bar', 'copper_bar', 'iron_bar', 'steel_bar', 'silver_bar', 'adamant_bar', 'obsidian', 'heartstone'];
      items.push(makeItem(rng, bars[Math.min(bars.length - 1, ctx.tier + (rng.chance(0.3) ? 1 : 0))]!, 0, rng.int(1, 2)));
    } else if (r < 0.9) items.push(makeItem(rng, 'bread', 0, rng.int(1, 3)));
    else items.push(rollEquipment(rng, ctx, quality));
  }
  return { items, gold };
}

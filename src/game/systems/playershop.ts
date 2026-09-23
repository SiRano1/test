import type { Rng } from '../../core/rng';
import { itemDef } from '../../data/items';
import { seasonMul } from '../../data/shops';
import type { GameState } from '../state';
import type { ItemStack } from '../types';
import { demand, recordSale } from './economy';
import { baseSellPrice } from './loot';

/** Своя лавка (GDD §11.3): витрины, цены, реакции покупателей, книга цен. */

export const DISPLAY_COUNT = 8;
export const SHOP_OPEN = 9 * 60;
export const SHOP_CLOSE = 17 * 60;

export type Reaction = 'cheap' | 'fair' | 'pricey' | 'robbery';

export const REACTION_ICON: Record<Reaction, { text: string; color: string }> = {
  cheap: { text: '♥♥', color: '#ff8ab0' },
  fair: { text: '✓', color: '#8fe08a' },
  pricey: { text: '…', color: '#ffd040' },
  robbery: { text: '✗', color: '#ff5050' },
};

export interface Display {
  stack: ItemStack;
  price: number;
}

export interface ShopState {
  displays: (Display | null)[];
  /** 0..100 — поток покупателей. */
  popularity: number;
  /** Книга цен: по предмету — лучшая «честная» цена и худшая «дорогая». */
  book: Record<string, { ok: number; high: number }>;
  sales: number;
  income: number;
}

export function newShopState(): ShopState {
  return { displays: new Array(DISPLAY_COUNT).fill(null), popularity: 10, book: {}, sales: 0, income: 0 };
}

/** Рыночная стоимость одной штуки (ориентир для покупателей). */
export function marketValue(s: GameState, stack: ItemStack): number {
  const d = itemDef(stack.def);
  return Math.max(2, Math.round(baseSellPrice(stack) * 1.8 * demand(s, stack.def) * seasonMul(d, s.time.season)));
}

/** Реакция покупателя: у каждого своя «справедливая цена» ±15 % от рыночной. */
export function reactTo(price: number, market: number, fairness: number): Reaction {
  const r = price / (market * fairness);
  if (r <= 0.85) return 'cheap';
  if (r <= 1.05) return 'fair';
  if (r <= 1.3) return 'pricey';
  return 'robbery';
}

export function willBuy(reaction: Reaction, rng: Rng): boolean {
  return reaction === 'cheap' || reaction === 'fair' || (reaction === 'pricey' && rng.chance(0.5));
}

/** Запомнить реакцию в книге цен. */
export function learnPrice(shop: ShopState, def: string, price: number, reaction: Reaction): void {
  const e = (shop.book[def] ??= { ok: 0, high: 0 });
  if (reaction === 'cheap' || reaction === 'fair') e.ok = Math.max(e.ok, price);
  else e.high = e.high ? Math.min(e.high, price) : price;
}

/** Популярность лавки: дешёвые и честные продажи поднимают, грабёж — роняет. */
export function popularityDelta(reaction: Reaction, bought: boolean): number {
  if (reaction === 'cheap') return 2;
  if (reaction === 'fair') return bought ? 1 : 0;
  if (reaction === 'pricey') return bought ? 0 : -1;
  return -3;
}

/** Продажа одной штуки с витрины. Возвращает выручку. */
export function sellFromDisplay(s: GameState, shop: ShopState, index: number): number {
  const d = shop.displays[index];
  if (!d) return 0;
  const price = d.price;
  d.stack.qty--;
  if (d.stack.qty <= 0) shop.displays[index] = null;
  s.hero.gold += price;
  shop.sales++;
  shop.income += price;
  recordSale(s, d.stack.def, 1);
  return price;
}

/** Интервал между покупателями (сек реального времени). */
export function customerInterval(popularity: number): number {
  return Math.max(3, 11 - popularity / 12);
}

export function isShopHours(s: GameState): boolean {
  return s.time.minutes >= SHOP_OPEN && s.time.minutes < SHOP_CLOSE;
}

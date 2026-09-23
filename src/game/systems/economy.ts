import { itemDef } from '../../data/items';
import { SHOPS, type ShopDef } from '../../data/shops';
import { hearts, type GameState } from '../state';
import type { ItemStack, Rarity } from '../types';
import { baseSellPrice } from './loot';

const RARITY_MUL = [1, 2.5, 6, 15];

export function demand(s: GameState, def: string): number {
  return s.economy.demand[def] ?? 1;
}

/** Скидка/надбавка от дружбы с торговцем: 1% за сердечко, до 10%. */
export function friendMul(s: GameState, npc: string): number {
  return Math.min(10, hearts(s, npc)) / 100;
}

export function sellPrice(s: GameState, stack: ItemStack, shop: ShopDef): number {
  const base = baseSellPrice(stack);
  return Math.max(1, Math.floor(base * shop.sellMul * demand(s, stack.def) * (1 + friendMul(s, shop.npc))));
}

export function buyPrice(s: GameState, def: string, shop: ShopDef, rarity: Rarity = 0): number {
  const d = itemDef(def);
  return Math.max(1, Math.round(d.price * RARITY_MUL[rarity]! * (1 - friendMul(s, shop.npc))));
}

/** Продажа снижает спрос на товар: −4% за единицу, минимум 40%. */
export function recordSale(s: GameState, def: string, qty: number): void {
  s.economy.demand[def] = Math.max(0.4, demand(s, def) - 0.04 * qty);
}

/** Ежедневное восстановление спроса (+10%). */
export function dailyEconomy(s: GameState): void {
  for (const k of Object.keys(s.economy.demand)) {
    const v = Math.min(1, s.economy.demand[k]! + 0.1);
    if (v >= 1) delete s.economy.demand[k];
    else s.economy.demand[k] = v;
  }
}

export function shopStock(s: GameState, shopId: string): string[] {
  const shop = SHOPS[shopId]!;
  return shop.stock.filter((i) => (i.deepest ?? 0) <= s.dungeon.deepest).map((i) => i.item);
}

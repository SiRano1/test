import { hashSeed, Rng } from '../../core/rng';
import { itemDef } from '../../data/items';
import { seasonMul, SHOPS, type ShopDef } from '../../data/shops';
import { hearts, type GameState } from '../state';
import type { ItemStack, Rarity } from '../types';
import { baseSellPrice, rollEquipment } from './loot';

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
  const d = itemDef(stack.def);
  const traders = s.factions.traders >= 50 ? 1.05 : 1;
  return Math.max(1, Math.floor(base * shop.sellMul * demand(s, stack.def) * seasonMul(d, s.time.season) * (1 + friendMul(s, shop.npc)) * traders));
}

export function buyPrice(s: GameState, def: string, shop: ShopDef, rarity: Rarity = 0): number {
  const d = itemDef(def);
  return Math.max(1, Math.round(d.price * RARITY_MUL[rarity]! * (1 - friendMul(s, shop.npc))));
}

/** Цена вещи из ротации (редкие вещи у Лис — дороже). */
export function rotatingPrice(s: GameState, stack: ItemStack, shop: ShopDef): number {
  return Math.round(baseSellPrice(stack) * 2 * 1.5 * (1 - friendMul(s, shop.npc)));
}

/** Продажа снижает спрос на товар: −4% за единицу, минимум 40%. */
export function recordSale(s: GameState, def: string, qty: number): void {
  s.economy.demand[def] = Math.max(0.4, demand(s, def) - 0.04 * qty);
}

/** Ежедневное восстановление спроса (+10%) и новая ротация. */
export function dailyEconomy(s: GameState): void {
  for (const k of Object.keys(s.economy.demand)) {
    const v = Math.min(1, s.economy.demand[k]! + 0.1);
    if (v >= 1) delete s.economy.demand[k];
    else s.economy.demand[k] = v;
  }
  const rng = new Rng(hashSeed(s.seed, 'fence', s.time.totalDays));
  const tier = Math.max(1, Math.min(7, Math.ceil(Math.max(1, s.dungeon.deepest) / 10)));
  s.economy.rotating = [];
  for (let i = 0; i < 4; i++) s.economy.rotating.push(rollEquipment(rng, { floor: Math.max(1, s.dungeon.deepest), tier, luck: 5 }, 3, 1));
}

export function shopStock(s: GameState, shopId: string): string[] {
  const shop = SHOPS[shopId]!;
  return shop.stock
    .filter((i) => (i.deepest ?? 0) <= s.dungeon.deepest && (!i.seasons || i.seasons.includes(s.time.season)) && (!i.rep || s.factions[i.rep[0]] >= i.rep[1]))
    .map((i) => i.item);
}

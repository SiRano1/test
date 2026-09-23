import { AFFIXES, affixScale } from '../../data/affixes';
import { itemDef, METALS } from '../../data/items';
import { RECIPES, type RecipeDef, type Station } from '../../data/recipes';
import type { Rng } from '../../core/rng';
import type { GameState } from '../state';
import type { ItemStack, Rarity } from '../types';
import { countItem } from './inventory';
import { rollAffixes } from './loot';

export function knownRecipes(s: GameState, station: Station): RecipeDef[] {
  return RECIPES.filter((r) => r.station === station && (r.known || s.recipes.includes(r.id)));
}

export function missingFor(s: GameState, r: RecipeDef): [string, number, number][] {
  const out: [string, number, number][] = [];
  for (const [id, need] of r.inputs) {
    const have = countItem(s.inventory, id);
    if (have < need) out.push([id, have, need]);
  }
  return out;
}

/** Редкость выкованной вещи: шанс растёт с уровнем героя. */
export function forgeRarity(rng: Rng, level: number): Rarity {
  const r = rng.next();
  const bonus = Math.min(0.1, level * 0.004);
  if (r < 0.02 + bonus / 3) return 2;
  if (r < 0.15 + bonus) return 1;
  return 0;
}

// ───────────── Услуги: заточка и зачарование ─────────────

export const SHARPEN_CHANCE = [1, 1, 1, 0.8, 0.6, 0.4];

export function sharpenCost(stack: ItemStack): { gold: number; bar: string; bars: number } | null {
  const d = itemDef(stack.def);
  if (!(d.kind === 'weapon' || d.kind === 'armor') || stack.upgrade >= 5) return null;
  const metal = METALS.find((m) => m.id === d.material);
  const bar = metal?.bar ?? 'copper_bar';
  return { gold: 60 * Math.max(1, d.tier) * (stack.upgrade + 1), bar, bars: stack.upgrade + 1 };
}

const MAX_AFFIX = [1, 2, 3, 3];

export function enchantCost(stack: ItemStack): number | null {
  const d = itemDef(stack.def);
  if (!(d.kind === 'weapon' || d.kind === 'armor' || d.kind === 'accessory')) return null;
  if (stack.affixes.length >= MAX_AFFIX[stack.rarity]!) return null;
  return 150 * Math.max(1, d.tier) * (stack.affixes.length + 1);
}

export function rerollCost(stack: ItemStack): number | null {
  const d = itemDef(stack.def);
  if (!(d.kind === 'weapon' || d.kind === 'armor' || d.kind === 'accessory') || stack.rarity === 0) return null;
  return 120 * Math.max(1, d.tier) * stack.rarity;
}

/** Добавить один случайный аффикс (обычная вещь становится редкой). */
export function addAffix(rng: Rng, stack: ItemStack): void {
  const d = itemDef(stack.def);
  const pool = AFFIXES.filter((a) => a.on.includes(d.kind) && !stack.affixes.some((x) => x.id === a.id));
  if (!pool.length) return;
  const a = rng.weighted(pool.map((p) => [p, p.weight] as const));
  const scale = affixScale(Math.max(1, d.tier), a.frac);
  let v = rng.range(a.min, a.max) * scale;
  v = a.frac ? Math.round(v * 1000) / 1000 : Math.round(v * 10) / 10;
  stack.affixes.push({ id: a.id, value: v });
  if (stack.rarity === 0) stack.rarity = 1;
}

export function rerollAffixes(rng: Rng, stack: ItemStack): void {
  const d = itemDef(stack.def);
  stack.affixes = rollAffixes(rng, d, stack.rarity);
}

import { ITEMS, itemDef } from '../../data/items';
import { makeUid } from '../../core/rng';
import type { ItemStack, Rarity } from '../types';

export function makeStack(def: string, qty = 1, rarity: Rarity = 0): ItemStack {
  if (!ITEMS[def]) throw new Error(`Unknown item ${def}`);
  return { uid: makeUid(), def, qty, rarity, affixes: [], upgrade: 0 };
}

/** Можно ли сложить два стака в одну ячейку. */
export function canStack(a: ItemStack, b: ItemStack): boolean {
  const d = itemDef(a.def);
  return a.def === b.def && d.stack > 1 && a.rarity === b.rarity && a.affixes.length === 0 && b.affixes.length === 0;
}

/**
 * Добавляет стак в контейнер. Мутирует `stack.qty` (остаток).
 * Возвращает количество добавленных единиц.
 */
export function addToContainer(slots: (ItemStack | null)[], stack: ItemStack): number {
  const d = itemDef(stack.def);
  const start = stack.qty;
  if (d.stack > 1) {
    for (const s of slots) {
      if (stack.qty <= 0) break;
      if (s && canStack(s, stack) && s.qty < d.stack) {
        const n = Math.min(d.stack - s.qty, stack.qty);
        s.qty += n;
        stack.qty -= n;
      }
    }
  }
  while (stack.qty > 0) {
    const i = slots.indexOf(null);
    if (i < 0) break;
    const n = Math.min(d.stack, stack.qty);
    slots[i] = { ...stack, uid: n === stack.qty ? stack.uid : makeUid(), qty: n, affixes: [...stack.affixes] };
    stack.qty -= n;
  }
  return start - stack.qty;
}

export function countItem(slots: (ItemStack | null)[], def: string): number {
  let n = 0;
  for (const s of slots) if (s && s.def === def) n += s.qty;
  return n;
}

/** Удаляет qty единиц предмета def. Возвращает true, если хватило. */
export function removeItem(slots: (ItemStack | null)[], def: string, qty: number): boolean {
  if (countItem(slots, def) < qty) return false;
  for (let i = slots.length - 1; i >= 0 && qty > 0; i--) {
    const s = slots[i];
    if (!s || s.def !== def) continue;
    const n = Math.min(s.qty, qty);
    s.qty -= n;
    qty -= n;
    if (s.qty <= 0) slots[i] = null;
  }
  return true;
}

export function freeSlots(slots: (ItemStack | null)[]): number {
  return slots.reduce((n, s) => n + (s ? 0 : 1), 0);
}

/** Сколько единиц def поместится. */
export function capacityFor(slots: (ItemStack | null)[], def: string): number {
  const d = itemDef(def);
  let n = freeSlots(slots) * d.stack;
  if (d.stack > 1) for (const s of slots) if (s && s.def === def && s.affixes.length === 0 && s.rarity === 0) n += d.stack - s.qty;
  return n;
}

export function sortContainer(slots: (ItemStack | null)[]): void {
  const kindOrder = ['weapon', 'armor', 'accessory', 'consumable', 'food', 'material', 'quest', 'seed', 'gift'];
  const items = slots.filter((s): s is ItemStack => !!s);
  items.sort((a, b) => {
    const da = itemDef(a.def), db = itemDef(b.def);
    return (
      kindOrder.indexOf(da.kind) - kindOrder.indexOf(db.kind) ||
      db.tier - da.tier ||
      b.rarity - a.rarity ||
      a.def.localeCompare(b.def)
    );
  });
  // слить совместимые стаки
  const merged: ItemStack[] = [];
  for (const it of items) {
    const last = merged[merged.length - 1];
    const d = itemDef(it.def);
    if (last && canStack(last, it) && last.qty < d.stack) {
      const n = Math.min(d.stack - last.qty, it.qty);
      last.qty += n;
      it.qty -= n;
      if (it.qty > 0) merged.push(it);
    } else merged.push(it);
  }
  for (let i = 0; i < slots.length; i++) slots[i] = merged[i] ?? null;
}

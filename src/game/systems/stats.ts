import { AFFIX_BY_ID } from '../../data/affixes';
import { itemDef } from '../../data/items';
import type { GameState } from '../state';
import { baseStats, EQUIP_SLOTS, type ItemStack, type Stats, type WeaponClass } from '../types';

/** Опыт до следующего уровня героя. */
export const xpToNext = (level: number) => Math.round(40 * Math.pow(level, 1.55));
/** Опыт до следующего уровня класса оружия. */
export const classXpToNext = (level: number) => Math.round(25 * Math.pow(level, 1.5));

export function classLevel(xp: number): number {
  let lvl = 1;
  while (lvl < 20 && xp >= classXpToNext(lvl)) {
    xp -= classXpToNext(lvl);
    lvl++;
  }
  return lvl;
}

/** Атака оружия с учётом заточки. */
export function weaponAtk(stack: ItemStack): number {
  const d = itemDef(stack.def);
  return (d.weapon?.atk ?? 0) * (1 + 0.08 * stack.upgrade);
}

export function applyItemStats(st: Stats, stack: ItemStack): void {
  const d = itemDef(stack.def);
  const up = 1 + 0.08 * stack.upgrade;
  if (d.armor) {
    st.def += d.armor.def * up;
    st.maxHp += d.armor.hp * up;
  }
  if (d.accessory) for (const [k, v] of Object.entries(d.accessory.stats)) (st as any)[k] += v as number;
  for (const a of stack.affixes) {
    const def = AFFIX_BY_ID[a.id];
    if (def) (st as any)[def.stat] += a.value;
  }
}

export interface Buff {
  stat: keyof Stats;
  value: number;
  t: number;
}

/** Итоговые характеристики героя: уровень + экипировка (кроме запасного оружия) + баффы. */
export function computeStats(s: GameState, buffs: Buff[] = []): Stats {
  const st = baseStats();
  const lvl = s.hero.level;
  st.maxHp += 8 * (lvl - 1);
  st.maxStamina += 2 * (lvl - 1);
  st.maxMana += 3 * (lvl - 1);
  st.dmgPct += 3 * (lvl - 1);
  for (const slot of EQUIP_SLOTS) {
    if (slot === 'weapon2') continue;
    const it = s.equipment[slot];
    if (it) applyItemStats(st, it);
  }
  const w = s.equipment.weapon;
  if (w) {
    st.atk = weaponAtk(w);
    const cls = itemDef(w.def).weapon!.cls;
    st.dmgPct += 2 * (classLevel(s.hero.classXp[cls]) - 1);
  } else st.atk = 4; // кулаки
  for (const b of buffs) (st as any)[b.stat] += b.value;
  st.crit = Math.min(0.75, st.crit);
  st.speed = Math.min(1.6, st.speed);
  return st;
}

export function weaponClassOf(s: GameState): WeaponClass | null {
  const w = s.equipment.weapon;
  return w ? itemDef(w.def).weapon!.cls : null;
}

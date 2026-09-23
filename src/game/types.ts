/** Общие игровые типы (без DOM). */

export type WeaponClass = 'sword' | 'spear' | 'bow' | 'staff' | 'shield';
export const WEAPON_CLASSES: WeaponClass[] = ['sword', 'spear', 'bow', 'staff', 'shield'];

export type EquipSlot = 'weapon' | 'weapon2' | 'head' | 'body' | 'feet' | 'amulet' | 'ring1' | 'ring2';
export const EQUIP_SLOTS: EquipSlot[] = ['weapon', 'weapon2', 'head', 'body', 'feet', 'amulet', 'ring1', 'ring2'];

export type Element = 'phys' | 'fire' | 'ice' | 'shock' | 'holy';

export type Rarity = 0 | 1 | 2 | 3;
export const RARITY_COLORS = ['#e8e2d0', '#5aa6ff', '#c07bff', '#ff9a2e'] as const;

export interface Stats {
  maxHp: number;
  maxStamina: number;
  maxMana: number;
  atk: number;
  def: number;
  /** 0..1 */
  crit: number;
  critMul: number;
  /** Множитель скорости бега. */
  speed: number;
  /** Множитель скорости атаки. */
  atkSpeed: number;
  knockback: number;
  /** Доля урона, возвращаемая в HP. */
  lifesteal: number;
  fire: number;
  ice: number;
  shock: number;
  holy: number;
  luck: number;
  /** HP в секунду. */
  regen: number;
  /** Доля отражённого урона. */
  thorns: number;
  staminaRegen: number;
  /** Бонус к урону в процентах (сумма аффиксов). */
  dmgPct: number;
}

export function baseStats(): Stats {
  return {
    maxHp: 100, maxStamina: 100, maxMana: 60, atk: 0, def: 0, crit: 0.05, critMul: 1.75,
    speed: 1, atkSpeed: 1, knockback: 1, lifesteal: 0, fire: 0, ice: 0, shock: 0, holy: 0,
    luck: 0, regen: 0, thorns: 0, staminaRegen: 35, dmgPct: 0,
  };
}

export interface Affix {
  id: string;
  value: number;
}

export interface ItemStack {
  uid: string;
  def: string;
  qty: number;
  rarity: Rarity;
  affixes: Affix[];
  /** Заточка +0..+5 */
  upgrade: number;
}

export type StatusId = 'bleed' | 'poison' | 'burn' | 'freeze' | 'stun' | 'slow';

import { adj, L, type AdjLoc, type Loc } from './loc';
import type { ItemKind } from './items';
import type { Stats } from '../game/types';

export interface AffixDef {
  id: string;
  kind: 'prefix' | 'suffix';
  /** Префикс — прилагательное (согласуется по роду), суффикс — родительный падеж. */
  adj?: AdjLoc;
  gen?: Loc;
  stat: keyof Stats;
  /** Диапазон значения на ярусе 1; масштабируется по ярусу. */
  min: number;
  max: number;
  /** Если true — значение в процентах (0.05 = 5%). */
  frac?: boolean;
  /** Какие виды предметов могут получить аффикс. */
  on: ItemKind[];
  weight: number;
}

const W: ItemKind[] = ['weapon'];
const A: ItemKind[] = ['armor', 'accessory'];
const ALL: ItemKind[] = ['weapon', 'armor', 'accessory'];

export const AFFIXES: AffixDef[] = [
  // префиксы
  { id: 'sharp', kind: 'prefix', adj: adj('Остр', 'ый', 'ая', 'ое', 'ые', 'Sharp'), stat: 'dmgPct', min: 5, max: 12, on: W, weight: 10 },
  { id: 'heavy', kind: 'prefix', adj: adj('Тяжёл', 'ый', 'ая', 'ое', 'ые', 'Heavy'), stat: 'knockback', min: 0.2, max: 0.5, on: W, weight: 6 },
  { id: 'blazing', kind: 'prefix', adj: adj('Пылающ', 'ий', 'ая', 'ее', 'ие', 'Blazing'), stat: 'fire', min: 2, max: 5, on: W, weight: 6 },
  { id: 'frozen', kind: 'prefix', adj: adj('Ледян', 'ой', 'ая', 'ое', 'ые', 'Frozen'), stat: 'ice', min: 2, max: 5, on: W, weight: 6 },
  { id: 'thunder', kind: 'prefix', adj: adj('Громов', 'ой', 'ая', 'ое', 'ые', 'Thundering'), stat: 'shock', min: 2, max: 6, on: W, weight: 5 },
  { id: 'vampiric', kind: 'prefix', adj: adj('Кровожадн', 'ый', 'ая', 'ое', 'ые', 'Vampiric'), stat: 'lifesteal', min: 0.02, max: 0.05, frac: true, on: W, weight: 4 },
  { id: 'swift', kind: 'prefix', adj: adj('Быстр', 'ый', 'ая', 'ое', 'ые', 'Swift'), stat: 'atkSpeed', min: 0.05, max: 0.12, frac: true, on: W, weight: 6 },
  { id: 'holy', kind: 'prefix', adj: adj('Свят', 'ой', 'ая', 'ое', 'ые', 'Holy'), stat: 'holy', min: 3, max: 7, on: W, weight: 5 },
  { id: 'precise', kind: 'prefix', adj: adj('Точн', 'ый', 'ая', 'ое', 'ые', 'Precise'), stat: 'crit', min: 0.03, max: 0.07, frac: true, on: W, weight: 7 },
  { id: 'sturdy', kind: 'prefix', adj: adj('Прочн', 'ый', 'ая', 'ое', 'ые', 'Sturdy'), stat: 'def', min: 2, max: 5, on: A, weight: 10 },
  { id: 'nimble', kind: 'prefix', adj: adj('Лёгк', 'ий', 'ая', 'ое', 'ие', 'Nimble'), stat: 'speed', min: 0.03, max: 0.07, frac: true, on: A, weight: 6 },
  // суффиксы
  { id: 'bear', kind: 'suffix', gen: L('медведя', 'of the Bear'), stat: 'maxHp', min: 8, max: 20, on: ALL, weight: 10 },
  { id: 'fox', kind: 'suffix', gen: L('лиса', 'of the Fox'), stat: 'crit', min: 0.02, max: 0.05, frac: true, on: ALL, weight: 7 },
  { id: 'owl', kind: 'suffix', gen: L('совы', 'of the Owl'), stat: 'maxMana', min: 10, max: 25, on: ALL, weight: 6 },
  { id: 'wind', kind: 'suffix', gen: L('ветра', 'of the Wind'), stat: 'speed', min: 0.03, max: 0.08, frac: true, on: ALL, weight: 6 },
  { id: 'resolve', kind: 'suffix', gen: L('стойкости', 'of Resolve'), stat: 'def', min: 2, max: 6, on: ALL, weight: 9 },
  { id: 'fortune', kind: 'suffix', gen: L('удачи', 'of Fortune'), stat: 'luck', min: 2, max: 6, on: ALL, weight: 6 },
  { id: 'hedgehog', kind: 'suffix', gen: L('ежа', 'of the Hedgehog'), stat: 'thorns', min: 0.05, max: 0.15, frac: true, on: A, weight: 4 },
  { id: 'dawn', kind: 'suffix', gen: L('рассвета', 'of Dawn'), stat: 'regen', min: 0.3, max: 0.8, on: ALL, weight: 5 },
  { id: 'endurance', kind: 'suffix', gen: L('выносливости', 'of Endurance'), stat: 'maxStamina', min: 8, max: 20, on: ALL, weight: 8 },
];

export const AFFIX_BY_ID: Record<string, AffixDef> = Object.fromEntries(AFFIXES.map((a) => [a.id, a]));

/** Масштаб значения аффикса по ярусу предмета: плоские растут сильнее, процентные — слабее. */
export const affixScale = (tier: number, frac = false) => 1 + (frac ? 0.1 : 0.3) * Math.max(0, tier - 1);

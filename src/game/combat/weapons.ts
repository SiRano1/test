import { L, type Loc } from '../../data/loc';
import type { Element, WeaponClass } from '../types';

export interface SwingDef {
  /** Множитель урона. */
  mult: number;
  windup: number;
  active: number;
  recover: number;
  /** Радиус дуги (px). */
  r: number;
  /** Полуугол дуги (рад). */
  half: number;
  /** Шаг вперёд во время удара (px). */
  step: number;
  stamina: number;
  knock: number;
}

export type HeavyKind = 'arc' | 'lunge' | 'slam' | 'shot' | 'orb';

export interface SkillDef {
  id: string;
  name: Loc;
  desc: Loc;
  cd: number;
  stamina: number;
  mana: number;
}

export interface WeaponProfile {
  combo: SwingDef[];
  heavy: SwingDef & { kind: HeavyKind };
  /** Дальнобойное оружие: лёгкая атака — снаряд. */
  ranged?: 'arrow' | 'bolt';
  projSpeed?: number;
  /** Расход маны на лёгкий выстрел посоха. */
  mana?: number;
  blockRatio: number;
  parry: number;
  skill: SkillDef;
  color: string;
}

const s = (mult: number, windup: number, active: number, recover: number, r: number, half: number, step: number, stamina: number, knock: number): SwingDef => ({
  mult, windup, active, recover, r, half, step, stamina, knock,
});

export const WEAPON_PROFILES: Record<WeaponClass | 'fist', WeaponProfile> = {
  sword: {
    combo: [s(1, 0.07, 0.1, 0.2, 24, 1.15, 5, 10, 90), s(1.05, 0.06, 0.1, 0.2, 24, 1.15, 5, 10, 90), s(1.45, 0.09, 0.12, 0.32, 27, 1.35, 8, 14, 190)],
    heavy: { ...s(2.2, 0.06, 0.14, 0.36, 31, 2.4, 6, 24, 220), kind: 'arc' },
    blockRatio: 0.6, parry: 0.15, color: '#f0f0ff',
    skill: { id: 'whirl', name: L('Вихрь', 'Whirlwind'), desc: L('Круговой удар, дважды ранящий всех вокруг.', 'A spinning strike that hits everything around twice.'), cd: 5, stamina: 28, mana: 0 },
  },
  spear: {
    combo: [s(1, 0.09, 0.1, 0.24, 36, 0.36, 9, 11, 110), s(1.3, 0.09, 0.12, 0.32, 39, 0.36, 12, 13, 170)],
    heavy: { ...s(2, 0.08, 0.24, 0.36, 22, 0.9, 0, 24, 200), kind: 'lunge' },
    blockRatio: 0.55, parry: 0.15, color: '#e0f0ff',
    skill: { id: 'throw', name: L('Бросок копья', 'Spear Throw'), desc: L('Бросает копьё, пронзающее врагов насквозь.', 'Hurls a spear that pierces through enemies.'), cd: 5, stamina: 20, mana: 0 },
  },
  shield: {
    combo: [s(1.15, 0.12, 0.1, 0.28, 23, 1.2, 4, 12, 140), s(1.55, 0.13, 0.12, 0.36, 25, 1.3, 6, 15, 230)],
    heavy: { ...s(2.4, 0.1, 0.12, 0.45, 36, Math.PI, 0, 28, 240), kind: 'slam' },
    blockRatio: 0.85, parry: 0.22, color: '#fff0c0',
    skill: { id: 'bash', name: L('Удар щитом', 'Shield Bash'), desc: L('Рывок со щитом, оглушающий врагов.', 'A shield charge that stuns enemies.'), cd: 5, stamina: 20, mana: 0 },
  },
  bow: {
    combo: [s(0.85, 0.12, 0.02, 0.22, 0, 0, 0, 6, 60)],
    heavy: { ...s(2.3, 0.05, 0.02, 0.3, 0, 0, 0, 14, 160), kind: 'shot' },
    ranged: 'arrow', projSpeed: 260, blockRatio: 0.45, parry: 0.12, color: '#e0d0a0',
    skill: { id: 'triple', name: L('Тройной выстрел', 'Triple Shot'), desc: L('Три стрелы веером.', 'Three arrows in a fan.'), cd: 4, stamina: 16, mana: 0 },
  },
  staff: {
    combo: [s(1, 0.12, 0.02, 0.26, 0, 0, 0, 0, 70)],
    heavy: { ...s(2.4, 0.06, 0.02, 0.4, 0, 0, 0, 0, 180), kind: 'orb' },
    ranged: 'bolt', projSpeed: 200, mana: 6, blockRatio: 0.5, parry: 0.15, color: '#c0a0ff',
    skill: { id: 'burst', name: L('Стихийный взрыв', 'Elemental Burst'), desc: L('Взрыв стихии вокруг героя.', 'An elemental blast around the hero.'), cd: 6, stamina: 0, mana: 25 },
  },
  fist: {
    combo: [s(1, 0.06, 0.08, 0.18, 16, 1, 3, 6, 60), s(1.2, 0.06, 0.08, 0.26, 16, 1, 4, 8, 110)],
    heavy: { ...s(1.8, 0.06, 0.1, 0.35, 18, 1.2, 4, 16, 160), kind: 'arc' },
    blockRatio: 0.3, parry: 0.12, color: '#ffffff',
    skill: { id: 'none', name: L('—', '—'), desc: L('', ''), cd: 1, stamina: 999, mana: 0 },
  },
};

export const HEAVY_MANA = 16;

/** Стихия посоха зависит от материала. */
export function staffElement(material: string | undefined): Element {
  switch (material) {
    case 'copper': case 'obsidian': return 'fire';
    case 'iron': case 'adamant': return 'ice';
    case 'steel': return 'shock';
    case 'silver': case 'heart': return 'holy';
    default: return 'phys';
  }
}

export const ELEMENT_COLORS: Record<Element, string> = {
  phys: '#e0e0e0', fire: '#ff8a30', ice: '#8ad8ff', shock: '#f0f060', holy: '#fff0a0',
};

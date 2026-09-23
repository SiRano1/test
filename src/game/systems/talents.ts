import { TALENTS, TALENT_BY_ID, type TalentDef } from '../../data/talents';
import type { GameState } from '../state';
import type { WeaponClass } from '../types';
import { classLevel } from './stats';

/** Очки талантов класса: уровень класса − 1 минус потраченные. */
export function talentPoints(s: GameState, cls: WeaponClass): { total: number; spent: number; free: number } {
  const total = classLevel(s.hero.classXp[cls]) - 1;
  const spent = s.talents.reduce((n, id) => (TALENT_BY_ID[id]?.cls === cls ? n + TALENT_BY_ID[id].tier : n), 0);
  return { total, spent, free: total - spent };
}

export function hasTalent(s: GameState, id: string): boolean {
  return s.talents.includes(id);
}

/** Почему нельзя изучить талант (или null, если можно). */
export function talentBlock(s: GameState, id: string): 'unknown' | 'owned' | 'points' | 'prereq' | null {
  const d = TALENT_BY_ID[id];
  if (!d) return 'unknown';
  if (hasTalent(s, id)) return 'owned';
  if (d.tier > 1 && !s.talents.some((x) => TALENT_BY_ID[x]?.cls === d.cls && TALENT_BY_ID[x].tier === d.tier - 1)) return 'prereq';
  if (talentPoints(s, d.cls).free < d.tier) return 'points';
  return null;
}

export function learnTalent(s: GameState, id: string): boolean {
  if (talentBlock(s, id)) return false;
  s.talents.push(id);
  return true;
}

/** Сбросить таланты класса (за плату в игре). */
export function resetTalents(s: GameState, cls: WeaponClass): number {
  const before = s.talents.length;
  s.talents = s.talents.filter((id) => TALENT_BY_ID[id]?.cls !== cls);
  return before - s.talents.length;
}

/** Изученные таланты класса, которые дают прибавку к характеристикам. */
export function activeTalents(s: GameState, cls: WeaponClass | null): TalentDef[] {
  if (!cls) return [];
  return s.talents.map((id) => TALENT_BY_ID[id]).filter((d): d is TalentDef => !!d && d.cls === cls);
}

export function talentsOf(cls: WeaponClass): TalentDef[] {
  return TALENTS.filter((d) => d.cls === cls);
}

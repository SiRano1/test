import { L, type Loc } from './loc';
import type { Element, StatusId } from '../game/types';

export type AiKind = 'melee' | 'ranged' | 'flyer' | 'charger' | 'caster' | 'boss';

export interface AttackDef {
  id: string;
  kind: 'arc' | 'lunge' | 'projectile' | 'nova' | 'summon' | 'slam';
  /** Множитель атаки монстра. */
  dmg: number;
  /** С какой дистанции (px) монстр начинает эту атаку. */
  range: number;
  minRange?: number;
  radius?: number;
  /** Полуугол дуги (рад). */
  arc?: number;
  windup: number;
  active: number;
  recover: number;
  cooldown: number;
  projSpeed?: number;
  projSprite?: string;
  projCount?: number;
  spread?: number;
  lungeSpeed?: number;
  element?: Element;
  status?: { id: StatusId; chance: number; duration: number };
  summon?: { id: string; count: number; max: number };
  weight?: number;
  /** Нельзя заблокировать. */
  unblockable?: boolean;
}

export interface MonsterDef {
  id: string;
  name: Loc;
  sprite: string;
  tier: number;
  hp: number;
  atk: number;
  def: number;
  speed: number;
  xp: number;
  gold: [number, number];
  hw: number;
  hh: number;
  flyer?: boolean;
  /** 0..1 — шанс проигнорировать оглушение от лёгкого удара. */
  poise: number;
  /** Сопротивление отбрасыванию (1 = обычное). */
  mass: number;
  ai: AiKind;
  /** Радиус агро (тайлы). */
  aggro: number;
  keepDistance?: number;
  attacks: AttackDef[];
  drops: [item: string, chance: number, min: number, max: number][];
  undead?: boolean;
  resist?: Partial<Record<Element, number>>;
  elite?: boolean;
  boss?: boolean;
  light?: { r: number; color: string };
  /** Стоимость в бюджете угрозы этажа. */
  threat: number;
}

export const MONSTERS: Record<string, MonsterDef> = {};
const add = (m: MonsterDef) => (MONSTERS[m.id] = m);

export function monsterDef(id: string): MonsterDef {
  const m = MONSTERS[id];
  if (!m) throw new Error(`Unknown monster ${id}`);
  return m;
}

// ───────────── Ярус I — Катакомбы ─────────────

add({
  id: 'skeleton', name: L('Скелет', 'Skeleton'), sprite: 'skeleton', tier: 1,
  hp: 26, atk: 7, def: 2, speed: 40, xp: 8, gold: [1, 4], hw: 5, hh: 3, poise: 0, mass: 1,
  ai: 'melee', aggro: 7, undead: true, threat: 2,
  attacks: [{ id: 'slash', kind: 'arc', dmg: 1, range: 20, radius: 22, arc: 1.1, windup: 0.5, active: 0.12, recover: 0.55, cooldown: 0.6 }],
  drops: [['bone', 0.45, 1, 2], ['rag', 0.15, 1, 1], ['potion_small', 0.03, 1, 1]],
});

add({
  id: 'skeleton_archer', name: L('Скелет-лучник', 'Skeleton Archer'), sprite: 'skeleton_archer', tier: 1,
  hp: 20, atk: 6, def: 1, speed: 36, xp: 10, gold: [2, 5], hw: 5, hh: 3, poise: 0, mass: 0.9,
  ai: 'ranged', aggro: 9, keepDistance: 72, undead: true, threat: 3,
  attacks: [{ id: 'shoot', kind: 'projectile', dmg: 1, range: 150, windup: 0.7, active: 0.05, recover: 0.6, cooldown: 1.4, projSpeed: 150, projSprite: 'arrow' }],
  drops: [['bone', 0.4, 1, 2], ['wood', 0.2, 1, 2]],
});

add({
  id: 'grave_rat', name: L('Могильная крыса', 'Grave Rat'), sprite: 'rat', tier: 1,
  hp: 12, atk: 4, def: 0, speed: 62, xp: 4, gold: [0, 2], hw: 4, hh: 3, poise: 0, mass: 0.7,
  ai: 'melee', aggro: 6, threat: 1,
  attacks: [{ id: 'bite', kind: 'lunge', dmg: 1, range: 34, windup: 0.35, active: 0.22, recover: 0.5, cooldown: 0.5, lungeSpeed: 170, status: { id: 'poison', chance: 0.15, duration: 4 } }],
  drops: [['grave_moss', 0.2, 1, 1]],
});

add({
  id: 'bat', name: L('Нетопырь', 'Bat'), sprite: 'bat', tier: 1,
  hp: 10, atk: 4, def: 0, speed: 58, xp: 4, gold: [0, 2], hw: 4, hh: 3, poise: 0, mass: 0.6, flyer: true,
  ai: 'flyer', aggro: 8, threat: 1,
  attacks: [{ id: 'swoop', kind: 'lunge', dmg: 1, range: 46, windup: 0.4, active: 0.28, recover: 0.6, cooldown: 0.8, lungeSpeed: 190 }],
  drops: [['bat_wing', 0.35, 1, 1]],
});

add({
  id: 'bone_knight', name: L('Костяной рыцарь', 'Bone Knight'), sprite: 'bone_knight', tier: 1,
  hp: 90, atk: 9, def: 5, speed: 34, xp: 32, gold: [10, 25], hw: 6, hh: 4, poise: 0.8, mass: 2.2,
  ai: 'melee', aggro: 8, undead: true, elite: true, threat: 6,
  attacks: [
    { id: 'cleave', kind: 'arc', dmg: 1.2, range: 24, radius: 28, arc: 1.4, windup: 0.75, active: 0.15, recover: 0.7, cooldown: 0.8, weight: 3 },
    { id: 'charge', kind: 'lunge', dmg: 1.5, range: 90, minRange: 40, windup: 0.8, active: 0.4, recover: 0.9, cooldown: 3, lungeSpeed: 200, weight: 1 },
  ],
  drops: [['bone', 1, 2, 4], ['copper_bar', 0.3, 1, 1], ['potion_small', 0.3, 1, 1]],
});

add({
  id: 'bone_abbot', name: L('Костяной Настоятель', 'The Bone Abbot'), sprite: 'bone_abbot', tier: 1,
  hp: 520, atk: 15, def: 5, speed: 38, xp: 300, gold: [150, 220], hw: 8, hh: 5, poise: 1, mass: 6,
  ai: 'boss', aggro: 20, undead: true, boss: true, threat: 0,
  light: { r: 40, color: '#8fd0ff' },
  attacks: [
    { id: 'staff', kind: 'arc', dmg: 1.1, range: 28, radius: 34, arc: 1.3, windup: 0.65, active: 0.15, recover: 0.6, cooldown: 0.5, weight: 3 },
    { id: 'summon', kind: 'summon', dmg: 0, range: 400, windup: 1.0, active: 0.1, recover: 0.8, cooldown: 9, summon: { id: 'skeleton', count: 2, max: 4 }, weight: 1 },
    { id: 'bones', kind: 'projectile', dmg: 0.8, range: 180, minRange: 50, windup: 0.8, active: 0.1, recover: 0.7, cooldown: 3.5, projSpeed: 120, projSprite: 'bone_shard', projCount: 5, spread: 0.9, weight: 2 },
    { id: 'nova', kind: 'nova', dmg: 1.3, range: 60, radius: 64, windup: 1.1, active: 0.25, recover: 1.0, cooldown: 7, weight: 0, unblockable: true },
  ],
  drops: [['shard_1', 1, 1, 1], ['copper_bar', 1, 2, 4], ['potion_heal', 1, 1, 2]],
});

// ───────────── Ярус II — Затопленные шахты ─────────────

add({
  id: 'leech', name: L('Слизень-пиявка', 'Leech Slime'), sprite: 'slime', tier: 2,
  hp: 40, atk: 10, def: 2, speed: 34, xp: 10, gold: [2, 6], hw: 6, hh: 4, poise: 0, mass: 1.2,
  ai: 'melee', aggro: 6, threat: 2,
  attacks: [{ id: 'hop', kind: 'lunge', dmg: 1, range: 40, windup: 0.55, active: 0.3, recover: 0.6, cooldown: 0.8, lungeSpeed: 130, status: { id: 'slow', chance: 0.4, duration: 2 } }],
  drops: [['leech_slime', 0.5, 1, 2]],
});

add({
  id: 'drowned', name: L('Утопленник', 'Drowned'), sprite: 'drowned', tier: 2,
  hp: 55, atk: 12, def: 3, speed: 38, xp: 13, gold: [3, 8], hw: 5, hh: 3, poise: 0.2, mass: 1.2,
  ai: 'melee', aggro: 7, undead: true, threat: 3,
  attacks: [{ id: 'claw', kind: 'arc', dmg: 1, range: 22, radius: 24, arc: 1.2, windup: 0.5, active: 0.12, recover: 0.5, cooldown: 0.6 }],
  drops: [['rag', 0.3, 1, 1], ['pearl', 0.05, 1, 1], ['iron_ore', 0.25, 1, 2]],
});

add({
  id: 'cave_crab', name: L('Пещерный краб', 'Cave Crab'), sprite: 'crab', tier: 2,
  hp: 60, atk: 11, def: 10, speed: 30, xp: 14, gold: [2, 6], hw: 6, hh: 4, poise: 0.5, mass: 1.6,
  ai: 'charger', aggro: 7, threat: 3,
  attacks: [{ id: 'rush', kind: 'lunge', dmg: 1.2, range: 110, minRange: 20, windup: 0.7, active: 0.5, recover: 1.1, cooldown: 1.5, lungeSpeed: 180 }],
  drops: [['crab_shell', 0.55, 1, 2]],
});

add({
  id: 'loyalist', name: L('Шахтёр-лоялист', 'Loyalist Miner'), sprite: 'ghost', tier: 2,
  hp: 130, atk: 12, def: 5, speed: 40, xp: 45, gold: [15, 30], hw: 5, hh: 4, poise: 0.8, mass: 2, flyer: true,
  ai: 'melee', aggro: 9, undead: true, elite: true, threat: 6, light: { r: 26, color: '#7fd0c0' },
  attacks: [
    { id: 'pick', kind: 'arc', dmg: 1.3, range: 24, radius: 28, arc: 1.2, windup: 0.6, active: 0.15, recover: 0.6, cooldown: 0.6, weight: 3 },
    { id: 'wail', kind: 'nova', dmg: 0.9, range: 50, radius: 56, windup: 0.9, active: 0.2, recover: 0.8, cooldown: 5, weight: 1 },
  ],
  drops: [['iron_bar', 0.4, 1, 1], ['pearl', 0.25, 1, 1], ['potion_heal', 0.2, 1, 1]],
});

add({
  id: 'gorm', name: L('Старшина Горм, Утопленник', 'Foreman Gorm, the Drowned'), sprite: 'gorm', tier: 2,
  hp: 850, atk: 16, def: 7, speed: 40, xp: 550, gold: [260, 360], hw: 9, hh: 6, poise: 1, mass: 7,
  ai: 'boss', aggro: 20, undead: true, boss: true, threat: 0, light: { r: 36, color: '#6ab0c0' },
  attacks: [
    { id: 'pickaxe', kind: 'arc', dmg: 1.2, range: 30, radius: 36, arc: 1.2, windup: 0.7, active: 0.15, recover: 0.6, cooldown: 0.5, weight: 3 },
    { id: 'wave', kind: 'projectile', dmg: 1, range: 220, minRange: 40, windup: 0.9, active: 0.1, recover: 0.8, cooldown: 4, projSpeed: 110, projSprite: 'wave', projCount: 3, spread: 0.5, weight: 2 },
    { id: 'rockfall', kind: 'slam', dmg: 1.4, range: 400, radius: 20, windup: 1.2, active: 0.2, recover: 0.8, cooldown: 8, weight: 1, unblockable: true },
  ],
  drops: [['shard_2', 1, 1, 1], ['iron_bar', 1, 3, 5], ['pearl', 1, 1, 3]],
});

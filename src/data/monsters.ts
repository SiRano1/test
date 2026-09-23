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
  status?: { id: StatusId; chance: number; duration: number; power?: number };
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

// ───────────── Ярус III — Грибной лес ─────────────

add({
  id: 'sporeling', name: L('Спорник', 'Sporeling'), sprite: 'sporeling', tier: 3,
  hp: 70, atk: 15, def: 6, speed: 34, xp: 18, gold: [4, 10], hw: 5, hh: 4, poise: 0.2, mass: 1.2,
  ai: 'ranged', aggro: 8, keepDistance: 60, threat: 3,
  attacks: [
    { id: 'spore', kind: 'projectile', dmg: 0.9, range: 130, windup: 0.7, active: 0.1, recover: 0.7, cooldown: 1.6, projSpeed: 110, projSprite: 'spore', status: { id: 'slow', chance: 0.5, duration: 2 } },
    { id: 'bonk', kind: 'arc', dmg: 1, range: 22, radius: 22, arc: 1.2, windup: 0.5, active: 0.12, recover: 0.5, cooldown: 1 },
  ],
  drops: [['spores', 0.5, 1, 2], ['glowshroom', 0.1, 1, 1]],
});
add({
  id: 'shroom_runner', name: L('Грибной бегун', 'Shroom Runner'), sprite: 'shroom_runner', tier: 3,
  hp: 45, atk: 13, def: 3, speed: 70, xp: 14, gold: [2, 7], hw: 4, hh: 3, poise: 0, mass: 0.8,
  ai: 'melee', aggro: 8, threat: 2,
  attacks: [{ id: 'ram', kind: 'lunge', dmg: 1, range: 50, windup: 0.4, active: 0.3, recover: 0.6, cooldown: 0.8, lungeSpeed: 190 }],
  drops: [['spores', 0.4, 1, 1], ['glowshroom', 0.08, 1, 1]],
});
add({
  id: 'glow_spider', name: L('Паук-светляк', 'Glow Spider'), sprite: 'spider', tier: 3,
  hp: 55, atk: 14, def: 4, speed: 58, xp: 16, gold: [3, 8], hw: 6, hh: 4, poise: 0.1, mass: 1,
  ai: 'melee', aggro: 8, threat: 3, light: { r: 22, color: '#6fe3d0' },
  attacks: [{ id: 'bite', kind: 'lunge', dmg: 1.1, range: 60, minRange: 16, windup: 0.5, active: 0.28, recover: 0.6, cooldown: 1.2, lungeSpeed: 200, status: { id: 'poison', chance: 0.45, duration: 5, } }],
  drops: [['chitin', 0.5, 1, 2]],
});
add({
  id: 'myco_golem', name: L('Мицелиальный голем', 'Mycelium Golem'), sprite: 'myco_golem', tier: 3,
  hp: 280, atk: 20, def: 10, speed: 28, xp: 70, gold: [20, 40], hw: 8, hh: 5, poise: 0.95, mass: 4,
  ai: 'melee', aggro: 8, elite: true, threat: 7,
  attacks: [
    { id: 'slam', kind: 'nova', dmg: 1.3, range: 40, radius: 44, windup: 1, active: 0.2, recover: 0.9, cooldown: 3, weight: 2 },
    { id: 'swipe', kind: 'arc', dmg: 1.1, range: 28, radius: 32, arc: 1.4, windup: 0.7, active: 0.15, recover: 0.7, cooldown: 0.8, weight: 3 },
    { id: 'sprout', kind: 'summon', dmg: 0, range: 300, windup: 0.9, active: 0.1, recover: 0.6, cooldown: 12, summon: { id: 'shroom_runner', count: 2, max: 3 }, weight: 1 },
  ],
  drops: [['glowshroom', 1, 1, 3], ['steel_bar', 0.4, 1, 2], ['potion_heal', 0.4, 1, 1]],
});
add({
  id: 'spore_mother', name: L('Матерь Спор', 'The Spore Mother'), sprite: 'spore_mother', tier: 3,
  hp: 1300, atk: 20, def: 8, speed: 0, xp: 800, gold: [350, 500], hw: 14, hh: 8, poise: 1, mass: 50,
  ai: 'boss', aggro: 20, boss: true, threat: 0, light: { r: 60, color: '#c8e880' },
  attacks: [
    { id: 'cloud', kind: 'nova', dmg: 0.8, range: 90, radius: 70, windup: 1.2, active: 0.3, recover: 1.4, cooldown: 5, status: { id: 'slow', chance: 1, duration: 3 }, weight: 2 },
    { id: 'volley', kind: 'projectile', dmg: 0.9, range: 260, windup: 0.9, active: 0.1, recover: 0.8, cooldown: 2.5, projSpeed: 120, projSprite: 'spore', projCount: 7, spread: 1.8, weight: 3 },
    { id: 'brood', kind: 'summon', dmg: 0, range: 400, windup: 1.1, active: 0.1, recover: 1, cooldown: 10, summon: { id: 'shroom_runner', count: 3, max: 5 }, weight: 1 },
    { id: 'burst', kind: 'slam', dmg: 1.4, range: 400, radius: 26, windup: 1.3, active: 0.2, recover: 1.2, cooldown: 7, weight: 0, unblockable: true },
  ],
  drops: [['shard_3', 1, 1, 1], ['steel_bar', 1, 3, 5], ['glowshroom', 1, 3, 5]],
});

// ───────────── Ярус IV — Кузни гномов ─────────────

add({
  id: 'ember_golem', name: L('Раскалённый голем', 'Ember Golem'), sprite: 'ember_golem', tier: 4,
  hp: 150, atk: 22, def: 16, speed: 30, xp: 30, gold: [6, 14], hw: 7, hh: 5, poise: 0.6, mass: 2.5,
  ai: 'melee', aggro: 7, threat: 4, light: { r: 30, color: '#ff7030' }, resist: { fire: 0.8, ice: -0.5 },
  attacks: [{ id: 'smash', kind: 'arc', dmg: 1.2, range: 24, radius: 28, arc: 1.3, windup: 0.8, active: 0.15, recover: 0.8, cooldown: 1, element: 'fire', status: { id: 'burn', chance: 0.4, duration: 3, power: 3 } }],
  drops: [['dwarf_slag', 0.6, 1, 2], ['silver_ore', 0.3, 1, 2]],
});
add({
  id: 'clockwork', name: L('Механический страж', 'Clockwork Sentry'), sprite: 'clockwork', tier: 4,
  hp: 110, atk: 21, def: 12, speed: 32, xp: 28, gold: [6, 12], hw: 6, hh: 4, poise: 0.3, mass: 1.8,
  ai: 'ranged', aggro: 10, keepDistance: 80, threat: 3,
  attacks: [{ id: 'bolt', kind: 'projectile', dmg: 1, range: 170, windup: 0.8, active: 0.05, recover: 0.5, cooldown: 1.2, projSpeed: 190, projSprite: 'bolt_iron', projCount: 2, spread: 0.15 }],
  drops: [['silver_ore', 0.4, 1, 2], ['coal', 0.4, 1, 2]],
});
add({
  id: 'fire_imp', name: L('Огненный бес', 'Fire Imp'), sprite: 'imp', tier: 4,
  hp: 70, atk: 19, def: 5, speed: 60, xp: 24, gold: [4, 10], hw: 4, hh: 3, poise: 0, mass: 0.7, flyer: true,
  ai: 'flyer', aggro: 9, threat: 3, light: { r: 26, color: '#ff9030' }, resist: { fire: 1 },
  attacks: [{ id: 'fireball', kind: 'projectile', dmg: 1, range: 140, windup: 0.6, active: 0.05, recover: 0.6, cooldown: 1.6, projSpeed: 140, projSprite: 'fireball', element: 'fire' }],
  drops: [['fire_essence', 0.12, 1, 1], ['coal_crystal', 0.1, 1, 1]],
});
add({
  id: 'hollow_armor', name: L('Пустая гномья броня', 'Hollow Dwarven Armour'), sprite: 'hollow_armor', tier: 4,
  hp: 360, atk: 26, def: 22, speed: 34, xp: 110, gold: [30, 60], hw: 7, hh: 5, poise: 0.95, mass: 4,
  ai: 'melee', aggro: 8, elite: true, threat: 8,
  attacks: [
    { id: 'axe', kind: 'arc', dmg: 1.2, range: 26, radius: 30, arc: 1.3, windup: 0.7, active: 0.15, recover: 0.6, cooldown: 0.6, weight: 3 },
    { id: 'charge', kind: 'lunge', dmg: 1.5, range: 110, minRange: 40, windup: 0.8, active: 0.45, recover: 1, cooldown: 3.5, lungeSpeed: 230, weight: 1 },
  ],
  drops: [['silver_bar', 0.6, 1, 2], ['coal_crystal', 0.5, 1, 2], ['potion_heal', 0.4, 1, 2]],
});
add({
  id: 'brodrik', name: L('Железный Тан Бродрик', 'Iron Thane Brodrik'), sprite: 'brodrik', tier: 4,
  hp: 2000, atk: 26, def: 18, speed: 36, xp: 1200, gold: [500, 700], hw: 10, hh: 6, poise: 1, mass: 8,
  ai: 'boss', aggro: 20, boss: true, threat: 0, light: { r: 40, color: '#ff7a30' }, resist: { fire: 0.6 },
  attacks: [
    { id: 'hammer', kind: 'arc', dmg: 1.3, range: 34, radius: 42, arc: 1.4, windup: 0.95, active: 0.2, recover: 0.8, cooldown: 0.6, weight: 3 },
    { id: 'quake', kind: 'nova', dmg: 1.2, range: 70, radius: 76, windup: 1.3, active: 0.25, recover: 1, cooldown: 6, weight: 1, unblockable: true },
    { id: 'heat', kind: 'slam', dmg: 1.2, range: 400, radius: 30, windup: 1.4, active: 0.2, recover: 0.6, cooldown: 7, weight: 0, element: 'fire', unblockable: true },
    { id: 'rush', kind: 'lunge', dmg: 1.4, range: 160, minRange: 60, windup: 0.8, active: 0.5, recover: 1, cooldown: 5, lungeSpeed: 260, weight: 1 },
  ],
  drops: [['shard_4', 1, 1, 1], ['silver_bar', 1, 3, 5], ['coal_crystal', 1, 2, 3]],
});

// ───────────── Ярус V — Ледяная библиотека ─────────────

add({
  id: 'ice_wraith', name: L('Ледяной призрак', 'Ice Wraith'), sprite: 'ice_wraith', tier: 5,
  hp: 150, atk: 28, def: 10, speed: 46, xp: 40, gold: [8, 18], hw: 5, hh: 4, poise: 0.3, mass: 1, flyer: true,
  ai: 'ranged', aggro: 9, keepDistance: 70, threat: 4, undead: true, light: { r: 26, color: '#bfefff' }, resist: { ice: 1, fire: -0.5 },
  attacks: [{ id: 'frost', kind: 'projectile', dmg: 1, range: 150, windup: 0.7, active: 0.05, recover: 0.6, cooldown: 1.5, projSpeed: 150, projSprite: 'ice', element: 'ice' }],
  drops: [['frost_crystal', 0.35, 1, 1], ['ether_dust', 0.1, 1, 1]],
});
add({
  id: 'book_swarm', name: L('Книжный рой', 'Book Swarm'), sprite: 'book', tier: 5,
  hp: 80, atk: 22, def: 6, speed: 68, xp: 26, gold: [4, 10], hw: 4, hh: 3, poise: 0, mass: 0.6, flyer: true,
  ai: 'flyer', aggro: 9, threat: 2,
  attacks: [{ id: 'flap', kind: 'lunge', dmg: 1, range: 50, windup: 0.35, active: 0.3, recover: 0.6, cooldown: 0.8, lungeSpeed: 210 }],
  drops: [['parchment', 0.4, 1, 1]],
});
add({
  id: 'frost_wolf', name: L('Морозный волк', 'Frost Wolf'), sprite: 'wolf', tier: 5,
  hp: 170, atk: 30, def: 10, speed: 66, xp: 42, gold: [6, 14], hw: 6, hh: 4, poise: 0.3, mass: 1.4,
  ai: 'melee', aggro: 9, threat: 4, resist: { ice: 0.5 },
  attacks: [
    { id: 'pounce', kind: 'lunge', dmg: 1.2, range: 70, minRange: 20, windup: 0.5, active: 0.3, recover: 0.7, cooldown: 1.4, lungeSpeed: 240, weight: 2 },
    { id: 'bite', kind: 'arc', dmg: 1, range: 20, radius: 22, arc: 1, windup: 0.35, active: 0.1, recover: 0.4, cooldown: 0.4, weight: 3, status: { id: 'bleed', chance: 0.3, duration: 3, power: 3 } },
  ],
  drops: [['frost_crystal', 0.2, 1, 1], ['adamant_ore', 0.3, 1, 2]],
});
add({
  id: 'page_keeper', name: L('Хранитель страниц', 'Page Keeper'), sprite: 'page_keeper', tier: 5,
  hp: 480, atk: 32, def: 16, speed: 30, xp: 150, gold: [40, 80], hw: 6, hh: 4, poise: 0.9, mass: 3,
  ai: 'caster', aggro: 10, keepDistance: 70, elite: true, threat: 8, undead: true, light: { r: 34, color: '#bfefff' },
  attacks: [
    { id: 'lances', kind: 'projectile', dmg: 0.9, range: 180, windup: 0.8, active: 0.1, recover: 0.6, cooldown: 2, projSpeed: 170, projSprite: 'ice', projCount: 5, spread: 0.8, element: 'ice', weight: 3 },
    { id: 'pages', kind: 'summon', dmg: 0, range: 300, windup: 1, active: 0.1, recover: 0.6, cooldown: 9, summon: { id: 'book_swarm', count: 3, max: 4 }, weight: 1 },
    { id: 'frostnova', kind: 'nova', dmg: 1.2, range: 50, radius: 56, windup: 0.9, active: 0.2, recover: 0.8, cooldown: 5, element: 'ice', weight: 2 },
  ],
  drops: [['parchment', 1, 1, 3], ['adamant_bar', 0.5, 1, 2], ['ether_dust', 0.5, 1, 2]],
});
add({
  id: 'keeper_silence', name: L('Хранитель Безмолвия', 'The Keeper of Silence'), sprite: 'keeper_silence', tier: 5,
  hp: 2600, atk: 32, def: 16, speed: 50, xp: 1700, gold: [700, 900], hw: 9, hh: 6, poise: 1, mass: 6, flyer: true,
  ai: 'boss', aggro: 20, boss: true, threat: 0, undead: true, light: { r: 30, color: '#bfefff' }, resist: { ice: 1, fire: -0.3 },
  attacks: [
    { id: 'lances', kind: 'projectile', dmg: 1, range: 240, windup: 0.9, active: 0.1, recover: 0.6, cooldown: 2.2, projSpeed: 180, projSprite: 'ice', projCount: 7, spread: 1.2, element: 'ice', weight: 3 },
    { id: 'claw', kind: 'arc', dmg: 1.2, range: 30, radius: 34, arc: 1.3, windup: 0.6, active: 0.15, recover: 0.6, cooldown: 0.8, weight: 2 },
    { id: 'glide', kind: 'lunge', dmg: 1.3, range: 180, minRange: 50, windup: 0.9, active: 0.5, recover: 0.8, cooldown: 4, lungeSpeed: 250, weight: 1 },
    { id: 'hush', kind: 'nova', dmg: 1.3, range: 70, radius: 80, windup: 1.4, active: 0.25, recover: 1, cooldown: 8, weight: 0, element: 'ice', unblockable: true },
  ],
  drops: [['shard_5', 1, 1, 1], ['adamant_bar', 1, 3, 5], ['frost_crystal', 1, 2, 4]],
});

// ───────────── Ярус VI — Пылающий собор ─────────────

add({
  id: 'ash_acolyte', name: L('Пепельный служка', 'Ash Acolyte'), sprite: 'ash_acolyte', tier: 6,
  hp: 220, atk: 34, def: 14, speed: 40, xp: 55, gold: [10, 22], hw: 5, hh: 3, poise: 0.3, mass: 1.3,
  ai: 'melee', aggro: 8, threat: 3, undead: true, resist: { fire: 0.7 },
  attacks: [{ id: 'censer', kind: 'arc', dmg: 1.1, range: 26, radius: 30, arc: 1.3, windup: 0.6, active: 0.15, recover: 0.6, cooldown: 0.8, element: 'fire', status: { id: 'burn', chance: 0.35, duration: 3, power: 5 } }],
  drops: [['ash_stone', 0.5, 1, 2], ['obsidian', 0.15, 1, 1]],
});
add({
  id: 'fire_seraph', name: L('Огненный серафим', 'Fire Seraph'), sprite: 'seraph', tier: 6,
  hp: 190, atk: 36, def: 12, speed: 56, xp: 60, gold: [10, 24], hw: 6, hh: 4, poise: 0.4, mass: 1.2, flyer: true,
  ai: 'flyer', aggro: 10, threat: 4, light: { r: 34, color: '#ffb040' }, resist: { fire: 1 },
  attacks: [
    { id: 'dive', kind: 'lunge', dmg: 1.2, range: 90, minRange: 30, windup: 0.6, active: 0.35, recover: 0.7, cooldown: 1.6, lungeSpeed: 240, element: 'fire', weight: 2 },
    { id: 'flare', kind: 'projectile', dmg: 0.9, range: 150, windup: 0.6, active: 0.05, recover: 0.5, cooldown: 2, projSpeed: 150, projSprite: 'fireball', projCount: 3, spread: 0.5, element: 'fire', weight: 1 },
  ],
  drops: [['fire_essence', 0.3, 1, 1]],
});
add({
  id: 'pilgrim', name: L('Горящий паломник', 'Burning Pilgrim'), sprite: 'pilgrim', tier: 6,
  hp: 180, atk: 38, def: 10, speed: 32, xp: 50, gold: [8, 20], hw: 5, hh: 3, poise: 0.2, mass: 1.2,
  ai: 'melee', aggro: 8, threat: 3, light: { r: 30, color: '#ff8030' },
  attacks: [{ id: 'immolate', kind: 'nova', dmg: 1.3, range: 30, radius: 40, windup: 1, active: 0.2, recover: 1, cooldown: 2.5, element: 'fire', status: { id: 'burn', chance: 0.7, duration: 4, power: 6 } }],
  drops: [['ash_stone', 0.4, 1, 1], ['fire_essence', 0.1, 1, 1]],
});
add({
  id: 'inquisitor', name: L('Инквизитор пепла', 'Ash Inquisitor'), sprite: 'inquisitor', tier: 6,
  hp: 620, atk: 40, def: 20, speed: 36, xp: 200, gold: [60, 110], hw: 6, hh: 4, poise: 0.95, mass: 3.5,
  ai: 'melee', aggro: 9, elite: true, threat: 9, resist: { fire: 0.6, holy: 0.5 },
  attacks: [
    { id: 'verdict', kind: 'arc', dmg: 1.3, range: 30, radius: 36, arc: 1.2, windup: 0.8, active: 0.15, recover: 0.7, cooldown: 0.8, element: 'holy', weight: 3 },
    { id: 'pyre', kind: 'slam', dmg: 1.2, range: 200, radius: 24, windup: 1.2, active: 0.2, recover: 0.8, cooldown: 5, element: 'fire', weight: 1, unblockable: true },
  ],
  drops: [['obsidian', 0.7, 1, 2], ['fire_essence', 0.5, 1, 2], ['potion_big', 0.3, 1, 1]],
});
add({
  id: 'ash_seraph', name: L('Серафим Пепла', 'The Ash Seraph'), sprite: 'ash_seraph', tier: 6,
  hp: 3300, atk: 40, def: 20, speed: 54, xp: 2400, gold: [900, 1200], hw: 10, hh: 6, poise: 1, mass: 6, flyer: true,
  ai: 'boss', aggro: 20, boss: true, threat: 0, light: { r: 60, color: '#ffb040' }, resist: { fire: 1 },
  attacks: [
    { id: 'dive', kind: 'lunge', dmg: 1.4, range: 200, minRange: 50, windup: 0.9, active: 0.5, recover: 0.8, cooldown: 3, lungeSpeed: 280, element: 'fire', weight: 2 },
    { id: 'wing', kind: 'arc', dmg: 1.2, range: 32, radius: 40, arc: 1.6, windup: 0.7, active: 0.15, recover: 0.6, cooldown: 0.8, element: 'fire', weight: 3 },
    { id: 'crosses', kind: 'slam', dmg: 1.3, range: 400, radius: 24, windup: 1.3, active: 0.2, recover: 0.8, cooldown: 6, element: 'fire', weight: 1, unblockable: true },
    { id: 'choir', kind: 'summon', dmg: 0, range: 400, windup: 1.2, active: 0.1, recover: 1, cooldown: 14, summon: { id: 'pilgrim', count: 2, max: 3 }, weight: 0 },
  ],
  drops: [['shard_6', 1, 1, 1], ['obsidian', 1, 3, 5], ['fire_essence', 1, 2, 4]],
});

// ───────────── Ярус VII — Тронный зал ─────────────

add({
  id: 'royal_guard', name: L('Осквернённый страж Трона', 'Defiled Throne Guard'), sprite: 'royal_guard', tier: 7,
  hp: 320, atk: 44, def: 26, speed: 38, xp: 80, gold: [14, 30], hw: 6, hh: 4, poise: 0.7, mass: 2.4,
  ai: 'melee', aggro: 9, threat: 4,
  attacks: [
    { id: 'halberd', kind: 'arc', dmg: 1.2, range: 34, radius: 38, arc: 0.9, windup: 0.75, active: 0.15, recover: 0.7, cooldown: 0.9, weight: 3 },
    { id: 'thrust', kind: 'lunge', dmg: 1.3, range: 80, minRange: 30, windup: 0.7, active: 0.35, recover: 0.8, cooldown: 2.5, lungeSpeed: 220, weight: 1 },
  ],
  drops: [['royal_gold', 0.3, 1, 1], ['heartstone', 0.12, 1, 1]],
});
add({
  id: 'shade', name: L('Тень Голода', 'Shade of Hunger'), sprite: 'shade', tier: 7,
  hp: 210, atk: 42, def: 14, speed: 62, xp: 70, gold: [10, 24], hw: 5, hh: 4, poise: 0.2, mass: 0.8, flyer: true,
  ai: 'flyer', aggro: 11, threat: 3, resist: { holy: -0.5 },
  attacks: [{ id: 'drain', kind: 'lunge', dmg: 1.1, range: 70, windup: 0.45, active: 0.35, recover: 0.6, cooldown: 1.2, lungeSpeed: 250, status: { id: 'slow', chance: 0.4, duration: 2 } }],
  drops: [['abyss_shard', 0.2, 1, 1]],
});
add({
  id: 'abyss_knight', name: L('Рыцарь Бездны', 'Abyss Knight'), sprite: 'abyss_knight', tier: 7,
  hp: 900, atk: 50, def: 30, speed: 40, xp: 300, gold: [90, 160], hw: 7, hh: 5, poise: 0.95, mass: 4,
  ai: 'melee', aggro: 9, elite: true, threat: 10, resist: { holy: -0.3 },
  attacks: [
    { id: 'cleave', kind: 'arc', dmg: 1.3, range: 32, radius: 38, arc: 1.4, windup: 0.8, active: 0.15, recover: 0.7, cooldown: 0.7, weight: 3 },
    { id: 'void', kind: 'nova', dmg: 1.2, range: 50, radius: 60, windup: 1, active: 0.2, recover: 0.8, cooldown: 5, weight: 1 },
    { id: 'charge', kind: 'lunge', dmg: 1.5, range: 140, minRange: 50, windup: 0.8, active: 0.45, recover: 1, cooldown: 4, lungeSpeed: 260, weight: 1 },
  ],
  drops: [['heartstone', 0.6, 1, 2], ['royal_gold', 0.6, 1, 2], ['abyss_shard', 0.5, 1, 1]],
});
add({
  id: 'halvard', name: L('Хальвард, Скованный Король', 'Halvard, the Chained King'), sprite: 'halvard', tier: 7,
  hp: 5200, atk: 48, def: 26, speed: 52, xp: 4000, gold: [1500, 2000], hw: 9, hh: 6, poise: 1, mass: 8,
  ai: 'boss', aggro: 20, boss: true, threat: 0, light: { r: 50, color: '#c8a8ff' },
  attacks: [
    { id: 'riposte', kind: 'arc', dmg: 1.2, range: 32, radius: 38, arc: 1.3, windup: 0.55, active: 0.15, recover: 0.45, cooldown: 0.4, weight: 4 },
    { id: 'lunge', kind: 'lunge', dmg: 1.4, range: 150, minRange: 40, windup: 0.7, active: 0.4, recover: 0.8, cooldown: 3, lungeSpeed: 280, weight: 2 },
    { id: 'tendrils', kind: 'slam', dmg: 1.3, range: 400, radius: 26, windup: 1.2, active: 0.2, recover: 0.8, cooldown: 6, weight: 0, unblockable: true },
    { id: 'hunger', kind: 'nova', dmg: 1.4, range: 70, radius: 84, windup: 1.4, active: 0.25, recover: 1, cooldown: 8, weight: 0, unblockable: true },
    { id: 'shades', kind: 'summon', dmg: 0, range: 400, windup: 1, active: 0.1, recover: 0.8, cooldown: 14, summon: { id: 'shade', count: 2, max: 3 }, weight: 0 },
  ],
  drops: [['shard_7', 1, 1, 1], ['heartstone', 1, 4, 6], ['royal_gold', 1, 3, 5]],
});

add({
  id: 'hunger_avatar', name: L('Аватар Голода', 'Avatar of the Hunger'), sprite: 'hunger_avatar', tier: 7,
  hp: 7000, atk: 46, def: 22, speed: 40, xp: 5000, gold: [2000, 2500], hw: 14, hh: 8, poise: 1, mass: 20, flyer: true,
  ai: 'boss', aggro: 30, boss: true, threat: 0, light: { r: 40, color: '#6a3aa0' }, resist: { holy: -0.5 },
  attacks: [
    { id: 'maw', kind: 'arc', dmg: 1.3, range: 40, radius: 48, arc: 1.5, windup: 0.8, active: 0.2, recover: 0.6, cooldown: 0.8, weight: 3 },
    { id: 'tendrils', kind: 'slam', dmg: 1.2, range: 400, radius: 26, windup: 1.1, active: 0.2, recover: 0.6, cooldown: 4, weight: 2, unblockable: true },
    { id: 'void', kind: 'projectile', dmg: 0.9, range: 300, windup: 0.9, active: 0.1, recover: 0.6, cooldown: 3, projSpeed: 130, projSprite: 'void', projCount: 9, spread: 2.4, weight: 2 },
    { id: 'devour', kind: 'nova', dmg: 1.5, range: 80, radius: 92, windup: 1.5, active: 0.3, recover: 1.2, cooldown: 9, weight: 0, unblockable: true },
    { id: 'shades', kind: 'summon', dmg: 0, range: 400, windup: 1, active: 0.1, recover: 0.8, cooldown: 12, summon: { id: 'shade', count: 3, max: 4 }, weight: 0 },
  ],
  drops: [['abyss_shard', 1, 3, 5], ['heartstone', 1, 3, 5]],
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

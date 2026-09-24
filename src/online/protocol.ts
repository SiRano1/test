/**
 * Общий протокол клиент ↔ сервер (этап 4). Без DOM и без node — только типы и константы.
 * HTTP: /api/*, JSON, заголовок Authorization: Bearer <jwt>. Изменяющие запросы несут requestId.
 */
import type { WeaponClass } from '../game/types';

export const API_VERSION = 1;

export interface ItemDTO {
  uid: string;
  def: string;
  qty: number;
  rarity: number;
  affixes: { id: string; value: number }[];
  upgrade: number;
  slot?: string | null;
}

export type League = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'legend';

export interface HeroDTO {
  id: string;
  name: string;
  cls: WeaponClass;
  level: number;
  xp: number;
  gold: number;
  karma: number;
  status: 'blue' | 'purple' | 'red';
  rating: number;
  league: League;
  wins: number;
  losses: number;
  wavesBest: number;
  tokens: number;
  guild: { id: string; name: string; tag: string; rank: number } | null;
  inventory: ItemDTO[];
  equipment: ItemDTO[];
  mail: number;
}

export interface LotDTO {
  id: string;
  seller: string;
  item: ItemDTO;
  startBid: number;
  buyout: number | null;
  currentBid: number;
  mine: boolean;
  leading: boolean;
  endsAt: number;
}

export interface GuildDTO {
  id: string;
  name: string;
  tag: string;
  crest: Crest;
  hall: number;
  treasury: number;
  members: { heroId: string; name: string; rank: number; level: number }[];
  ranks: { rank: number; title: string; perms: number; dailyWithdraw: number }[];
  storage: ItemDTO[];
  myRank: number;
}

/** Герб: форма щита × деление × 2 цвета × фигура. */
export interface Crest {
  shape: 0 | 1 | 2 | 3;
  division: 0 | 1 | 2 | 3 | 4;
  colors: [string, string];
  charge: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

export const CREST_COLORS = ['#c83a3a', '#3a5aa8', '#3a8a4a', '#e0b040', '#6a3a8a', '#e8e2d0', '#1a1418', '#d87a2a'];

/** Права гильдии (битовая маска). */
export const PERM = {
  invite: 1,
  kick: 2,
  withdraw: 4,
  storage: 8,
  war: 16,
  crest: 32,
  ranks: 64,
} as const;

export const ALL_PERMS = 127;

// ───── Реальное время ─────

/** Ввод клиента в боевой комнате (тот же смысл, что InputFrame в одиночной игре). */
export interface NetInput {
  seq: number;
  mx: number;
  my: number;
  ax: number | null;
  ay: number | null;
  /** Нажатые в этом кадре действия. */
  p: string[];
  /** Удерживаемые действия. */
  d: string[];
}

/** Снимок одной сущности для отрисовки. */
export interface NetEntity {
  id: number;
  k: 'hero' | 'mob' | 'proj' | 'loot' | 'fx';
  x: number;
  y: number;
  /** Спрайт/вид. */
  s: string;
  f?: number;
  hp?: number;
  mhp?: number;
  /** Имя героя и его статус (blue/purple/red) или команда. */
  n?: string;
  c?: string;
  /** Состояние анимации (attack/dodge/…) и прогресс взмаха. */
  st?: string;
  sp?: number;
  a?: number;
  /** Телеграф атаки монстра: kind, r, half, p. */
  tg?: [string, number, number, number, number];
}

export interface NetSnapshot {
  t: number;
  /** Последний применённый seq ввода этого клиента. */
  ack: number;
  you: number;
  ents: NetEntity[];
  hud?: { wave?: number; score?: number; timer?: number; teams?: [number, number]; msg?: string };
}

export type ArenaMode = 'duel' | 'team' | 'waves' | 'raid';

/** Сколько игроков нужно для старта (рейд — от 4 до 6 членов одной гильдии). */
export const MODE_SIZE: Record<ArenaMode, number> = { duel: 2, team: 6, waves: 1, raid: 4 };
export const RAID_MAX = 6;

export function leagueOf(rating: number): League {
  if (rating >= 2100) return 'legend';
  if (rating >= 1900) return 'diamond';
  if (rating >= 1750) return 'platinum';
  if (rating >= 1600) return 'gold';
  if (rating >= 1450) return 'silver';
  return 'bronze';
}

export function karmaStatus(karma: number, attackedRecently: boolean): 'blue' | 'purple' | 'red' {
  if (karma < -300) return 'red';
  return attackedRecently ? 'purple' : 'blue';
}

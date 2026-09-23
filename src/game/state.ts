import type { FactionId } from '../data/npcs';
import type { EquipSlot, ItemStack, WeaponClass } from './types';

export type SceneRef =
  | { kind: 'town' }
  | { kind: 'interior'; id: string }
  | { kind: 'dungeon'; floor: number };

export type Weather = 'sunny' | 'cloudy' | 'rain' | 'storm' | 'fog' | 'snow';

export interface HeroState {
  name: string;
  level: number;
  xp: number;
  hp: number;
  stamina: number;
  mana: number;
  energy: number;
  maxEnergy: number;
  gold: number;
  classXp: Record<WeaponClass, number>;
  skills: string[];
}

export interface NpcState {
  points: number;
  talkedToday: boolean;
  giftsWeek: number;
  giftedToday: boolean;
  flags: string[];
}

export interface TimeState {
  /** 1..28 */
  day: number;
  /** 0..3 */
  season: number;
  year: number;
  /** Минуты от 0:00 текущего дня (день начинается в 6:00 = 360, заканчивается в 26:00 = 1560). */
  minutes: number;
  weather: Weather;
  tomorrow: Weather;
  totalDays: number;
}

export interface GameState {
  version: number;
  seed: number;
  hero: HeroState;
  inventory: (ItemStack | null)[];
  equipment: Record<EquipSlot, ItemStack | null>;
  quick: (string | null)[];
  storage: (ItemStack | null)[];
  time: TimeState;
  dungeon: { deepest: number; elevator: number[]; bosses: number[] };
  lore: string[];
  npcs: Record<string, NpcState>;
  factions: Record<FactionId, number>;
  flags: Record<string, boolean>;
  stats: Record<string, number>;
  economy: { demand: Record<string, number> };
  /** Где герой находится (для загрузки). Подземелье не сохраняется — загрузка у склепа. */
  location: { scene: SceneRef; x: number; y: number };
  playtime: number;
  settings: { lang: 'ru' | 'en'; volume: number; shake: boolean };
}

export const SAVE_VERSION = 1;
export const INVENTORY_SIZE = 36;
export const STORAGE_SIZE = 36;
export const QUICK_SLOTS = 4;
export const DAY_START = 6 * 60;
export const DAY_END = 26 * 60;

export function newGameState(name: string, seed: number): GameState {
  return {
    version: SAVE_VERSION,
    seed,
    hero: {
      name, level: 1, xp: 0, hp: 100, stamina: 100, mana: 60, energy: 200, maxEnergy: 200, gold: 150,
      classXp: { sword: 0, spear: 0, bow: 0, staff: 0, shield: 0 }, skills: [],
    },
    inventory: new Array(INVENTORY_SIZE).fill(null),
    equipment: { weapon: null, weapon2: null, head: null, body: null, feet: null, amulet: null, ring1: null, ring2: null },
    quick: ['potion_small', 'potion_heal', 'bread', null],
    storage: new Array(STORAGE_SIZE).fill(null),
    time: { day: 1, season: 0, year: 1, minutes: DAY_START, weather: 'sunny', tomorrow: 'cloudy', totalDays: 1 },
    dungeon: { deepest: 0, elevator: [], bosses: [] },
    lore: [],
    npcs: {},
    factions: { church: 0, mages: 0, traders: 0, watch: 0 },
    flags: {},
    stats: {},
    economy: { demand: {} },
    location: { scene: { kind: 'interior', id: 'manor' }, x: -1, y: -1 },
    playtime: 0,
    settings: { lang: 'ru', volume: 0.6, shake: true },
  };
}

export function npcState(s: GameState, id: string): NpcState {
  return (s.npcs[id] ??= { points: 0, talkedToday: false, giftsWeek: 0, giftedToday: false, flags: [] });
}

export const hearts = (s: GameState, id: string) => Math.floor((s.npcs[id]?.points ?? 0) / 250);

export function addStat(s: GameState, key: string, n = 1) {
  s.stats[key] = (s.stats[key] ?? 0) + n;
}

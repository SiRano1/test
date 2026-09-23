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
  economy: { demand: Record<string, number>; rotating: ItemStack[] };
  manor: ManorState;
  quests: Record<string, QuestState>;
  /** Выученные рецепты (кроме известных с начала). */
  recipes: string[];
  /** Узнанные реакции на подарки: npc → item → реакция. */
  giftLog: Record<string, Record<string, GiftReaction>>;
  /** Компаньон на сегодняшний спуск. */
  companion: { npc: string; day: number; revived: boolean; down: boolean } | null;
  /** Выбранный финал (после Тронного зала). */
  ending: 'restore' | 'free' | 'take' | 'bad' | null;
  /** Отношения: встречаемся / помолвка / брак. */
  romance: { partner: string | null; stage: 'dating' | 'engaged' | 'married' | null; weddingDay: number };
  /** Очки навыков, вложенные в деревья: id узла → true. */
  talents: string[];
  /** Текущий праздник: что уже сделано, чей шёпот услышан, адресат тайного дарителя. */
  fest: { key: string; target: string | null; heard: string[]; done: string[] };
  /** Своя лавка в усадьбе. */
  shop: import('./systems/playershop').ShopState;
  /** Офлайн-аукцион «Золотые весы». */
  auction: import('./systems/auction').AuctionState;
  /** Где герой находится (для загрузки). Подземелье не сохраняется — загрузка у склепа. */
  location: { scene: SceneRef; x: number; y: number };
  playtime: number;
  settings: Settings;
}

export interface Settings {
  lang: 'ru' | 'en';
  volume: number;
  shake: boolean;
  /** Сюжетный режим: вдвое меньше урона герою, смерть без потерь. */
  story: boolean;
  /** Вспышки экрана (выкл — для светочувствительных). */
  flashes: boolean;
  /** Скорость игры: 0.7 / 0.85 / 1. */
  speed: number;
  /** Контрастные метки атак врагов. */
  contrast: boolean;
}

export const DEFAULT_SETTINGS: Settings = { lang: 'ru', volume: 0.6, shake: true, story: false, flashes: true, speed: 1, contrast: false };

export type GiftReaction = 'love' | 'like' | 'neutral' | 'dislike' | 'hate';

export interface PlotState {
  seed: string | null;
  days: number;
  watered: boolean;
  ready: boolean;
}

export interface ManorState {
  upgrades: string[];
  building: { id: string; daysLeft: number } | null;
  garden: PlotState[];
}

export interface QuestState {
  status: 'active' | 'done';
  progress: number;
  /** Начальное значение счётчика (для заданий «убить N»). */
  base: number;
}

export const SAVE_VERSION = 3;
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
    economy: { demand: {}, rotating: [] },
    manor: { upgrades: [], building: null, garden: [] },
    quests: {},
    recipes: [],
    giftLog: {},
    companion: null,
    ending: null,
    romance: { partner: null, stage: null, weddingDay: 0 },
    talents: [],
    fest: { key: '', target: null, heard: [], done: [] },
    shop: { displays: new Array(8).fill(null), popularity: 10, book: {}, sales: 0, income: 0 },
    auction: { lots: [], mine: [], mail: [], history: {}, day: 0 },
    location: { scene: { kind: 'interior', id: 'manor' }, x: -1, y: -1 },
    playtime: 0,
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function npcState(s: GameState, id: string): NpcState {
  return (s.npcs[id] ??= { points: 0, talkedToday: false, giftsWeek: 0, giftedToday: false, flags: [] });
}

export const hearts = (s: GameState, id: string) => Math.floor((s.npcs[id]?.points ?? 0) / 250);

export function addStat(s: GameState, key: string, n = 1) {
  s.stats[key] = (s.stats[key] ?? 0) + n;
}

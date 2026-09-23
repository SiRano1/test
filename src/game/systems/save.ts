import { SAVE_VERSION, type GameState } from '../state';

/** Хранилище «ключ → строка»: localStorage в браузере, Map в тестах/на сервере. */
export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export class MemoryKV implements KV {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

export const SLOTS = 3;
const key = (slot: number) => `dtc.save.${slot}`;

export interface SaveMeta {
  slot: number;
  name: string;
  level: number;
  day: number;
  season: number;
  year: number;
  deepest: number;
  gold: number;
  playtime: number;
  savedAt: number;
}

/** Миграции: версия → функция, поднимающая данные до следующей версии. */
const MIGRATIONS: Record<number, (d: any) => any> = {
  // 1 → 2: усадьба, задания, рецепты, подарки, ротация лавки
  1: (d) => ({
    ...d,
    economy: { demand: d.economy?.demand ?? {}, rotating: [] },
    manor: { upgrades: [], building: null, garden: [] },
    quests: {},
    recipes: [],
    giftLog: {},
  }),
  // 2 → 3: этап 3 — таланты, праздники, своя лавка, аукцион, романтика, финалы
  2: (d) => ({
    ...d,
    talents: d.talents ?? [],
    fest: { key: '', target: null, heard: [], done: [] },
    shop: { displays: new Array(8).fill(null), popularity: 10, book: {}, sales: 0, income: 0 },
    auction: { lots: [], mine: [], mail: [], history: {}, day: 0 },
  }),
};

export function migrate(data: any): GameState {
  let v = data.version ?? 1;
  while (v < SAVE_VERSION) {
    const m = MIGRATIONS[v];
    if (m) data = m(data);
    v++;
    data.version = v;
  }
  // дефолты для полей, добавленных без смены версии
  data.economy ??= { demand: {}, rotating: [] };
  data.economy.rotating ??= [];
  data.manor ??= { upgrades: [], building: null, garden: [] };
  data.quests ??= {};
  data.recipes ??= [];
  data.giftLog ??= {};
  data.companion ??= null;
  data.ending ??= null;
  data.romance ??= { partner: null, stage: null, weddingDay: 0 };
  data.talents ??= [];
  data.fest ??= { key: '', target: null, heard: [], done: [] };
  data.shop ??= { displays: new Array(8).fill(null), popularity: 10, book: {}, sales: 0, income: 0 };
  data.auction ??= { lots: [], mine: [], mail: [], history: {}, day: 0 };
  data.flags ??= {};
  data.stats ??= {};
  data.location ??= { scene: { kind: 'interior', id: 'manor' }, x: -1, y: -1 };
  return data as GameState;
}

export function saveGame(kv: KV, slot: number, s: GameState): void {
  const payload = { meta: metaOf(slot, s), state: s };
  kv.setItem(key(slot), JSON.stringify(payload));
}

export function loadGame(kv: KV, slot: number): GameState | null {
  const raw = kv.getItem(key(slot));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return migrate(parsed.state);
  } catch {
    return null;
  }
}

export function listSaves(kv: KV): (SaveMeta | null)[] {
  const out: (SaveMeta | null)[] = [];
  for (let i = 0; i < SLOTS; i++) {
    const raw = kv.getItem(key(i));
    if (!raw) {
      out.push(null);
      continue;
    }
    try {
      out.push(JSON.parse(raw).meta as SaveMeta);
    } catch {
      out.push(null);
    }
  }
  return out;
}

export function deleteSave(kv: KV, slot: number): void {
  kv.removeItem(key(slot));
}

function metaOf(slot: number, s: GameState): SaveMeta {
  return {
    slot, name: s.hero.name, level: s.hero.level, day: s.time.day, season: s.time.season, year: s.time.year,
    deepest: s.dungeon.deepest, gold: s.hero.gold, playtime: s.playtime, savedAt: Date.now(),
  };
}

/** Экспорт/импорт в файл. */
export const exportSave = (s: GameState) => JSON.stringify({ meta: metaOf(0, s), state: s }, null, 1);
export function importSave(text: string): GameState {
  const parsed = JSON.parse(text);
  if (!parsed?.state?.hero) throw new Error('Not a save file');
  return migrate(parsed.state);
}

/**
 * Расписания жителей. Место — сцена ('town', id интерьера или 'off' — «дома», вне видимых сцен)
 * и тайл. Вариант 'rain' используется в дождь/грозу/снег, days — по дням недели (0 = Лундень).
 */
export type Facing = 0 | 1 | 2 | 3;

export interface Place {
  scene: string;
  x?: number;
  y?: number;
  roam?: number;
  f?: Facing;
  /** Для 'off': в какое здание уходит. */
  home?: string;
}

export interface Entry {
  t: number;
  at: Place;
}

export interface Schedule {
  base: Entry[];
  rain?: Entry[];
  days?: Partial<Record<number, Entry[]>>;
}

const T = (h: number, m = 0) => h * 60 + m;
const town = (x: number, y: number, roam = 0, f: Facing = 0): Place => ({ scene: 'town', x, y, roam, f });
const inn = (id: string, x: number, y: number, roam = 0, f: Facing = 0): Place => ({ scene: id, x, y, roam, f });
const off = (home: string): Place => ({ scene: 'off', home });

export const SCHEDULES: Record<string, Schedule> = {
  yorn: {
    base: [{ t: 0, at: town(12, 13, 2) }, { t: T(19, 30), at: inn('tavern', 11, 8, 0, 3) }, { t: T(22), at: off('hut') }],
    rain: [{ t: 0, at: inn('tavern', 11, 8, 0, 3) }, { t: T(22), at: off('hut') }],
  },
  mira: {
    base: [
      { t: 0, at: off('house1') }, { t: T(8), at: inn('archive', 7, 3, 3) }, { t: T(12), at: town(28, 21, 2) },
      { t: T(14), at: inn('archive', 7, 3, 3) }, { t: T(20), at: off('house1') },
    ],
    days: {
      4: [{ t: 0, at: off('house1') }, { t: T(8), at: inn('archive', 7, 3, 3) }, { t: T(18, 30), at: inn('tavern', 13, 6, 0, 3) }, { t: T(22), at: off('house1') }],
      5: [{ t: 0, at: off('house1') }, { t: T(10), at: town(20, 35, 2) }, { t: T(13), at: inn('archive', 7, 3, 3) }, { t: T(18, 30), at: inn('tavern', 13, 6, 0, 3) }, { t: T(22), at: off('house1') }],
    },
    rain: [{ t: 0, at: off('house1') }, { t: T(8), at: inn('archive', 7, 3, 3) }, { t: T(20), at: off('house1') }],
  },
  hilda: {
    base: [{ t: 0, at: off('smithy') }, { t: T(7), at: inn('smithy', 6, 3, 2) }, { t: T(18), at: inn('tavern', 9, 6, 0, 0) }, { t: T(21), at: off('smithy') }],
  },
  marta: {
    base: [{ t: 0, at: off('grocer') }, { t: T(8), at: inn('grocer', 6, 3, 2) }, { t: T(17), at: town(27, 19, 1) }, { t: T(19), at: off('grocer') }],
    rain: [{ t: 0, at: off('grocer') }, { t: T(8), at: inn('grocer', 6, 3, 2) }, { t: T(19), at: off('grocer') }],
  },
  agatha: {
    base: [{ t: 0, at: inn('church', 3, 5, 3, 2) }],
  },
  kai: {
    base: [
      { t: 0, at: off('barracks') }, { t: T(7), at: town(30, 14, 3) }, { t: T(11), at: town(46, 27, 4) },
      { t: T(15), at: inn('barracks', 10, 6, 2) }, { t: T(19), at: inn('tavern', 9, 8, 0, 3) }, { t: T(22, 30), at: off('barracks') },
    ],
    rain: [{ t: 0, at: off('barracks') }, { t: T(7), at: inn('barracks', 10, 6, 2) }, { t: T(19), at: inn('tavern', 9, 8, 0, 3) }, { t: T(22, 30), at: off('barracks') }],
  },
  osbert: {
    base: [{ t: 0, at: off('alchemy') }, { t: T(9), at: inn('alchemy', 5, 3, 2) }, { t: T(13), at: town(16, 35, 3) }, { t: T(15), at: inn('alchemy', 5, 3, 2) }, { t: T(20), at: off('alchemy') }],
    rain: [{ t: 0, at: off('alchemy') }, { t: T(9), at: inn('alchemy', 5, 3, 2) }, { t: T(20), at: off('alchemy') }],
  },
  borin: {
    base: [{ t: 0, at: off('crypt') }, { t: T(7), at: town(15, 12, 2) }, { t: T(18), at: inn('tavern', 5, 7, 0, 2) }, { t: T(23), at: off('crypt') }],
    rain: [{ t: 0, at: off('crypt') }, { t: T(7), at: inn('tavern', 5, 7, 0, 2) }, { t: T(23), at: off('crypt') }],
  },
  bran: {
    base: [{ t: 0, at: off('barracks') }, { t: T(7), at: inn('barracks', 7, 4, 1) }, { t: T(11), at: town(33, 13, 2) }, { t: T(14), at: inn('barracks', 7, 4, 1) }, { t: T(20), at: off('barracks') }],
    rain: [{ t: 0, at: off('barracks') }, { t: T(7), at: inn('barracks', 7, 4, 1) }, { t: T(20), at: off('barracks') }],
  },
  lis: {
    base: [{ t: 0, at: off('fence') }, { t: T(11), at: inn('fence', 5, 3, 1) }, { t: T(20), at: inn('tavern', 15, 9, 0, 1) }, { t: T(24), at: off('fence') }],
    rain: [{ t: 0, at: off('fence') }, { t: T(11), at: inn('fence', 5, 3, 1) }, { t: T(24), at: off('fence') }],
  },
  tilda: {
    base: [{ t: 0, at: off('tavern') }, { t: T(10), at: inn('tavern', 4, 2, 2) }, { t: T(25), at: off('tavern') }],
  },
  eloise: {
    base: [{ t: 0, at: off('tavern') }, { t: T(12), at: town(31, 23, 1) }, { t: T(17), at: inn('tavern', 15, 3, 1) }, { t: T(24), at: off('tavern') }],
    rain: [{ t: 0, at: off('tavern') }, { t: T(12), at: inn('tavern', 15, 3, 1) }, { t: T(24), at: off('tavern') }],
  },
  pip: {
    base: [{ t: 0, at: off('tavern') }, { t: T(7), at: town(34, 20, 5) }, { t: T(12), at: town(22, 35, 3) }, { t: T(16), at: town(26, 24, 4) }, { t: T(20), at: off('tavern') }],
    rain: [{ t: 0, at: off('tavern') }, { t: T(8), at: inn('tavern', 11, 10, 2) }, { t: T(20), at: off('tavern') }],
  },
  albin: {
    base: [{ t: 0, at: off('tower') }, { t: T(9), at: inn('tower', 5, 5, 1) }, { t: T(19), at: off('tower') }],
  },
  mortimer: {
    base: [{ t: 0, at: off('church') }, { t: T(8), at: inn('church', 8, 4, 1, 0) }, { t: T(12), at: town(31, 13, 1) }, { t: T(13), at: inn('church', 8, 4, 1, 0) }, { t: T(20), at: off('church') }],
    rain: [{ t: 0, at: off('church') }, { t: T(8), at: inn('church', 8, 4, 1, 0) }, { t: T(20), at: off('church') }],
  },
  veila: {
    base: [{ t: 0, at: off('house2') }, { t: T(7), at: town(24, 36, 3) }, { t: T(12), at: inn('alchemy', 8, 6, 1) }, { t: T(14), at: town(8, 35, 3) }, { t: T(19), at: off('house2') }],
    rain: [{ t: 0, at: off('house2') }, { t: T(9), at: inn('alchemy', 8, 6, 1) }, { t: T(17), at: off('house2') }],
  },
  ula: {
    base: [{ t: 0, at: off('house2') }, { t: T(9), at: town(26, 23, 0, 0) }, { t: T(17), at: inn('tavern', 12, 9, 0, 3) }, { t: T(21), at: off('house2') }],
    rain: [{ t: 0, at: off('house2') }, { t: T(11), at: inn('tavern', 12, 9, 0, 3) }, { t: T(21), at: off('house2') }],
  },
  sebastian: {
    base: [{ t: 0, at: off('trading') }, { t: T(10), at: inn('trading', 10, 4, 2) }, { t: T(15), at: town(36, 20, 3) }, { t: T(18), at: inn('tavern', 13, 9, 0, 3) }, { t: T(23), at: off('trading') }],
    rain: [{ t: 0, at: off('trading') }, { t: T(10), at: inn('trading', 10, 4, 2) }, { t: T(23), at: off('trading') }],
  },
  livia: {
    base: [{ t: 0, at: off('trading') }, { t: T(8), at: inn('trading', 5, 3, 1) }, { t: T(20), at: off('trading') }],
  },
  ogden: {
    base: [{ t: 0, at: off('trading') }, { t: T(9), at: town(31, 16, 2) }, { t: T(13), at: inn('trading', 11, 7, 1) }, { t: T(17), at: town(33, 24, 2) }, { t: T(20), at: off('trading') }],
    rain: [{ t: 0, at: off('trading') }, { t: T(9), at: inn('trading', 11, 7, 1) }, { t: T(20), at: off('trading') }],
  },
  isolde: {
    base: [{ t: 0, at: off('tower') }, { t: T(10), at: inn('tower', 8, 4, 1) }, { t: T(22), at: off('tower') }],
  },
  nisa: {
    base: [{ t: 0, at: off('tower') }, { t: T(8), at: inn('tower', 2, 8, 1) }, { t: T(12), at: town(40, 24, 3) }, { t: T(15), at: inn('tower', 2, 8, 1) }, { t: T(19), at: inn('tavern', 14, 6, 0, 1) }, { t: T(23), at: off('tower') }],
    rain: [{ t: 0, at: off('tower') }, { t: T(8), at: inn('tower', 2, 8, 1) }, { t: T(23), at: off('tower') }],
  },
  corvin: {
    base: [{ t: 0, at: off('tower') }, { t: T(11), at: town(13, 15, 1) }, { t: T(16), at: inn('tower', 7, 8, 1) }, { t: T(22), at: off('tower') }],
    rain: [{ t: 0, at: off('tower') }, { t: T(11), at: inn('tower', 7, 8, 1) }, { t: T(22), at: off('tower') }],
  },
  daren: {
    base: [{ t: 0, at: off('tavern') }, { t: T(9), at: town(10, 26, 4) }, { t: T(13), at: inn('tavern', 3, 9, 0, 0) }, { t: T(16), at: town(44, 26, 4) }, { t: T(20), at: inn('tavern', 3, 9, 0, 0) }, { t: T(25), at: off('tavern') }],
    rain: [{ t: 0, at: off('tavern') }, { t: T(10), at: inn('tavern', 3, 9, 0, 0) }, { t: T(25), at: off('tavern') }],
  },
  theo: {
    base: [{ t: 0, at: off('church') }, { t: T(7), at: inn('church', 12, 6, 2) }, { t: T(12), at: town(14, 12, 2) }, { t: T(14), at: inn('church', 12, 6, 2) }, { t: T(21), at: off('church') }],
    rain: [{ t: 0, at: off('church') }, { t: T(7), at: inn('church', 12, 6, 2) }, { t: T(21), at: off('church') }],
  },
  erik: {
    base: [{ t: 0, at: off('smithy') }, { t: T(7), at: inn('smithy', 2, 6, 1) }, { t: T(12), at: town(34, 16, 3) }, { t: T(15), at: inn('smithy', 2, 6, 1) }, { t: T(19), at: inn('tavern', 9, 9, 0, 3) }, { t: T(22), at: off('smithy') }],
    rain: [{ t: 0, at: off('smithy') }, { t: T(7), at: inn('smithy', 2, 6, 1) }, { t: T(22), at: off('smithy') }],
  },
  hanna: {
    base: [{ t: 0, at: off('cottage') }, { t: T(7), at: town(14, 44, 4) }, { t: T(16), at: town(27, 18, 1) }, { t: T(19), at: off('cottage') }],
    rain: [{ t: 0, at: off('cottage') }],
  },
};

const RAINY = new Set(['rain', 'storm', 'snow']);

/** Где должен быть житель в данный момент. */
export function placeFor(npc: string, minutes: number, weekday: number, weather: string): Place | null {
  const s = SCHEDULES[npc];
  if (!s) return null;
  const list = (RAINY.has(weather) && s.rain) || s.days?.[weekday] || s.base;
  let cur = list[0]!.at;
  for (const e of list) if (e.t <= minutes) cur = e.at;
  return cur;
}

export const scheduledNpcs = () => Object.keys(SCHEDULES);

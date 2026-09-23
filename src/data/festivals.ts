import type { GameState } from '../game/state';
import { L, type Loc } from './loc';

export type FestivalId = 'tourney' | 'fair' | 'spirits' | 'feast';

export interface FestivalDef {
  id: FestivalId;
  season: number;
  day: number;
  name: Loc;
  desc: Loc;
  /** Ведущий праздника. */
  host: string;
  /** Часы, когда горожане собираются (минуты от полуночи). */
  from: number;
  to: number;
  /** Место сбора в городе (тайлы): прямоугольник и центр. */
  area: { x: number; y: number; w: number; h: number };
  center: [number, number];
}

const PLAZA = { x: 24, y: 15, w: 15, h: 10 };

export const FESTIVALS: FestivalDef[] = [
  {
    id: 'tourney', season: 0, day: 13, host: 'bran', from: 10 * 60, to: 18 * 60, area: PLAZA, center: [31, 17],
    name: L('Турнир рыцарей', 'Knights’ Tourney'),
    desc: L('На площади — ристалище. Три раунда против лучших бойцов Стражи.', 'A tilting ground on the plaza. Three rounds against the Watch’s best.'),
  },
  {
    id: 'fair', season: 1, day: 11, host: 'marta', from: 9 * 60, to: 20 * 60, area: PLAZA, center: [31, 17],
    name: L('Ярмарка урожая', 'Harvest Fair'),
    desc: L('Прилавки, конкурс урожая и кольца на удачу. Еду и зелья сегодня берут втридорога.', 'Stalls, a harvest contest and ring toss. Food and potions sell for triple today.'),
  },
  {
    id: 'spirits', season: 2, day: 27, host: 'yorn', from: 18 * 60, to: 26 * 60, area: { x: 4, y: 11, w: 16, h: 5 }, center: [11, 13],
    name: L('Ночь духов', 'Night of Spirits'),
    desc: L('Фонари на кладбище. Говорят, в эту ночь Основатели шепчут живым.', 'Lanterns in the graveyard. They say the Founders whisper to the living tonight.'),
  },
  {
    id: 'feast', season: 3, day: 25, host: 'ogden', from: 16 * 60, to: 24 * 60, area: PLAZA, center: [31, 17],
    name: L('Зимний пир', 'Winter Feast'),
    desc: L('Общий стол на площади, тайный даритель и танцы до полуночи.', 'A shared table on the plaza, a secret gift-giver and dancing till midnight.'),
  },
];

export function festivalToday(s: GameState): FestivalDef | null {
  return FESTIVALS.find((f) => f.season === s.time.season && f.day === s.time.day) ?? null;
}

/** Идёт ли праздник прямо сейчас (горожане на месте сбора). */
export function festivalNow(s: GameState): FestivalDef | null {
  const f = festivalToday(s);
  return f && s.time.minutes >= f.from && s.time.minutes < f.to ? f : null;
}

/** Ключ праздника: в новом году всё начинается заново. */
export const festKey = (s: GameState) => `${s.time.year}-${s.time.season}-${s.time.day}`;

/** Духи Основателей и их шёпот (Ночь духов). */
export const SPIRITS: { id: string; name: Loc; at: [number, number]; whisper: Loc }[] = [
  {
    id: 'edmund', name: L('Дух Эдмунда', 'Spirit of Edmund'), at: [6, 13],
    whisper: L('«Я записал правду и спрятал её там, где начинается спуск. Прочти моё письмо — и не повторяй моей трусости».', '"I wrote the truth and hid it where the descent begins. Read my letter — and do not repeat my cowardice."'),
  },
  {
    id: 'aldric', name: L('Дух Альдрика', 'Spirit of Aldric'), at: [17, 12],
    whisper: L('«Кровь Элиссы жива. Она среди тех, кто хранит книги. Отдай ей летопись — ей, не епископу».', '"Elissa’s blood lives. She is among the keepers of books. Give her the chronicle — her, not the Bishop."'),
  },
  {
    id: 'rowena', name: L('Дух Ровены', 'Spirit of Rowena'), at: [8, 15],
    whisper: L('«Стража помнит клятву. Без её щитов никто не выстоит у Трона, когда Голод примет облик».', '"The Watch remembers its oath. Without its shields none will stand at the Throne when the Hunger takes form."'),
  },
  {
    id: 'thane', name: L('Дух Тейна', 'Spirit of Thane'), at: [15, 15],
    whisper: L('«Эстафетный ключ — не дар, а приговор. Кто вложит его в Трон, тот останется на Троне».', '"The relay key is no gift but a sentence. Whoever sets it in the Throne stays upon the Throne."'),
  },
];

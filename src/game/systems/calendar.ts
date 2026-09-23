import { L, t, type Loc } from '../../data/loc';
import { hashSeed, Rng } from '../../core/rng';
import { DAY_START, type GameState, type Weather } from '../state';

export const SEASONS: Loc[] = [L('Весна', 'Spring'), L('Лето', 'Summer'), L('Осень', 'Autumn'), L('Зима', 'Winter')];
export const WEEKDAYS: Loc[] = [
  L('Лундень', 'Moonday'), L('Мардень', 'Marsday'), L('Меркрень', 'Mercday'), L('Йовень', 'Jovesday'),
  L('Фрейдень', 'Freyday'), L('Сатурн', 'Saturday'), L('Солнцедень', 'Sunday'),
];
export const WEATHER_NAMES: Record<Weather, Loc> = {
  sunny: L('Ясно', 'Sunny'), cloudy: L('Облачно', 'Cloudy'), rain: L('Дождь', 'Rain'),
  storm: L('Гроза', 'Storm'), fog: L('Туман', 'Fog'), snow: L('Снег', 'Snow'),
};
export const WEATHER_ICONS: Record<Weather, string> = { sunny: '☀', cloudy: '☁', rain: '🌧', storm: '⛈', fog: '🌫', snow: '❄' };

/** 10 игровых минут = 7 реальных секунд. */
export const REAL_SECONDS_PER_MINUTE = 0.7;

export const seasonName = (s: number) => t(SEASONS[s]!);
export const weekday = (day: number) => t(WEEKDAYS[(day - 1) % 7]!);

export function rollWeather(seed: number, season: number, day: number, year: number): Weather {
  const rng = new Rng(hashSeed(seed, 'weather', year, season, day));
  if (day === 1) return 'sunny';
  const table: [Weather, number][][] = [
    [['sunny', 45], ['cloudy', 25], ['rain', 20], ['storm', 3], ['fog', 7]],
    [['sunny', 55], ['cloudy', 18], ['rain', 12], ['storm', 12], ['fog', 3]],
    [['sunny', 30], ['cloudy', 30], ['rain', 22], ['storm', 3], ['fog', 15]],
    [['sunny', 25], ['cloudy', 25], ['snow', 40], ['fog', 10]],
  ];
  return rng.weighted(table[season]!);
}

/** Перевести календарь на следующее утро. */
export function advanceDay(s: GameState): void {
  const tm = s.time;
  tm.day++;
  if (tm.day > 28) {
    tm.day = 1;
    tm.season++;
    if (tm.season > 3) {
      tm.season = 0;
      tm.year++;
    }
  }
  tm.totalDays++;
  tm.minutes = DAY_START;
  tm.weather = tm.tomorrow;
  const next = nextDate(tm.day, tm.season, tm.year);
  tm.tomorrow = rollWeather(s.seed, next.season, next.day, next.year);
  for (const n of Object.values(s.npcs)) {
    n.talkedToday = false;
    n.giftedToday = false;
    if ((tm.totalDays - 1) % 7 === 0) n.giftsWeek = 0;
  }
}

function nextDate(day: number, season: number, year: number) {
  day++;
  if (day > 28) {
    day = 1;
    season++;
    if (season > 3) {
      season = 0;
      year++;
    }
  }
  return { day, season, year };
}

/** Тьма в городе по времени суток: 0 днём → ~0.62 ночью. */
export function townDarkness(minutes: number): number {
  const h = minutes / 60;
  if (h < 17) return 0;
  if (h < 19) return ((h - 17) / 2) * 0.3;
  if (h < 21) return 0.3 + ((h - 19) / 2) * 0.32;
  return 0.62;
}

/** Оттенок неба (для закатного света). */
export function duskTint(minutes: number): number {
  const h = minutes / 60;
  if (h < 16.5 || h > 21) return 0;
  return h < 18.5 ? (h - 16.5) / 2 : 1 - (h - 18.5) / 2.5;
}

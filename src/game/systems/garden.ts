import { CROPS } from '../../data/items';
import { GARDEN_PLOTS } from '../../data/manor';
import type { GameState, PlotState } from '../state';

export const emptyPlot = (): PlotState => ({ seed: null, days: 0, watered: false, ready: false });

export function initGarden(s: GameState): void {
  if (s.manor.garden.length < GARDEN_PLOTS.length) s.manor.garden = GARDEN_PLOTS.map(() => emptyPlot());
}

/** Стадия роста 0..3 для отрисовки. */
export function growthStage(p: PlotState): number {
  if (!p.seed) return -1;
  if (p.ready) return 3;
  const c = CROPS[p.seed];
  if (!c) return 0;
  return Math.min(2, Math.floor((p.days / c.days) * 3));
}

/**
 * Ночной рост: полив (или дождь сегодня) двигает рост на день.
 * Вызывается ДО смены даты; newSeason — сезон наступающего дня (для увядания).
 */
export function growNight(s: GameState, rainedToday: boolean, newSeason: number): number {
  let withered = 0;
  for (const p of s.manor.garden) {
    if (!p.seed) continue;
    const c = CROPS[p.seed];
    if (!c) {
      p.seed = null;
      continue;
    }
    if (!p.ready && (p.watered || rainedToday)) {
      p.days++;
      if (p.days >= c.days) p.ready = true;
    }
    p.watered = false;
    if (!c.seasons.includes(newSeason)) {
      Object.assign(p, { seed: null, days: 0, ready: false });
      withered++;
    }
  }
  return withered;
}

export function isRainy(weather: string): boolean {
  return weather === 'rain' || weather === 'storm' || weather === 'snow';
}

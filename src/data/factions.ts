import { L, t, type Loc } from './loc';
import type { FactionId } from './npcs';

export interface FactionDef {
  id: FactionId;
  name: Loc;
  head: string;
  perk: Loc;
}

export const FACTIONS: FactionDef[] = [
  { id: 'church', name: L('Церковь Неугасимого Света', 'Church of the Undying Light'), head: 'mortimer', perk: L('Почёт: лечение после смерти без потери золота.', 'Honoured: no gold lost on death.') },
  { id: 'mages', name: L('Гильдия магов «Серый Круг»', 'Mage Guild "Grey Circle"'), head: 'isolde', perk: L('Уважение: зачарование на 25% дешевле. Союзник: «Ритуал Круга».', 'Respected: enchanting 25% cheaper. Allied: "Rite of the Circle".') },
  { id: 'traders', name: L('Торговый дом Кроу', 'House of Crowe'), head: 'livia', perk: L('Почёт: +5% к ценам продажи, комиссия аукциона ниже.', 'Honoured: +5% sell prices, lower auction fees.') },
  { id: 'watch', name: L('Орден Стражи Вальмарка', 'Order of the Valmark Watch'), head: 'bran', perk: L('Почёт: письмо Эдмунда.', "Honoured: Edmund's letter.") },
];

/** Отношения между фракциями: действие в пользу одной сдвигает другие. */
export const RIVALRY: Record<FactionId, Partial<Record<FactionId, number>>> = {
  church: { mages: -1, traders: 0.5 },
  mages: { church: -1, traders: -0.5 },
  traders: { church: 0.5, mages: -0.5, watch: -0.5 },
  watch: { traders: -0.5 },
};

const TIERS: [number, Loc][] = [
  [75, L('Союзник', 'Allied')], [50, L('Почёт', 'Honoured')], [25, L('Уважение', 'Respected')],
  [-20, L('Нейтралитет', 'Neutral')], [-60, L('Неприязнь', 'Disliked')], [-101, L('Враг', 'Hostile')],
];

export function repTier(v: number): string {
  for (const [min, name] of TIERS) if (v >= min) return t(name);
  return t(TIERS[TIERS.length - 1]![1]);
}

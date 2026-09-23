import { L, type Loc } from './loc';
import { CROPS, type ItemDef } from './items';
import type { GameState } from '../game/state';

export interface ShopItem {
  item: string;
  /** Доступно после достижения этажа. */
  deepest?: number;
  /** Только в эти сезоны. */
  seasons?: number[];
  /** Нужна репутация фракции. */
  rep?: ['church' | 'mages' | 'traders' | 'watch', number];
}

export interface ShopDef {
  id: string;
  npc: string;
  name: Loc;
  stock: ShopItem[];
  /** Что лавка покупает. */
  buys: (d: ItemDef) => boolean;
  /** Множитель цены скупки (у скупщицы — ниже, но берёт всё). */
  sellMul: number;
  /** Особые услуги в этой лавке. */
  services?: ('sharpen' | 'enchant' | 'reroll')[];
  /** Ежедневно меняющийся ассортимент редких вещей. */
  rotating?: boolean;
  open?: (s: GameState) => boolean;
}

const tagged = (d: ItemDef, ...tags: string[]) => !!d.tags?.some((t) => tags.includes(t));

const seedStock = (filter: (crop: string) => boolean): ShopItem[] =>
  Object.values(CROPS).filter((c) => filter(c.crop)).map((c) => ({ item: c.seed, seasons: c.seasons }));

export const SHOPS: Record<string, ShopDef> = {
  smith: {
    id: 'smith', npc: 'hilda', name: L('Кузница Хильды', "Hilda's Smithy"), sellMul: 1, services: ['sharpen'],
    stock: [
      { item: 'copper_sword' }, { item: 'copper_spear' }, { item: 'copper_shield' }, { item: 'copper_bow' }, { item: 'copper_staff' },
      { item: 'copper_head' }, { item: 'copper_body' }, { item: 'copper_feet' },
      { item: 'iron_sword', deepest: 10 }, { item: 'iron_spear', deepest: 10 }, { item: 'iron_shield', deepest: 10 },
      { item: 'iron_bow', deepest: 10 }, { item: 'iron_staff', deepest: 10 },
      { item: 'iron_head', deepest: 12 }, { item: 'iron_body', deepest: 12 }, { item: 'iron_feet', deepest: 12 },
      { item: 'steel_sword', deepest: 20 }, { item: 'steel_body', deepest: 20 },
      { item: 'wood' }, { item: 'stone' }, { item: 'coal' }, { item: 'copper_bar' }, { item: 'iron_bar', deepest: 10 },
    ],
    buys: (d) => d.kind === 'weapon' || d.kind === 'armor' || tagged(d, 'ore', 'bar', 'build') || d.id === 'bone',
  },
  grocer: {
    id: 'grocer', npc: 'marta', name: L('Лавка Марты', "Marta's Provisions"), sellMul: 1,
    stock: [
      { item: 'bread' }, { item: 'cheese' }, { item: 'apple' }, { item: 'potion_small' }, { item: 'potion_stamina' }, { item: 'silver_ribbon' },
      ...seedStock((c) => ['potato', 'turnip', 'pumpkin', 'winter_onion', 'wheat'].includes(c)),
    ],
    buys: (d) => d.kind === 'food' || tagged(d, 'veg', 'crop'),
  },
  alchemist: {
    id: 'alchemist', npc: 'osbert', name: L('Алхимия Осберта', "Osbert's Alchemy"), sellMul: 1,
    stock: [
      { item: 'potion_small' }, { item: 'potion_heal', deepest: 5 }, { item: 'potion_stamina' }, { item: 'potion_mana' },
      { item: 'antidote' }, { item: 'glass' }, { item: 'grave_moss' }, { item: 'potion_big', deepest: 25 },
      ...seedStock((c) => ['grave_moss', 'moonwort', 'fireflower', 'frostbloom'].includes(c)),
    ],
    buys: (d) => d.kind === 'consumable' || tagged(d, 'herb', 'monster', 'magic'),
  },
  tavern: {
    id: 'tavern', npc: 'tilda', name: L('Таверна «Кривой Фонарь»', 'The Crooked Lantern'), sellMul: 0.9,
    stock: [{ item: 'bread' }, { item: 'cheese' }, { item: 'apple' }, { item: 'baked_potato' }, { item: 'game_pie', deepest: 5 }, { item: 'miner_stew', deepest: 10 }],
    buys: (d) => d.kind === 'food',
  },
  enchanter: {
    id: 'enchanter', npc: 'albin', name: L('Башня Серого Круга', 'Tower of the Grey Circle'), sellMul: 1, services: ['enchant', 'reroll'],
    stock: [{ item: 'potion_mana' }, { item: 'torch_oil' }, { item: 'ring' }, { item: 'amulet' }, { item: 'copper_staff' }, { item: 'iron_staff', deepest: 10 }],
    buys: (d) => tagged(d, 'gem', 'magic') || d.kind === 'accessory',
  },
  trading: {
    id: 'trading', npc: 'livia', name: L('Торговый дом Кроу', 'House of Crowe'), sellMul: 1.05,
    stock: [{ item: 'trade_license', rep: ['traders', 10] }, { item: 'oath_amulet' }, { item: 'silver_ribbon' }, { item: 'glass' }, { item: 'potion_big', deepest: 30 }, { item: 'steel_bar', deepest: 21 }, { item: 'silver_bar', deepest: 31 }],
    buys: (d) => tagged(d, 'gem', 'bar') || d.kind === 'accessory',
  },
  fair: {
    id: 'fair', npc: 'marta', name: L('Прилавок на ярмарке', 'Fair stall'), sellMul: 3,
    stock: [{ item: 'apple' }, { item: 'honey_bread' }, { item: 'silver_ribbon' }],
    buys: (d) => d.kind === 'food' || d.kind === 'consumable' || tagged(d, 'veg', 'crop'),
  },
  fence: {
    id: 'fence', npc: 'lis', name: L('Лавка Лис', "Lis's Den"), sellMul: 0.8, rotating: true,
    stock: [{ item: 'torch_oil' }, { item: 'antidote' }],
    buys: (d) => d.kind !== 'quest',
  },
};

/** Сезонный множитель цены продажи по тегам/виду предмета. */
export function seasonMul(d: ItemDef, season: number): number {
  if (d.kind === 'food') return season === 3 ? 1.25 : season === 1 ? 0.95 : 1;
  if (tagged(d, 'herb')) return season === 1 ? 0.85 : season === 3 ? 1.2 : 1;
  if (d.id === 'fire_tonic') return season === 1 ? 1.25 : 0.9;
  if (tagged(d, 'ore', 'bar')) return season === 3 ? 1.1 : 1;
  return 1;
}

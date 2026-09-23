import { L, type Loc } from './loc';
import type { ItemDef } from './items';
import type { GameState } from '../game/state';

export interface ShopItem {
  item: string;
  /** Доступно после достижения этажа. */
  deepest?: number;
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
  open?: (s: GameState) => boolean;
}

const tagged = (d: ItemDef, ...tags: string[]) => !!d.tags?.some((t) => tags.includes(t));

export const SHOPS: Record<string, ShopDef> = {
  smith: {
    id: 'smith', npc: 'hilda', name: L('Кузница Хильды', "Hilda's Smithy"), sellMul: 1,
    stock: [
      { item: 'copper_sword' }, { item: 'copper_spear' }, { item: 'copper_shield' }, { item: 'copper_bow' }, { item: 'copper_staff' },
      { item: 'copper_head' }, { item: 'copper_body' }, { item: 'copper_feet' },
      { item: 'iron_sword', deepest: 10 }, { item: 'iron_spear', deepest: 10 }, { item: 'iron_shield', deepest: 10 },
      { item: 'iron_bow', deepest: 10 }, { item: 'iron_staff', deepest: 10 },
      { item: 'iron_head', deepest: 12 }, { item: 'iron_body', deepest: 12 }, { item: 'iron_feet', deepest: 12 },
      { item: 'coal' }, { item: 'copper_bar' }, { item: 'iron_bar', deepest: 10 },
    ],
    buys: (d) => d.kind === 'weapon' || d.kind === 'armor' || tagged(d, 'ore', 'bar', 'build') || d.id === 'bone',
  },
  grocer: {
    id: 'grocer', npc: 'marta', name: L('Лавка Марты', "Marta's Provisions"), sellMul: 1,
    stock: [{ item: 'bread' }, { item: 'cheese' }, { item: 'apple' }, { item: 'potion_small' }, { item: 'potion_stamina' }, { item: 'antidote' }, { item: 'potion_heal', deepest: 8 }],
    buys: (d) => d.kind === 'food' || d.kind === 'consumable' || tagged(d, 'herb'),
  },
};

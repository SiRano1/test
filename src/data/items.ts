import { adj, L, type AdjLoc, type Gender, type Loc } from './loc';
import type { Stats, WeaponClass } from '../game/types';

export type ItemKind =
  | 'weapon' | 'armor' | 'accessory' | 'material' | 'consumable' | 'food' | 'seed' | 'quest' | 'gift';

/** Как рисовать иконку: форма + цвета (клиент рисует процедурно). */
export interface IconSpec {
  shape: string;
  c1: string;
  c2?: string;
}

export interface UseEffect {
  heal?: number;
  stamina?: number;
  mana?: number;
  energy?: number;
  buff?: { stat: keyof Stats; value: number; seconds: number };
  cure?: boolean;
}

export interface ItemDef {
  id: string;
  kind: ItemKind;
  name: Loc;
  desc?: Loc;
  icon: IconSpec;
  price: number;
  stack: number;
  tier: number;
  gender: Gender;
  weapon?: { cls: WeaponClass; atk: number; speed: number };
  armor?: { slot: 'head' | 'body' | 'feet'; def: number; hp: number };
  accessory?: { slot: 'amulet' | 'ring'; stats: Partial<Stats> };
  use?: UseEffect;
  material?: string;
  tags?: string[];
  /** Уникальный легендарный предмет. */
  unique?: boolean;
}

export const ITEMS: Record<string, ItemDef> = {};

function add(def: ItemDef) {
  if (ITEMS[def.id]) throw new Error(`Duplicate item ${def.id}`);
  ITEMS[def.id] = def;
}

export function itemDef(id: string): ItemDef {
  const d = ITEMS[id];
  if (!d) throw new Error(`Unknown item: ${id}`);
  return d;
}

// ───────────────────────────── Материалы ─────────────────────────────

interface MatSpec {
  id: string;
  ru: string;
  en: string;
  g: Gender;
  tier: number;
  price: number;
  shape: string;
  c1: string;
  c2?: string;
  tags?: string[];
  desc?: Loc;
}

const MATS: MatSpec[] = [
  // общее
  { id: 'wood', ru: 'Древесина', en: 'Wood', g: 'f', tier: 0, price: 4, shape: 'log', c1: '#8a5a33', c2: '#c48a52', tags: ['build'] },
  { id: 'stone', ru: 'Камень', en: 'Stone', g: 'm', tier: 0, price: 3, shape: 'rock', c1: '#8a8f99', c2: '#c3c7cf', tags: ['build'] },
  { id: 'glass', ru: 'Стекло', en: 'Glass', g: 'n', tier: 0, price: 12, shape: 'vial', c1: '#a8e0ff', c2: '#ffffff' },
  // ярус I
  { id: 'bone', ru: 'Кость', en: 'Bone', g: 'f', tier: 1, price: 6, shape: 'bone', c1: '#e8e0c8', c2: '#a89c80', tags: ['monster'] },
  { id: 'rag', ru: 'Ветхая ткань', en: 'Old Cloth', g: 'f', tier: 1, price: 5, shape: 'cloth', c1: '#8b7d6b', c2: '#5d5145', tags: ['monster'] },
  { id: 'copper_ore', ru: 'Медная руда', en: 'Copper Ore', g: 'f', tier: 1, price: 8, shape: 'ore', c1: '#d9793f', c2: '#6b4a3a', tags: ['ore'] },
  { id: 'copper_bar', ru: 'Медный слиток', en: 'Copper Bar', g: 'm', tier: 1, price: 55, shape: 'bar', c1: '#e08a4a', c2: '#a0522d', tags: ['bar'] },
  { id: 'grave_moss', ru: 'Могильный мох', en: 'Grave Moss', g: 'm', tier: 1, price: 10, shape: 'herb', c1: '#6f9e5a', c2: '#3d5e33', tags: ['herb'] },
  { id: 'bat_wing', ru: 'Крыло нетопыря', en: 'Bat Wing', g: 'n', tier: 1, price: 9, shape: 'wing', c1: '#5a4a6a', c2: '#3a2e46', tags: ['monster'] },
  // ярус II
  { id: 'iron_ore', ru: 'Железная руда', en: 'Iron Ore', g: 'f', tier: 2, price: 14, shape: 'ore', c1: '#c8c8d0', c2: '#55525a', tags: ['ore'] },
  { id: 'iron_bar', ru: 'Железный слиток', en: 'Iron Bar', g: 'm', tier: 2, price: 95, shape: 'bar', c1: '#c9ccd6', c2: '#7a7f8c', tags: ['bar'] },
  { id: 'coal', ru: 'Уголь', en: 'Coal', g: 'm', tier: 2, price: 12, shape: 'rock', c1: '#2e2a2a', c2: '#57504c', tags: ['ore'] },
  { id: 'leech_slime', ru: 'Слизь пиявки', en: 'Leech Slime', g: 'f', tier: 2, price: 11, shape: 'blob', c1: '#5fa36a', c2: '#2f6b3c', tags: ['monster'] },
  { id: 'pearl', ru: 'Речной жемчуг', en: 'River Pearl', g: 'm', tier: 2, price: 60, shape: 'gem', c1: '#f2eee8', c2: '#bfb8c8', tags: ['gem'] },
  { id: 'crab_shell', ru: 'Панцирь краба', en: 'Crab Shell', g: 'm', tier: 2, price: 16, shape: 'shell', c1: '#c0583e', c2: '#6e2e22', tags: ['monster'] },
  // ярус III
  { id: 'steel_bar', ru: 'Стальной слиток', en: 'Steel Bar', g: 'm', tier: 3, price: 160, shape: 'bar', c1: '#9fb3c8', c2: '#4f6275', tags: ['bar'] },
  { id: 'spores', ru: 'Споры', en: 'Spores', g: 'p', tier: 3, price: 14, shape: 'dust', c1: '#c8b86a', c2: '#8a7a3a', tags: ['monster'] },
  { id: 'glowshroom', ru: 'Светогриб', en: 'Glowshroom', g: 'm', tier: 3, price: 22, shape: 'mushroom', c1: '#6fe3d0', c2: '#2a8a8a', tags: ['herb'] },
  { id: 'chitin', ru: 'Хитин', en: 'Chitin', g: 'm', tier: 3, price: 20, shape: 'shell', c1: '#5a6e3a', c2: '#2e3a1e', tags: ['monster'] },
  // ярус IV
  { id: 'silver_ore', ru: 'Серебряная руда', en: 'Silver Ore', g: 'f', tier: 4, price: 30, shape: 'ore', c1: '#e8eef8', c2: '#606878', tags: ['ore'] },
  { id: 'silver_bar', ru: 'Серебряный слиток', en: 'Silver Bar', g: 'm', tier: 4, price: 240, shape: 'bar', c1: '#eef2fa', c2: '#9aa4b8', tags: ['bar'] },
  { id: 'dwarf_slag', ru: 'Гномья окалина', en: 'Dwarven Slag', g: 'f', tier: 4, price: 26, shape: 'rock', c1: '#8a4a2a', c2: '#e0703a', tags: ['monster'] },
  { id: 'coal_crystal', ru: 'Угольный кристалл', en: 'Coal Crystal', g: 'm', tier: 4, price: 45, shape: 'gem', c1: '#3a3048', c2: '#ff7040', tags: ['gem'] },
  // ярус V
  { id: 'adamant_ore', ru: 'Адамантовая руда', en: 'Adamant Ore', g: 'f', tier: 5, price: 50, shape: 'ore', c1: '#6ad0a0', c2: '#2a4a48', tags: ['ore'] },
  { id: 'adamant_bar', ru: 'Адамантовый слиток', en: 'Adamant Bar', g: 'm', tier: 5, price: 380, shape: 'bar', c1: '#7ae0b0', c2: '#2a8a6a', tags: ['bar'] },
  { id: 'frost_crystal', ru: 'Морозный кристалл', en: 'Frost Crystal', g: 'm', tier: 5, price: 40, shape: 'gem', c1: '#bfefff', c2: '#5ab0e0', tags: ['gem'] },
  { id: 'parchment', ru: 'Древний пергамент', en: 'Ancient Parchment', g: 'm', tier: 5, price: 35, shape: 'scroll', c1: '#e8d8a8', c2: '#a08850', tags: ['monster'] },
  { id: 'ether_dust', ru: 'Эфирная пыль', en: 'Ether Dust', g: 'f', tier: 5, price: 55, shape: 'dust', c1: '#c8a8ff', c2: '#7a5ae0', tags: ['magic'] },
  // ярус VI
  { id: 'obsidian', ru: 'Обсидиан', en: 'Obsidian', g: 'm', tier: 6, price: 90, shape: 'gem', c1: '#2a2038', c2: '#8a5ae0', tags: ['bar'] },
  { id: 'fire_essence', ru: 'Огненная эссенция', en: 'Fire Essence', g: 'f', tier: 6, price: 70, shape: 'flame', c1: '#ffb040', c2: '#e04020', tags: ['magic'] },
  { id: 'ash_stone', ru: 'Пепельный камень', en: 'Ash Stone', g: 'm', tier: 6, price: 40, shape: 'rock', c1: '#6a6468', c2: '#b0a8a8', tags: ['monster'] },
  // ярус VII
  { id: 'heartstone', ru: 'Сердцекамень', en: 'Heartstone', g: 'm', tier: 7, price: 300, shape: 'gem', c1: '#ff5a6a', c2: '#ffd0a0', tags: ['gem', 'bar'] },
  { id: 'royal_gold', ru: 'Королевское золото', en: 'Royal Gold', g: 'n', tier: 7, price: 250, shape: 'bar', c1: '#ffd84a', c2: '#c08a20', tags: ['bar'] },
  { id: 'abyss_shard', ru: 'Осколок бездны', en: 'Abyss Shard', g: 'm', tier: 7, price: 200, shape: 'gem', c1: '#1a1028', c2: '#6a3aa0', tags: ['magic'] },
];

for (const m of MATS) {
  add({
    id: m.id, kind: 'material', name: L(m.ru, m.en), desc: m.desc, icon: { shape: m.shape, c1: m.c1, c2: m.c2 },
    price: m.price, stack: 99, tier: m.tier, gender: m.g, tags: m.tags,
  });
}

// ───────────────────────────── Оружие и броня ─────────────────────────────

export interface MaterialTier {
  id: string;
  tier: number;
  adj: AdjLoc;
  c1: string;
  c2: string;
  mult: number;
  bar?: string;
}

export const METALS: MaterialTier[] = [
  { id: 'rusty', tier: 0, adj: adj('Ржав', 'ый', 'ая', 'ое', 'ые', 'Rusty'), c1: '#9a6a4a', c2: '#5a3a2a', mult: 0.85 },
  { id: 'copper', tier: 1, adj: adj('Медн', 'ый', 'ая', 'ое', 'ые', 'Copper'), c1: '#e08a4a', c2: '#8a4a2a', mult: 1, bar: 'copper_bar' },
  { id: 'iron', tier: 2, adj: adj('Железн', 'ый', 'ая', 'ое', 'ые', 'Iron'), c1: '#c9ccd6', c2: '#6a6f7c', mult: 1.6, bar: 'iron_bar' },
  { id: 'steel', tier: 3, adj: adj('Стальн', 'ой', 'ая', 'ое', 'ые', 'Steel'), c1: '#a8c0d8', c2: '#4f6275', mult: 2.4, bar: 'steel_bar' },
  { id: 'silver', tier: 4, adj: adj('Серебрян', 'ый', 'ая', 'ое', 'ые', 'Silver'), c1: '#eef2fa', c2: '#8a94a8', mult: 3.4, bar: 'silver_bar' },
  { id: 'adamant', tier: 5, adj: adj('Адамантов', 'ый', 'ая', 'ое', 'ые', 'Adamant'), c1: '#7ae0b0', c2: '#2a7a5a', mult: 4.6, bar: 'adamant_bar' },
  { id: 'obsidian', tier: 6, adj: adj('Обсидианов', 'ый', 'ая', 'ое', 'ые', 'Obsidian'), c1: '#5a4078', c2: '#1a1028', mult: 6, bar: 'obsidian' },
  { id: 'heart', tier: 7, adj: adj('Сердцекаменн', 'ый', 'ая', 'ое', 'ые', 'Heartstone'), c1: '#ff6a78', c2: '#8a1a2a', mult: 7.6, bar: 'heartstone' },
];

export const WEAPON_BASES: Record<WeaponClass, { noun: Loc; g: Gender; atk: number; speed: number; shape: string }> = {
  sword: { noun: L('меч', 'Sword'), g: 'm', atk: 10, speed: 1, shape: 'sword' },
  spear: { noun: L('копьё', 'Spear'), g: 'n', atk: 11, speed: 0.95, shape: 'spear' },
  bow: { noun: L('лук', 'Bow'), g: 'm', atk: 9, speed: 1, shape: 'bow' },
  staff: { noun: L('посох', 'Staff'), g: 'm', atk: 9, speed: 1, shape: 'staff' },
  shield: { noun: L('щит и булава', 'Shield & Mace'), g: 'm', atk: 12, speed: 0.85, shape: 'shield' },
};

const ARMOR_BASES = {
  head: { noun: L('шлем', 'Helm'), g: 'm' as Gender, def: 3, hp: 5, shape: 'helm' },
  body: { noun: L('доспех', 'Armor'), g: 'm' as Gender, def: 6, hp: 10, shape: 'armor' },
  feet: { noun: L('сапоги', 'Boots'), g: 'p' as Gender, def: 2, hp: 3, shape: 'boots' },
};

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

for (const m of METALS) {
  for (const [cls, b] of Object.entries(WEAPON_BASES) as [WeaponClass, (typeof WEAPON_BASES)[WeaponClass]][]) {
    if (m.id === 'rusty' && cls !== 'sword' && cls !== 'spear') continue;
    add({
      id: `${m.id}_${cls}`, kind: 'weapon',
      name: L(`${m.adj.ru[b.g]} ${b.noun.ru}`, `${m.adj.en} ${b.noun.en}`),
      icon: { shape: b.shape, c1: m.c1, c2: m.c2 },
      price: Math.round(45 * Math.pow(m.mult, 1.6)), stack: 1, tier: m.tier, gender: b.g,
      weapon: { cls, atk: Math.round(b.atk * m.mult * 10) / 10, speed: b.speed }, material: m.id,
    });
  }
  if (m.id === 'rusty') continue;
  for (const [slot, b] of Object.entries(ARMOR_BASES) as ['head' | 'body' | 'feet', (typeof ARMOR_BASES)['head']][]) {
    add({
      id: `${m.id}_${slot}`, kind: 'armor',
      name: L(`${m.adj.ru[b.g]} ${b.noun.ru}`, `${m.adj.en} ${b.noun.en}`),
      icon: { shape: b.shape, c1: m.c1, c2: m.c2 },
      price: Math.round(35 * Math.pow(m.mult, 1.6)), stack: 1, tier: m.tier, gender: b.g,
      armor: { slot, def: Math.round(b.def * m.mult), hp: Math.round(b.hp * m.mult) }, material: m.id,
    });
  }
}

// Кожаная броня — стартовая
add({ id: 'leather_head', kind: 'armor', name: L('Кожаный капюшон', 'Leather Hood'), icon: { shape: 'helm', c1: '#8a5a33', c2: '#4a2e1a' }, price: 20, stack: 1, tier: 0, gender: 'm', armor: { slot: 'head', def: 1, hp: 3 } });
add({ id: 'leather_body', kind: 'armor', name: L('Кожаная куртка', 'Leather Jerkin'), icon: { shape: 'armor', c1: '#8a5a33', c2: '#4a2e1a' }, price: 30, stack: 1, tier: 0, gender: 'f', armor: { slot: 'body', def: 3, hp: 5 } });
add({ id: 'leather_feet', kind: 'armor', name: L('Кожаные сапоги', 'Leather Boots'), icon: { shape: 'boots', c1: '#8a5a33', c2: '#4a2e1a' }, price: 15, stack: 1, tier: 0, gender: 'p', armor: { slot: 'feet', def: 1, hp: 2 } });

// Аксессуары
add({ id: 'ring', kind: 'accessory', name: L('Кольцо', 'Ring'), icon: { shape: 'ring', c1: '#e0c060', c2: '#8a6a20' }, price: 60, stack: 1, tier: 1, gender: 'n', accessory: { slot: 'ring', stats: { luck: 2 } } });
add({ id: 'amulet', kind: 'accessory', name: L('Амулет', 'Amulet'), icon: { shape: 'amulet', c1: '#e0c060', c2: '#5aa6ff' }, price: 90, stack: 1, tier: 1, gender: 'm', accessory: { slot: 'amulet', stats: { maxHp: 10 } } });

// ───────────────────────────── Расходники ─────────────────────────────

add({ id: 'potion_small', kind: 'consumable', name: L('Малое зелье лечения', 'Small Healing Potion'), desc: L('Восстанавливает 40 здоровья.', 'Restores 40 health.'), icon: { shape: 'potion', c1: '#e04848', c2: '#ffb0a0' }, price: 30, stack: 20, tier: 1, gender: 'n', use: { heal: 40 } });
add({ id: 'potion_heal', kind: 'consumable', name: L('Зелье лечения', 'Healing Potion'), desc: L('Восстанавливает 100 здоровья.', 'Restores 100 health.'), icon: { shape: 'potion', c1: '#c02040', c2: '#ff8090' }, price: 80, stack: 20, tier: 2, gender: 'n', use: { heal: 100 } });
add({ id: 'potion_big', kind: 'consumable', name: L('Большое зелье лечения', 'Greater Healing Potion'), desc: L('Восстанавливает 250 здоровья.', 'Restores 250 health.'), icon: { shape: 'potion', c1: '#a01030', c2: '#ff6080' }, price: 200, stack: 20, tier: 4, gender: 'n', use: { heal: 250 } });
add({ id: 'potion_stamina', kind: 'consumable', name: L('Тонизирующий отвар', 'Stamina Tonic'), desc: L('Полная стамина и +50% к её восстановлению на 60 с.', 'Full stamina and +50% regen for 60 s.'), icon: { shape: 'potion', c1: '#48c060', c2: '#b0ffb0' }, price: 45, stack: 20, tier: 1, gender: 'm', use: { stamina: 999, buff: { stat: 'staminaRegen', value: 17, seconds: 60 } } });
add({ id: 'potion_mana', kind: 'consumable', name: L('Эфирный настой', 'Ether Draught'), desc: L('Восстанавливает 60 маны.', 'Restores 60 mana.'), icon: { shape: 'potion', c1: '#4870e0', c2: '#b0c8ff' }, price: 50, stack: 20, tier: 1, gender: 'm', use: { mana: 60 } });
add({ id: 'antidote', kind: 'consumable', name: L('Противоядие', 'Antidote'), desc: L('Снимает отравление, горение и кровотечение.', 'Cures poison, burning and bleeding.'), icon: { shape: 'potion', c1: '#c0e040', c2: '#f0ffb0' }, price: 35, stack: 20, tier: 1, gender: 'n', use: { cure: true } });

// Еда
add({ id: 'bread', kind: 'food', name: L('Хлеб', 'Bread'), desc: L('+25 бодрости, +15 здоровья.', '+25 energy, +15 health.'), icon: { shape: 'bread', c1: '#d8a050', c2: '#8a5a20' }, price: 12, stack: 30, tier: 0, gender: 'm', use: { energy: 25, heal: 15 } });
add({ id: 'cheese', kind: 'food', name: L('Сыр', 'Cheese'), desc: L('+35 бодрости, +20 здоровья.', '+35 energy, +20 health.'), icon: { shape: 'cheese', c1: '#f0d060', c2: '#c09a30' }, price: 20, stack: 30, tier: 0, gender: 'm', use: { energy: 35, heal: 20 } });
add({ id: 'apple', kind: 'food', name: L('Яблоко', 'Apple'), desc: L('+12 бодрости, +8 здоровья.', '+12 energy, +8 health.'), icon: { shape: 'apple', c1: '#d83838', c2: '#6ab040' }, price: 6, stack: 30, tier: 0, gender: 'n', use: { energy: 12, heal: 8 } });
add({ id: 'miner_stew', kind: 'food', name: L('Похлёбка шахтёра', "Miner's Stew"), desc: L('+60 бодрости, +40 здоровья, +10% защиты на 5 мин.', '+60 energy, +40 health, +10% defense for 5 min.'), icon: { shape: 'bowl', c1: '#a06a3a', c2: '#e0b070' }, price: 70, stack: 20, tier: 1, gender: 'f', use: { energy: 60, heal: 40, buff: { stat: 'def', value: 4, seconds: 300 } } });
add({ id: 'game_pie', kind: 'food', name: L('Пирог с дичью', 'Game Pie'), desc: L('+50 бодрости, +50 здоровья, +15% урона на 5 мин.', '+50 energy, +50 health, +15% damage for 5 min.'), icon: { shape: 'pie', c1: '#c08040', c2: '#6a3a1a' }, price: 95, stack: 20, tier: 2, gender: 'm', use: { energy: 50, heal: 50, buff: { stat: 'dmgPct', value: 15, seconds: 300 } } });

// ───────────────────────────── Сюжетные ─────────────────────────────

const SHARD_NAMES = ['Катакомб', 'Затопленных шахт', 'Грибного леса', 'Кузен гномов', 'Ледяной библиотеки', 'Пылающего собора', 'Тронного зала'];
const SHARD_EN = ['the Catacombs', 'the Flooded Mines', 'the Fungal Forest', 'the Dwarven Forges', 'the Frozen Library', 'the Burning Cathedral', 'the Throne Hall'];
SHARD_NAMES.forEach((n, i) =>
  add({
    id: `shard_${i + 1}`, kind: 'quest', name: L(`Осколок Печати ${n}`, `Seal Shard of ${SHARD_EN[i]}`),
    desc: L('Тёплый на ощупь. Внутри что-то бьётся, как сердце.', 'Warm to the touch. Something inside beats like a heart.'),
    icon: { shape: 'shard', c1: '#ffd0a0', c2: '#ff5a6a' }, price: 0, stack: 1, tier: i + 1, gender: 'm', tags: ['shard'],
  }),
);

// ───────────────────────────── Названия классов ─────────────────────────────

export const CLASS_NAMES: Record<WeaponClass, Loc> = {
  sword: L('Меч', 'Sword'),
  spear: L('Копьё', 'Spear'),
  bow: L('Лук', 'Bow'),
  staff: L('Посох', 'Staff'),
  shield: L('Щит', 'Shield'),
};

export const cap1 = cap;

import { L, type Loc } from './loc';

export type HairStyle = 'short' | 'long' | 'bald' | 'hood' | 'helmet' | 'bun' | 'wild' | 'cap';

export interface Look {
  hair: string;
  skin: string;
  top: string;
  bottom: string;
  accent: string;
  style: HairStyle;
  beard?: boolean;
  robe?: boolean;
  apron?: boolean;
  short?: boolean;
}

export type FactionId = 'church' | 'mages' | 'traders' | 'watch';

export interface NpcDef {
  id: string;
  name: Loc;
  role: Loc;
  faction?: FactionId;
  romance: boolean;
  companion?: 'spear' | 'bow' | 'staff' | 'sword' | 'shield' | 'holy';
  /** [сезон 0..3, день 1..28] */
  birthday: [number, number];
  gifts: { love: string[]; like: string[]; dislike: string[]; hate: string[] };
  look: Look;
  shop?: string;
  /** Только говорит в сценах: нет в списке отношений, нельзя дарить. */
  speakerOnly?: boolean;
}

const g = (love: string[], like: string[], dislike: string[] = [], hate: string[] = []) => ({ love, like, dislike, hate });

export const NPCS: Record<string, NpcDef> = {};
const add = (n: NpcDef) => (NPCS[n.id] = n);

export function npcDef(id: string): NpcDef {
  const n = NPCS[id];
  if (!n) throw new Error(`Unknown NPC ${id}`);
  return n;
}

// ── Романтические кандидаты ──
add({ id: 'mira', name: L('Мира Холт', 'Mira Holt'), role: L('Архивариус', 'Archivist'), romance: true, companion: 'staff', birthday: [3, 9],
  gifts: g(['parchment', 'frost_crystal', 'pearl'], ['glowshroom', 'apple', 'bread'], ['bone', 'coal'], ['leech_slime']),
  look: { hair: '#2a2438', skin: '#f0cfae', top: '#3a5a8a', bottom: '#2a2f4a', accent: '#c8a060', style: 'long' } });
add({ id: 'kai', name: L('Кай Вернер', 'Kai Werner'), role: L('Стражник', 'Guardsman'), faction: 'watch', romance: true, companion: 'spear', birthday: [1, 17],
  gifts: g(['game_pie', 'steel_bar'], ['bread', 'iron_bar', 'cheese'], ['spores'], ['rag']),
  look: { hair: '#c89048', skin: '#e8b890', top: '#8a3a2a', bottom: '#3a3a44', accent: '#c0c0c8', style: 'short' } });
add({ id: 'lis', name: L('Лис', 'Lis'), role: L('Скупщица', 'Fence'), romance: true, companion: 'bow', birthday: [2, 5],
  gifts: g(['pearl', 'royal_gold', 'ring'], ['silver_bar', 'coal_crystal'], ['bread'], ['grave_moss']),
  look: { hair: '#d8582a', skin: '#f0c8a0', top: '#3a4a3a', bottom: '#2a2a2a', accent: '#8a6a3a', style: 'hood' }, shop: 'fence' });
add({ id: 'theo', name: L('Брат Тео', 'Brother Theo'), role: L('Послушник', 'Acolyte'), faction: 'church', romance: true, companion: 'holy', birthday: [0, 21],
  gifts: g(['parchment', 'bread'], ['apple', 'cheese', 'grave_moss'], ['bone'], ['abyss_shard']),
  look: { hair: '#6a4a2a', skin: '#f2d2b0', top: '#e8e0d0', bottom: '#e8e0d0', accent: '#d8b040', style: 'short', robe: true } });
add({ id: 'nisa', name: L('Ниса Ренн', 'Nisa Renn'), role: L('Ученица магов', 'Mage Apprentice'), faction: 'mages', romance: true, companion: 'staff', birthday: [1, 3],
  gifts: g(['fire_essence', 'ether_dust'], ['glowshroom', 'coal_crystal'], ['apple'], ['rag']),
  look: { hair: '#e8e8f0', skin: '#e0b898', top: '#6a3a8a', bottom: '#4a2a6a', accent: '#ffb040', style: 'bun', robe: true } });
add({ id: 'erik', name: L('Эрик', 'Erik'), role: L('Подмастерье кузнеца', "Smith's Apprentice"), romance: true, companion: 'shield', birthday: [3, 14],
  gifts: g(['steel_bar', 'game_pie'], ['iron_bar', 'copper_bar', 'bread'], ['spores'], ['glowshroom']),
  look: { hair: '#3a2418', skin: '#d8a078', top: '#6a6a70', bottom: '#4a3a2a', accent: '#8a5a33', style: 'wild', apron: true } });
add({ id: 'veila', name: L('Вейла', 'Veila'), role: L('Травница', 'Herbalist'), romance: true, birthday: [0, 8],
  gifts: g(['glowshroom', 'grave_moss'], ['apple', 'spores'], ['coal'], ['obsidian']),
  look: { hair: '#5a8a4a', skin: '#f0d0b0', top: '#6a8a4a', bottom: '#4a5a3a', accent: '#e8c860', style: 'long' } });
add({ id: 'sebastian', name: L('Себастьян Кроу', 'Sebastian Crowe'), role: L('Наследник Торгового дома', 'Trading House Heir'), faction: 'traders', romance: true, birthday: [2, 22],
  gifts: g(['royal_gold', 'heartstone'], ['pearl', 'silver_bar'], ['bread', 'apple'], ['bone']),
  look: { hair: '#1a1a22', skin: '#f0d8c0', top: '#2a2a3a', bottom: '#1a1a24', accent: '#d8b040', style: 'short' } });
add({ id: 'eloise', name: L('Элоиза', 'Eloise'), role: L('Бард', 'Bard'), romance: true, birthday: [1, 26],
  gifts: g(['pearl', 'cheese'], ['apple', 'bread', 'bat_wing'], ['coal'], ['leech_slime']),
  look: { hair: '#e8b848', skin: '#f2d4b8', top: '#a83a4a', bottom: '#5a2a3a', accent: '#48a048', style: 'long' } });
add({ id: 'daren', name: L('Дарен Грей', 'Daren Grey'), role: L('Наёмник', 'Sellsword'), romance: true, companion: 'sword', birthday: [3, 2],
  gifts: g(['shard_1', 'game_pie'], ['iron_bar', 'bone', 'cheese'], ['glowshroom'], ['apple']),
  look: { hair: '#4a4a4a', skin: '#c89070', top: '#4a3a2a', bottom: '#2a2a2a', accent: '#8a8a8a', style: 'short', beard: true } });

// ── Остальные жители ──
add({ id: 'hilda', name: L('Хильда Железнорукая', 'Hilda Ironhand'), role: L('Кузнец', 'Blacksmith'), romance: false, birthday: [2, 11],
  gifts: g(['silver_bar', 'coal_crystal'], ['iron_bar', 'copper_bar', 'coal'], ['apple'], ['spores']),
  look: { hair: '#a83a1a', skin: '#e0a880', top: '#5a5a60', bottom: '#3a3028', accent: '#6a4a2a', style: 'bun', apron: true }, shop: 'smith' });
add({ id: 'osbert', name: L('Осберт Мирт', 'Osbert Myrt'), role: L('Алхимик', 'Alchemist'), romance: false, birthday: [0, 15],
  gifts: g(['glowshroom', 'ether_dust'], ['grave_moss', 'leech_slime', 'spores'], ['bread'], ['coal']),
  look: { hair: '#d8d8d8', skin: '#e8c0a0', top: '#3a6a5a', bottom: '#2a4a3a', accent: '#c8a040', style: 'bald', beard: true, robe: true }, shop: 'alchemist' });
add({ id: 'marta', name: L('Марта Пек', 'Marta Peck'), role: L('Торговка провизией', 'Grocer'), romance: false, birthday: [1, 9],
  gifts: g(['cheese', 'game_pie'], ['apple', 'bread'], ['bone'], ['leech_slime']),
  look: { hair: '#8a5a3a', skin: '#f0c8a8', top: '#c88a4a', bottom: '#6a4a3a', accent: '#f0f0e0', style: 'bun', apron: true }, shop: 'grocer' });
add({ id: 'albin', name: L('Мэтр Альбин', 'Master Albin'), role: L('Зачарователь', 'Enchanter'), faction: 'mages', romance: false, birthday: [3, 20],
  gifts: g(['ether_dust', 'frost_crystal'], ['pearl', 'parchment'], ['wood'], ['coal']),
  look: { hair: '#6a6a9a', skin: '#e0c0a8', top: '#3a3a8a', bottom: '#2a2a6a', accent: '#c0c0ff', style: 'long', beard: true, robe: true }, shop: 'enchanter' });
add({ id: 'mortimer', name: L('Епископ Мортимер Вейл', 'Bishop Mortimer Vale'), role: L('Глава Церкви', 'Head of the Church'), faction: 'church', romance: false, birthday: [0, 1],
  gifts: g(['royal_gold'], ['bread', 'parchment'], ['spores'], ['abyss_shard']),
  look: { hair: '#c8c8c8', skin: '#f0d8c8', top: '#f0e8d8', bottom: '#f0e8d8', accent: '#e0b030', style: 'bald', robe: true } });
add({ id: 'isolde', name: L('Архимагистр Изольда Ренн', 'Archmagister Isolde Renn'), role: L('Глава Гильдии магов', 'Head of the Mage Guild'), faction: 'mages', romance: false, birthday: [2, 28],
  gifts: g(['heartstone', 'ether_dust'], ['frost_crystal', 'parchment'], ['bread'], ['rag']),
  look: { hair: '#b8b8c8', skin: '#e8c8b0', top: '#4a2a6a', bottom: '#3a1a5a', accent: '#ffb040', style: 'long', robe: true } });
add({ id: 'livia', name: L('Ливия Кроу', 'Livia Crowe'), role: L('Глава Торгового дома', 'Head of the Trading House'), faction: 'traders', romance: false, birthday: [1, 1],
  gifts: g(['royal_gold', 'pearl'], ['silver_bar'], ['bone'], ['rag']),
  look: { hair: '#2a1a1a', skin: '#f0d8c0', top: '#6a1a2a', bottom: '#3a0a1a', accent: '#d8b040', style: 'bun' } });
add({ id: 'bran', name: L('Капитан Бран Холлоуэй', 'Captain Bran Holloway'), role: L('Командир Стражи', 'Captain of the Watch'), faction: 'watch', romance: false, birthday: [3, 25],
  gifts: g(['steel_bar', 'game_pie'], ['iron_bar', 'cheese'], ['spores'], ['fire_essence']),
  look: { hair: '#6a6a6a', skin: '#d8a888', top: '#8a3a2a', bottom: '#4a4a52', accent: '#c0c0c8', style: 'helmet', beard: true } });
add({ id: 'yorn', name: L('Старый Йорн', 'Old Yorn'), role: L('Могильщик', 'Gravedigger'), romance: false, birthday: [2, 28],
  gifts: g(['cheese', 'bone'], ['bread', 'grave_moss'], ['pearl'], ['glowshroom']),
  look: { hair: '#9a9a90', skin: '#d8b098', top: '#4a4238', bottom: '#3a3228', accent: '#6a5a3a', style: 'cap', beard: true } });
add({ id: 'ogden', name: L('Бургомистр Огден Пратт', 'Mayor Ogden Pratt'), role: L('Бургомистр', 'Mayor'), romance: false, birthday: [0, 26],
  gifts: g(['game_pie', 'royal_gold'], ['cheese', 'bread'], ['bone'], ['leech_slime']),
  look: { hair: '#8a7a6a', skin: '#f0c8b0', top: '#3a4a8a', bottom: '#2a2a3a', accent: '#d8b040', style: 'bald' } });
add({ id: 'tilda', name: L('Тильда', 'Tilda'), role: L('Хозяйка таверны', 'Innkeeper'), romance: false, birthday: [1, 20],
  gifts: g(['cheese', 'apple'], ['bread', 'game_pie'], ['coal'], ['spores']),
  look: { hair: '#c86a3a', skin: '#f0c0a0', top: '#8a6a4a', bottom: '#5a3a2a', accent: '#f0f0e0', style: 'bun', apron: true } });
add({ id: 'pip', name: L('Пип', 'Pip'), role: L('Посыльный', 'Errand Boy'), romance: false, birthday: [0, 11],
  gifts: g(['apple', 'bat_wing'], ['bread', 'cheese'], ['parchment'], ['coal']),
  look: { hair: '#d89848', skin: '#f0c8a0', top: '#5a7a3a', bottom: '#5a4a3a', accent: '#8a3a2a', style: 'cap', short: true } });
add({ id: 'ula', name: L('Бабушка Ула', 'Granny Ula'), role: L('Сказительница', 'Storyteller'), romance: false, birthday: [3, 28],
  gifts: g(['bread', 'grave_moss'], ['apple', 'cheese'], ['coal'], ['abyss_shard']),
  look: { hair: '#e8e8e8', skin: '#e0b8a0', top: '#6a4a6a', bottom: '#4a3a4a', accent: '#c8a060', style: 'hood', short: true } });
add({ id: 'borin', name: L('Борин Угольная Борода', 'Borin Coalbeard'), role: L('Гном-механик', 'Dwarven Mechanic'), romance: false, birthday: [2, 3],
  gifts: g(['coal_crystal', 'silver_bar'], ['coal', 'iron_bar', 'cheese'], ['apple'], ['glowshroom']),
  look: { hair: '#2a2a2a', skin: '#d8a080', top: '#6a4a2a', bottom: '#4a3a2a', accent: '#c8a040', style: 'bald', beard: true, short: true, apron: true } });
add({ id: 'agatha', name: L('Сестра Агата', 'Sister Agatha'), role: L('Лекарь', 'Healer'), faction: 'church', romance: false, birthday: [1, 14],
  gifts: g(['grave_moss', 'potion_heal'], ['bread', 'apple'], ['bone'], ['abyss_shard']),
  look: { hair: '#3a3a3a', skin: '#f0d0b8', top: '#2a2a3a', bottom: '#2a2a3a', accent: '#f0f0f0', style: 'hood', robe: true } });
add({ id: 'fenrik', name: L('Фенрик', 'Fenrik'), role: L('Лодочник', 'Boatman'), romance: false, birthday: [1, 6],
  gifts: g(['pearl', 'crab_shell'], ['cheese', 'bread'], ['spores'], ['fire_essence']),
  look: { hair: '#8a8a7a', skin: '#c89878', top: '#3a5a6a', bottom: '#3a3a3a', accent: '#c8a060', style: 'cap', beard: true } });
add({ id: 'corvin', name: L('Магистр Корвин', 'Magister Corvin'), role: L('Маг Серого Круга', 'Grey Circle Mage'), faction: 'mages', romance: false, birthday: [3, 7],
  gifts: g(['abyss_shard', 'heartstone'], ['ether_dust'], ['bread'], ['potion_heal']),
  look: { hair: '#1a1a1a', skin: '#e0c8b8', top: '#2a2a2a', bottom: '#1a1a1a', accent: '#a02040', style: 'hood', robe: true } });
add({ id: 'hanna', name: L('Вдова Ханна', 'Widow Hanna'), role: L('Фермерша', 'Farmer'), romance: false, birthday: [2, 16],
  gifts: g(['cheese', 'apple'], ['bread'], ['bone'], ['leech_slime']),
  look: { hair: '#8a6a4a', skin: '#e8b898', top: '#6a5a3a', bottom: '#4a4a3a', accent: '#c8c0a0', style: 'bun' } });

// Не житель города: король под Троном (говорит в финале и сражается рядом в добром финале)
add({ id: 'halvard', name: L('Хальвард', 'Halvard'), role: L('Король Эрдхейма', 'King of Erdheim'), romance: false, companion: 'sword', birthday: [0, 1], speakerOnly: true,
  gifts: g([], []),
  look: { hair: '#c8c8d0', skin: '#c8b8b0', top: '#3a2a4a', bottom: '#241a30', accent: '#e0c060', style: 'short', beard: true } });

add({ id: 'founder_spirit', name: L('Дух Основателя', 'Founder\u2019s Spirit'), role: L('Ночь духов', 'Night of Spirits'), romance: false, birthday: [2, 27], speakerOnly: true,
  gifts: g([], []),
  look: { hair: '#d8e8f0', skin: '#b8d0e0', top: '#8aa8c8', bottom: '#6a88a8', accent: '#e0f0ff', style: 'hood', robe: true } });

/** Облик героя по умолчанию. */
export const HERO_LOOK: Look = { hair: '#5a3a24', skin: '#f0c8a0', top: '#3a6a4a', bottom: '#4a3a2e', accent: '#c8a060', style: 'short' };

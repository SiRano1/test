import type { FactionId } from './npcs';
import { L, type Loc } from './loc';

export type Goal =
  | { kind: 'floor'; n: number }
  | { kind: 'boss'; floor: number }
  | { kind: 'lore'; count: number; ids?: string[] }
  | { kind: 'item'; item: string; qty: number }
  | { kind: 'talk'; npc: string }
  | { kind: 'kill'; monster: string; n: number }
  | { kind: 'upgrade'; id: string };

export interface QuestDef {
  id: string;
  giver: string;
  title: Loc;
  desc: Loc;
  goal: Goal;
  reward: {
    gold?: number;
    items?: [string, number][];
    friendship?: [string, number][];
    recipes?: string[];
    rep?: [FactionId, number][];
    flags?: string[];
  };
  /** Автоматически начать следующее задание. */
  next?: string;
  main?: boolean;
  /** Текст, который выдаёт даритель при сдаче (для заданий с предметом). */
  thanks?: Loc;
}

export const QUESTS: QuestDef[] = [
  // ── Главная линия ──
  {
    id: 'q_legacy', giver: 'yorn', main: true, title: L('Наследство', 'The Inheritance'),
    desc: L('Спуститься в катакомбы и добраться до старого гномьего лифта на 5-м этаже.', 'Descend into the catacombs and reach the old dwarven lift on floor 5.'),
    goal: { kind: 'floor', n: 5 }, reward: { gold: 100, items: [['potion_small', 2]] }, next: 'q_abbot',
  },
  {
    id: 'q_abbot', giver: 'yorn', main: true, title: L('Костяной Настоятель', 'The Bone Abbot'),
    desc: L('Упокоить Настоятеля на 10-м этаже и забрать осколок Печати.', 'Lay the Abbot to rest on floor 10 and claim the Seal shard.'),
    goal: { kind: 'boss', floor: 10 }, reward: { gold: 300 }, next: 'q_bishop',
  },
  {
    id: 'q_bishop', giver: 'mortimer', main: true, title: L('Благодарность Церкви', "The Church's Gratitude"),
    desc: L('Показать осколок епископу Мортимеру в храме.', 'Show the shard to Bishop Mortimer at the temple.'),
    goal: { kind: 'talk', npc: 'mortimer' }, reward: { gold: 200, rep: [['church', 15]] }, next: 'q_mines',
  },
  {
    id: 'q_mines', giver: 'mira', main: true, title: L('Спросить воду', 'Ask the Water'),
    desc: L('Записка советовала «спросить воду в шахтах». Найти в Затопленных шахтах (около 15-го этажа), что скрывает вода.', 'The note said to "ask the water in the mines". Find what the water hides in the Flooded Mines (around floor 15).'),
    goal: { kind: 'lore', count: 1, ids: ['flood_order'] }, reward: { gold: 150 }, next: 'q_seal',
  },
  {
    id: 'q_seal', giver: 'bran', main: true, title: L('Печать гвардии', 'The Guard Seal'),
    desc: L('На приказе о затоплении — печать гвардии. Спросить капитана Брана в казармах.', "The flood order bears the Guard's seal. Ask Captain Bran at the barracks."),
    goal: { kind: 'talk', npc: 'bran' }, reward: { rep: [['watch', 15]] }, next: 'q_gorm',
  },
  {
    id: 'q_gorm', giver: 'bran', main: true, title: L('Утопленник', 'The Drowned'),
    desc: L('Упокоить Старшину Горма на 20-м этаже.', 'Lay Foreman Gorm to rest on floor 20.'),
    goal: { kind: 'boss', floor: 20 }, reward: { gold: 600, rep: [['watch', 10]] }, next: 'q_forges',
  },
  {
    id: 'q_forges', giver: 'mira', main: true, title: L('Грибной лес', 'The Fungal Forest'),
    desc: L('Под шахтами — сады Эрдхейма. Мира просит найти, что стало с королевской семьёй.', "Below the mines lie Erdheim's gardens. Mira asks you to learn what became of the royal family."),
    goal: { kind: 'floor', n: 25 }, reward: { gold: 400 },
  },
  // ── Побочные ──
  {
    id: 'q_mira_lore', giver: 'mira', title: L('Надписи под землёй', 'Words Beneath'),
    desc: L('Найти три записи в подземелье для летописи Миры.', "Find three writings below for Mira's chronicle."),
    goal: { kind: 'lore', count: 3 }, reward: { gold: 120, friendship: [['mira', 150]], recipes: ['cook_honey'] },
  },
  {
    id: 'q_hilda_ore', giver: 'hilda', title: L('Руда для кузницы', 'Ore for the Forge'),
    desc: L('Принести Хильде 10 медной руды.', 'Bring Hilda 10 copper ore.'),
    goal: { kind: 'item', item: 'copper_ore', qty: 10 }, reward: { gold: 150, friendship: [['hilda', 120]] },
    thanks: L('Хорошая руда. Жилы там глубокие — держи плату, заслужил.', 'Good ore. Deep veins down there — here, you earned it.'),
  },
  {
    id: 'q_marta_moss', giver: 'marta', title: L('Мох для похлёбки', 'Moss for the Stew'),
    desc: L('Принести Марте 5 могильного мха.', 'Bring Marta 5 grave moss.'),
    goal: { kind: 'item', item: 'grave_moss', qty: 5 }, reward: { gold: 80, recipes: ['cook_stew'], friendship: [['marta', 100]] },
    thanks: L('Ох, спасибо, солнце! Держи рецепт похлёбки шахтёра — мамин.', "Oh, thank you, sunshine! Here's the miner's stew recipe — my mother's."),
  },
  {
    id: 'q_osbert_wings', giver: 'osbert', title: L('Крылья нетопырей', 'Bat Wings'),
    desc: L('Осберту нужно 4 крыла нетопыря для опытов.', 'Osbert needs 4 bat wings for his experiments.'),
    goal: { kind: 'item', item: 'bat_wing', qty: 4 }, reward: { gold: 100, recipes: ['brew_might', 'brew_fire'], friendship: [['osbert', 100]] },
    thanks: L('Превосходно! Взамен — два рецепта. Не взорвите усадьбу.', "Splendid! Two recipes in return. Don't blow up the manor."),
  },
  {
    id: 'q_kai_rats', giver: 'kai', title: L('Крысиная напасть', 'Rat Trouble'),
    desc: L('Истребить 10 могильных крыс в катакомбах.', 'Exterminate 10 grave rats in the catacombs.'),
    goal: { kind: 'kill', monster: 'grave_rat', n: 10 }, reward: { gold: 120, friendship: [['kai', 120]], rep: [['watch', 5]] },
  },
  {
    id: 'q_borin_roof', giver: 'borin', title: L('Крыша над головой', 'A Roof Overhead'),
    desc: L('Заказать у Борина восстановление главного зала усадьбы.', "Order the restoration of the manor's main hall from Borin."),
    goal: { kind: 'upgrade', id: 'hall' }, reward: { gold: 50, friendship: [['borin', 100]] },
  },
  {
    id: 'q_bran_drowned', giver: 'bran', title: L('Мёртвые в шахтах', 'Dead in the Mines'),
    desc: L('Упокоить 12 утопленников в Затопленных шахтах.', 'Put 12 drowned to rest in the Flooded Mines.'),
    goal: { kind: 'kill', monster: 'drowned', n: 12 }, reward: { gold: 300, rep: [['watch', 10]], items: [['iron_bar', 3]] },
  },
];

export const QUEST_BY_ID: Record<string, QuestDef> = Object.fromEntries(QUESTS.map((q) => [q.id, q]));

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
    goal: { kind: 'lore', count: 1, ids: ['king_daughter'] }, reward: { gold: 400, friendship: [['mira', 60]] }, next: 'q_spore',
  },
  {
    id: 'q_spore', giver: 'mira', main: true, title: L('Матерь Спор', 'The Spore Mother'),
    desc: L('Страж сада хранит третий осколок. 30-й этаж.', 'The warden of the garden keeps the third shard. Floor 30.'),
    goal: { kind: 'boss', floor: 30 }, reward: { gold: 800 }, next: 'q_dwarves',
  },
  {
    id: 'q_dwarves', giver: 'borin', main: true, title: L('Кузни гномов', 'The Dwarven Forges'),
    desc: L('Борин просит узнать, что стало с его народом. Железный Тан ждёт на 40-м этаже.', 'Borin asks you to learn what became of his people. The Iron Thane waits on floor 40.'),
    goal: { kind: 'boss', floor: 40 }, reward: { gold: 1200, friendship: [['borin', 200]] }, next: 'q_library',
  },
  {
    id: 'q_library', giver: 'mira', main: true, title: L('Ледяная библиотека', 'The Frozen Library'),
    desc: L('Где-то во льду спрятана подлинная летопись Эрдхейма. Найти второй том (около 47-го этажа).', "Somewhere in the ice lies Erdheim's true chronicle. Find the second volume (around floor 47)."),
    goal: { kind: 'lore', count: 1, ids: ['chronicle_2'] }, reward: { gold: 800 }, next: 'q_keeper',
  },
  {
    id: 'q_keeper', giver: 'mira', main: true, title: L('Хранитель Безмолвия', 'The Keeper of Silence'),
    desc: L('Пятый осколок стережёт архивариус, ставший льдом. 50-й этаж.', 'The fifth shard is guarded by an archivist turned to ice. Floor 50.'),
    goal: { kind: 'boss', floor: 50 }, reward: { gold: 1600 }, next: 'q_cathedral',
  },
  {
    id: 'q_cathedral', giver: 'bran', main: true, title: L('Пылающий собор', 'The Burning Cathedral'),
    desc: L('Там, где проводили Ритуал, до сих пор горит огонь. Серафим Пепла ждёт на 60-м этаже.', 'Where the Rite was performed, fire still burns. The Ash Seraph waits on floor 60.'),
    goal: { kind: 'boss', floor: 60 }, reward: { gold: 2200 }, next: 'q_throne',
  },
  {
    id: 'q_throne', giver: 'yorn', main: true, title: L('Глубинный Трон', 'The Deep Throne'),
    desc: L('Спуститься в Тронный зал (70-й этаж) и встретиться с королём.', 'Descend into the Throne Hall (floor 70) and face the king.'),
    goal: { kind: 'boss', floor: 70 }, reward: { gold: 3000 },
  },
  // ── Фракции ──
  {
    id: 'q_church_bones', giver: 'mortimer', title: L('Кости для оссуария', 'Bones for the Ossuary'),
    desc: L('Епископ просит 15 костей из катакомб — «для достойного погребения».', 'The Bishop asks for 15 bones from the catacombs — "for a proper burial".'),
    goal: { kind: 'item', item: 'bone', qty: 15 }, reward: { gold: 200, rep: [['church', 15]] },
    thanks: L('Свет благодарит тебя, дитя. Эти души наконец обретут покой.', 'The Light thanks you, child. These souls shall finally rest.'),
  },
  {
    id: 'q_mages_dust', giver: 'isolde', title: L('Эфирная пыль', 'Ether Dust'),
    desc: L('Архимагистру нужно 3 эфирной пыли из Ледяной библиотеки.', 'The Archmagister needs 3 ether dust from the Frozen Library.'),
    goal: { kind: 'item', item: 'ether_dust', qty: 3 }, reward: { gold: 400, rep: [['mages', 20]] },
    thanks: L('Превосходно. Серый Круг помнит тех, кто ему служит.', 'Excellent. The Grey Circle remembers those who serve it.'),
  },
  {
    id: 'q_mages_tomes', giver: 'isolde', title: L('Древние страницы', 'Ancient Pages'),
    desc: L('Принести 10 древних пергаментов для библиотеки Круга.', "Bring 10 sheets of ancient parchment for the Circle's library."),
    goal: { kind: 'item', item: 'parchment', qty: 10 }, reward: { gold: 500, rep: [['mages', 15]] },
    thanks: L('Эти страницы видели королевство живым. Спасибо.', 'These pages saw the kingdom alive. Thank you.'),
  },
  {
    id: 'q_mages_corvin', giver: 'corvin', title: L('Осколки бездны', 'Abyss Shards'),
    desc: L('Магистр Корвин тайком просит 2 осколка бездны.', 'Magister Corvin secretly asks for 2 abyss shards.'),
    goal: { kind: 'item', item: 'abyss_shard', qty: 2 }, reward: { gold: 700, rep: [['mages', 15]], flags: ['corvin_shards'] },
    thanks: L('Тише. Об этом — никому. Ты не представляешь, что можно сделать с этой силой.', "Hush. Not a word. You can't imagine what can be done with this power."),
  },
  {
    id: 'q_traders_gold', giver: 'livia', title: L('Королевское золото', 'Royal Gold'),
    desc: L('Ливия Кроу скупает королевское золото из Тронного зала. Принести 2 слитка.', 'Livia Crowe buys royal gold from the Throne Hall. Bring 2 ingots.'),
    goal: { kind: 'item', item: 'royal_gold', qty: 2 }, reward: { gold: 1500, rep: [['traders', 20]] },
    thanks: L('Чистое. Старая чеканка. Мой прапрадед держал такие же в руках. Держите — и ни слова об источнике.', "Pure. Old minting. My great-great-grandfather held ones just like these. Take this — and not a word about the source."),
  },
  {
    id: 'q_traders_pearls', giver: 'sebastian', title: L('Жемчуг для матушки', 'Pearls for Mother'),
    desc: L('Себастьяну нужно 5 речных жемчужин — для ожерелья Ливии.', "Sebastian needs 5 river pearls — for Livia's necklace."),
    goal: { kind: 'item', item: 'pearl', qty: 5 }, reward: { gold: 600, rep: [['traders', 15]], friendship: [['sebastian', 150]] },
    thanks: L('Мать будет довольна. Редкий случай. Спасибо — искренне.', 'Mother will be pleased. A rare occasion. Thank you — sincerely.'),
  },
  {
    id: 'q_watch_guards', giver: 'bran', title: L('Павшая гвардия', 'The Fallen Guard'),
    desc: L('Упокоить 10 осквернённых стражей Трона. Они были нашими братьями.', 'Put 10 defiled Throne Guards to rest. They were our brothers.'),
    goal: { kind: 'kill', monster: 'royal_guard', n: 10 }, reward: { gold: 1200, rep: [['watch', 20]] },
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

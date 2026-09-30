'use strict';
/* ===== Повседневная жизнь: ферма, рыбалка, крафт, заказы, проекты города, подземелья, обучающие задания ===== */
const CROPS = {
  carrot: { name: 'Морковь', icon: '🥕', seasons: [0, 2], days: 3, price: 30, seed: 12, col: '#f08a2a' },
  potato: { name: 'Картофель', icon: '🥔', seasons: [0, 2], days: 4, price: 42, seed: 16, col: '#c9a26a' },
  wheat: { name: 'Пшеница', icon: '🌾', seasons: [1, 2], days: 4, price: 36, seed: 14, col: '#e8c850' },
  tomato: { name: 'Помидор', icon: '🍅', seasons: [1], days: 5, price: 62, seed: 24, col: '#e04a3a' },
  pumpkin: { name: 'Тыква', icon: '🎃', seasons: [2], days: 6, price: 115, seed: 40, col: '#f0821a' },
  berry: { name: 'Ягоды', icon: '🍓', seasons: [0, 1], days: 4, price: 58, seed: 22, col: '#d83a6a' },
  winterroot: { name: 'Морозный корень', icon: '🫚', seasons: [3], days: 4, price: 72, seed: 26, col: '#9ad0f0' },
  healherb: { name: 'Целебная трава', icon: '🌿', seasons: [0, 1, 2, 3], days: 3, price: 34, seed: 15, col: '#4fc85a' }
};
for (const k in CROPS) {
  const c = CROPS[k];
  addItem('seed_' + k, { name: 'Семена: ' + c.name.toLowerCase(), type: 'seed', icon: '🌱', price: c.seed, crop: k, desc: `Сажайте на грядке фермы. Растёт ${c.days} дн. при ежедневном поливе. Сезон: ${c.seasons.map(s => SEASONS[s]).join(', ')}.` });
  addItem('crop_' + k, { name: c.name, type: 'crop', icon: c.icon, price: c.price, desc: 'Урожай. Продаётся почти по полной цене, идёт в готовку и алхимию.' });
}
const FISH = [
  { id: 'f_perch', name: 'Окунь', price: 26, w: 4, seasons: [0, 1, 2, 3] }, { id: 'f_carp', name: 'Карп', price: 34, w: 4, seasons: [0, 1, 2] },
  { id: 'f_trout', name: 'Форель', price: 62, w: 2, seasons: [0, 3] }, { id: 'f_pike', name: 'Щука', price: 70, w: 2, seasons: [1, 2] },
  { id: 'f_eel', name: 'Угорь', price: 95, w: 1.5, seasons: [0, 1, 2, 3], night: true }, { id: 'f_golden', name: 'Золотая рыбка', price: 320, w: 0.15, seasons: [0, 1, 2, 3] }
];
FISH.forEach(f => addItem(f.id, { name: f.name, type: 'fish', icon: f.id === 'f_golden' ? '🐠' : '🐟', price: f.price, desc: 'Свежая рыба. Продаётся, идёт в готовку.' }));
addItem('rod', { name: 'Удочка', type: 'tool', icon: '🎣', price: 60, stack: 1, desc: 'Подойдите к воде и нажмите E, затем E ещё раз, когда появится «!».' });
addItem('iron_ingot', { name: 'Железный слиток', type: 'material', icon: '🧱', price: 45, desc: 'Выплавлен из руды в кузнице. Нужен для оружия и заточки.' });
const FOODS = [
  ['food_bread', 'Хлеб', '🍞', { heal: 60 }, 'Мгновенно восстанавливает 60 здоровья.', 40],
  ['food_soup', 'Овощной суп', '🍲', { buff: { hpRegen: 3, defPct: 0.1 }, dur: 300, name: 'Овощной суп' }, 'Защита +10% и регенерация 3/с на 5 минут.', 90],
  ['food_stew', 'Жаркое', '🍖', { buff: { hpRegen: 5, dmgPct: 0.1 }, dur: 300, name: 'Жаркое' }, 'Урон +10% и регенерация 5/с на 5 минут.', 130],
  ['food_salad', 'Ягодный салат', '🥗', { buff: { spdPct: 0.12, dmgPct: 0.08 }, dur: 300, name: 'Ягодный салат' }, 'Скорость +12%, урон +8% на 5 минут.', 120],
  ['food_pie', 'Тыквенный пирог', '🥧', { buff: { xpPct: 0.25, hpRegen: 2 }, dur: 420, name: 'Тыквенный пирог' }, 'Опыт +25% на 7 минут.', 210],
  ['food_fish', 'Рыбный пирог', '🐟', { buff: { luckPct: 0.3, goldPct: 0.2 }, dur: 420, name: 'Рыбный пирог' }, 'Удача и золото +30%/+20% на 7 минут.', 180]
];
FOODS.forEach(f => addItem(f[0], { name: f[1], type: 'food', icon: f[2], effect: f[3], desc: f[4], price: f[5] }));
const FOODTYPES = ['crop', 'fish', 'food'];

/* Рецепты: cook — кухня у трактирщицы Берты, alch — стол алхимика Орло, smith — кузнец Грум */
const RECIPES = {
  cook: [
    { out: 'food_bread', ing: [['crop_wheat', 2]] }, { out: 'food_soup', ing: [['crop_carrot', 1], ['crop_potato', 1], ['crop_healherb', 1]] },
    { out: 'food_stew', ing: [['meat', 1], ['crop_potato', 2]] }, { out: 'food_salad', ing: [['crop_berry', 2], ['crop_carrot', 1]] },
    { out: 'food_pie', ing: [['crop_pumpkin', 1], ['crop_wheat', 2]] }, { out: 'food_fish', ing: [['f_perch', 1], ['crop_wheat', 1]] }
  ],
  alch: [
    { out: 'hp_0', ing: [['crop_healherb', 2]] }, { out: 'hp_1', ing: [['crop_healherb', 3], ['moonroot', 2]] }, { out: 'hp_2', ing: [['crop_healherb', 4], ['moonroot', 3], ['slime_gel', 1]] },
    { out: 'rs_0', ing: [['moonroot', 2]] }, { out: 'rs_1', ing: [['moonroot', 3], ['spider_silk', 1]] }, { out: 'rs_2', ing: [['moonroot', 4], ['ectoplasm', 1]] },
    { out: 'elx_might', ing: [['bear_claw', 1], ['crop_healherb', 2]] }, { out: 'elx_speed', ing: [['feather', 2], ['moonroot', 2]] }, { out: 'elx_skin', ing: [['troll_hide', 1], ['crop_healherb', 2]] },
    { out: 'lure', n: 2, ing: [['meat', 1], ['feather', 1]] }, { out: 'treat', n: 2, ing: [['meat', 1], ['crop_carrot', 1]] }, { out: 'scroll_town', ing: [['bone', 2], ['moonroot', 1]] }
  ],
  smith: [{ out: 'iron_ingot', ing: [['iron_ore', 3]] }]
};
/* Проекты города: постоянные улучшения за золото и материалы */
const PROJECTS = {
  bag: { name: 'Просторные сумки', icon: '🎒', desc: 'Портной шьёт большие сумки: +10 ячеек в инвентаре.', gold: 800, items: [['boar_tusk', 5], ['wolf_pelt', 5]] },
  mill: { name: 'Городская мельница', icon: '🏭', desc: 'Скупка урожая, рыбы и еды на 15% дороже.', gold: 1200, items: [['crop_wheat', 20]] },
  hospital: { name: 'Лечебница', icon: '🏥', desc: 'Штраф за смерть вдвое меньше.', gold: 1500, items: [['crop_healherb', 10], ['hp_1', 5]] },
  forge: { name: 'Большая кузница', icon: '🔨', desc: 'Заточку снаряжения можно довести до +8 (вместо +5).', gold: 2500, items: [['iron_ingot', 20]] }
};
const PLUS_MAX = 5;

/* Подземелья: блоки в нижней части карты (y >= 100) */
const DG_Y = 100;
const DUNGEONS = [
  { id: 'spider', name: 'Паучье гнездо', x0: 2, y0: 104, lvl: 5, boss: 'spiderqueen', entrance: [71, 66], mobs: [['spider', 7], ['slime', 3]], loot: [['spider_silk', 4], ['hp_1', 2]], gold: 260 },
  { id: 'crypt', name: 'Склеп королей', x0: 34, y0: 104, lvl: 9, boss: 'lichking', entrance: [33, 36], mobs: [['skeleton', 6], ['skmage', 3], ['wraith', 3]], loot: [['gem', 2], ['rs_2', 2]], gold: 520 },
  { id: 'grotto', name: 'Ледяной грот', x0: 66, y0: 104, lvl: 12, boss: 'frostgiant', entrance: [38, 14], mobs: [['snowwolf', 6], ['troll', 2]], loot: [['frost_fang', 3], ['hp_2', 3]], gold: 700 },
  { id: 'witch', name: 'Логово ведьмы', x0: 2, y0: 128, lvl: 7, boss: 'witch', entrance: [26, 84], mobs: [['slime', 6], ['goblin', 5], ['spider', 3]], loot: [['ectoplasm', 3], ['rs_1', 3]], gold: 380 }
];
DUNGEONS.forEach(d => { LOCS['d_' + d.id] = { name: d.name, x: d.x0 + 16, y: d.y0 + 11, r: 17, icon: '🕳️', dungeon: true }; });
LOCS.farmplots = { name: 'Грядки фермы', x: 42, y: 76, r: 6, icon: '🌱', hidden: true };
const RESPAWN_BOSSES = ['skar', 'spiderqueen', 'lichking', 'frostgiant', 'witch', 'ignis'];

/* Новые события календаря */
EVENTS.push(
  { id: 'fishing', name: 'Рыбацкий турнир', icon: '🎣', desc: 'На озере соревнуются рыбаки. Ловите рыбу — по итогам дня награда за очки улова!', when: d => d.day === 8, from: 10, to: 16 },
  { id: 'harvestfair', name: 'Ярмарка урожая', icon: '🧺', desc: 'Городская ярмарка: овощи, рыба и готовая еда скупаются в полтора раза дороже.', when: d => d.day === 22, from: 9, to: 18 }
);

/* Задания: обучающая цепочка «Наследство» и ремесленные */
Object.assign(QUESTS, {
  st1: { name: 'Письмо деда', giver: 'maren', lvl: 1, tut: true, desc: 'В Эльдергард вас привело письмо покойного деда. Покажите его мэру Маррену на площади.', offer: '', progress: 'Мэр ждёт вас на площади.', done: 'Так ты — внук старого Гаррета! Он был королевским лесничим, пока не уединился на ферме к югу от города. Перед смертью просил передать: «Пепел просыпается. Ферма — это ключ». Его ферма теперь твоя. Загляни туда: Хобб, наш фермер, присматривал за землёй.', obj: [{ t: 'talk', id: 'maren', text: 'Поговорить с мэром Марреном' }], reward: { xp: 40, gold: 50, items: [['seed_carrot', 6], ['seed_healherb', 3]] }, next: 'st2' },
  st2: { name: 'Ферма деда', giver: 'hobb', lvl: 1, tut: true, req: 'st1', autoOffer: true, desc: 'Найдите ферму деда, на юге от города, и поговорите с Хоббом.', offer: 'Ох, ты пришёл! Я Хобб, твой сосед. Ферма — вот эти грядки. Земля добрая, только запущена.', progress: 'Ферма — на юг от площади, дорога у трактира.', done: 'Вот твоя земля! Смотри: подойди к грядке и жми E — посадишь семена, потом каждый день поливай. Дождь поливает сам. Растёт по нескольку дней, урожай продавай в ящике у дома или неси в лавки. Вот ещё удочка деда — озеро на западе.', obj: [{ t: 'reach', id: 'farmplots', text: 'Дойти до фермы деда (юг)' }, { t: 'talk', id: 'hobb', text: 'Поговорить с Хоббом' }], reward: { xp: 60, gold: 30, items: [['rod', 1], ['seed_potato', 4], ['seed_carrot', 4]] }, turnIn: 'hobb' },
  st3: { name: 'Первые ростки', giver: 'hobb', lvl: 1, tut: true, req: 'st2', desc: 'Посадите 5 семян на грядках.', offer: 'Начнём с малого: посади пять семян. Помни про сезон — некоторые растения зимой не растут.', progress: 'Подойди к грядке и нажми E.', done: 'Отлично! Теперь каждое утро (после 6:00) поливай, и через несколько дней будет урожай. Кстати, мэр про тебя спрашивал — говорит, волки пошаливают.', obj: [{ t: 'plant', id: 'any', n: 5, text: 'Посадить семена' }], reward: { xp: 60, gold: 40, items: [['seed_wheat', 4], ['hp_0', 2]] } },
  st4: { name: 'Первый урожай', giver: 'hobb', lvl: 1, tut: true, req: 'st3', desc: 'Соберите 3 урожая. Не забывайте поливать!', offer: 'Теперь жди и поливай. Как созреет — собери три урожая.', progress: 'Морковь растёт 3 дня. Поливай каждый день!', done: 'Свежие овощи! Ничего вкуснее нет. Вот тебе семян побольше — расширяй огород.', obj: [{ t: 'harvest', id: 'any', n: 3, text: 'Собрать урожай' }], reward: { xp: 90, gold: 100, items: [['seed_carrot', 8], ['seed_healherb', 6]] } },
  st5: { name: 'Первый улов', giver: 'hobb', lvl: 1, tut: true, req: 'st2', desc: 'Поймайте 2 рыбы удочкой на озере (запад от города).', offer: 'Озеро на западе кишит рыбой. Подойди к воде, нажми E — забрось удочку и жми E, когда появится «!».', progress: 'Озеро — на запад, за руинами.', done: 'Уха будет! Рыбу можно продать или приготовить у Берты.', obj: [{ t: 'fish', id: 'any', n: 2, text: 'Поймать рыбу' }], reward: { xp: 70, gold: 60, items: [['crop_wheat', 3]] } },
  st6: { name: 'Домашний очаг', giver: 'berta', lvl: 1, tut: true, req: 'st2', desc: 'Приготовьте любое блюдо на кухне у Берты.', offer: 'Хочешь стать настоящим хозяином? Научись готовить: принеси овощи и рыбу — я покажу, как приготовить блюдо. Еда даёт силы в бою!', progress: 'Нужны продукты: пшеница, морковь, мясо…', done: 'Вот это дело! Теперь ты знаешь: хорошая еда — половина победы.', obj: [{ t: 'craft', id: 'cook', text: 'Приготовить блюдо у Берты' }], reward: { xp: 80, gold: 50, items: [['food_bread', 3]] } }
});
QUESTS.mq1.req = 'st3'; QUESTS.st1.autoNext = 'st2';
SHOPS.farm = { name: 'Семена Хобба', npc: 'hobb', greeting: 'Сеять надо по сезону!', stock: () => Object.keys(CROPS).map(k => 'seed_' + k).concat(['rod', 'treat']) };
NPCS.find(n => n.id === 'hobb').shop = 'farm';

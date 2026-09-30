'use strict';
/* ===== Предметы, питомцы, монстры, магазины ===== */
const ITEMS = {};
function addItem(id, o) { ITEMS[id] = Object.assign({ id, type: 'misc', tier: 0, price: 5, stack: 99, desc: '', icon: '📦', stats: {}, req: 1 }, o); return ITEMS[id]; }

const TIER_COL = ['#c9c9c9', '#7fd06a', '#5ab0ff', '#c77dff', '#ffb02e'];
const TIER_LABEL = ['Обычное', 'Хорошее', 'Редкое', 'Эпическое', 'Легендарное'];
const T_REQ = [1, 5, 10, 15];

/* Оружие: у каждого класса — своё, чужое надеть нельзя */
const WNAMES = {
  axe: ['Ржавый топор', 'Боевой топор', 'Секира ярла', 'Топор Кровавой луны'],
  staff: ['Ореховый посох', 'Посох чародея', 'Посох архимага', 'Жезл Звёздной бури'],
  dagger: ['Стилет', 'Кинжал теней', 'Клинок гадюки', 'Коготь Ночи'],
  sickle: ['Костяной серп', 'Серп жницы', 'Серп Лунного леса', 'Серп Первозданной рощи'],
  bow: ['Охотничий лук', 'Тисовый лук', 'Эльфийский лук', 'Лук Небесного ястреба']
};
const WICON = { axe: '🪓', staff: '🪄', dagger: '🗡️', sickle: '🌙', bow: '🏹' };
const WTYPE_NAME = { axe: 'Топор', staff: 'Посох', dagger: 'Кинжал', sickle: 'Серп', bow: 'Лук' };
const WCLASS = { axe: 'berserk', staff: 'mage', dagger: 'assassin', sickle: 'druid', bow: 'hunter' };
const WDMG = [6, 14, 26, 42], WPRICE = [70, 320, 1100, 3200];
const WEXTRA = { axe: t => ({ critDmg: 0.1 * (t + 1) }), staff: t => ({ res: 15 * (t + 1) }), dagger: t => ({ crit: 0.025 * (t + 1) }), sickle: t => ({ regen: 1 * (t + 1) }), bow: t => ({ crit: 0.02 * (t + 1) }) };
for (const wt in WNAMES) for (let t = 0; t < 4; t++) {
  addItem(`w_${wt}_${t}`, {
    name: WNAMES[wt][t], type: 'weapon', slot: 'weapon', wtype: wt, cls: WCLASS[wt], tier: t, icon: WICON[wt], price: WPRICE[t], req: T_REQ[t], stack: 1,
    stats: Object.assign({ dmg: WDMG[t] }, WEXTRA[wt](t)), desc: `${WTYPE_NAME[wt]}. Может носить только ${CLASSES[WCLASS[wt]].name}.`
  });
}

/* Броня */
const ANAMES = {
  heavy: { body: ['Кольчуга новобранца', 'Латная кираса', 'Доспех рыцаря', 'Броня драконоборца'], head: ['Железный шлем', 'Стальной шлем', 'Рогатый шлем ярла', 'Корона Стального короля'], boots: ['Тяжёлые сапоги', 'Стальные сапоги', 'Латные поножи', 'Сапоги Титана'] },
  medium: { body: ['Кожаная куртка', 'Дублёный колет', 'Доспех следопыта', 'Доспех ночного охотника'], head: ['Кожаный капюшон', 'Капюшон странника', 'Маска следопыта', 'Маска Тени'], boots: ['Кожаные сапоги', 'Сапоги следопыта', 'Мягкие сапоги', 'Сапоги бесшумного шага'] },
  cloth: { body: ['Роба ученика', 'Роба волшебника', 'Мантия мудреца', 'Мантия архимага'], head: ['Колпак ученика', 'Шляпа чародея', 'Венец мудреца', 'Диадема звёзд'], boots: ['Тряпичные туфли', 'Туфли волшебника', 'Сапоги мудреца', 'Туфли звёздного шага'] }
};
const ATYPE_NAME = { heavy: 'Тяжёлая', medium: 'Средняя', cloth: 'Тканевая' };
const SLOT_NAME = { weapon: 'Оружие', head: 'Голова', body: 'Тело', boots: 'Обувь', ring: 'Кольцо', amulet: 'Амулет' };
const SLOT_ICON = { weapon: '⚔️', head: '⛑️', body: '🥋', boots: '👢', ring: '💍', amulet: '📿' };
const ADEF = { heavy: [5, 11, 20, 34], medium: [3, 7, 13, 22], cloth: [1, 3, 6, 10] };
const SLOTF = { body: 1, head: 0.6, boots: 0.5 }, SLOTP = { body: 1, head: 0.6, boots: 0.5 };
const APRICE = [45, 190, 640, 1900];
const AICON = { body: { heavy: '🛡️', medium: '🥼', cloth: '👘' }, head: { heavy: '⛑️', medium: '🎩', cloth: '🧙' }, boots: { heavy: '🥾', medium: '👞', cloth: '🩴' } };
for (const at in ANAMES) for (const sl in ANAMES[at]) for (let t = 0; t < 4; t++) {
  const f = SLOTF[sl], st = { def: Math.round(ADEF[at][t] * f) };
  if (at === 'heavy') st.hp = Math.round(12 * (t + 1) * f);
  if (at === 'medium') { st.crit = +(0.008 * (t + 1) * f).toFixed(3); st.spd = Math.round(2 * (t + 1) * f); }
  if (at === 'cloth') st.res = Math.round(14 * (t + 1) * f);
  addItem(`a_${at}_${sl}_${t}`, {
    name: ANAMES[at][sl][t], type: 'armor', slot: sl, atype: at, tier: t, icon: AICON[sl][at], price: Math.round(APRICE[t] * SLOTP[sl]), req: T_REQ[t], stack: 1, stats: st,
    desc: `${ATYPE_NAME[at]} броня.`
  });
}

/* Кольца и амулеты */
const METALS = ['Медное', 'Серебряное', 'Золотое'], ATIER = [0, 2, 3], RPRICE = [120, 520, 1650], RREQ = [1, 6, 12];
const RINGS = [
  { k: 'силы', stat: 'dmg', v: [3, 7, 13] }, { k: 'стража', stat: 'def', v: [3, 6, 11] }, { k: 'жизни', stat: 'hp', v: [25, 60, 120] },
  { k: 'меткости', stat: 'crit', v: [0.02, 0.04, 0.07] }, { k: 'ветра', stat: 'spd', v: [6, 12, 20] }
];
RINGS.forEach((r, i) => METALS.forEach((m, t) => addItem(`ring_${i}_${t}`, { name: `${m} кольцо ${r.k}`, type: 'ring', slot: 'ring', icon: '💍', tier: ATIER[t], price: RPRICE[t], req: RREQ[t], stack: 1, stats: { [r.stat]: r.v[t] }, desc: 'Ювелирное кольцо.' })));
const AMU_T = ['Простой', 'Резной', 'Королевский'];
const AMULETS = [
  { k: 'мудрости', stat: 'res', v: [25, 55, 100] }, { k: 'удачи', stat: 'luck', v: [0.1, 0.2, 0.35] }, { k: 'крови', stat: 'lifesteal', v: [0.02, 0.04, 0.07] },
  { k: 'отваги', stat: 'xp', v: [0.05, 0.1, 0.15] }, { k: 'стойкости', stat: 'regen', v: [1, 2.5, 5] }
];
AMULETS.forEach((r, i) => AMU_T.forEach((m, t) => addItem(`amu_${i}_${t}`, { name: `${m} амулет ${r.k}`, type: 'amulet', slot: 'amulet', icon: '📿', tier: ATIER[t], price: RPRICE[t] + 60, req: RREQ[t], stack: 1, stats: { [r.stat]: r.v[t] }, desc: 'Магический амулет.' })));
// Уникальные редкие вещи
addItem('amu_moon', { name: 'Лунный клык', type: 'amulet', slot: 'amulet', icon: '🌙', tier: 4, price: 2500, req: 8, stack: 1, stats: { crit: 0.08, lifesteal: 0.05, dmg: 8 }, desc: 'Клык лунного вожака. Пульсирует серебристым светом.' });
addItem('ring_ash', { name: 'Кольцо Пепельного Господина', type: 'ring', slot: 'ring', icon: '💍', tier: 4, price: 4000, req: 14, stack: 1, stats: { dmg: 20, hp: 150, def: 10 }, desc: 'Трофей из Пепельной крепости.' });
addItem('w_axe_troll', { name: 'Кулак Горака', type: 'weapon', slot: 'weapon', wtype: 'axe', cls: 'berserk', tier: 4, icon: '🪓', price: 3500, req: 10, stack: 1, stats: { dmg: 36, hp: 60, critDmg: 0.2 }, desc: 'Топор из трофеев вождя троллей. Только Берсерк.' });

/* Расходуемое */
const POT = [['Малое зелье здоровья', 60, 25], ['Зелье здоровья', 140, 70], ['Большое зелье здоровья', 300, 180]];
POT.forEach((p, i) => addItem(`hp_${i}`, { name: p[0], type: 'potion', icon: '🧪', tier: i, price: p[2], effect: { heal: p[1] }, desc: `Восстанавливает ${p[1]} здоровья.` }));
const TON = [['Малый тоник', 45, 25], ['Тоник', 90, 70], ['Крепкий тоник', 160, 180]];
TON.forEach((p, i) => addItem(`rs_${i}`, { name: p[0], type: 'potion', icon: '⚗️', tier: i, price: p[2], effect: { res: p[1] }, desc: `Восстанавливает ${p[1]} ресурса: ману, выносливость или ярость — в зависимости от класса.` }));
const ELIX = [
  ['elx_might', 'Эликсир мощи', '💪', { dmgPct: 0.25 }, 'Урон +25% на 3 минуты.', 95],
  ['elx_speed', 'Эликсир проворства', '🦶', { spdPct: 0.25 }, 'Скорость +25% на 3 минуты.', 85],
  ['elx_skin', 'Эликсир каменной кожи', '🪨', { defPct: 0.35 }, 'Защита +35% на 3 минуты.', 90],
  ['elx_wise', 'Эликсир мудрости', '📚', { xpPct: 0.3 }, 'Опыт +30% на 3 минуты.', 110],
  ['elx_luck', 'Эликсир удачи', '🍀', { goldPct: 0.3, luckPct: 0.3 }, 'Золото и добыча +30% на 3 минуты.', 110],
  ['elx_regen', 'Эликсир регенерации', '💚', { hpRegen: 6 }, 'Здоровье +6/с на 3 минуты.', 100]
];
ELIX.forEach(e => addItem(e[0], { name: e[1], type: 'elixir', icon: e[2], tier: 2, price: e[5], effect: { buff: e[3], dur: 180, name: e[1] }, desc: e[4] }));
addItem('scroll_town', { name: 'Свиток возврата', type: 'scroll', icon: '📜', price: 60, effect: { town: true }, desc: 'Мгновенно переносит на площадь Эльдергарда.' });
addItem('lure', { name: 'Приманка для зверей', type: 'misc', icon: '🍖', price: 40, desc: 'Нужна охотнику для умения «Приручение».' });
addItem('treat', { name: 'Лакомство для питомца', type: 'petfood', icon: '🦴', price: 30, desc: 'Даёт активному питомцу 60 опыта.' });

/* Материалы и трофеи */
const MATS = [
  ['rat_tail', 'Крысиный хвост', '🐀', 3], ['fox_tail', 'Лисий хвост', '🦊', 8], ['boar_tusk', 'Клык кабана', '🦷', 9], ['meat', 'Сырое мясо', '🥩', 5], ['wolf_pelt', 'Волчья шкура', '🐺', 12],
  ['feather', 'Перо ястреба', '🪶', 6], ['spider_silk', 'Паучий шёлк', '🕸️', 10], ['slime_gel', 'Слизь', '🟢', 6], ['goblin_ear', 'Ухо гоблина', '👂', 8],
  ['bone', 'Древняя кость', '🦴', 9], ['ectoplasm', 'Эктоплазма', '👻', 22], ['bear_claw', 'Коготь медведя', '🐾', 20], ['troll_hide', 'Шкура тролля', '🧌', 40],
  ['frost_fang', 'Ледяной клык', '❄️', 35], ['ash_crystal', 'Пепельный кристалл', '🔻', 60], ['dragon_scale', 'Чешуя дракона', '🐉', 150], ['gem', 'Самоцвет', '💎', 80],
  ['moonroot', 'Лунный корень', '🌱', 8], ['iron_ore', 'Железная руда', '⛏️', 12]
];
MATS.forEach(m => addItem(m[0], { name: m[1], type: 'material', icon: m[2], price: m[3], desc: 'Трофей или материал. Можно продать торговцу.' }));
addItem('sigil', { name: 'Пепельная печать', type: 'quest', icon: '🔥', price: 0, desc: 'Знак культа Пепла, выжженный на металле.' });
addItem('cult_note', { name: 'Записка культистов', type: 'quest', icon: '📜', price: 0, stack: 1, desc: 'Обрывок письма на древнем языке. Нужен переводчик.' });
addItem('ember', { name: 'Тлеющий кристалл', type: 'quest', icon: '🔶', price: 0, stack: 1, desc: 'Кристалл из сердца горы. Тёплый на ощупь.' });
addItem('lyrics', { name: 'Старые ноты', type: 'quest', icon: '🎼', price: 0, stack: 1, desc: 'Пожелтевшие ноты забытой баллады.' });
addItem('sealkey', { name: 'Печать Пепла (ключ)', type: 'quest', icon: '🗝️', price: 0, stack: 1, desc: 'Ключ к воротам Пепельной крепости.' });

/* ===== Питомцы (редкость: 0 обычный … 4 легендарный) ===== */
const RARITY = [
  { n: 'Обычный', c: '#c9c9c9', m: 1, ch: 1 }, { n: 'Необычный', c: '#7fd06a', m: 1.3, ch: 0.7 }, { n: 'Редкий', c: '#5ab0ff', m: 1.7, ch: 0.45 },
  { n: 'Эпический', c: '#c77dff', m: 2.2, ch: 0.25 }, { n: 'Легендарный', c: '#ffb02e', m: 3, ch: 0.1 }
];
const PETS = {
  fox: { name: 'Рыжий лисёнок', kind: 'quad', r: 0, col: '#d9793a', acc: '#fff3e0', hp: 40, dmg: 5, spd: 118, size: 0.55, perk: '+10% золота', mods: { gold: 0.1 }, price: 150, icon: '🦊' },
  piglet: { name: 'Кабанчик', kind: 'quad', r: 0, col: '#8a5a3a', acc: '#d8d0b8', hp: 60, dmg: 6, spd: 100, size: 0.6, perk: '+8% здоровья хозяина', mods: { hpPct: 0.08 }, price: 160, icon: '🐗' },
  hawk: { name: 'Ястреб', kind: 'bird', r: 1, col: '#8a6a44', acc: '#fff', hp: 45, dmg: 8, spd: 135, size: 0.6, perk: '+5% шанс крита', mods: { crit: 0.05 }, price: 480, icon: '🦅' },
  wolfpup: { name: 'Волчонок', kind: 'quad', r: 1, col: '#8a8f98', acc: '#dfe3e8', hp: 70, dmg: 9, spd: 125, size: 0.65, perk: '+6% урона', mods: { dmgPct: 0.06 }, price: 520, icon: '🐺' },
  cub: { name: 'Медвежонок', kind: 'quad', r: 2, col: '#7a5236', acc: '#c9a070', hp: 130, dmg: 13, spd: 100, size: 0.75, perk: '+10% защиты', mods: { defPct: 0.1 }, price: 1500, icon: '🐻' },
  panther: { name: 'Чёрная пантера', kind: 'quad', r: 2, col: '#26262e', acc: '#f2d24a', hp: 100, dmg: 17, spd: 150, size: 0.75, perk: '+8% скорости', mods: { spdPct: 0.08 }, price: 1600, icon: '🐈‍⬛' },
  stag: { name: 'Белый олень', kind: 'quad', r: 3, col: '#eef0f4', acc: '#c9a070', hp: 190, dmg: 16, spd: 140, size: 0.9, perk: 'Регенерация 1.5 зд/с', mods: { regen: 1.5 }, price: 6000, icon: '🦌' },
  frostwolf: { name: 'Ледяной волк', kind: 'quad', r: 3, col: '#bcd8f0', acc: '#ffffff', hp: 170, dmg: 24, spd: 140, size: 0.85, perk: '+12% крит. урона', mods: { critDmg: 0.12 }, price: 6500, icon: '🐺' },
  griffin: { name: 'Грифончик', kind: 'bird', r: 4, col: '#c99a4a', acc: '#f6f0e0', hp: 260, dmg: 30, spd: 150, size: 0.95, perk: '+10% ко всем характеристикам', mods: { hpPct: 0.1, dmgPct: 0.1, defPct: 0.1 }, price: 15000, icon: '🦅' },
  drake: { name: 'Дракончик', kind: 'dragon', r: 4, col: '#b8342a', acc: '#ffd27a', hp: 300, dmg: 34, spd: 130, size: 0.85, perk: '+15% урона, огненное дыхание', mods: { dmgPct: 0.15 }, price: 18000, icon: '🐉' }
};

/* ===== Монстры ===== */
const MON = {
  rat: { name: 'Крыса-переросток', kind: 'quad', col: '#7a6a5a', acc: '#d9a0a0', size: 0.55, hp: 24, dmg: 5, spd: 78, aggro: 150, rng: 24, cd: 1.1, xp: 6, gold: [1, 4], lvl: [1, 2], drops: [['rat_tail', 0.6], ['hp_0', 0.05]], desc: 'Жирные крысы, плодящиеся в погребах и норах. Кусаются, но трусливы поодиночке.', weak: 'Огонь' },
  fox: { name: 'Рыжая лиса', kind: 'quad', col: '#d9793a', acc: '#fff3e0', size: 0.55, hp: 22, dmg: 4, spd: 120, aggro: 0, rng: 24, cd: 1, xp: 5, gold: [0, 2], lvl: [1, 2], passive: true, drops: [['fox_tail', 0.5]], tame: 'fox', tameCh: 0.2, desc: 'Осторожная плутовка лугов. Не нападает, убегает при виде людей. Хороший кандидат для приручения.', weak: 'Неповоротлива в ловушках' },
  boar: { name: 'Дикий кабан', kind: 'quad', col: '#7a5236', acc: '#efe6c8', size: 0.7, hp: 55, dmg: 9, spd: 90, aggro: 130, rng: 28, cd: 1.3, xp: 12, gold: [2, 6], lvl: [1, 3], drops: [['boar_tusk', 0.5], ['meat', 0.7]], tame: 'piglet', tameCh: 0.18, desc: 'Упрямый кабан с острыми клыками. Бросается в лобовую атаку, если его потревожить.', weak: 'Удары со спины' },
  wolf: { name: 'Серый волк', kind: 'quad', col: '#8a8f98', acc: '#dfe3e8', size: 0.7, hp: 60, dmg: 10, spd: 108, aggro: 230, rng: 28, cd: 1.0, xp: 16, gold: [2, 8], lvl: [2, 4], drops: [['wolf_pelt', 0.6], ['meat', 0.4]], tame: 'wolfpup', tameCh: 0.14, desc: 'Хищник, охотящийся стаями. Быстро окружает добычу.', weak: 'Огонь и яд' },
  hawk: { name: 'Дикий ястреб', kind: 'bird', col: '#8a6a44', acc: '#ffffff', size: 0.55, hp: 18, dmg: 6, spd: 130, aggro: 0, rng: 26, cd: 1, xp: 8, gold: [0, 3], lvl: [2, 3], passive: true, flying: true, drops: [['feather', 0.7]], tame: 'hawk', tameCh: 0.14, desc: 'Хищная птица небес. Держится на расстоянии, легко ускользает.', weak: 'Стрелы' },
  bandit: { name: 'Разбойник', kind: 'human', col: '#6a4a30', acc: '#c9a070', hair: '#3a2a1a', size: 1, hp: 72, dmg: 12, spd: 94, aggro: 210, rng: 34, cd: 1.0, xp: 22, gold: [8, 22], lvl: [3, 5], drops: [['sigil', 0.35], ['hp_0', 0.2], ['a_medium_body_0', 0.04]], desc: 'Головорезы с лесных дорог. Многие носят на плече знак пепельного культа.', weak: 'Оглушение' },
  archer: { name: 'Разбойник-лучник', kind: 'human', col: '#3d5a3a', acc: '#c9a070', hair: '#5a3a22', size: 1, hp: 55, dmg: 11, spd: 90, aggro: 300, rng: 270, cd: 1.6, xp: 24, gold: [8, 22], ranged: { spd: 380, col: '#d8c090', arrow: true }, lvl: [3, 5], drops: [['sigil', 0.3], ['feather', 0.3], ['rs_0', 0.15]], desc: 'Стреляют из кустов, пока вы заняты их приятелями. Хрупкие вблизи.', weak: 'Сближение' },
  spider: { name: 'Лесной паук', kind: 'spider', col: '#3a2f3f', acc: '#c34a4a', size: 0.85, hp: 62, dmg: 11, spd: 108, aggro: 190, rng: 28, cd: 1.1, xp: 20, gold: [1, 6], lvl: [4, 7], poison: true, drops: [['spider_silk', 0.65]], desc: 'Крупный паук, чей яд замедляет добычу. Плетёт сети между деревьями.', weak: 'Огонь' },
  slime: { name: 'Болотная слизь', kind: 'blob', col: '#5fbf5a', acc: '#c8ffb0', size: 0.7, hp: 50, dmg: 8, spd: 58, aggro: 150, rng: 26, cd: 1.3, xp: 14, gold: [0, 5], lvl: [3, 6], drops: [['slime_gel', 0.7]], desc: 'Разумная слизь из болотных испарений. Медленная, но вязкая.', weak: 'Огонь' },
  goblin: { name: 'Гоблин', kind: 'human', col: '#5a7a3a', acc: '#8fbf5a', skin: '#8fbf5a', hair: '#2a2a1a', size: 0.8, hp: 56, dmg: 11, spd: 112, aggro: 210, rng: 30, cd: 0.9, xp: 20, gold: [5, 16], lvl: [4, 8], drops: [['goblin_ear', 0.6], ['hp_0', 0.15]], desc: 'Мелкие злобные существа. Нападают толпами и дерутся грязно.', weak: 'Область' },
  skeleton: { name: 'Скелет-воин', kind: 'skeleton', col: '#d8d0b8', acc: '#8a2a2a', size: 1, hp: 92, dmg: 15, spd: 82, aggro: 200, rng: 34, cd: 1.1, xp: 30, gold: [5, 14], lvl: [6, 10], drops: [['bone', 0.7], ['hp_1', 0.06]], desc: 'Поднятые тёмной магией воины древней войны. Бесстрашны и неутомимы.', weak: 'Дробящее и огонь' },
  skmage: { name: 'Костяной чародей', kind: 'skeleton', col: '#c8c0e0', acc: '#7a4fb0', robe: '#3a2a5a', size: 1, hp: 70, dmg: 18, spd: 78, aggro: 300, rng: 280, cd: 2.0, xp: 38, gold: [10, 24], ranged: { spd: 300, col: '#b58cff' }, lvl: [8, 11], drops: [['bone', 0.5], ['rs_1', 0.15], ['gem', 0.03]], desc: 'Останки некроманта. Мечет тёмные сгустки издалека.', weak: 'Быстрое сближение' },
  wraith: { name: 'Призрак', kind: 'ghost', col: '#9ad0e8', acc: '#e8ffff', size: 1, hp: 100, dmg: 20, spd: 92, aggro: 260, rng: 34, cd: 1.2, xp: 45, gold: [8, 26], lvl: [8, 12], night: true, drops: [['ectoplasm', 0.5], ['gem', 0.04]], desc: 'Неупокоенные души. Появляются на кладбищах и болотах только после заката.', weak: 'Магия и дневной свет' },
  bear: { name: 'Бурый медведь', kind: 'quad', col: '#6a4630', acc: '#b89060', size: 1.05, hp: 165, dmg: 20, spd: 82, aggro: 170, rng: 40, cd: 1.5, xp: 55, gold: [4, 14], lvl: [6, 10], drops: [['bear_claw', 0.5], ['meat', 0.8], ['wolf_pelt', 0.3]], tame: 'cub', tameCh: 0.12, desc: 'Хозяин леса. Медлителен, но один удар лапы может сломать щит.', weak: 'Яд и ловушки' },
  panther: { name: 'Чёрная пантера', kind: 'quad', col: '#2a2a34', acc: '#f2d24a', size: 0.85, hp: 115, dmg: 22, spd: 135, aggro: 250, rng: 32, cd: 0.9, xp: 60, gold: [6, 18], lvl: [8, 11], night: true, rare: true, drops: [['wolf_pelt', 0.5], ['gem', 0.06]], tame: 'panther', tameCh: 0.1, desc: 'Редкая ночная охотница. Невероятно быстра.', weak: 'Свет и ловушки' },
  stag: { name: 'Белый олень', kind: 'quad', col: '#f2f4f8', acc: '#c9a070', size: 1, hp: 105, dmg: 16, spd: 125, aggro: 0, rng: 34, cd: 1.2, xp: 70, gold: [10, 30], lvl: [9, 10], passive: true, rare: true, drops: [['gem', 0.3]], tame: 'stag', tameCh: 0.08, desc: 'Легенда леса. Его рога светятся в лунную ночь. Встречается крайне редко.', weak: '—' },
  troll: { name: 'Горный тролль', kind: 'human', col: '#6a7a68', acc: '#8fa08a', skin: '#7f9a7a', hair: '#3a3a2a', size: 1.5, hp: 300, dmg: 33, spd: 72, aggro: 200, rng: 52, cd: 1.7, xp: 100, gold: [15, 40], lvl: [10, 13], drops: [['troll_hide', 0.6], ['gem', 0.1], ['hp_2', 0.1]], desc: 'Гигант с каменной кожей. Медленный, но каждый его удар сотрясает землю.', weak: 'Огонь' },
  snowwolf: { name: 'Ледяной волк', kind: 'quad', col: '#bcd8f0', acc: '#ffffff', size: 0.85, hp: 155, dmg: 26, spd: 118, aggro: 240, rng: 32, cd: 1.0, xp: 80, gold: [10, 24], lvl: [10, 13], drops: [['frost_fang', 0.5], ['wolf_pelt', 0.4]], tame: 'frostwolf', tameCh: 0.1, desc: 'Северные хищники. Их дыхание покрывает землю инеем.', weak: 'Огонь' },
  cultist: { name: 'Пепельный культист', kind: 'human', col: '#7a1e1e', acc: '#ff8a3a', robe: '#7a1e1e', hair: '#222', size: 1, hp: 135, dmg: 30, spd: 88, aggro: 300, rng: 290, cd: 1.7, xp: 110, gold: [20, 50], ranged: { spd: 330, col: '#ff7a2a', fire: true }, lvl: [12, 16], drops: [['ash_crystal', 0.35], ['rs_2', 0.15], ['hp_2', 0.1]], desc: 'Фанатики Пепла. Метают огненные шары и шепчут молитвы своему господину.', weak: 'Ближний бой' },
  golem: { name: 'Пепельный голем', kind: 'golem', col: '#4a4444', acc: '#ff6a2a', size: 1.6, hp: 420, dmg: 44, spd: 56, aggro: 200, rng: 56, cd: 2.0, xp: 160, gold: [25, 60], lvl: [14, 17], drops: [['ash_crystal', 0.8], ['gem', 0.15]], desc: 'Ожившая груда шлака и углей. Огонь только питает его.', weak: 'Лёд' },
  drake: { name: 'Молодой дракон', kind: 'dragon', col: '#b8342a', acc: '#ffd27a', size: 1.5, hp: 520, dmg: 48, spd: 96, aggro: 260, rng: 60, cd: 1.6, xp: 400, gold: [80, 200], lvl: [12, 14], rare: true, flying: false, drops: [['dragon_scale', 0.8], ['gem', 0.5]], tame: 'drake', tameCh: 0.05, desc: 'Молодой дракон с гор. Редчайшая цель для охотника — и смертельная опасность.', weak: 'Лёд' },
  griffin: { name: 'Дикий грифон', kind: 'bird', col: '#c99a4a', acc: '#f6f0e0', size: 1.3, hp: 320, dmg: 34, spd: 120, aggro: 200, rng: 50, cd: 1.3, xp: 250, gold: [30, 80], lvl: [11, 13], rare: true, drops: [['feather', 1], ['gem', 0.3]], tame: 'griffin', tameCh: 0.06, desc: 'Полуорёл-полульв горных вершин. Гордый и опасный.', weak: 'Стрелы' },
  horak: { name: 'Горак Каменный', kind: 'human', col: '#5a6a58', acc: '#c9a070', skin: '#6f8f6a', hair: '#2a2a1a', size: 2.1, hp: 3000, dmg: 50, spd: 74, aggro: 300, rng: 70, cd: 1.6, xp: 900, ai: [{ t: 'slam', cd: 7, r: 110 }], loot: true, gold: [200, 300], lvl: [14, 14], boss: true, drops: [['ember', 1], ['w_axe_troll', 0.5], ['hp_2', 1]], desc: 'Вождь горных троллей. Хранит в сердце пещеры тлеющий кристалл.', weak: 'Оглушение' },
  malgrath: { name: 'Малгрет Пепельный', kind: 'human', col: '#3a0f0f', acc: '#ff8a3a', robe: '#4a1010', hair: '#111', skin: '#b8a090', size: 1.5, hp: 5600, dmg: 58, spd: 84, aggro: 400, ai: [{ t: 'nova', cd: 8, n: 14, fire: true, col: '#ff5a1a' }, { t: 'summon', id: 'cultist', cd: 22, n: 2, max: 4 }], loot: true, rng: 300, cd: 1.4, xp: 2500, gold: [500, 700], ranged: { spd: 360, col: '#ff5a1a', fire: true }, lvl: [18, 18], boss: true, drops: [['ring_ash', 1], ['gem', 1]], desc: 'Предводитель культа Пепла. Когда-то королевский маг, ныне — вестник вечного огня.', weak: 'Лёд и уклонение' },

  spiderqueen: { name: 'Королева пауков Арахнея', kind: 'spider', col: '#2a1f35', acc: '#e04a8a', size: 2.4, hp: 2600, dmg: 40, spd: 100, aggro: 350, rng: 58, cd: 1.3, xp: 700, gold: [150, 250], lvl: [8, 8], boss: true, poison: true, loot: true, ai: [{ t: 'summon', id: 'spider', cd: 14, n: 2, max: 5 }, { t: 'slam', cd: 9, r: 100 }], drops: [['spider_silk', 1], ['gem', 1]], desc: 'Матка паучьего гнезда. Плетёт ядовитые сети и призывает потомство.', weak: 'Огонь' },
  lichking: { name: 'Король-лич Мортис', kind: 'skeleton', col: '#c8c0e0', acc: '#7a4fb0', size: 1.6, hp: 4600, dmg: 44, spd: 80, aggro: 400, rng: 300, cd: 1.8, xp: 1200, gold: [250, 400], lvl: [12, 12], boss: true, ranged: { spd: 320, col: '#b58cff' }, loot: true, ai: [{ t: 'nova', cd: 8, n: 12, col: '#b58cff' }, { t: 'summon', id: 'skeleton', cd: 16, n: 3, max: 6 }], drops: [['bone', 1], ['ectoplasm', 1], ['gem', 2]], desc: 'Древний король, восставший из склепа под Часовой башней. Командует мёртвой гвардией.', weak: 'Сближение' },
  frostgiant: { name: 'Ледяной великан Ётун', kind: 'human', col: '#7a9ac0', acc: '#b8d8f0', skin: '#b8d8f0', hair: '#eef8ff', size: 2.2, hp: 5600, dmg: 58, spd: 72, aggro: 350, rng: 80, cd: 1.7, xp: 1600, gold: [300, 450], lvl: [14, 14], boss: true, loot: true, ai: [{ t: 'slam', cd: 7, r: 120 }, { t: 'nova', cd: 11, n: 16, col: '#8df' }], drops: [['frost_fang', 2], ['gem', 2]], desc: 'Великан, спящий подо льдом. Каждый его шаг покрывает землю инеем.', weak: 'Огонь' },
  witch: { name: 'Ведьма Грисельда', kind: 'human', col: '#3a4a2a', acc: '#8fe04a', skin: '#9ab88a', hair: '#dfe6c8', size: 1.35, hp: 3200, dmg: 36, spd: 88, aggro: 350, rng: 280, cd: 1.6, xp: 850, gold: [180, 300], lvl: [9, 9], boss: true, ranged: { spd: 300, col: '#8fe04a' }, loot: true, ai: [{ t: 'summon', id: 'slime', cd: 12, n: 2, max: 5 }, { t: 'nova', cd: 9, n: 10, col: '#8f4' }], drops: [['slime_gel', 3], ['gem', 1]], desc: 'Болотная ведьма, варящая зелья из костей и тины. Пламя её не берёт — только сталь.', weak: 'Ближний бой' },
  skar: { name: 'Атаман Скар', kind: 'human', col: '#5a2a20', acc: '#c9a070', skin: '#d8a880', hair: '#222', size: 1.4, hp: 2400, dmg: 38, spd: 96, aggro: 320, rng: 44, cd: 1.1, xp: 550, gold: [200, 320], lvl: [6, 6], boss: true, loot: true, ai: [{ t: 'summon', id: 'bandit', cd: 18, n: 2, max: 4 }, { t: 'slam', cd: 8, r: 90 }], drops: [['sigil', 1], ['hp_1', 2]], desc: 'Главарь лесных разбойников, поставивший на плечо клеймо Пепла.', weak: 'Оглушение' },
  ignis: { name: 'Игнис, Дракон Пепла', kind: 'dragon', col: '#5a1a14', acc: '#ff8a2a', size: 2.7, hp: 8000, dmg: 66, spd: 96, aggro: 400, rng: 90, cd: 1.5, xp: 2200, gold: [500, 800], lvl: [16, 16], boss: true, loot: true, ai: [{ t: 'nova', cd: 8, n: 16, fire: true, col: '#ff6a1a' }, { t: 'slam', cd: 9, r: 130 }], drops: [['dragon_scale', 3], ['gem', 3]], desc: 'Древний дракон, пробуждённый культом. Его дыхание плавит камень.', weak: 'Лёд' },
  direwolf: { name: 'Луноликий вожак', kind: 'quad', col: '#dfe6f2', acc: '#ffe27a', size: 1.6, hp: 1900, dmg: 38, spd: 120, aggro: 400, ai: [{ t: 'summon', id: 'wolf', cd: 14, n: 2, max: 6 }, { t: 'slam', cd: 10, r: 90 }], rng: 46, cd: 1.0, xp: 600, gold: [100, 200], lvl: [10, 10], boss: true, drops: [['amu_moon', 1], ['frost_fang', 1]], desc: 'Огромный волк, приходящий в ночь полной луны и ведущий за собой стаю.', weak: 'Свет' }
};

/* ===== Магазины ===== */
function itemsWhere(fn) { return Object.keys(ITEMS).filter(id => fn(ITEMS[id])); }
const SHOPS = {
  smith: {
    name: 'Кузница «Железный кулак»', npc: 'grum', greeting: 'Лучшая сталь к востоку от гор!',
    stock: () => itemsWhere(i => i.type === 'weapon' && i.tier < 3 && !i.id.includes('troll')).concat(itemsWhere(i => i.type === 'armor' && i.atype === 'heavy' && i.tier < 3))
  },
  tailor: {
    name: 'Лавка «Игла и Кожа»', npc: 'tilda', greeting: 'Одежда для героев и не очень героев.',
    stock: () => itemsWhere(i => i.type === 'armor' && i.atype !== 'heavy' && i.tier < 3)
  },
  alch: {
    name: 'Аптека «Пузырёк»', npc: 'orlo', greeting: 'Всё для здоровья. Ну, почти всё.',
    stock: () => ['hp_0', 'hp_1', 'hp_2', 'rs_0', 'rs_1', 'rs_2', 'elx_might', 'elx_speed', 'elx_skin', 'elx_wise', 'elx_luck', 'elx_regen', 'scroll_town']
  },
  jewel: {
    name: 'Ювелирная «Лунный камень»', npc: 'iris', greeting: 'Блеск, достойный вас, дорогой гость.',
    stock: () => itemsWhere(i => (i.type === 'ring' || i.type === 'amulet') && !i.id.includes('_moon') && !i.id.includes('_ash'))
  },
  beast: {
    name: 'Зверинец Рурика', npc: 'rurik', greeting: 'Зверь — лучший друг охотника.', pets: ['fox', 'piglet', 'hawk', 'wolfpup', 'cub', 'panther'],
    stock: () => ['lure', 'treat']
  },
  hamlet: {
    name: 'Лавка Ивара', npc: 'ivar', greeting: 'Немного, но по-честному.',
    stock: () => ['hp_0', 'hp_1', 'rs_0', 'lure', 'scroll_town', 'w_axe_0', 'w_staff_0', 'w_dagger_0', 'w_sickle_0', 'w_bow_0']
  },
  trader: {
    name: 'Странствующий торговец', npc: 'trader', greeting: 'Редкие товары — только сегодня!', pets: ['stag', 'frostwolf'],
    stock: () => itemsWhere(i => (i.type === 'weapon' && i.tier === 3 && !i.id.includes('troll')) || (i.type === 'armor' && i.tier === 3)).concat(['hp_2', 'rs_2', 'elx_might', 'elx_wise'])
  }
};

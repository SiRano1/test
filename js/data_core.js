'use strict';
/* ===== Ядро данных: расы, классы, умения, календарь ===== */

const RACES = {
  human: {
    name: 'Человек', icon: '👤', scale: 1, wide: 0,
    desc: 'Адаптивные и упорные люди Эльдергарда. Быстро учатся всему на свете.',
    passive: 'Любознательность: +10% получаемого опыта.',
    mods: { xp: 1.1 },
    active: { id: 'secondwind', name: 'Второе дыхание', icon: '💗', cd: 60, desc: 'Мгновенно восстанавливает 30% здоровья.' },
    skins: ['#f6d3b0', '#e8b98f', '#cf9868', '#9a6a43', '#65422a']
  },
  elf: {
    name: 'Эльф', icon: '🧝', scale: 1.06, wide: -0.5,
    desc: 'Изящные дети Лунного леса. Тонкий слух, меткий глаз, долгая память.',
    passive: 'Лунная кровь: +6% шанс крита, +15% восстановления ресурса.',
    mods: { crit: 0.06, regen: 1.15 },
    active: { id: 'moonstep', name: 'Лунный шаг', icon: '🌙', cd: 45, desc: '+50% к скорости и +25% к уклонению на 6 секунд.' },
    skins: ['#f7e6d4', '#ecd6c0', '#d9c3a8', '#d4e0c8']
  },
  dwarf: {
    name: 'Дварф', icon: '⛏️', scale: 0.9, wide: 1,
    desc: 'Коренастые горные мастера. Упрямы, как камень, и жадны до золота.',
    passive: 'Каменная закалка: +15% к защите, +10% найденного золота.',
    mods: { def: 1.15, gold: 1.1 },
    active: { id: 'stoneskin', name: 'Каменная кожа', icon: '🪨', cd: 60, desc: '-40% получаемого урона на 7 секунд.' },
    skins: ['#eab892', '#d59f76', '#b98058', '#8d5e3e']
  },
  orc: {
    name: 'Орк', icon: '👹', scale: 1.08, wide: 1,
    desc: 'Свирепые воины степей с зелёной кожей и клыками. Уважают только силу.',
    passive: 'Дикая мощь: +10% к урону, +5% к здоровью.',
    mods: { dmg: 1.1, hp: 1.05 },
    active: { id: 'bloodrage', name: 'Кровавая ярость', icon: '💢', cd: 60, desc: '+40% к урону и +30% к скорости атаки на 8 секунд.' },
    skins: ['#86b35c', '#6d9c4a', '#8f9d6e', '#5f8a78']
  },
  halfling: {
    name: 'Полурослик', icon: '🍀', scale: 0.82, wide: 0,
    desc: 'Маленькие, юркие и вечно удачливые. Всегда знают, где лежит что-нибудь вкусное.',
    passive: 'Везунчик: +8% шанс уклонения, +15% удачи (добыча).',
    mods: { dodge: 0.08, luck: 1.15 },
    active: { id: 'slip', name: 'Ловкач', icon: '💨', cd: 50, desc: 'Невидимость на 5 секунд и +30% к скорости.' },
    skins: ['#f2cfaa', '#e3b48a', '#cb9a72', '#a5764f']
  }
};

const LOOK = {
  hairStyles: ['Короткие', 'Длинные', 'Хвост', 'Косы', 'Ирокез', 'Лысина'],
  hairColors: ['#2b1b12', '#5a3a22', '#a26a34', '#e0b45a', '#d8d8d0', '#b8341f', '#3b5bb5', '#4f9a56'],
  eyes: ['#3a2a1a', '#2d6e9e', '#3f8f4a', '#7a4fb0', '#c9902a', '#b02b2b'],
  accents: ['#b8341f', '#2f5fb5', '#2e8b57', '#7b3fa0', '#c9902a', '#2c2c34', '#d16a8a', '#28899a'],
  faces: ['Чистое', 'Шрам', 'Боевая раскраска', 'Веснушки', 'Борода']
};

const RES = {
  rage: { id: 'rage', name: 'Ярость', color: '#e0402a', color2: '#7a1208', icon: '🔥' },
  mana: { id: 'mana', name: 'Мана', color: '#3f8cff', color2: '#12307a', icon: '💧' },
  stamina: { id: 'stamina', name: 'Выносливость', color: '#e8c33a', color2: '#7a5a08', icon: '⚡' }
};

const CLASSES = {
  berserk: {
    name: 'Берсерк', icon: '🪓', res: 'rage', weapon: 'axe', armor: ['heavy', 'medium'],
    tagline: 'Ярость и сталь',
    desc: 'Неистовый воин ближнего боя. Огромный запас здоровья и сокрушительные удары двуручным топором.',
    style: 'Ближний бой. Каждый удар копит Ярость (она тратится на умения и убывает вне боя). Чем меньше здоровья — тем больнее бьёт.',
    trait: 'Кровавая жажда: до +40% урона при низком здоровье.',
    base: { hp: 150, res: 100, dmg: 8, def: 6, spd: 108, crit: 0.05, regen: 0 },
    growth: { hp: 17, dmg: 2.1, def: 1 },
    atk: { kind: 'melee', range: 62, arc: 2.3, cd: 0.78, mult: 1.15, rage: 6 }
  },
  mage: {
    name: 'Маг', icon: '🔮', res: 'mana', weapon: 'staff', armor: ['cloth'],
    tagline: 'Власть над стихиями',
    desc: 'Хрупкий, но смертоносный заклинатель. Огонь, лёд и молнии — на расстоянии.',
    style: 'Дальний бой. Простой магический снаряд и мощные заклинания за ману. Держите дистанцию!',
    trait: 'Арканный поток: мана восстанавливается быстрее вне боя.',
    base: { hp: 95, res: 130, dmg: 9, def: 2, spd: 104, crit: 0.06, regen: 6 },
    growth: { hp: 10, dmg: 2.4, def: 0.5 },
    atk: { kind: 'proj', range: 420, cd: 0.62, mult: 1.0, speed: 460, color: '#b58cff', r: 8 }
  },
  assassin: {
    name: 'Ассасин', icon: '🗡️', res: 'stamina', weapon: 'dagger', armor: ['medium', 'cloth'],
    tagline: 'Тень и яд',
    desc: 'Быстрый и коварный убийца. Наносит удары в спину, исчезает в дыме и травит врагов.',
    style: 'Ближний бой, очень быстрые атаки. Удар в спину и из невидимости — критический. Тратит выносливость.',
    trait: 'Удар в спину: +60% урона по врагам, повернувшимся спиной.',
    base: { hp: 110, res: 100, dmg: 7, def: 3, spd: 124, crit: 0.14, regen: 14 },
    growth: { hp: 12, dmg: 2.0, def: 0.6 },
    atk: { kind: 'melee', range: 44, arc: 1.7, cd: 0.36, mult: 0.72, rage: 0 }
  },
  druid: {
    name: 'Друид', icon: '🌿', res: 'mana', weapon: 'sickle', armor: ['medium', 'cloth'],
    tagline: 'Сила зверя',
    desc: 'Хранитель природы. Оборачивается волком, медведем или орлом и лечит союзников силой леса.',
    style: 'Гибрид: серпом и заклинаниями в облике человека; в облике зверя — уникальные атаки и бонусы (до 3 форм).',
    trait: 'Дар леса: медленно восстанавливает здоровье.',
    base: { hp: 120, res: 110, dmg: 7, def: 4, spd: 108, crit: 0.05, regen: 5 },
    growth: { hp: 13, dmg: 2.0, def: 0.7 },
    atk: { kind: 'melee', range: 52, arc: 2.0, cd: 0.56, mult: 0.95, rage: 0 }
  },
  hunter: {
    name: 'Охотник', icon: '🏹', res: 'stamina', weapon: 'bow', armor: ['medium'],
    tagline: 'Верный друг и меткий глаз',
    desc: 'Мастер лука и дрессировки. Приручает диких зверей, покупает и находит питомцев разной редкости.',
    style: 'Дальний бой + питомец. Питомец сражается рядом; приручайте зверей ослабив их и использовав Приманку.',
    trait: 'Стая: питомец получает часть ваших характеристик.',
    base: { hp: 115, res: 100, dmg: 8, def: 3, spd: 112, crit: 0.08, regen: 10 },
    growth: { hp: 12, dmg: 2.1, def: 0.6 },
    atk: { kind: 'proj', range: 520, cd: 0.6, mult: 1.0, speed: 640, color: '#e8d8a0', r: 5, arrow: true }
  }
};

/* Умения: 3 ветки × 2 яруса. v — значение по рангам, {v} подставляется в описание */
const SKILLS = {
  // Берсерк
  charge: { cls: 'berserk', name: 'Рывок', icon: '🏃', type: 'active', branch: 0, tier: 1, req: 1, cost: 0, cd: 6, v: [150, 190, 230], start: true, desc: 'Стремительный рывок вперёд: {v}% урона всем на пути и отбрасывание.' },
  slam: { cls: 'berserk', name: 'Сокрушение', icon: '💥', type: 'active', branch: 0, tier: 2, req: 5, cost: 40, cd: 10, v: [200, 260, 320], desc: 'Удар о землю: {v}% урона по области и оглушение на 1.5 с.' },
  whirl: { cls: 'berserk', name: 'Вихрь клинков', icon: '🌀', type: 'active', branch: 1, tier: 1, req: 2, cost: 30, cd: 8, v: [120, 150, 180], desc: 'Вращение топора: два удара по {v}% урона вокруг себя.' },
  bloodlust: { cls: 'berserk', name: 'Кровавая жажда', icon: '🩸', type: 'passive', branch: 1, tier: 2, req: 6, v: [4, 8, 12], desc: 'Вампиризм: {v}% нанесённого урона возвращается здоровьем.' },
  warcry: { cls: 'berserk', name: 'Боевой клич', icon: '📣', type: 'active', branch: 2, tier: 1, req: 3, cost: 25, cd: 20, v: [25, 35, 45], desc: '+{v}% к урону и −15% получаемого урона на 10 секунд.' },
  unbroken: { cls: 'berserk', name: 'Несокрушимый', icon: '🛡️', type: 'passive', branch: 2, tier: 2, req: 7, v: [8, 16, 24], desc: '+{v}% к максимальному здоровью.' },
  // Маг
  fireball: { cls: 'mage', name: 'Огненный шар', icon: '🔥', type: 'active', branch: 0, tier: 1, req: 1, cost: 20, cd: 1.5, v: [220, 280, 340], start: true, desc: 'Взрывной шар: {v}% урона по области и поджог.' },
  meteor: { cls: 'mage', name: 'Метеор', icon: '☄️', type: 'active', branch: 0, tier: 2, req: 6, cost: 55, cd: 14, v: [450, 580, 700], desc: 'Через секунду в точку курсора падает метеор: {v}% урона по большой области.' },
  frostnova: { cls: 'mage', name: 'Ледяная нова', icon: '❄️', type: 'active', branch: 1, tier: 1, req: 2, cost: 30, cd: 8, v: [150, 190, 230], desc: 'Волна холода: {v}% урона вокруг и замедление на 3 с.' },
  wisdom: { cls: 'mage', name: 'Стихийная мудрость', icon: '🔮', type: 'passive', branch: 1, tier: 2, req: 5, v: [15, 30, 45], desc: '+{v}% к максимальной мане и её восстановлению.' },
  chain: { cls: 'mage', name: 'Цепная молния', icon: '⚡', type: 'active', branch: 2, tier: 1, req: 3, cost: 25, cd: 4, v: [160, 200, 240], desc: 'Молния перескакивает между 4 целями: {v}% урона.' },
  blink: { cls: 'mage', name: 'Мерцание', icon: '✨', type: 'active', branch: 2, tier: 2, req: 4, cost: 20, cd: 6, v: [200, 260, 320], desc: 'Мгновенный телепорт на {v} пикселей к курсору.' },
  // Ассасин
  shadowstep: { cls: 'assassin', name: 'Теневой шаг', icon: '🌑', type: 'active', branch: 0, tier: 1, req: 1, cost: 30, cd: 7, v: [250, 300, 350], start: true, desc: 'Появление за спиной ближайшего врага: {v}% урона, всегда критический.' },
  fan: { cls: 'assassin', name: 'Веер кинжалов', icon: '🗡️', type: 'active', branch: 0, tier: 2, req: 5, cost: 35, cd: 6, v: [90, 120, 150], desc: 'Пять метательных кинжалов конусом, по {v}% урона.' },
  venom: { cls: 'assassin', name: 'Ядовитый клинок', icon: '☠️', type: 'active', branch: 1, tier: 1, req: 2, cost: 25, cd: 15, v: [15, 25, 35], desc: '8 секунд: атаки отравляют цель ({v}% урона в секунду).' },
  deadly: { cls: 'assassin', name: 'Смертельная точность', icon: '🎯', type: 'passive', branch: 1, tier: 2, req: 6, v: [5, 10, 15], desc: '+{v}% к шансу критического удара.' },
  smoke: { cls: 'assassin', name: 'Дымовая завеса', icon: '💨', type: 'active', branch: 2, tier: 1, req: 3, cost: 30, cd: 18, v: [4, 5, 6], desc: 'Невидимость на {v} с; первая атака наносит +100% урона.' },
  evasion: { cls: 'assassin', name: 'Уклонение', icon: '🌀', type: 'passive', branch: 2, tier: 2, req: 7, v: [4, 8, 12], desc: '+{v}% к шансу уклониться от атаки.' },
  // Друид
  wolf: { cls: 'druid', name: 'Облик волка', icon: '🐺', type: 'form', branch: 0, tier: 1, req: 1, cost: 20, cd: 2, v: [30, 40, 50], start: true, desc: 'Форма: +{v}% к скорости, быстрые укусы (+20% урона). Расход маны 1/с. Повторно — вернуться.' },
  bear: { cls: 'druid', name: 'Облик медведя', icon: '🐻', type: 'form', branch: 0, tier: 2, req: 5, cost: 30, cd: 2, v: [40, 55, 70], desc: 'Форма: +{v}% к здоровью, −30% получаемого урона, тяжёлые удары по области. Расход маны 1.5/с.' },
  eagle: { cls: 'druid', name: 'Облик орла', icon: '🦅', type: 'form', branch: 1, tier: 1, req: 3, cost: 25, cd: 2, v: [15, 20, 25], desc: 'Форма: полёт над водой и скалами, +{v}% уклонения, пикирующие атаки. Расход маны 1.2/с.' },
  barkskin: { cls: 'druid', name: 'Кора', icon: '🌳', type: 'passive', branch: 1, tier: 2, req: 6, v: [10, 20, 30], desc: '+{v}% к защите.' },
  vines: { cls: 'druid', name: 'Опутывающие лозы', icon: '🌿', type: 'active', branch: 2, tier: 1, req: 2, cost: 25, cd: 9, v: [120, 160, 200], desc: 'Корни в точке курсора: {v}% урона и обездвиживание на 3 с.' },
  regrowth: { cls: 'druid', name: 'Целебный рост', icon: '💚', type: 'active', branch: 2, tier: 2, req: 4, cost: 30, cd: 12, v: [25, 38, 50], desc: 'В течение 5 с восстанавливает {v}% максимального здоровья.' },
  // Охотник
  volley: { cls: 'hunter', name: 'Град стрел', icon: '🏹', type: 'active', branch: 0, tier: 1, req: 1, cost: 25, cd: 5, v: [90, 110, 130], start: true, desc: 'Три стрелы веером, по {v}% урона.' },
  trap: { cls: 'hunter', name: 'Капкан', icon: '🪤', type: 'active', branch: 0, tier: 2, req: 5, cost: 30, cd: 10, v: [250, 320, 400], desc: 'Ставит ловушку: {v}% урона и обездвиживание при срабатывании.' },
  tame: { cls: 'hunter', name: 'Приручение', icon: '🐾', type: 'active', branch: 1, tier: 1, req: 1, cost: 20, cd: 3, v: [50, 60, 70], start: true, desc: 'Тратит «Приманку». Зверь должен быть ослаблен (<40% здоровья). Базовый шанс {v}% × редкость.' },
  bond: { cls: 'hunter', name: 'Связь с питомцем', icon: '🐕', type: 'passive', branch: 1, tier: 2, req: 4, v: [10, 20, 30], desc: 'Питомец: +{v}% к урону и здоровью.' },
  call: { cls: 'hunter', name: 'Зов охоты', icon: '📯', type: 'active', branch: 2, tier: 1, req: 3, cost: 20, cd: 25, v: [50, 75, 100], desc: 'Питомец на 10 с получает +{v}% урона и скорости и лечится на 30%.' },
  eagleeye: { cls: 'hunter', name: 'Меткий глаз', icon: '👁️', type: 'passive', branch: 2, tier: 2, req: 6, v: [4, 8, 12], desc: '+{v}% шанс крита и +10% дальность стрельбы.' }
};
const BRANCHES = {
  berserk: ['Натиск', 'Вихрь', 'Стойкость'], mage: ['Пламя', 'Лёд и разум', 'Молния и магия'],
  assassin: ['Тень', 'Яд и точность', 'Скрытность'], druid: ['Звериные формы', 'Природа', 'Жизнь'],
  hunter: ['Охота', 'Зверь', 'Стая']
};

/* ===== Календарь ===== */
const MONTHS = ['Оттепель', 'Цветень', 'Травень', 'Червень', 'Зарев', 'Липень', 'Вересень', 'Листопад', 'Грудень', 'Стужа', 'Иней', 'Метель'];
const MONTHS_GEN = ['Оттепели', 'Цветеня', 'Травеня', 'Червеня', 'Зарева', 'Липеня', 'Вересеня', 'Листопада', 'Грудня', 'Стужи', 'Инея', 'Метели'];
const SEASONS = ['Весна', 'Лето', 'Осень', 'Зима'];
const SEASON_ICON = ['🌸', '☀️', '🍂', '❄️'];
const WEEKDAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
const WD_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const DAYS_IN_MONTH = 28, START_YEAR = 1024;
const START_ABS_MIN = (1 * DAYS_IN_MONTH + 7) * 1440 + 8 * 60; // 8 Цветеня, 08:00
function calc(minTotal) {
  const absDay = Math.floor(minTotal / 1440), m = minTotal - absDay * 1440;
  const dayOfYear = absDay % (DAYS_IN_MONTH * 12);
  const month = Math.floor(dayOfYear / DAYS_IN_MONTH);
  return {
    absDay, hour: Math.floor(m / 60), minute: Math.floor(m % 60), hf: m / 60,
    day: (dayOfYear % DAYS_IN_MONTH) + 1, month, year: START_YEAR + Math.floor(absDay / (DAYS_IN_MONTH * 12)),
    wd: absDay % 7, season: Math.floor(month / 3),
    moon: ((dayOfYear % DAYS_IN_MONTH) + 1) // фаза луны: 14 — полнолуние
  };
}
function moonIcon(day) { const p = ((day - 14 + 28) % 28) / 28; return p < 0.06 || p > 0.94 ? '🌕' : p < 0.25 ? '🌖' : p < 0.4 ? '🌗' : p < 0.6 ? '🌑' : p < 0.75 ? '🌒' : '🌓'; }
function xpNeed(l) { return Math.floor(25 * Math.pow(l, 1.5)); }
const MAX_LEVEL = 20;

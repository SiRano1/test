import { L, type Loc } from './loc';

export interface TierPalette {
  floor: [string, string, string];
  wall: string;
  wallDark: string;
  top: string;
  accent: string;
  /** Цвет тьмы (для освещения). */
  dark: string;
  /** Частицы атмосферы. */
  mote: string;
}

export interface TierDef {
  id: number;
  name: Loc;
  floors: [number, number];
  palette: TierPalette;
  monsters: [string, number][];
  elites: string[];
  ores: [string, number][];
  boss: string;
  /** Непрозрачность тьмы 0..1. */
  darkness: number;
  /** Декор, разбрасываемый по комнатам. */
  decor: string[];
  /** Ломаемые предметы (урны/бочки). */
  breakable: string;
}

export const TIERS: TierDef[] = [
  {
    id: 1, name: L('Катакомбы', 'The Catacombs'), floors: [1, 10],
    palette: { floor: ['#4a4541', '#3f3a37', '#56514b'], wall: '#6f675d', wallDark: '#4a433c', top: '#1d1a19', accent: '#d8cfb8', dark: '#07060a', mote: '#b8b0a0' },
    monsters: [['skeleton', 5], ['grave_rat', 4], ['bat', 3], ['skeleton_archer', 3]], elites: ['bone_knight'],
    ores: [['copper_ore', 6], ['stone', 3], ['coal', 1]], boss: 'bone_abbot', darkness: 0.9,
    decor: ['bones', 'candles', 'coffin', 'skull'], breakable: 'urn',
  },
  {
    id: 2, name: L('Затопленные шахты', 'The Flooded Mines'), floors: [11, 20],
    palette: { floor: ['#3b3c38', '#34352f', '#43443e'], wall: '#6a5a44', wallDark: '#4a3e30', top: '#171614', accent: '#4a9aaa', dark: '#04070a', mote: '#8ac0d0' },
    monsters: [['leech', 5], ['drowned', 5], ['cave_crab', 3], ['bat', 2]], elites: ['loyalist'],
    ores: [['iron_ore', 6], ['copper_ore', 2], ['coal', 3], ['stone', 2]], boss: 'gorm', darkness: 0.92,
    decor: ['beam', 'cart', 'puddle', 'lantern_broken'], breakable: 'crate',
  },
  {
    id: 3, name: L('Грибной лес', 'The Fungal Forest'), floors: [21, 30],
    palette: { floor: ['#2e3a2c', '#28332a', '#354332'], wall: '#56456a', wallDark: '#3a2e4a', top: '#140f1a', accent: '#6fe3d0', dark: '#05080a', mote: '#c8e880' },
    monsters: [['sporeling', 4], ['shroom_runner', 4], ['glow_spider', 3], ['leech', 1]], elites: ['myco_golem'], ores: [['iron_ore', 3], ['coal', 3], ['stone', 1]], boss: 'spore_mother', darkness: 0.8,
    decor: ['mushroom', 'glowshroom', 'root'], breakable: 'pod',
  },
  {
    id: 4, name: L('Кузни гномов', 'The Dwarven Forges'), floors: [31, 40],
    palette: { floor: ['#4a3b30', '#41332a', '#534337'], wall: '#6e4c3a', wallDark: '#4a3226', top: '#1e120e', accent: '#ff7a30', dark: '#0a0504', mote: '#ffb060' },
    monsters: [['ember_golem', 4], ['clockwork', 3], ['fire_imp', 3]], elites: ['hollow_armor'], ores: [['silver_ore', 5], ['coal', 3]], boss: 'brodrik', darkness: 0.75,
    decor: ['anvil', 'pipe', 'brazier'], breakable: 'crate',
  },
  {
    id: 5, name: L('Ледяная библиотека', 'The Frozen Library'), floors: [41, 50],
    palette: { floor: ['#5a6878', '#52606f', '#647384'], wall: '#8a9aae', wallDark: '#5e6c80', top: '#161d28', accent: '#bfefff', dark: '#03060c', mote: '#ffffff' },
    monsters: [['ice_wraith', 3], ['book_swarm', 4], ['frost_wolf', 3]], elites: ['page_keeper'], ores: [['adamant_ore', 5], ['frost_crystal', 2]], boss: 'keeper_silence', darkness: 0.85,
    decor: ['bookshelf', 'icicle', 'desk'], breakable: 'books',
  },
  {
    id: 6, name: L('Пылающий собор', 'The Burning Cathedral'), floors: [51, 60],
    palette: { floor: ['#5a4442', '#503c3a', '#654d4a'], wall: '#7e5c52', wallDark: '#583e36', top: '#240e0e', accent: '#ffb040', dark: '#0a0404', mote: '#ffa040' },
    monsters: [['ash_acolyte', 4], ['fire_seraph', 3], ['pilgrim', 3]], elites: ['inquisitor'], ores: [['obsidian', 4], ['ash_stone', 3]], boss: 'ash_seraph', darkness: 0.7,
    decor: ['pew', 'brazier', 'statue'], breakable: 'urn',
  },
  {
    id: 7, name: L('Тронный зал', 'The Throne Hall'), floors: [61, 70],
    palette: { floor: ['#2c2433', '#261f2d', '#33293b'], wall: '#4e3e60', wallDark: '#342942', top: '#0c0912', accent: '#c8a8ff', dark: '#020104', mote: '#a080ff' },
    monsters: [['royal_guard', 4], ['shade', 4]], elites: ['abyss_knight'], ores: [['heartstone', 3], ['royal_gold', 2]], boss: 'halvard', darkness: 0.9,
    decor: ['banner', 'statue', 'chain'], breakable: 'urn',
  },
];

export function tierForFloor(floor: number): TierDef {
  const idx = Math.min(TIERS.length - 1, Math.max(0, Math.floor((floor - 1) / 10)));
  return TIERS[idx]!;
}

export const isBossFloor = (floor: number) => floor % 10 === 0 && floor <= 70;
export const isElevatorFloor = (floor: number) => floor % 5 === 0;
export const MAX_STORY_FLOOR = 70;

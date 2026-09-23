import { L, type Loc } from './loc';

export type Station = 'furnace' | 'anvil' | 'alchemy' | 'kitchen';

export interface RecipeDef {
  id: string;
  station: Station;
  inputs: [string, number][];
  output: [string, number];
  /** Расход бодрости. */
  energy: number;
  /** Сколько игровых минут занимает. */
  minutes: number;
  /** Рецепт известен с начала (иначе — выучить). */
  known?: boolean;
}

export const STATION_NAMES: Record<Station, Loc> = {
  furnace: L('Плавильня', 'Furnace'),
  anvil: L('Наковальня', 'Anvil'),
  alchemy: L('Алхимический стол', 'Alchemy Table'),
  kitchen: L('Кухня', 'Kitchen'),
};

const R: RecipeDef[] = [];
const r = (id: string, station: Station, inputs: [string, number][], output: [string, number], energy: number, minutes: number, known = true) =>
  R.push({ id, station, inputs, output, energy, minutes, known });

// ── Плавильня ──
r('smelt_copper', 'furnace', [['copper_ore', 5], ['coal', 1]], ['copper_bar', 1], 4, 30);
r('smelt_iron', 'furnace', [['iron_ore', 5], ['coal', 1]], ['iron_bar', 1], 5, 40);
r('smelt_steel', 'furnace', [['iron_bar', 1], ['coal', 3]], ['steel_bar', 1], 6, 60);
r('smelt_silver', 'furnace', [['silver_ore', 5], ['coal', 1]], ['silver_bar', 1], 6, 50);
r('smelt_adamant', 'furnace', [['adamant_ore', 5], ['coal', 2]], ['adamant_bar', 1], 8, 60);
r('smelt_glass', 'furnace', [['stone', 3], ['coal', 1]], ['glass', 2], 3, 20);
r('coal_from_wood', 'furnace', [['wood', 5]], ['coal', 1], 2, 20);

// ── Наковальня: оружие и броня из слитков ──
const metals: [string, string][] = [['copper', 'copper_bar'], ['iron', 'iron_bar'], ['steel', 'steel_bar'], ['silver', 'silver_bar'], ['adamant', 'adamant_bar']];
for (const [m, bar] of metals) {
  const early = m === 'copper' || m === 'iron';
  r(`forge_${m}_sword`, 'anvil', [[bar, 3], ['wood', 1]], [`${m}_sword`, 1], 12, 60, early);
  r(`forge_${m}_spear`, 'anvil', [[bar, 2], ['wood', 3]], [`${m}_spear`, 1], 12, 60, early);
  r(`forge_${m}_shield`, 'anvil', [[bar, 4], ['wood', 2]], [`${m}_shield`, 1], 14, 70, early);
  r(`forge_${m}_bow`, 'anvil', [[bar, 1], ['wood', 5]], [`${m}_bow`, 1], 10, 60, early);
  r(`forge_${m}_staff`, 'anvil', [[bar, 2], ['wood', 3], ['glass', 1]], [`${m}_staff`, 1], 10, 60, early);
  r(`forge_${m}_head`, 'anvil', [[bar, 3]], [`${m}_head`, 1], 10, 50, early);
  r(`forge_${m}_body`, 'anvil', [[bar, 5], ['rag', 2]], [`${m}_body`, 1], 15, 80, early);
  r(`forge_${m}_feet`, 'anvil', [[bar, 2], ['rag', 1]], [`${m}_feet`, 1], 8, 40, early);
}
r('forge_ring', 'anvil', [['copper_bar', 1], ['pearl', 1]], ['ring', 1], 6, 40);
r('forge_amulet', 'anvil', [['iron_bar', 1], ['pearl', 1], ['bone', 2]], ['amulet', 1], 8, 50);

// ── Алхимия ──
r('brew_small', 'alchemy', [['grave_moss', 2], ['glass', 1]], ['potion_small', 2], 5, 30);
r('brew_heal', 'alchemy', [['grave_moss', 2], ['moonwort', 1], ['glass', 1]], ['potion_heal', 2], 6, 40);
r('brew_big', 'alchemy', [['glowshroom', 2], ['moonwort', 2], ['glass', 1]], ['potion_big', 1], 8, 60, false);
r('brew_stamina', 'alchemy', [['bat_wing', 1], ['grave_moss', 1], ['glass', 1]], ['potion_stamina', 2], 5, 30);
r('brew_mana', 'alchemy', [['moonwort', 2], ['glass', 1]], ['potion_mana', 2], 5, 30);
r('brew_antidote', 'alchemy', [['leech_slime', 1], ['grave_moss', 1], ['glass', 1]], ['antidote', 2], 4, 20);
r('brew_fire', 'alchemy', [['frostbloom', 2], ['leech_slime', 1], ['glass', 1]], ['fire_tonic', 1], 7, 40, false);
r('brew_might', 'alchemy', [['fireflower', 2], ['bone', 3], ['glass', 1]], ['might_elixir', 1], 7, 40, false);
r('brew_oil', 'alchemy', [['coal', 1], ['bat_wing', 1]], ['torch_oil', 2], 3, 20);

// ── Кухня ──
r('cook_potato', 'kitchen', [['potato', 1]], ['baked_potato', 1], 2, 15);
r('cook_bread', 'kitchen', [['wheat', 3]], ['bread', 2], 3, 30);
r('cook_honey', 'kitchen', [['wheat', 3], ['apple', 1]], ['honey_bread', 2], 4, 40, false);
r('cook_stew', 'kitchen', [['potato', 2], ['grave_moss', 1], ['cheese', 1]], ['miner_stew', 1], 4, 40, false);
r('cook_herb', 'kitchen', [['turnip', 1], ['moonwort', 1]], ['herb_stew', 1], 3, 30);
r('cook_pie', 'kitchen', [['wheat', 2], ['bat_wing', 2], ['apple', 1]], ['game_pie', 1], 5, 50, false);
r('cook_pumpkin', 'kitchen', [['pumpkin', 1], ['winter_onion', 1]], ['pumpkin_soup', 1], 5, 50);

export const RECIPES: RecipeDef[] = R;
export const RECIPE_BY_ID: Record<string, RecipeDef> = Object.fromEntries(R.map((x) => [x.id, x]));

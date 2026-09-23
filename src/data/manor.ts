import { L, type Loc } from './loc';

export interface UpgradeDef {
  id: string;
  name: Loc;
  desc: Loc;
  cost: number;
  items: [string, number][];
  days: number;
  requires?: string[];
}

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'hall', name: L('Главный зал', 'Main Hall'), cost: 500, items: [['wood', 20]], days: 1,
    desc: L('Залатать крышу, вымести паутину. Открывает кухню.', 'Patch the roof, sweep the cobwebs. Unlocks the kitchen.'),
  },
  {
    id: 'forge', name: L('Кузня', 'Forge'), cost: 1500, items: [['copper_bar', 5], ['stone', 10]], days: 2, requires: ['hall'],
    desc: L('Плавильня и наковальня: слитки, оружие и броня своими руками.', 'Furnace and anvil: bars, weapons and armour by your own hand.'),
  },
  {
    id: 'lab', name: L('Алхимическая лаборатория', 'Alchemy Lab'), cost: 2500, items: [['iron_bar', 5], ['glass', 5]], days: 2, requires: ['hall'],
    desc: L('Стол для зелий и эликсиров.', 'A table for potions and elixirs.'),
  },
  {
    id: 'garden', name: L('Сад', 'Garden'), cost: 1200, items: [['wood', 20]], days: 1,
    desc: L('12 грядок у крыльца: травы для зелий и овощи для кухни.', '12 plots by the porch: herbs for potions and vegetables for the kitchen.'),
  },
];

UPGRADES.push({
  id: 'shop', name: L('Лавка', 'Shop'), cost: 6000, items: [['trade_license', 1], ['wood', 30]], days: 3, requires: ['hall'],
  desc: L('Торговый зал с восемью витринами: сами назначаете цены, покупатели сами приходят.', 'A shop floor with eight displays: you set the prices, customers come to you.'),
});

export const UPGRADE_BY_ID: Record<string, UpgradeDef> = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

/** Координаты грядок (тайлы города) — во дворе усадьбы. */
export const GARDEN_PLOTS: [number, number][] = [];
for (const y of [11, 12]) for (const x of [46, 47, 48, 56, 57, 58]) GARDEN_PLOTS.push([x, y]);

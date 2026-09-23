import { TILE } from '../../core/math';
import { hashSeed, Rng } from '../../core/rng';
import { Tile, type TileMap } from '../../core/tilemap';
import { loreForFloor } from '../../data/lore';
import { tr } from '../../data/strings';
import { isBossFloor, isElevatorFloor, tierForFloor, type TierDef } from '../../data/tiers';
import { monsterDef } from '../../data/monsters';
import { Boss } from '../entities/boss';
import { Enemy } from '../entities/enemy';
import { Breakpot, Chest, CrackedWall, LoreObject, OreNode, Prop, Spot } from '../entities/props';
import { World, type GameApi, type SpawnSpec } from '../world';
import { cx, cy, generateBossFloor, generateFloor, type Room } from './generator';

const px = (t: number) => t * TILE + 8;

export function buildDungeon(game: GameApi, floor: number): { world: World; spawn: SpawnSpec } {
  const s = game.state;
  const seed = hashSeed(s.seed, 'floor', floor, s.time.totalDays);
  const tier = tierForFloor(floor);
  const bossFloor = isBossFloor(floor);
  const layout = bossFloor ? generateBossFloor() : generateFloor(seed, floor);
  const w = new World(game, 'dungeon', layout.map, seed ^ 0x5bd1e995, `tier${tier.id}`);
  w.floor = floor;
  w.tier = tier;
  w.darkness = tier.darkness;
  w.meta.rooms = layout.rooms;
  const rng = new Rng(hashSeed(seed, 'populate'));
  const used = new Set<number>();
  const mark = (tx: number, ty: number) => used.add(ty * layout.map.w + tx);
  const free = (tx: number, ty: number) => !used.has(ty * layout.map.w + tx) && layout.map.get(tx, ty) === Tile.FLOOR;

  const [sx, sy] = layout.start;
  // лестница наверх
  w.addNow(new Spot(px(sx), px(sy - 1) + 4, { label: () => tr('ascend'), act: (ww) => ww.game.ascendToTown() }, '', 8, 8));
  mark(sx, sy - 1);
  mark(sx, sy);
  // лифт
  if (isElevatorFloor(floor)) {
    const ex = sx + 2, ey = sy - 1;
    if (layout.map.get(ex, ey) === Tile.FLOOR) {
      const lift = new Prop(px(ex), ey * TILE + 15, 'elevator', { block: true, hw: 8, hh: 6 });
      lift.interaction = { label: () => tr('elevator'), act: (ww) => ww.game.openElevator() };
      lift.light = { r: 26, color: '#ffc870', power: 0.5 };
      w.addNow(lift);
      mark(ex, ey);
    }
  }
  // лестница вниз
  const [ex, ey] = layout.exit;
  const bossAlive = bossFloor && !s.dungeon.bosses.includes(floor);
  if (bossFloor && bossAlive) layout.map.set(ex, ey, Tile.FLOOR);
  const down = w.addNow(
    new Spot(px(ex), px(ey) + 4, {
      label: () => tr('descend'),
      enabled: (ww) => ww.map.get(ex, ey) === Tile.STAIRS_DOWN,
      act: (ww) => ww.game.descend(),
    }),
  );
  void down;
  mark(ex, ey);

  if (bossFloor) {
    if (bossAlive && layout.boss) {
      const b = new Boss(tier.boss, layout.boss.x, layout.boss.y, floor);
      b.arena = layout.boss.arena;
      w.addNow(b);
    }
    decorate(w, rng, layout.rooms, tier, free, mark, layout.map, true);
    const lore = loreForFloor(floor);
    if (lore) placeLore(w, rng, layout.rooms[0]!, lore.id, lore.kind, free, mark);
    return { world: w, spawn: { x: px(sx), y: px(sy) + 6, facing: 3 } };
  }

  // треснувшие стены
  for (const [tx, ty] of layout.cracked) w.addNow(new CrackedWall(tx, ty));

  // монстры по бюджету угрозы
  const budget = 8 + floor * 1.6 + (floor % 10) * 0.4;
  const fightRooms = layout.rooms.filter((r) => r.role !== 'start' && r.role !== 'secret');
  const area = fightRooms.reduce((n, r) => n + r.w * r.h, 0);
  for (const r of fightRooms) {
    let b = (budget * (r.w * r.h)) / area;
    if (r.role === 'treasure') b *= 0.6;
    if (r.depth >= 0 && r.depth < 8) continue;
    let guard = 0;
    while (b > 0.5 && guard++ < 20) {
      const id = rng.weighted(tier.monsters);
      const cost = monsterDef(id).threat;
      if (cost > b + 1) continue;
      const pos = randomTile(rng, r, free);
      if (!pos) break;
      mark(pos[0], pos[1]);
      w.addNow(new Enemy(id, px(pos[0]), px(pos[1]), floor));
      b -= cost;
    }
  }
  // элита
  if (floor >= 3 && tier.elites.length && rng.chance(0.2 + (floor % 10) * 0.05)) {
    const deep = fightRooms.filter((x) => x.depth >= 12);
    const r = rng.pick(deep.length ? deep : fightRooms);
    const pos = randomTile(rng, r, free);
    if (pos) {
      mark(pos[0], pos[1]);
      w.addNow(new Enemy(rng.pick(tier.elites), px(pos[0]), px(pos[1]), floor));
    }
  }

  // сундуки
  for (const r of layout.rooms) {
    if (r.role === 'treasure' || r.role === 'secret' || (r.role === 'combat' && rng.chance(0.12))) {
      const pos = centerish(rng, r, free);
      if (!pos) continue;
      mark(pos[0], pos[1]);
      const q: 0 | 1 | 2 = r.role === 'secret' ? (rng.chance(0.3) ? 2 : 1) : r.role === 'treasure' ? (rng.chance(0.15) ? 2 : 1) : 0;
      w.addNow(new Chest(px(pos[0]), pos[1] * TILE + 14, q));
    }
    if (r.role === 'shrine') {
      const pos = centerish(rng, r, free);
      if (pos) {
        mark(pos[0], pos[1]);
        const shrine = new Prop(px(pos[0]), pos[1] * TILE + 14, 'shrine', { block: true, hw: 7, hh: 5 });
        shrine.light = { r: 34, color: '#a0e0ff', power: 0.6, flicker: 0.05 };
        let used2 = false;
        shrine.interaction = {
          label: () => tr('use'),
          enabled: () => !used2,
          act: (ww) => {
            used2 = true;
            const p = ww.player;
            p.hp = p.maxHp;
            (p as any).stamina = (p as any).maxStamina;
            ww.fx({ t: 'sparkle', x: shrine.x, y: shrine.y - 10, color: '#a0e0ff', n: 16 });
            ww.fx({ t: 'sfx', id: 'heal' });
            shrine.light = { r: 14, color: '#a0e0ff', power: 0.3 };
            shrine.sprite = 'shrine_used';
          },
        };
        w.addNow(shrine);
      }
    }
  }

  // руда
  const oreCount = rng.int(3, 6);
  for (let i = 0; i < oreCount; i++) {
    const r = rng.pick(layout.rooms.filter((x) => x.role !== 'start'));
    const pos = wallAdjacent(rng, r, layout.map, free);
    if (!pos) continue;
    mark(pos[0], pos[1]);
    w.addNow(new OreNode(px(pos[0]), pos[1] * TILE + 14, rng.weighted(tier.ores)));
  }

  decorate(w, rng, layout.rooms, tier, free, mark, layout.map, false);

  const lore = loreForFloor(floor);
  if (lore) {
    const r = rng.pick(layout.rooms.filter((x) => x.role !== 'start' && x.role !== 'secret'));
    placeLore(w, rng, r, lore.id, lore.kind, free, mark);
  }

  return { world: w, spawn: { x: px(sx), y: px(sy) + 6, facing: 0 } };
}

function placeLore(w: World, rng: Rng, r: Room, id: string, kind: 'note' | 'fresco' | 'diary', free: (x: number, y: number) => boolean, mark: (x: number, y: number) => void) {
  if (kind === 'fresco') {
    // фреска — на стене (верхний ряд комнаты)
    for (let i = 0; i < 20; i++) {
      const tx = rng.int(r.x, r.x + r.w - 1), ty = r.y;
      if (free(tx, ty) && w.map.get(tx, ty - 1) === Tile.WALL) {
        mark(tx, ty);
        w.addNow(new LoreObject(px(tx), ty * TILE + 2, id, kind));
        return;
      }
    }
  }
  const pos = randomTile(rng, r, free) ?? [cx(r), cy(r)];
  mark(pos[0], pos[1]);
  w.addNow(new LoreObject(px(pos[0]), pos[1] * TILE + 12, id, kind === 'fresco' ? 'note' : kind));
}

function decorate(
  w: World, rng: Rng, rooms: Room[], tier: TierDef, free: (x: number, y: number) => boolean,
  mark: (x: number, y: number) => void, map: TileMap, boss: boolean,
) {
  for (const r of rooms) {
    // жаровни у стен
    const lights = boss ? 4 : rng.int(0, 2);
    for (let i = 0; i < lights; i++) {
      const pos = wallAdjacent(rng, r, map, free);
      if (!pos) continue;
      mark(pos[0], pos[1]);
      const b = new Prop(px(pos[0]), pos[1] * TILE + 13, 'brazier', { block: true, hw: 4, hh: 3 });
      b.light = { r: 52, color: '#ffb060', power: 0.85, flicker: 0.12 };
      w.addNow(b);
    }
    if (boss) continue;
    // ломаемые
    const pots = rng.int(0, 3);
    for (let i = 0; i < pots; i++) {
      const pos = wallAdjacent(rng, r, map, free);
      if (!pos) continue;
      mark(pos[0], pos[1]);
      w.addNow(new Breakpot(px(pos[0]), pos[1] * TILE + 13, tier.breakable));
    }
    // декор без коллизии
    const decor = rng.int(1, 4);
    for (let i = 0; i < decor; i++) {
      const pos = randomTile(rng, r, free);
      if (!pos) continue;
      const kind = rng.pick(tier.decor);
      const pr = new Prop(px(pos[0]) + rng.int(-4, 4), pos[1] * TILE + 12 + rng.int(-3, 3), `decor:${kind}`, { layer: 0 });
      if (kind === 'candles' || kind === 'glowshroom') pr.light = { r: 22, color: kind === 'candles' ? '#ffd080' : '#6fe3d0', power: 0.5, flicker: 0.15 };
      w.addNow(pr);
    }
  }
}

function randomTile(rng: Rng, r: Room, free: (x: number, y: number) => boolean): [number, number] | null {
  for (let i = 0; i < 25; i++) {
    const tx = rng.int(r.x, r.x + r.w - 1), ty = rng.int(r.y, r.y + r.h - 1);
    if (free(tx, ty)) return [tx, ty];
  }
  return null;
}

function centerish(rng: Rng, r: Room, free: (x: number, y: number) => boolean): [number, number] | null {
  for (let i = 0; i < 20; i++) {
    const tx = cx(r) + rng.int(-1, 1), ty = cy(r) + rng.int(-1, 1);
    if (free(tx, ty)) return [tx, ty];
  }
  return randomTile(rng, r, free);
}

function wallAdjacent(rng: Rng, r: Room, map: TileMap, free: (x: number, y: number) => boolean): [number, number] | null {
  for (let i = 0; i < 40; i++) {
    const tx = rng.int(r.x, r.x + r.w - 1), ty = rng.int(r.y, r.y + r.h - 1);
    if (!free(tx, ty)) continue;
    const nearWall = [[0, -1], [1, 0], [-1, 0], [0, 1]].some(([dx, dy]) => map.get(tx + dx!, ty + dy!) === Tile.WALL);
    // не перекрываем коридоры: у тайла не должно быть двух противоположных стен
    const corridor = (map.solid(tx - 1, ty) && map.solid(tx + 1, ty)) || (map.solid(tx, ty - 1) && map.solid(tx, ty + 1));
    if (nearWall && !corridor) return [tx, ty];
  }
  return null;
}

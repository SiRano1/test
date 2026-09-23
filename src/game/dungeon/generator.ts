import { bfsDistances } from '../../core/pathfind';
import { Rng } from '../../core/rng';
import { Tile, TileMap } from '../../core/tilemap';

export interface Room {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  role: 'start' | 'exit' | 'combat' | 'treasure' | 'secret' | 'shrine' | 'boss' | 'lore' | 'puzzle';
  /** BFS-расстояние центра от старта. */
  depth: number;
}

export interface FloorLayout {
  map: TileMap;
  rooms: Room[];
  start: [number, number];
  exit: [number, number];
  /** Треснувшие стены (тайлы). */
  cracked: [number, number][];
  boss?: { x: number; y: number; arena: { x: number; y: number; w: number; h: number } };
}

export const cx = (r: Room) => r.x + Math.floor(r.w / 2);
export const cy = (r: Room) => r.y + Math.floor(r.h / 2);

function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }, m: number) {
  return a.x - m < b.x + b.w && a.x + a.w + m > b.x && a.y - m < b.y + b.h && a.y + a.h + m > b.y;
}

function carve(map: TileMap, x: number, y: number, w: number, h: number) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (i > 0 && j > 0 && i < map.w - 1 && j < map.h - 1) map.tiles[j * map.w + i] = Tile.FLOOR;
}

function corridor(map: TileMap, rng: Rng, ax: number, ay: number, bx: number, by: number, width: number) {
  const horizFirst = rng.chance(0.5);
  const hLine = (x0: number, x1: number, y: number) => {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) carve(map, x, y, width, width);
  };
  const vLine = (y0: number, y1: number, x: number) => {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) carve(map, x, y, width, width);
  };
  if (horizFirst) {
    hLine(ax, bx, ay);
    vLine(ay, by, bx);
  } else {
    vLine(ay, by, ax);
    hLine(ax, bx, by);
  }
}

/** Убирает стены, не граничащие с полом (рисуются как пустота). */
function cullWalls(map: TileMap) {
  const keep = new Uint8Array(map.w * map.h);
  for (let y = 0; y < map.h; y++)
    for (let x = 0; x < map.w; x++) {
      if (map.tiles[y * map.w + x] !== Tile.WALL) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++)
        for (let dx = -1; dx <= 1 && !near; dx++) {
          const t = map.get(x + dx, y + dy);
          if (t !== Tile.WALL && t !== Tile.VOID) near = true;
        }
      // стена «под» полом (видимая лицевая грань) — тоже нужна
      if (!near && map.get(x, y - 1) !== Tile.WALL && map.get(x, y - 1) !== Tile.VOID) near = true;
      keep[y * map.w + x] = near ? 1 : 0;
    }
  for (let i = 0; i < keep.length; i++) if (map.tiles[i] === Tile.WALL && !keep[i]) map.tiles[i] = Tile.VOID;
}

/** Процедурный этаж: комнаты + MST-коридоры + петли. Детерминирован по seed. */
export function generateFloor(seed: number, floor: number): FloorLayout {
  const rng = new Rng(seed);
  const W = 56, H = 40;
  const map = new TileMap(W, H, Tile.WALL);
  const rooms: Room[] = [];
  const target = rng.int(7, 11) + Math.min(2, Math.floor(floor / 20));
  for (let attempt = 0; attempt < 400 && rooms.length < target; attempt++) {
    const w = rng.int(5, 12), h = rng.int(5, 9);
    const x = rng.int(2, W - w - 2), y = rng.int(2, H - h - 2);
    const r = { x, y, w, h };
    if (rooms.some((o) => overlaps(o, r, 2))) continue;
    rooms.push({ id: rooms.length, ...r, role: 'combat', depth: 0 });
  }
  for (const r of rooms) {
    carve(map, r.x, r.y, r.w, r.h);
    // «крестовые» комнаты — вырез по центру у крупных
    if (r.w >= 9 && r.h >= 7 && rng.chance(0.3)) {
      const c = 2;
      map.fillRect(r.x, r.y, c, c, Tile.WALL);
      map.fillRect(r.x + r.w - c, r.y, c, c, Tile.WALL);
      map.fillRect(r.x, r.y + r.h - c, c, c, Tile.WALL);
      map.fillRect(r.x + r.w - c, r.y + r.h - c, c, c, Tile.WALL);
    }
  }

  // MST (Прим) по расстоянию между центрами
  const n = rooms.length;
  const inTree = new Set<number>([0]);
  const edges: [number, number][] = [];
  const d2 = (a: Room, b: Room) => (cx(a) - cx(b)) ** 2 + (cy(a) - cy(b)) ** 2;
  while (inTree.size < n) {
    let best: [number, number] | null = null;
    let bestD = Infinity;
    for (const i of inTree)
      for (let j = 0; j < n; j++) {
        if (inTree.has(j)) continue;
        const d = d2(rooms[i]!, rooms[j]!);
        if (d < bestD) {
          bestD = d;
          best = [i, j];
        }
      }
    if (!best) break;
    inTree.add(best[1]);
    edges.push(best);
  }
  // петли: 15–25% дополнительных коротких рёбер
  const extra: [number, number, number][] = [];
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      if (edges.some(([a, b]) => (a === i && b === j) || (a === j && b === i))) continue;
      extra.push([i, j, d2(rooms[i]!, rooms[j]!)]);
    }
  extra.sort((a, b) => a[2] - b[2]);
  const loops = Math.max(1, Math.round(n * rng.range(0.15, 0.25)));
  for (const [i, j] of extra.slice(0, loops)) edges.push([i, j]);

  for (const [i, j] of edges) {
    const a = rooms[i]!, b = rooms[j]!;
    corridor(map, rng, cx(a), cy(a), cx(b), cy(b), rng.chance(0.3) ? 3 : 2);
  }

  // старт — комната 0, выход — самая дальняя по BFS
  const start = rooms[0]!;
  start.role = 'start';
  const dist = bfsDistances(map, cx(start), cy(start));
  let far = start;
  for (const r of rooms) {
    r.depth = dist[cy(r) * W + cx(r)] ?? -1;
    if (r.depth > far.depth) far = r;
  }
  far.role = 'exit';

  // роли остальных комнат
  for (const r of rooms) {
    if (r.role !== 'combat') continue;
    r.role = rng.weighted([['combat', 70], ['treasure', 10], ['shrine', 5]] as const) as Room['role'];
  }

  cullWalls(map);

  // Затопленные шахты: в части комнат стоит мелкая вода
  if (floor > 10 && floor <= 20) {
    for (const r of rooms) {
      if (r.role === 'start' || !rng.chance(0.45)) continue;
      const pw = rng.int(3, Math.max(3, r.w - 1)), ph = rng.int(2, Math.max(2, r.h - 1));
      const px = rng.int(r.x, r.x + r.w - pw), py = rng.int(r.y, r.y + r.h - ph);
      flood(map, px, py, pw, ph);
    }
  }

  // Тайник: маленькая комната за треснувшей стеной
  const cracked: [number, number][] = [];
  if (rng.chance(0.55)) placeSecret(map, rng, rooms, cracked);

  const exit: [number, number] = [cx(far), cy(far)];
  map.set(exit[0], exit[1], Tile.STAIRS_DOWN);
  const st: [number, number] = [cx(start), cy(start)];
  map.set(st[0], st[1] - 1, Tile.STAIRS_UP);
  return { map, rooms, start: st, exit, cracked };
}

function placeSecret(map: TileMap, rng: Rng, rooms: Room[], cracked: [number, number][]) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const r = rng.pick(rooms);
    if (r.role === 'start') continue;
    const side = rng.int(0, 3);
    const sw = rng.int(3, 4), sh = rng.int(3, 4);
    let wx: number, wy: number, sx: number, sy: number;
    if (side === 0) { wx = rng.int(r.x + 1, r.x + r.w - 2); wy = r.y - 1; sx = wx - 1; sy = wy - sh; }
    else if (side === 1) { wx = rng.int(r.x + 1, r.x + r.w - 2); wy = r.y + r.h; sx = wx - 1; sy = wy + 1; }
    else if (side === 2) { wx = r.x - 1; wy = rng.int(r.y + 1, r.y + r.h - 2); sx = wx - sw; sy = wy - 1; }
    else { wx = r.x + r.w; wy = rng.int(r.y + 1, r.y + r.h - 2); sx = wx + 1; sy = wy - 1; }
    if (sx < 2 || sy < 2 || sx + sw > map.w - 2 || sy + sh > map.h - 2) continue;
    // область тайника и рамка вокруг должны быть сплошным камнем
    let ok = true;
    for (let j = sy - 1; j < sy + sh + 1 && ok; j++)
      for (let i = sx - 1; i < sx + sw + 1 && ok; i++) {
        const t = map.get(i, j);
        if (t !== Tile.WALL && t !== Tile.VOID) ok = false;
      }
    if (!ok || map.get(wx, wy) !== Tile.WALL) continue;
    for (let j = sy - 1; j < sy + sh + 1; j++) for (let i = sx - 1; i < sx + sw + 1; i++) map.set(i, j, Tile.WALL);
    for (let j = sy; j < sy + sh; j++) for (let i = sx; i < sx + sw; i++) map.set(i, j, Tile.FLOOR);
    map.set(wx, wy, Tile.CRACKED);
    cracked.push([wx, wy]);
    rooms.push({ id: rooms.length, x: sx, y: sy, w: sw, h: sh, role: 'secret', depth: 999 });
    return;
  }
}

/** Эллиптическая лужа мелкой воды поверх пола. */
function flood(map: TileMap, x: number, y: number, w: number, h: number) {
  const cx0 = x + w / 2 - 0.5, cy0 = y + h / 2 - 0.5;
  for (let j = y; j < y + h; j++)
    for (let i = x; i < x + w; i++) {
      if (((i - cx0) / (w / 2)) ** 2 + ((j - cy0) / (h / 2)) ** 2 > 1.1) continue;
      if (map.get(i, j) === Tile.FLOOR) map.set(i, j, Tile.SHALLOW);
    }
}

/** Рукотворный этаж босса: прихожая снизу, арена сверху. */
export function generateBossFloor(floor = 10): FloorLayout {
  const W = 40, H = 36;
  const map = new TileMap(W, H, Tile.WALL);
  const arena = { x: 8, y: 4, w: 24, h: 16 };
  const ante = { x: 15, y: 25, w: 10, h: 7 };
  carve(map, arena.x, arena.y, arena.w, arena.h);
  carve(map, ante.x, ante.y, ante.w, ante.h);
  carve(map, 19, arena.y + arena.h, 2, ante.y - (arena.y + arena.h));
  // колонны по краям арены
  for (const [px, py] of [[11, 7], [28, 7], [11, 16], [28, 16]] as const) map.fillRect(px, py, 1, 1, Tile.WALL);
  cullWalls(map);
  if (floor === 20) {
    // арена Горма залита водой по краям
    flood(map, 8, 4, 8, 6);
    flood(map, 24, 4, 8, 6);
    flood(map, 8, 14, 8, 6);
    flood(map, 24, 14, 8, 6);
  }
  const rooms: Room[] = [
    { id: 0, ...ante, role: 'start', depth: 0 },
    { id: 1, ...arena, role: 'boss', depth: 20 },
  ];
  const start: [number, number] = [20, 29];
  map.set(20, 27, Tile.STAIRS_UP);
  return {
    map, rooms, start, exit: [20, 11], cracked: [],
    boss: { x: 20 * 16 + 8, y: 9 * 16, arena: { x: arena.x * 16, y: arena.y * 16, w: arena.w * 16, h: arena.h * 16 } },
  };
}

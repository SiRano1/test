import type { TileMap } from './tilemap';

/** A* по сетке тайлов с 8 направлениями без срезания углов. Возвращает список тайлов (без стартового). */
export function findPath(
  map: TileMap, sx: number, sy: number, gx: number, gy: number, maxNodes = 2000,
): [number, number][] | null {
  if (!map.inBounds(gx, gy) || map.solid(gx, gy)) return null;
  if (sx === gx && sy === gy) return [];
  const w = map.w;
  const key = (x: number, y: number) => y * w + x;
  const g = new Map<number, number>();
  const came = new Map<number, number>();
  const open = new Heap();
  const h = (x: number, y: number) => {
    const dx = Math.abs(x - gx), dy = Math.abs(y - gy);
    return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
  };
  const start = key(sx, sy);
  g.set(start, 0);
  open.push(start, h(sx, sy));
  const closed = new Set<number>();
  let expanded = 0;
  while (open.size) {
    const cur = open.pop()!;
    if (closed.has(cur)) continue;
    closed.add(cur);
    const cx = cur % w, cy = (cur / w) | 0;
    if (cx === gx && cy === gy) {
      const path: [number, number][] = [];
      let k = cur;
      while (k !== start) {
        path.push([k % w, (k / w) | 0]);
        k = came.get(k)!;
      }
      return path.reverse();
    }
    if (++expanded > maxNodes) return null;
    const gc = g.get(cur)!;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (map.solid(nx, ny)) continue;
        if (dx && dy && (map.solid(cx + dx, cy) || map.solid(cx, cy + dy))) continue;
        const nk = key(nx, ny);
        if (closed.has(nk)) continue;
        const ng = gc + (dx && dy ? 1.414 : 1);
        if (ng < (g.get(nk) ?? Infinity)) {
          g.set(nk, ng);
          came.set(nk, cur);
          open.push(nk, ng + h(nx, ny));
        }
      }
  }
  return null;
}

/** BFS-расстояния от точки (для выбора самой дальней комнаты и проверки связности). */
export function bfsDistances(map: TileMap, sx: number, sy: number): Int32Array {
  const d = new Int32Array(map.w * map.h).fill(-1);
  const q: number[] = [sy * map.w + sx];
  d[q[0]!] = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const cur = q[qi]!;
    const cx = cur % map.w, cy = (cur / map.w) | 0;
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
    for (const [dx, dy] of nb) {
      const nx = cx + dx, ny = cy + dy;
      if (map.solid(nx, ny)) continue;
      const nk = ny * map.w + nx;
      if (d[nk] !== -1) continue;
      d[nk] = d[cur]! + 1;
      q.push(nk);
    }
  }
  return d;
}

class Heap {
  private items: number[] = [];
  private prio: number[] = [];
  get size() {
    return this.items.length;
  }
  push(item: number, p: number) {
    this.items.push(item);
    this.prio.push(p);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.prio[parent]! <= this.prio[i]!) break;
      this.swap(i, parent);
      i = parent;
    }
  }
  pop(): number | undefined {
    if (!this.items.length) return undefined;
    const top = this.items[0];
    const lastI = this.items.pop()!, lastP = this.prio.pop()!;
    if (this.items.length) {
      this.items[0] = lastI;
      this.prio[0] = lastP;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < this.items.length && this.prio[l]! < this.prio[m]!) m = l;
        if (r < this.items.length && this.prio[r]! < this.prio[m]!) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number) {
    [this.items[a], this.items[b]] = [this.items[b]!, this.items[a]!];
    [this.prio[a], this.prio[b]] = [this.prio[b]!, this.prio[a]!];
  }
}

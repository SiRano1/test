import { TILE } from './math';

/** Идентификаторы тайлов (общие для города, интерьеров и подземелья). */
export const Tile = {
  VOID: 0,
  FLOOR: 1,
  WALL: 2,
  GRASS: 3,
  PATH: 4,
  DIRT: 5,
  WATER: 6,
  BRIDGE: 7,
  WOOD: 8,
  STONE: 9,
  IWALL: 10,
  SAND: 11,
  STAIRS_DOWN: 12,
  STAIRS_UP: 13,
  CRACKED: 14,
  CARPET: 15,
  FARMLAND: 16,
  FLOWERS: 17,
  PLAZA: 18,
  HEDGE: 19,
  FENCE: 20,
  RUBBLE: 21,
  DEEPWATER: 22,
  GRAVE_DIRT: 23,
  /** Мелкая вода: проходима, замедляет. */
  SHALLOW: 24,
} as const;
export type TileId = (typeof Tile)[keyof typeof Tile];

interface TileInfo {
  solid: boolean;
  /** Перекрывает обзор (для линии видимости монстров). */
  opaque: boolean;
}

const INFO: TileInfo[] = [];
const def = (id: number, solid: boolean, opaque = solid) => (INFO[id] = { solid, opaque });
def(Tile.VOID, true);
def(Tile.FLOOR, false);
def(Tile.WALL, true);
def(Tile.GRASS, false);
def(Tile.PATH, false);
def(Tile.DIRT, false);
def(Tile.WATER, true, false);
def(Tile.BRIDGE, false);
def(Tile.WOOD, false);
def(Tile.STONE, false);
def(Tile.IWALL, true);
def(Tile.SAND, false);
def(Tile.STAIRS_DOWN, false);
def(Tile.STAIRS_UP, false);
def(Tile.CRACKED, true);
def(Tile.CARPET, false);
def(Tile.FARMLAND, false);
def(Tile.FLOWERS, false);
def(Tile.PLAZA, false);
def(Tile.HEDGE, true, false);
def(Tile.FENCE, true, false);
def(Tile.RUBBLE, false);
def(Tile.DEEPWATER, true, false);
def(Tile.GRAVE_DIRT, false);
def(Tile.SHALLOW, false);

export const tileSolid = (id: number) => INFO[id]?.solid ?? true;
export const tileOpaque = (id: number) => INFO[id]?.opaque ?? true;

export interface Body {
  x: number;
  y: number;
  /** Полуразмеры прямоугольника коллизии (у ног). */
  hw: number;
  hh: number;
}

export class TileMap {
  readonly tiles: Uint8Array;
  /** Счётчик блокирующих объектов (сундуки, жилы, здания) на тайле. */
  readonly blockers: Uint8Array;
  /** Версия: меняется при изменении тайлов — рендер перестраивает кеш. */
  version = 0;

  constructor(readonly w: number, readonly h: number, fill: number = Tile.VOID) {
    this.tiles = new Uint8Array(w * h).fill(fill);
    this.blockers = new Uint8Array(w * h);
  }

  inBounds(tx: number, ty: number): boolean {
    return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h;
  }

  get(tx: number, ty: number): number {
    return this.inBounds(tx, ty) ? this.tiles[ty * this.w + tx]! : Tile.VOID;
  }

  set(tx: number, ty: number, id: number): void {
    if (!this.inBounds(tx, ty)) return;
    this.tiles[ty * this.w + tx] = id;
    this.version++;
  }

  fillRect(x: number, y: number, w: number, h: number, id: number): void {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, id);
  }

  block(tx: number, ty: number, delta: number): void {
    if (!this.inBounds(tx, ty)) return;
    const i = ty * this.w + tx;
    this.blockers[i] = Math.max(0, this.blockers[i]! + delta);
  }

  solid(tx: number, ty: number): boolean {
    if (!this.inBounds(tx, ty)) return true;
    const i = ty * this.w + tx;
    return tileSolid(this.tiles[i]!) || this.blockers[i]! > 0;
  }

  /** Непроходимо для летающих (вода и пропасти проходимы). */
  solidForFlyer(tx: number, ty: number): boolean {
    if (!this.inBounds(tx, ty)) return true;
    const i = ty * this.w + tx;
    const t = this.tiles[i]!;
    return t === Tile.WALL || t === Tile.IWALL || t === Tile.VOID || t === Tile.CRACKED || this.blockers[i]! > 0;
  }

  /** Замедление на тайле под ногами (мелкая вода). */
  groundMul(x: number, y: number): number {
    return this.get(Math.floor(x / TILE), Math.floor(y / TILE)) === Tile.SHALLOW ? 0.7 : 1;
  }

  opaque(tx: number, ty: number): boolean {
    return tileOpaque(this.get(tx, ty));
  }

  solidAtPx(x: number, y: number): boolean {
    return this.solid(Math.floor(x / TILE), Math.floor(y / TILE));
  }

  overlapsSolid(x: number, y: number, hw: number, hh: number, flyer = false): boolean {
    const tx0 = Math.floor((x - hw) / TILE);
    const tx1 = Math.floor((x + hw - 0.001) / TILE);
    const ty0 = Math.floor((y - hh) / TILE);
    const ty1 = Math.floor((y + hh - 0.001) / TILE);
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) if (flyer ? this.solidForFlyer(tx, ty) : this.solid(tx, ty)) return true;
    return false;
  }

  /** Движение тела с раздельным разрешением по осям. Возвращает, упёрлось ли тело. */
  move(b: Body, dx: number, dy: number, flyer = false): { hitX: boolean; hitY: boolean } {
    let hitX = false, hitY = false;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4));
    const sx = dx / steps, sy = dy / steps;
    for (let s = 0; s < steps; s++) {
      if (sx !== 0 && !hitX) {
        const nx = b.x + sx;
        if (this.overlapsSolid(nx, b.y, b.hw, b.hh, flyer)) {
          hitX = true;
          if (sx > 0) b.x = Math.floor((nx + b.hw) / TILE) * TILE - b.hw - 0.01;
          else b.x = (Math.floor((nx - b.hw) / TILE) + 1) * TILE + b.hw + 0.01;
          if (this.overlapsSolid(b.x, b.y, b.hw, b.hh, flyer)) b.x = nx - sx; // страховка
        } else b.x = nx;
      }
      if (sy !== 0 && !hitY) {
        const ny = b.y + sy;
        if (this.overlapsSolid(b.x, ny, b.hw, b.hh, flyer)) {
          hitY = true;
          if (sy > 0) b.y = Math.floor((ny + b.hh) / TILE) * TILE - b.hh - 0.01;
          else b.y = (Math.floor((ny - b.hh) / TILE) + 1) * TILE + b.hh + 0.01;
          if (this.overlapsSolid(b.x, b.y, b.hw, b.hh, flyer)) b.y = ny - sy;
        } else b.y = ny;
      }
    }
    return { hitX, hitY };
  }

  /** Линия видимости между точками (в пикселях) по непрозрачным тайлам. */
  lineOfSight(x0: number, y0: number, x1: number, y1: number): boolean {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.ceil(d / (TILE / 3));
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      if (this.opaque(Math.floor(x / TILE), Math.floor(y / TILE))) return false;
    }
    return true;
  }
}

import { Tile, type TileMap } from '../../core/tilemap';
import { TIERS } from '../../data/tiers';
import { hash2, mix, shade, type Ctx } from './pixel';

export interface TownPalette {
  grass: [string, string, string];
  flower: string[];
  path: string;
  dirt: string;
  water: string;
  deep: string;
  sand: string;
  hedge: string;
}

const SEASON_TOWN: TownPalette[] = [
  { grass: ['#5c9a42', '#4f8a3a', '#6aa84c'], flower: ['#f0e060', '#f08ab0', '#ffffff', '#b0a0ff'], path: '#a89a86', dirt: '#8a6a48', water: '#3a78b0', deep: '#2a5a90', sand: '#d8c898', hedge: '#3a6e30' },
  { grass: ['#4f9038', '#468030', '#5ca044'], flower: ['#ffd040', '#ff6060', '#ffffff', '#ff9a40'], path: '#aa9c86', dirt: '#8a6a48', water: '#3a80b8', deep: '#2a6098', sand: '#e0d0a0', hedge: '#2e6428' },
  { grass: ['#8a8a3a', '#7a7632', '#9a9446'], flower: ['#e08030', '#c04828', '#e0b040', '#a05030'], path: '#a0927e', dirt: '#7a5a3a', water: '#3a6a98', deep: '#2a5080', sand: '#c8b888', hedge: '#6a5a28' },
  { grass: ['#dfe8f0', '#cfdae6', '#eef4fa'], flower: ['#ffffff', '#c8d8f0'], path: '#9a9290', dirt: '#8a8a90', water: '#7aa0c0', deep: '#5a80a8', sand: '#e8e8ee', hedge: '#8aa0a0' },
];

/** Палитра интерьеров. */
const INTERIOR = { wood: '#8a6440', woodS: '#6e4e32', stone: '#7a7680', stoneS: '#62606a', wall: '#a88a68', wallS: '#7a6248', top: '#2a1e18' };

/** Нарисовать весь статический слой карты. */
export function paintTiles(ctx: Ctx, map: TileMap, theme: string, season: number): void {
  for (let ty = 0; ty < map.h; ty++) for (let tx = 0; tx < map.w; tx++) paintTile(ctx, map, tx, ty, theme, season);
}

function speck(ctx: Ctx, x: number, y: number, tx: number, ty: number, n: number, color: string, seed: number) {
  for (let i = 0; i < n; i++) {
    const px = Math.floor(hash2(tx, ty, seed + i * 2) * 16), py = Math.floor(hash2(tx, ty, seed + i * 2 + 1) * 16);
    ctx.fillStyle = color;
    ctx.fillRect(x + px, y + py, 1, 1);
  }
}

export function paintTile(ctx: Ctx, map: TileMap, tx: number, ty: number, theme: string, season: number): void {
  const id = map.get(tx, ty);
  const x = tx * 16, y = ty * 16;
  const h = hash2(tx, ty, 7);
  if (theme.startsWith('tier')) return paintDungeonTile(ctx, map, tx, ty, x, y, id, TIERS[Number(theme.slice(4)) - 1]!.palette, h);
  if (theme.startsWith('interior')) return paintInteriorTile(ctx, map, tx, ty, x, y, id, h);
  const P = SEASON_TOWN[season] ?? SEASON_TOWN[0]!;
  const grass = () => {
    ctx.fillStyle = P.grass[Math.floor(h * 3)]!;
    ctx.fillRect(x, y, 16, 16);
    speck(ctx, x, y, tx, ty, 6, shade(P.grass[0], -0.18), 11);
    speck(ctx, x, y, tx, ty, 4, shade(P.grass[0], 0.18), 21);
    if (h > 0.6) {
      ctx.fillStyle = shade(P.grass[0], -0.25);
      const bx = x + Math.floor(hash2(tx, ty, 3) * 12) + 2, by = y + Math.floor(hash2(tx, ty, 4) * 10) + 4;
      ctx.fillRect(bx, by, 1, 2);
      ctx.fillRect(bx + 2, by - 1, 1, 3);
    }
  };
  switch (id) {
    case Tile.GRASS:
      grass();
      break;
    case Tile.FLOWERS:
      grass();
      for (let i = 0; i < 3; i++) {
        const fx = x + 2 + Math.floor(hash2(tx, ty, 30 + i) * 12), fy = y + 2 + Math.floor(hash2(tx, ty, 40 + i) * 12);
        ctx.fillStyle = P.flower[Math.floor(hash2(tx, ty, 50 + i) * P.flower.length)]!;
        ctx.fillRect(fx, fy, 2, 2);
        ctx.fillStyle = '#f8f0a0';
        ctx.fillRect(fx, fy, 1, 1);
      }
      break;
    case Tile.PATH: {
      ctx.fillStyle = shade(P.path, -0.2);
      ctx.fillRect(x, y, 16, 16);
      // булыжники
      for (let j = 0; j < 4; j++)
        for (let i = 0; i < 3; i++) {
          const ox = (j % 2) * 3 + i * 6 - 2, oy = j * 4;
          const c = mix(P.path, shade(P.path, 0.15), hash2(tx * 3 + i, ty * 4 + j, 9));
          ctx.fillStyle = c;
          ctx.fillRect(x + Math.max(0, ox), y + oy, Math.min(5, 16 - Math.max(0, ox)), 3);
          ctx.fillStyle = shade(c, 0.2);
          ctx.fillRect(x + Math.max(0, ox), y + oy, Math.min(4, 16 - Math.max(0, ox)), 1);
        }
      edgeBlend(ctx, map, tx, ty, x, y, [Tile.GRASS, Tile.FLOWERS], P.grass[0]);
      break;
    }
    case Tile.PLAZA: {
      ctx.fillStyle = shade(P.path, -0.25);
      ctx.fillRect(x, y, 16, 16);
      const c = mix(shade(P.path, 0.05), shade(P.path, 0.18), h);
      ctx.fillStyle = c;
      ctx.fillRect(x + 1, y + 1, 7, 7);
      ctx.fillRect(x + 9, y + 1, 6, 7);
      ctx.fillRect(x + 1, y + 9, 5, 6);
      ctx.fillRect(x + 7, y + 9, 8, 6);
      ctx.fillStyle = shade(c, 0.15);
      ctx.fillRect(x + 1, y + 1, 7, 1);
      ctx.fillRect(x + 7, y + 9, 8, 1);
      break;
    }
    case Tile.DIRT:
    case Tile.GRAVE_DIRT: {
      const base = id === Tile.DIRT ? P.dirt : mix(P.dirt, P.grass[1], 0.35);
      ctx.fillStyle = base;
      ctx.fillRect(x, y, 16, 16);
      speck(ctx, x, y, tx, ty, 8, shade(base, -0.2), 13);
      speck(ctx, x, y, tx, ty, 4, shade(base, 0.15), 17);
      edgeBlend(ctx, map, tx, ty, x, y, [Tile.GRASS, Tile.FLOWERS], P.grass[0]);
      break;
    }
    case Tile.FARMLAND: {
      ctx.fillStyle = shade(P.dirt, -0.15);
      ctx.fillRect(x, y, 16, 16);
      ctx.fillStyle = shade(P.dirt, -0.35);
      for (let j = 2; j < 16; j += 4) ctx.fillRect(x, y + j, 16, 1);
      ctx.fillStyle = shade(P.dirt, 0.1);
      for (let j = 1; j < 16; j += 4) ctx.fillRect(x, y + j, 16, 1);
      break;
    }
    case Tile.SAND:
      ctx.fillStyle = P.sand;
      ctx.fillRect(x, y, 16, 16);
      speck(ctx, x, y, tx, ty, 6, shade(P.sand, -0.12), 19);
      break;
    case Tile.WATER:
    case Tile.DEEPWATER: {
      ctx.fillStyle = id === Tile.WATER ? P.water : P.deep;
      ctx.fillRect(x, y, 16, 16);
      speck(ctx, x, y, tx, ty, 3, shade(P.water, 0.2), 23);
      const up = map.get(tx, ty - 1);
      if (up !== Tile.WATER && up !== Tile.DEEPWATER && up !== Tile.BRIDGE) {
        ctx.fillStyle = '#d8ecf8';
        ctx.fillRect(x, y, 16, 1);
        ctx.fillStyle = shade(P.water, 0.25);
        ctx.fillRect(x, y + 1, 16, 1);
      }
      break;
    }
    case Tile.BRIDGE: {
      ctx.fillStyle = '#5a3a24';
      ctx.fillRect(x, y, 16, 16);
      for (let j = 0; j < 16; j += 4) {
        ctx.fillStyle = mix('#9a6a42', '#b07a4a', hash2(tx, ty * 4 + j, 3));
        ctx.fillRect(x, y + j, 16, 3);
      }
      const l = map.get(tx - 1, ty) !== Tile.BRIDGE, r = map.get(tx + 1, ty) !== Tile.BRIDGE;
      ctx.fillStyle = '#4a2e1a';
      if (l) ctx.fillRect(x, y, 2, 16);
      if (r) ctx.fillRect(x + 14, y, 2, 16);
      break;
    }
    case Tile.FENCE: {
      grass();
      const wood = '#8a6440', woodS = '#5a4028';
      ctx.fillStyle = woodS;
      ctx.fillRect(x + 6, y + 3, 4, 12);
      ctx.fillStyle = wood;
      ctx.fillRect(x + 6, y + 2, 3, 12);
      const lr = [map.get(tx - 1, ty), map.get(tx + 1, ty)].map((t) => t === Tile.FENCE);
      if (lr[0]) {
        ctx.fillStyle = wood;
        ctx.fillRect(x, y + 5, 7, 2);
        ctx.fillRect(x, y + 10, 7, 2);
      }
      if (lr[1]) {
        ctx.fillStyle = wood;
        ctx.fillRect(x + 8, y + 5, 8, 2);
        ctx.fillRect(x + 8, y + 10, 8, 2);
      }
      break;
    }
    case Tile.HEDGE:
      ctx.fillStyle = P.hedge;
      ctx.fillRect(x, y, 16, 16);
      speck(ctx, x, y, tx, ty, 10, shade(P.hedge, 0.2), 29);
      break;
    default:
      ctx.fillStyle = '#000';
      ctx.fillRect(x, y, 16, 16);
  }
}

/** Мягкий переход травы на соседние тайлы дороги/земли. */
function edgeBlend(ctx: Ctx, map: TileMap, tx: number, ty: number, x: number, y: number, grassIds: number[], grass: string) {
  ctx.fillStyle = grass;
  const n = (dx: number, dy: number) => grassIds.includes(map.get(tx + dx, ty + dy));
  for (let i = 0; i < 16; i += 2) {
    const k = hash2(tx * 16 + i, ty, 5) > 0.5 ? 2 : 1;
    if (n(0, -1)) ctx.fillRect(x + i, y, 2, k);
    if (n(0, 1)) ctx.fillRect(x + i, y + 16 - k, 2, k);
    if (n(-1, 0)) ctx.fillRect(x, y + i, k, 2);
    if (n(1, 0)) ctx.fillRect(x + 16 - k, y + i, k, 2);
  }
}

const isWallish = (t: number) => t === Tile.WALL || t === Tile.VOID || t === Tile.CRACKED || t === Tile.IWALL;

function paintDungeonTile(ctx: Ctx, map: TileMap, tx: number, ty: number, x: number, y: number, id: number, P: (typeof TIERS)[number]['palette'], h: number) {
  const below = map.get(tx, ty + 1);
  switch (id) {
    case Tile.FLOOR:
    case Tile.RUBBLE:
    case Tile.SHALLOW:
    case Tile.STAIRS_DOWN:
    case Tile.STAIRS_UP: {
      const base = P.floor[Math.floor(h * 3)]!;
      ctx.fillStyle = base;
      ctx.fillRect(x, y, 16, 16);
      // плиты
      ctx.fillStyle = shade(base, -0.18);
      if ((tx + ty) % 2 === 0) ctx.fillRect(x, y + 15, 16, 1);
      if (tx % 2 === 0) ctx.fillRect(x + 15, y, 1, 16);
      speck(ctx, x, y, tx, ty, 5, shade(base, -0.22), 31);
      speck(ctx, x, y, tx, ty, 3, shade(base, 0.12), 37);
      if (h > 0.85) {
        ctx.fillStyle = shade(base, -0.3);
        ctx.fillRect(x + 3, y + 6, 5, 1);
        ctx.fillRect(x + 7, y + 7, 3, 1);
      }
      // тень под стеной
      if (isWallish(map.get(tx, ty - 1))) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(x, y, 16, 3);
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(x, y + 3, 16, 2);
      }
      if (isWallish(map.get(tx - 1, ty))) {
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(x, y, 2, 16);
      }
      if (id === Tile.SHALLOW) {
        ctx.fillStyle = 'rgba(40,100,140,0.55)';
        ctx.fillRect(x, y, 16, 16);
        ctx.fillStyle = 'rgba(160,210,240,0.35)';
        ctx.fillRect(x + 2 + Math.floor(h * 8), y + 4, 5, 1);
        ctx.fillRect(x + 8 - Math.floor(h * 5), y + 11, 4, 1);
        const edge = 'rgba(200,230,250,0.45)';
        ctx.fillStyle = edge;
        if (map.get(tx, ty - 1) !== Tile.SHALLOW) ctx.fillRect(x, y, 16, 1);
        if (map.get(tx - 1, ty) !== Tile.SHALLOW) ctx.fillRect(x, y, 1, 16);
        if (map.get(tx + 1, ty) !== Tile.SHALLOW) ctx.fillRect(x + 15, y, 1, 16);
        if (map.get(tx, ty + 1) !== Tile.SHALLOW) ctx.fillRect(x, y + 15, 16, 1);
      }
      if (id === Tile.RUBBLE) {
        ctx.fillStyle = shade(P.wall, -0.1);
        ctx.fillRect(x + 2, y + 9, 4, 3);
        ctx.fillRect(x + 9, y + 4, 3, 3);
        ctx.fillRect(x + 11, y + 11, 3, 2);
      }
      if (id === Tile.STAIRS_DOWN) {
        ctx.fillStyle = '#050304';
        ctx.fillRect(x + 1, y + 1, 14, 14);
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = shade(P.floor[0], -0.2 - i * 0.18);
          ctx.fillRect(x + 1 + i, y + 2 + i * 3, 14 - i * 2, 2);
        }
        ctx.fillStyle = shade(P.accent, -0.2);
        ctx.fillRect(x, y, 16, 1);
      }
      if (id === Tile.STAIRS_UP) {
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = shade(P.floor[1], 0.25 - i * 0.1);
          ctx.fillRect(x + 1, y + 1 + i * 4, 14, 3);
          ctx.fillStyle = shade(P.floor[1], -0.3);
          ctx.fillRect(x + 1, y + 4 + i * 4, 14, 1);
        }
        ctx.fillStyle = '#8a6a44';
        ctx.fillRect(x + 1, y, 1, 16);
        ctx.fillRect(x + 14, y, 1, 16);
      }
      break;
    }
    case Tile.WALL:
    case Tile.CRACKED: {
      if (!isWallish(below)) {
        // лицевая грань: кирпичи
        ctx.fillStyle = P.wallDark;
        ctx.fillRect(x, y, 16, 16);
        for (let row = 0; row < 4; row++) {
          const off = (row + ty) % 2 ? 4 : 0;
          for (let bx = -off; bx < 16; bx += 8) {
            const c = mix(P.wall, shade(P.wall, -0.12), hash2(tx * 4 + bx, ty * 4 + row, 41));
            ctx.fillStyle = c;
            ctx.fillRect(x + Math.max(0, bx), y + row * 4, Math.min(7, 16 - Math.max(0, bx), 7 + bx), 3);
            ctx.fillStyle = shade(c, 0.12);
            ctx.fillRect(x + Math.max(0, bx), y + row * 4, Math.min(7, 16 - Math.max(0, bx), 7 + bx), 1);
          }
        }
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x, y + 13, 16, 3);
        ctx.fillStyle = shade(P.top, 0.25);
        ctx.fillRect(x, y, 16, 1);
      } else {
        ctx.fillStyle = P.top;
        ctx.fillRect(x, y, 16, 16);
        speck(ctx, x, y, tx, ty, 3, shade(P.top, 0.12), 43);
        const edge = shade(P.top, 0.35);
        ctx.fillStyle = edge;
        if (!isWallish(map.get(tx - 1, ty))) ctx.fillRect(x, y, 1, 16);
        if (!isWallish(map.get(tx + 1, ty))) ctx.fillRect(x + 15, y, 1, 16);
        if (!isWallish(map.get(tx, ty - 1))) ctx.fillRect(x, y, 16, 1);
      }
      break;
    }
    case Tile.VOID:
    default:
      ctx.fillStyle = shade(P.top, -0.5);
      ctx.fillRect(x, y, 16, 16);
  }
}

function paintInteriorTile(ctx: Ctx, map: TileMap, tx: number, ty: number, x: number, y: number, id: number, h: number) {
  const I = INTERIOR;
  switch (id) {
    case Tile.WOOD: {
      ctx.fillStyle = I.woodS;
      ctx.fillRect(x, y, 16, 16);
      for (let j = 0; j < 16; j += 4) {
        const c = mix(I.wood, shade(I.wood, 0.1), hash2(tx, ty * 4 + j, 3));
        ctx.fillStyle = c;
        ctx.fillRect(x, y + j, 16, 3);
        ctx.fillStyle = I.woodS;
        const seam = Math.floor(hash2(tx, ty * 4 + j, 5) * 16);
        ctx.fillRect(x + seam, y + j, 1, 3);
      }
      break;
    }
    case Tile.STONE: {
      ctx.fillStyle = I.stoneS;
      ctx.fillRect(x, y, 16, 16);
      ctx.fillStyle = mix(I.stone, shade(I.stone, 0.08), h);
      ctx.fillRect(x + 1, y + 1, 14, 14);
      ctx.fillStyle = shade(I.stone, 0.12);
      ctx.fillRect(x + 1, y + 1, 14, 1);
      break;
    }
    case Tile.CARPET:
      ctx.fillStyle = '#8a2a2a';
      ctx.fillRect(x, y, 16, 16);
      break;
    case Tile.IWALL: {
      const below = map.get(tx, ty + 1);
      if (below !== Tile.IWALL && below !== Tile.VOID && ty < map.h - 1) {
        ctx.fillStyle = I.wall;
        ctx.fillRect(x, y, 16, 16);
        ctx.fillStyle = I.wallS;
        for (let i = 0; i < 16; i += 4) ctx.fillRect(x + i, y, 1, 13);
        ctx.fillStyle = shade(I.wallS, -0.3);
        ctx.fillRect(x, y + 13, 16, 3);
      } else {
        ctx.fillStyle = I.top;
        ctx.fillRect(x, y, 16, 16);
        ctx.fillStyle = shade(I.top, 0.3);
        if (map.get(tx, ty + 1) !== Tile.IWALL && ty === map.h - 1) ctx.fillRect(x, y, 16, 1);
      }
      break;
    }
    default:
      ctx.fillStyle = '#0a0806';
      ctx.fillRect(x, y, 16, 16);
  }
  // тень под стеной
  if (id !== Tile.IWALL && id !== Tile.VOID && map.get(tx, ty - 1) === Tile.IWALL) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x, y, 16, 3);
  }
}

export function townPalette(season: number): TownPalette {
  return SEASON_TOWN[season] ?? SEASON_TOWN[0]!;
}

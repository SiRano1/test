'use strict';
/* ===== Генерация открытого мира ===== */
const WW = 100, WH = 150, OW_H = 100, TS = 32;
const T = { DEEP: 0, SHALLOW: 1, SAND: 2, GRASS: 3, FOREST: 4, ROCK: 5, SNOW: 6, ASH: 7, ROAD: 8, SWAMP: 9, PLAZA: 10, ARENA: 11, BRIDGE: 12, FLOOR: 13 };
const TILE_COL = { 0: '#1f4f8f', 1: '#4c9ad0', 2: '#e2cf8f', 3: '#5c9a3c', 4: '#457a30', 5: '#6b6f78', 6: '#eef4fa', 7: '#3c3636', 8: '#b8996a', 9: '#3f5a3a', 10: '#b0a48c', 11: '#c9a86a', 12: '#8a6a3c', 13: '#5a5860' };

const BUILDINGS_DEF = [
  // name, kind, x, y, w, h, roof, sign
  ['smith', 'shop', 38, 40, 5, 3, '#8a3a2a', '⚒️ Кузница'],
  ['church', 'church', 43, 36, 4, 3, '#6a6a9a', '⛪ Храм'],
  ['hall', 'hall', 56, 36, 8, 4, '#3a5a9a', '🏛️ Ратуша'],
  ['tailor', 'shop', 54, 43, 5, 3, '#8a3a6a', '🧵 Лавка одежды'],
  ['alch', 'shop', 38, 56, 5, 3, '#2e7d4f', '⚗️ Аптека'],
  ['beast', 'shop', 43, 56, 5, 3, '#7a5a2a', '🐾 Зверинец'],
  ['jewel', 'shop', 54, 56, 5, 3, '#6a3fa0', '💎 Ювелир'],
  ['inn', 'inn', 59, 56, 6, 3, '#9a4a2a', '🍺 Трактир'],
  ['houseA', 'house', 59, 52, 4, 3, '#7a4a3a', ''], ['houseB', 'house', 38, 52, 4, 3, '#4a6a7a', ''], ['houseC', 'house', 42, 52, 3, 3, '#7a6a3a', ''],
  ['hamshop', 'shop', 75, 54, 5, 3, '#6a5a3a', '🏪 Лавка'], ['hamA', 'house', 70, 58, 4, 3, '#7a4a3a', ''], ['hamB', 'house', 81, 58, 4, 3, '#5a6a4a', ''], ['hamC', 'house', 72, 63, 4, 3, '#6a4a5a', ''],
  ['tower', 'tower', 68, 22, 5, 4, '#4a4a8a', '🗼 Башня Лунного Света'],
  ['keep', 'keep', 85, 4, 9, 4, '#4a1a1a', '🌋 Пепельная крепость'],
  ['farmhouse', 'house', 35, 70, 5, 3, '#7a5a3a', ''],
  ['ruinA', 'ruin', 27, 26, 4, 3, '#5a5650', ''], ['ruinB', 'ruin', 32, 27, 3, 2, '#5a5650', '']
];
const WORLD_SPAWN = { x: 50, y: 53 };

function genWorld(seed = 1337) {
  const w = { W: WW, H: WH, tiles: new Uint8Array(WW * WH), blk: new Uint8Array(WW * WH), fly: new Uint8Array(WW * WH), objs: [], buildings: [], spawns: [], chests: [], lights: [], seed };
  const rng = mulberry32(seed);
  const I = (x, y) => y * WW + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < WW && y < WH;
  const get = (x, y) => inb(x, y) ? w.tiles[I(x, y)] : T.DEEP;
  const set = (x, y, t) => { if (inb(x, y)) w.tiles[I(x, y)] = t; };
  const near = (x, y, l, r) => Math.hypot(x - l.x, y - l.y) < r;

  /* --- базовый рельеф --- */
  for (let y = OW_H; y < WH; y++) for (let x = 0; x < WW; x++) w.tiles[I(x, y)] = T.ROCK;
  for (let y = 0; y < OW_H; y++) for (let x = 0; x < WW; x++) {
    const edge = Math.min(x, y, WW - 1 - x, OW_H - 1 - y);
    const n1 = fbm(x / 9, y / 9, seed), mt = fbm(x / 12, y / 12, seed + 21), mo = fbm(x / 15 + 40, y / 15, seed + 9);
    let t = T.GRASS;
    if (y < 17 + n1 * 4) t = T.SNOW;
    if (x + n1 * 9 > 77 && y - n1 * 7 < 33) t = T.ASH;
    else if (x > 61 && y > 21 && y < 80 && mo > 0.42) t = T.FOREST;
    else if (x < 40 && y > 20 && y < 46 && mo > 0.58) t = T.FOREST;
    if (x < 42 && y > 68 && n1 > 0.35) t = T.SWAMP;
    if (y < 36 + n1 * 3 && mt > (y < 17 ? 0.5 : 0.6) && !(x > 77 && y < 33)) t = T.ROCK;
    if (mt > 0.78 && y > 36) t = T.ROCK;
    const ld = Math.hypot(x - 19, y - 52) + (n1 - 0.5) * 6;
    if (ld < 6.5) t = T.DEEP; else if (ld < 9) t = T.SHALLOW; else if (ld < 10) t = T.SAND;
    if (edge < 4) t = T.DEEP; else if (edge < 6) t = T.SHALLOW; else if (edge < 7) t = T.SAND;
    if (t === T.GRASS && mo > 0.8 && edge > 9) t = T.SHALLOW;
    w.tiles[I(x, y)] = t;
  }
  const clearArea = (cx, cy, r, tile) => { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if (inb(x, y) && Math.hypot(x - cx, y - cy) <= r) set(x, y, tile); };
  const rectTiles = (x0, y0, x1, y1, tile) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, tile); };
  const carve = (ax, ay, bx, by, rad = 1) => {
    const len = Math.hypot(bx - ax, by - ay), n = Math.ceil(len * 1.5), ph = rng() * 6;
    for (let i = 0; i <= n; i++) {
      const t = i / n, wob = Math.sin(t * len / 5 + ph) * 2.2 * Math.sin(t * Math.PI);
      const px = lerp(ax, bx, t) - (by - ay) / len * wob, py = lerp(ay, by, t) + (bx - ax) / len * wob;
      for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
        if (Math.hypot(dx, dy) > rad + 0.3) continue;
        const x = Math.round(px) + dx, y = Math.round(py) + dy, c = get(x, y);
        if (c === T.DEEP || c === T.SHALLOW) set(x, y, T.BRIDGE); else if (c !== T.PLAZA && c !== T.BRIDGE) set(x, y, T.ROAD);
      }
    }
  };

  /* --- Эльдергард --- */
  rectTiles(34, 34, 66, 64, T.GRASS);
  rectTiles(34, 49, 66, 51, T.ROAD); rectTiles(49, 33, 51, 63, T.ROAD); rectTiles(34, 60, 66, 62, T.ROAD);
  rectTiles(46, 46, 54, 54, T.PLAZA);
  /* --- Локации --- */
  const L = LOCS;
  clearArea(L.hamlet.x, L.hamlet.y, 8, T.GRASS);
  clearArea(L.scout.x, L.scout.y, 5, T.FOREST); clearArea(L.tower.x, L.tower.y + 1, 7, T.GRASS);
  clearArea(L.bandits.x, L.bandits.y, 8, T.FOREST); clearArea(L.ruins.x + 2, L.ruins.y + 3, 9, T.GRASS);
  rectTiles(28, 32, 36, 37, T.GRASS);
  clearArea(L.meadow.x, L.meadow.y, 7, T.GRASS); clearArea(L.farm.x, L.farm.y, 6, T.GRASS); rectTiles(33, 66, 52, 82, T.GRASS);
  rectTiles(44, 3, 56, 15, T.FLOOR); rectTiles(42, 8, 58, 14, T.FLOOR);
  rectTiles(82, 3, 96, 19, T.ASH); clearArea(89, 12, 6, T.FLOOR);
  clearArea(62, 67, 6, T.ARENA);
  // дороги
  carve(66, 50, 76, 58); carve(77, 58, 88, 64); carve(66, 50, 84, 36); carve(70, 30, 66, 50); carve(70, 27, 84, 18); carve(84, 18, 89, 19);
  carve(50, 34, 50, 14, 1); carve(34, 50, 28, 36); carve(50, 63, 52, 82); carve(48, 63, 43, 71); carve(55, 62, 62, 64); carve(84, 36, 84, 36);
  carve(28, 36, 30, 33);
  // Городская дорога до ворот арены
  rectTiles(61, 62, 63, 64, T.ROAD);
  // Площадь двери
  const doorSpots = {};
  const ensureLand = (x, y, t) => { const c = get(x, y); if (c === T.DEEP || c === T.SHALLOW) set(x, y, t); };

  /* --- Здания --- */
  const B = {};
  BUILDINGS_DEF.forEach(([name, kind, x, y, bw, bh, roof, sign]) => {
    const b = { name, kind, x, y, w: bw, h: bh, roof, sign };
    w.buildings.push(b); B[name] = b;
    for (let yy = y; yy < y + bh; yy++) for (let xx = x; xx < x + bw; xx++) { if (inb(xx, yy)) { w.blk[I(xx, yy)] = 1; w.fly[I(xx, yy)] = 1; if (get(xx, yy) !== T.PLAZA && get(xx, yy) !== T.ROAD) set(xx, yy, T.GRASS); } }
    const dx = x + Math.floor(bw / 2);
    SPOTS[name + '_door'] = [dx, y + bh + 1];
    b.door = { x: dx, y: y + bh };
    // дорожка от двери до ближайшей дороги
    for (let yy = y + bh; yy < WH; yy++) { const c = get(dx, yy); if (c === T.ROAD || c === T.PLAZA) break; if (yy - (y + bh) > 8) break; set(dx, yy, T.ROAD); }
  });
  // дорожки для северных зданий вниз до дороги
  ['smith', 'church', 'hall', 'tailor'].forEach(n => { const b = B[n]; for (let yy = b.y + b.h; yy < 50; yy++) { const c = get(b.door.x, yy); if (c === T.ROAD || c === T.PLAZA) break; if (w.blk[I(b.door.x, yy)]) break; set(b.door.x, yy, T.ROAD); } });
  ['alch', 'beast', 'jewel', 'inn'].forEach(n => { const b = B[n]; for (let yy = b.y + b.h; yy <= 60; yy++) if (get(b.door.x, yy) !== T.ROAD) set(b.door.x, yy, T.ROAD); });
  ['hamshop'].forEach(n => { const b = B[n]; for (let yy = b.y + b.h; yy < 60; yy++) if (get(b.door.x, yy) !== T.ROAD) set(b.door.x, yy, T.ROAD); });
  SPOTS.tavern_tables = [52, 61]; SPOTS.hamlet_shop = [77, 58]; SPOTS.tower_door = [70, 27]; SPOTS.barracks = [64, 47]; SPOTS.guard_gate = [63, 50];
  SPOTS.pip_home = [43, 55]; SPOTS.arena_gate = [62, 63]; SPOTS.bard_stage = [56, 55];
  SPOTS.plaza = [48, 50]; SPOTS.plaza2 = [47, 52]; SPOTS.plaza3 = [52, 46]; SPOTS.plaza4 = [52, 52]; SPOTS.farm_yard = [45, 72]; SPOTS.scout_spot = [84, 37];
  // ключевые точки должны быть проходимы
  Object.values(SPOTS).forEach(([x, y]) => { ensureLand(x, y, T.ROAD); });

  /* --- Входы в подземелья --- */
  DUNGEONS.forEach(d => { const [ex, ey] = d.entrance; rectTiles(ex - 1, ey - 1, ex + 1, ey + 1, T.ROAD); SPOTS['dg_' + d.id] = [ex, ey]; });
  carve(71, 66, 74, 59); carve(38, 14, 50, 17); carve(26, 84, 36, 79); carve(33, 36, 33, 45);
  /* --- Объекты --- */
  const occupied = new Set();
  const occ = (x, y) => occupied.has(x + ',' + y);
  const addObj = (t, tx, ty, opts = {}) => {
    const o = Object.assign({ t, tx, ty, x: tx * TS + TS / 2, y: ty * TS + TS - 2, v: Math.floor(hash2(tx, ty, seed) * 4) }, opts);
    if (opts.block) { if (inb(tx, ty)) w.blk[I(tx, ty)] = 1; }
    w.objs.push(o); occupied.add(tx + ',' + ty); return o;
  };
  w.addObj = addObj;
  const walkable = (x, y) => { const c = get(x, y); return inb(x, y) && c !== T.DEEP && c !== T.ROCK && !w.blk[I(x, y)]; };
  const roadish = c => c === T.ROAD || c === T.PLAZA || c === T.BRIDGE;
  const nearRoad = (x, y, r) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const c = get(x + dx, y + dy); if (roadish(c) || c === T.ARENA) return true; } return false; };
  const nearSpot = (x, y, r) => Object.values(SPOTS).some(s => Math.hypot(s[0] - x, s[1] - y) < r) || Object.values(LOCS).some(l => l !== LOCS.town && Math.hypot(l.x - x, l.y - y) < 3);
  const inTown = (x, y) => x >= 34 && x <= 66 && y >= 33 && y <= 64;

  // Деревья, кусты, цветы, камни
  for (let y = 2; y < OW_H - 2; y++) for (let x = 2; x < WW - 2; x++) {
    const c = get(x, y), r = hash2(x, y, seed + 5), r2 = hash2(x, y, seed + 6);
    if (w.blk[I(x, y)] || occ(x, y) || inTown(x, y) && (c !== T.GRASS || nearRoad(x, y, 1))) continue;
    if (c === T.DEEP || c === T.BRIDGE || c === T.ROAD || c === T.PLAZA || c === T.ARENA || c === T.FLOOR) continue;
    if (nearRoad(x, y, 1) || nearSpot(x, y, 2.5)) continue;
    if (c === T.GRASS) {
      if (!inTown(x, y) && r < 0.05) addObj('tree', x, y, { block: true, kind: 0 });
      else if (r < 0.075 && !inTown(x, y)) addObj('bush', x, y, {});
      else if (r2 < 0.14) addObj('flower', x, y, {});
      else if (r2 > 0.985 && !inTown(x, y)) addObj('rock', x, y, { block: true });
    } else if (c === T.FOREST) {
      if (r < 0.28) addObj('tree', x, y, { block: true, kind: r < 0.09 ? 1 : 0 });
      else if (r < 0.33) addObj('bush', x, y, {});
      else if (r2 < 0.05) addObj('mushroom', x, y, {});
      else if (r2 > 0.97) addObj('rock', x, y, { block: true });
    } else if (c === T.SNOW) {
      if (r < 0.09) addObj('tree', x, y, { block: true, kind: 2 });
      else if (r2 > 0.98) addObj('rock', x, y, { block: true, snow: true });
    } else if (c === T.ASH) {
      if (r < 0.05) addObj('tree', x, y, { block: true, kind: 3 });
      else if (r2 > 0.97) addObj('rock', x, y, { block: true, ash: true });
    } else if (c === T.SWAMP) {
      if (r < 0.06) addObj('tree', x, y, { block: true, kind: 3 });
      else if (r < 0.2) addObj('reed', x, y, {});
      else if (r2 < 0.05) addObj('mushroom', x, y, {});
    } else if (c === T.SAND) {
      if (r < 0.04) addObj('rock', x, y, { block: true });
    } else if (c === T.SHALLOW) {
      if (r < 0.1) addObj('reed', x, y, {});
    }
  }

  // Городской декор
  const decor = (t, x, y, o) => { if (!w.blk[I(x, y)]) addObj(t, x, y, o); };
  decor('fountain', 50, 50, { block: true });
  for (const [x, y] of [[47, 47], [53, 47], [47, 53], [53, 53]]) decor('lamp', x, y, { block: true, light: 150 });
  for (let x = 36; x <= 64; x += 6) { if (Math.abs(x - 50) > 3) { decor('lamp', x, 48, { block: true, light: 130 }); decor('lamp', x, 52, { block: true, light: 130 }); } }
  for (let y = 38; y <= 62; y += 6) { if (Math.abs(y - 50) > 3) { decor('lamp', 48, y, { block: true, light: 130 }); decor('lamp', 52, y, { block: true, light: 130 }); } }
  for (const [x, y] of [[41, 44], [58, 47], [44, 59], [60, 59], [37, 58], [57, 59]]) if (!occ(x, y)) decor('barrel', x, y, { block: true });
  for (const [x, y] of [[42, 44], [59, 47], [46, 60]]) if (!occ(x, y)) decor('crate', x, y, { block: true });
  for (const [x, y] of [[35, 49], [35, 51], [65, 49], [65, 51], [49, 34], [51, 34]]) decor('gate', x, y, { block: true });
  for (const [x, y] of [[45, 45], [55, 45], [45, 55], [55, 55]]) if (!occ(x, y)) decor('banner', x, y, { block: true, light: 0 });
  decor('sign', 62, 49, {}); decor('stall', 53, 54, { block: true }); decor('stall', 47, 54, { block: true });
  // Флора вокруг города
  for (let i = 0; i < 60; i++) { const x = randiS(rng, 35, 65), y = randiS(rng, 35, 63); if (get(x, y) === T.GRASS && !occ(x, y) && !w.blk[I(x, y)] && !nearRoad(x, y, 1) && !nearSpot(x, y, 2)) addObj('flower', x, y, {}); }
  for (const [x, y] of [[36, 45], [37, 60], [63, 45], [64, 63], [35, 40], [65, 40]]) if (!occ(x, y) && get(x, y) === T.GRASS) addObj('tree', x, y, { block: true, kind: 0 });
  // Арена: забор кругом с воротами
  for (let a = 0; a < 40; a++) { const an = a / 40 * TAU, x = Math.round(62 + Math.cos(an) * 5.2), y = Math.round(67 + Math.sin(an) * 5.2); if (!(x >= 61 && x <= 63 && y <= 62 + 2) && !occ(x, y)) addObj('fence', x, y, { block: true }); }
  // Лагерь разведчика
  addObj('tent', 82, 35, { block: true }); addObj('tent', 86, 35, { block: true }); addObj('campfire', 84, 36, { block: true, light: 170 }); addObj('crate', 83, 38, { block: true });
  // Логово разбойников
  for (const [x, y] of [[85, 62], [91, 62], [86, 67], [91, 67]]) addObj('tent', x, y, { block: true });
  addObj('campfire', 88, 64, { block: true, light: 170 }); addObj('crate', 89, 66, { block: true }); addObj('barrel', 87, 61, { block: true });
  // Руины и кладбище
  for (const [x, y] of [[26, 30], [31, 30], [29, 33], [34, 31], [25, 27], [35, 26]]) addObj('pillar', x, y, { block: true });
  for (let i = 0; i < 16; i++) { const x = 29 + (i % 6) * 1.5 | 0, y = 33 + Math.floor(i / 6) * 2; if (!occ(x, y) && get(x, y) !== T.ROAD) addObj('grave', x, y, { block: true }); }
  addObj('brazier', 30, 35, { block: true, light: 130 }); addObj('brazier', 28, 31, { block: true, light: 130 });
  // Пещера
  addObj('cave', 50, 5, { block: true }); addObj('brazier', 47, 9, { block: true, light: 140 }); addObj('brazier', 53, 9, { block: true, light: 140 });
  // Крепость
  addObj('brazier', 87, 9, { block: true, light: 170 }); addObj('brazier', 91, 9, { block: true, light: 170 }); addObj('brazier', 85, 14, { block: true, light: 150 }); addObj('brazier', 93, 14, { block: true, light: 150 });
  // Башня и хутор
  addObj('brazier', 67, 27, { block: true, light: 150 }); addObj('brazier', 73, 27, { block: true, light: 150 });
  addObj('well', 79, 62, { block: true }); addObj('lamp', 76, 57, { block: true, light: 130 }); addObj('lamp', 79, 57, { block: true, light: 130 });
  // Ферма
  addObj('hay', 41, 69, { block: true }); addObj('hay', 46, 69, { block: true }); addObj('cart', 48, 73, { block: true });
  for (let y = 75; y <= 78; y++) for (let x = 38; x <= 45; x++) addObj('plot', x, y, { key: x + ',' + y });
  addObj('bed', 38, 73, {}); addObj('bin', 40, 73, { block: true }); addObj('board', 44, 47, { block: true });
  // Собака Бублик
  addObj('dog', 52, 82, {});

  // Сундуки
  const chest = (id, x, y, loot, gold) => { const c = addObj('chest', x, y, { block: true, id, loot, gold }); w.chests.push(c); };
  chest('c_ruins', 30, 29, [['lyrics', 1], ['hp_1', 2]], 120); chest('c_bandit', 90, 65, [['rs_1', 2], ['elx_speed', 1]], 260); chest('c_scout', 82, 38, [['hp_0', 3], ['lure', 3]], 60);
  chest('c_cave', 55, 7, [['hp_2', 2], ['gem', 1], ['elx_might', 1]], 400); chest('c_keep', 92, 15, [['gem', 2], ['hp_2', 2], ['rs_2', 2]], 700); chest('c_meadow', 55, 85, [['treat', 2], ['lure', 3]], 80);
  chest('c_swamp', 24, 78, [['ectoplasm', 2], ['rs_1', 2]], 150); chest('c_peak', 40, 9, [['gem', 2], ['frost_fang', 2]], 300);

  // Травы и руда
  const gather = (kind, item, cnt, test) => { let n = 0, tries = 0; while (n < cnt && tries++ < 4000) { const x = randiS(rng, 8, 92), y = randiS(rng, 8, 92); if (test(x, y) && !occ(x, y) && !w.blk[I(x, y)] && !nearRoad(x, y, 1) && !inTown(x, y)) { addObj(kind, x, y, { item, cd: 0 }); n++; } } };
  gather('herb', 'moonroot', 16, (x, y) => get(x, y) === T.FOREST && x > 62);
  gather('herb', 'moonroot', 4, (x, y) => get(x, y) === T.GRASS && x < 40 && y < 46 && get(x, y) !== T.SAND);
  gather('ore', 'iron_ore', 12, (x, y) => { const c = get(x, y); return (c === T.GRASS || c === T.SNOW) && y > 12 && y < 40 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(d => get(x + d[0], y + d[1]) === T.ROCK); });

  /* --- Подземелья --- */
  const DG_ROOMS = [[2, 9, 8, 15], [11, 3, 19, 10], [11, 13, 19, 20], [22, 5, 30, 18]]; // вход, комната A, комната B, босс
  const DG_CORR = [[9, 11, 10, 6], [9, 13, 10, 17], [19, 5, 21, 8], [19, 17, 21, 14]];
  const dgSpawns = [];
  DUNGEONS.forEach(d => {
    const X = (x) => d.x0 + x, Y = (y) => d.y0 + y;
    DG_ROOMS.forEach(r => rectTiles(X(r[0]), Y(r[1]), X(r[2]), Y(r[3]), T.FLOOR));
    DG_CORR.forEach(c => { const [ax, ay, bx, by] = c; const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), y0 = Math.min(ay, by), y1 = Math.max(ay, by); rectTiles(X(ax), Y(Math.min(ay, by)), X(ax + (bx > ax ? 1 : 0)), Y(Math.max(ay, by)), T.FLOOR); rectTiles(X(Math.min(ax, bx)), Y(by), X(Math.max(ax, bx)), Y(by + 1), T.FLOOR); rectTiles(X(Math.min(ax, bx)), Y(ay), X(Math.max(ax, bx)), Y(ay + 1), T.FLOOR); });
    d.entry = [X(4), Y(12)];
    addObj('portal', X(3), Y(12), { dest: [d.entrance[0], d.entrance[1] + 2], label: 'Выход', exit: true, light: 120, dg: d.id });
    for (const [rx, ry] of [[3, 10], [7, 10], [12, 4], [18, 4], [12, 19], [18, 19], [23, 6], [29, 6], [23, 17], [29, 17]]) addObj('brazier', X(rx), Y(ry), { block: true, light: 150 });
    const c = addObj('chest', X(29), Y(11), { block: true, id: 'dg_' + d.id, loot: d.loot, gold: d.gold }); w.chests.push(c);
    const c2 = addObj('chest', X(18), Y(16), { block: true, id: 'dg2_' + d.id, loot: [['hp_1', 2], ['rs_1', 1]], gold: Math.round(d.gold / 3) }); w.chests.push(c2);
    const pos = (r) => [DG_ROOMS[r][0] + 1 + Math.floor(rng() * (DG_ROOMS[r][2] - DG_ROOMS[r][0] - 1)), DG_ROOMS[r][1] + 1 + Math.floor(rng() * (DG_ROOMS[r][3] - DG_ROOMS[r][1] - 1))];
    let k = 0; d.mobs.forEach(([id, n]) => { for (let i = 0; i < n; i++) { const [rx, ry] = pos(1 + (k++ % 2)); const m = MON[id]; dgSpawns.push({ id, tx: X(rx), ty: Y(ry), lvl: Math.max(m.lvl[0], d.lvl + Math.floor(rng() * 3)), dg: d.id }); } });
    dgSpawns.push({ id: d.boss, tx: X(26), ty: Y(11), lvl: MON[d.boss].lvl[0], boss: d.boss, dg: d.id });
    const [ex, ey] = d.entrance; addObj('portal', ex, ey, { dest: [X(4), Y(12)], label: d.name, light: 130, dg: d.id, lvl: d.lvl });
  });

  /* --- Спавны монстров --- */
  const zoneAt = (x, y) => { const c = get(x, y); return c === T.SNOW ? 'snow' : c === T.ROCK ? 'mountain' : c === T.ASH ? 'ash' : c === T.SWAMP ? 'swamp' : c === T.FOREST ? 'forest' : (c === T.GRASS || c === T.SAND || c === T.ROAD || c === T.FLOOR) ? 'plains' : null; };
  const TABLE = {
    plains: [['rat', 3], ['fox', 3], ['boar', 4], ['wolf', 3], ['hawk', 2], ['bandit', 1]],
    forest: [['wolf', 3], ['bear', 1.5], ['spider', 3], ['bandit', 1.5], ['fox', 1], ['boar', 2], ['archer', 1], ['hawk', 1]],
    mountain: [['bear', 2], ['troll', 3], ['snowwolf', 1]], snow: [['snowwolf', 3], ['troll', 1.5], ['hawk', 1]],
    ash: [['cultist', 3], ['golem', 1.5]], swamp: [['slime', 3], ['goblin', 2], ['spider', 1]]
  };
  const pickW = list => { const tot = list.reduce((s, e) => s + e[1], 0); let r = rng() * tot; for (const e of list) { if ((r -= e[1]) <= 0) return e[0]; } return list[0][0]; };
  for (let cy = 4; cy < OW_H - 4; cy += 6) for (let cx = 4; cx < WW - 4; cx += 6) {
    const x = cx + Math.floor(rng() * 6), y = cy + Math.floor(rng() * 6);
    if (!walkable(x, y) || occ(x, y) || inTown(x, y) || isSafeTile(x, y) || Math.hypot(x - 50, y - 50) < 15) continue;
    if (Object.values(LOCS).some(l => l !== LOCS.town && l !== LOCS.whisper && l !== LOCS.peaks && l !== LOCS.lake && Math.hypot(l.x - x, l.y - y) < l.r + 2 && ['hamlet', 'scout', 'tower', 'arena', 'meadow'].some(k => LOCS[k] === l))) continue;
    if (rng() < 0.08) continue;
    const z = zoneAt(x, y); if (!z) continue;
    const d = Math.hypot(x - 50, y - 50), allowed = 1 + d / 4;
    const opts = TABLE[z].filter(e => MON[e[0]].lvl[0] <= allowed && (MON[e[0]].night ? true : true));
    if (!opts.length) continue;
    const id = pickW(opts), m = MON[id], grp = m.passive ? 1 + Math.floor(rng() * 2) : (id === 'wolf' || id === 'goblin' || id === 'rat' || id === 'snowwolf') ? 2 + Math.floor(rng() * 2) : 1 + Math.floor(rng() * 2);
    for (let g = 0; g < grp; g++) { const gx = x + Math.floor(rng() * 3) - 1, gy = y + Math.floor(rng() * 3) - 1; if (walkable(gx, gy)) w.spawns.push({ id, tx: gx, ty: gy, lvl: m.lvl[0] + Math.floor(rng() * (m.lvl[1] - m.lvl[0] + 1)) }); }
  }
  const sp = (id, x, y, extra = {}) => { const m = MON[id]; w.spawns.push(Object.assign({ id, tx: x, ty: y, lvl: m.lvl[0] + Math.floor(rng() * (m.lvl[1] - m.lvl[0] + 1)) }, extra)); };
  const ring = (id, cx, cy, n, r) => { for (let i = 0; i < n; i++) { const a = rng() * TAU, rr = 1.5 + rng() * r, x = Math.round(cx + Math.cos(a) * rr), y = Math.round(cy + Math.sin(a) * rr); if (walkable(x, y)) sp(id, x, y, { camp: id }); else i--; if (i > 200) break; } };
  ring('bandit', 88, 64, 5, 5); ring('archer', 88, 64, 3, 6);
  ring('skeleton', 30, 33, 8, 5); ring('skmage', 30, 32, 2, 4); ring('wraith', 30, 34, 3, 6);
  ring('troll', 50, 9, 3, 5); sp('horak', 50, 8, { boss: 'horak' }); ring('snowwolf', 48, 12, 2, 4);
  ring('cultist', 89, 13, 7, 6); ring('golem', 89, 12, 3, 5); sp('malgrath', 89, 10, { boss: 'malgrath' });
  ring('fox', 52, 82, 3, 4); ring('hawk', 52, 80, 1, 3); ring('boar', 54, 74, 5, 5); ring('rat', 33, 64, 4, 4); ring('rat', 56, 68, 3, 4);
  sp('bear', 72, 44); sp('bear', 68, 34); sp('bear', 40, 24); sp('bear', 60, 20);
  sp('stag', 74, 40, { rare: true }); sp('panther', 80, 44, { rare: true }); sp('panther', 70, 55, { rare: true }); sp('drake', 60, 6, { rare: true }); sp('griffin', 38, 9, { rare: true });
  ring('slime', 22, 82, 4, 6); ring('goblin', 22, 80, 3, 5); ring('spider', 74, 50, 3, 6);
  sp('skar', 89, 63, { boss: 'skar' });
  w.spawns = w.spawns.filter(s => s.dg || walkable(s.tx, s.ty));

  /* --- Пути (BFS) --- */
  dgSpawns.forEach(sp2 => w.spawns.push(sp2));
  w.walk = (tx, ty) => inb(tx, ty) && !w.blk[I(tx, ty)] && w.tiles[I(tx, ty)] !== T.DEEP && w.tiles[I(tx, ty)] !== T.ROCK;
  w.get = get; w.inb = inb; w.I = I;
  w.findPath = function (sx, sy, tx, ty) {
    if (!w.walk(tx, ty)) { const n = w.nearestWalk(tx, ty); if (!n) return []; tx = n[0]; ty = n[1]; }
    const prev = new Int32Array(WW * WH).fill(-1), q = [I(sx, sy)]; prev[I(sx, sy)] = I(sx, sy);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let qi = 0, goal = I(tx, ty), found = false;
    while (qi < q.length) {
      const c = q[qi++]; if (c === goal) { found = true; break; }
      const cx = c % WW, cy = (c / WW) | 0;
      for (const d of dirs) { const nx = cx + d[0], ny = cy + d[1]; if (!w.walk(nx, ny)) continue; const ni = I(nx, ny); if (prev[ni] >= 0) continue; prev[ni] = c; q.push(ni); }
    }
    if (!found) return [];
    const path = []; let c = goal; while (c !== I(sx, sy)) { path.push([c % WW, (c / WW) | 0]); c = prev[c]; } path.reverse(); return path;
  };
  w.nearestWalk = function (tx, ty) { for (let r = 0; r < 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (w.walk(tx + dx, ty + dy)) return [tx + dx, ty + dy]; return null; };
  { const q = w.nearestWalk(64, 10); if (q) w.spawns.push({ id: 'ignis', tx: q[0], ty: q[1], lvl: 16, boss: 'ignis' }); }
  w.zoneName = function (px, py) {
    const tx = px / TS, ty = py / TS;
    let best = null, bd = 1e9;
    for (const k in LOCS) { if (LOCS[k].hidden) continue; const l = LOCS[k], d = Math.hypot(tx - l.x, ty - l.y); if (d < l.r && d < bd) { best = l; bd = d; } }
    return best ? best.name : 'Дикие земли';
  };
  w.buildingByName = B;

  /* --- Миникарта --- */
  w.minimap = document.createElement('canvas'); w.minimap.width = WW; w.minimap.height = WH;
  w.paintMini = function (revealed) {
    const c = w.minimap.getContext('2d'), img = c.createImageData(WW, WH);
    for (let i = 0; i < WW * WH; i++) {
      let col = TILE_COL[w.tiles[i]] || '#000'; const n = parseInt(col.slice(1), 16);
      let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
      if (w.blk[i] && w.tiles[i] !== T.ROCK && w.tiles[i] !== T.DEEP) { r *= 0.7; g *= 0.7; b *= 0.7; }
      const vis = revealed ? revealed[i] : 1;
      img.data[i * 4] = vis ? r : 8; img.data[i * 4 + 1] = vis ? g : 8; img.data[i * 4 + 2] = vis ? b : 12; img.data[i * 4 + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  };
  // здания и лампы как источники света
  w.objs.forEach(o => { if (o.light) w.lights.push({ x: o.x, y: o.y - 24, r: o.light }); });
  w.buildings.forEach(b => { if (b.kind === 'shop' || b.kind === 'inn' || b.kind === 'hall' || b.kind === 'tower' || b.kind === 'church') w.lights.push({ x: (b.x + b.w / 2) * TS, y: (b.y + b.h) * TS - 10, r: 110, warm: true }); });
  w.objs.sort((a, b) => a.y - b.y);
  return w;
}
function randiS(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }

function isSafeTile(x, y) {
  if (y >= OW_H) return false; if (x > 34 && x < 66 && y > 33 && y < 64) return true;
  const c = (l, r) => Math.hypot(x - l.x, y - l.y) < r; return c(LOCS.hamlet, 7) || c(LOCS.tower, 6) || c(LOCS.scout, 5) || Math.hypot(x - 41, y - 74) < 10;
}

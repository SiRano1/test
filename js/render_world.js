'use strict';
/* ===== Отрисовка мира: тайлы, объекты, здания, освещение, погода ===== */
const SEASON_COL = {
  grass: [['#68b043', '#5aa03a', '#7cc45c'], ['#5ea63c', '#529832', '#6fb84c'], ['#93a03c', '#86923a', '#a8a84a'], ['#dfe9f0', '#d2dfe9', '#eef5fa']],
  forest: [['#4a8a34', '#417c2e', '#58973e'], ['#3f7f2f', '#377329', '#4b8b37'], ['#7a8a34', '#6e7c30', '#8a9a3a'], ['#c8d8e2', '#bccbd6', '#dbe7ef']],
  leaf: [['#5fae45', '#7cc85a'], ['#3f8f38', '#58a84a'], ['#c9772b', '#e69a3c'], ['#c9d8e2', '#eef5fa']]
};
const FLOWER_COLS = ['#f4d24a', '#e86a8a', '#f0f0f0', '#a86ae8', '#ff9a3a'];

function drawTile(ctx, w, tx, ty, t, season) {
  const x = tx * TS, y = ty * TS, c = w.tiles[ty * WW + tx], h = hash2(tx, ty, 7), h2 = hash2(tx, ty, 11), h3 = hash2(tx, ty, 13);
  switch (c) {
    case T.GRASS: case T.FOREST: {
      const pal = (c === T.GRASS ? SEASON_COL.grass : SEASON_COL.forest)[season];
      ctx.fillStyle = h < 0.33 ? pal[0] : h < 0.66 ? pal[1] : pal[0]; ctx.fillRect(x, y, TS, TS);
      ctx.fillStyle = pal[1]; ctx.fillRect(x + h2 * 24, y + h3 * 24, 3, 1); ctx.fillRect(x + h3 * 20 + 4, y + h * 20 + 4, 1, 3);
      ctx.fillStyle = pal[2]; ctx.fillRect(x + h * 26, y + h2 * 26, 2, 4); ctx.fillRect(x + h3 * 26, y + h * 22 + 6, 4, 1);
      if (season === 3 && h2 > 0.7) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x + h * 20, y + h3 * 20, 6, 2); }
      break;
    }
    case T.SAND: ctx.fillStyle = h < 0.5 ? '#e4d192' : '#dcc986'; ctx.fillRect(x, y, TS, TS); ctx.fillStyle = '#c9b574'; ctx.fillRect(x + h2 * 26, y + h3 * 26, 2, 2); ctx.fillRect(x + h3 * 20, y + h * 20 + 8, 2, 1); break;
    case T.DEEP: case T.SHALLOW: {
      const deep = c === T.DEEP; ctx.fillStyle = deep ? '#235a9c' : '#4a9ccc'; ctx.fillRect(x, y, TS, TS);
      const off = Math.sin(t * 1.4 + tx * 0.8 + ty * 0.55) * 5;
      ctx.fillStyle = deep ? 'rgba(120,180,255,0.22)' : 'rgba(255,255,255,0.25)'; ctx.fillRect(x + 6 + off, y + 8 + h * 6, 12, 2); ctx.fillRect(x + 14 - off, y + 22 + h2 * 4, 9, 2);
      // берег
      const wl = (dx, dy) => { const n = w.get(tx + dx, ty + dy); return n !== T.DEEP && n !== T.SHALLOW && n !== T.BRIDGE; };
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      const fo = 1 + Math.sin(t * 2 + tx) * 1;
      if (wl(0, -1)) ctx.fillRect(x, y, TS, 3 + fo); if (wl(0, 1)) ctx.fillRect(x, y + TS - 3 - fo, TS, 3 + fo);
      if (wl(-1, 0)) ctx.fillRect(x, y, 3 + fo, TS); if (wl(1, 0)) ctx.fillRect(x + TS - 3 - fo, y, 3 + fo, TS);
      if (deep && !w.blk[ty * WW + tx]) { /* deep */ }
      break;
    }
    case T.WOOD: ctx.fillStyle = h < 0.5 ? '#a87a48' : '#9c6f3f'; ctx.fillRect(x, y, TS, TS); ctx.fillStyle = '#7a5430'; ctx.fillRect(x, y + 10, TS, 1); ctx.fillRect(x, y + 21, TS, 1); ctx.fillRect(x + 8 + h2 * 16, y, 1, 10); ctx.fillRect(x + 6 + h3 * 18, y + 11, 1, 10); ctx.fillRect(x + 12 + h * 10, y + 22, 1, 10); ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(x + 2, y + 3, 12, 2); break;
    case T.ROCK: {
      if (ty >= 128 && tx >= 34 && tx < 66) {
        const gw = (dx, dy) => w.get(tx + dx, ty + dy) === T.WOOD;
        if (gw(0, 1)) { ctx.fillStyle = '#d6c294'; ctx.fillRect(x, y, TS, TS); ctx.fillStyle = '#c4ad7c'; ctx.fillRect(x, y + 6, TS, 1); ctx.fillRect(x + 15, y, 1, TS); ctx.fillStyle = '#6a4a2a'; ctx.fillRect(x, y + TS - 9, TS, 9); ctx.fillStyle = '#4a3220'; ctx.fillRect(x, y + TS - 9, TS, 1); if ((tx + ty) % 5 === 0) { ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x + 4, y + 3, 24, 16); ctx.fillStyle = state_night_win(); ctx.fillRect(x + 6, y + 5, 20, 12); ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x + 15, y + 5, 2, 12); } }
        else if (gw(-1, 0) || gw(1, 0) || gw(-1, 1) || gw(1, 1) || gw(0, -1)) { ctx.fillStyle = '#5a4030'; ctx.fillRect(x, y, TS, TS); ctx.fillStyle = '#4a3222'; ctx.fillRect(x + 10, y, 2, TS); }
        else { ctx.fillStyle = '#120c08'; ctx.fillRect(x, y, TS, TS); }
        break;
      }
      ctx.fillStyle = '#767a84'; ctx.fillRect(x, y, TS, TS);
      const up = w.get(tx, ty - 1) === T.ROCK, dn = w.get(tx, ty + 1) === T.ROCK;
      ctx.fillStyle = '#868a94'; ctx.fillRect(x + 2, y + 2, 14 + h * 8, 10); ctx.fillStyle = '#62666f'; ctx.fillRect(x + 14 + h2 * 8, y + 14, 14, 12);
      if (!up) { ctx.fillStyle = '#9a9ea8'; ctx.fillRect(x, y, TS, 4); }
      if (!dn) { ctx.fillStyle = '#4a4d56'; ctx.fillRect(x, y + TS - 8, TS, 8); ctx.fillStyle = '#3a3c44'; ctx.fillRect(x, y + TS - 3, TS, 3); }
      ctx.fillStyle = '#4a4d56'; ctx.fillRect(x + h3 * 20 + 4, y + 10, 1, 8);
      if (y < 20 * TS) { ctx.fillStyle = '#eef4fa'; ctx.fillRect(x, y, TS, up ? 0 : 6); }
      break;
    }
    case T.SNOW: ctx.fillStyle = h < 0.5 ? '#eef4fa' : '#e6eff7'; ctx.fillRect(x, y, TS, TS); ctx.fillStyle = '#c8dcec'; ctx.fillRect(x + h2 * 26, y + h3 * 26, 4, 2); ctx.fillStyle = '#ffffff'; ctx.fillRect(x + h3 * 22, y + h * 22, 3, 2); break;
    case T.ASH: {
      ctx.fillStyle = h < 0.5 ? '#3d3737' : '#363030'; ctx.fillRect(x, y, TS, TS); ctx.fillStyle = '#524a4a'; ctx.fillRect(x + h2 * 24, y + h3 * 24, 5, 2);
      if (h3 > 0.86) { const g = 0.5 + 0.5 * Math.sin(t * 3 + tx * 2 + ty); ctx.fillStyle = `rgba(255,${100 + g * 80 | 0},30,${0.5 + g * 0.4})`; ctx.fillRect(x + h * 20 + 3, y + h2 * 20 + 3, 3, 3); ctx.fillRect(x + h * 20 + 6, y + h2 * 20 + 5, 5, 1); }
      break;
    }
    case T.ROAD: ctx.fillStyle = h < 0.5 ? '#b9996b' : '#b09062'; ctx.fillRect(x, y, TS, TS); ctx.fillStyle = '#9c7e54'; ctx.fillRect(x + h2 * 24, y + h3 * 24, 3, 2); ctx.fillRect(x + h3 * 20 + 6, y + h * 24, 2, 2); ctx.fillStyle = '#cdb084'; ctx.fillRect(x + h * 22, y + h2 * 20 + 6, 4, 1); break;
    case T.PLAZA: {
      ctx.fillStyle = '#b6ab94'; ctx.fillRect(x, y, TS, TS); ctx.fillStyle = '#9a8f78';
      ctx.fillRect(x, y, TS, 1); ctx.fillRect(x, y + 15, TS, 1); ctx.fillRect(x, y, 1, TS); ctx.fillRect(x + 15 + (ty % 2) * 0, y, 1, 16); ctx.fillRect(x + 8, y + 16, 1, 16); ctx.fillRect(x + 24, y + 16, 1, 16);
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(x + 2, y + 2, 10, 2); ctx.fillRect(x + 18, y + 18, 8, 2);
      break;
    }
    case T.SWAMP: {
      ctx.fillStyle = '#3f5a3a'; ctx.fillRect(x, y, TS, TS);
      ctx.fillStyle = '#3a5a52'; ctx.fillRect(x + h * 10, y + h2 * 12 + 4, 14, 8); ctx.fillStyle = '#4e6e42'; ctx.fillRect(x + h3 * 20, y + h * 24, 6, 3);
      const b = Math.sin(t * 2 + tx * 3 + ty) ; if (h2 > 0.7 && b > 0.2) { ctx.fillStyle = 'rgba(200,255,200,0.6)'; ctx.fillRect(x + h * 20 + 4, y + h3 * 16 + 6 - b * 3, 2, 2); }
      break;
    }
    case T.ARENA: ctx.fillStyle = h < 0.5 ? '#d2b070' : '#c9a86a'; ctx.fillRect(x, y, TS, TS); ctx.fillStyle = '#b0904f'; ctx.fillRect(x, y + 6 + h * 16, TS, 1); ctx.fillRect(x + h2 * 24, y + h3 * 24, 2, 2); break;
    case T.BRIDGE: {
      ctx.fillStyle = '#235a9c'; ctx.fillRect(x, y, TS, TS); ctx.fillStyle = '#8a6a3c'; ctx.fillRect(x, y, TS, TS);
      ctx.fillStyle = '#6a4a2a'; for (let i = 0; i < 4; i++) ctx.fillRect(x, y + i * 8, TS, 1); ctx.fillStyle = '#a07e4a'; for (let i = 0; i < 4; i++) ctx.fillRect(x + 2 + h * 8, y + i * 8 + 2, 12, 2);
      break;
    }
    case T.FLOOR: ctx.fillStyle = '#5c5a62'; ctx.fillRect(x, y, TS, TS); ctx.fillStyle = '#4a4850'; ctx.fillRect(x, y, TS, 1); ctx.fillRect(x, y, 1, TS); ctx.fillRect(x + 16, y + 16, 16, 1); ctx.fillRect(x + 16, y + 16, 1, 16); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(x + 3, y + 3, 10, 2); break;
  }
}

/* ---- Объекты ---- */
function drawObj(ctx, o, t, season, state) {
  const x = o.x, y = o.y, v = o.v;
  const shadow = (rx, ry, a = 0.25) => { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill(); };
  const R = (rx, ry, rw, rh, c) => { ctx.fillStyle = c; ctx.fillRect(x + rx, y + ry, rw, rh); };
  const RO = (rx, ry, rw, rh, c) => { ctx.fillStyle = OUT; ctx.fillRect(x + rx - 1, y + ry - 1, rw + 2, rh + 2); ctx.fillStyle = c; ctx.fillRect(x + rx, y + ry, rw, rh); };
  const C = (cx, cy, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + cx, y + cy, r, 0, TAU); ctx.fill(); };
  switch (o.t) {
    case 'tree': {
      const sway = Math.sin(t * 1.1 + o.tx * 0.7) * 1.2, k = o.kind, lc = SEASON_COL.leaf[season];
      shadow(15, 5, 0.28);
      if (k === 0 || k === 1) {
        const trunk = k === 1 ? '#e8e4d8' : '#6a4a2a';
        RO(-4, -20, 8, 20, trunk); R(1, -20, 3, 20, k === 1 ? '#c8c4b8' : '#553a20'); if (k === 1) { R(-3, -14, 3, 1, '#333'); R(0, -8, 3, 1, '#333'); }
        if (season === 3) { for (const [bx, by, bw] of [[-10, -32, 3], [8, -30, 3], [-2, -40, 3]]) { ctx.strokeStyle = trunk; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y - 20); ctx.lineTo(x + bx * 1.2, y + by); ctx.stroke(); } C(sway - 8, -34, 8, '#e6eef4'); C(sway + 8, -32, 8, '#e6eef4'); C(sway, -42, 8, '#f4f8fb'); }
        else {
          const cc = k === 1 ? mix(lc[1], '#d8e070', 0.4) : lc[0], hi = k === 1 ? mix(lc[1], '#ffffff', 0.3) : lc[1];
          C(sway - 9, -26, 12, OUT); C(sway + 9, -26, 12, OUT); C(sway, -36, 16, OUT);
          C(sway - 9, -26, 11, mix(cc, '#000', 0.15)); C(sway + 9, -26, 11, mix(cc, '#000', 0.15)); C(sway, -36, 15, cc);
          C(sway - 5, -41, 8, hi); C(sway + 6, -33, 4, hi);
          if (season === 2) { R(sway - 8, -30, 3, 3, '#e8503a'); R(sway + 4, -38, 3, 3, '#f0c040'); }
        }
      } else if (k === 2) {
        RO(-3, -12, 6, 12, '#5a3a20');
        for (let i = 0; i < 3; i++) { const yy = -14 - i * 13, ww = 17 - i * 4; ctx.fillStyle = OUT; ctx.beginPath(); ctx.moveTo(x - ww - 1, y + yy + 1); ctx.lineTo(x + sway * 0.4, y + yy - 17); ctx.lineTo(x + ww + 1, y + yy + 1); ctx.fill(); ctx.fillStyle = i % 2 ? '#2d6a4a' : '#256040'; ctx.beginPath(); ctx.moveTo(x - ww, y + yy); ctx.lineTo(x + sway * 0.4, y + yy - 16); ctx.lineTo(x + ww, y + yy); ctx.fill(); ctx.fillStyle = '#f2f8fc'; ctx.beginPath(); ctx.moveTo(x - ww * 0.55, y + yy - 6); ctx.lineTo(x + sway * 0.4, y + yy - 16); ctx.lineTo(x + ww * 0.55, y + yy - 6); ctx.lineTo(x, y + yy - 4); ctx.fill(); }
      } else { // мёртвое
        RO(-3, -26, 6, 26, '#4a3a34'); ctx.strokeStyle = '#4a3a34'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y - 20); ctx.lineTo(x - 13, y - 34); ctx.moveTo(x, y - 24); ctx.lineTo(x + 12, y - 38); ctx.moveTo(x - 9, y - 30); ctx.lineTo(x - 15, y - 26); ctx.stroke();
      }
      break;
    }
    case 'bush': shadow(10, 4, 0.2); C(-5, -6, 7, OUT); C(5, -6, 7, OUT); C(-5, -6, 6, SEASON_COL.leaf[season][0]); C(5, -6, 6, mix(SEASON_COL.leaf[season][0], '#000', 0.1)); C(0, -9, 6, SEASON_COL.leaf[season][1]); if (v === 0 && season < 2) { R(-4, -8, 2, 2, '#e8503a'); R(3, -6, 2, 2, '#e8503a'); } break;
    case 'flower': { if (season === 3) break; for (let i = 0; i < 3; i++) { const fx = -8 + i * 8 + (v % 2) * 3, fy = -4 + ((i + v) % 3) * 4 - 6; R(fx, fy + 2, 1, 4, '#3a7a2a'); R(fx - 1, fy, 3, 3, FLOWER_COLS[(v + i) % 5]); R(fx, fy + 1, 1, 1, '#f4e060'); } break; }
    case 'rock': shadow(11, 4, 0.25); ctx.fillStyle = OUT; ctx.beginPath(); ctx.moveTo(x - 13, y); ctx.lineTo(x - 9, y - 14); ctx.lineTo(x + 2, y - 18); ctx.lineTo(x + 12, y - 10); ctx.lineTo(x + 13, y); ctx.fill(); ctx.fillStyle = o.ash ? '#4a4444' : '#8a8e98'; ctx.beginPath(); ctx.moveTo(x - 12, y - 1); ctx.lineTo(x - 8, y - 13); ctx.lineTo(x + 2, y - 17); ctx.lineTo(x + 11, y - 10); ctx.lineTo(x + 12, y - 1); ctx.fill(); ctx.fillStyle = o.ash ? '#605858' : '#a8acb6'; ctx.fillRect(x - 6, y - 14, 8, 3); if (o.snow || season === 3) { ctx.fillStyle = '#f2f8fc'; ctx.fillRect(x - 8, y - 15, 14, 4); } break;
    case 'mushroom': R(-1, -4, 2, 4, '#efe6c8'); C(0, -5, 4, OUT); C(0, -5, 3, '#d8403a'); R(-1, -6, 1, 1, '#fff'); R(1, -4, 1, 1, '#fff'); break;
    case 'reed': for (let i = 0; i < 4; i++) { const sw = Math.sin(t * 2 + i + o.tx) * 1.5; ctx.strokeStyle = '#5a8a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 8 + i * 5, y); ctx.lineTo(x - 8 + i * 5 + sw, y - 16 - (i % 2) * 4); ctx.stroke(); R(-9 + i * 5 + sw, -19 - (i % 2) * 4, 3, 5, '#7a5a2a'); } break;
    case 'lamp': shadow(6, 3); RO(-2, -34, 4, 34, '#3a3a44'); RO(-5, -42, 10, 9, '#2a2a30'); R(-3, -40, 6, 6, state.night > 0.15 ? '#ffe08a' : '#c8b878'); break;
    case 'barrel': shadow(11, 4); RO(-8, -18, 16, 18, '#7a5230'); R(-8, -13, 16, 2, '#3a3a3a'); R(-8, -5, 16, 2, '#3a3a3a'); R(-6, -17, 3, 15, '#96683c'); break;
    case 'crate': shadow(12, 4); RO(-10, -16, 20, 16, '#9a7040'); R(-10, -9, 20, 2, '#6a4a2a'); R(-1, -16, 2, 16, '#6a4a2a'); break;
    case 'fountain': {
      shadow(24, 9, 0.3); ctx.fillStyle = OUT; ctx.fillRect(x - 26, y - 22, 52, 22); ctx.fillStyle = '#8f96a2'; ctx.fillRect(x - 24, y - 20, 48, 18); ctx.fillStyle = '#4a9ccc'; ctx.fillRect(x - 20, y - 18, 40, 10); ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(x - 14 + Math.sin(t * 2) * 4, y - 15, 10, 2);
      RO(-4, -40, 8, 24, '#a4abb6'); const sp = Math.sin(t * 6); ctx.fillStyle = 'rgba(160,220,255,0.8)'; for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + t * 3; ctx.fillRect(x + Math.cos(a) * 6 - 1, y - 44 + Math.abs(Math.sin(a + t * 4)) * 8, 2, 4); } ctx.fillRect(x - 1, y - 48 + sp, 2, 6);
      break;
    }
    case 'gate': RO(-7, -46, 14, 46, '#8a8f98'); R(-9, -50, 18, 6, '#9aa0aa'); R(-3, -36, 6, 12, o.tx < 50 ? '#3a5a9a' : '#3a5a9a'); break;
    case 'banner': RO(-1, -46, 2, 46, '#5a3a20'); { const sw = Math.sin(t * 2 + o.tx) * 2; ctx.fillStyle = '#b8341f'; ctx.beginPath(); ctx.moveTo(x + 1, y - 44); ctx.lineTo(x + 13 + sw, y - 40); ctx.lineTo(x + 12 + sw, y - 26); ctx.lineTo(x + 6, y - 30); ctx.lineTo(x + 1, y - 26); ctx.fill(); R(3, -40, 6, 2, '#f0c850'); } break;
    case 'sign': RO(-1, -22, 2, 22, '#5a3a20'); RO(-9, -30, 18, 10, '#a07a44'); R(-6, -27, 12, 1, '#3a2a1a'); R(-6, -24, 9, 1, '#3a2a1a'); break;
    case 'stall': { shadow(20, 6, 0.28); RO(-18, -20, 36, 20, '#8a5a30'); const cs = ['#c83a3a', '#3a6ac8', '#3ac86a', '#c8a83a'][v]; for (let i = 0; i < 6; i++) { R(-20 + i * 7, -40, 7, 14, i % 2 ? '#f2f0e8' : cs); } R(-20, -28, 40, 2, '#3a2a1a'); R(-14, -16, 6, 6, '#e8503a'); R(-4, -16, 6, 6, '#f0c040'); R(6, -16, 6, 6, '#7ac850'); R(-19, -40, 2, 20, '#5a3a20'); R(17, -40, 2, 20, '#5a3a20'); break; }
    case 'tent': shadow(24, 7, 0.3); ctx.fillStyle = OUT; ctx.beginPath(); ctx.moveTo(x - 25, y); ctx.lineTo(x, y - 40); ctx.lineTo(x + 25, y); ctx.fill(); ctx.fillStyle = v % 2 ? '#a8804a' : '#7a8a5a'; ctx.beginPath(); ctx.moveTo(x - 23, y - 1); ctx.lineTo(x, y - 37); ctx.lineTo(x + 23, y - 1); ctx.fill(); ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x, y - 20); ctx.lineTo(x + 6, y); ctx.fill(); break;
    case 'campfire': { shadow(14, 5, 0.3); R(-9, -4, 18, 3, '#5a3a20'); R(-6, -7, 12, 3, '#6a4a2a'); const fl = Math.sin(t * 12 + o.tx) * 2; ctx.fillStyle = '#ff7a1a'; ctx.beginPath(); ctx.moveTo(x - 7, y - 6); ctx.lineTo(x + fl, y - 26); ctx.lineTo(x + 7, y - 6); ctx.fill(); ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.moveTo(x - 4, y - 6); ctx.lineTo(x + fl * 0.6, y - 18); ctx.lineTo(x + 4, y - 6); ctx.fill(); break; }
    case 'pillar': shadow(10, 4); RO(-7, -28 - v * 6, 14, 28 + v * 6, '#8a867c'); R(-9, -30 - v * 6, 18, 4, '#9a968c'); R(-4, -20, 2, 12, '#6a665c'); R(2, -14, 2, 8, '#6a7a5a'); break;
    case 'grave': shadow(9, 3); if (v % 2) { RO(-6, -22, 12, 22, '#8a8e98'); R(-3, -18, 6, 2, '#5a5e68'); R(-3, -14, 4, 2, '#5a5e68'); } else { RO(-2, -24, 4, 24, '#7a6a5a'); R(-8, -18, 16, 4, '#7a6a5a'); } break;
    case 'brazier': { shadow(10, 4); RO(-3, -20, 6, 20, '#3a3a44'); RO(-8, -26, 16, 7, '#2a2a30'); const fl = Math.sin(t * 11 + o.tx) * 2; ctx.fillStyle = '#ff6a1a'; ctx.beginPath(); ctx.moveTo(x - 7, y - 26); ctx.lineTo(x + fl, y - 46); ctx.lineTo(x + 7, y - 26); ctx.fill(); ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.moveTo(x - 4, y - 26); ctx.lineTo(x + fl * 0.5, y - 38); ctx.lineTo(x + 4, y - 26); ctx.fill(); break; }
    case 'cave': { ctx.fillStyle = OUT; ctx.fillRect(x - 46, y - 80, 92, 82); ctx.fillStyle = '#5a5c66'; ctx.fillRect(x - 44, y - 78, 88, 78); ctx.fillStyle = '#7a7c88'; ctx.fillRect(x - 44, y - 78, 88, 8); ctx.fillStyle = '#0a0a10'; ctx.beginPath(); ctx.moveTo(x - 24, y); ctx.lineTo(x - 24, y - 34); ctx.quadraticCurveTo(x, y - 66, x + 24, y - 34); ctx.lineTo(x + 24, y); ctx.fill(); ctx.fillStyle = 'rgba(255,120,40,0.4)'; ctx.fillRect(x - 4, y - 8, 8, 6); ctx.fillStyle = '#e8e0c8'; ctx.fillRect(x - 30, y - 36, 4, 12); ctx.fillRect(x + 26, y - 36, 4, 12); break; }
    case 'well': shadow(14, 5); RO(-12, -14, 24, 14, '#8a8e98'); R(-9, -12, 18, 5, '#2a5a8a'); RO(-12, -30, 3, 18, '#5a3a20'); RO(9, -30, 3, 18, '#5a3a20'); RO(-14, -36, 28, 6, '#8a4a2a'); break;
    case 'hay': shadow(16, 5); RO(-14, -20, 28, 20, '#d8b850'); R(-14, -14, 28, 2, '#a88830'); R(-14, -6, 28, 2, '#a88830'); break;
    case 'cart': shadow(20, 6); RO(-18, -18, 36, 12, '#8a5a30'); RO(-14, -12, 12, 12, '#3a2a1a'); RO(6, -12, 12, 12, '#3a2a1a'); R(-16, -24, 32, 6, '#d8b850'); break;
    case 'crop': for (let i = 0; i < 3; i++) { const sw = Math.sin(t * 2 + i + o.tx) * 1; R(-10 + i * 9 + sw, -14, 2, 14, season === 3 ? '#8a8a6a' : '#d8b840'); R(-11 + i * 9 + sw, -18, 4, 6, '#e8c850'); R(-6 + i * 9, -8, 2, 8, season === 3 ? '#8a8a6a' : '#7ab83a'); } break;
    case 'plot': {
      const f = state.farm && state.farm[o.key]; ctx.fillStyle = (f && f.wet) ? '#4a2f1a' : '#6a4a2a'; ctx.fillRect(x - 15, y - 29, 30, 30); ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 3; i++) ctx.fillRect(x - 14, y - 24 + i * 9, 28, 2);
      if (f) { const c = CROPS[f.crop], k = Math.min(1, f.grown / c.days), sw = Math.sin(t * 2 + o.tx) * 0.8; if (k < 0.34) { R(-2, -16, 4, 6, '#5fbf4a'); } else if (k < 1) { for (let i = -1; i <= 1; i++) { R(i * 8 - 1 + sw, -12 - k * 12, 3, 8 + k * 12, '#4fa83a'); R(i * 8 - 4 + sw, -14 - k * 12, 9, 4, '#6fd05a'); } } else { ctx.font = '20px serif'; ctx.textAlign = 'center'; ctx.fillText(c.icon, x - 8, y - 8); ctx.fillText(c.icon, x + 8, y - 12); ctx.textAlign = 'left'; ctx.fillStyle = `rgba(255,255,160,${0.25 + 0.2 * Math.sin(t * 4)})`; ctx.beginPath(); ctx.arc(x, y - 14, 15, 0, TAU); ctx.fill(); } }
      if (state.hilite) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(x - 15, y - 29, 30, 30); }
      break;
    }
    case 'bed': RO(-2, -26, 4, 26, '#5a3a20'); RO(-8, -34, 16, 10, '#c8402a'); R(-6, -32, 12, 2, '#fff'); R(-2, -30, 4, 3, '#f0c850'); break;
    case 'bin': shadow(16, 5); RO(-14, -20, 28, 20, '#9a6a34'); R(-14, -20, 28, 4, '#7a4a20'); R(-10, -12, 20, 2, '#5a3a1a'); ctx.font = '12px serif'; ctx.fillText('💰', x - 6, y - 6); break;
    case 'board': shadow(20, 5); RO(-2, -40, 4, 40, '#5a3a20'); RO(-20, -50, 40, 32, '#8a5a30'); R(-17, -47, 34, 26, '#e8d8a8'); R(-14, -44, 10, 8, '#fff'); R(-2, -44, 10, 6, '#f6e8b8'); R(-14, -33, 12, 8, '#f6e8b8'); R(2, -34, 12, 10, '#fff'); R(-12, -43, 2, 2, '#c33'); break;
    case 'portal': { const g = 0.5 + 0.5 * Math.sin(t * 3 + o.tx); shadow(22, 7, 0.3); RO(-22, -60, 8, 60, '#6a6a76'); RO(14, -60, 8, 60, '#6a6a76'); RO(-22, -68, 44, 10, '#7a7a86'); ctx.fillStyle = OUT; ctx.beginPath(); ctx.ellipse(x, y - 30, 15, 30, 0, 0, TAU); ctx.fill(); const gr = ctx.createRadialGradient(x, y - 30, 2, x, y - 30, 30); gr.addColorStop(0, o.exit ? '#aaf' : '#e8a0ff'); gr.addColorStop(1, `rgba(${o.exit ? '60,80,200' : '120,30,170'},${0.75 + g * 0.2})`); ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(x, y - 30, 14, 28, 0, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.5)'; for (let i = 0; i < 4; i++) { const a = t * 2 + i * 1.6; ctx.fillRect(x + Math.cos(a) * 8 - 1, y - 30 + Math.sin(a) * 18 - 1, 3, 3); } break; }
    case 'ibed': shadow(22, 6, 0.2); RO(-16, -24, 32, 26, '#6a4a2a'); R(-14, -22, 28, 20, '#e8e0d0'); R(-14, -22, 28, 8, '#d8c8a8'); R(-12, -20, 12, 6, '#fff'); R(-14, -12, 28, 10, '#b8402a'); R(-14, -12, 28, 2, '#d8603a'); break;
    case 'table': shadow(24, 6, 0.25); RO(-24, -22, 48, 10, '#8a5a30'); R(-22, -12, 4, 12, '#6a4020'); R(18, -12, 4, 12, '#6a4020'); if (!G.prof.flags.letter) { R(-8, -25, 16, 6, '#f6ecd0'); R(-8, -25, 16, 1, '#c8b890'); R(-1, -23, 2, 2, '#c33'); ctx.fillStyle = `rgba(255,240,150,${0.3 + 0.3 * Math.sin(t * 4)})`; ctx.beginPath(); ctx.arc(x, y - 22, 14, 0, TAU); ctx.fill(); } else { R(-6, -25, 12, 4, '#f6ecd0'); R(12, -30, 5, 8, '#c8a040'); } break;
    case 'stove': shadow(20, 6, 0.25); RO(-18, -34, 36, 34, '#4a4a54'); R(-14, -30, 28, 6, '#6a6a76'); R(-10, -18, 20, 12, '#1a1010'); { const fl = Math.sin(t * 10) * 1.5; ctx.fillStyle = '#ff7a1a'; ctx.beginPath(); ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + fl, y - 16); ctx.lineTo(x + 6, y - 6); ctx.fill(); ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.moveTo(x - 3, y - 6); ctx.lineTo(x + fl * 0.5, y - 12); ctx.lineTo(x + 3, y - 6); ctx.fill(); } R(-4, -42, 8, 10, '#3a3a44'); break;
    case 'shelf': RO(-20, -40, 40, 30, '#6a4a2a'); R(-18, -28, 36, 2, '#8a6a3a'); for (let i = 0; i < 5; i++) { R(-17 + i * 7, -38, 5, 10, ['#c33', '#36c', '#3a3', '#c93', '#93c'][(i + v) % 5]); } for (let i = 0; i < 4; i++) R(-16 + i * 9, -25, 6, 8, ['#e8d8a0', '#8fc', '#f8a', '#fc6'][i]); break;
    case 'rug': ctx.fillStyle = '#8a2a2a'; ctx.fillRect(x - 40, y - 26, 80, 44); ctx.fillStyle = '#c9a24a'; ctx.fillRect(x - 36, y - 22, 72, 36); ctx.fillStyle = '#8a2a2a'; ctx.fillRect(x - 32, y - 18, 64, 28); ctx.fillStyle = '#e8c860'; ctx.fillRect(x - 6, y - 8, 12, 8); break;
    case 'plantpot': shadow(9, 3); RO(-7, -12, 14, 12, '#a85a3a'); for (let i = 0; i < 3; i++) R(-6 + i * 5, -26 + (i % 2) * 4, 3, 16 - (i % 2) * 4, '#3f9a4a'); R(-8, -28, 6, 4, '#5fca6a'); R(2, -24, 6, 4, '#5fca6a'); break;
    case 'door': if (o.int) { RO(-14, -40, 28, 40, '#5a3a1a'); R(-11, -37, 22, 37, '#7a5228'); R(5, -18, 3, 3, '#f0c850'); } break;
    case 'dog': { const bob = Math.abs(Math.sin(t * 5)) * 2; shadow(9, 3); const wag = Math.sin(t * 14) * 3; ctx.fillStyle = OUT; ctx.fillRect(x - 10, y - 14 - bob, 20, 12); ctx.fillStyle = '#c99a5a'; ctx.fillRect(x - 9, y - 13 - bob, 18, 10); ctx.fillRect(x + 6, y - 20 - bob, 8, 8); ctx.fillRect(x - 12, y - 16 - bob + wag * 0.3, 4, 3); ctx.fillStyle = '#7a5a30'; ctx.fillRect(x + 6, y - 21 - bob, 3, 5); ctx.fillStyle = '#111'; ctx.fillRect(x + 11, y - 17 - bob, 2, 2); ctx.fillStyle = '#e8d8b0'; ctx.fillRect(x - 6, y - 8 - bob, 12, 3); break; }
    case 'fence': RO(-2, -14, 4, 14, '#7a5a30'); R(-6, -10, 12, 2, '#96703c'); R(-6, -5, 12, 2, '#96703c'); break;
    case 'chest': { const op = state.opened && state.opened.has(o.id); shadow(13, 4); RO(-11, -14, 22, 14, op ? '#6a4a2a' : '#9a6a30'); R(-11, -9, 22, 2, '#f0c850'); if (op) { R(-11, -20, 22, 6, '#7a5a2a'); R(-9, -12, 18, 2, '#1a1010'); } else { R(-11, -20, 22, 7, '#b07a3a'); R(-2, -10, 4, 5, '#f0c850'); if (state.hilite) { ctx.fillStyle = `rgba(255,230,120,${0.3 + 0.2 * Math.sin(t * 4)})`; ctx.beginPath(); ctx.arc(x, y - 12, 18, 0, TAU); ctx.fill(); } } break; }
    case 'herb': { if (o.cd > 0) break; const gl = 0.5 + 0.5 * Math.sin(t * 3 + o.tx); shadow(8, 3, 0.15); for (let i = 0; i < 4; i++) { R(-6 + i * 4, -10 - (i % 2) * 3, 2, 10 + (i % 2) * 3, '#3f9a4a'); R(-8 + i * 4, -12 - (i % 2) * 3, 5, 3, '#5fca6a'); } ctx.fillStyle = `rgba(160,255,200,${0.4 + gl * 0.4})`; ctx.fillRect(x - 2, y - 18, 4, 4); ctx.fillRect(x - 1, y - 20, 2, 8); break; }
    case 'ore': { if (o.cd > 0) break; shadow(11, 4); ctx.fillStyle = OUT; ctx.beginPath(); ctx.moveTo(x - 12, y); ctx.lineTo(x - 8, y - 14); ctx.lineTo(x + 6, y - 16); ctx.lineTo(x + 12, y); ctx.fill(); ctx.fillStyle = '#6a6e78'; ctx.beginPath(); ctx.moveTo(x - 11, y - 1); ctx.lineTo(x - 7, y - 13); ctx.lineTo(x + 6, y - 15); ctx.lineTo(x + 11, y - 1); ctx.fill(); const sp = 0.5 + 0.5 * Math.sin(t * 4 + o.tx * 2); ctx.fillStyle = `rgba(255,200,120,${0.5 + sp * 0.5})`; ctx.fillRect(x - 5, y - 10, 3, 3); ctx.fillRect(x + 2, y - 7, 3, 3); ctx.fillStyle = '#c86a3a'; ctx.fillRect(x - 1, y - 12, 3, 2); break; }
  }
}

/* ---- Здания ---- */
function drawBuilding(ctx, b, t, state) {
  const x = b.x * TS, y = b.y * TS, w = b.w * TS, h = b.h * TS, k = b.kind, night = state.night > 0.2;
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + 6, y + h - 6, w, 10);
  const dx = b.door.x * TS;
  if (k === 'ruin') {
    ctx.fillStyle = OUT; ctx.fillRect(x - 1, y + 10, w + 2, h - 6); ctx.fillStyle = '#7a766c'; ctx.fillRect(x, y + 12, w, h - 10);
    for (let i = 0; i < b.w * 2; i++) { const hh = 10 + hash2(b.x + i, b.y, 3) * 26; ctx.fillStyle = OUT; ctx.fillRect(x + i * 16 - 1, y + 12 - hh - 1, 18, hh + 2); ctx.fillStyle = i % 2 ? '#8a867c' : '#7a766c'; ctx.fillRect(x + i * 16, y + 12 - hh, 16, hh + 4); ctx.fillStyle = '#5a7a4a'; ctx.fillRect(x + i * 16, y + 12 - hh, 16, 3); }
    ctx.fillStyle = '#5a564c'; for (let i = 0; i < 6; i++) ctx.fillRect(x + 6 + i * 18, y + 24 + (i % 2) * 14, 10, 2);
    return;
  }
  if (k === 'keep') {
    ctx.fillStyle = OUT; ctx.fillRect(x - 1, y - 45, w + 2, h + 46); ctx.fillStyle = '#3a3038'; ctx.fillRect(x, y - 44, w, h + 44); ctx.fillStyle = '#4a4048'; for (let i = 0; i < w / 16; i++) { if (i % 2 === 0) ctx.fillRect(x + i * 16, y - 54, 16, 12); }
    ctx.fillStyle = '#2a2228'; for (let i = 0; i < 7; i++) ctx.fillRect(x + 12 + i * 40, y - 30 + (i % 2) * 16, 8, 16);
    for (const tx of [x - 14, x + w - 22]) { ctx.fillStyle = OUT; ctx.fillRect(tx - 1, y - 75, 38, h + 78); ctx.fillStyle = '#463c44'; ctx.fillRect(tx, y - 74, 36, h + 76); ctx.fillStyle = '#5a1a1a'; ctx.beginPath(); ctx.moveTo(tx - 4, y - 74); ctx.lineTo(tx + 18, y - 108); ctx.lineTo(tx + 40, y - 74); ctx.fill(); }
    const gx = x + w / 2 - 24; ctx.fillStyle = '#0a0608'; ctx.beginPath(); ctx.moveTo(gx, y + h); ctx.lineTo(gx, y + h - 50); ctx.quadraticCurveTo(gx + 24, y + h - 80, gx + 48, y + h - 50); ctx.lineTo(gx + 48, y + h); ctx.fill();
    ctx.fillStyle = `rgba(255,${90 + Math.sin(t * 5) * 30},20,0.65)`; ctx.fillRect(gx + 10, y + h - 30, 28, 30);
    ctx.fillStyle = '#b8341f'; ctx.fillRect(x + 30, y - 40, 12, 40); ctx.fillRect(x + w - 42, y - 40, 12, 40); return;
  }
  if (k === 'tower') {
    const tx = x + 22, tw = w - 44, th = h + 90;
    ctx.fillStyle = OUT; ctx.fillRect(tx - 1, y - 91, tw + 2, th + 2); ctx.fillStyle = '#9aa0b8'; ctx.fillRect(tx, y - 90, tw, th); ctx.fillStyle = '#8a90a8'; ctx.fillRect(tx + tw * 0.6, y - 90, tw * 0.4, th);
    ctx.fillStyle = '#7a80a0'; for (let i = 0; i < 10; i++) ctx.fillRect(tx, y - 80 + i * 18, tw, 1);
    ctx.fillStyle = OUT; ctx.beginPath(); ctx.moveTo(tx - 9, y - 88); ctx.lineTo(tx + tw / 2, y - 160); ctx.lineTo(tx + tw + 9, y - 88); ctx.fill(); ctx.fillStyle = b.roof; ctx.beginPath(); ctx.moveTo(tx - 7, y - 90); ctx.lineTo(tx + tw / 2, y - 156); ctx.lineTo(tx + tw + 7, y - 90); ctx.fill(); ctx.fillStyle = '#f0e8a0'; ctx.fillRect(tx + tw / 2 - 2, y - 168, 4, 14); ctx.beginPath(); ctx.arc(tx + tw / 2, y - 172, 7, 0, TAU); ctx.fill();
    for (const wy of [-60, -10, 30]) { ctx.fillStyle = OUT; ctx.fillRect(tx + tw / 2 - 8, y + wy - 1, 16, 22); ctx.fillStyle = night ? '#a8c8ff' : '#3a4a7a'; ctx.fillRect(tx + tw / 2 - 7, y + wy, 14, 20); }
    ctx.fillStyle = '#4a2a10'; ctx.fillRect(dx + 8, y + h - 32, 16, 32); ctx.fillStyle = '#f0c850'; ctx.fillRect(dx + 20, y + h - 16, 2, 2); return;
  }
  const wallH = 36, wallTop = y + h - wallH;
  const wallCol = k === 'church' ? '#c8c8d4' : k === 'hall' ? '#d8c8a0' : k === 'inn' ? '#e0cfa4' : k === 'shop' ? '#dccaa0' : '#d4bf94';
  ctx.fillStyle = OUT; ctx.fillRect(x - 1, wallTop - 1, w + 2, wallH + 1);
  ctx.fillStyle = wallCol; ctx.fillRect(x, wallTop, w, wallH);
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x, y + h - 6, w, 6);
  if (k !== 'church') { ctx.fillStyle = '#6a4a2a'; for (let i = 0; i <= b.w; i++) ctx.fillRect(x + i * TS - 2, wallTop, 4, wallH); ctx.fillRect(x, wallTop, w, 3); }
  else { ctx.fillStyle = '#a4a4b4'; for (let i = 0; i < b.w * 4; i++) ctx.fillRect(x + i * 8, wallTop + (i % 2) * 6, 8, 1); }
  for (let i = 0; i < b.w; i++) {
    const cx = x + i * TS + 16; if (Math.abs(cx - (dx + 16)) < 20) continue;
    ctx.fillStyle = OUT; ctx.fillRect(cx - 7, wallTop + 7, 14, 15); ctx.fillStyle = night ? '#ffd97a' : '#7ab0d8'; ctx.fillRect(cx - 5, wallTop + 9, 10, 11); ctx.fillStyle = '#6a4a2a'; ctx.fillRect(cx - 0.5, wallTop + 9, 1, 11); ctx.fillRect(cx - 5, wallTop + 14, 10, 1);
    if (night) { ctx.fillStyle = 'rgba(255,220,120,0.25)'; ctx.fillRect(cx - 9, wallTop + 5, 18, 19); }
  }
  ctx.fillStyle = OUT; ctx.fillRect(dx + 5, y + h - 30, 22, 30); ctx.fillStyle = '#5a3a1a'; ctx.fillRect(dx + 6, y + h - 28, 20, 28); ctx.fillStyle = '#7a5228'; ctx.fillRect(dx + 8, y + h - 26, 7, 26); ctx.fillStyle = '#f0c850'; ctx.fillRect(dx + 21, y + h - 14, 2, 3);
  // крыша
  const rTop = y - 26, rBot = wallTop + 4, inset = Math.min(30, w / 3);
  ctx.fillStyle = OUT; ctx.beginPath(); ctx.moveTo(x - 11, rBot + 1); ctx.lineTo(x + inset, rTop - 1); ctx.lineTo(x + w - inset, rTop - 1); ctx.lineTo(x + w + 11, rBot + 1); ctx.fill();
  ctx.fillStyle = b.roof; ctx.beginPath(); ctx.moveTo(x - 9, rBot); ctx.lineTo(x + inset + 1, rTop); ctx.lineTo(x + w - inset - 1, rTop); ctx.lineTo(x + w + 9, rBot); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.moveTo(x - 9, rBot); ctx.lineTo(x + inset + 1, rTop); ctx.lineTo(x + w - inset - 1, rTop); ctx.lineTo(x + w + 9, rBot); ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; for (let yy = rTop + 8; yy < rBot; yy += 9) ctx.fillRect(x - 10, yy, w + 20, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(x - 10, rTop, w + 20, 5);
  ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(x - 10, rBot - 6, w + 20, 6);
  if (state.season === 3) { ctx.fillStyle = 'rgba(245,250,255,0.9)'; ctx.fillRect(x - 10, rTop, w + 20, 12); }
  ctx.restore();
  // элементы
  if (k === 'church') { ctx.fillStyle = OUT; ctx.fillRect(x + w / 2 - 12, rTop - 30, 24, 32); ctx.fillStyle = '#c8c8d4'; ctx.fillRect(x + w / 2 - 10, rTop - 28, 20, 30); ctx.fillStyle = '#f0e8a0'; ctx.fillRect(x + w / 2 - 2, rTop - 48, 4, 20); ctx.fillRect(x + w / 2 - 7, rTop - 42, 14, 4); }
  if (k === 'hall') { ctx.fillStyle = '#5a3a20'; ctx.fillRect(x + w / 2 - 1, rTop - 34, 2, 34); const sw = Math.sin(t * 3) * 2; ctx.fillStyle = '#b8341f'; ctx.beginPath(); ctx.moveTo(x + w / 2 + 1, rTop - 34); ctx.lineTo(x + w / 2 + 20 + sw, rTop - 28); ctx.lineTo(x + w / 2 + 1, rTop - 20); ctx.fill(); ctx.fillStyle = '#c8a850'; for (let i = 0; i < 2; i++) ctx.fillRect(x + 14 + i * (w - 42), wallTop, 10, wallH); }
  if (k === 'inn') { ctx.fillStyle = '#5a3a20'; ctx.fillRect(x + w - 6, wallTop + 4, 14, 2); ctx.fillStyle = '#c8402a'; ctx.fillRect(x + w + 2, wallTop + 6, 8, 12); ctx.fillStyle = '#f0e0a0'; ctx.fillRect(x + w + 4, wallTop + 9, 4, 3); }
  if (b.sign) { ctx.font = 'bold 11px Georgia, serif'; const tw = ctx.measureText(b.sign).width + 12, sx = dx + 16 - tw / 2; ctx.fillStyle = OUT; ctx.fillRect(sx - 1, wallTop - 17, tw + 2, 17); ctx.fillStyle = '#7a5228'; ctx.fillRect(sx, wallTop - 16, tw, 15); ctx.fillStyle = '#f6e8b8'; ctx.textAlign = 'center'; ctx.fillText(b.sign, dx + 16, wallTop - 5); ctx.textAlign = 'left'; }
}

/* ---- Освещение и погода ---- */
const AMB = [[0, [8, 14, 48, 0.7]], [4.5, [8, 14, 48, 0.7]], [5.7, [90, 70, 120, 0.42]], [6.6, [255, 160, 100, 0.2]], [8, [255, 230, 190, 0]], [16.5, [255, 230, 190, 0]], [18, [255, 150, 80, 0.2]], [19.5, [120, 60, 100, 0.42]], [21, [8, 14, 48, 0.7]], [24, [8, 14, 48, 0.7]]];
function ambientAt(hf) {
  for (let i = 0; i < AMB.length - 1; i++) { const a = AMB[i], b = AMB[i + 1]; if (hf >= a[0] && hf <= b[0]) { const f = (hf - a[0]) / (b[0] - a[0]); return a[1].map((v, j) => lerp(v, b[1][j], f)); } }
  return [0, 0, 0, 0];
}
let _lightCv = null;
function drawLighting(ctx, cw, ch, cam, lights, amb, rain, dpr) {
  const a = amb[3] + (rain > 0 ? rain * 0.12 : 0);
  if (a < 0.02) return;
  if (!_lightCv) _lightCv = document.createElement('canvas');
  if (_lightCv.width !== cw || _lightCv.height !== ch) { _lightCv.width = cw; _lightCv.height = ch; }
  const c = _lightCv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, cw, ch);
  c.fillStyle = `rgba(${amb[0] | 0},${amb[1] | 0},${amb[2] | 0},${a})`; c.fillRect(0, 0, cw, ch);
  c.globalCompositeOperation = 'destination-out';
  const z = cam.zoom * dpr;
  for (const l of lights) {
    const sx = (l.x - cam.x) * z, sy = (l.y - cam.y) * z, r = l.r * z;
    if (sx < -r || sy < -r || sx > cw + r || sy > ch + r) continue;
    const g = c.createRadialGradient(sx, sy, r * 0.1, sx, sy, r); g.addColorStop(0, `rgba(0,0,0,${l.a || 0.95})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.arc(sx, sy, r, 0, TAU); c.fill();
  }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(_lightCv, 0, 0);
  if (amb[3] > 0.25) { // тёплое свечение источников
    ctx.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      if (l.noglow) continue;
      const sx = (l.x - cam.x) * z, sy = (l.y - cam.y) * z, r = l.r * z * 0.8;
      if (sx < -r || sy < -r || sx > cw + r || sy > ch + r) continue;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r); g.addColorStop(0, `rgba(255,170,70,${0.18 * amb[3] / 0.7})`); g.addColorStop(1, 'rgba(255,170,70,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}
const _drops = Array.from({ length: 160 }, () => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.8 }));
function drawWeather(ctx, cw, ch, t, kind, amt, dpr) {
  if (amt <= 0.02) return;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (kind === 'rain') {
    ctx.strokeStyle = 'rgba(190,210,255,0.55)'; ctx.lineWidth = 1.2 * dpr; ctx.beginPath();
    const n = Math.floor(_drops.length * amt);
    for (let i = 0; i < n; i++) { const d = _drops[i], x = ((d.x * cw + t * 60 * d.s) % cw + cw) % cw, y = ((d.y * ch + t * 700 * d.s) % ch); ctx.moveTo(x, y); ctx.lineTo(x - 5 * dpr, y + 16 * dpr * d.s); }
    ctx.stroke();
  } else if (kind === 'snow') {
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; const n = Math.floor(_drops.length * amt);
    for (let i = 0; i < n; i++) { const d = _drops[i], x = ((d.x * cw + Math.sin(t + i) * 20 * dpr) % cw + cw) % cw, y = ((d.y * ch + t * 60 * d.s * dpr) % ch); ctx.fillRect(x, y, 3 * dpr * d.s, 3 * dpr * d.s); }
  }
  ctx.restore();
}
function state_night_win() { return '#9ac8e8'; }

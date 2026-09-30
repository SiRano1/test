'use strict';
/* ===== Главный цикл, ввод, отрисовка сцены ===== */
let canvas, ctx, lastTs = 0;
G.at = 0; G.hint = null;
const MONTH_ANIM = { menuAngle: 0 };

function initCanvas() {
  canvas = $('#game'); ctx = canvas.getContext('2d');
  const rs = () => { G.dpr = Math.min(2, window.devicePixelRatio || 1); canvas.width = Math.floor(window.innerWidth * G.dpr); canvas.height = Math.floor(window.innerHeight * G.dpr); };
  rs(); window.addEventListener('resize', rs);
  canvas.addEventListener('mousemove', e => setMouse(e));
  canvas.addEventListener('mousedown', e => { setMouse(e); Snd.init(); if (e.button === 0) G.mouse.down = true; if (e.button === 2 && G.mode === 'play' && !G.paused) { const s = hotbarSkills()[0]; } e.preventDefault(); });
  window.addEventListener('mouseup', e => { if (e.button === 0) G.mouse.down = false; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('blur', () => { G.mouse.down = false; G.keys.clear(); });
  window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', e => G.keys.delete(e.code));
  window.addEventListener('beforeunload', () => { if (G.mode === 'play') saveGame(true); });
  requestAnimationFrame(frame);
}
function setMouse(e) { const z = G.cam.zoom; G.mouse.x = e.clientX; G.mouse.y = e.clientY; G.mouse.wx = G.cam.x + e.clientX / z; G.mouse.wy = G.cam.y + e.clientY / z; }
function onKeyDown(e) {
  const tag = (e.target && e.target.tagName) || ''; if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  Snd.init();
  if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (G.mode !== 'play') { if (e.code === 'Escape') UI.escape(); return; }
  if (e.repeat && e.code !== 'Space') { G.keys.add(e.code); return; }
  G.keys.add(e.code);
  if (e.code === 'Escape') { UI.escape(); return; }
  if (G.dialog) { const m = e.code.match(/^Digit(\d)$/); if (m) UI.dialogPick(+m[1] - 1); if (e.code === 'KeyE' || e.code === 'Enter') UI.dialogPick(0); return; }
  const tabs = { KeyI: 'inv', KeyC: 'char', KeyK: 'skills', KeyJ: 'quests', KeyM: 'map', KeyB: 'bestiary', KeyP: 'pets', KeyL: 'calendar' };
  if (tabs[e.code]) { UI.togglePanel(tabs[e.code]); return; }
  if (e.code === 'F2' && G.settings.dev) { e.preventDefault(); UI.toggleDev(); return; }
  if (e.code === 'F1') { e.preventDefault(); UI.showScreen('controls', true); return; }
  if (G.paused || G.P.dead) return;
  if (e.code === 'KeyE') interact();
  const dm = e.code.match(/^Digit([1-5])$/); if (dm) { const id = hotbarSkills()[+dm[1] - 1]; if (id) castSkill(id); }
  if (e.code === 'KeyQ') usePotionSlot('hp'); if (e.code === 'KeyR') usePotionSlot('rs');
  if (e.code === 'KeyV') { const el = G.prof.inv.find(s => ITEMS[s.id].type === 'elixir'); if (el) useItemId(el.id); else toast('Нет эликсиров', 'warn'); }
  if (e.code === 'KeyF') useRacial();
  if (e.code === 'KeyT') { if (G.prof.cls === 'hunter') { if (G.petEnt) summonPet(null); else if (G.prof.pets.length) summonPet(G.prof.pets[0].uid); } else if (G.prof.cls === 'druid' && G.P.form) setForm(null); }
}

function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016); lastTs = ts; G.at += dt;
  try {
    if (G.mode === 'play') { if (!G.paused) update(dt); renderScene(true); UI.frame(dt); }
    else { renderScene(false); }
  } catch (e) { console.error(e); if (!G._errShown) { G._errShown = true; toast('Ошибка: ' + e.message, 'warn'); } }
}

/* ---------- Обновление ---------- */
function update(dt) {
  const P = G.P;
  if (G.hitstop > 0) { G.hitstop -= dt; dt *= 0.06; } else if (G.slowmo > 0) { G.slowmo -= dt; dt *= 0.35; }
  G.t += dt; G.prof.playtime += dt;
  const pm = Math.floor(G.min); G.min += dt * G.timeScale; const cm = Math.floor(G.min); for (let i = pm + 1; i <= cm; i++) onMinute();
  updateWeather(dt);
  for (let i = G.timers.length - 1; i >= 0; i--) if (G.t >= G.timers[i].at) { const f = G.timers[i].fn; G.timers.splice(i, 1); f(); }
  updatePlayer(dt); auraFx(dt); updatePet(dt); updateFish(dt);
  for (const n of G.npcs) updateNPC(n, dt);
  for (const m of G.mons) updateMonster(m, dt);
  for (let i = G.mons.length - 1; i >= 0; i--) { const m = G.mons[i]; if (m.dead && m.deadT > 2.5 && m.event) G.mons.splice(i, 1); }
  updateProj(dt); updateAreas(dt);
  updateFx(dt);
  for (let i = G.texts.length - 1; i >= 0; i--) { const t = G.texts[i]; t.t += dt; t.y -= 28 * dt; if (t.t > t.life) G.texts.splice(i, 1); }
  for (let i = G.lightning.length - 1; i >= 0; i--) { G.lightning[i].t += dt; if (G.lightning[i].t > G.lightning[i].life) G.lightning.splice(i, 1); }
  if (G.shakeT > 0) G.shakeT -= dt;
  if (G.target && (G.target.dead || G.t - G.targetT > 6)) G.target = null;
  questReach(dt); revealMap(dt); tutUpdate(); if (!P.dead) unstuck(false);
  G.hint = P.dead ? null : nearbyInteractable();
  if (G.tourney && Math.hypot(P.x / TS - 62, P.y / TS - 67) > 10) { toast('Вы покинули арену — турнир проигран', 'warn'); endTourney(false); }
  if (P.dead && P.deadT > 1.6 && !UI.deathShown) UI.showDeath();
  if (G.settings.autosave && G.t - G.lastSave > 60 && !P.dead) saveGame(true);
  // настроение музыки
  G.moodT = (G.moodT || 0) - dt; if (G.moodT <= 0) { G.moodT = 2; const fight = G.mons.some(m => !m.dead && !m.hidden && m.state === 'chase' && Math.hypot(m.x - P.x, m.y - P.y) < 350); Snd.mood = fight ? 'battle' : isNight() ? 'night' : 'day'; }
  // камера
  const z = G.cam.zoom, vw = window.innerWidth / z, vh = window.innerHeight / z;
  const tx = P.x - vw / 2, ty = P.y - 14 - vh / 2; G.cam.x = lerp(G.cam.x, tx, Math.min(1, dt * 8)); G.cam.y = lerp(G.cam.y, ty, Math.min(1, dt * 8));
  if (Math.abs(G.cam.x - tx) > vw) G.cam.x = tx; if (Math.abs(G.cam.y - ty) > vh) G.cam.y = ty;
  const inDg = P.y >= OW_H * TS; G.cam.x = clamp(G.cam.x, -40, WW * TS - vw + 40); G.cam.y = clamp(G.cam.y, inDg ? OW_H * TS - 40 : -40, inDg ? WH * TS - vh + 40 : OW_H * TS - vh + 40);
  G.mouse.wx = G.cam.x + G.mouse.x / z; G.mouse.wy = G.cam.y + G.mouse.y / z;
}
let _revT = 0, _miniT = 0;
function revealMap(dt) {
  _revT -= dt; if (_revT > 0) return; _revT = 0.35; const P = G.P, tx = Math.floor(P.x / TS), ty = Math.floor(P.y / TS), R = 10; let ch = false;
  for (let y = ty - R; y <= ty + R; y++) for (let x = tx - R; x <= tx + R; x++) { if (x < 0 || y < 0 || x >= WW || y >= WH) continue; if ((x - tx) * (x - tx) + (y - ty) * (y - ty) > R * R) continue; const i = y * WW + x; if (!G.revealed[i]) { G.revealed[i] = 1; ch = true; } }
  if (ch) { _miniT = 0; G.mapDirty = true; }
  _miniT -= dt; if (G.mapDirty && _miniT <= 0) { _miniT = 1; G.mapDirty = false; G.world.paintMini(G.revealed); }
}

/* ---------- Отрисовка ---------- */
function drawPlayerEnt(c, P) {
  const p = G.prof; const alpha = P.ghostAlpha !== undefined ? P.ghostAlpha : P.stealth > G.t ? 0.4 : 1, dead = P.dead ? Math.min(1, P.deadT * 1.5) : 0;
  let aura = null; if (P.buffs.some(b => b.id === 'warcry' || b.id === 'bloodrage')) aura = 'rgba(255,70,40,0.28)'; else if (P.buffs.some(b => b.id === 'stoneskin')) aura = 'rgba(170,170,170,0.35)'; else if (P.shield > 0) aura = 'rgba(120,200,255,0.35)'; else if (P.buffs.some(b => b.id === 'moonstep')) aura = 'rgba(180,200,255,0.3)'; else if (P.venomUntil > G.t) aura = 'rgba(100,220,60,0.22)';
  if (P.form) {
    const f = FORM_LOOK[P.form]; let yy = P.y, extra = {};
    if (P.form === 'eagle') { c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(P.x, P.y, 12, 4, 0, 0, TAU); c.fill(); yy = P.y - 22 - Math.sin(G.at * 4) * 2; extra = { hoverShadow: true, flyAlways: true }; }
    drawCreature(c, Object.assign({ x: P.x, y: yy, kind: f.kind, id: f.id, col: f.col, acc: f.acc, size: f.size, flip: P.flip, t: P.t0, moving: P.moving, hurt: P.hurt, dead, alpha, aura, atk: P.anim ? { p: P.anim.p } : null }, extra)); return;
  }
  drawHuman(c, { x: P.x, y: P.y, dir: P.dir, flip: P.flip, look: p.look, race: p.race, gender: p.gender, cls: p.cls, player: true, weapon: weaponData(), armor: armorTiers(), t: P.t0, moving: P.moving, atk: P.anim ? { kind: P.anim.kind, p: P.anim.p } : null, hurt: P.hurt, dead, alpha, aura, dashLean: !!P.dash });
}
function drawMonsterEnt(c, m) {
  if (m.hidden || m.gone) return; const d = m.d; let alpha = 1; if (m.dead) alpha = Math.max(0, 1 - Math.max(0, m.deadT - 1.2)); if (alpha <= 0) return;
  if (d.night) alpha *= 0.85;
  const tele = m.atk && m.atk.p < 0.55 && !m.dead; const aura = tele ? 'rgba(255,60,40,0.28)' : m.elite ? 'rgba(255,210,60,0.3)' : m.boss ? 'rgba(255,60,40,0.22)' : (m.enrage ? 'rgba(255,0,0,0.3)' : (m.stun > G.t ? 'rgba(255,255,100,0.3)' : m.root > G.t ? 'rgba(80,200,80,0.3)' : m.slow > G.t ? 'rgba(120,200,255,0.3)' : null));
  const kk = m.kick ? Math.max(0, 1 - (G.at - m.kick.at) / 0.18) : 0, kx = kk ? m.kick.x * kk : 0, ky = kk ? m.kick.y * kk : 0;
  const dead = m.dead ? Math.min(1, m.deadT * 2.5) : 0, atk = m.atk ? { kind: m.atk.kind || 'slash', p: Math.max(0, m.atk.p) } : null;
  if (d.kind === 'human' || d.kind === 'skeleton') {
    drawHuman(c, { x: m.x + kx, y: m.y + ky, dir: 'side', flip: m.flip, look: { skin: 0, hairStyle: d.kind === 'skeleton' ? 5 : 0, hair: 0, eye: 0, accent: 0, face: 0 }, race: 'human', gender: 'male', mon: m.id, custom: { skin: d.skin || (d.kind === 'skeleton' ? d.col : undefined), hair: d.hair }, hairless: d.kind === 'skeleton', sizeMul: d.size, t: m.t0, moving: m.moving, atk, hurt: m.hurt, dead, alpha, aura, style: null });
  } else {
    const fly = d.flying || d.kind === 'bird'; drawCreature(c, { x: m.x + kx, y: m.y + ky - (fly ? 12 : 0), kind: d.kind, id: m.id, col: d.col, acc: d.acc, size: d.size, flip: m.flip, t: m.t0, moving: m.moving || fly, hurt: m.hurt, dead, alpha, aura, atk, hoverShadow: fly });
    if (fly && !m.dead) { c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(m.x, m.y, 8 * d.size, 3 * d.size, 0, 0, TAU); c.fill(); }
  }
  // табличка: имя, уровень, отношение (агрессивен / мирный / босс)
  if (!m.dead) {
    const P = G.P, dP = Math.hypot(m.x - P.x, m.y - P.y), hov = Math.hypot(m.x - G.mouse.wx, m.y - 12 - G.mouse.wy) < 36, recent = G.t - (m.lastHit || -99) < 6 || m === G.target;
    if (recent || hov || dP < 300 || (m.boss && dP < 720)) {
      const top = m.y - 36 * d.size - (d.kind === 'human' ? 8 : 4), w = 34 * Math.max(0.8, d.size * 0.9), hostile = !d.passive, safe = isSafeTile(P.x / TS, P.y / TS);
      if (m.hp < m.maxHp || m.boss || hov) { c.fillStyle = 'rgba(0,0,0,0.7)'; c.fillRect(m.x - w / 2 - 1, top - 1, w + 2, 7); c.fillStyle = m.boss ? '#e8a020' : m.elite ? '#ffd23a' : hostile ? '#d44' : '#5c5'; c.fillRect(m.x - w / 2, top, w * clamp(m.hp / m.maxHp, 0, 1), 5); }
      const lvlCol = m.lvl > G.prof.lvl + 2 ? '#ff7070' : m.lvl < G.prof.lvl - 3 ? '#aaa' : '#ffe';
      c.textAlign = 'center'; c.strokeStyle = '#000';
      if (m.boss) { c.font = 'bold 15px Georgia, serif'; c.lineWidth = 4; const t1 = `☠ ${d.name} ☠`; c.strokeText(t1, m.x, top - 18); c.fillStyle = '#ffd23a'; c.fillText(t1, m.x, top - 18); c.font = 'bold 10px Georgia, serif'; c.lineWidth = 3; const t2 = `БОСС · ур. ${m.lvl}`; c.strokeText(t2, m.x, top - 5); c.fillStyle = '#ff9a6a'; c.fillText(t2, m.x, top - 5); }
      else {
        c.font = 'bold 11px Georgia, serif'; c.lineWidth = 3; const tag = m.elite ? '★ ' : hostile ? '⚔ ' : '☮ ', txt = `${tag}${m.name2 || d.name} · ур.${m.lvl}`;
        c.strokeText(txt, m.x, top - 3); c.fillStyle = m.elite ? '#ffd23a' : hostile ? '#ff9a8a' : '#a6f0a0'; c.fillText(txt, m.x, top - 3);
        if (hov) { c.font = '9px Georgia, serif'; c.lineWidth = 3; const st = !hostile ? 'мирный — не нападает' : m.state === 'chase' ? 'атакует вас!' : safe ? 'агрессивен (вы в безопасной зоне)' : `агрессивен — нападёт с ${Math.round(d.aggro / TS * 10) / 10} тайлов`; c.strokeText(st, m.x, top + 18 + 0); c.fillStyle = '#ddd'; c.fillText(st, m.x, top + 18); }
      }
      if (hostile && m.state === 'chase') { c.font = 'bold 20px Georgia'; c.fillStyle = '#ff3030'; c.lineWidth = 4; c.strokeText('!', m.x, top - (m.boss ? 34 : 18)); c.fillText('!', m.x, top - (m.boss ? 34 : 18)); }
      c.textAlign = 'left';
    }
  }
}
function drawPetEnt(c, pe) {
  const d = pe.d, rar = RARITY[d.r], fly = d.kind === 'bird' || d.kind === 'dragon';
  if (pe.down) { drawCreature(c, { x: pe.x, y: pe.y, kind: d.kind, id: pe.id, col: d.col, acc: d.acc, size: d.size, flip: pe.flip, t: 0, dead: 0.9, alpha: 0.5 }); return; }
  drawCreature(c, { x: pe.x, y: pe.y - (fly ? 12 : 0), kind: d.kind, id: pe.id, col: d.col, acc: d.acc, size: d.size, flip: pe.flip, t: pe.t0, moving: pe.moving || fly, hurt: pe.hurt, aura: d.r >= 2 ? rar.c + '33' : null, atk: pe.atk, hoverShadow: fly });
  if (pe.hp < pe.maxHp) { const w = 26, y = pe.y - 30 * d.size - 6; c.fillStyle = 'rgba(0,0,0,0.7)'; c.fillRect(pe.x - w / 2 - 1, y - 1, w + 2, 5); c.fillStyle = '#5c5'; c.fillRect(pe.x - w / 2, y, w * clamp(pe.hp / pe.maxHp, 0, 1), 3); }
  if (pe.buffUntil > G.t) { c.fillStyle = 'rgba(255,210,100,0.9)'; c.font = '12px sans-serif'; c.fillText('📯', pe.x - 6, pe.y - 36 * d.size); }
}
function drawNpcEnt(c, n) {
  if (n.inside) return; const def = n.def, dP = Math.hypot(G.P.x - n.x, G.P.y - n.y);
  drawHuman(c, { x: n.x, y: n.y, dir: n.dir, flip: n.flip, look: def.look, race: def.race, gender: def.gender, cls: def.cls, small: def.small, t: n.t0, moving: n.moving });
  const mark = npcQuestMark(n); if (mark) { c.font = 'bold 20px Georgia, serif'; c.textAlign = 'center'; c.fillStyle = mark === '?' ? '#ffe066' : mark === '❗' ? '#ff6a3a' : '#7fd0ff'; c.strokeStyle = '#000'; c.lineWidth = 4; const yy = n.y - 56 + Math.sin(G.at * 4) * 3, ch = mark === '❗' ? '!' : mark; c.strokeText(ch, n.x, yy); c.fillText(ch, n.x, yy); c.textAlign = 'left'; }
  if (G.settings.showNames && dP < 150) { c.font = 'bold 11px Georgia, serif'; c.textAlign = 'center'; c.fillStyle = '#eafcc8'; c.strokeStyle = '#000'; c.lineWidth = 3; c.strokeText(def.name, n.x, n.y + 14); c.fillText(def.name, n.x, n.y + 14); c.font = '9px Georgia, serif'; c.fillStyle = '#c8d8e8'; c.strokeText(def.title, n.x, n.y + 24); c.fillText(def.title, n.x, n.y + 24); c.textAlign = 'left'; }
  if (n.bubble) drawBubble(c, n.x, n.y - 62, n.bubble.text);
}
function drawBubble(c, x, y, text) {
  c.font = '11px Georgia, serif'; const words = text.split(' '), lines = []; let cur = ''; for (const w of words) { if (c.measureText(cur + ' ' + w).width > 150) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; } lines.push(cur);
  const w = Math.max(...lines.map(l => c.measureText(l).width)) + 12, h = lines.length * 13 + 8, bx = x - w / 2, by = y - h;
  c.fillStyle = 'rgba(255,250,235,0.95)'; c.strokeStyle = '#5a4a30'; c.lineWidth = 1.5; c.beginPath(); c.roundRect(bx, by, w, h, 6); c.fill(); c.stroke(); c.beginPath(); c.moveTo(x - 4, by + h); c.lineTo(x, by + h + 6); c.lineTo(x + 4, by + h); c.fill();
  c.fillStyle = '#2a2018'; c.textAlign = 'center'; lines.forEach((l, i) => c.fillText(l, x, by + 13 + i * 13)); c.textAlign = 'left';
}

function renderScene(play) {
  const cw = canvas.width, ch = canvas.height, dpr = G.dpr, z = G.cam.zoom * (1 + (play ? G.punch : 0)), c = ctx;
  if (!G.world) return;
  let camx, camy;
  if (play) { camx = G.cam.x; camy = G.cam.y; if (G.shakeT > 0) { camx += rand(-G.shakeA, G.shakeA) / z; camy += rand(-G.shakeA, G.shakeA) / z; } }
  else { G.min = START_ABS_MIN + (G.at * 4) % 1440 + 300; const a = G.at * 0.05; camx = (50 * TS + Math.cos(a) * 900) - window.innerWidth / z / 2; camy = (50 * TS + Math.sin(a * 1.3) * 600) - window.innerHeight / z / 2; G.cam.x = camx; G.cam.y = camy; }
  const vw = window.innerWidth / z, vh = window.innerHeight / z; const cam = { x: camx, y: camy, zoom: z };
  c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#10141c'; c.fillRect(0, 0, cw, ch); c.imageSmoothingEnabled = false;
  c.setTransform(dpr * z, 0, 0, dpr * z, -camx * dpr * z, -camy * dpr * z);
  const d = gt(), season = d.season, w = G.world, t = G.at, night = nightAmount();
  const x0 = Math.max(0, Math.floor(camx / TS)), y0 = Math.max(0, Math.floor(camy / TS)), x1 = Math.min(WW - 1, Math.ceil((camx + vw) / TS)), y1 = Math.min(WH - 1, Math.ceil((camy + vh) / TS));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) drawTile(c, w, x, y, t, season);
  const state = { night, season, opened: G.opened, farm: G.prof ? G.prof.farm : null, hilite: G.hint && G.hint.type === 'chest' ? G.hint.o : null };
  // земля: зоны
  if (play) { drawGround(c); drawAggroRings(c); for (const a of G.areas) drawArea(c, a); }
  const dr = [];
  const pad = 80, zb = play ? zoneBlock(G.P.x, G.P.y) : 'o';
  for (const o of w.objs) { if (zoneBlock(o.x, o.y) !== zb) continue; if (o.x < camx - pad || o.x > camx + vw + pad || o.y < camy - 40 || o.y > camy + vh + 120) continue; if (o.t === 'chest' || true) dr.push({ y: o.y, f: () => drawObj(c, o, t, season, Object.assign({}, state, { hilite: G.hint && G.hint.o === o })) }); }
  for (const b of w.buildings) { const by = (b.y + b.h) * TS; if (by < camy - 60 || (b.y * TS - 200) > camy + vh || (b.x + b.w) * TS < camx - 40 || b.x * TS > camx + vw + 40) continue; dr.push({ y: by - 1, f: () => drawBuilding(c, b, t, state) }); }
  if (play) {
    for (const n of G.npcs) if (!n.inside) dr.push({ y: n.y, f: () => drawNpcEnt(c, n) });
    for (const m of G.mons) { if (m.hidden || m.gone || zoneBlock(m.x, m.y) !== zb) continue; if (m.x < camx - 100 || m.x > camx + vw + 100 || m.y < camy - 100 || m.y > camy + vh + 140) continue; dr.push({ y: m.y - (m.dead ? 8 : 0), f: () => drawMonsterEnt(c, m) }); }
    if (G.petEnt) dr.push({ y: G.petEnt.y, f: () => drawPetEnt(c, G.petEnt) });
    dr.push({ y: G.P.y + 0.1, f: () => drawPlayerEnt(c, G.P) });
    for (const pr of G.proj) dr.push({ y: pr.y + 10, f: () => drawProj(c, pr) });
  }
  dr.sort((a, b) => a.y - b.y); for (const e of dr) e.f();
  if (play) {
    drawGhosts(c); for (const f of G.fx) drawFx(c, f);
    for (const l of G.lightning) drawLightning(c, l);
    drawFireworks(c); drawFishing(c); drawTutArrow(c);
    // индикатор цели интерактива
    if (G.hint && !G.paused) { const o = G.hint.n || G.hint.o; const yy = (G.hint.n ? o.y - 70 : o.y - 40) + Math.sin(G.at * 5) * 2; c.font = 'bold 12px Georgia, serif'; c.textAlign = 'center'; c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 3; const tx = '[E] ' + G.hint.label; c.strokeText(tx, o.x, yy); c.fillText(tx, o.x, yy); c.textAlign = 'left'; }
    for (const tx of G.texts) { const a = clamp(1 - (tx.t - tx.life * 0.6) / (tx.life * 0.4), 0, 1); c.globalAlpha = a; const big = tx.size === 'big'; c.font = `bold ${big ? 18 : 13}px Georgia, serif`; c.textAlign = 'center'; c.strokeStyle = '#000'; c.lineWidth = 3; c.strokeText(tx.text, tx.x, tx.y); c.fillStyle = tx.color; c.fillText(tx.text, tx.x, tx.y); c.globalAlpha = 1; c.textAlign = 'left'; }
  }
  // освещение
  const inDg = play && G.P.y >= OW_H * TS, inHome = inDg && G.P.x / TS >= 34 && G.P.x / TS < 66 && G.P.y / TS >= 128; const amb = inHome ? [40, 24, 10, 0.22] : inDg ? [8, 10, 26, 0.68] : ambientAt(d.hf); const lights = w.lights.filter(l => zoneBlock(l.x, l.y) === zb);
  if (play) { const P = G.P; lights.push({ x: P.x, y: P.y - 14, r: (night > 0.3 || inDg) ? 180 : 60, noglow: true, a: 0.95 }); for (const pr of G.proj) if (pr.light) lights.push({ x: pr.x, y: pr.y, r: pr.light, a: 0.9 }); for (const m of G.mons) if (m.boss && !m.dead && zoneBlock(m.x, m.y) === zb) lights.push({ x: m.x, y: m.y - 20, r: 110, noglow: true, a: 0.7 }); }
  const lf = { a: 0 };
  if (G.events.festival && night > 0.3) { for (let i = 0; i < 8; i++) lights.push({ x: (44 + i * 1.8) * TS, y: 45 * TS, r: 70 }); }
  drawLighting(c, cw, ch, cam, lights, amb, inDg ? 0 : G.weather.amt, dpr);
  if (!inDg) drawWeather(c, cw, ch, G.at, G.weather.kind, G.weather.amt, dpr);
  // виньетка
  c.setTransform(1, 0, 0, 1, 0, 0); const gr = c.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.35, cw / 2, ch / 2, Math.max(cw, ch) * 0.75); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.42)'); c.fillStyle = gr; c.fillRect(0, 0, cw, ch);
  if (play && G.flash) { const k = 1 - G.flash.t / G.flash.dur; c.fillStyle = G.flash.color; c.globalAlpha = G.flash.a * Math.max(0, k); c.fillRect(0, 0, cw, ch); c.globalAlpha = 1; }
  if (play && G.P.hp / G.P.maxHp < 0.3 && !G.P.dead) { c.fillStyle = `rgba(160,0,0,${0.15 + 0.1 * Math.sin(G.at * 5)})`; c.fillRect(0, 0, cw, ch); }
  if (play && G.P.hurt > 0) { c.fillStyle = `rgba(200,0,0,${G.P.hurt})`; c.fillRect(0, 0, cw, ch); }
  if (play && G.P.dead) { c.fillStyle = 'rgba(30,0,0,0.55)'; c.fillRect(0, 0, cw, ch); }
}
function drawTutArrow(c) {
  if (G.prof.flags.tut >= 6 || G.paused) return; const t = tutTarget(); if (!t) return; const P = G.P, tx = t.x, ty = t.y - 16, d = Math.hypot(tx - P.x, ty - (P.y - 16)), a = Math.atan2(ty - (P.y - 16), tx - P.x);
  const pulse = 0.5 + 0.5 * Math.sin(G.at * 5); c.strokeStyle = `rgba(255,224,102,${0.4 + pulse * 0.5})`; c.lineWidth = 3; c.beginPath(); c.arc(t.x, t.y - 10, 22 + pulse * 6, 0, TAU); c.stroke();
  if (d > 90) { const r = 56, ax = P.x + Math.cos(a) * r, ay = P.y - 16 + Math.sin(a) * r; c.save(); c.translate(ax, ay); c.rotate(a); c.fillStyle = '#ffe066'; c.strokeStyle = '#000'; c.lineWidth = 2; c.beginPath(); c.moveTo(12, 0); c.lineTo(-6, -8); c.lineTo(-2, 0); c.lineTo(-6, 8); c.closePath(); c.fill(); c.stroke(); c.restore(); }
}
function drawAggroRings(c) {
  const P = G.P; if (isSafeTile(P.x / TS, P.y / TS)) return; const zb = zoneBlock(P.x, P.y); let n = 0;
  const near = G.mons.filter(m => !m.dead && !m.hidden && !m.d.passive && m.state !== 'chase' && zoneBlock(m.x, m.y) === zb && Math.hypot(m.x - P.x, m.y - P.y) < 380).sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(b.x - P.x, b.y - P.y));
  for (const m of near) { if (n++ >= 6) break; const r = m.d.aggro * (P.stealth > G.t ? 0.12 : 1) * (m.aggroBoost || 1); c.strokeStyle = `rgba(255,70,50,${m.boss ? 0.35 : 0.22})`; c.lineWidth = 1.5; c.setLineDash([6, 6]); c.beginPath(); c.ellipse(m.x, m.y, r, r * 0.6, 0, 0, TAU); c.stroke(); c.setLineDash([]); c.fillStyle = 'rgba(255,60,40,0.04)'; c.fill(); }
}
function drawFishing(c) {
  const f = G.fish; if (!f) return; const P = G.P, by = f.by + Math.sin(G.at * 3) * (f.state === 'bite' ? 3 : 1);
  c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 1; c.beginPath(); c.moveTo(P.x + (P.flip ? -8 : 8), P.y - 20); c.quadraticCurveTo((P.x + f.bx) / 2, Math.min(P.y, by) - 30, f.bx, by); c.stroke();
  c.fillStyle = '#e33'; c.beginPath(); c.arc(f.bx, by, 3, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.fillRect(f.bx - 3, by, 6, 1.5);
  if (f.state === 'bite') { c.font = 'bold 22px Georgia'; c.textAlign = 'center'; c.fillStyle = '#f44'; c.strokeStyle = '#000'; c.lineWidth = 3; c.strokeText('!', f.bx, by - 14); c.fillText('!', f.bx, by - 14); c.textAlign = 'left'; }
  c.strokeStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.ellipse(f.bx, by + 2, 8 + Math.sin(G.at * 4) * 2, 3, 0, 0, TAU); c.stroke();
}
function drawArea(c, a) {
  if (a.type === 'telegraph') { const p = clamp((G.t - a.t0) / a.dur, 0, 1); c.fillStyle = `rgba(255,60,30,${0.15 + 0.15 * Math.sin(G.at * 14)})`; c.beginPath(); c.arc(a.x, a.y, a.r, 0, TAU); c.fill(); c.strokeStyle = 'rgba(255,90,50,0.9)'; c.lineWidth = 2; c.beginPath(); c.arc(a.x, a.y, a.r, 0, TAU); c.stroke(); c.fillStyle = 'rgba(255,80,40,0.25)'; c.beginPath(); c.arc(a.x, a.y, a.r * p, 0, TAU); c.fill(); if (a.meteor) { const yy = a.y - (1 - p) * 320; c.fillStyle = '#ff8a2a'; c.beginPath(); c.arc(a.x, yy, 16, 0, TAU); c.fill(); c.fillStyle = '#ffe27a'; c.beginPath(); c.arc(a.x, yy, 8, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,120,30,0.5)'; c.fillRect(a.x - 6, yy - 60, 12, 60); } }
  else if (a.type === 'vines') { const k = clamp((a.until - G.t) / 0.5, 0, 1); c.globalAlpha = k; c.strokeStyle = '#2f8a3a'; c.lineWidth = 3; for (let i = 0; i < 9; i++) { const an = i / 9 * TAU + a.t0, r = a.r * (0.4 + 0.5 * ((i * 37) % 10) / 10); c.beginPath(); c.moveTo(a.x, a.y); c.quadraticCurveTo(a.x + Math.cos(an) * r * 0.5 + Math.sin(G.at * 3 + i) * 6, a.y + Math.sin(an) * r * 0.5, a.x + Math.cos(an) * r, a.y + Math.sin(an) * r * 0.7); c.stroke(); } c.fillStyle = 'rgba(60,160,60,0.25)'; c.beginPath(); c.arc(a.x, a.y, a.r, 0, TAU); c.fill(); c.globalAlpha = 1; }
  else if (a.type === 'trap') { const armed = G.t >= a.armedAt; c.globalAlpha = armed ? 0.9 : 0.4; c.fillStyle = '#7a7a82'; c.beginPath(); c.arc(a.x, a.y, 11, 0, TAU); c.fill(); c.strokeStyle = '#3a3a42'; c.lineWidth = 2; for (let i = 0; i < 8; i++) { const an = i / 8 * TAU; c.beginPath(); c.moveTo(a.x + Math.cos(an) * 6, a.y + Math.sin(an) * 6); c.lineTo(a.x + Math.cos(an) * 12, a.y + Math.sin(an) * 12); c.stroke(); } c.globalAlpha = 1; }
}
function drawFireworks(c) {
  if (!G.events.festival) return; const h = gt().hf; if (h < 20 && h < 22.5) return; if (h < 21) return;
  for (let i = 0; i < 5; i++) { const ph = (G.at * 0.5 + i * 0.37) % 1.6, cx = (46 + i * 2.2) * TS, cy = (36 + (i % 2) * 2) * TS; if (ph < 0.6) { c.fillStyle = '#ffe'; c.fillRect(cx, cy + (0.6 - ph) * 500, 3, 8); } else { const k = (ph - 0.6) / 1, col = ['#f66', '#6cf', '#fd4', '#8f8', '#f8f'][i]; c.globalAlpha = 1 - k; c.fillStyle = col; for (let j = 0; j < 20; j++) { const a = j / 20 * TAU, r = k * 70; c.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r + k * k * 30, 3, 3); } c.globalAlpha = 1; } }
}

/* лианы: рост из земли */
const _drawAreaBase = drawArea;
drawArea = function (c, a) {
  if (a.type !== 'vines') return _drawAreaBase(c, a);
  const grow = Math.min(1, (G.t - a.t0) / 0.45), k = clamp((a.until - G.t) / 0.5, 0, 1); c.globalAlpha = k; c.fillStyle = 'rgba(40,110,40,0.28)'; c.beginPath(); c.ellipse(a.x, a.y, a.r, a.r * 0.65, 0, 0, TAU); c.fill();
  for (let i = 0; i < 12; i++) { const an = i / 12 * TAU + a.t0, r = a.r * (0.35 + 0.6 * ((i * 37) % 10) / 10) * grow, h = 26 + ((i * 53) % 24); const bx = a.x + Math.cos(an) * r, by = a.y + Math.sin(an) * r * 0.65, sw = Math.sin(G.at * 3 + i) * 4; c.strokeStyle = '#1f6a2a'; c.lineWidth = 4; c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(bx + sw, by - h * 0.6 * grow, bx + sw * 2, by - h * grow); c.stroke(); c.strokeStyle = '#4fca5a'; c.lineWidth = 2; c.stroke(); c.fillStyle = '#7fe08a'; c.beginPath(); c.arc(bx + sw * 2, by - h * grow, 3, 0, TAU); c.fill(); if (i % 3 === 0) { c.strokeStyle = '#3a7a2a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(bx + sw * 0.8, by - h * 0.4 * grow); c.lineTo(bx + sw * 0.8 + 6, by - h * 0.5 * grow - 3); c.stroke(); } }
  c.globalAlpha = 1;
};

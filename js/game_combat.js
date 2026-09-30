'use strict';
/* ===== Бой: игрок, умения, монстры, питомцы, снаряды, эффекты ===== */
const FORM_ATK = {
  wolf: { kind: 'melee', anim: 'stab', range: 46, arc: 1.7, cd: 0.34, mult: 0.85 },
  bear: { kind: 'melee', anim: 'slash', range: 74, arc: 2.7, cd: 0.85, mult: 1.7, kb: 40 },
  eagle: { kind: 'melee', anim: 'stab', range: 54, arc: 1.9, cd: 0.5, mult: 0.95 }
};
const FORM_LOOK = { wolf: { kind: 'quad', id: 'wolf', col: '#6a6e78', acc: '#c8ccd4', size: 0.85 }, bear: { kind: 'quad', id: 'bear', col: '#6a4630', acc: '#b89060', size: 1.15 }, eagle: { kind: 'bird', id: 'eagle', col: '#7a5a34', acc: '#f4f0e0', size: 0.95 } };

/* ---- эффекты ---- */
function floatText(x, y, text, color, size) { if (!G.settings.dmgNumbers && size !== 'big' && !/[A-Za-zА-Яа-я+]/.test(String(text))) return; G.texts.push({ x: x + rand(-8, 8), y, text, color: color || '#fff', t: 0, life: 1.1, size: size || 'n' }); }
function burst(x, y, color, n = 10, spread = 60) { if (!G.settings.particles) n = Math.ceil(n / 3); for (let i = 0; i < n; i++) { const a = rand(0, TAU), s = rand(spread * 0.3, spread); G.fx.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, life: rand(0.3, 0.7), t: 0, color, size: rand(2, 4), g: 80 }); } }
function ringFx(x, y, color, r, life = 0.45) { G.fx.push({ ring: true, x, y, color, r, t: 0, life }); }
function slashFx(x, y, ang, range, arc, color) { G.fx.push({ slash: true, x, y, ang, range, arc, color: color || '#fff', t: 0, life: 0.18 }); }
function shake(a, t = 0.25) { if (G.settings.shake) { G.shakeA = Math.max(G.shakeA * (G.shakeT > 0 ? 1 : 0), a); G.shakeT = t; } }
function later(sec, fn) { G.timers.push({ at: G.t + sec, fn }); }
function lightning(pts) { G.lightning.push({ pts, t: 0, life: 0.25 }); }

/* ---- перемещение с коллизиями ---- */
function blockedPx(px, py, fly) {
  const tx = Math.floor(px / TS), ty = Math.floor(py / TS);
  if (tx < 1 || ty < 1 || tx >= WW - 1 || ty >= WH - 1) return true;
  const i = ty * WW + tx; if (fly) return !!G.world.fly[i];
  const t = G.world.tiles[i]; return !!G.world.blk[i] || t === T.DEEP || t === T.ROCK;
}
function moveEntity(e, dx, dy, rad, fly) {
  const r = rad || 8, box = (x, y) => blockedPx(x - r, y - r * 0.6, fly) || blockedPx(x + r, y - r * 0.6, fly) || blockedPx(x - r, y, fly) || blockedPx(x + r, y, fly);
  let moved = false;
  if (!box(e.x + dx, e.y)) { e.x += dx; moved = true; } if (!box(e.x, e.y + dy)) { e.y += dy; moved = true; }
  return moved;
}
function terrainSpeed(x, y) { const t = G.world.tiles[Math.floor(y / TS) * WW + Math.floor(x / TS)]; return t === T.SHALLOW ? 0.6 : t === T.SWAMP ? 0.8 : (t === T.ROAD || t === T.PLAZA) ? 1.08 : t === T.SNOW ? 0.95 : 1; }
const mRad = m => 8 * m.d.size + 4;
const enemies = () => G.mons.filter(m => !m.dead && !m.hidden);

/* ---- создание монстров ---- */
function makeMonster(sp, event) {
  const d = MON[sp.id], dif = { easy: 0.75, normal: 1, hard: 1.4 }[G.prof.difficulty] || 1, lm = sp.lvl - d.lvl[0];
  const elite = !d.boss && !d.passive && sp.lvl >= 3 && !sp.dg && Math.random() < 0.07, hpM = d.boss ? 1 : 1.7, dmM = d.boss ? 0.72 : 1.35;
  const hp = Math.round(d.hp * hpM * (1 + lm * 0.3) * (elite ? 2.5 : 1) * (dif > 1 ? 1.25 : dif < 1 ? 0.85 : 1));
  const m = { kind: 'mon', id: sp.id, d, x: (sp.tx + 0.5) * TS, y: (sp.ty + 1) * TS - 4, hx: (sp.tx + 0.5) * TS, hy: (sp.ty + 1) * TS - 4, lvl: sp.lvl, hp, maxHp: hp, dmg: d.dmg * dmM * (1 + lm * 0.15) * dif * (elite ? 1.4 : 1), elite, def: sp.lvl * 2, spd: d.spd, state: 'idle', cd: rand(0, 1), ang: rand(0, TAU), flip: false, moving: false, hurt: 0, dead: false, deadT: 0, wt: rand(1, 4), tx: 0, ty: 0, atk: null, stun: 0, root: 0, slow: 0, slowAmt: 1, dots: [], t0: rand(0, 10), boss: d.boss, event: event || null, sp, sp2: rand(4, 9), phase: 0 };
  m.hidden = !!d.night && !isNight() && !event && sp.ty < OW_H;
  if (elite) { m.name2 = 'Вожак: ' + d.name; }
  return m;
}
function spawnMonsters() {
  G.mons = []; const def = G.prof.defeated;
  for (const sp of G.world.spawns) { if (sp.boss && def.includes(sp.boss)) continue; G.mons.push(makeMonster(sp)); }
}
function spawnEventMon(id, tx, ty, lvl, event) { const sp = { id, tx, ty, lvl: clamp(lvl, MON[id].lvl[0], 40) }; const m = makeMonster(sp, event); m.aggroBoost = 2; m.state = 'chase'; G.mons.push(m); return m; }

/* ---- урон игроку ---- */
function hurtPlayer(raw, src, opts = {}) {
  const P = G.P, S = G.S; if (P.dead || P.invuln > G.t || (G_DEV.god && G.settings.dev)) return 0;
  if (!opts.noDodge && Math.random() < S.dodge) { floatText(P.x, P.y - 50, 'Уклон', '#8cf'); return 0; }
  let d = raw * 50 / (50 + S.def); d *= (1 - S.dr); d = Math.max(1, Math.round(d));
  if (P.shield > 0) { const a = Math.min(P.shield, d); P.shield -= a; d -= a; floatText(P.x, P.y - 46, 'Щит', '#8cf'); }
  if (d > 0) { P.hp -= d; floatText(P.x, P.y - 50, `-${d}`, '#f66', d > P.maxHp * 0.25 ? 'big' : 'n'); P.hurt = 0.2; Snd.play('hurt'); if (d > P.maxHp * 0.2) shake(4, 0.2); }
  P.lastCombat = G.t; if (G.prof.cls === 'berserk') P.res = Math.min(P.maxRes, P.res + 4 + d * 0.1);
  if (P.stealth > G.t && !opts.keepStealth) { P.stealth = 0; }
  if (P.hp <= 0) killPlayer();
  return d;
}
function killPlayer() {
  const P = G.P; if (P.dead) return; P.hp = 0; P.dead = true; P.deadT = 0; G.deathT = G.t; G.prof.deaths++; if (P.form) setForm(null, true); Snd.play('die'); logMsg('Вы погибли…', 'bad');
  if (G.tourney) { logMsg('Турнир проигран.', 'bad'); endTourney(false); }
}
function respawnPlayer() {
  const P = G.P, p = G.prof, k = p.projects && p.projects.hospital ? 0.5 : 1, loss = Math.floor(p.gold * 0.25 * k), xpLoss = Math.floor(p.xp * 0.3 * k);
  p.gold -= loss; p.xp = Math.max(0, p.xp - xpLoss);
  P.dead = false; P.hp = P.maxHp * 0.4; P.res = P.maxRes * 0.4; P.x = 50 * TS + 16; P.y = 53 * TS; P.invuln = G.t + 3; P.buffs = [];
  addBuff('weak', 'Слабость после смерти', '💀', { dmgPct: -0.15, defPct: -0.15 }, 240 * k); recalc();
  if (loss || xpLoss) logMsg(`Потери: ${loss} золота, ${xpLoss} опыта. Слабость на ${Math.round(4 * k)} мин.`, 'bad'); if (G.petEnt) { G.petEnt.x = P.x; G.petEnt.y = P.y; }
  G.mons.forEach(m => { if (!m.dead && !m.boss) { m.state = 'idle'; } if (m.boss && !m.dead && m.state === 'chase') { m.hp = m.maxHp; m.state = 'idle'; } });
  UI.hideDeath();
}

/* ---- урон монстрам ---- */
function calcHit(mult, o = {}) {
  const S = G.S, P = G.P, p = G.prof; let d = S.dmg * mult * rand(0.9, 1.1);
  if (p.cls === 'berserk') d *= 1 + 0.4 * (1 - P.hp / P.maxHp);
  if (P.nextBonus && P.nextBonus > G.t) { d *= 2; P.nextBonus = 0; }
  let crit = false; if (o.forceCrit || Math.random() < S.crit + (o.critBonus || 0)) { d *= S.critDmg; crit = true; }
  return { d, crit };
}
function damageMon(m, amount, o = {}) {
  if (m.dead || m.hidden) return;
  const P = G.P, S = G.S, cls = G.prof.cls;
  let d = amount * 60 / (60 + m.def);
  if (cls === 'assassin' && (o.melee || o.back)) { const toP = Math.atan2(P.y - m.y, P.x - m.x); if (o.back || Math.abs(angDiff(toP, m.ang)) > 2.1) { d *= 1.6; o.crit = true; floatText(m.x, m.y - 50, 'В спину!', '#c8f'); } }
  if (G_DEV.onehit && G.settings.dev && !o.dot) d = 1e9; d = Math.max(1, Math.round(d));
  m.hp -= d; m.hurt = 0.15; m.lastHit = G.t; P.lastCombat = G.t; m.aggroed = true;
  if (m.state === 'idle') m.state = 'chase'; G.target = m; G.targetT = G.t;
  floatText(m.x, m.y - 30 * m.d.size - 16, o.crit ? `${d}!` : `${d}`, o.crit ? '#ffd23a' : (o.dot ? '#b8f' : '#fff'), o.crit ? 'big' : 'n');
  if (!o.dot) { Snd.play('hit'); burst(m.x, m.y - 12, o.crit ? '#ffd23a' : '#c33', o.crit ? 8 : 4, 50); }
  if (o.kb && !m.boss) { const a = Math.atan2(m.y - P.y, m.x - P.x); moveEntity(m, Math.cos(a) * o.kb, Math.sin(a) * o.kb, mRad(m)); }
  if (o.stun) m.stun = Math.max(m.stun, G.t + o.stun);
  if (o.slow) { m.slow = G.t + o.slow.t; m.slowAmt = o.slow.a; }
  if (o.root) m.root = Math.max(m.root, G.t + o.root);
  if (o.burn) m.dots.push({ dps: o.burn.dps, until: G.t + o.burn.t, tick: 0, col: '#f80' });
  if (o.poison) m.dots.push({ dps: o.poison.dps, until: G.t + o.poison.t, tick: 0, col: '#8f4' });
  if (!o.dot && S.lifesteal > 0) { const h = d * S.lifesteal; P.hp = Math.min(P.maxHp, P.hp + h); if (h >= 1) floatText(P.x, P.y - 54, `+${Math.round(h)}`, '#5f5'); }
  if (!o.dot && cls === 'berserk') P.res = Math.min(P.maxRes, P.res + (o.rage !== undefined ? o.rage : 4));
  if (P.venomUntil > G.t && !o.dot && (o.melee || o.proj)) { const v = SKILLS.venom.v[(G.prof.skills.venom || 1) - 1] / 100; m.dots.push({ dps: G.S.dmg * v, until: G.t + 4, tick: 0, col: '#8f4' }); }
  if (m.hp <= 0) killMon(m);
}
function killMon(m) {
  if (m.dead) return; m.dead = true; m.deadT = 0; m.hp = 0; const d = m.d, p = G.prof, S = G.S;
  p.kills++; Snd.play('die');
  let xp = d.xp * (1 + (m.lvl - d.lvl[0]) * 0.2) * clamp(1 - (p.lvl - m.lvl) * 0.12, 0.2, 1.6);
  if (G.events.wolfnight && (m.id === 'wolf' || m.id === 'direwolf')) xp *= 2;
  gainXp(xp);
  const gold = Math.round(rand(d.gold[0], d.gold[1]) * (1 + (m.lvl - d.lvl[0]) * 0.15) * S.gold * (m.event === 'raid' ? 1.5 : 1)); if (gold > 0) { addGold(gold); floatText(m.x, m.y - 40, `+${gold}💰`, '#fd4'); Snd.play('coin'); }
  const luck = S.luck; for (const [id, ch] of d.drops) {
    if (id === 'sigil' && !questActive('mq3')) continue; if (id === 'ember' && !questActive('mq5')) continue;
    if (Math.random() < Math.min(1, ch * (ch >= 1 ? 1 : luck))) addItem(id, 1);
  }
  const b = p.bestiary[m.id] || (p.bestiary[m.id] = { kills: 0 }); const first = b.kills === 0; b.kills++; if (first) { toast(`📖 Бестиарий: ${d.name}`, 'good'); logMsg(`Запись в бестиарии: ${d.name}`, 'good'); }
  if (m.boss) { const key = m.sp.boss, first = key && !p.defeated.includes(key); if (key && first) p.defeated.push(key); if (d.loot) { const wt = `w_${CLASSES[p.cls].weapon}_3`; if (first || Math.random() < 0.3) { addItem(wt, 1); toast(`🏆 Трофей босса: ${ITEMS[wt].name}`, 'good'); } } toast(`Победа: ${d.name}!`, 'good'); shake(8, 0.5); burst(m.x, m.y - 20, '#ffd23a', 40, 120); ringFx(m.x, m.y, '#ffd23a', 120, 0.6); Snd.play('levelup'); }
  questKill(m.id); bountyKill(m.id); if (m.boss) questBoss(m.id);
  if (m.elite) { addGold(Math.round(gold * 2)); if (Math.random() < 0.4) addItem('gem', 1); gainXp(xp); floatText(m.x, m.y - 60, 'Вожак повержен!', '#fd4', 'big'); }
  if (m.event === 'raid' && G.raid) G.raid.killed++; if (m.event === 'tourney' && G.tourney) tourneyCheck();
  const pd = activePetData(); if (pd) petGainXp(pd, Math.round(xp * 0.5));
  if (p.cls === 'hunter' && d.tame && Math.random() < [0.06, 0.045, 0.03, 0.02, 0.012][PETS[d.tame].r] * luck) { if (addPet(d.tame)) { toast(`🐾 Вы нашли детёныша: ${PETS[d.tame].name}!`, 'good'); Snd.play('tame'); } }
  else if (d.tame && Math.random() < 0.05) addItem('treat', 1);
  if (!m.event && !m.boss) m.respawnAt = G.t + 150; if (window.UI) UI.dirty = true;
}
function applyDots(m, dt) {
  for (let i = m.dots.length - 1; i >= 0; i--) { const dt2 = m.dots[i]; dt2.tick -= dt; if (dt2.tick <= 0) { dt2.tick = 0.5; damageMon(m, Math.max(1, Math.round(dt2.dps * 0.5)), { dot: true }); if (m.dead) return; } if (G.t > dt2.until) m.dots.splice(i, 1); }
}

/* ---- снаряды ---- */
function fireProj(o) {
  G.proj.push(Object.assign({ x: 0, y: 0, ang: 0, speed: 400, r: 6, life: 1.2, team: 'p', color: '#fff', t: 0, hit: new Set(), pierce: false, mult: 1, light: 0 }, o, { vx: Math.cos(o.ang) * (o.speed || 400), vy: Math.sin(o.ang) * (o.speed || 400) }));
}
function explode(x, y, r, mult, o = {}) {
  ringFx(x, y, o.color || '#fa4', r, 0.35); burst(x, y, o.color || '#fa4', 16, r * 1.5); Snd.play(o.snd || 'boom'); if (o.shake) shake(o.shake, 0.3);
  for (const m of enemies()) { if (Math.hypot(m.x - x, m.y - 12 - y) < r + mRad(m)) { const h = calcHit(mult, o); damageMon(m, h.d, Object.assign({ crit: h.crit }, o.dmgOpts || {})); } }
}
function updateProj(dt) {
  for (let i = G.proj.length - 1; i >= 0; i--) {
    const pr = G.proj[i]; pr.t += dt; let dead = pr.t > pr.life;
    const nx = pr.x + pr.vx * dt, ny = pr.y + pr.vy * dt;
    if (blockedPx(nx, ny, true) || (G.world.blk[Math.floor(ny / TS) * WW + Math.floor(nx / TS)] && !pr.fly)) { dead = true; if (pr.team === 'p' && pr.aoe) { pr.x = nx; pr.y = ny; } } else { pr.x = nx; pr.y = ny; }
    if (pr.trail !== false && Math.random() < 0.6 && G.settings.particles) G.fx.push({ x: pr.x, y: pr.y, vx: rand(-10, 10), vy: rand(-10, 10), life: 0.25, t: 0, color: pr.color, size: pr.arrow ? 1.5 : 3, g: 0 });
    if (!dead) {
      if (pr.team === 'p') {
        for (const m of enemies()) {
          if (pr.hit.has(m)) continue; if (Math.hypot(m.x - pr.x, (m.y - 14 * m.d.size) - pr.y) < pr.r + mRad(m)) {
            pr.hit.add(m);
            if (pr.aoe) { dead = true; break; }
            const h = calcHit(pr.mult, pr.hitOpts); damageMon(m, h.d, Object.assign({ crit: h.crit, proj: true }, pr.dmgOpts || {}));
            if (!pr.pierce) { dead = true; break; }
          }
        }
      } else {
        const P = G.P; if (!P.dead && Math.hypot(P.x - pr.x, (P.y - 14) - pr.y) < pr.r + 9) { hurtPlayer(pr.dmg, null); if (pr.fire) burst(P.x, P.y - 14, '#f80', 10); dead = true; }
        const pe = G.petEnt; if (!dead && pe && !pe.down && Math.hypot(pe.x - pr.x, (pe.y - 10) - pr.y) < pr.r + 10) { pe.hp -= pr.dmg * 0.7; dead = true; petHurt(pe); }
      }
    }
    if (dead) { if (pr.team === 'p' && pr.aoe) { explode(pr.x, pr.y, pr.aoe, pr.mult, Object.assign({ color: pr.color, dmgOpts: pr.dmgOpts }, pr.expl || {})); } else if (pr.team === 'p') burst(pr.x, pr.y, pr.color, 4, 30); G.proj.splice(i, 1); }
  }
}

/* ---- игрок ---- */
function makePlayer() {
  const p = G.prof;
  return { x: p.pos.x, y: p.pos.y, dir: 'down', flip: false, aim: 0, moving: false, hp: p.hp, res: p.res, maxHp: 100, maxRes: 100, atkCd: 0, anim: null, buffs: [], hurt: 0, dead: false, deadT: 0, invuln: 0, stealth: 0, form: null, shield: 0, dash: null, lastCombat: -99, t0: 0, alt: 0, dots: [], nextBonus: 0, venomUntil: 0, hot: null, formT: 0 };
}
function aimDir(P) { const a = P.aim; const c = Math.cos(a), s = Math.sin(a); if (Math.abs(s) > Math.abs(c) * 1.05) { P.dir = s > 0 ? 'down' : 'up'; } else P.dir = 'side'; P.flip = c < 0; }
function startAnim(kind, dur, hitAt, fn) { const P = G.P; P.anim = { kind, t: 0, dur, hitAt, fn, done: false, p: 0 }; aimDir(P); }
function updatePlayer(dt) {
  const P = G.P, S = G.S, cls = CLASSES[G.prof.cls];
  if (P.dead) { P.deadT += dt; return; }
  P.t0 += dt; P.hurt = Math.max(0, P.hurt - dt);
  P.aim = Math.atan2(G.mouse.wy - (P.y - 14), G.mouse.wx - P.x);
  let mx = 0, my = 0;
  if (!G.paused && !G.dialog) { const k = G.keys; if (k.has('KeyW') || k.has('ArrowUp')) my -= 1; if (k.has('KeyS') || k.has('ArrowDown')) my += 1; if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1; if (k.has('KeyD') || k.has('ArrowRight')) mx += 1; }
  const fly = P.form === 'eagle' || (G_DEV.fly && G.settings.dev);
  if (P.dash) {
    const d = P.dash; d.t += dt; const sp = d.dist / d.dur * dt, ox = P.x, oy = P.y; moveEntity(P, Math.cos(d.ang) * sp, Math.sin(d.ang) * sp, 8, fly);
    if (d.hitMult) for (const m of enemies()) { if (!d.hit.has(m) && Math.hypot(m.x - P.x, m.y - P.y) < 34 + mRad(m)) { d.hit.add(m); const h = calcHit(d.hitMult); damageMon(m, h.d, { crit: h.crit, kb: 30, melee: true, rage: 8 }); } }
    if (Math.hypot(P.x - ox, P.y - oy) < 0.1 * sp) d.t = d.dur; if (d.t >= d.dur) P.dash = null; P.moving = true;
    if (G.settings.particles && Math.random() < 0.7) G.fx.push({ x: P.x, y: P.y - 10, vx: 0, vy: 0, life: 0.3, t: 0, color: d.color || '#fff', size: 5, g: 0 });
  } else if (P.anim && P.anim.kind === 'spin') { P.moving = false; }
  else {
    const len = Math.hypot(mx, my), busy = P.anim && (P.anim.kind === 'cast' || P.anim.kind === 'shoot') ? 0.55 : P.anim ? 0.75 : 1;
    P.moving = len > 0;
    if (len > 0) { mx /= len; my /= len; const sp = S.spd * (G_DEV.fast && G.settings.dev ? 2.5 : 1) * terrainSpeed(P.x, P.y) * busy * (P.slowT > G.t ? 0.5 : 1) * 1.05; moveEntity(P, mx * sp * dt, my * sp * dt, 8, fly); if (!P.anim) { if (Math.abs(my) > Math.abs(mx) + 0.1) { P.dir = my > 0 ? 'down' : 'up'; } else { P.dir = 'side'; P.flip = mx < 0; } } }
  }
  if (P.anim) { P.anim.t += dt; P.anim.p = P.anim.t / P.anim.dur; if (!P.anim.done && P.anim.p >= P.anim.hitAt) { P.anim.done = true; P.anim.fn && P.anim.fn(); } if (P.anim && P.anim.p >= 1) P.anim = null; }
  // ввод атаки
  if (!G.paused && !G.dialog && !P.dash && !G.panel && (G.mouse.down || G.keys.has('Space'))) basicAttack();
  // ресурсы
  const inCombat = G.t - P.lastCombat < 4;
  if (G.prof.cls === 'berserk') { if (!inCombat) P.res = Math.max(0, P.res - 4 * dt); }
  else { let rg = S.regen * (G.prof.cls === 'mage' && !inCombat ? 2 : 1); if (P.form) rg = 0; P.res = Math.min(P.maxRes, P.res + rg * dt); }
  P.hp = Math.min(P.maxHp, P.hp + (inCombat ? S.hpRegen * 0.3 : S.hpRegen + P.maxHp * 0.02) * dt);
  if (P.hot) { const a = Math.min(P.hot.left, P.hot.rate * dt); P.hp = Math.min(P.maxHp, P.hp + a); P.hot.left -= a; if (P.hot.left <= 0.01 || G.t > P.hot.until) P.hot = null; if (Math.random() < 0.15) burst(P.x, P.y - 14, '#5f5', 1, 20); }
  if (P.form) { const drain = { wolf: 1, bear: 1.5, eagle: 1.2 }[P.form]; P.res -= drain * dt; if (P.res <= 0) { P.res = 0; setForm(null); toast('Мана иссякла — вы вернулись в облик человека', 'warn'); } }
  for (let i = P.dots.length - 1; i >= 0; i--) { const d = P.dots[i]; d.tick -= dt; if (d.tick <= 0) { d.tick = 0.5; hurtPlayer(d.dps * 0.5, null, { noDodge: true, keepStealth: true }); } if (G.t > d.until) P.dots.splice(i, 1); }
  if (P.buffs.some(b => b.until < G.t)) { recalc(); UI.dirty = true; }
  if (P.shield > 0 && G.t > P.shieldUntil) P.shield = 0;
  if (P.stealth && P.stealth < G.t && P.stealth > 0) { P.stealth = 0; }
  P.res = clamp(P.res, 0, P.maxRes);
}
function basicAttack() {
  const P = G.P, p = G.prof, C = CLASSES[p.cls]; if (P.atkCd > G.t || P.dead || P.dash || P.anim) return;
  const A = P.form ? FORM_ATK[P.form] : C.atk, cd = A.cd / G.S.atkSpd; P.atkCd = G.t + cd; P.aim = Math.atan2(G.mouse.wy - (P.y - 14), G.mouse.wx - P.x);
  const stealthy = P.stealth > G.t; const rng = A.range * (A.kind === 'proj' ? G.S.range : 1);
  if (A.kind === 'melee') {
    const kind = P.form ? A.anim : (p.cls === 'assassin' ? 'stab' : 'slash'), dur = Math.max(0.22, cd * 0.85);
    Snd.play('swing');
    startAnim(kind, dur, 0.4, () => {
      const ang = P.aim, ox = P.x, oy = P.y - 12; slashFx(ox, oy, ang, rng, A.arc, p.cls === 'assassin' ? '#dfe' : '#fff'); let n = 0;
      for (const m of enemies()) { const dx = m.x - ox, dy = (m.y - 12 * m.d.size) - oy, d = Math.hypot(dx, dy); if (d < rng + mRad(m) && Math.abs(angDiff(Math.atan2(dy, dx), ang)) < A.arc / 2) { const h = calcHit(A.mult, { critBonus: stealthy ? 1 : 0 }); damageMon(m, h.d, { crit: h.crit, melee: true, kb: A.kb || 6, rage: A.rage !== undefined ? A.rage : 4 }); n++; if (!P.form && p.cls !== 'berserk') { } } }
      if (n && stealthy) P.stealth = 0; if (n) shake(P.form === 'bear' ? 3 : 1.5, 0.1);
    });
  } else {
    const isBow = p.cls === 'hunter', isBolt = p.cls === 'mage';
    Snd.play(isBow ? 'bow' : 'cast');
    startAnim(isBow ? 'shoot' : 'cast', Math.max(0.25, cd * 0.8), isBow ? 0.5 : 0.45, () => {
      const a = P.aim; fireProj({ x: P.x + Math.cos(a) * 14, y: P.y - 16 + Math.sin(a) * 6, ang: a, speed: C.atk.speed, r: C.atk.r, mult: C.atk.mult, color: C.atk.color, arrow: C.atk.arrow, life: rng / C.atk.speed, light: isBolt ? 90 : 0, hitOpts: { critBonus: stealthy ? 1 : 0 } });
    });
  }
}

/* ---- форма друида ---- */
function setForm(id, silent) {
  const P = G.P; if (P.form === id) return; P.form = id; P.anim = null;
  if (!silent) { Snd.play('transform'); burst(P.x, P.y - 14, id ? '#6c6' : '#fff', 22, 70); ringFx(P.x, P.y, '#6c6', 50); }
  recalc(); UI.dirty = true;
}

/* ---- умения ---- */
function nearestEnemy(x, y, range, ang, cone) {
  let best = null, bd = 1e9; for (const m of enemies()) { const d = Math.hypot(m.x - x, m.y - y); if (d > range) continue; if (cone !== undefined && Math.abs(angDiff(Math.atan2(m.y - y, m.x - x), ang)) > cone) continue; if (d < bd) { bd = d; best = m; } } return best;
}
function aimPt(maxR) { const P = G.P; const dx = G.mouse.wx - P.x, dy = G.mouse.wy - (P.y - 8), d = Math.hypot(dx, dy); if (d > maxR) return { x: P.x + dx / d * maxR, y: P.y - 8 + dy / d * maxR }; return { x: G.mouse.wx, y: G.mouse.wy }; }
function skillVal(id) { return SKILLS[id].v[(G.prof.skills[id] || 1) - 1]; }
const CAST = {
  charge(P, v) { P.dash = { t: 0, dur: 0.2, dist: 190, ang: P.aim, hitMult: v / 100, hit: new Set(), color: '#f86' }; Snd.play('roar'); aimDir(P); P.invuln = G.t + 0.25; return true; },
  slam(P, v) { startAnim('slash', 0.5, 0.5, () => { explode(P.x, P.y, 95, v / 100, { color: '#c96', shake: 7, dmgOpts: { stun: 1.5, kb: 20 } }); }); aimDir(P); return true; },
  whirl(P, v) { P.anim = { kind: 'spin', t: 0, dur: 0.6, hitAt: 2, done: true, p: 0 }; Snd.play('swing'); for (const t of [0.15, 0.4]) later(t, () => { if (!G.P.dead) { ringFx(P.x, P.y - 8, '#fff', 84, 0.25); Snd.play('swing'); for (const m of enemies()) if (Math.hypot(m.x - P.x, m.y - P.y) < 84 + mRad(m)) { const h = calcHit(v / 100); damageMon(m, h.d, { crit: h.crit, melee: true, kb: 12, rage: 3 }); } } }); return true; },
  warcry(P, v) { addBuff('warcry', 'Боевой клич', '📣', { dmgPct: v / 100, dr: 0.15 }, 10); ringFx(P.x, P.y, '#f84', 100, 0.6); Snd.play('roar'); shake(3); burst(P.x, P.y - 14, '#f84', 20, 80); return true; },
  fireball(P, v) { startAnim('cast', 0.35, 0.5, () => { const a = P.aim; Snd.play('fire'); fireProj({ x: P.x + Math.cos(a) * 16, y: P.y - 18, ang: a, speed: 380, r: 10, mult: v / 100, color: '#f84', aoe: 62, life: 1.4, light: 130, dmgOpts: { burn: { dps: G.S.dmg * 0.6, t: 3 } }, expl: { snd: 'fire', shake: 3 } }); }); aimDir(P); return true; },
  meteor(P, v) { const pt = aimPt(420); const x = pt.x, y = pt.y; G.areas.push({ type: 'telegraph', x, y, r: 100, t0: G.t, dur: 1.0, color: '#f60', meteor: true, fn: () => { explode(x, y, 100, v / 100, { color: '#f84', shake: 9, snd: 'boom', dmgOpts: { burn: { dps: G.S.dmg * 0.5, t: 3 }, kb: 25 } }); burst(x, y, '#fd6', 30, 160); } }); startAnim('cast', 0.5, 0.5, () => { }); aimDir(P); Snd.play('cast'); return true; },
  frostnova(P, v) { startAnim('cast', 0.35, 0.5, () => { ringFx(P.x, P.y - 8, '#8df', 130, 0.5); Snd.play('ice'); burst(P.x, P.y - 12, '#bef', 26, 130); for (const m of enemies()) if (Math.hypot(m.x - P.x, m.y - P.y) < 130 + mRad(m)) { const h = calcHit(v / 100); damageMon(m, h.d, { crit: h.crit, slow: { t: 3, a: 0.45 } }); } }); aimDir(P); return true; },
  chain(P, v) { const a = P.aim; let cur = nearestEnemy(P.x, P.y, 340, a, 1.0) || nearestEnemy(P.x, P.y, 200); if (!cur) { toast('Нет цели', 'warn'); return false; } startAnim('cast', 0.3, 0.5, () => { let from = { x: P.x, y: P.y - 20 }, hit = new Set(), pts = [from], n = 0; Snd.play('zap'); while (cur && n < 4) { hit.add(cur); pts.push({ x: cur.x, y: cur.y - 16 }); const h = calcHit(v / 100); damageMon(cur, h.d, { crit: h.crit }); burst(cur.x, cur.y - 16, '#ff8', 6, 50); n++; const c0 = cur; cur = null; let bd = 170; for (const m of enemies()) if (!hit.has(m)) { const d = Math.hypot(m.x - c0.x, m.y - c0.y); if (d < bd) { bd = d; cur = m; } } } lightning(pts); }); aimDir(P); return true; },
  blink(P, v) { const pt = aimPt(v); const ox = P.x, oy = P.y; let px = ox, py = oy; const dx = pt.x - ox, dy = pt.y - (oy - 8), d = Math.hypot(dx, dy), n = Math.ceil(d / 8); for (let i = 1; i <= n; i++) { const x = ox + dx * i / n, y = oy + dy * i / n; if (blockedPx(x - 7, y, false) || blockedPx(x + 7, y, false)) break; px = x; py = y; } burst(ox, oy - 14, '#c8f', 18, 70); P.x = px; P.y = py; burst(px, py - 14, '#c8f', 18, 70); ringFx(px, py, '#c8f', 40, 0.3); Snd.play('cast'); P.invuln = G.t + 0.3; return true; },
  shadowstep(P, v) { const a = P.aim; const t = nearestEnemy(P.x, P.y, 320, a, 1.3) || nearestEnemy(P.x, P.y, 200); if (!t) { toast('Нет цели рядом', 'warn'); return false; } burst(P.x, P.y - 14, '#404', 16, 60); const ba = t.ang + Math.PI; P.x = t.x + Math.cos(ba) * 26; P.y = t.y + Math.sin(ba) * 8; if (blockedPx(P.x, P.y, false)) { P.x = t.x - 20; P.y = t.y; } P.aim = Math.atan2(t.y - P.y, t.x - P.x); aimDir(P); startAnim('stab', 0.3, 0.3, () => { const h = calcHit(v / 100, { forceCrit: true }); damageMon(t, h.d, { crit: true, back: true, melee: true }); slashFx(P.x, P.y - 12, P.aim, 50, 2, '#c8f'); burst(t.x, t.y - 14, '#c8f', 14, 80); }); Snd.play('swing'); P.invuln = G.t + 0.35; return true; },
  fan(P, v) { startAnim('shoot', 0.3, 0.4, () => { for (let i = -2; i <= 2; i++) fireProj({ x: P.x, y: P.y - 16, ang: P.aim + i * 0.2, speed: 520, r: 5, mult: v / 100, color: '#dfe', arrow: true, life: 0.7, pierce: false }); Snd.play('swing'); }); aimDir(P); return true; },
  venom(P, v) { P.venomUntil = G.t + 8; ringFx(P.x, P.y - 8, '#8f4', 40, 0.4); Snd.play('cast'); logMsg('Клинки покрыты ядом.'); UI.dirty = true; P.buffs.push({ id: 'venom', name: 'Яд', icon: '☠️', mods: {}, until: G.t + 8, dur: 8 }); return true; },
  smoke(P, v) { P.stealth = G.t + v; P.nextBonus = G.t + v + 1; burst(P.x, P.y - 14, '#888', 30, 80); ringFx(P.x, P.y, '#999', 70, 0.5); Snd.play('whoosh'); for (const m of enemies()) if (m.state === 'chase' && Math.hypot(m.x - P.x, m.y - P.y) > 50) { m.state = 'idle'; m.aggroed = false; } return true; },
  wolf(P) { setForm(P.form === 'wolf' ? null : 'wolf'); return true; }, bear(P) { setForm(P.form === 'bear' ? null : 'bear'); return true; }, eagle(P) { setForm(P.form === 'eagle' ? null : 'eagle'); return true; },
  vines(P, v) { const pt = aimPt(340), x = pt.x, y = pt.y; G.areas.push({ type: 'vines', x, y, r: 74, until: G.t + 3.2, t0: G.t }); ringFx(x, y, '#5c5', 74, 0.5); Snd.play('cast'); startAnim('cast', 0.3, 0.5, () => { }); aimDir(P); for (const m of enemies()) if (Math.hypot(m.x - x, m.y - y) < 74 + mRad(m)) { const h = calcHit(v / 100); damageMon(m, h.d, { crit: h.crit, root: 3 }); } return true; },
  regrowth(P, v) { P.hot = { left: P.maxHp * v / 100, rate: P.maxHp * v / 100 / 5, until: G.t + 6 }; Snd.play('heal'); ringFx(P.x, P.y, '#5f5', 50, 0.5); return true; },
  volley(P, v) { startAnim('shoot', 0.3, 0.45, () => { for (let i = -1; i <= 1; i++) fireProj({ x: P.x, y: P.y - 16, ang: P.aim + i * 0.16, speed: 640, r: 5, mult: v / 100, color: '#e8d8a0', arrow: true, life: 0.85 }); Snd.play('bow'); }); aimDir(P); return true; },
  trap(P, v) { G.areas.push({ type: 'trap', x: P.x, y: P.y, r: 34, mult: v / 100, armedAt: G.t + 0.6, until: G.t + 90 }); Snd.play('click'); logMsg('Капкан установлен.'); return true; },
  tame(P, v) { return tameAttempt(P, v); },
  call(P, v) { const pe = G.petEnt; if (!pe || pe.down) { toast('Нет активного питомца', 'warn'); return false; } pe.buffUntil = G.t + 10; pe.buffMul = 1 + v / 100; pe.hp = Math.min(pe.maxHp, pe.hp + pe.maxHp * 0.3); ringFx(pe.x, pe.y, '#fd6', 50, 0.5); Snd.play('roar'); floatText(pe.x, pe.y - 40, 'Зов охоты!', '#fd6'); return true; }
};
function castSkill(id) {
  const P = G.P, p = G.prof, S = SKILLS[id], r = p.skills[id]; if (!r || P.dead || G.paused) return;
  if ((G.cd[id] || 0) > G.t) return; if (P.anim && P.anim.kind !== 'stab' && P.anim.kind !== 'slash' && !P.anim.done === false && P.anim.p < 0.8 && false) return;
  if (P.form && S.type !== 'form') { toast('В облике зверя заклинания недоступны', 'warn'); return; }
  const cost = (P.form === id) ? 0 : S.cost;
  if (P.res < cost && !(S.type === 'form' && P.form === id)) { toast(`Недостаточно: ${RES[CLASSES[p.cls].res].name}`, 'warn'); Snd.play('error'); return; }
  P.aim = Math.atan2(G.mouse.wy - (P.y - 14), G.mouse.wx - P.x);
  const ok = CAST[id](P, SKILLS[id].v[r - 1]); if (ok === false) return;
  P.res -= cost; G.cd[id] = G.t + S.cd; P.lastCombat = (S.type === 'form' || id === 'regrowth') ? P.lastCombat : G.t;
}
function useRacial() {
  const P = G.P, R = RACES[G.prof.race], a = R.active; if (P.dead || (G.cd[a.id] || 0) > G.t) return; G.cd[a.id] = G.t + a.cd;
  switch (a.id) {
    case 'secondwind': P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.3); floatText(P.x, P.y - 50, '+30%', '#5f5'); burst(P.x, P.y - 14, '#f8a', 14, 50); Snd.play('heal'); break;
    case 'moonstep': addBuff('moonstep', 'Лунный шаг', '🌙', { spdPct: 0.5, dodge: 0.25 }, 6); burst(P.x, P.y - 14, '#bdf', 16, 60); Snd.play('cast'); break;
    case 'stoneskin': addBuff('stoneskin', 'Каменная кожа', '🪨', { dr: 0.4 }, 7); burst(P.x, P.y - 14, '#aaa', 16, 50); Snd.play('cast'); break;
    case 'bloodrage': addBuff('bloodrage', 'Кровавая ярость', '💢', { dmgPct: 0.4, atkSpdPct: 0.3 }, 8); burst(P.x, P.y - 14, '#f44', 20, 70); Snd.play('roar'); break;
    case 'slip': P.stealth = G.t + 5; addBuff('slip', 'Ловкач', '💨', { spdPct: 0.3 }, 5); burst(P.x, P.y - 14, '#ddd', 16, 50); Snd.play('whoosh'); for (const m of enemies()) if (m.state === 'chase') { m.state = 'idle'; m.aggroed = false; } break;
  }
}

/* ---- приручение ---- */
function tameAttempt(P, v) {
  const cands = enemies().filter(m => m.d.tame && Math.hypot(m.x - P.x, m.y - P.y) < 320).sort((a, b) => Math.hypot(a.x - G.mouse.wx, a.y - G.mouse.wy) - Math.hypot(b.x - G.mouse.wx, b.y - G.mouse.wy));
  const m = cands[0]; if (!m) { toast('Рядом нет зверя для приручения', 'warn'); return false; }
  if (m.hp / m.maxHp > 0.4) { toast('Зверь слишком силён — ослабьте его (<40% здоровья)', 'warn'); floatText(m.x, m.y - 50, `${Math.round(m.hp / m.maxHp * 100)}%`, '#fa4'); return false; }
  if (!countItem('lure')) { toast('Нужна «Приманка для зверей»', 'warn'); Snd.play('error'); return false; }
  if (G.prof.pets.length >= 8) { toast('Максимум 8 питомцев. Отпустите кого-нибудь.', 'warn'); return false; }
  removeItem('lure', 1); const pd = PETS[m.d.tame], rar = RARITY[pd.r];
  const ch = Math.min(0.95, v / 100 * rar.ch * (m.hp / m.maxHp < 0.2 ? 1.5 : 1) * (m.boss ? 0 : 1) + (m.hp / m.maxHp < 0.2 ? 0.1 : 0));
  ringFx(m.x, m.y, '#fd6', 40, 0.5); Snd.play('cast');
  if (Math.random() < ch) { addPet(m.d.tame); m.dead = true; m.gone = true; m.deadT = 9; m.respawnAt = G.t + 150; questTame(); toast(`🐾 Приручён: ${pd.name} (${rar.n})!`, 'good'); Snd.play('tame'); burst(m.x, m.y - 10, '#fd6', 30, 90); G.prof.bestiary[m.id] = G.prof.bestiary[m.id] || { kills: 0 }; }
  else { toast(`Не удалось приручить (шанс ${Math.round(ch * 100)}%)`, 'warn'); m.state = 'chase'; m.aggroed = true; }
  return true;
}

/* ---- питомцы ---- */
function petStats(pd) {
  const d = PETS[pd.id], r = RARITY[d.r].m, l = pd.lvl - 1, S = G.S;
  return { maxHp: d.hp * r * (1 + 0.14 * l) * (1 + S.petHp), dmg: d.dmg * r * (1 + 0.15 * l) * (1 + S.petDmg) + G.S.dmg * 0.15, spd: d.spd };
}
function addPet(id) { const p = G.prof; if (p.pets.length >= 8) { toast('Максимум 8 питомцев', 'warn'); return false; } const pd = { uid: 'u' + Date.now().toString(36) + Math.floor(Math.random() * 999), id, lvl: 1, xp: 0, name: PETS[id].name }; p.pets.push(pd); if (!p.activePet) summonPet(pd.uid); UI.dirty = true; return pd; }
function summonPet(uid) {
  const p = G.prof; if (!uid) { p.activePet = null; G.petEnt = null; recalc(); UI.dirty = true; return; }
  const pd = p.pets.find(x => x.uid === uid); if (!pd) return; p.activePet = uid; const P = G.P, st = petStats(pd);
  G.petEnt = { kind: 'pet', uid, id: pd.id, d: PETS[pd.id], x: P.x - 24, y: P.y, hp: st.maxHp, maxHp: st.maxHp, dmg: st.dmg, spd: st.spd, lvl: pd.lvl, cd: 0, target: null, down: 0, flip: false, moving: false, atk: null, hurt: 0, t0: rand(0, 5), buffUntil: 0, buffMul: 1 };
  recalc(); UI.dirty = true; Snd.play('tame');
}
function releasePet(uid) { const p = G.prof; if (p.activePet === uid) summonPet(null); p.pets = p.pets.filter(x => x.uid !== uid); UI.dirty = true; }
function petGainXp(pd, n) {
  if (pd.lvl >= MAX_LEVEL) return; pd.xp += n; const need = l => Math.floor(20 * Math.pow(l, 1.5));
  while (pd.lvl < MAX_LEVEL && pd.xp >= need(pd.lvl)) { pd.xp -= need(pd.lvl); pd.lvl++; toast(`🐾 ${pd.name} — уровень ${pd.lvl}!`, 'good'); if (G.petEnt && G.petEnt.uid === pd.uid) { const st = petStats(pd); G.petEnt.maxHp = st.maxHp; G.petEnt.hp = st.maxHp; G.petEnt.dmg = st.dmg; G.petEnt.lvl = pd.lvl; ringFx(G.petEnt.x, G.petEnt.y, '#fd6', 40, 0.5); } }
  UI.dirty = true;
}
function petHurt(pe) { pe.hurt = 0.15; if (pe.hp <= 0 && !pe.down) { pe.down = G.t + 25; pe.hp = 0; floatText(pe.x, pe.y - 30, 'Питомец без сил', '#fa8'); pe.target = null; } }
function updatePet(dt) {
  const pe = G.petEnt, P = G.P; if (!pe) return; pe.t0 += dt; pe.hurt = Math.max(0, pe.hurt - dt);
  if (pe.down) { if (G.t > pe.down || (!P.dead && Math.hypot(pe.x - P.x, pe.y - P.y) < 50 && G.t > pe.down - 15)) { pe.down = 0; pe.hp = pe.maxHp * 0.6; burst(pe.x, pe.y - 10, '#fd6', 10); } else return; }
  if (P.dead) return;
  const buff = pe.buffUntil > G.t ? pe.buffMul : 1, spd = pe.spd * buff; let tx, ty, moving = false;
  if (Math.hypot(pe.x - P.x, pe.y - P.y) > 700) { pe.x = P.x - 20; pe.y = P.y; }
  if (!pe.target || pe.target.dead || pe.target.hidden || Math.hypot(pe.target.x - P.x, pe.target.y - P.y) > 380) pe.target = nearestEnemy(P.x, P.y, 300);
  if (pe.target) {
    const m = pe.target, dx = m.x - pe.x, dy = m.y - pe.y, d = Math.hypot(dx, dy);
    if (d > 26 + mRad(m)) { const s = spd * dt; moveEntity(pe, dx / d * s, dy / d * s, 7, pe.d.kind === 'bird' || pe.d.kind === 'dragon'); moving = true; pe.flip = dx < 0; }
    else if (pe.cd <= 0) { pe.cd = 0.9 / (buff > 1 ? 1.5 : 1); pe.atk = { p: 0, dur: 0.4 }; later(0.15, () => { if (!m.dead && G.petEnt === pe) { const d2 = pe.dmg * buff * rand(0.9, 1.1); damageMon(m, d2, { pet: true, dot: true }); burst(m.x, m.y - 12, '#fd6', 3, 30); } }); }
  } else {
    const dx = P.x - pe.x, dy = P.y - pe.y, d = Math.hypot(dx, dy);
    if (d > 60) { const s = Math.min(spd * (d > 160 ? 1.4 : 1), d * 4) * dt; moveEntity(pe, dx / d * s, dy / d * s, 7, pe.d.kind === 'bird' || pe.d.kind === 'dragon'); moving = true; pe.flip = dx < 0; }
  }
  pe.cd -= dt; pe.moving = moving; if (pe.atk) { pe.atk.p += dt / pe.atk.dur; if (pe.atk.p >= 1) pe.atk = null; }
}

/* ---- ИИ монстров ---- */
function zoneBlock(x, y) { return y < OW_H * TS ? 'o' : Math.floor(x / (32 * TS)) + '_' + Math.floor((y - OW_H * TS) / (24 * TS)); }
function inTown(x, y) { return isSafeTile(x / TS, y / TS); }
function updateMonster(m, dt) {
  const P = G.P;
  if (m.d.night) { const want = !isNight() && !m.event && m.hy < OW_H * TS; if (want && !m.hidden) { m.hidden = true; } else if (!want && m.hidden) { m.hidden = false; m.hp = m.maxHp; } }
  if (m.hidden) return;
  if (m.dead) { m.deadT += dt; if (m.respawnAt && G.t > m.respawnAt && Math.hypot(m.hx - P.x, m.hy - P.y) > 520) { m.dead = false; m.gone = false; m.hp = m.maxHp; m.x = m.hx; m.y = m.hy; m.state = 'idle'; m.dots = []; m.stun = m.root = m.slow = 0; m.deadT = 0; } return; }
  m.t0 += dt; m.hurt = Math.max(0, m.hurt - dt);
  const dP = Math.hypot(P.x - m.x, P.y - m.y);
  if (zoneBlock(m.x, m.y) !== zoneBlock(P.x, P.y)) return;
  if (dP > 850 && !m.event) { if (Math.hypot(m.x - m.hx, m.y - m.hy) > 4) { m.x = lerp(m.x, m.hx, 0.05); m.y = lerp(m.y, m.hy, 0.05); } m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.02 * dt); return; }
  if (m.dots.length) applyDots(m, dt); if (m.dead) return;
  if (m.atk) { m.atk.p += dt / m.atk.dur; if (!m.atk.done && m.atk.p >= m.atk.hitAt) { m.atk.done = true; m.atk.fn && m.atk.fn(); } if (m.atk.p >= 1) m.atk = null; }
  const stunned = m.stun > G.t, rooted = m.root > G.t || stunned, slow = m.slow > G.t ? m.slowAmt : 1;
  const d = m.d, spd = m.spd * slow * (m.enrage ? 1.2 : 1); m.moving = false;
  m.cd -= dt; if (stunned) return;
  const stealthed = P.stealth > G.t, safe = inTown(P.x, P.y) && !m.event;
  let aggro = (d.aggro || 0) * (m.aggroBoost || 1) * (stealthed ? 0.12 : 1); if (safe) aggro = 0;
  const pe = G.petEnt, tgt = (pe && !pe.down && Math.hypot(pe.x - m.x, pe.y - m.y) < dP * 0.7 && m.state === 'chase') ? pe : P;
  const dT = Math.hypot(tgt.x - m.x, tgt.y - m.y);
  if (d.passive) {
    if (m.aggroed || dP < 110) { const a = Math.atan2(m.y - P.y, m.x - P.x); if (!rooted) { moveEntity(m, Math.cos(a) * spd * dt, Math.sin(a) * spd * dt, mRad(m), d.flying); m.moving = true; m.flip = Math.cos(a) < 0; m.ang = a; } if (dP > 400) m.aggroed = false; }
    else wander(m, dt, spd * 0.4, rooted); return;
  }
  if (m.state === 'idle') { if (!P.dead && dP < aggro && !stealthed || (dP < 60 && !safe && !P.dead && !stealthed)) { m.state = 'chase'; if (d.boss) { Snd.play('roar'); } } else wander(m, dt, spd * 0.35, rooted); }
  if (m.state === 'chase') {
    if (P.dead || safe && !m.aggroed || (stealthed && dP > 60) || dP > (d.aggro || 200) * 3.2 || Math.hypot(m.x - m.hx, m.y - m.hy) > (m.event ? 5000 : 720)) { m.state = 'idle'; m.aggroed = false; return; }
    const dx = tgt.x - m.x, dy = tgt.y - m.y, dist = Math.max(0.01, dT), ang = Math.atan2(dy, dx); m.ang = ang; m.flip = dx < 0;
    if (d.ranged) {
      if (dist < d.rng * 0.5 && !rooted) { moveEntity(m, -Math.cos(ang) * spd * dt, -Math.sin(ang) * spd * dt, mRad(m)); m.moving = true; }
      else if (dist > d.rng * 0.9 && !rooted) { moveEntity(m, Math.cos(ang) * spd * dt, Math.sin(ang) * spd * dt, mRad(m)); m.moving = true; }
      if (m.cd <= 0 && dist < d.rng + 30 && !m.atk) { m.cd = d.cd * rand(0.9, 1.2); m.atk = { p: 0, dur: 0.6, hitAt: 0.6, done: false, kind: 'cast', fn: () => { if (m.dead) return; const a = Math.atan2(tgt.y - 14 - (m.y - 20), tgt.x - m.x); fireProj({ team: 'e', x: m.x, y: m.y - 22, ang: a, speed: d.ranged.spd, r: 7, dmg: m.dmg * rand(0.9, 1.1), color: d.ranged.col, arrow: d.ranged.arrow, fire: d.ranged.fire, life: 1.6, light: d.ranged.fire ? 100 : 40 }); Snd.play(d.ranged.arrow ? 'bow' : 'cast'); } }; }
    } else {
      const reach = d.rng + mRad(m) * 0.3 + 9;
      if (dist > reach * 0.85 && !rooted && !m.atk) { moveEntity(m, Math.cos(ang) * spd * dt, Math.sin(ang) * spd * dt, mRad(m)); m.moving = true; }
      if (dist < reach && m.cd <= 0 && !m.atk && !rooted) {
        m.cd = d.cd * rand(0.9, 1.15); m.atk = { p: 0, dur: 0.5, hitAt: 0.55, done: false, kind: 'slash', fn: () => {
          if (m.dead || m.stun > G.t) return; const t2 = tgt === G.petEnt ? G.petEnt : G.P; const dd = Math.hypot(t2.x - m.x, t2.y - m.y);
          if (dd < reach * 1.35) { if (t2 === G.P) { hurtPlayer(m.dmg * rand(0.9, 1.1), m); if (d.poison && Math.random() < 0.6) G.P.dots.push({ dps: m.dmg * 0.25, until: G.t + 4, tick: 0 }); if (m.boss) shake(4, 0.2); } else { t2.hp -= m.dmg; petHurt(t2); floatText(t2.x, t2.y - 30, `-${Math.round(m.dmg)}`, '#f66'); } }
        } };
      }
    }
    if (d.boss && !m.dead) bossAI(m, dt, dist);
  }
}
function wander(m, dt, spd, rooted) {
  m.wt -= dt; if (m.wt <= 0) { m.wt = rand(2, 6); if (Math.random() < 0.6) { m.tx = m.hx + rand(-80, 80); m.ty = m.hy + rand(-60, 60); m.walking = true; } else m.walking = false; }
  if (m.walking && !rooted) { const dx = m.tx - m.x, dy = m.ty - m.y, d = Math.hypot(dx, dy); if (d > 6) { if (moveEntity(m, dx / d * spd * dt, dy / d * spd * dt, mRad(m), m.d.flying)) { m.moving = true; m.flip = dx < 0; m.ang = Math.atan2(dy, dx); } else m.walking = false; } else m.walking = false; }
}
function bossAI(m, dt, dist) {
  const P = G.P, ai = m.d.ai || []; m.aiT = m.aiT || ai.map(a => a.cd * 0.6);
  if (m.hp < m.maxHp * 0.4 && !m.enrage) { m.enrage = true; floatText(m.x, m.y - 100, 'ЯРОСТЬ!', '#f33', 'big'); Snd.play('roar'); shake(6, 0.5); }
  ai.forEach((a, i) => {
    m.aiT[i] -= dt * (m.enrage ? 1.4 : 1); if (m.aiT[i] > 0) return; if (dist > 520 && a.t !== 'summon') return; m.aiT[i] = a.cd;
    if (a.t === 'slam') { const x = P.x, y = P.y; G.areas.push({ type: 'telegraph', x, y, r: a.r, t0: G.t, dur: 1.1, color: '#f33', fn: () => { ringFx(x, y, '#c96', a.r, 0.4); shake(8, 0.35); Snd.play('boom'); burst(x, y, '#a86', 24, 130); if (!m.dead && Math.hypot(G.P.x - x, G.P.y - y) < a.r + 8) { hurtPlayer(m.dmg * 1.5, m, { noDodge: true }); G.P.slowT = G.t + 1.5; } } }); floatText(m.x, m.y - 90, 'Удар!', '#f66', 'big'); }
    else if (a.t === 'nova') { Snd.play(a.fire ? 'fire' : 'cast'); floatText(m.x, m.y - 90, 'Волна!', a.col || '#f84', 'big'); const n = a.n || 12, base = rand(0, TAU); for (let k = 0; k < n; k++) fireProj({ team: 'e', x: m.x, y: m.y - 24, ang: base + k / n * TAU, speed: 240, r: 8, dmg: m.dmg * 0.8, color: a.col || '#ff6a1a', fire: !!a.fire, life: 2.2, light: 90 }); ringFx(m.x, m.y, a.col || '#f84', 80, 0.5); }
    else if (a.t === 'summon') { const alive = G.mons.filter(x => !x.dead && x.id === a.id && x.event === 'bossadd').length; if (alive >= (a.max || 4)) return; floatText(m.x, m.y - 90, 'Ко мне!', '#f84', 'big'); Snd.play('cast'); for (let k = 0; k < (a.n || 2); k++) { const tx = Math.floor(m.x / TS) + (k ? 2 : -2), ty = Math.floor(m.y / TS) + 2, q = G.world.nearestWalk(tx, ty) || [tx, ty]; const e = spawnEventMon(a.id, q[0], q[1], Math.max(MON[a.id].lvl[0], m.lvl - 2), 'bossadd'); e.hx = m.x; e.hy = m.y; } }
  });
}

/* ---- зоны на земле (ловушки, лозы, телеграфы) ---- */
function updateAreas(dt) {
  for (let i = G.areas.length - 1; i >= 0; i--) {
    const a = G.areas[i];
    if (a.type === 'telegraph') { if (G.t - a.t0 >= a.dur) { a.fn && a.fn(); G.areas.splice(i, 1); } }
    else if (a.type === 'vines') { if (G.t > a.until) G.areas.splice(i, 1); else for (const m of enemies()) if (Math.hypot(m.x - a.x, m.y - a.y) < a.r + mRad(m) && m.root < G.t + 0.3) m.root = G.t + 0.4; }
    else if (a.type === 'trap') {
      if (G.t > a.until) { G.areas.splice(i, 1); continue; } if (G.t < a.armedAt) continue;
      const m = enemies().find(m => Math.hypot(m.x - a.x, m.y - a.y) < a.r + mRad(m) * 0.5);
      if (m) { explode(a.x, a.y, 70, a.mult, { color: '#ca8', dmgOpts: { root: 3 } }); G.areas.splice(i, 1); }
    }
  }
}

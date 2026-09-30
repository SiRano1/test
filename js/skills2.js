'use strict';
/* ===== Дополнительные умения (3-й ярус), слоты активных/пассивных умений ===== */
Object.assign(SKILLS, {
  leap: { cls: 'berserk', name: 'Прыжок титана', icon: '🦘', type: 'active', branch: 0, tier: 3, req: 10, cost: 50, cd: 14, v: [300, 380, 460], desc: 'Прыжок к курсору с сокрушительным приземлением: {v}% урона по области и отбрасывание.' },
  frenzy: { cls: 'berserk', name: 'Неистовство', icon: '😡', type: 'passive', branch: 1, tier: 3, req: 11, v: [8, 14, 20], desc: '+{v}% к скорости атаки.' },
  laststand: { cls: 'berserk', name: 'Последний рубеж', icon: '🛡️', type: 'active', branch: 2, tier: 3, req: 12, cost: 30, cd: 45, v: [30, 45, 60], desc: 'Щит на {v}% максимального здоровья и −30% получаемого урона на 6 секунд.' },
  firerain: { cls: 'mage', name: 'Огненный дождь', icon: '🌋', type: 'active', branch: 0, tier: 3, req: 10, cost: 60, cd: 16, v: [80, 100, 120], desc: '3 секунды огненный ливень в точке курсора: по {v}% урона за удар, много ударов.' },
  frostarmor: { cls: 'mage', name: 'Ледяная броня', icon: '🧊', type: 'active', branch: 1, tier: 3, req: 11, cost: 30, cd: 20, v: [25, 35, 45], desc: 'Щит на {v}% здоровья на 8 с; атакующие вас враги замедляются.' },
  arcanemight: { cls: 'mage', name: 'Арканная мощь', icon: '💠', type: 'passive', branch: 2, tier: 3, req: 12, v: [6, 12, 18], desc: '+{v}% ко всему урону.' },
  bladedance: { cls: 'assassin', name: 'Танец клинков', icon: '⚔️', type: 'active', branch: 0, tier: 3, req: 10, cost: 45, cd: 14, v: [110, 140, 170], desc: 'Серия из 5 стремительных ударов по ближайшим врагам, по {v}% урона.' },
  coldblood: { cls: 'assassin', name: 'Хладнокровие', icon: '🧊', type: 'passive', branch: 1, tier: 3, req: 11, v: [20, 35, 50], desc: '+{v}% к урону критических ударов.' },
  flashbomb: { cls: 'assassin', name: 'Ослепляющая бомба', icon: '💥', type: 'active', branch: 2, tier: 3, req: 12, cost: 30, cd: 20, v: [2, 3, 4], desc: 'Вспышка: враги вокруг оглушены на {v} с, вы скрываетесь на 2 с.' },
  wrath: { cls: 'druid', name: 'Гнев природы', icon: '🌩️', type: 'active', branch: 0, tier: 3, req: 10, cost: 50, cd: 15, v: [200, 260, 320], desc: 'Четыре удара молний в районе курсора, по {v}% урона (только в облике человека).' },
  spirit: { cls: 'druid', name: 'Дух зверя', icon: '🐾', type: 'passive', branch: 1, tier: 3, req: 11, v: [20, 35, 50], desc: 'Звериные формы тратят на {v}% меньше маны.' },
  thorns: { cls: 'druid', name: 'Шипастая кожа', icon: '🌵', type: 'active', branch: 2, tier: 3, req: 12, cost: 30, cd: 22, v: [30, 50, 70], desc: '10 секунд: {v}% полученного урона возвращается обидчикам.' },
  snipe: { cls: 'hunter', name: 'Меткий выстрел', icon: '🎯', type: 'active', branch: 0, tier: 3, req: 10, cost: 35, cd: 9, v: [400, 520, 650], desc: 'Мощная пронзающая стрела на большую дальность: {v}% урона.' },
  beastmaster: { cls: 'hunter', name: 'Повелитель зверей', icon: '🦁', type: 'passive', branch: 1, tier: 3, req: 11, v: [15, 25, 35], desc: 'Питомец: +{v}% к урону и здоровью.' },
  arrowrain: { cls: 'hunter', name: 'Ливень стрел', icon: '🌧️', type: 'active', branch: 2, tier: 3, req: 12, cost: 45, cd: 15, v: [70, 90, 110], desc: '3 секунды град стрел в точке курсора: по {v}% урона за стрелу.' }
});
const SKILL_TYPE_LABEL = { active: 'АКТИВНОЕ', passive: 'ПАССИВНОЕ', form: 'ОБЛИК' };
const PASSIVE_SLOTS = () => 2 + (G.prof.lvl >= 10 ? 1 : 0);
const ACTIVE_SLOTS = 5;

/* ---- слоты ---- */
function ensureLoadout() {
  const p = G.prof; if (!p.loadout) p.loadout = { act: [], pas: [] };
  const L = p.loadout, learned = id => (p.skills[id] || 0) > 0 && SKILLS[id] && SKILLS[id].cls === p.cls;
  L.act = L.act.filter(id => learned(id) && SKILLS[id].type !== 'passive').slice(0, ACTIVE_SLOTS); L.pas = L.pas.filter(id => learned(id) && SKILLS[id].type === 'passive').slice(0, PASSIVE_SLOTS());
  const order = Object.keys(SKILLS).filter(id => SKILLS[id].cls === p.cls && learned(id));
  if (!p.loadoutInit) { order.filter(id => SKILLS[id].type !== 'passive').forEach(id => { if (L.act.length < ACTIVE_SLOTS && !L.act.includes(id)) L.act.push(id); }); order.filter(id => SKILLS[id].type === 'passive').forEach(id => { if (L.pas.length < PASSIVE_SLOTS() && !L.pas.includes(id)) L.pas.push(id); }); p.loadoutInit = true; }
  return L;
}
function hotbarSkills() { return ensureLoadout().act.slice(); }
function isEquipped(id) { const L = ensureLoadout(); return L.act.includes(id) || L.pas.includes(id); }
function toggleEquip(id) {
  const L = ensureLoadout(), S = SKILLS[id], list = S.type === 'passive' ? L.pas : L.act, max = S.type === 'passive' ? PASSIVE_SLOTS() : ACTIVE_SLOTS;
  if (!(G.prof.skills[id] > 0)) return;
  const i = list.indexOf(id); if (i >= 0) { list.splice(i, 1); Snd.play('click'); }
  else { if (list.length >= max) { toast(`Все слоты заняты (${max}). Снимите другое умение.`, 'warn'); Snd.play('error'); return; } list.push(id); Snd.play('click'); if (S.type === 'form' && G.P.form) setForm(null, true); }
  recalc(); UI.dirty = true;
}
function learnSkill(id) {
  const p = G.prof, s = SKILLS[id]; if (s.cls !== p.cls) return; const r = p.skills[id] || 0;
  if (r >= 3) return toast('Максимальный ранг', 'warn'); if (p.sp < 1) return toast('Нет очков умений', 'warn'); if (p.lvl < s.req) return toast(`Нужен уровень ${s.req}`, 'warn');
  if (s.tier >= 2) { const prev = Object.keys(SKILLS).find(k => SKILLS[k].cls === p.cls && SKILLS[k].branch === s.branch && SKILLS[k].tier === s.tier - 1); if (!(p.skills[prev] > 0)) return toast('Сначала изучите умение предыдущего яруса этой ветки', 'warn'); }
  p.sp--; p.skills[id] = r + 1; Snd.play('levelup'); logMsg(`Изучено: ${s.icon} ${s.name} (ранг ${r + 1})`, 'good');
  if (!r) { const L = ensureLoadout(), list = s.type === 'passive' ? L.pas : L.act, max = s.type === 'passive' ? PASSIVE_SLOTS() : ACTIVE_SLOTS; if (list.length < max) { list.push(id); toast(`${s.icon} ${s.name} — поставлено в слот`, 'good'); } else toast(`${s.icon} ${s.name} изучено. Слоты полны — назначьте вручную (K)`, 'good'); }
  recalc(); UI.dirty = true;
}
function respecSkills() {
  const p = G.prof; let total = 0; for (const id in p.skills) total += p.skills[id]; const start = Object.keys(SKILLS).filter(k => SKILLS[k].cls === p.cls && SKILLS[k].start).length;
  p.skills = {}; for (const id in SKILLS) if (SKILLS[id].cls === p.cls && SKILLS[id].start) p.skills[id] = 1;
  p.sp += total - start; p.loadout = null; p.loadoutInit = false; if (G.P.form) setForm(null, true); ensureLoadout(); recalc(); UI.dirty = true;
}

/* ---- новые умения ---- */
Object.assign(CAST, {
  leap(P, v) { const pt = aimPt(260), ang = Math.atan2(pt.y - P.y, pt.x - P.x), dist = Math.min(260, Math.hypot(pt.x - P.x, pt.y - P.y)); P.dash = { t: 0, dur: 0.38, dist, ang, hitMult: 0, hit: new Set(), color: '#fc8', onEnd: () => { const x = P.x, y = P.y; explode(x, y, 110, v / 100, { color: '#c96', shake: 9, dmgOpts: { kb: 40, stun: 0.8 } }); fxCracks(x, y, 100); fxDust(x, y, 16); fxDebris(x, y, 14); punch(0.05); hitstop(0.07); } }; P.invuln = G.t + 0.4; Snd.play('roar'); aimDir(P); fxCircle(P.x, P.y, 26, '#ffb060', 0.4); return true; },
  laststand(P, v) { P.shield = P.maxHp * v / 100; P.shieldUntil = G.t + 6; addBuff('laststand', 'Последний рубеж', '🛡️', { dr: 0.3 }, 6); ringFx(P.x, P.y, '#8cf', 80, 0.6); fxCircle(P.x, P.y, 50, '#8cf', 0.8); Snd.play('roar'); fxPillar(P.x, P.y, 'rgba(120,180,255,0.8)', 0.8, 120); return true; },
  firerain(P, v) { const pt = aimPt(380); G.areas.push({ type: 'rain', x: pt.x, y: pt.y, r: 110, until: G.t + 3, tick: 0, mult: v / 100, el: 'fire', col: '#f84' }); fxCircle(pt.x, pt.y, 110, '#f84', 3); startAnim('cast', 0.5, 0.5, () => { }); aimDir(P); Snd.play('fire'); return true; },
  frostarmor(P, v) { P.shield = P.maxHp * v / 100; P.shieldUntil = G.t + 8; P.frostUntil = G.t + 8; fxCircle(P.x, P.y, 44, '#9df', 0.8); explodeFx(P.x, P.y, 50, 'ice'); Snd.play('ice'); return true; },
  bladedance(P, v) {
    const list = enemies().filter(m => Math.hypot(m.x - P.x, m.y - P.y) < 240).sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(b.x - P.x, b.y - P.y)); if (!list.length) { toast('Нет целей рядом', 'warn'); return false; }
    P.invuln = G.t + 0.95; Snd.play('whoosh');
    for (let i = 0; i < 5; i++) later(i * 0.14, () => { if (G.P.dead) return; const m = list[i % list.length]; if (m.dead) return; fxGhost(P, 0.5, 0.25); burst(P.x, P.y - 12, '#402060', 8, 50); const a = rand(0, TAU); P.x = m.x + Math.cos(a) * 26; P.y = m.y + Math.sin(a) * 8; if (blockedPx(P.x, P.y, false)) { P.x = m.x - 22; P.y = m.y; } P.aim = Math.atan2(m.y - P.y, m.x - P.x); aimDir(P); startAnim('stab', 0.14, 0.4, () => { }); fxCross(m.x, m.y - 14, P.aim, 30, '#d8a0ff', '#fff'); const h = calcHit(v / 100, { critBonus: 0.3 }); damageMon(m, h.d, { crit: h.crit, melee: true, back: true }); Snd.play('swing'); });
    return true;
  },
  flashbomb(P, v) { fxFlash('#ffffff', 0.7, 0.3); explodeFx(P.x, P.y, 130, 'arcane'); ringFx(P.x, P.y, '#fff', 130, 0.4); Snd.play('boom'); for (const m of enemies()) if (Math.hypot(m.x - P.x, m.y - P.y) < 130 + mRad(m)) { m.stun = Math.max(m.stun, G.t + v); floatText(m.x, m.y - 40, '💫', '#ff8', 'big'); } P.stealth = G.t + 2; return true; },
  wrath(P, v) { const c = aimPt(360); for (let i = 0; i < 4; i++) later(i * 0.4, () => { const x = c.x + rand(-70, 70), y = c.y + rand(-50, 50); fxPillar(x, y, 'rgba(255,255,160,0.9)', 0.3, 260); lightning([{ x: x + rand(-20, 20), y: y - 260 }, { x, y }]); explode(x, y, 70, v / 100, { color: '#ffef7a', snd: 'zap', shake: 4 }); }); startAnim('cast', 0.5, 0.5, () => { }); aimDir(P); fxCircle(c.x, c.y, 90, '#ff8', 1.8); Snd.play('cast'); return true; },
  thorns(P, v) { P.thornsUntil = G.t + 10; P.thornsPct = v / 100; addBuff('thorns', 'Шипастая кожа', '🌵', {}, 10); fxLeaves(P.x, P.y - 14, 18, 60); ringFx(P.x, P.y, '#5c5', 60, 0.5); Snd.play('cast'); return true; },
  snipe(P, v) { startAnim('shoot', 0.7, 0.75, () => { const a = P.aim; fireProj({ x: P.x + Math.cos(a) * 14, y: P.y - 16, ang: a, speed: 1100, r: 6, mult: v / 100, color: '#fff', arrow: true, life: 0.8, pierce: true, hitOpts: { critBonus: 0.3 }, big: true }); fxStreak(P.x + Math.cos(a) * 14, P.y - 16, a, 500, '#fff', 0.25, 4); Snd.play('bow'); shake(3, 0.12); }); aimDir(P); fxCircle(P.x, P.y, 26, '#ffe', 0.7); return true; },
  arrowrain(P, v) { const pt = aimPt(420); G.areas.push({ type: 'rain', x: pt.x, y: pt.y, r: 100, until: G.t + 3, tick: 0, mult: v / 100, el: 'arrow', col: '#e8d8a0' }); fxCircle(pt.x, pt.y, 100, '#e8d8a0', 3); startAnim('shoot', 0.4, 0.5, () => { }); aimDir(P); Snd.play('bow'); return true; }
});
function fxPillar(x, y, col, life = 0.5, h = 200, w = 30) { G.fx.push({ type: 'pillar', x, y, col, life, h, w, t: 0, add: true }); }

/* зоны-ливни: огонь и стрелы падают с неба */
const _updateAreasBase = updateAreas;
updateAreas = function (dt) {
  _updateAreasBase(dt);
  for (let i = G.areas.length - 1; i >= 0; i--) {
    const a = G.areas[i]; if (a.type !== 'rain') continue; if (G.t > a.until) { G.areas.splice(i, 1); continue; }
    a.tick -= dt; if (a.tick > 0) continue; a.tick = 0.14;
    const ang = rand(0, TAU), rr = Math.sqrt(Math.random()) * a.r, x = a.x + Math.cos(ang) * rr, y = a.y + Math.sin(ang) * rr * 0.65;
    if (a.el === 'fire') { G.fx.push({ type: 'streak', x: x - 20, y: y - 240, ang: Math.atan2(240, 20), len: 250, col: '#ff8a2a', w: 5, t: 0, life: 0.18, add: true }); later(0.16, () => { explodeFx(x, y, 34, 'fire'); for (const m of enemies()) if (Math.hypot(m.x - x, m.y - y) < 42 + mRad(m)) { const h = calcHit(a.mult); damageMon(m, h.d, { crit: h.crit, burn: { dps: G.S.dmg * 0.2, t: 2 } }); } Snd.play('fire'); }); }
    else { G.fx.push({ type: 'streak', x: x + 6, y: y - 200, ang: Math.atan2(200, -6), len: 60, col: '#fff', w: 2, t: 0, life: 0.14, add: true }); later(0.12, () => { burst(x, y, '#e8d8a0', 4, 40); for (const m of enemies()) if (Math.hypot(m.x - x, m.y - y) < 26 + mRad(m)) { const h = calcHit(a.mult); damageMon(m, h.d, { crit: h.crit, proj: true }); } }); }
  }
};

/* ---------- Визуальные эффекты существующих умений (обёртки над логикой) ---------- */
const SKILL_FX = {
  charge(P, v, o) { for (let i = 0; i < 6; i++) later(i * 0.035, () => fxGhost(G.P, 0.5, 0.35)); fxSpeedLines(P.x, P.y - 16, P.aim, 8); fxDust(P.x, P.y, 8); later(0.2, () => { ringFx(G.P.x, G.P.y, '#fc8', 60, 0.35); fxDust(G.P.x, G.P.y, 10); shake(4, 0.15); hitstop(0.04); }); },
  slam(P) { later(0.25, () => { const x = G.P.x, y = G.P.y; fxCracks(x, y, 100); fxDust(x, y, 14); fxDebris(x, y, 14); ringFx(x, y, '#fc8', 95, 0.45); ringFx(x, y, '#fff', 60, 0.3); fxFlare(x, y - 8, '#ffe0a0', 60, 0.25); punch(0.05); hitstop(0.07); }); },
  whirl(P) { for (let i = 0; i < 9; i++) later(i * 0.055, () => { if (G.P.dead) return; const a = i * 1.1; fxCrescent(G.P.x, G.P.y - 12, a, 86, 2.0, '#fff2c0', '#ff6a30', 0.2, 0.5); if (i % 2 === 0) spark(G.P.x + Math.cos(a) * 60, G.P.y - 12 + Math.sin(a) * 40, a, '#ffd', 3, 120); }); fxCircle(P.x, P.y, 60, '#f84', 0.6); fxDust(P.x, P.y, 8); },
  warcry(P) { fxPillar(P.x, P.y, 'rgba(255,60,30,0.85)', 0.9, 160, 46); fxCircle(P.x, P.y, 70, '#f44', 0.9); ringFx(P.x, P.y, '#f66', 120, 0.7); for (let i = 0; i < 22; i++) P_({ x: P.x + rand(-24, 24), y: P.y - rand(0, 10), vx: rand(-15, 15), vy: rand(-110, -40), life: rand(0.5, 1), color: pick(['#ff5a2a', '#ffb040', '#ff2a2a']), size: rand(2, 5), shape: 'circle', add: true }); fxFlash('#ff3010', 0.18, 0.3); },
  fireball(P) { fxCircle(P.x, P.y, 28, '#f84', 0.5); later(0.17, () => fxFlare(G.P.x + Math.cos(G.P.aim) * 18, G.P.y - 20, '#ffcf70', 40, 0.2)); },
  meteor(P) { const pt = aimPt(420); fxCircle(pt.x, pt.y, 100, '#f60', 1.05); fxCircle(P.x, P.y, 30, '#f84', 0.6); later(1.0, () => { explodeFx(pt.x, pt.y, 130, 'fire'); fxCracks(pt.x, pt.y, 120, 6); fxDebris(pt.x, pt.y, 16, '#5a4a3a', 240); fxFlash('#ffb060', 0.5, 0.35); punch(0.07); hitstop(0.1); for (let i = 0; i < 3; i++) ringFx(pt.x, pt.y, ['#ffd', '#fa4', '#f62'][i], 90 + i * 40, 0.5 + i * 0.1); fxPillar(pt.x, pt.y, 'rgba(255,170,60,0.9)', 0.6, 280, 70); }); },
  frostnova(P) { fxCircle(P.x, P.y, 60, '#9df', 0.7); later(0.17, () => { explodeFx(G.P.x, G.P.y, 130, 'ice'); ringFx(G.P.x, G.P.y, '#cef', 130, 0.5); fxFlash('#9cf', 0.15, 0.25); }); },
  chain(P) { fxCircle(P.x, P.y, 24, '#ff8', 0.4); },
  blink(P, v, o) { const ox = o.ox, oy = o.oy; fxGhost({ x: ox, y: oy, dir: P.dir, flip: P.flip, form: P.form, t0: P.t0, moving: false, anim: null }, 0.55, 0.4); fxStreak(ox, oy - 14, Math.atan2(P.y - oy, P.x - ox), Math.hypot(P.x - ox, P.y - oy), '#e0b0ff', 0.28, 6); fxFlare(ox, oy - 14, '#e8c8ff', 40, 0.25); fxFlare(P.x, P.y - 14, '#e8c8ff', 46, 0.28); ringFx(P.x, P.y, '#c8f', 46, 0.3); },
  shadowstep(P, v, o) { fxGhost({ x: o.ox, y: o.oy, dir: P.dir, flip: P.flip, form: P.form, t0: P.t0, moving: false, anim: null }, 0.6, 0.4); fxSmoke(o.ox, o.oy - 10, 8, '#302040', 18, 0.9, 20); fxSmoke(P.x, P.y - 10, 8, '#302040', 18, 0.9, 20); fxStreak(o.ox, o.oy - 14, Math.atan2(P.y - o.oy, P.x - o.ox), Math.hypot(P.x - o.ox, P.y - o.oy), '#b070ff', 0.25, 5); },
  fan(P) { fxCircle(P.x, P.y, 22, '#dcf', 0.35); },
  venom(P) { fxCircle(P.x, P.y, 34, '#8f4', 0.7); for (let i = 0; i < 12; i++) P_({ x: P.x + rand(-14, 14), y: P.y - rand(0, 24), vx: 0, vy: rand(-40, -10), life: rand(0.6, 1), color: '#8f4', size: rand(3, 5), shape: 'circle', add: true }); },
  smoke(P) { fxSmoke(P.x, P.y - 12, 16, '#9a9a9a', 28, 3.2, 55); ringFx(P.x, P.y, '#bbb', 70, 0.5); },
  vines(P) { const pt = aimPt(340); fxCircle(pt.x, pt.y, 74, '#5c5', 0.9); fxLeaves(pt.x, pt.y - 10, 14, 60); fxCracks(pt.x, pt.y, 70, 2); },
  regrowth(P) { fxCircle(P.x, P.y, 38, '#6f6', 1.0); fxPillar(P.x, P.y, 'rgba(120,255,140,0.7)', 0.9, 130, 34); fxLeaves(P.x, P.y - 14, 14, 40); },
  volley(P) { fxCircle(P.x, P.y, 24, '#e8d8a0', 0.35); },
  trap(P) { burst(P.x, P.y, '#aaa', 8, 40); ringFx(P.x, P.y, '#aaa', 30, 0.3); },
  call(P) { const pe = G.petEnt; if (pe) { fxCircle(pe.x, pe.y, 40, '#fd6', 0.8); fxPillar(pe.x, pe.y, 'rgba(255,220,100,0.8)', 0.8, 110, 30); } fxFlash('#ffe080', 0.12, 0.25); }
};
for (const k in SKILL_FX) {
  const base = CAST[k]; if (!base) continue;
  CAST[k] = function (P, v) { const o = { ox: P.x, oy: P.y }; const r = base(P, v); if (r !== false) { try { SKILL_FX[k](P, v, o); } catch (e) { console.error(e); } } return r; };
}
/* аура и следы от баффов */
function auraFx(dt) {
  const P = G.P; if (!P || P.dead) return; G.auraT = (G.auraT || 0) - dt; if (G.auraT > 0) return; G.auraT = 0.07;
  const has = id => P.buffs.some(b => b.id === id), x = P.x, y = P.y;
  if (has('warcry') || has('bloodrage')) P_({ x: x + rand(-10, 10), y: y - rand(2, 18), vx: rand(-8, 8), vy: rand(-70, -30), life: rand(0.4, 0.8), color: pick(['#ff5a2a', '#ffb040']), size: rand(2, 4), shape: 'circle', add: true });
  if (has('stoneskin')) P_({ x: x + rand(-12, 12), y: y - rand(2, 26), vx: 0, vy: 20, life: 0.5, color: '#aaa', size: rand(2, 4), g: 100 });
  if (has('moonstep') && P.moving) fxGhost(P, 0.35, 0.3);
  if (has('slip') && P.moving) fxSmoke(x, y - 8, 1, '#ccc', 10, 0.6, 6);
  if (P.venomUntil > G.t) P_({ x: x + (P.flip ? -10 : 10) + rand(-3, 3), y: y - 12 + rand(-4, 10), vx: 0, vy: 20, life: 0.5, color: '#8f4', size: 3, shape: 'circle', add: true, g: 60 });
  if (P.frostUntil > G.t) P_({ x: x + rand(-14, 14), y: y - rand(0, 28), vx: 0, vy: rand(-10, 10), life: 0.6, color: '#bef', size: rand(3, 5), shape: 'diamond', add: true });
  if (P.thornsUntil > G.t) { if (Math.random() < 0.4) fxLeaves(x, y - 14, 1, 20, ['#3f9a4a', '#8a6a3a']); }
  if (P.hot) { fxLeaves(x, y - 10, 1, 20); P_({ x: x + rand(-10, 10), y: y - rand(0, 24), vx: 0, vy: rand(-40, -15), life: 0.7, color: '#8f8', size: 3, shape: 'circle', add: true }); }
  if (P.shield > 0) P_({ x: x + rand(-13, 13), y: y - rand(0, 30), vx: 0, vy: -15, life: 0.35, color: '#8cf', size: 2.5, shape: 'circle', add: true });
  if (P.dash) fxGhost(P, 0.4, 0.28);
  if (P.stealth > G.t && Math.random() < 0.3) fxSmoke(x, y - 10, 1, '#889', 8, 0.5, 8);
}

'use strict';
/* ===== Пиксельные персонажи, монстры и питомцы (рисуются кодом) ===== */
const OUT = '#1a1410';
const METAL = ['#a8a8a8', '#d8dee6', '#f0c850', '#c090ff', '#ff9a3a'];
const ARMOR_COL = ['#8a6a4a', '#aab2bc', '#e0b84a', '#a070e0', '#ff9a3a'];

const STYLES = {
  berserk: { top: 'skin', bottom: '#5a4030', boots: '#3a2a1a', extra: 'straps' },
  mage: { top: 'accent', bottom: 'accent', robe: true, boots: '#3a2a4a', hat: 'wizard', trim: '#e8c860' },
  assassin: { top: '#2a2a34', bottom: '#1e1e26', boots: '#15151a', hat: 'hood', hatCol: '#1e1e26', mask: true, scarf: 'accent' },
  druid: { top: '#4a7a3a', bottom: '#6a4a2a', boots: '#5a3a1a', hat: 'wreath', extra: 'leaf' },
  hunter: { top: '#6a7a3a', bottom: '#5a4a2a', boots: '#3a2a1a', hat: 'feathercap', hatCol: '#4a5a2a', extra: 'quiver' },
  mayor: { top: '#5b2f8a', bottom: '#3a2a5a', boots: '#2a1a1a', hat: 'crown', extra: 'chain', robe: true, trim: '#e8c860' },
  smith: { top: '#8a6a4a', bottom: '#4a3a2a', boots: '#2a1a1a', extra: 'apron', apron: '#3a2a20' },
  tailor: { top: 'accent', bottom: '#5a3a5a', boots: '#3a2a2a', robe: true, extra: 'apron', apron: '#e8d8b8' },
  alch: { top: '#2e7d4f', bottom: '#2a4a3a', boots: '#3a2a1a', robe: true, hat: 'goggles' },
  jewel: { top: '#6a3fa0', bottom: '#6a3fa0', boots: '#3a2a4a', robe: true, trim: '#e8c860', extra: 'chain' },
  beast: { top: '#5a6a30', bottom: '#4a3a20', boots: '#2a1a1a', extra: 'fur' },
  inn: { top: '#d8c8a8', bottom: '#8a4a2a', boots: '#3a2a1a', robe: true, extra: 'apron', apron: '#f0e8d0' },
  guard: { top: '#8a94a4', bottom: '#3a4a6a', boots: '#2a2a2a', hat: 'helm', hatCol: '#a8b0bc', extra: 'tabard', trim: '#3a5a9a' },
  bard: { top: '#c9902a', bottom: '#4a2a5a', boots: '#3a2a1a', hat: 'feathercap', hatCol: '#a83a3a', extra: 'lute' },
  arena: { top: '#8a2a2a', bottom: '#3a2a2a', boots: '#2a1a1a', extra: 'spikes' },
  priest: { top: '#efe8d8', bottom: '#efe8d8', boots: '#8a7a5a', robe: true, trim: '#e8c860', hat: 'hood', hatCol: '#efe8d8' },
  kid: { top: '#b06a3a', bottom: '#5a4a3a', boots: '#3a2a1a', hat: 'cap', hatCol: '#5a7a3a' },
  farmer: { top: '#8a7a4a', bottom: '#4a4a6a', boots: '#3a2a1a', hat: 'straw' },
  elder: { top: '#6a5a3a', bottom: '#4a3a2a', boots: '#2a1a1a', robe: true, trim: '#c9a24a' },
  ranger: { top: '#3a6a3a', bottom: '#4a3a2a', boots: '#2a1a1a', hat: 'hood', hatCol: '#3a5a2a' },
  archmage: { top: '#3a3f9a', bottom: '#3a3f9a', boots: '#2a2a4a', robe: true, trim: '#e8c860', hat: 'wizard', hatCol: '#3a3f9a' },
  trader: { top: '#c9902a', bottom: '#8a4a2a', boots: '#3a2a1a', robe: true, hat: 'turban', hatCol: '#e8d8b8' },
  villager: { top: '#8a7a5a', bottom: '#4a3a2a', boots: '#2a1a1a' }
};
/* Облики монстров-гуманоидов */
const MSTYLES = {
  bandit: { top: '#6a4a30', bottom: '#3a2a20', boots: '#2a1a10', hat: 'bandana', hatCol: '#a83a3a', wp: 'sword' },
  archer: { top: '#3d5a3a', bottom: '#3a3020', boots: '#2a1a10', hat: 'hood', hatCol: '#2d4a2d', wp: 'bow' },
  goblin: { top: '#5a4a2a', bottom: '#3a3020', boots: '#2a1a10', ears: true, wp: 'club', },
  troll: { top: '#5a5a4a', bottom: '#4a4030', boots: '#3a3020', ears: false, wp: 'club', bulky: true },
  cultist: { top: '#7a1e1e', bottom: '#5a1414', boots: '#2a1010', robe: true, hat: 'hood', hatCol: '#5a1414', wp: 'staff', fire: true },
  horak: { top: '#5a4a3a', bottom: '#3a3020', boots: '#2a2010', hat: 'crown', hatCol: '#8a8a8a', wp: 'club', bulky: true, horns: true },
  malgrath: { top: '#3a0f0f', bottom: '#2a0808', boots: '#1a0505', robe: true, hat: 'horns', hatCol: '#1a1010', wp: 'staff', fire: true },
  skeleton: { top: '#d8d0b8', bottom: '#c8c0a8', boots: '#b8b098', skeleton: true, wp: 'sword' },
  lichking: { top: '#3a2a5a', bottom: '#3a2a5a', boots: '#2a1a4a', robe: true, skeleton: true, hat: 'crown', hatCol: '#8a8a8a', wp: 'staff', fire: true },
  frostgiant: { top: '#6a8ab0', bottom: '#4a6a90', boots: '#3a4a60', bulky: true, hat: 'horns', hatCol: '#8ab', wp: 'club' },
  witch: { top: '#3a4a2a', bottom: '#2a3a20', boots: '#1a2a10', robe: true, hat: 'wizard', hatCol: '#2a3a20', wp: 'staff' },
  skar: { top: '#5a2a20', bottom: '#3a2a20', boots: '#2a1a10', hat: 'bandana', hatCol: '#222', bulky: true, wp: 'sword' },
  skmage: { top: '#3a2a5a', bottom: '#3a2a5a', boots: '#2a1a4a', robe: true, skeleton: true, hat: 'hood', hatCol: '#3a2a5a', wp: 'staff' }
};

function drawWeaponShape(ctx, wt, tier, glow, t, ex) {
  const m = METAL[Math.min(tier, 4)] || '#aaa', wood = '#6a4a2a', dk = '#3a3a44';
  const R = (x, y, w, h, c) => { ctx.fillStyle = OUT; ctx.fillRect(x - 0.6, y - 0.6, w + 1.2, h + 1.2); ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  switch (wt) {
    case 'axe': R(-0.5, -10, 1, 11, wood); R(0.5, -10, 4, 5, m); R(3.5, -9.5, 1.2, 4, '#fff'); R(-2.5, -9, 2, 2, dk); R(-0.5, -1, 1, 2, '#3a2a1a'); break;
    case 'staff': R(-0.5, -13, 1, 15, wood); ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(0, -14.6, 2.7, 0, TAU); ctx.fill(); ctx.fillStyle = m; ctx.beginPath(); ctx.arc(0, -14.6, 2, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(-0.9, -15.5, 0.9, 0.9);
      if (glow) { const ch = (ex && ex.charge) || 0; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = m; ctx.globalAlpha = 0.35 + 0.15 * Math.sin((t || 0) * 8) + ch * 0.3; ctx.beginPath(); ctx.arc(0, -14.6, 4.5 + ch * 5, 0, TAU); ctx.fill(); ctx.globalAlpha = 0.5 * ch; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -14.6, 2 + ch * 2, 0, TAU); ctx.fill(); ctx.restore(); } break;
    case 'dagger': R(-0.5, -6.5, 1, 6, m); R(-1.8, -1.2, 3.6, 1, '#8a6a3a'); R(-0.5, -0.4, 1, 2, '#3a2a1a'); break;
    case 'sickle': R(-0.5, -9, 1, 10, wood); R(0.4, -10.5, 3, 1.4, m); R(2.6, -9.4, 1.2, 2.4, m); R(0.6, -8.7, 1.2, 1, m); break;
    case 'bow': { const pull = (ex && ex.pull) || 0; if (pull > 0) { ctx.strokeStyle = '#e8e0c0'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(0.4, -8.4); ctx.lineTo(0.4 - pull * 3.6, -0.4); ctx.lineTo(0.4, 5.2); ctx.stroke(); if (ex.arrow) { R(0.4 - pull * 3.6, -1, 9 + pull * 3.6, 1, '#d8c8a0'); R(9.4, -1.6, 2.2, 2.2, '#dfe6ee'); R(-pull * 3.6 - 0.4, -1.8, 1.6, 2.6, '#c8402a'); } } else R(0.5, -5, 0.8, 9, '#c8c0a0'); } R(-1.5, -8.5, 1.4, 2, wood); R(-2.4, -6.7, 1.4, 3.2, wood); R(-2.6, -3.7, 1.6, 4, wood); R(-2.4, -0.2, 1.4, 3.2, wood); R(-1.5, 2.2, 1.4, 2, wood); ctx.fillStyle = m; ctx.fillRect(-2.6, -3.5, 1.2, 1); break;
    case 'sword': R(-0.5, -9, 1.2, 9, '#c8ccd4'); R(-2, -0.8, 4, 1, '#6a4a2a'); R(-0.4, 0, 1, 2, '#3a2a1a'); break;
    case 'club': R(-0.8, -9, 1.6, 10, '#5a3a20'); R(-2, -11, 4, 4, '#6a4a2a'); R(-2.6, -10, 1, 1, '#aaa'); R(1.6, -9, 1, 1, '#aaa'); break;
  }
}

/* Основная функция: человекоподобный персонаж (игрок, NPC, гуманоидные монстры) */
function drawHuman(ctx, o) {
  const race = RACES[o.race] || RACES.human, look = o.look || { skin: 0, hairStyle: 0, hair: 0, eye: 0, accent: 0, face: 0 };
  const ms = o.mon ? MSTYLES[o.mon] : null;
  const S = ms || STYLES[o.style || o.cls] || STYLES.villager;
  const cu = o.custom || {};
  const flash = o.hurt > 0;
  const F = c => flash ? '#ffffff' : c;
  const accent = LOOK.accents[look.accent % 8];
  const skin = F(cu.skin || race.skins[look.skin % race.skins.length]);
  const hairC = F(cu.hair || LOOK.hairColors[look.hair % 8]);
  const eyeC = LOOK.eyes[look.eye % 6];
  const t = o.t || 0, moving = !!o.moving;
  const stride = moving ? Math.sin(t * 11) : 0;
  const bob = moving ? -Math.abs(Math.sin(t * 11)) * 0.9 : Math.sin(t * 2.2) * 0.4;
  const fem = o.gender === 'female';
  const bulky = S.bulky, view = o.dir || 'down';
  const sc = (race.scale || 1) * (o.scale || 1) * (o.small ? 0.8 : 1) * (S.small || 1) * (bulky ? 1.15 : 1) * (o.sizeMul || 1);
  const armor = o.armor || {};
  const topBase = S.top === 'skin' ? skin : S.top === 'accent' ? accent : S.top;
  let top = topBase, bottom = S.bottom === 'accent' ? accent : S.bottom, boots = S.boots, trim = S.trim || '#e8c860';
  if (o.cls === 'mage' && !S.hatCol) { /* цвет колпака = акцент */ }
  if (armor.body >= 0 && o.player) { top = S.robe ? top : mix(top === skin ? '#7a5a3a' : top, ARMOR_COL[armor.body], 0.55); trim = ARMOR_COL[Math.max(0, armor.body)]; }
  if (armor.boots >= 0 && o.player) boots = mix(boots, ARMOR_COL[armor.boots], 0.5);
  top = F(top); bottom = F(bottom); boots = F(boots);
  const wide = (race.wide || 0) * 0.5 + (bulky ? 1 : 0);
  const legY = (v) => v > 0.35 ? -1 : 0;
  const lL = legY(stride), lR = legY(-stride);
  const atk = o.atk, atkP = atk ? atk.p : -1;
  const castUp = atk && (atk.kind === 'cast') && atkP >= 0;
  const P = [], D = []; // части с обводкой / детали без обводки
  const pp = (x, y, w, h, c) => P.push([x, y, w, h, c]);
  const dd = (x, y, w, h, c) => D.push([x, y, w, h, c]);

  ctx.save();
  if (o.alpha !== undefined && o.alpha < 1) ctx.globalAlpha = o.alpha;
  const flip = o.flip ? -1 : 1;
  ctx.translate(Math.round(o.x), Math.round(o.y));
  // тень
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(0, 1, 8 * sc + (bulky ? 3 : 0), 3 * sc, 0, 0, TAU); ctx.fill();
  if (o.dead > 0) { ctx.rotate(Math.min(1, o.dead) * 1.45 * flip); ctx.translate(0, -o.dead * 4); ctx.globalAlpha = (o.alpha === undefined ? 1 : o.alpha) * (1 - Math.max(0, o.dead - 0.6) / 0.4); }
  ctx.scale(2 * sc * flip, 2 * sc);
  if (o.aura) { ctx.globalAlpha *= 0.6; ctx.fillStyle = o.aura; ctx.beginPath(); ctx.ellipse(0, -8, 9, 11, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha; }
  let lunge = 0, lean = 0, squash = 0, sx = 1;
  if (atk && atkP >= 0) {
    const k = atk.kind, ez = q => 1 - (1 - q) * (1 - q);
    if (k === 'slash') { if (atkP < 0.3) { const q = atkP / 0.3; lean = -0.18 * q; lunge = -1.3 * q; squash = 0.07 * q; } else if (atkP < 0.6) { const q = ez((atkP - 0.3) / 0.3); lean = lerp(-0.18, 0.3, q); lunge = lerp(-1.3, 2.8, q); squash = lerp(0.07, -0.06, q); } else { const q = (atkP - 0.6) / 0.4; lean = lerp(0.3, 0, q); lunge = lerp(2.8, 0, q); } }
    else if (k === 'stab') { const ph = (atkP * 2) % 1, th = Math.sin(ph * Math.PI); lean = 0.14 * th; lunge = 2.6 * th; squash = -0.04 * th; }
    else if (k === 'shoot') { if (atkP < 0.5) { const q = atkP / 0.5; lean = -0.05 * q; lunge = -0.8 * q; } else { const q = Math.min(1, (atkP - 0.5) * 3); lean = -0.1 * (1 - q); lunge = -1.6 * (1 - q); } }
    else if (k === 'cast') { const q = Math.sin(Math.min(1, atkP) * Math.PI); lean = -0.05 * q; squash = -0.06 * q; lunge = -0.5 * q; }
    else if (k === 'spin') { sx = 0.35 + 0.65 * Math.abs(Math.cos(atkP * Math.PI * 5)); squash = 0.03; }
  }
  if (o.dashLean) lean = 0.4;
  ctx.translate(lunge, 0); if (lean) ctx.rotate(lean); if (squash || sx !== 1) ctx.scale(sx * (1 - squash * 0.4), 1 + squash);

  const bodyY = bob, robe = S.robe;
  const skinD = mix(skin, '#000000', 0.15);
  /* ---------- вид сбоку ---------- */
  if (view === 'side') {
    // задняя рука, ноги
    pp(-1.5, -9.5 + bodyY, 2, 5, mix(top, '#000', 0.25));
    if (!robe) {
      pp(-2 + stride * 1.6, -5 + lL, 2, 5 - lL, bottom); pp(0.2 - stride * 1.6, -5 + lR, 2, 5 - lR, bottom);
      pp(-2 + stride * 1.6, -2 + lL, 2.6, 2 - lL, boots); pp(0.2 - stride * 1.6, -2 + lR, 2.6, 2 - lR, boots);
    } else { pp(-1 + stride, -2, 2.4, 2, boots); pp(1 - stride, -2, 2.4, 2, boots); }
    // плащ / колчан за спиной
    if (S.extra === 'quiver') { pp(-4.4, -11 + bodyY, 2, 6, '#6a4a2a'); dd(-4, -12.5 + bodyY, 1, 2, '#e8d8a0'); dd(-3, -12 + bodyY, 1, 2, '#c84a3a'); }
    if (S.scarf) pp(-4.5, -10 + bodyY, 2, 1.5, F(accent));
    // торс
    if (robe) { pp(-2.8 - wide / 2, -10 + bodyY, 5.6 + wide, 9.5 - bodyY * 0, top); dd(-2.8, -6 + bodyY, 5.6, 1, F(trim)); dd(-2.8, -1.6, 5.6, 1, F(trim)); }
    else { pp(-2.5 - wide / 2, -10 + bodyY, 5 + wide, 5, top); pp(-2.5 - wide / 2, -6 + bodyY, 5 + wide, 1, F(mix(bottom, '#000', 0.2))); }
    if (S.extra === 'apron') dd(-0.5, -9 + bodyY, 3.5, 7, F(S.apron));
    if (S.extra === 'tabard') dd(-0.5, -10 + bodyY, 3, 8, F(S.trim));
    if (S.extra === 'straps') { dd(-2.5, -10 + bodyY, 1, 5, '#4a3020'); dd(-0.5, -6 + bodyY, 3, 1, '#4a3020'); }
    if (S.extra === 'fur' || (o.cls === 'berserk')) pp(-3 - wide / 2, -10.6 + bodyY, 3.6, 2, F('#8a7a6a'));
    if (armor.body >= 1 && o.player) pp(-3, -10.6 + bodyY, 3.6, 2, F(ARMOR_COL[armor.body]));
    // голова
    const hy = -17 + bodyY;
    pp(-3.5, hy, 7, 7, skin);
    if (race === RACES.orc || cu.jaw) pp(-3.5, hy + 5, 8, 2, skin);
    dd(1.8, hy + 3, 1.2, 1.4, F(eyeC)); dd(2.8, hy + 2.4, 0.7, 0.7, '#fff');
    dd(3.5, hy + 4, 1, 1, skinD); dd(2, hy + 6, 1.8, 0.7, '#8a3a3a');
    if (fem) dd(1.2, hy + 2.4, 1.2, 0.5, '#111');
    // волосы
    drawHairSide(pp, dd, look, hairC, hy, fem, S, o);
    // раса
    if (race === RACES.elf) { pp(-4.6, hy + 1.5, 2.2, 1.2, skin); dd(-5.6, hy + 0.6, 1.4, 1, skin); }
    if (race === RACES.orc) { dd(2.6, hy + 5, 0.8, 1.4, '#f4f0d8'); pp(-3.6, hy + 2, 1.2, 1.5, skin); }
    if (race === RACES.dwarf || look.face === 4 && !fem) pp(0, hy + 4.5, 4, 3.6, hairC);
    if (look.face === 1) dd(1.2, hy + 1.2, 0.8, 3, '#b04040'); if (look.face === 2) dd(1.5, hy + 3.4, 2.2, 0.8, F(accent)); if (look.face === 3) { dd(1.5, hy + 4, 0.5, 0.5, '#b0703c'); dd(2.6, hy + 4.4, 0.5, 0.5, '#b0703c'); }
    if (S.ears) { pp(-5.6, hy + 1, 2.4, 1.6, skin); pp(3.4, hy + 1, 2, 1.4, skin); }
    // головной убор
    drawHat(pp, dd, S, o, hy, 'side', accent, F, hairC, armor);
    // передняя рука + оружие
    const ay = -9.5 + bodyY;
    let ang = 0.25, wx = 1.6, wy = ay + 4.2;
    if (atk && atkP >= 0) {
      if (atk.kind === 'slash') { const p = atkP; ang = p < 0.3 ? lerp(0.2, -2.3, p / 0.3) : lerp(-2.3, 1.6, Math.min(1, (p - 0.3) / 0.3)); }
      else if (atk.kind === 'stab') { ang = 1.45; wx += Math.sin(atkP * Math.PI) * 3; }
      else if (atk.kind === 'shoot') { ang = 0; wx = 3; wy = ay + 3; }
      else if (atk.kind === 'cast') { ang = -0.4; wy = ay + 1 - Math.sin(atkP * Math.PI) * 2; wx = 2.4; }
      else if (atk.kind === 'spin') { ang = atkP * TAU * 2; }
    } else if (moving) ang = 0.25 - stride * 0.25;
    pp(0.5 + (castUp ? 1 : 0), ay + (castUp ? -2 : 0), 2, 5, F(mix(top, '#fff', 0.05)));
    dd(0.5, ay + 4.2 + (castUp ? -2 : 0), 2, 1.2, skin);
    P.flush = true;
    flushParts(ctx, P, D);
    if (o.weapon) { const ex = weaponExtra(atk, atkP); const tr = (atk && (atk.kind === 'slash' || atk.kind === 'spin') && atkP > 0.28 && atkP < 0.66) ? 3 : 0; for (let g = tr; g >= 0; g--) { ctx.save(); ctx.translate(wx + 0.8, wy + (castUp ? -2 : 0)); ctx.rotate(ang - g * 0.42 * (atk && atk.kind === 'spin' ? -1 : 1)); if (g) ctx.globalAlpha = 0.34 - g * 0.09; if (o.weapon.wtype === 'bow' && atk && atk.kind === 'shoot') { ctx.translate(2, 0); } drawWeaponShape(ctx, o.weapon.wtype, o.weapon.tier, atk && atk.kind === 'cast', t, ex); ctx.restore(); } }
    else if (ms && ms.wp) { ctx.save(); ctx.translate(wx + 0.8, wy); ctx.rotate(ang); drawWeaponShape(ctx, ms.wp, 0, ms.fire, t); ctx.restore(); }
  } else {
    /* ---------- вид спереди / сзади ---------- */
    const back = view === 'up';
    // оружие за спиной (для вида сзади рисуется поверх)
    // ноги
    if (!robe) {
      pp(-3 - wide / 2, -5 + lL, 2.2, 5 - lL, bottom); pp(0.8 + wide / 2, -5 + lR, 2.2, 5 - lR, bottom);
      pp(-3 - wide / 2, -2 + lL, 2.2, 2 - lL, boots); pp(0.8 + wide / 2, -2 + lR, 2.2, 2 - lR, boots);
    } else { pp(-2.6, -2, 2.4, 2, boots); pp(0.2, -2, 2.4, 2, boots); }
    const tw = (fem ? 5.4 : 6) + wide;
    if (S.extra === 'quiver' && back) { pp(-3, -11 + bodyY, 2, 8, '#6a4a2a'); dd(-2.6, -12.4 + bodyY, 1, 2, '#e8d8a0'); dd(-1.4, -12 + bodyY, 1, 2, '#c84a3a'); }
    if (robe) {
      pp(-tw / 2 - 0.5, -10 + bodyY, tw + 1, 9, top); dd(-tw / 2 - 0.5, -1.7, tw + 1, 1, F(trim)); dd(-tw / 2 - 0.5, -6.5 + bodyY, tw + 1, 1, F(trim));
    } else {
      pp(-tw / 2, -10 + bodyY, tw, 5, top); pp(-tw / 2, -6 + bodyY, tw, 1, F(mix(bottom, '#000', 0.2)));
    }
    if (!back) {
      if (S.extra === 'apron') dd(-2, -9 + bodyY, 4, 8, F(S.apron));
      if (S.extra === 'tabard') dd(-1.5, -10 + bodyY, 3, 9, F(S.trim));
      if (S.extra === 'straps') { dd(-2.4, -10 + bodyY, 1, 5, '#4a3020'); dd(1.4, -10 + bodyY, 1, 5, '#4a3020'); dd(-2.4, -6.5 + bodyY, 5, 1, '#4a3020'); }
      if (S.extra === 'chain') dd(-2, -10 + bodyY, 4, 1, F('#f0d070'));
      if (S.extra === 'spikes') { dd(-3.8, -11 + bodyY, 1, 1.5, '#ddd'); dd(2.8, -11 + bodyY, 1, 1.5, '#ddd'); }
      if (S.extra === 'lute') { dd(1, -8 + bodyY, 3, 3, '#a8702a'); dd(3.6, -10 + bodyY, 0.8, 4, '#6a4a2a'); }
      if (S.extra === 'leaf') { dd(-2, -9 + bodyY, 1.2, 1.2, '#3f9a4a'); dd(0.6, -7.6 + bodyY, 1.2, 1.2, '#3f9a4a'); dd(1.2, -9.4 + bodyY, 1, 1, '#c84a3a'); }
      if (S.scarf) pp(-3, -10.4 + bodyY, 6, 1.5, F(accent));
    } else if (S.scarf) pp(-3, -10.4 + bodyY, 6, 1.5, F(accent));
    if (S.extra === 'fur' || o.cls === 'berserk') { pp(-tw / 2 - 1.4, -10.8 + bodyY, 3, 2, F('#8a7a6a')); pp(tw / 2 - 1.6, -10.8 + bodyY, 3, 2, F('#8a7a6a')); }
    if (armor.body >= 1 && o.player) { pp(-tw / 2 - 1.4, -10.8 + bodyY, 3, 2, F(ARMOR_COL[armor.body])); pp(tw / 2 - 1.6, -10.8 + bodyY, 3, 2, F(ARMOR_COL[armor.body])); }
    // руки
    const ay = -10 + bodyY, rl = castUp ? -3 : 0;
    const armC = F(mix(top, '#000', 0.08)), sleeve = robe ? top : (S.top === 'skin' ? skin : armC);
    const swing = moving ? stride * 1.2 : 0;
    pp(-tw / 2 - 2 - wide / 2, ay + rl - (castUp ? 1 : 0) + (moving ? -swing * 0.4 : 0), 2, 5, sleeve);
    pp(tw / 2 + wide / 2, ay + (moving ? swing * 0.4 : 0) + rl, 2, 5, sleeve);
    dd(-tw / 2 - 2 - wide / 2, ay + 4.2 + rl - (castUp ? 1 : 0), 2, 1.2, skin); dd(tw / 2 + wide / 2, ay + 4.2 + rl, 2, 1.2, skin);
    // голова
    const hy = -17 + bodyY;
    if (back && look.hairStyle !== 4 && look.hairStyle !== 5) { /* волосы позади */ }
    pp(-4, hy, 8, 7, skin);
    if (race === RACES.orc || cu.jaw) pp(-4.5, hy + 5, 9, 2, skin);
    if (race === RACES.elf) { pp(-6.2, hy + 1.5, 2.4, 1.2, skin); pp(3.8, hy + 1.5, 2.4, 1.2, skin); dd(-7, hy + 0.6, 1.4, 1, skin); dd(5.6, hy + 0.6, 1.4, 1, skin); }
    if (S.ears) { pp(-6.4, hy + 1, 2.8, 1.8, skin); pp(3.6, hy + 1, 2.8, 1.8, skin); }
    if (race === RACES.orc) { pp(-4.8, hy + 2, 1.2, 1.5, skin); pp(3.6, hy + 2, 1.2, 1.5, skin); }
    if (!back) {
      dd(-2.4, hy + 3, 1.6, 1.8, F(eyeC)); dd(0.8, hy + 3, 1.6, 1.8, F(eyeC)); dd(-2.4, hy + 3, 0.7, 0.7, '#fff'); dd(0.8, hy + 3, 0.7, 0.7, '#fff');
      if (fem) { dd(-2.6, hy + 2.5, 2, 0.5, '#111'); dd(0.6, hy + 2.5, 2, 0.5, '#111'); } else { dd(-2.6, hy + 2.2, 2, 0.6, mix(hairC, '#000', 0.2)); dd(0.6, hy + 2.2, 2, 0.6, mix(hairC, '#000', 0.2)); }
      dd(-1, hy + 5.6, 2, 0.8, fem ? '#c05a6a' : '#8a3a3a');
      if (race === RACES.orc) { dd(-2, hy + 5, 0.8, 1.6, '#f4f0d8'); dd(1.2, hy + 5, 0.8, 1.6, '#f4f0d8'); }
      if (race === RACES.dwarf || (look.face === 4 && !fem)) { pp(-4, hy + 4.6, 8, 4, hairC); dd(-1, hy + 5.6, 2, 0.7, '#6a2a2a'); }
      if (look.face === 1) dd(1.4, hy + 1, 0.9, 3.4, '#b04040');
      if (look.face === 2) { dd(-3, hy + 4.4, 2.4, 0.7, F(accent)); dd(0.6, hy + 4.4, 2.4, 0.7, F(accent)); }
      if (look.face === 3) { for (const [a, b] of [[-2.6, 4.6], [-1.4, 5], [1.2, 4.6], [2, 5]]) dd(a, hy + b, 0.5, 0.5, '#b0703c'); }
    }
    if (S.mask && !back) pp(-4, hy + 4.5, 8, 2.6, F(S.hatCol || '#1e1e26'));
    drawHairFront(pp, dd, look, hairC, hy, fem, S, back, o);
    drawHat(pp, dd, S, o, hy, back ? 'back' : 'front', accent, F, hairC, armor);
    flushParts(ctx, P, D);
    // оружие
    if (o.weapon) {
      let ang = 0.1, wx = tw / 2 + 1 + wide / 2, wy = ay + 5;
      if (atk && atkP >= 0) {
        if (atk.kind === 'slash') ang = atkP < 0.3 ? lerp(0.1, -2.4, atkP / 0.3) : lerp(-2.4, 1.8, Math.min(1, (atkP - 0.3) / 0.3));
        else if (atk.kind === 'stab') { wy -= Math.sin(atkP * Math.PI) * 2; ang = 0.2; }
        else if (atk.kind === 'shoot') { ang = -0.1; wx = 0; wy = ay + 3.5; }
        else if (atk.kind === 'cast') { ang = 0; wy = ay + 1 - Math.sin(atkP * Math.PI) * 3; }
        else if (atk.kind === 'spin') ang = atkP * TAU * 2;
      }
      if (o.weapon.wtype === 'bow') { wx = back ? tw / 2 + 1 : -tw / 2 - 1; wy = ay + 2; }
      { const ex = weaponExtra(atk, atkP), tr = (atk && (atk.kind === 'slash' || atk.kind === 'spin') && atkP > 0.28 && atkP < 0.66) ? 3 : 0; for (let g = tr; g >= 0; g--) { ctx.save(); ctx.translate(wx + (o.weapon.wtype === 'bow' ? 0 : 1), wy + (castUp ? -3 : 0)); ctx.rotate(ang - g * 0.42); if (g) ctx.globalAlpha = 0.34 - g * 0.09; drawWeaponShape(ctx, o.weapon.wtype, o.weapon.tier, atk && atk.kind === 'cast', t, ex); ctx.restore(); } }
    } else if (ms && ms.wp) { ctx.save(); ctx.translate(tw / 2 + 2, ay + 5); ctx.rotate(0.15); drawWeaponShape(ctx, ms.wp, 0, ms.fire, t); ctx.restore(); }
  }
  if (o.horns || (S.horns)) { /* рога у боссов уже в шляпе */ }
  ctx.restore();
}

function flushParts(ctx, P, D) {
  ctx.fillStyle = OUT; for (const [x, y, w, h] of P) ctx.fillRect(x - 0.7, y - 0.7, w + 1.4, h + 1.4);
  for (const [x, y, w, h, c] of P) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
  for (const [x, y, w, h, c] of D) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
}

function drawHairSide(pp, dd, look, hc, hy, fem, S, o) {
  if (S.skeleton || o.hairless) return;
  const st = look.hairStyle;
  if (st === 5) return; // лысый
  if (st === 4) { pp(-1, hy - 2.5, 2.4, 4, hc); pp(-2, hy - 1, 4.5, 1.6, hc); return; }
  pp(-4, hy - 0.8, 7.6, 2.8, hc); pp(-4.2, hy, 2.6, 5, hc);
  if (st === 1 || fem && st !== 0) { pp(-4.6, hy + 2, 3, 8, hc); }
  if (st === 2) { pp(-5.6, hy + 1, 2, 3, hc); pp(-6.4, hy + 3, 2, 5, hc); }
  if (st === 3) { pp(-4.8, hy + 2, 2.6, 9, hc); dd(-4.8, hy + 4, 2.6, 0.7, mix(hc, '#000', 0.4)); dd(-4.8, hy + 7, 2.6, 0.7, mix(hc, '#000', 0.4)); }
  if (st === 0) pp(0.8, hy - 0.2, 2.8, 1.8, hc);
}
function drawHairFront(pp, dd, look, hc, hy, fem, S, back, o) {
  if (S.skeleton || o.hairless) return;
  const st = look.hairStyle;
  if (st === 5) return;
  if (st === 4) { pp(-1.2, hy - 3, 2.4, 4, hc); if (back) pp(-1.2, hy + 1, 2.4, 3, hc); return; }
  if (back) {
    pp(-4.4, hy - 1, 8.8, 7, hc);
    if (st === 1 || (fem && st !== 0)) pp(-4.6, hy + 5, 9.2, 5, hc);
    if (st === 2) { pp(-1, hy + 5, 2.4, 6, hc); }
    if (st === 3) { pp(-3.4, hy + 5, 2, 8, hc); pp(1.4, hy + 5, 2, 8, hc); }
    return;
  }
  pp(-4.4, hy - 1, 8.8, 3.2, hc); pp(-4.4, hy, 1.6, 4.5, hc); pp(2.8, hy, 1.6, 4.5, hc);
  dd(-2.6, hy + 1.6, 5.6, 0.8, hc);
  if (fem && st === 0) { dd(-3, hy + 2, 2, 1, hc); }
  if (st === 1 || (fem && st !== 0 && st !== 4)) { pp(-5, hy + 3, 2, 8, hc); pp(3, hy + 3, 2, 8, hc); }
  if (st === 2) { pp(3.6, hy + 2, 2, 3, hc); pp(4.6, hy + 4, 1.8, 5, hc); }
  if (st === 3) { pp(-5, hy + 3, 1.8, 9, hc); pp(3.2, hy + 3, 1.8, 9, hc); dd(-5, hy + 6, 1.8, 0.7, mix(hc, '#000', 0.4)); dd(3.2, hy + 6, 1.8, 0.7, mix(hc, '#000', 0.4)); }
}
function drawHat(pp, dd, S, o, hy, view, accent, F, hairC, armor) {
  let hat = S.hat; const hc = F(S.hatCol || (S.hat === 'wizard' ? accent : '#5a5a6a'));
  const helmTier = (o.player && armor.head >= 0) ? armor.head : -1;
  if (helmTier >= 0 && !hat) hat = 'helmA';
  const side = view === 'side';
  const w = side ? 8 : 9, x0 = side ? -4 : -4.5;
  switch (hat) {
    case 'wizard': pp(-6, hy - 1.4, 12, 1.6, hc); pp(-3.8, hy - 4.6, 7.6, 3.4, hc); pp(-2.2, hy - 7.6, 4.6, 3.2, hc); pp(0.4, hy - 9.6, 2.6, 2.4, hc); dd(-3.8, hy - 2.6, 7.6, 1, F(S.trim || '#e8c860')); dd(-0.6, hy - 4.6, 1, 1, '#fff'); break;
    case 'hood': pp(x0 - 0.6, hy - 1.6, w + 1.2, 3.4, hc); if (side) pp(-4.8, hy, 3, 6, hc); else if (view === 'back') pp(-4.8, hy, 9.6, 6.8, hc); else { pp(-5, hy, 2, 6.4, hc); pp(3, hy, 2, 6.4, hc); } break;
    case 'wreath': pp(x0, hy - 1.4, w, 1.6, F('#3f9a4a')); dd(-2, hy - 2.2, 1.2, 1.2, F('#c84a3a')); dd(1.6, hy - 2.2, 1.2, 1.2, F('#e8c030')); pp(-3.6, hy - 4.6, 1, 3.4, F('#8a6a3a')); pp(2.8, hy - 4.6, 1, 3.4, F('#8a6a3a')); dd(-4.2, hy - 4.6, 1, 1, F('#8a6a3a')); dd(3.6, hy - 4.6, 1, 1, F('#8a6a3a')); break;
    case 'feathercap': pp(x0 - 0.4, hy - 1.8, w + 0.8, 2.6, hc); pp(-2, hy - 3.6, 5, 2, hc); dd(2, hy - 6, 1, 4, F(accent)); dd(2.8, hy - 5.4, 1, 2.6, '#fff'); break;
    case 'crown': pp(x0, hy - 2, w, 2, F('#f0c850')); dd(x0, hy - 3.4, 1.4, 1.4, F('#f0c850')); dd(-0.6, hy - 3.6, 1.4, 1.6, F('#f0c850')); dd(x0 + w - 1.4, hy - 3.4, 1.4, 1.4, F('#f0c850')); dd(-0.4, hy - 1.6, 1, 1, '#d33'); break;
    case 'helm': case 'helmA': { const mc = F(hat === 'helm' ? hc : ARMOR_COL[helmTier]); pp(x0 - 0.5, hy - 2.2, w + 1, 4, mc); if (!side && view !== 'back') { pp(-0.8, hy + 1, 1.6, 3.6, mc); } if (helmTier >= 2 || o.cls === 'berserk') { dd(x0 - 1.6, hy - 3.6, 1.6, 3, '#eee8d0'); dd(x0 + w, hy - 3.6, 1.6, 3, '#eee8d0'); } break; }
    case 'straw': pp(-6, hy - 1.4, 12, 1.4, F('#d8b860')); pp(-3.6, hy - 3.6, 7.2, 2.4, F('#e6c870')); dd(-3.6, hy - 2, 7.2, 0.7, '#a83a3a'); break;
    case 'cap': pp(x0 - 0.4, hy - 1.6, w + 0.8, 2.6, hc); pp(side ? 1 : -3, hy + 0.6, 6, 0.8, hc); break;
    case 'bandana': pp(x0 - 0.4, hy - 0.4, w + 0.8, 2, hc); dd(side ? -5.5 : 3.6, hy + 1, 1.6, 2, hc); break;
    case 'turban': pp(x0 - 0.6, hy - 3.6, w + 1.2, 4.4, hc); dd(x0, hy - 2, w, 0.7, '#c9a24a'); dd(-0.6, hy - 2.6, 1.2, 1.2, '#d33'); break;
    case 'goggles': dd(-3.4, hy + 2, 3, 2.2, '#8a9aa8'); dd(0.4, hy + 2, 3, 2.2, '#8a9aa8'); pp(x0 - 0.2, hy + 0.4, w + 0.4, 1, F('#6a4a2a')); break;
    case 'horns': pp(x0 - 0.5, hy - 1.4, w + 1, 2.4, hc); pp(-5.6, hy - 5, 1.8, 4.4, F('#3a2a2a')); pp(3.8, hy - 5, 1.8, 4.4, F('#3a2a2a')); dd(-6.2, hy - 6.2, 1.4, 1.6, F('#e8503a')); dd(4.8, hy - 6.2, 1.4, 1.6, F('#e8503a')); break;
  }
  if (S.skeleton) { /* глаза-огоньки */ dd(side ? 1.6 : -2, hy + 3, 1.2, 1.4, '#ff4a3a'); if (!side) dd(0.8, hy + 3, 1.2, 1.4, '#ff4a3a'); }
}

/* ----- Существа (звери, птицы, пауки, слизь, призраки, големы, драконы) ----- */
function drawCreature(ctx, o) {
  const t = o.t || 0, sz = o.size || 1, flip = o.flip ? -1 : 1, flash = o.hurt > 0;
  const F = c => flash ? '#ffffff' : c;
  const col = F(o.col || '#888'), acc = F(o.acc || '#ddd'), dark = F(mix(o.col || '#888', '#000000', 0.35));
  const mv = !!o.moving, ph = mv ? Math.sin(t * 12) : 0, bob = mv ? -Math.abs(ph) * 0.7 : Math.sin(t * 2) * 0.3;
  const P = [], D = [];
  const pp = (x, y, w, h, c) => P.push([x, y, w, h, c]), dd = (x, y, w, h, c) => D.push([x, y, w, h, c]);
  const atkP = o.atk ? o.atk.p : -1;
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  ctx.translate(Math.round(o.x), Math.round(o.y));
  const shadowR = 8 * sz;
  if (o.kind !== 'ghost' && !o.hoverShadow) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 1, shadowR + 2, 3 * sz + 1, 0, 0, TAU); ctx.fill(); }
  if (o.dead > 0) { ctx.rotate(Math.min(1, o.dead) * 1.5 * flip); ctx.globalAlpha = (o.alpha === undefined ? 1 : o.alpha) * (1 - Math.max(0, o.dead - 0.6) / 0.4); }
  if (o.aura) { ctx.save(); ctx.globalAlpha *= 0.5 + 0.2 * Math.sin(t * 4); ctx.fillStyle = o.aura; ctx.beginPath(); ctx.ellipse(0, -8 * sz, 10 * sz, 11 * sz, 0, 0, TAU); ctx.fill(); ctx.restore(); }
  ctx.scale(2 * sz * flip, 2 * sz);
  const wind = (atkP >= 0 && atkP < 0.5) ? atkP / 0.5 : 0, lunge2 = (atkP >= 0.5 && atkP <= 0.72) ? 6 : 0; ctx.translate(lunge2 - wind * 2.2, 0); if (wind) ctx.scale(1 + wind * 0.08, 1 - wind * 0.1); if (o.kx) ctx.translate(o.kx / (2 * sz * flip), o.ky ? o.ky / (2 * sz) : 0);
  const id = o.id;
  switch (o.kind) {
    case 'quad': {
      const big = (id === 'bear' || id === 'cub' || id === 'direwolf'), sl = id === 'panther' || id === 'wolf' || id === 'snowwolf' || id === 'wolfpup' || id === 'fox' || id === 'stag';
      const l1 = ph * 1.6, l2 = -ph * 1.6, by = bob;
      // хвост
      if (id === 'fox') { pp(-10, -8 + by, 5, 3, col); dd(-10.6, -8 + by, 2, 3, '#fff'); }
      else if (id === 'rat') { dd(-12, -3, 7, 0.8, '#d9a0a0'); }
      else if (id === 'boar' || id === 'piglet') { pp(-7.4, -7 + by, 1.6, 1.2, col); }
      else if (id === 'bear' || id === 'cub') pp(-7.4, -7.5 + by, 1.8, 1.8, col);
      else pp(-10, -8 + by + (sl ? -1 : 0), 4.5, 2, col);
      // ноги
      pp(-5 + l1, -4, 2, 4, dark); pp(-1.6 + l2, -4, 2, 4, dark); pp(1.4 + l1, -4, 2, 4, dark); pp(4 + l2, -4, 2, 4, dark);
      // тело
      const bl = big ? 14 : 12, bh = big ? 8 : 6.4;
      pp(-7, -4 - bh + by, bl, bh, col);
      dd(-5, -4 - bh * 0.3 + by, bl - 6, bh * 0.32, acc);
      if (id === 'boar' || id === 'piglet') { dd(-6, -4 - bh + by, bl - 2, 1, dark); }
      if (id === 'panther') dd(-2, -9.6 + by, 2, 0.8, '#3a3a48');
      // голова
      const hx = big ? 6.5 : 5, hy = -4 - bh - 1.5 + by;
      pp(hx - 0.5, hy, big ? 6.4 : 5.4, big ? 5.6 : 4.6, col);
      if (id === 'stag') { pp(hx + 1, hy - 4, 0.9, 4, '#c9a070'); pp(hx - 0.6, hy - 5, 0.9, 3, '#c9a070'); pp(hx + 2.6, hy - 5.4, 0.9, 3, '#c9a070'); }
      else if (id === 'fox' || id === 'wolf' || id === 'snowwolf' || id === 'wolfpup' || id === 'panther' || id === 'direwolf') { pp(hx, hy - 1.6, 1.5, 2, dark); pp(hx + 2.8, hy - 1.6, 1.5, 2, dark); }
      else { pp(hx, hy - 1, 1.8, 1.8, dark); pp(hx + 3, hy - 1, 1.8, 1.8, dark); }
      pp(hx + 4, hy + 1.5, sl ? 3 : 2.4, 2.6, acc);
      dd(hx + (big ? 6.8 : 6.2) - 0.4, hy + 1.6, 1, 1, '#111');
      dd(hx + 2.4, hy + 1, 1.1, 1.1, id === 'panther' ? '#f2d24a' : id === 'direwolf' ? '#ffe27a' : '#111');
      if (id === 'boar') { dd(hx + 3.6, hy + 3.4, 0.9, 1.6, '#efe6c8'); dd(hx + 5.5, hy + 3.4, 0.9, 1.6, '#efe6c8'); }
      if (id === 'direwolf') { dd(hx + 5, hy + 3.6, 0.7, 1.2, '#fff'); dd(hx + 3.4, hy + 3.6, 0.7, 1.2, '#fff'); }
      if (o.atk && atkP >= 0.25 && atkP <= 0.6) dd(hx + 4.5, hy + 3.2, 2.6, 1, '#fff');
      break;
    }
    case 'bird': {
      const flap = Math.sin(t * (mv || o.flyAlways ? 14 : 4)) * 0.8, by = -7 + Math.sin(t * 3) * 0.6;
      const big = sz > 1.1;
      pp(-4, by, 8, 4, col); dd(-2, by + 2, 5, 2, acc);
      pp(-7 - (big ? 1 : 0), by - 0.4, 3, 2, dark); // хвост
      pp(3, by - 2, 4, 4, col); pp(6.6, by - 0.6, 2.4, 1.4, F('#e8b03a')); dd(5.4, by - 1, 1, 1, '#111');
      if (id === 'griffin') { pp(2, by - 3.6, 1.4, 2, F('#f6f0e0')); pp(4, by - 3.6, 1.4, 2, F('#f6f0e0')); }
      // крылья
      ctx.save(); ctx.fillStyle = OUT;
      const wy = by - 1.4 - flap * 4;
      pp(-2, wy - 1, 6, 1.8, dark); pp(-1, wy - 0.6 - flap * 2, 7, 1.4, col);
      ctx.restore();
      break;
    }
    case 'spider': {
      const by = -4 + bob;
      for (let i = 0; i < 4; i++) { const x = -5 + i * 2.6, w = Math.sin(t * 12 + i * 1.5) * (mv ? 1 : 0.3); pp(x - 2.6, by + 2 + w * 0.4, 3.4, 1, dark); pp(x - 3.4, by + 2.6 + w, 1, 2.6, dark); pp(x + 2, by + 2 - w * 0.4, 3.4, 1, dark); pp(x + 3.6, by + 2.6 - w, 1, 2.6, dark); }
      pp(-6, by - 3, 8, 6, col); pp(0, by - 2.4, 6, 5, dark); dd(-4, by - 2, 4, 1.6, acc);
      dd(4, by - 1, 1.2, 1.2, '#ff3a3a'); dd(5.6, by - 1, 1.2, 1.2, '#ff3a3a'); dd(4.6, by + 0.6, 1, 1, '#ff6a6a');
      break;
    }
    case 'blob': {
      const sq = 1 + Math.sin(t * 4) * 0.1 + (atkP >= 0 ? Math.sin(atkP * Math.PI) * 0.2 : 0);
      ctx.save(); ctx.scale(1 / sq, sq); ctx.fillStyle = OUT; ctx.beginPath(); ctx.ellipse(0, -4.5 / sq, 8.4, 6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, -4.5 / sq, 7.6, 5.4, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = F(mix(o.col || '#5a5', '#fff', 0.35)); ctx.beginPath(); ctx.ellipse(-2.6, -7.4 / sq, 2.4, 1.4, -0.4, 0, TAU); ctx.fill();
      ctx.fillStyle = '#111'; ctx.fillRect(-3, -5 / sq, 1.6, 2.2); ctx.fillRect(1.6, -5 / sq, 1.6, 2.2); ctx.fillStyle = '#fff'; ctx.fillRect(-2.6, -5 / sq, 0.7, 0.7); ctx.fillRect(2, -5 / sq, 0.7, 0.7);
      ctx.restore(); break;
    }
    case 'ghost': {
      const fl = Math.sin(t * 3) * 1.6 - 6;
      ctx.globalAlpha *= 0.8;
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.ellipse(0, 1, 5, 2, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-5, fl + 9); for (let i = 0; i <= 5; i++) ctx.lineTo(-5 + i * 2, fl + 9 + (i % 2 ? 2.5 : 0)); ctx.lineTo(5, fl - 3); ctx.quadraticCurveTo(0, fl - 12, -5, fl - 3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = acc; ctx.beginPath(); ctx.ellipse(0, fl - 2, 3, 4, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#111'; ctx.fillRect(-2.6, fl - 3.4, 1.8, 2.4); ctx.fillRect(0.8, fl - 3.4, 1.8, 2.4); ctx.fillRect(-1, fl + 0.4, 2, 1.6);
      break;
    }
    case 'golem': {
      const by = bob, l1 = ph;
      pp(-5, -6 + l1, 4, 6 - l1, dark); pp(1, -6 - l1, 4, 6 + l1, dark);
      pp(-7, -15 + by, 14, 10, col); pp(-3, -18 + by, 6, 4, col); pp(-11, -15 + by + ph * 0.6, 4, 8, dark); pp(7, -15 + by - ph * 0.6, 4, 8, dark);
      dd(-5, -12 + by, 1, 6, acc); dd(-2, -14 + by, 4, 1, acc); dd(3, -11 + by, 1, 5, acc); dd(-2, -8 + by, 3, 1, acc);
      dd(-2, -17 + by, 1.4, 1.4, '#ffa03a'); dd(0.8, -17 + by, 1.4, 1.4, '#ffa03a');
      break;
    }
    case 'dragon': {
      const by = bob, wf = Math.sin(t * 5) * 2;
      pp(-11, -6 + by, 6, 2, col); pp(-8, -4 + by, 2, 2, col);
      pp(-6 + ph * 1.4, -4, 2.4, 4, dark); pp(3 - ph * 1.4, -4, 2.4, 4, dark);
      pp(-7, -12 + by, 14, 8, col); dd(-5, -6 + by, 10, 1.6, acc);
      pp(-3, -18 + by - wf, 5, 6, dark); pp(0, -20 + by - wf * 1.4, 4, 3, dark); // крыло
      pp(6, -15 + by, 7, 5, col); pp(12, -13 + by, 3, 3, col); pp(7, -18 + by, 1.4, 3, acc); pp(10, -18 + by, 1.4, 3, acc);
      dd(9, -14 + by, 1.2, 1.2, '#ffd23a'); dd(13, -11 + by, 1.4, 1, '#fff');
      if (atkP >= 0.25 && atkP <= 0.6) { dd(15, -13 + by, 5, 3, '#ff9a2a'); dd(16, -12.4 + by, 3, 1.6, '#ffe27a'); }
      break;
    }
  }
  flushParts(ctx, P, D);
  ctx.restore();
}

function weaponExtra(atk, p) {
  if (!atk || p < 0) return null;
  if (atk.kind === 'shoot') return { pull: p < 0.5 ? p / 0.5 : Math.max(0, 1 - (p - 0.5) * 7), arrow: p < 0.52 };
  if (atk.kind === 'cast') return { charge: Math.sin(Math.min(1, p) * Math.PI * 0.85) };
  return null;
}

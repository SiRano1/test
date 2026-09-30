'use strict';
/* ===== Система боевых эффектов: следы ударов, взрывы, магия, частицы, декали ===== */
G.ground = []; G.ghosts = []; G.flash = null; G.hitstop = 0; G.punch = 0;

function floatText(x, y, text, color, size) { if (!G.settings.dmgNumbers && size !== 'big' && !/[A-Za-zА-Яа-я+!]/.test(String(text))) return; G.texts.push({ x: x + rand(-8, 8), y, text, color: color || '#fff', t: 0, life: size === 'big' ? 1.4 : 1.1, size: size || 'n', pop: 1 }); }
function P_(o) { if (!G.settings.particles && !o.force) { if (Math.random() < 0.6) return; } G.fx.push(Object.assign({ t: 0, life: 0.5, size: 3, vx: 0, vy: 0, g: 0, drag: 0, grow: 0, shape: 'sq', add: false, color: '#fff', rot: rand(0, TAU), vr: 0 }, o)); }
function burst(x, y, color, n = 10, spread = 60, o = {}) {
  const cnt = G.settings.particles ? n : Math.ceil(n / 3);
  for (let i = 0; i < cnt; i++) { const a = rand(0, TAU), s = rand(spread * 0.3, spread); G.fx.push({ t: 0, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, life: rand(0.3, 0.7), color, size: rand(2, 4), g: 80, drag: 0, grow: 0, shape: o.shape || 'sq', add: !!o.add, rot: rand(0, TAU), vr: rand(-6, 6) }); }
}
function ringFx(x, y, color, r, life = 0.45) { G.fx.push({ ring: true, x, y, color, r, t: 0, life, add: true }); }
function shake(a, t = 0.25) { if (G.settings.shake) { G.shakeA = Math.max(G.shakeT > 0 ? G.shakeA : 0, a); G.shakeT = Math.max(G.shakeT, t); } }
function hitstop(t) { G.hitstop = Math.max(G.hitstop, t); }
function punch(a) { G.punch = Math.max(G.punch, a); }
function fxFlash(color, a = 0.5, dur = 0.25) { G.flash = { color, a, t: 0, dur }; }
function later(sec, fn) { G.timers.push({ at: G.t + sec, fn }); }
function lightning(pts) { G.lightning.push({ pts, t: 0, life: 0.32, seed: Math.random() * 99 }); fxFlash('#dfe8ff', 0.18, 0.15); }

/* --- следы ударов --- */
function fxCrescent(x, y, ang, range, arc, c1, c2, life = 0.22, thick = 0.5, add = true) { G.fx.push({ type: 'crescent', x, y, ang, range, arc, c1, c2, t: 0, life, thick, add }); }
function slashFx(x, y, ang, range, arc, color, style) { fxCrescent(x, y, ang, range, arc, color || '#fff', color || '#fff', 0.2, 0.4); }
function fxCross(x, y, ang, len, c1, c2) { G.fx.push({ type: 'cross', x, y, ang, len, c1, c2: c2 || c1, t: 0, life: 0.22, add: true }); }
function fxClaws(x, y, ang, len, col, n = 3) { G.fx.push({ type: 'claws', x, y, ang, len, col, n, t: 0, life: 0.28, add: true }); }
function fxStreak(x, y, ang, len, col, life = 0.18, w = 3) { G.fx.push({ type: 'streak', x, y, ang, len, col, w, t: 0, life, add: true }); }
function spark(x, y, ang, col, n = 6, spd = 200) { for (let i = 0; i < n; i++) { const a = ang + rand(-0.8, 0.8), s = rand(spd * 0.4, spd); P_({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.1, 0.26), color: col, size: rand(6, 12), shape: 'line', add: true, drag: 4, rot: a }); } }
function fxFlare(x, y, col, size = 22, life = 0.2) { G.fx.push({ type: 'flare', x, y, col, size, t: 0, life, add: true, rot: rand(0, 1) }); }
function fxDust(x, y, n = 8, col = '#b8a888', size = 8) { for (let i = 0; i < n; i++) { const a = rand(0, TAU), s = rand(15, 60); P_({ x: x + Math.cos(a) * 6, y: y + Math.sin(a) * 3, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.4 - 12, life: rand(0.4, 0.8), color: col, size: rand(size * 0.5, size), shape: 'smoke', drag: 2.2, grow: 14, alpha0: 0.55 }); } }
function fxSmoke(x, y, n, col = '#888', size = 16, life = 2.5, spread = 40) { for (let i = 0; i < n; i++) { const a = rand(0, TAU), s = rand(0, spread); P_({ x: x + Math.cos(a) * s * 0.6, y: y + Math.sin(a) * s * 0.3, vx: Math.cos(a) * 6, vy: rand(-14, -3), life: rand(life * 0.6, life), color: col, size: rand(size * 0.6, size), shape: 'smoke', drag: 0.6, grow: 5, alpha0: 0.5 }); } }
function fxDebris(x, y, n, col = '#6a5a4a', spd = 150) { for (let i = 0; i < n; i++) { const a = rand(-Math.PI, 0), s = rand(spd * 0.4, spd); P_({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.5, 0.9), color: col, size: rand(3, 6), g: 420, rot: rand(0, TAU), vr: rand(-10, 10) }); } }
function fxEmbers(x, y, n, spread = 40, col = '#ffa040') { for (let i = 0; i < n; i++) P_({ x: x + rand(-spread, spread), y: y + rand(-spread * 0.4, spread * 0.4), vx: rand(-20, 20), vy: rand(-90, -30), life: rand(0.5, 1.2), color: col, size: rand(2, 3.5), add: true, shape: 'circle', g: -20 }); }
function fxLeaves(x, y, n = 10, spread = 40, cols = ['#5fca6a', '#3f9a4a', '#8fe05a']) { for (let i = 0; i < n; i++) { const a = rand(0, TAU), s = rand(10, spread); P_({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: rand(0.6, 1.2), color: pick(cols), size: rand(4, 7), shape: 'leaf', g: 30, drag: 1.2, rot: rand(0, TAU), vr: rand(-6, 6) }); } }
function fxGhost(P, alpha = 0.5, life = 0.3, tint) { G.ghosts.push({ snap: { x: P.x, y: P.y, dir: P.dir, flip: P.flip, form: P.form, t0: P.t0, moving: P.moving, anim: P.anim ? { kind: P.anim.kind, p: P.anim.p } : null }, alpha, t: 0, life, tint }); }
function fxSpeedLines(x, y, ang, n = 6) { for (let i = 0; i < n; i++) { const off = rand(-14, 14), px = x - Math.cos(ang) * rand(0, 30) - Math.sin(ang) * off, py = y - Math.sin(ang) * rand(0, 30) + Math.cos(ang) * off; G.fx.push({ type: 'streak', x: px, y: py, ang: ang + Math.PI, len: rand(20, 40), col: '#fff', w: 1.5, t: 0, life: 0.22, add: true }); } }

/* --- земля: руны, трещины, копоть, иней --- */
function groundFx(o) { G.ground.push(Object.assign({ t: 0, life: 1 }, o)); }
function fxCircle(x, y, r, color, life = 0.6, rot = 0) { groundFx({ type: 'rune', x, y, r, color, life, rot }); }
function fxCracks(x, y, r, life = 4) { const rays = []; const n = 9; for (let i = 0; i < n; i++) { const a = i / n * TAU + rand(-0.2, 0.2), pts = []; let cx = 0, cy = 0, len = r * rand(0.7, 1.1); const seg = 5; for (let s = 1; s <= seg; s++) { const aa = a + rand(-0.25, 0.25); cx += Math.cos(aa) * len / seg; cy += Math.sin(aa) * len / seg * 0.6; pts.push([cx, cy]); } rays.push(pts); } groundFx({ type: 'cracks', x, y, rays, life }); }
function fxScorch(x, y, r, life = 9) { groundFx({ type: 'scorch', x, y, r, life }); }
function fxFrost(x, y, r, life = 6) { const sh = []; for (let i = 0; i < 14; i++) { const a = rand(0, TAU), d = rand(0.15, 0.95) * r; sh.push([Math.cos(a) * d, Math.sin(a) * d * 0.65, rand(6, 16), rand(0, TAU)]); } groundFx({ type: 'frost', x, y, r, sh, life }); }
function fxPuddle(x, y, r, col, life = 5) { groundFx({ type: 'puddle', x, y, r, col, life }); }

/* --- сложные взрывы по стихиям --- */
function explodeFx(x, y, r, el = 'fire') {
  ringFx(x, y, el === 'ice' ? '#bef' : el === 'poison' ? '#8f4' : el === 'arcane' ? '#c8f' : '#fa4', r, 0.4); ringFx(x, y, '#fff', r * 0.6, 0.25);
  G.fx.push({ type: 'glowball', x, y: y - 8, r: r * 0.9, col: el === 'ice' ? '#bdf' : el === 'poison' ? '#9f5' : el === 'arcane' ? '#d9f' : '#ffb050', t: 0, life: 0.3, add: true });
  fxFlare(x, y - 8, '#fff', r * 0.8, 0.22);
  if (el === 'fire') { fxSmoke(x, y - 10, 6, '#3a3030', r * 0.35, 1.6, r * 0.5); fxEmbers(x, y - 10, 14, r * 0.5); fxScorch(x, y, r * 0.8); burst(x, y - 8, '#ff9a3a', 18, r * 1.6, { add: true, shape: 'circle' }); }
  else if (el === 'ice') { for (let i = 0; i < 16; i++) { const a = rand(0, TAU), s = rand(60, r * 2); P_({ x, y: y - 8, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7 - 20, life: rand(0.4, 0.8), color: pick(['#dff', '#9df', '#fff']), size: rand(4, 8), shape: 'diamond', g: 120, rot: a, vr: rand(-8, 8) }); } fxFrost(x, y, r * 0.9); }
  else if (el === 'poison') { burst(x, y - 8, '#8f4', 16, r * 1.4, { shape: 'circle' }); fxPuddle(x, y, r * 0.7, '#5fbf3a'); }
  else if (el === 'arcane') { burst(x, y - 8, '#d9f', 18, r * 1.5, { add: true, shape: 'circle' }); for (let i = 0; i < 6; i++) fxStreak(x, y - 8, rand(0, TAU), r * 0.9, '#e8b8ff', 0.25, 2); }
  else { fxDust(x, y, 10); fxDebris(x, y, 10); }
}
function updateFx(dt) {
  for (let i = G.fx.length - 1; i >= 0; i--) { const f = G.fx[i]; f.t += dt; if (f.t >= f.life) { G.fx.splice(i, 1); continue; } if (f.ring || f.type) continue; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += f.g * dt; if (f.drag) { const d = Math.max(0, 1 - f.drag * dt); f.vx *= d; f.vy *= d; } if (f.grow) f.size += f.grow * dt; f.rot += f.vr * dt; }
  for (let i = G.ground.length - 1; i >= 0; i--) { const g = G.ground[i]; g.t += dt; if (g.t >= g.life) G.ground.splice(i, 1); }
  for (let i = G.ghosts.length - 1; i >= 0; i--) { const g = G.ghosts[i]; g.t += dt; if (g.t >= g.life) G.ghosts.splice(i, 1); }
  if (G.flash) { G.flash.t += dt; if (G.flash.t >= G.flash.dur) G.flash = null; }
  G.punch = Math.max(0, G.punch - dt * 0.35); if (G.fx.length > 900) G.fx.splice(0, G.fx.length - 900);
}

/* ---------- отрисовка ---------- */
function drawGround(c) {
  for (const g of G.ground) {
    const k = g.t / g.life;
    if (g.type === 'scorch') { const a = (1 - k) * 0.55, gr = c.createRadialGradient(g.x, g.y, 2, g.x, g.y, g.r); gr.addColorStop(0, `rgba(10,6,4,${a})`); gr.addColorStop(1, 'rgba(10,6,4,0)'); c.fillStyle = gr; c.beginPath(); c.ellipse(g.x, g.y, g.r, g.r * 0.65, 0, 0, TAU); c.fill(); }
    else if (g.type === 'cracks') { const a = clamp((1 - k) * 1.4, 0, 1), grow = Math.min(1, g.t / 0.18); c.strokeStyle = `rgba(20,12,8,${a})`; c.lineWidth = 2.5; for (const ray of g.rays) { c.beginPath(); c.moveTo(g.x, g.y); const n = Math.ceil(ray.length * grow); for (let i = 0; i < n; i++) c.lineTo(g.x + ray[i][0], g.y + ray[i][1]); c.stroke(); } c.strokeStyle = `rgba(255,120,40,${a * 0.4})`; c.lineWidth = 1; for (const ray of g.rays) { c.beginPath(); c.moveTo(g.x, g.y); const n = Math.ceil(ray.length * grow); for (let i = 0; i < n; i++) c.lineTo(g.x + ray[i][0], g.y + ray[i][1]); c.stroke(); } }
    else if (g.type === 'frost') { const a = clamp((1 - k) * 1.3, 0, 1), gr = c.createRadialGradient(g.x, g.y, 4, g.x, g.y, g.r); gr.addColorStop(0, `rgba(200,240,255,${a * 0.55})`); gr.addColorStop(1, 'rgba(200,240,255,0)'); c.fillStyle = gr; c.beginPath(); c.ellipse(g.x, g.y, g.r, g.r * 0.65, 0, 0, TAU); c.fill(); const gr2 = Math.min(1, g.t / 0.25); for (const s of g.sh) { c.save(); c.translate(g.x + s[0], g.y + s[1]); c.rotate(s[3] * 0.2); c.fillStyle = `rgba(190,235,255,${a})`; c.beginPath(); c.moveTo(0, -s[2] * gr2); c.lineTo(s[2] * 0.3, 0); c.lineTo(0, s[2] * 0.25); c.lineTo(-s[2] * 0.3, 0); c.closePath(); c.fill(); c.fillStyle = `rgba(255,255,255,${a * 0.8})`; c.fillRect(-1, -s[2] * gr2, 2, s[2] * gr2 * 0.6); c.restore(); } }
    else if (g.type === 'puddle') { const a = (1 - k) * 0.6; c.fillStyle = g.col; c.globalAlpha = a; c.beginPath(); c.ellipse(g.x, g.y, g.r, g.r * 0.6, 0, 0, TAU); c.fill(); c.globalAlpha = 1; }
    else if (g.type === 'rune') {
      const a = Math.sin(Math.min(1, k) * Math.PI), rot = g.rot + g.t * 2.5; c.save(); c.translate(g.x, g.y); c.scale(1, 0.55); c.globalCompositeOperation = 'lighter'; c.globalAlpha = a * 0.9; c.strokeStyle = g.color; c.lineWidth = 2;
      c.beginPath(); c.arc(0, 0, g.r, 0, TAU); c.stroke(); c.beginPath(); c.arc(0, 0, g.r * 0.72, 0, TAU); c.stroke(); c.rotate(rot); c.beginPath(); for (let i = 0; i < 6; i++) { const an = i / 6 * TAU; c.lineTo(Math.cos(an) * g.r * 0.72, Math.sin(an) * g.r * 0.72); } c.closePath(); c.stroke(); c.beginPath(); for (let i = 0; i < 6; i++) { const an = i / 6 * TAU + TAU / 12; c.lineTo(Math.cos(an) * g.r * 0.72, Math.sin(an) * g.r * 0.72); } c.closePath(); c.stroke();
      c.fillStyle = g.color; c.globalAlpha = a * 0.18; c.beginPath(); c.arc(0, 0, g.r, 0, TAU); c.fill(); c.restore();
    }
  }
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
}
function drawGhosts(c) {
  for (const g of G.ghosts) { const k = g.t / g.life, s = g.snap; const save = { a: G.P.ghostAlpha }; const fake = Object.assign({}, G.P, s, { ghostAlpha: g.alpha * (1 - k), dead: false, hurt: 0 }); if (g.tint) { c.save(); } drawPlayerEnt(c, fake); if (g.tint) c.restore(); }
}
function drawFx(c, f) {
  const k = f.t / f.life;
  c.globalCompositeOperation = f.add ? 'lighter' : 'source-over';
  if (f.ring) { const rr = f.r * Math.min(1, k * 1.5 + 0.1); c.globalAlpha = (1 - k) * 0.9; c.strokeStyle = f.color; c.lineWidth = 5 * (1 - k) + 1; c.beginPath(); c.ellipse(f.x, f.y - 6, rr, rr * 0.6, 0, 0, TAU); c.stroke(); c.lineWidth = 2; c.globalAlpha = (1 - k) * 0.4; c.fillStyle = f.color; c.beginPath(); c.ellipse(f.x, f.y - 6, rr, rr * 0.6, 0, 0, TAU); c.fill(); }
  else if (f.type === 'crescent') {
    const sweep = Math.min(1, k * 3.4), a0 = f.ang - f.arc / 2, a1 = a0 + f.arc * sweep, R = f.range * (0.88 + 0.16 * k), n = 16, Rin = R * (1 - f.thick), tail = Math.max(0, sweep - 0.6);
    c.globalAlpha = Math.pow(1 - k, 0.8); const grad = c.createRadialGradient(f.x, f.y, Rin * 0.6, f.x, f.y, R); grad.addColorStop(0, f.c2); grad.addColorStop(1, f.c1);
    c.fillStyle = grad; c.beginPath();
    for (let i = 0; i <= n; i++) { const t = i / n, a = a0 + (a1 - a0) * t; c.lineTo(f.x + Math.cos(a) * R, f.y + Math.sin(a) * R * 0.92); }
    for (let i = n; i >= 0; i--) { const t = i / n, a = a0 + (a1 - a0) * t, rr = R - (R - Rin) * Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.05)) * (0.6 + 0.4 * (1 - k)); c.lineTo(f.x + Math.cos(a) * rr, f.y + Math.sin(a) * rr * 0.92); }
    c.closePath(); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.globalAlpha *= 0.8; c.beginPath(); for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; const rr = R; i ? c.lineTo(f.x + Math.cos(a) * rr, f.y + Math.sin(a) * rr * 0.92) : c.moveTo(f.x + Math.cos(a) * rr, f.y + Math.sin(a) * rr * 0.92); } c.stroke();
  }
  else if (f.type === 'cross') { c.globalAlpha = 1 - k; const L = f.len * (0.5 + Math.min(1, k * 4) * 0.5); for (const d of [-0.7, 0.7]) { const a = f.ang + d; c.strokeStyle = f.c1; c.lineWidth = 4 * (1 - k) + 1; c.beginPath(); c.moveTo(f.x - Math.cos(a) * L, f.y - Math.sin(a) * L); c.lineTo(f.x + Math.cos(a) * L, f.y + Math.sin(a) * L); c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 1.2; c.stroke(); } }
  else if (f.type === 'claws') { c.globalAlpha = 1 - k; const grow = Math.min(1, k * 4); for (let i = 0; i < f.n; i++) { const off = (i - (f.n - 1) / 2) * 9, px = f.x + Math.cos(f.ang + Math.PI / 2) * off, py = f.y + Math.sin(f.ang + Math.PI / 2) * off; c.strokeStyle = f.col; c.lineWidth = 3.5 * (1 - k) + 1; c.beginPath(); c.moveTo(px - Math.cos(f.ang - 0.3) * f.len * 0.5, py - Math.sin(f.ang - 0.3) * f.len * 0.5); c.quadraticCurveTo(px, py - 4, px + Math.cos(f.ang + 0.3) * f.len * 0.5 * grow, py + Math.sin(f.ang + 0.3) * f.len * 0.5 * grow); c.stroke(); } }
  else if (f.type === 'streak') { c.globalAlpha = (1 - k) * 0.9; const L = f.len * (1 - k * 0.5); c.strokeStyle = f.col; c.lineWidth = f.w * (1 - k) + 0.5; c.beginPath(); c.moveTo(f.x, f.y); c.lineTo(f.x + Math.cos(f.ang) * L, f.y + Math.sin(f.ang) * L); c.stroke(); }
  else if (f.type === 'flare') { c.globalAlpha = 1 - k; const s = f.size * (0.6 + k * 0.6); c.fillStyle = f.col; c.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + f.rot, r = i % 2 ? s * 0.22 : s; c.lineTo(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r); } c.closePath(); c.fill(); }
  else if (f.type === 'glowball') { const r = f.r * (0.5 + k * 0.7); const gr = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, r); gr.addColorStop(0, '#fff'); gr.addColorStop(0.35, f.col); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.globalAlpha = (1 - k) * 0.95; c.fillStyle = gr; c.beginPath(); c.arc(f.x, f.y, r, 0, TAU); c.fill(); }
  else if (f.type === 'pillar') { c.globalAlpha = Math.sin(k * Math.PI) * 0.75; const w = f.w * (1 - k * 0.4); const gr = c.createLinearGradient(0, f.y - f.h, 0, f.y); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, f.col); c.fillStyle = gr; c.fillRect(f.x - w / 2, f.y - f.h, w, f.h); }
  else {
    const a0 = f.alpha0 || 1; c.globalAlpha = (1 - k) * a0; c.fillStyle = f.color;
    if (f.shape === 'sq') c.fillRect(f.x - f.size / 2, f.y - f.size / 2, f.size, f.size);
    else if (f.shape === 'circle') { c.beginPath(); c.arc(f.x, f.y, f.size / 2, 0, TAU); c.fill(); }
    else if (f.shape === 'smoke') { c.beginPath(); c.arc(f.x, f.y, f.size, 0, TAU); c.fill(); }
    else if (f.shape === 'line') { c.strokeStyle = f.color; c.lineWidth = 2; c.beginPath(); c.moveTo(f.x, f.y); c.lineTo(f.x - Math.cos(f.rot) * f.size, f.y - Math.sin(f.rot) * f.size); c.stroke(); }
    else if (f.shape === 'diamond') { c.save(); c.translate(f.x, f.y); c.rotate(f.rot); c.beginPath(); c.moveTo(0, -f.size); c.lineTo(f.size * 0.5, 0); c.lineTo(0, f.size); c.lineTo(-f.size * 0.5, 0); c.closePath(); c.fill(); c.restore(); }
    else if (f.shape === 'leaf') { c.save(); c.translate(f.x, f.y); c.rotate(f.rot); c.beginPath(); c.ellipse(0, 0, f.size, f.size * 0.45, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-f.size, 0); c.lineTo(f.size, 0); c.stroke(); c.restore(); }
    else if (f.shape === 'text') { c.font = `${f.size}px serif`; c.textAlign = 'center'; c.fillText(f.text, f.x, f.y); c.textAlign = 'left'; }
  }
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
}
function drawLightning(c, l) {
  const k = l.t / l.life, a = 1 - k; c.globalCompositeOperation = 'lighter'; c.lineJoin = 'round';
  for (let pass = 0; pass < 3; pass++) {
    c.strokeStyle = pass === 0 ? `rgba(120,140,255,${a * 0.5})` : pass === 1 ? `rgba(200,220,255,${a * 0.8})` : `rgba(255,255,255,${a})`; c.lineWidth = pass === 0 ? 9 : pass === 1 ? 4 : 1.6;
    for (let i = 1; i < l.pts.length; i++) {
      const A = l.pts[i - 1], B = l.pts[i], n = 7; let px = A.x, py = A.y; c.beginPath(); c.moveTo(px, py);
      for (let j = 1; j < n; j++) { const t = j / n, jx = (Math.sin(l.seed + j * 12.9 + i * 4.1 + Math.floor(l.t * 40)) * 9), jy = (Math.cos(l.seed + j * 7.3 + i * 2.7 + Math.floor(l.t * 40)) * 9); c.lineTo(lerp(A.x, B.x, t) + jx, lerp(A.y, B.y, t) + jy); }
      c.lineTo(B.x, B.y); c.stroke();
    }
  }
  for (const p of l.pts) { const gr = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 16); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(150,170,255,0)'); c.fillStyle = gr; c.beginPath(); c.arc(p.x, p.y, 16, 0, TAU); c.fill(); }
  c.globalCompositeOperation = 'source-over';
}

function drawProj(c, pr) {
  const a = Math.atan2(pr.vy, pr.vx), style = pr.style || (pr.color === '#dfe' ? 'dagger' : pr.aoe && pr.team === 'p' ? 'fireball' : pr.arrow ? 'arrow' : pr.team === 'e' ? 'enemy' : 'bolt');
  const tp = pr.tp || [];
  c.globalCompositeOperation = 'lighter';
  if (tp.length > 1 && style !== 'arrow') { for (let i = 1; i < tp.length; i++) { const k = i / tp.length; c.strokeStyle = style === 'fireball' ? `rgba(255,${120 + k * 100 | 0},40,${k * 0.6})` : style === 'dagger' ? `rgba(190,120,255,${k * 0.5})` : `rgba(${pr.team === 'e' ? '255,120,80' : '190,150,255'},${k * 0.55})`; c.lineWidth = (pr.r * 1.6) * k; c.lineCap = 'round'; c.beginPath(); c.moveTo(tp[i - 1][0], tp[i - 1][1]); c.lineTo(tp[i][0], tp[i][1]); c.stroke(); } }
  if (style === 'arrow') { if (tp.length > 1) { const p0 = tp[0]; const g = c.createLinearGradient(p0[0], p0[1], pr.x, pr.y); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, pr.big ? 'rgba(255,255,255,0.9)' : 'rgba(255,240,200,0.55)'); c.strokeStyle = g; c.lineWidth = pr.big ? 4 : 2; c.beginPath(); c.moveTo(p0[0], p0[1]); c.lineTo(pr.x, pr.y); c.stroke(); } c.globalCompositeOperation = 'source-over'; c.save(); c.translate(pr.x, pr.y); c.rotate(a); c.fillStyle = '#e8dcc0'; c.fillRect(-10, -0.8, 13, 1.6); c.fillStyle = '#dfe6ee'; c.beginPath(); c.moveTo(6, 0); c.lineTo(2, -2.2); c.lineTo(2, 2.2); c.fill(); c.fillStyle = pr.team === 'e' ? '#c84a3a' : '#c8402a'; c.fillRect(-11, -2, 4, 1.4); c.fillRect(-11, 0.6, 4, 1.4); c.restore(); return; }
  c.save(); c.translate(pr.x, pr.y);
  if (style === 'dagger') { c.globalCompositeOperation = 'source-over'; c.rotate(G.at * 22); c.fillStyle = '#dfe6ee'; c.beginPath(); c.moveTo(7, 0); c.lineTo(-3, -2.4); c.lineTo(-3, 2.4); c.fill(); c.fillStyle = '#6a4a2a'; c.fillRect(-7, -1, 4, 2); c.fillStyle = '#fff'; c.fillRect(-2, -0.6, 8, 1.2); }
  else if (style === 'fireball') { const fl = 0.85 + Math.sin(G.at * 30) * 0.15, R = pr.r * 2.5 * fl; let g = c.createRadialGradient(0, 0, 1, 0, 0, R); g.addColorStop(0, '#fff'); g.addColorStop(0.25, '#ffe27a'); g.addColorStop(0.55, '#ff7a1a'); g.addColorStop(1, 'rgba(200,40,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill(); c.rotate(a); c.fillStyle = 'rgba(255,140,40,0.7)'; c.beginPath(); c.moveTo(-R * 1.9, 0); c.lineTo(0, -R * 0.6); c.lineTo(0, R * 0.6); c.fill(); }
  else { const R = pr.r * 2, g = c.createRadialGradient(0, 0, 1, 0, 0, R); const core = pr.team === 'e' ? '#fff' : '#fff'; g.addColorStop(0, core); g.addColorStop(0.35, pr.color); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, R * (0.9 + Math.sin(G.at * 25) * 0.1), 0, TAU); c.fill(); if (pr.fire) { c.rotate(a); c.fillStyle = 'rgba(255,120,30,0.6)'; c.beginPath(); c.moveTo(-R * 1.8, 0); c.lineTo(0, -R * 0.55); c.lineTo(0, R * 0.55); c.fill(); } }
  c.restore(); c.globalCompositeOperation = 'source-over';
}

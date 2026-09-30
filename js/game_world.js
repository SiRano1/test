'use strict';
/* ===== NPC, задания, события, диалоги, взаимодействие, старт/сохранение ===== */

/* ---------- Задания ---------- */
const qstate = id => G.prof.quests[id];
const questActive = id => { const q = qstate(id); return !!q && q.state === 'active'; };
const questDone = id => { const q = qstate(id); return !!q && q.state === 'done'; };
function objProgress(q, def, i) {
  const o = def.obj[i]; if (o.t === 'collect') return Math.min(o.n, countItem(o.id)); if (['kill', 'tame', 'plant', 'harvest', 'fish', 'craft'].includes(o.t)) return Math.min(o.n, q.prog[i] || 0); return q.prog[i] ? 1 : 0;
}
const objNeed = o => (o.n && ['collect', 'kill', 'tame', 'plant', 'harvest', 'fish', 'craft'].includes(o.t)) ? o.n : 1;
function questAllObj(id) { const q = qstate(id), def = QUESTS[id]; return def.obj.every((o, i) => objProgress(q, def, i) >= objNeed(o)); }
function questAvailable(id) {
  const d = QUESTS[id], p = G.prof; if (p.quests[id]) return false; if (d.req && !questDone(d.req)) return false; if (d.cls && d.cls !== p.cls) return false; return true;
}
function acceptQuest(id) {
  const d = QUESTS[id]; G.prof.quests[id] = { state: 'active', prog: d.obj.map(() => 0), ready: false }; Snd.play('quest'); toast(`📜 Новое задание: ${d.name}`, 'good'); logMsg(`Новое задание: ${d.name}`, 'good'); questRecheck(); UI.dirty = true;
}
function questRecheck() {
  if (!G.prof) return; for (const id in G.prof.quests) { const q = G.prof.quests[id]; if (q.state !== 'active') continue; const def = QUESTS[id]; const all = questAllObj(id); if (all && !q.ready) { q.ready = true; const who = NPCS.find(n => n.id === (def.turnIn || def.giver)); toast(`✅ Задание выполнено: ${def.name}${who ? ' — вернитесь к: ' + who.name : ''}`, 'good'); Snd.play('quest'); } else if (!all) q.ready = false; }
  if (window.UI) UI.dirty = true;
}
function questKill(mon) { for (const id in G.prof.quests) { const q = G.prof.quests[id]; if (q.state !== 'active') continue; const def = QUESTS[id]; def.obj.forEach((o, i) => { if (o.t === 'kill' && o.id === mon && (q.prog[i] || 0) < o.n) { q.prog[i] = (q.prog[i] || 0) + 1; toast(`${o.text}: ${q.prog[i]}/${o.n}`); } }); } questRecheck(); }
function questBoss(mon) { for (const id in G.prof.quests) { const q = G.prof.quests[id]; if (q.state !== 'active') continue; QUESTS[id].obj.forEach((o, i) => { if (o.t === 'boss' && o.id === mon) q.prog[i] = 1; }); } questRecheck(); }
function questTame() { for (const id in G.prof.quests) { const q = G.prof.quests[id]; if (q.state !== 'active') continue; QUESTS[id].obj.forEach((o, i) => { if (o.t === 'tame') q.prog[i] = (q.prog[i] || 0) + 1; }); } questRecheck(); }
function questTalk(npcId) {
  for (const id in G.prof.quests) { const q = G.prof.quests[id]; if (q.state !== 'active') continue; const def = QUESTS[id];
    def.obj.forEach((o, i) => { if (o.t === 'talk' && o.id === npcId && !q.prog[i]) { const prev = def.obj.every((oo, j) => j >= i || objProgress(q, def, j) >= objNeed(oo)); if (prev) { q.prog[i] = 1; } } }); }
  questRecheck();
}
let _reachT = 0;
function questReach(dt) {
  _reachT -= dt; if (_reachT > 0) return; _reachT = 0.4; const P = G.P;
  for (const id in G.prof.quests) { const q = G.prof.quests[id]; if (q.state !== 'active') continue; QUESTS[id].obj.forEach((o, i) => { if (o.t === 'reach' && !q.prog[i]) { const l = LOCS[o.id]; if (Math.hypot(P.x / TS - l.x, P.y / TS - l.y) < l.r) { q.prog[i] = 1; toast(`📍 ${l.name}`, 'good'); questRecheck(); } } }); }
}
function rewardText(r) { const a = []; if (r.xp) a.push(`${r.xp} опыта`); if (r.gold) a.push(`${r.gold} золота`); (r.items || []).forEach(([id, n]) => a.push(`${ITEMS[id].icon} ${ITEMS[id].name}${n > 1 ? ' ×' + n : ''}`)); return a.join(', '); }
function turnInQuest(id) {
  const q = qstate(id), d = QUESTS[id], r = d.reward; d.obj.forEach(o => { if (o.t === 'collect') removeItem(o.id, o.n); });
  q.state = 'done'; const goldMul = G.events.festival ? 2 : 1;
  if (r.xp) gainXp(r.xp); if (r.gold) { addGold(r.gold * goldMul); floatText(G.P.x, G.P.y - 70, `+${r.gold * goldMul}💰`, '#fd4'); Snd.play('coin'); }
  (r.items || []).forEach(([iid, n]) => addItem(iid, n)); Snd.play('quest'); toast(`✔ Задание завершено: ${d.name}`, 'good'); logMsg(`Задание завершено: ${d.name}. Награда: ${rewardText(r)}`, 'good'); UI.dirty = true;
  if (d.autoNext && !G.prof.quests[d.autoNext]) later(0.5, () => acceptQuest(d.autoNext));
  if (d.ending) later(1.5, () => UI.showEnding());
}

/* ---------- NPC ---------- */
function relOf(id) { return G.prof.rel[id] || (G.prof.rel[id] = { rel: 0, talks: 0, gifts: 0, day: -1, giftDay: -1 }); }
function relTier(v) { return v < 10 ? 'Незнакомец' : v < 30 ? 'Знакомый' : v < 60 ? 'Приятель' : v < 85 ? 'Друг' : 'Близкий друг'; }
function shopDiscount(npcId) { let d = 0; if (G.events.market) d += 0.1; if (!npcId) return d; const r = relOf(npcId).rel; if (r >= 85) d += 0.1; else if (r >= 60) d += 0.05; return d; }
function spotPx(name) { const s = SPOTS[name] || SPOTS.plaza; return { x: (s[0] + 0.5) * TS, y: (s[1] + 1) * TS - 6 }; }
function desiredSpot(def) {
  const h = gt().hf;
  if (def.eventOnly && !G.events[def.eventOnly]) return { spot: def.home, hide: true };
  if (G.events.festival && !def.eventOnly && ['maren', 'grum', 'tilda', 'orlo', 'iris', 'rurik', 'berta', 'daren', 'lyandr', 'torvald', 'selena', 'pip'].includes(def.id)) { const pl = ['plaza', 'plaza2', 'plaza3', 'plaza4']; return { spot: pl[(def.id.charCodeAt(0) + def.id.length) % 4], hide: false }; }
  for (const [a, b, sp] of def.routine) { if (a <= b ? (h >= a && h < b) : (h >= a || h < b)) return { spot: sp, hide: false }; }
  return { spot: def.home, hide: true };
}
function initNPCs() {
  G.npcs = NPCS.map(def => { const n = { kind: 'npc', def, id: def.id, x: 0, y: 0, path: [], pi: 0, inside: false, dir: 'down', flip: false, moving: false, t0: rand(0, 9), spot: null, wt: rand(2, 6), bubble: null, chat: rand(6, 20), hide: false }; placeNPC(n); return n; });
}
function placeNPC(n) { const w = desiredSpot(n.def); const p = spotPx(w.hide ? n.def.home : w.spot); n.x = p.x; n.y = p.y; n.spot = w.spot; n.hide = w.hide; n.inside = w.hide; n.path = []; n.px = n.x; n.py = n.y; }
function updateNPC(n, dt) {
  n.t0 += dt; n.chat -= dt;
  n.rt = (n.rt || 0) - dt;
  if (n.rt <= 0) {
    n.rt = 1 + Math.random(); const w = desiredSpot(n.def);
    if (w.spot !== n.spot || w.hide !== n.hide) {
      n.spot = w.spot; n.hide = w.hide;
      if (n.inside && !w.hide) { const p = spotPx(n.def.home); n.x = p.x; n.y = p.y; n.inside = false; }
      const tp = spotPx(w.spot); n.path = G.world.findPath(Math.floor(n.x / TS), Math.floor((n.y - 4) / TS), Math.floor(tp.x / TS), Math.floor((tp.y - 4) / TS)); n.pi = 0;
    }
  }
  if (n.inside) return;
  if (G.dialog && G.dialog.npc === n) { n.moving = false; const P = G.P; const dx = P.x - n.x; if (Math.abs(P.y - n.y) > Math.abs(dx)) { n.dir = P.y > n.y ? 'down' : 'up'; } else { n.dir = 'side'; n.flip = dx < 0; } return; }
  if (n.path.length && n.pi < n.path.length) {
    const [tx, ty] = n.path[n.pi], gx = (tx + 0.5) * TS, gy = (ty + 1) * TS - 6, dx = gx - n.x, dy = gy - n.y, d = Math.hypot(dx, dy), sp = 62 * dt;
    if (d <= sp) { n.x = gx; n.y = gy; n.pi++; } else { n.x += dx / d * sp; n.y += dy / d * sp; }
    n.moving = true; if (Math.abs(dy) > Math.abs(dx)) n.dir = dy > 0 ? 'down' : 'up'; else { n.dir = 'side'; n.flip = dx < 0; }
    if (n.pi >= n.path.length) { n.path = []; if (n.hide) { n.inside = true; } }
  } else {
    n.moving = false;
    if (n.hide && !n.inside) { n.inside = true; return; }
    n.wt -= dt; const wr = n.def.wander || 0;
    if (n.wt <= 0 && wr > 0 && !n.hide) { n.wt = rand(3, 8); const sp = spotPx(n.spot), tx = Math.floor(sp.x / TS + rand(-wr, wr)), ty = Math.floor(sp.y / TS + rand(-wr, wr)); if (G.world.walk(tx, ty)) { n.path = G.world.findPath(Math.floor(n.x / TS), Math.floor((n.y - 4) / TS), tx, ty); n.pi = 0; } }
    else if (n.wt <= 0) n.wt = rand(3, 8);
    if (!n.path.length && Math.random() < dt * 0.15) { n.dir = pick(['down', 'side', 'side', 'down']); n.flip = Math.random() < 0.5; }
  }
  // реплики
  if (n.chat <= 0) { n.chat = rand(14, 32); if (Math.hypot(G.P.x - n.x, G.P.y - n.y) < 260 && !n.bubble) { const L = n.def.lines, pool = G.events.festival ? L.festival : G.weather.amt > 0.4 ? L.rain : isNight() ? L.night : L.day; n.bubble = { text: pick(pool), until: G.t + 4.5 }; } }
  if (n.bubble && n.bubble.until < G.t) n.bubble = null;
}
function npcQuestMark(n) {
  if (n.inside) return null; let mark = null;
  for (const id in G.prof.quests) { const q = G.prof.quests[id]; if (q.state === 'active' && q.ready && (QUESTS[id].turnIn || QUESTS[id].giver) === n.id) return '?'; }
  for (const id in QUESTS) if (QUESTS[id].giver === n.id && questAvailable(id) && G.prof.lvl >= QUESTS[id].lvl - 3) { mark = QUESTS[id].main ? '❗' : '!'; if (QUESTS[id].main) return mark; }
  return mark;
}

/* ---------- События ---------- */
function evActive(ev, m) { const d = calc(m), h = d.hf; if (ev.to <= 24) return ev.when(d) && h >= ev.from && h < ev.to; return (ev.when(d) && h >= ev.from) || (h < ev.to - 24 && ev.when(calc(m - 1440))); }
function updateEvents(silent) {
  for (const ev of EVENTS) {
    const act = evActive(ev, G.min);
    if (act && !G.events[ev.id]) { G.events[ev.id] = true; onEventStart(ev, silent); } else if (!act && G.events[ev.id]) { delete G.events[ev.id]; onEventEnd(ev); }
  }
}
function evName(ev) { return ev.id === 'festival' ? FESTIVAL_NAMES[Math.floor(gt().month / 3)] : ev.name; }
function onEventStart(ev, silent) {
  if (!silent) { UI.banner(`${ev.icon} ${evName(ev)}`, ev.desc); Snd.play('bell'); logMsg(`Событие: ${evName(ev)} — ${ev.desc}`, 'event'); }
  const p = G.prof; if (!G.P) return;
  if (ev.id === 'wolfnight' && !silent) {
    const lv = clamp(p.lvl, 2, 9); let n = 0, tries = 0;
    while (n < 8 && tries++ < 200) { const a = rand(0, TAU), r = rand(17, 24), x = Math.round(50 + Math.cos(a) * r), y = Math.round(50 + Math.sin(a) * r); if (G.world.walk(x, y)) { const m = spawnEventMon('wolf', x, y, lv, 'wolfnight'); m.state = 'idle'; m.aggroBoost = 2.5; n++; } }
    const bp = G.world.nearestWalk(50, 74); const b = spawnEventMon('direwolf', bp[0], bp[1], 10, 'wolfnight'); b.state = 'idle'; b.boss = true; b.sp = { boss: null };
    Snd.mood = 'battle';
  }
  if (ev.id === 'fishing') G.fishPts = 0;
  if (ev.id === 'raid' && !silent) { G.raid = { killed: 0, total: 0, wave: 0, nextWave: G.min }; }
}
function raidWave() {
  const r = G.raid; r.wave++; const lv = clamp(G.prof.lvl, 4, 12); logMsg(`Гоблины! Волна ${r.wave}/3 у восточных ворот!`, 'bad'); UI.banner('👺 Волна гоблинов!', `Волна ${r.wave} из 3 — к восточным воротам!`); Snd.play('roar');
  for (let i = 0; i < 6; i++) { const x = 67 + (i % 3), y = 47 + Math.floor(i / 3) * 3 + (i % 2); const p = G.world.nearestWalk(x, y); const m = spawnEventMon('goblin', p[0], p[1], lv, 'raid'); m.hx = 64 * TS; m.hy = 50 * TS; r.total++; }
}
function onEventEnd(ev) {
  logMsg(`Событие окончено: ${evName(ev)}`, 'event');
  if (ev.id === 'wolfnight') { G.mons = G.mons.filter(m => m.event !== 'wolfnight'); Snd.mood = 'day'; toast('Ночь Волков закончилась. Стаи ушли.', 'good'); }
  if (ev.id === 'raid' && G.raid) { const r = G.raid; const alive = G.mons.filter(m => m.event === 'raid' && !m.dead).length; G.mons = G.mons.filter(m => m.event !== 'raid');
    if (r.total && r.killed >= r.total * 0.7 && r.killed > 0) { addGold(300 + G.prof.lvl * 20); addItem('hp_2', 2); gainXp(150 + G.prof.lvl * 30); UI.banner('🏰 Город спасён!', `Вы отбили набег. Мэр награждает вас: ${300 + G.prof.lvl * 20} золота`); } else logMsg('Гоблины разграбили окраины. Город пострадал.', 'bad');
    G.raid = null; }
  if (ev.id === 'tourney' && G.tourney) endTourney(false);
  if (ev.id === 'fishing' && G.fishPts > 0) { const g = Math.round(G.fishPts * 1.3) + (G.fishPts >= 250 ? 150 : 0); addGold(g); UI.banner('🎣 Итоги рыбацкого турнира', `Очков: ${G.fishPts}. Награда: ${g} золота`); G.fishPts = 0; }
}
function eventsOnDay(absDay) { const d0 = calc(absDay * 1440 + 720); return EVENTS.filter(ev => ev.when(d0)); }
function upcomingEvents(n = 5) { const out = []; const t0 = gt().absDay; for (let i = 0; i < 40 && out.length < n; i++) { eventsOnDay(t0 + i).forEach(ev => out.push({ ev, absDay: t0 + i })); } return out; }

/* ---------- Турнир ---------- */
function startTourney() {
  const p = G.prof; if (p.gold < 50) return false; p.gold -= 50; G.tourney = { wave: 0 }; G.P.x = 62 * TS + 16; G.P.y = 64 * TS; G.P.hp = G.P.maxHp; G.P.res = G.P.maxRes; UI.banner('🏆 Турнир начинается!', 'Победите три волны на арене!'); later(1.5, spawnTourneyWave); return true;
}
function spawnTourneyWave() {
  const t = G.tourney; if (!t) return; t.wave++; const lv = G.prof.lvl; const pool = lv < 5 ? ['boar', 'wolf', 'bandit'] : lv < 9 ? ['wolf', 'bandit', 'spider', 'skeleton'] : lv < 14 ? ['skeleton', 'bear', 'troll'] : ['troll', 'cultist', 'golem'];
  const n = t.wave === 3 ? 2 : 2 + t.wave; if (t.wave === 3) { UI.banner('Последняя волна!', 'Элитные соперники'); }
  for (let i = 0; i < n; i++) { const id = t.wave === 3 ? pool[pool.length - 1] : pick(pool), a = i / n * TAU, x = Math.round(62 + Math.cos(a) * 3), y = Math.round(67 + Math.sin(a) * 2.5); const m = spawnEventMon(id, x, y, Math.max(MON[id].lvl[0], lv), 'tourney'); m.aggroBoost = 3; if (t.wave === 3) { m.hp = m.maxHp = m.maxHp * 1.6; } m.hx = 62 * TS; m.hy = 67 * TS; }
  toast(`Волна ${t.wave} из 3`, 'good');
}
function tourneyCheck() { const t = G.tourney; if (!t) return; if (G.mons.some(m => m.event === 'tourney' && !m.dead)) return; if (t.wave < 3) later(2.5, spawnTourneyWave); else endTourney(true); }
function endTourney(win) {
  G.mons = G.mons.filter(m => m.event !== 'tourney' || (m.dead && false)); const lv = G.prof.lvl; G.tourney = null;
  if (win) { const g = 250 + lv * 30; addGold(g); gainXp(100 + lv * 20); addItem(pick(['hp_2', 'rs_2', 'elx_might', 'elx_skin']), 1); UI.banner('🏆 Победа на турнире!', `Награда: ${g} золота`); Snd.play('levelup'); } else toast('Турнир окончен', 'warn');
}

/* ---------- Диалоги ---------- */
function npcByDef(id) { return G.npcs.find(n => n.id === id); }
function greeting(n) {
  const def = n.def, r = relOf(def.id).rel, L = def.lines; let pool = G.events.festival ? L.festival : (G.weather.amt > 0.4 ? L.rain : isNight() ? L.night : L.day);
  let t = pick(pool); const tier = relTier(r);
  if (r >= 85) t = `Мой дорогой друг, ${G.prof.name}! ` + t; else if (r >= 60) t = `А, ${G.prof.name}! Рад видеть. ` + t; else if (r >= 30) t = `Здравствуй, ${G.prof.name}. ` + t; else if (relOf(def.id).talks === 0) t = `Приветствую, путник. Я — ${def.name}. ` + t;
  return t;
}
function openDialog(n) {
  if (G.dialog) return; const def = n.def; const rel = relOf(def.id), day = gt().absDay;
  if (rel.day !== day) { rel.day = day; rel.rel = Math.min(100, rel.rel + 2); } rel.talks++;
  G.dialog = { npc: n, text: '', opts: [] }; questTalk(def.id); dialogMain(n, greeting(n)); UI.showDialog(); Snd.play('click');
}
function closeDialog() { G.dialog = null; UI.hideDialog(); }
function dialogSay(n, text, opts) { G.dialog.text = text; G.dialog.opts = opts; UI.renderDialog(true); }
function dialogMain(n, text) {
  const def = n.def, p = G.prof, opts = [];
  // сдача заданий
  for (const id in p.quests) { const q = p.quests[id]; if (q.state === 'active' && q.ready && (QUESTS[id].turnIn || QUESTS[id].giver) === def.id) { const d = QUESTS[id]; opts.push({ label: `✔ Сдать задание: ${d.name}`, cls: 'quest', fn: () => { turnInQuest(id); if (d.auto) { } dialogMain(n, `${d.done}\n\n🎁 Награда: ${rewardText(d.reward)}`); } }); } }
  // напоминания
  for (const id in p.quests) { const q = p.quests[id]; const d = QUESTS[id]; if (q.state === 'active' && !q.ready && (d.giver === def.id || d.turnIn === def.id)) { opts.push({ label: `📜 Задание: ${d.name}`, cls: 'quest', fn: () => { const lines = d.obj.map((o, i) => `• ${o.text}: ${objProgress(q, d, i)}/${objNeed(o)}`).join('\n'); dialogMain(n, `${d.progress || 'Как продвигается дело?'}\n\n${lines}`); } }); } }
  // предложения
  for (const id in QUESTS) { const d = QUESTS[id]; if (d.giver === def.id && questAvailable(id)) { opts.push({ label: `${d.main ? '❗' : '❔'} Есть задание: ${d.name}${p.lvl < d.lvl ? ` (рек. ур. ${d.lvl})` : ''}`, cls: 'quest', fn: () => dialogSay(n, `${d.offer}\n\n📌 ${d.desc}\n🎁 Награда: ${rewardText(d.reward)}`, [{ label: 'Принять', cls: 'quest', fn: () => { acceptQuest(id); if (d.auto) { turnInQuest(id); } dialogMain(n, 'Отлично. Удачи!'); } }, { label: 'Не сейчас', fn: () => dialogMain(n, 'Как скажешь. Я буду здесь.') }]) }); } }
  if (def.shop) opts.push({ label: '🛒 Торговать', fn: () => { closeDialog(); openShop(def.shop, n); } });
  if (def.id === 'berta') opts.push({ label: '🍳 Кухня: приготовить блюдо', fn: () => { closeDialog(); openCraft('cook', n); } });
  if (def.id === 'orlo') opts.push({ label: '⚗️ Алхимический стол: варить зелья', fn: () => { closeDialog(); openCraft('alch', n); } });
  if (def.id === 'grum') opts.push({ label: '🔨 Кузнечный горн: ковка и заточка', fn: () => { closeDialog(); openCraft('smith', n); } });
  if (def.id === 'maren') opts.push({ label: '🏗 Проекты города', fn: () => { closeDialog(); openProjects(n); } });
  if (def.inn) {
    opts.push({ label: '🛏 Снять комнату до утра (20 зол.)', fn: () => { if (p.gold < 20) return dialogMain(n, 'Комната стоит 20 золотых — увы, у вас не хватает.'); p.gold -= 20; closeDialog(); sleepAtInn(); } });
    opts.push({ label: '🍲 Горячий обед (15 зол., регенерация)', fn: () => { if (p.gold < 15) return dialogMain(n, 'Обед — 15 золотых.'); p.gold -= 15; addBuff('meal', 'Сытный обед', '🍲', { hpRegen: 3 }, 180); Snd.play('heal'); dialogMain(n, 'Кушайте на здоровье!'); } });
  }
  if (def.arena) {
    if (G.events.tourney && !G.tourney) opts.push({ label: '🏆 Участвовать в турнире (50 зол.)', cls: 'quest', fn: () => { if (p.gold < 50) return dialogMain(n, 'Нужно 50 золотых взноса.'); closeDialog(); startTourney(); } });
    else if (!G.events.tourney) opts.push({ label: '📅 Когда турнир?', fn: () => { const nx = upcomingEvents(40).find(e => e.ev.id === 'tourney'); dialogMain(n, nx ? `Ближайший турнир — ${(calc(nx.absDay * 1440).day)} ${MONTHS_GEN[calc(nx.absDay * 1440).month]}, с 14:00 до 18:00. Три волны — и золото твоё!` : 'Скоро, скоро…'); } });
  }
  if (def.temple) opts.push({ label: `✨ Забыть умения (${50 * p.lvl} зол.)`, fn: () => dialogSay(n, `Я помогу вам заново распределить очки умений. Пожертвование — ${50 * p.lvl} золотых.`, [{ label: 'Согласиться', fn: () => { if (p.gold < 50 * p.lvl) return dialogMain(n, 'Увы, у вас не хватает золота.'); p.gold -= 50 * p.lvl; respecSkills(); Snd.play('heal'); dialogMain(n, 'Готово. Выбирайте путь заново.'); } }, { label: 'Назад', fn: () => dialogMain(n, 'Как пожелаете.') }]) });
  // слухи
  const rum = (def.rumors || []).filter(r => !r.q || qstate(r.q));
  if (def.id === 'berta') { const up = upcomingEvents(3).map(e => { const d = calc(e.absDay * 1440); return `${d.day} ${MONTHS_GEN[d.month]} — ${e.ev.icon} ${evName(e.ev)}`; }); rum.push({ t: 'Ближайшие события: ' + up.join('; ') + '.' }); }
  if (rum.length) opts.push({ label: '💬 Что слышно?', fn: () => { const h = p.heard[def.id] || 0; p.heard[def.id] = h + 1; dialogMain(n, rum[h % rum.length].t); } });
  opts.push({ label: '🎁 Подарить предмет', fn: () => giftMenu(n) });
  opts.push({ label: 'Уйти', cls: 'bye', fn: () => closeDialog() });
  dialogSay(n, text, opts);
}
function giftMenu(n) {
  const p = G.prof, def = n.def; const items = p.inv.filter(s => !ITEMS[s.id].type.match(/quest|weapon|armor/) && ITEMS[s.id].price > 0).slice(0, 9);
  const opts = items.map(s => { const it = ITEMS[s.id]; return { label: `${it.icon} ${it.name} ×${s.n}`, fn: () => { const rel = relOf(def.id), day = gt().absDay; if (rel.giftDay === day) return dialogMain(n, 'Спасибо, но сегодня ты уже дарил мне подарок.'); rel.giftDay = day; const liked = (def.gifts || []).includes(it.id); removeItem(it.id, 1); rel.rel = Math.min(100, rel.rel + (liked ? 12 : 4)); rel.gifts++; Snd.play('heal'); dialogMain(n, liked ? `Это же именно то, что я люблю! Спасибо тебе! (Отношение: ${relTier(rel.rel)})` : `О, спасибо за подарок. (Отношение: ${relTier(rel.rel)})`); } }; });
  opts.push({ label: 'Назад', fn: () => dialogMain(n, 'Что-нибудь ещё?') });
  dialogSay(n, items.length ? 'Что вы хотите подарить?' : 'У вас нечего подарить.', opts);
}
function sleepAtInn() {
  UI.fade(() => {
    const d = gt(); const target = (d.absDay + (d.hour < 7 ? 0 : 1)) * 1440 + 7 * 60;
    while (G.min < target) { G.min += 1; onMinute(); }
    const P = G.P; P.hp = P.maxHp; P.res = P.maxRes; P.buffs = []; recalc(); if (G.petEnt) { G.petEnt.hp = G.petEnt.maxHp; G.petEnt.down = 0; }
    G.npcs.forEach(placeNPC); G.mons.forEach(m => { if (!m.event && !m.boss && m.dead) m.respawnAt = 0; });
    logMsg('Вы выспались. Новый день начался!', 'good'); saveGame(true);
  });
}

/* ---------- Магазин ---------- */
function openShop(id, n) { const sh = SHOPS[id]; G.shop = { id, def: sh, npc: n, tab: 'buy' }; UI.showShop(); Snd.play('click'); }
function itemPrice(it, npcId) { return Math.max(1, Math.round(it.price * (1 - shopDiscount(npcId)))); }
function petPrice(pid, npcId) { return Math.max(1, Math.round(PETS[pid].price * (1 - shopDiscount(npcId)))); }
function buyItem(itemId) {
  const s = G.shop, it = ITEMS[itemId], price = itemPrice(it, s.def.npc), p = G.prof;
  if (p.gold < price) { toast('Не хватает золота', 'warn'); Snd.play('error'); return; }
  if (it.req > p.lvl) { toast(`Требуется уровень ${it.req}`, 'warn'); }
  if (p.inv.length >= invCap() && !p.inv.some(x => x.id === itemId && x.n < it.stack)) { toast('Сумка полна', 'warn'); return; }
  p.gold -= price; addItem(itemId, 1, true); Snd.play('coin'); UI.dirty = true; relOf(s.def.npc).rel = Math.min(100, relOf(s.def.npc).rel + 0.3);
}
function buyPet(pid) {
  const s = G.shop, price = petPrice(pid, s.def.npc), p = G.prof;
  if (p.cls !== 'hunter') { toast('Питомцев может держать только Охотник', 'warn'); Snd.play('error'); return; }
  if (p.gold < price) { toast('Не хватает золота', 'warn'); Snd.play('error'); return; } if (p.pets.length >= 8) { toast('Максимум 8 питомцев', 'warn'); return; }
  p.gold -= price; addPet(pid); Snd.play('tame'); toast(`🐾 Новый питомец: ${PETS[pid].name}`, 'good'); UI.dirty = true;
}
function sellItem(idx) {
  const p = G.prof, s = p.inv[idx]; if (!s) return; const it = ITEMS[s.id]; if (it.type === 'quest' || it.price <= 0) { toast('Этот предмет нельзя продать', 'warn'); return; }
  const price = sellPrice(it); s.n--; if (s.n <= 0) p.inv.splice(idx, 1); addGold(price); Snd.play('coin'); UI.dirty = true;
}

/* ---------- Взаимодействие ---------- */
function nearbyInteractable() {
  const P = G.P; let best = null, bd = 1e9;
  if (G.fish) return { type: 'fishing', label: G.fish.state === 'bite' ? 'Подсечь!' : 'Ждать поклёвку… (E — убрать)', o: { x: P.x, y: P.y } };
  for (const n of G.npcs) { if (n.inside) continue; const d = Math.hypot(n.x - P.x, n.y - P.y); if (d < 68 && d < bd) { bd = d; best = { type: 'npc', n, label: `Поговорить: ${n.def.name}` }; } }
  const objs = G.world.objs; const T_OK = { chest: 1, herb: 1, ore: 1, plot: 1, portal: 1, door: 1, ibed: 1, table: 1, stove: 1, bin: 1, board: 1 };
  for (const o of objs) {
    if (!T_OK[o.t]) continue; if (Math.abs(o.x - P.x) > 64 || Math.abs(o.y - P.y) > 64) continue; if (o.cd > 0) continue;
    if (o.t === 'chest' && G.opened.has(o.id)) continue; if (o.t === 'table' && G.prof.flags.letter) continue; const d = Math.hypot(o.x - P.x, o.y - 8 - P.y), lim = o.t === 'plot' ? 30 : o.t === 'portal' ? 46 : 52;
    if (d < lim && d < bd) { bd = d; const lab = { chest: o.boss ? '⭐ Открыть сундук босса' : 'Открыть сундук', herb: 'Собрать: Лунный корень', ore: 'Добыть: Железная руда', plot: plotLabel(o), portal: o.exit ? 'Выйти из подземелья' : `Войти: ${o.label} (рек. ур. ${o.lvl})`, door: o.label, ibed: 'Лечь спать (после 18:00)', table: 'Прочесть письмо деда', stove: 'Плита: готовить', bin: 'Ящик отгрузки', board: 'Доска заказов' }; best = { type: o.t, o, label: lab[o.t] }; }
  }
  if (!best || bd > 24) { const w = waterAhead(); if (w && (!best || best.type !== 'npc')) best = { type: 'water', o: w, label: 'Рыбачить (удочка)' }; }
  return best;
}
function interact() {
  const P = G.P; if (P.dead || G.dialog || G.paused) return; const it = nearbyInteractable(); if (!it) return;
  if (it.type === 'fishing') fishPress();
  else if (it.type === 'water') startFish(it.o);
  else if (it.type === 'plot') plotAction(it.o);
  else if (it.type === 'portal') usePortal(it.o);
  else if (it.type === 'door') { usePortal(it.o); if (it.o.exit) tutAdvance(2); }
  else if (it.type === 'ibed') sleepHome();
  else if (it.type === 'table') { G.prof.flags.letter = true; UI.showLetter(); tutAdvance(0); }
  else if (it.type === 'stove') openCraft('cook', null);
  else if (it.type === 'bin') openBin();
  else if (it.type === 'board') openBoard();
  else if (it.type === 'npc') openDialog(it.n);
  else if (it.type === 'chest') {
    const o = it.o; G.opened.add(o.id); if (o.boss) { G.prof.bossChests = (G.prof.bossChests || []).filter(c => c.id !== o.id); G.world.objs = G.world.objs.filter(x => x !== o); } if (o.id === 'home_chest') tutAdvance(1); G.prof.opened = Array.from(G.opened); Snd.play('pickup'); const g = Math.round(o.gold * G.S.gold); addGold(g); floatText(o.x, o.y - 30, `+${g}💰`, '#fd4'); (o.loot || []).forEach(([id, n]) => addItem(id, n)); logMsg(`Сундук открыт: +${g} золота`, 'good'); burst(o.x, o.y - 14, '#ffd23a', 16, 60);
  } else { const o = it.o; addItem(o.item, 1); o.cd = 1; Snd.play('pickup'); burst(o.x, o.y - 10, o.t === 'herb' ? '#6f6' : '#fc8', 10, 40); later(90, () => { o.cd = 0; }); }
}

/* ---------- Время / погода ---------- */
let _lastMin = -1;
function onMinute() {
  updateEvents(); { const dd = gt(); if (dd.hour === 6 && dd.minute === 0 && G.P) newDay(); }
  if (G.raid) { const r = G.raid, d = gt(); if (r.wave < 3 && G.min >= r.nextWave) { raidWave(); r.nextWave = G.min + (r.wave === 1 ? 60 : 90); } }
  const d = gt(); if (d.minute === 0 && d.hour === 5) { logMsg(`Наступило утро. ${WEEKDAYS[d.wd]}, ${d.day} ${MONTHS_GEN[d.month]}.`); }
}
function rainAt(m) { const d = calc(m); if (hash2(d.absDay, 3) > 0.32) return false; const s = hash2(d.absDay, 1) * 18, len = 3 + hash2(d.absDay, 2) * 6; return d.hf >= s && d.hf < s + len; }
function updateWeather(dt) {
  const w = G.weather; w.kind = gt().season === 3 ? 'snow' : 'rain'; w.target = (G.settings.weather && rainAt(G.min)) ? 1 : 0; w.amt += clamp(w.target - w.amt, -dt * 0.1, dt * 0.1); if (w.amt > 0.4 && G.P && G.P.y < OW_H * TS) G.rainedToday = true;
}

/* ---------- Старт / сохранение ---------- */
function encodeRevealed() { let s = ''; const r = G.revealed; for (let i = 0; i < r.length; i++) s += r[i] ? '1' : '0'; return s; }
function decodeRevealed(s) { const r = new Uint8Array(WW * WH); if (s) for (let i = 0; i < r.length && i < s.length; i++) r[i] = s[i] === '1' ? 1 : 0; return r; }
function saveGame(silent) {
  const p = G.prof, P = G.P; if (!p || !P) return; p.pos = { x: P.x, y: P.y }; p.hp = P.hp; p.res = P.res; p.min = G.min; p.opened = Array.from(G.opened); p.revealed = encodeRevealed(); p.lastPlayed = Date.now();
  const ok = Save.put(p); Save.setLast(p.id); G.lastSave = G.t; if (!silent) toast(ok ? '💾 Игра сохранена' : 'Не удалось сохранить (память браузера полна)', ok ? 'good' : 'warn');
}
function startGame(prof) {
  if (!G.world) { G.world = genWorld(); }
  if (prof.flags.tut === undefined) prof.flags.tut = 6;
  prof.farm = prof.farm || {}; prof.projects = prof.projects || {}; prof.plus = prof.plus || {}; if (prof.version < 2 && !prof.quests.st1 && !prof.quests.mq1) prof.quests.st1 = { state: 'active', prog: [0], ready: false }; prof.version = 2;
  G.prof = prof; G.P = makePlayer(); G.P.buffs = []; G.min = prof.min || START_ABS_MIN; G.opened = new Set(prof.opened); G.revealed = decodeRevealed(prof.revealed);
  G.cd = {}; G.proj = []; G.fx = []; G.texts = []; G.areas = []; G.timers = []; G.lightning = []; G.log = []; G.dialog = null; G.shop = null; G.panel = null; G.paused = false; G.target = null; G.tourney = null; G.raid = null; G.fish = null; G.rainedToday = false; G.events = {}; G.potCd = { hp: 0, rs: 0 };
  G.world.objs.forEach(o => { if (o.cd) o.cd = 0; });
  ensureLoadout(); recalc(); if (prof.hp >= 9000) { G.P.hp = G.P.maxHp; G.P.res = G.P.maxRes; } else { G.P.hp = clamp(prof.hp, 1, G.P.maxHp); G.P.res = clamp(prof.res, 0, G.P.maxRes); }
  if (CLASSES[prof.cls].res === 'rage') G.P.res = 0;
  restoreBossChests(); G.world.paintMini(G.revealed); spawnMonsters(); initNPCs(); G.petEnt = null; if (prof.activePet && prof.pets.find(p => p.uid === prof.activePet)) summonPet(prof.activePet); else prof.activePet = null;
  updateEvents(true); G.mode = 'play'; G.cam.x = G.P.x - 400; G.cam.y = G.P.y - 300; _lastMin = -1; G.lastSave = G.t;
  Save.setLast(prof.id); UI.enterGame(); Snd.startMusic(); logMsg(`Добро пожаловать, ${prof.name}!`, 'good');
  if (!prof.flags.intro) { prof.flags.intro = true; UI.showIntro(); }
  saveGame(true);
}

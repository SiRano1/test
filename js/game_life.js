'use strict';
/* ===== Повседневная жизнь: ферма, рыбалка, крафт, заказы, проекты города, подземелья ===== */
G.fish = null; G.rainedToday = false; G.fishPts = 0;
const gameDay = () => Math.floor((G.min - 360) / 1440);

/* ---------- Универсальные события заданий ---------- */
function questEvent(t, id) {
  for (const qid in G.prof.quests) { const q = G.prof.quests[qid]; if (q.state !== 'active') continue;
    QUESTS[qid].obj.forEach((o, i) => { if (o.t === t && (o.id === 'any' || o.id === id) && (q.prog[i] || 0) < o.n) { q.prog[i] = (q.prog[i] || 0) + 1; toast(`${o.text}: ${q.prog[i]}/${o.n}`); } }); }
  questRecheck();
}

/* ---------- Ферма ---------- */
function bestSeed() { const s = gt().season; const sd = G.prof.inv.find(x => ITEMS[x.id].type === 'seed' && CROPS[ITEMS[x.id].crop].seasons.includes(s)); return sd ? sd.id : null; }
function plotLabel(o) {
  const f = G.prof.farm[o.key]; if (!f) { const sd = bestSeed(); return sd ? `Посадить: ${CROPS[ITEMS[sd].crop].name}` : 'Грядка (нет семян для сезона)'; }
  const c = CROPS[f.crop]; if (f.grown >= c.days) return `Собрать: ${c.name}`; if (!f.wet) return `Полить: ${c.name} (${f.grown}/${c.days})`; return `${c.name}: ${f.grown}/${c.days} · полито`;
}
function plotAction(o) {
  const f = G.prof.farm[o.key], P = G.P;
  if (!f) {
    const sd = bestSeed(); if (!sd) { toast(`Нет семян для сезона «${SEASONS[gt().season]}». Купите у Хобба.`, 'warn'); Snd.play('error'); return; }
    removeItem(sd, 1); G.prof.farm[o.key] = { crop: ITEMS[sd].crop, grown: 0, wet: G.weather.amt > 0.3 }; Snd.play('pickup'); burst(o.x, o.y - 6, '#8a6a3a', 8, 40); questEvent('plant', 'any'); UI.dirty = true; return;
  }
  const c = CROPS[f.crop];
  if (f.grown >= c.days) {
    const n = 1 + (Math.random() < 0.25 * G.S.luck ? 1 : 0); addItem('crop_' + f.crop, n); delete G.prof.farm[o.key]; gainXp(6 + c.days * 2); Snd.play('coin'); burst(o.x, o.y - 8, c.col, 12, 50); questEvent('harvest', 'any'); G.prof.flags.harvested = (G.prof.flags.harvested || 0) + n; return;
  }
  if (!f.wet) { f.wet = true; Snd.play('heal'); burst(o.x, o.y - 6, '#6af', 10, 40); return; }
  toast(`${c.name}: день ${f.grown} из ${c.days}. Уже полито — растёт!`);
}
function farmNewDay() {
  const d = gt(), s = d.season, newSeason = d.day === 1 && d.month % 3 === 0; let grown = 0, died = 0;
  for (const key in G.prof.farm) { const f = G.prof.farm[key], c = CROPS[f.crop]; if (newSeason && !c.seasons.includes(s)) { delete G.prof.farm[key]; died++; continue; } if ((f.wet || G.rainedToday) && f.grown < c.days) { f.grown++; grown++; } f.wet = false; }
  G.rainedToday = false; return { grown, died };
}
function newDay() {
  const r = farmNewDay(), d = gt(); ensureDaily();
  let msg = `🌅 Новый день! ${WEEKDAYS[d.wd]}, ${d.day} ${MONTHS_GEN[d.month]}. Доска заказов обновлена.`; if (r.grown) msg += ` Выросло культур: ${r.grown}.`; if (r.died) msg += ` Увяло с приходом нового сезона: ${r.died}.`;
  logMsg(msg, 'good'); if (r.grown || r.died) toast(r.died ? `Сезон сменился: увяло ${r.died} растений` : `🌱 Урожай подрос: ${r.grown}`, r.died ? 'warn' : 'good'); UI.dirty = true;
  if (d.day === 1 && G.P) { G.prof.defeated = G.prof.defeated.filter(k => !RESPAWN_BOSSES.includes(k)); spawnMonsters(); logMsg('Новый месяц: боссы и логова монстров снова полны сил!', 'event'); toast('Новый месяц — боссы вернулись!', 'good'); }
}

/* ---------- Ежедневные заказы (доска объявлений) ---------- */
function strHash(s) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h >>> 0; }
function genBounties() {
  const p = G.prof, rnd = mulberry32(strHash(p.id) + gameDay() * 7919), L = p.lvl, out = [];
  const pool = Object.keys(MON).filter(id => { const m = MON[id]; return !m.boss && !m.passive && !m.night && !m.rare && m.lvl[0] <= L + 2 && m.lvl[1] >= L - 5; });
  const pk = () => pool[Math.floor(rnd() * pool.length)];
  for (let i = 0; i < 2 && pool.length; i++) { const id = pk(), m = MON[id], n = 4 + Math.floor(rnd() * 5); if (out.some(b => b.id === id)) { i--; if (pool.length < 2) break; continue; } out.push({ k: 'kill', id, n, prog: 0, gold: Math.round(((m.xp * 0.5 + (m.gold[0] + m.gold[1]) / 2) * n + 30) * 1.2), xp: Math.round(m.xp * n * 0.5), claimed: false }); }
  const dl = Object.keys(ITEMS).filter(id => ['crop', 'fish'].includes(ITEMS[id].type) || ['meat', 'wolf_pelt', 'boar_tusk', 'spider_silk', 'moonroot', 'iron_ore', 'bone', 'slime_gel'].includes(id));
  const id = dl[Math.floor(rnd() * dl.length)], it = ITEMS[id], n = 3 + Math.floor(rnd() * 4);
  out.push({ k: 'deliver', id, n, gold: Math.round(it.price * n * 1.6 + 25), xp: 20 + it.price, claimed: false });
  return out;
}
function ensureDaily() { const p = G.prof, d = gameDay(); if (!p.daily || p.daily.day !== d) p.daily = { day: d, list: genBounties(), total: (p.daily && p.daily.total) || 0 }; return p.daily; }
function bountyDone(b) { return b.k === 'kill' ? b.prog >= b.n : countItem(b.id) >= b.n; }
function claimBounty(i) {
  const b = ensureDaily().list[i]; if (!b || b.claimed || !bountyDone(b)) return; if (b.k === 'deliver') removeItem(b.id, b.n);
  b.claimed = true; addGold(b.gold * (G.events.festival ? 2 : 1)); gainXp(b.xp); Snd.play('quest'); G.prof.daily.total++; toast(`Заказ выполнен! +${b.gold}💰`, 'good');
  if (G.prof.daily.total % 5 === 0) { addItem('gem', 1); toast('💎 Бонус за 5 заказов: самоцвет!', 'good'); } UI.dirty = true;
}
function bountyKill(mon) { const d = G.prof.daily; if (!d || d.day !== gameDay()) return; d.list.forEach(b => { if (b.k === 'kill' && b.id === mon && b.prog < b.n) { b.prog++; if (b.prog === b.n) toast('📋 Заказ с доски выполнен — сдайте на доске!', 'good'); } }); }

/* ---------- Рыбалка ---------- */
function waterAhead() {
  const P = G.P; if (P.y >= OW_H * TS || !G.prof.inv.some(s => s.id === 'rod')) return null;
  const dx = P.dir === 'side' ? (P.flip ? -1 : 1) : 0, dy = P.dir === 'down' ? 1 : P.dir === 'up' ? -1 : 0;
  for (const d of [22, 36, 50]) { const px = P.x + dx * d, py = P.y - 4 + dy * d, tx = Math.floor(px / TS), ty = Math.floor(py / TS); if (tx < 0 || ty < 0 || tx >= WW || ty >= WH) continue; const t = G.world.tiles[ty * WW + tx]; if (t === T.DEEP || t === T.SHALLOW) return { x: px, y: py }; }
  return null;
}
function fishPress() {
  const f = G.fish; if (!f) return;
  if (f.state === 'bite') { catchFish(); G.fish = null; } else { G.fish = null; toast('Слишком рано — рыба ушла', 'warn'); }
}
function startFish(w) { G.fish = { state: 'wait', t: 0, wait: rand(2, 5.5), bx: w.x, by: w.y, sx: G.P.x, sy: G.P.y }; Snd.play('whoosh'); P_anim_cast(); }
function P_anim_cast() { const P = G.P; P.anim = { kind: 'cast', t: 0, dur: 0.4, hitAt: 2, done: true, p: 0 }; }
function updateFish(dt) {
  const f = G.fish; if (!f) return; const P = G.P;
  if (P.dead || P.moving || G.dialog || G.paused && false) { if (P.moving && f.t > 0.3) toast('Вы отошли от воды', 'warn'); G.fish = null; return; }
  f.t += dt;
  if (f.state === 'wait' && f.t >= f.wait) { f.state = 'bite'; f.t = 0; Snd.play('click'); floatText(f.bx, f.by - 20, '!', '#f44', 'big'); burst(f.bx, f.by, '#8cf', 10, 30); }
  else if (f.state === 'bite' && f.t > 1.1) { G.fish = null; toast('Рыба сорвалась…', 'warn'); }
}
function catchFish() {
  const s = gt().season, night = isNight(); const pool = FISH.filter(f => f.seasons.includes(s) && (!f.night || night)); const tot = pool.reduce((a, f) => a + f.w * (f.id === 'f_golden' ? G.S.luck : 1), 0);
  let r = Math.random() * tot, fish = pool[0]; for (const f of pool) { r -= f.w * (f.id === 'f_golden' ? G.S.luck : 1); if (r <= 0) { fish = f; break; } }
  addItem(fish.id, 1); Snd.play('pickup'); gainXp(4 + fish.price / 10); burst(G.fish ? G.fish.bx : G.P.x, G.P.y - 10, '#8cf', 14, 60); questEvent('fish', 'any'); G.prof.flags.fished = (G.prof.flags.fished || 0) + 1;
  if (G.events.fishing) { G.fishPts += fish.price; toast(`🎣 Очки турнира: ${G.fishPts}`, 'good'); }
}

/* ---------- Крафт ---------- */
function smithRecipes() {
  const p = G.prof, C = CLASSES[p.cls], wt = C.weapon, at = C.armor[0], base = at === 'cloth' ? ['spider_silk', 6] : ['iron_ingot', 4], base2 = at === 'cloth' ? ['spider_silk', 12] : ['iron_ingot', 8];
  return RECIPES.smith.concat([
    { out: `w_${wt}_1`, ing: [['iron_ingot', 4], ['wolf_pelt', 2]], gold: 60 }, { out: `w_${wt}_2`, ing: [['iron_ingot', 8], ['troll_hide', 2], ['gem', 1]], gold: 220 },
    { out: `a_${at}_body_1`, ing: [base, ['wolf_pelt', 3]], gold: 60 }, { out: `a_${at}_body_2`, ing: [base2, ['troll_hide', 3]], gold: 250 }
  ]);
}
function recipesFor(kind) { return kind === 'smith' ? smithRecipes() : RECIPES[kind]; }
function canCraft(r) { return r.ing.every(([id, n]) => countItem(id) >= n) && G.prof.gold >= (r.gold || 0); }
function doCraft(kind, r) {
  if (!canCraft(r)) { toast('Не хватает ингредиентов', 'warn'); Snd.play('error'); return; }
  if (G.prof.inv.length >= invCap() && !G.prof.inv.some(x => x.id === r.out && x.n < ITEMS[r.out].stack) && !r.ing.some(([id, n]) => countItem(id) === n)) { toast('Сумка полна', 'warn'); return; }
  r.ing.forEach(([id, n]) => removeItem(id, n)); if (r.gold) G.prof.gold -= r.gold; addItem(r.out, r.n || 1); Snd.play('coin'); gainXp(6); questEvent('craft', kind); UI.dirty = true;
}
const plusMax = () => PLUS_MAX + (G.prof.projects.forge ? 3 : 0);
function upgradeCost(n) { return { gold: 120 * (n + 1), ingots: 2 * (n + 1) }; }
function upgradeItem(slot) {
  const p = G.prof; if (!p.equip[slot]) return; const n = p.plus[slot] || 0; if (n >= plusMax()) { toast('Достигнут предел заточки', 'warn'); return; }
  const c = upgradeCost(n); if (p.gold < c.gold || countItem('iron_ingot') < c.ingots) { toast('Не хватает золота или слитков', 'warn'); Snd.play('error'); return; }
  p.gold -= c.gold; removeItem('iron_ingot', c.ingots); const chance = n < 3 ? 1 : 0.9 - 0.1 * (n - 3);
  if (Math.random() < chance) { p.plus[slot] = n + 1; Snd.play('levelup'); toast(`⚒ Заточка удалась: +${n + 1}`, 'good'); recalc(); } else { Snd.play('error'); toast('Заточка не удалась — металл треснул', 'warn'); }
  UI.dirty = true;
}
function openCraft(kind, npc) { G.shop = { craft: kind, npc, tab: 'make', def: { name: kind === 'cook' ? 'Кухня Берты' : kind === 'alch' ? 'Алхимический стол' : 'Кузнечный горн', greeting: '' } }; UI.showShop(); }

/* ---------- Проекты города ---------- */
function projectCan(id) { const pr = PROJECTS[id]; return G.prof.gold >= pr.gold && pr.items.every(([i, n]) => countItem(i) >= n); }
function buyProject(id) {
  const p = G.prof, pr = PROJECTS[id]; if (p.projects[id]) return; if (!projectCan(id)) { toast('Не хватает средств или материалов', 'warn'); Snd.play('error'); return; }
  p.gold -= pr.gold; pr.items.forEach(([i, n]) => removeItem(i, n)); p.projects[id] = true; Snd.play('levelup'); UI.banner(`${pr.icon} ${pr.name}`, 'Проект города завершён! ' + pr.desc); recalc(); UI.dirty = true;
}
function openProjects(npc) { G.shop = { projects: true, npc, tab: 'p', def: { name: 'Проекты города', greeting: 'Вместе мы восстановим Эльдергард.' } }; UI.showShop(); }
function openBoard() { ensureDaily(); G.shop = { board: true, tab: 'b', def: { name: 'Доска объявлений', greeting: 'Заказы обновляются каждое утро (6:00).' } }; UI.showShop(); }
function openBin() { G.shop = { id: 'bin', tab: 'sell', def: { name: 'Ящик отгрузки', npc: null, greeting: 'Урожай, рыба и готовая еда — по полной цене.', bin: true, stock: () => [] } }; UI.showShop(); }

/* ---------- Цены продажи ---------- */
function sellPrice(it) {
  const bin = G.shop && G.shop.def && G.shop.def.bin;
  if (FOODTYPES.includes(it.type)) { let m = bin ? 1 : 0.7; if (G.prof.projects.mill) m *= 1.15; if (G.events.harvestfair) m *= 1.5; return Math.max(1, Math.floor(it.price * m)); }
  return Math.max(1, Math.floor(it.price * 0.4));
}

/* ---------- Порталы ---------- */
function usePortal(o) {
  const P = G.P; if (G.fish) G.fish = null;
  UI.fade(() => {
    const d = o.dest; P.x = (d[0] + 0.5) * TS; P.y = (d[1] + 1) * TS - 6; G.cam.x = P.x - innerWidth / G.cam.zoom / 2; G.cam.y = P.y - innerHeight / G.cam.zoom / 2;
    if (G.petEnt) { G.petEnt.x = P.x - 20; G.petEnt.y = P.y; G.petEnt.target = null; } G.proj = []; G.areas = [];
    if (!o.exit) { UI.banner(`🕳️ ${o.label}`, `Подземелье · рекомендуемый уровень ${o.lvl}`); Snd.play('roar'); } else Snd.play('whoosh');
  });
}
function sleepHome() {
  const h = gt().hf; if (h >= 6 && h < 18) { toast('Ещё рано ложиться — приходите после 18:00', 'warn'); return; }
  sleepAtInn(); questEvent('sleep', 'any');
}

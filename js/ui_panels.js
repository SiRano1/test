'use strict';
/* ===== Интерфейс: окно журнала (инвентарь, персонаж, умения, задания, карта, бестиарий, питомцы, календарь) ===== */
const TABS = [['inv', '🎒', 'Инвентарь'], ['char', '🧍', 'Персонаж'], ['skills', '📈', 'Умения'], ['quests', '📜', 'Задания'], ['map', '🗺️', 'Карта'], ['bestiary', '📖', 'Бестиарий'], ['pets', '🐾', 'Питомцы'], ['calendar', '📅', 'Календарь']];
UI.calMonth = null; UI.invSel = -1; UI.questSel = null; UI.petSel = null;

UI.togglePanel = function (tab) { if (G.panel === tab) UI.closePanel(); else UI.openPanel(tab); };
UI.openPanel = function (tab) { if (G.dialog || UI.screen) return; if (G.shop) UI.hideShop(); G.panel = tab; UI.panelTab = tab; $('#panel').classList.remove('hidden'); UI.setPaused(); if (tab === 'calendar') UI.calMonth = null; Snd.play('click'); UI.renderPanel(); };
UI.closePanel = function () { G.panel = null; UI.tip(null); $('#panel').classList.add('hidden'); UI.setPaused(); };
UI.renderPanel = function () {
  const tab = G.panel; if (!tab) return; const box = $('#panel'), p = G.prof;
  if (!$('.panel-win', box)) { box.innerHTML = `<div class="panel-win"><div class="tabs" id="ptabs"></div><button class="xbtn" id="px">✕</button><div class="panel-body" id="pbody"></div></div>`; $('#px').onclick = () => UI.closePanel(); }
  const tb = $('#ptabs'); tb.innerHTML = ''; TABS.forEach(([k, ic, n]) => { if (k === 'pets' && p.cls !== 'hunter') return; const b = el('button', 'tab' + (k === tab ? ' on' : ''), `${ic} <span>${n}</span>${k === 'skills' && p.sp > 0 ? `<i class="badge">${p.sp}</i>` : ''}`); b.onclick = () => { G.panel = k; UI.tip(null); Snd.play('click'); UI.renderPanel(); }; tb.appendChild(b); });
  const body = $('#pbody'); const sc = body.scrollTop; body.innerHTML = ''; body.className = 'panel-body t-' + tab;
  ({ inv: UI.tabInv, char: UI.tabChar, skills: UI.tabSkills, quests: UI.tabQuests, map: UI.tabMap, bestiary: UI.tabBest, pets: UI.tabPets, calendar: UI.tabCal })[tab](body); body.scrollTop = sc;
};

/* ---------- Инвентарь ---------- */
UI.tabInv = function (b) {
  const p = G.prof, C = CLASSES[p.cls];
  b.innerHTML = `<div class="inv-left"><div class="doll"><canvas id="doll" width="200" height="230"></canvas><div class="eq" id="eq"></div></div><div class="inv-gold">💰 ${fmt(p.gold)}</div><div class="hint">Оружие класса «${C.name}»: ${WICON[C.weapon]} ${WTYPE_NAME[C.weapon]}. Броня: ${C.armor.map(a => ATYPE_NAME[a].toLowerCase()).join(', ')}.</div></div><div class="inv-right"><div class="inv-head"><h3>Сумка <small>${p.inv.length}/${INV_CAP}</small></h3><button class="btn small" id="isort">Сортировать</button></div><div class="grid" id="igrid"></div><div class="inv-detail" id="idet"></div></div>`;
  const c = $('#doll').getContext('2d'); c.imageSmoothingEnabled = false; const g = c.createLinearGradient(0, 0, 0, 230); g.addColorStop(0, '#39445e'); g.addColorStop(1, '#1c2234'); c.fillStyle = g; c.fillRect(0, 0, 200, 230);
  const ph = performance.now() / 1000; drawHuman(c, { x: 100, y: 205, dir: 'down', look: p.look, race: p.race, gender: p.gender, cls: p.cls, player: true, weapon: weaponData(), armor: armorTiers(), t: ph, scale: 5.3 });
  const eq = $('#eq'); ['head', 'amulet', 'weapon', 'body', 'ring', 'boots'].forEach(sl => { const id = p.equip[sl], it = id && ITEMS[id]; const s = el('div', 'eslot ' + sl, it ? `<span style="border-color:${TIER_COL[it.tier]}">${it.icon}</span>` : `<span class="empty">${SLOT_ICON[sl]}</span>`); s.title = ''; if (it) { s.onclick = () => unequip(sl); tipOn(s, () => itemTipHtml(it) + '<div class="tt-hint">Нажмите, чтобы снять</div>'); } else tipOn(s, () => `<div class="tt-name">${SLOT_NAME[sl]}</div><div class="tt-desc">Пусто</div>`); eq.appendChild(s); });
  const grid = $('#igrid'); for (let i = 0; i < INV_CAP; i++) {
    const s = p.inv[i]; const cell = el('div', 'cell' + (i === UI.invSel ? ' sel' : '')); if (s) { const it = ITEMS[s.id]; cell.innerHTML = `<span class="ic" style="border-color:${TIER_COL[it.tier]}">${it.icon}</span>${s.n > 1 ? `<i>${s.n}</i>` : ''}${it.slot && canEquip(it) ? '<b class="lockm">🔒</b>' : ''}`; cell.onclick = () => { UI.invSel = i; Snd.play('click'); UI.renderPanel(); }; cell.ondblclick = () => invAction(i); cell.oncontextmenu = e => { e.preventDefault(); invAction(i); }; tipOn(cell, () => itemTipHtml(it, true, sellPrice(it))); }
    grid.appendChild(cell);
  }
  $('#isort').onclick = () => { const order = { weapon: 0, armor: 1, ring: 2, amulet: 3, potion: 4, elixir: 5, scroll: 6, petfood: 7, material: 8, quest: 9, misc: 10 }; p.inv.sort((a, b) => (order[ITEMS[a.id].type] - order[ITEMS[b.id].type]) || (ITEMS[b.id].tier - ITEMS[a.id].tier) || a.id.localeCompare(b.id)); UI.invSel = -1; Snd.play('click'); UI.renderPanel(); };
  const det = $('#idet'), sel = p.inv[UI.invSel];
  if (sel) { const it = ITEMS[sel.id]; det.innerHTML = itemTipHtml(it, true, sellPrice(it)) + '<div class="row" id="iact"></div>'; const act = $('#iact'); if (it.slot) act.appendChild(UI.btn('Надеть', () => { equipItem(UI.invSel); }, 'primary small')); else if (it.effect || it.type === 'petfood') act.appendChild(UI.btn('Использовать', () => { useItemId(sel.id); UI.dirty = true; }, 'primary small')); if (it.type !== 'quest') act.appendChild(UI.btn('Выбросить', () => UI.confirm(`Выбросить «${it.name}»${sel.n > 1 ? ' (всё)' : ''}?`, () => { removeItem(sel.id, sel.n); UI.invSel = -1; UI.dirty = true; }, 'Выбросить'), 'danger small')); }
  else det.innerHTML = '<p class="hint">Выберите предмет. Двойной щелчок или правая кнопка — надеть / использовать.</p>';
};
function invAction(i) { const s = G.prof.inv[i]; if (!s) return; const it = ITEMS[s.id]; if (it.slot) equipItem(i); else if (it.effect || it.type === 'petfood') { useItemId(s.id); UI.dirty = true; } }

/* ---------- Персонаж ---------- */
UI.tabChar = function (b) {
  const p = G.prof, S = G.S, C = CLASSES[p.cls], R = RACES[p.race], RS = RES[C.res];
  const pt = Math.floor(p.playtime / 60);
  const rows = [['❤ Здоровье', Math.round(S.maxHp)], [`${RS.icon} ${RS.name}`, Math.round(S.maxRes)], ['⚔ Урон', S.dmg.toFixed(1)], ['🛡 Защита', S.def.toFixed(1) + ` (−${Math.round((1 - 50 / (50 + S.def)) * 100)}% урона)`], ['🎯 Шанс крита', Math.round(S.crit * 100) + '%'], ['💥 Крит. урон', '×' + S.critDmg.toFixed(2)], ['👟 Скорость', Math.round(S.spd)], ['🌀 Уклонение', Math.round(S.dodge * 100) + '%'], ['🩸 Вампиризм', Math.round(S.lifesteal * 100) + '%'], ['🍀 Удача', '×' + S.luck.toFixed(2)], ['⭐ Опыт', '×' + S.xp.toFixed(2)], ['💰 Золото', '×' + S.gold.toFixed(2)], ['🔄 Восст. ресурса', S.regen.toFixed(1) + '/с'], ['💚 Восст. здоровья', S.hpRegen.toFixed(1) + '/с']];
  const rels = Object.keys(p.rel).filter(id => p.rel[id].rel >= 2).map(id => { const n = NPCS.find(x => x.id === id); return n ? `<div class="relrow"><span>${n.name}</span><div class="relbar"><i style="width:${p.rel[id].rel}%"></i></div><em>${relTier(p.rel[id].rel)}</em></div>` : ''; }).join('') || '<div class="dim">Вы пока ни с кем не сдружились.</div>';
  b.innerHTML = `<div class="char-wrap"><div class="char-l"><canvas id="cport" width="150" height="150"></canvas><h3>${p.name}</h3><div>${R.icon} ${R.name} · ${p.gender === 'female' ? 'жен.' : 'муж.'}</div><div>${C.icon} ${C.name} · <b>уровень ${p.lvl}</b></div><div class="bar xp big"><div class="fill" style="width:${p.lvl >= MAX_LEVEL ? 100 : p.xp / xpNeed(p.lvl) * 100}%"></div><span>${p.lvl >= MAX_LEVEL ? 'Макс.' : p.xp + ' / ' + xpNeed(p.lvl)}</span></div><div class="dim">Очков умений: <b>${p.sp}</b></div><div class="dim">Убито: ${p.kills} · Смертей: ${p.deaths}<br>Время игры: ${Math.floor(pt / 60)} ч ${pt % 60} мин<br>${dateStr()}, ${timeStr()}</div></div><div class="char-r"><h3>Характеристики</h3><div class="stat-grid">${rows.map(r => `<div class="st"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')}</div><h3>Особенности</h3><div class="feat"><b>${R.icon} ${R.name}:</b> ${R.passive}<br><b>${R.active.icon} ${R.active.name} (F):</b> ${R.active.desc}</div><div class="feat"><b>${C.icon} ${C.name}:</b> ${C.trait}<br><i>${C.style}</i></div><h3>Отношения с жителями</h3>${rels}</div></div>`;
  portrait($('#cport'), { race: p.race, gender: p.gender, look: p.look, cls: p.cls, player: true, weapon: weaponData(), armor: armorTiers(), t: 0 });
};

/* ---------- Умения ---------- */
UI.tabSkills = function (b) {
  const p = G.prof, C = CLASSES[p.cls];
  b.innerHTML = `<div class="sk-head"><h3>${C.icon} Ветка умений: ${C.name}</h3><div class="sp">Очков умений: <b>${p.sp}</b></div><button class="btn small" id="respec" title="Можно сбросить у жрицы Селены">↺ Сброс (у Селены)</button></div><div class="sk-cols" id="skc"></div><p class="hint">Умения второго яруса открываются после изучения первого в той же ветке и по достижении уровня. Активные умения появляются на панели (1–5).</p>`;
  $('#respec').style.display = 'none'; const cols = $('#skc');
  for (let br = 0; br < 3; br++) {
    const col = el('div', 'sk-col', `<h4>${BRANCHES[p.cls][br]}</h4>`);
    for (let tier = 1; tier <= 2; tier++) {
      const id = Object.keys(SKILLS).find(k => SKILLS[k].cls === p.cls && SKILLS[k].branch === br && SKILLS[k].tier === tier); if (!id) continue; const S = SKILLS[id], r = p.skills[id] || 0;
      const t1 = tier === 2 ? Object.keys(SKILLS).find(k => SKILLS[k].cls === p.cls && SKILLS[k].branch === br && SKILLS[k].tier === 1) : null, locked = (tier === 2 && !(p.skills[t1] > 0)) || p.lvl < S.req;
      const node = el('div', 'sk-node' + (r ? ' learned' : '') + (locked && !r ? ' locked' : '')); const desc = S.desc.replace('{v}', `<b>${S.v[Math.max(0, r - 1)]}</b>`);
      node.innerHTML = `<div class="sk-ic">${S.icon}</div><div class="sk-tx"><div class="sk-n">${S.name} <small>${S.type === 'passive' ? 'пассивное' : S.type === 'form' ? 'облик' : 'активное'}</small></div><div class="sk-d">${desc}</div>${r < 3 ? `<div class="sk-next">След. ранг: ${S.v[r]}${S.cost ? ` · ${RES[C.res].name}: ${S.cost}` : ''}${S.cd ? ` · КД ${S.cd} с` : ''}</div>` : '<div class="sk-next">Максимальный ранг</div>'}<div class="sk-meta"><span class="pips">${[0, 1, 2].map(i => `<i class="${i < r ? 'on' : ''}"></i>`).join('')}</span> · ур. ${S.req}${locked && !r ? ' 🔒' : ''}</div></div>`;
      const add = el('button', 'sk-add', '+'); add.disabled = r >= 3 || p.sp < 1 || locked; add.onclick = () => learnSkill(id); node.appendChild(add); col.appendChild(node); if (tier === 1) col.appendChild(el('div', 'sk-arrow', '▼'));
    }
    cols.appendChild(col);
  }
  const ra = RACES[p.race].active; const rc = el('div', 'sk-race', `<b>${RACES[p.race].icon} Расовая способность:</b> ${ra.icon} ${ra.name} (F) — ${ra.desc}`); b.appendChild(rc);
};

/* ---------- Задания ---------- */
UI.tabQuests = function (b) {
  const p = G.prof; const ids = Object.keys(p.quests), act = ids.filter(i => p.quests[i].state === 'active'), done = ids.filter(i => p.quests[i].state === 'done');
  const avail = Object.keys(QUESTS).filter(i => questAvailable(i));
  b.innerHTML = `<div class="q-list" id="ql"></div><div class="q-det" id="qd"></div>`; const ql = $('#ql');
  const sec = (t, arr, kind) => { if (!arr.length) return; ql.appendChild(el('h4', '', t)); arr.sort((a, c) => (QUESTS[c].main ? 1 : 0) - (QUESTS[a].main ? 1 : 0)).forEach(id => { const d = QUESTS[id], q = p.quests[id]; const r = el('div', 'qrow' + (UI.questSel === id ? ' sel' : '') + (d.main ? ' main' : '') + (q && q.ready ? ' ready' : ''), `${d.main ? '⭐' : '•'} ${d.name}${q && q.ready ? ' ✅' : ''}${kind === 'avail' ? ` <small>(${NPCS.find(n => n.id === d.giver).name})</small>` : ''}`); r.onclick = () => { UI.questSel = id; Snd.play('click'); UI.renderPanel(); }; ql.appendChild(r); }); };
  sec('Активные', act, 'act'); sec('Доступные (известные)', avail.filter(i => G.prof.lvl >= QUESTS[i].lvl - 5), 'avail'); sec('Завершённые', done, 'done');
  if (!UI.questSel || !QUESTS[UI.questSel]) UI.questSel = act[0] || null;
  const det = $('#qd'), id = UI.questSel; if (!id) { det.innerHTML = '<p class="hint">Заданий пока нет. Поговорите с жителями Эльдергарда — над головой у тех, кому нужна помощь, светится «!».</p>'; return; }
  const d = QUESTS[id], q = p.quests[id], giver = NPCS.find(n => n.id === d.giver), turn = NPCS.find(n => n.id === (d.turnIn || d.giver));
  let objs = ''; if (q) objs = d.obj.map((o, i) => { const pr = objProgress(q, d, i), nd = objNeed(o); return `<div class="qobj ${pr >= nd ? 'done' : ''}"><span>${pr >= nd ? '✔' : '○'} ${o.text}</span>${nd > 1 ? `<div class="bar small"><div class="fill" style="width:${pr / nd * 100}%"></div><span>${pr}/${nd}</span></div>` : ''}</div>`; }).join('');
  det.innerHTML = `<h3>${d.main ? '⭐ ' : ''}${d.name}</h3><div class="dim">${d.main ? 'Сюжетное задание' : 'Побочное задание'} · рек. уровень ${d.lvl} · Даёт: ${giver.name}</div><p>${d.desc}</p>${q ? (q.state === 'done' ? '<div class="qdone">✔ Завершено</div>' : `<h4>Цели</h4>${objs}${q.ready ? `<div class="qdone">✅ Вернитесь к: ${turn.name}</div>` : ''}`) : `<div class="dim">Поговорите с: ${giver.name}</div>`}<h4>Награда</h4><div>${rewardText(d.reward)}</div>${q && q.state === 'active' ? `<div class="row"><button class="btn small" id="qtrack">${p.flags.untrack && p.flags.untrack[id] ? '☐ Не отслеживается' : '☑ Отслеживается'}</button></div>` : ''}`;
  const tr = $('#qtrack'); if (tr) tr.onclick = () => { p.flags.untrack = p.flags.untrack || {}; p.flags.untrack[id] = !p.flags.untrack[id]; UI.dirty = true; };
};

/* ---------- Карта ---------- */
function questMarkers() {
  const p = G.prof, out = [], P = G.P;
  const npcPos = id => { const n = npcByDef(id); if (n && !n.inside) return { x: n.x / TS, y: n.y / TS }; const s = SPOTS[NPCS.find(x => x.id === id).home]; return { x: s[0], y: s[1] }; };
  const nearest = (arr) => { let b = null, bd = 1e9; arr.forEach(a => { const d = Math.hypot(a.x - P.x / TS, a.y - P.y / TS); if (d < bd) { bd = d; b = a; } }); return b; };
  for (const id in p.quests) {
    const q = p.quests[id]; if (q.state !== 'active') continue; const d = QUESTS[id];
    if (q.ready) { out.push(Object.assign({ label: d.name + ' — сдать', ready: true }, npcPos(d.turnIn || d.giver))); continue; }
    d.obj.forEach((o, i) => { if (objProgress(q, d, i) >= objNeed(o)) return; let pos = null;
      if (o.t === 'reach') pos = { x: LOCS[o.id].x, y: LOCS[o.id].y }; else if (o.t === 'boss') pos = { x: LOCS[o.id === 'horak' ? 'cave' : 'keep'].x, y: LOCS[o.id === 'horak' ? 'cave' : 'keep'].y }; else if (o.t === 'talk') pos = npcPos(o.id);
      else if (o.t === 'kill') pos = nearest(G.world.spawns.filter(s => s.id === o.id).map(s => ({ x: s.tx, y: s.ty })));
      else if (o.t === 'collect') { const m = { sigil: 'bandits', ember: 'cave', lyrics: 'ruins' }[o.id]; if (m) pos = { x: LOCS[m].x, y: LOCS[m].y }; else pos = nearest(G.world.objs.filter(x => x.item === o.id).map(x => ({ x: x.tx, y: x.ty }))); }
      if (pos) out.push({ x: pos.x, y: pos.y, label: `${d.name}: ${o.text}` }); });
  }
  return out;
}
UI.tabMap = function (b) {
  b.innerHTML = `<div class="map-wrap"><canvas id="mapcv" width="620" height="620"></canvas><div class="map-legend"><h4>Легенда</h4><div>⬤ <span style="color:#fff">Вы</span></div><div><span style="color:#ffe066">◆</span> Цель задания</div><div><span style="color:#8f8">●</span> Житель</div><div><span style="color:#ffe066">●</span> Ждёт вас (сдать)</div><div class="dim">Неисследованные области скрыты. Идите по дорогам и открывайте мир!</div><h4>Места</h4><div id="maplocs"></div></div></div>`;
  const cv = $('#mapcv'), c = cv.getContext('2d'), k = cv.width / WW; c.imageSmoothingEnabled = false; c.drawImage(G.world.minimap, 0, 0, cv.width, cv.height);
  const rev = (x, y) => G.revealed[Math.floor(y) * WW + Math.floor(x)];
  c.strokeStyle = '#c9a24a'; c.lineWidth = 4; c.strokeRect(0, 0, cv.width, cv.height);
  c.font = 'bold 12px Georgia, serif'; c.textAlign = 'center'; const list = $('#maplocs');
  for (const kk in LOCS) { const l = LOCS[kk]; if (!rev(l.x, l.y)) continue; const x = l.x * k, y = l.y * k; c.fillStyle = 'rgba(0,0,0,0.6)'; const w = c.measureText(l.name).width + 8; c.fillRect(x - w / 2, y + 6, w, 15); c.fillStyle = '#fff'; c.fillText(l.icon, x, y + 4); c.fillStyle = '#f6e8b8'; c.fillText(l.name, x, y + 18); list.innerHTML += `<div>${l.icon} ${l.name}</div>`; }
  for (const n of G.npcs) { if (n.inside || !rev(n.x / TS, n.y / TS)) continue; const mk = npcQuestMark(n); c.fillStyle = mk ? '#ffe066' : '#8f8'; c.strokeStyle = '#000'; c.lineWidth = 1.5; c.beginPath(); c.arc(n.x / TS * k, n.y / TS * k, mk ? 4.5 : 3, 0, TAU); c.fill(); c.stroke(); }
  const tt = performance.now() / 1000; for (const m of questMarkers()) { const x = m.x * k, y = m.y * k, r = 8 + Math.sin(tt * 4) * 1.5; c.fillStyle = m.ready ? '#ffe066' : '#ff9a3a'; c.strokeStyle = '#000'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r * 0.7, y); c.lineTo(x, y + r); c.lineTo(x - r * 0.7, y); c.closePath(); c.fill(); c.stroke(); }
  const P = G.P; c.save(); c.translate(P.x / TS * k, P.y / TS * k); c.rotate(P.aim + Math.PI / 2); c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -9); c.lineTo(7, 7); c.lineTo(0, 3); c.lineTo(-7, 7); c.closePath(); c.fill(); c.stroke(); c.restore();
  const ms = questMarkers(); cv.onmousemove = e => { const r = cv.getBoundingClientRect(), mx = (e.clientX - r.left) / r.width * WW, my = (e.clientY - r.top) / r.height * WH; const hit = ms.find(m => Math.hypot(m.x - mx, m.y - my) < 3); if (hit) UI.tip(`<div class="tt-name">◆ ${hit.label}</div>`, e); else UI.tip(null); }; cv.onmouseleave = () => UI.tip(null);
};

/* ---------- Бестиарий ---------- */
UI.tabBest = function (b) {
  const p = G.prof, ids = Object.keys(MON), known = ids.filter(id => p.bestiary[id] && p.bestiary[id].kills > 0).length;
  b.innerHTML = `<div class="best-head"><h3>📖 Журнал монстров</h3><div>Открыто: <b>${known} / ${ids.length}</b></div></div><div class="best-grid" id="bg"></div>`; const g = $('#bg');
  ids.forEach(id => {
    const m = MON[id], e = p.bestiary[id], k = e ? e.kills : 0; const card = el('div', 'bcard' + (k ? '' : ' unk') + (m.boss ? ' boss' : '')); const cv = el('canvas'); cv.width = 84; cv.height = 84;
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = false; const gr = c.createLinearGradient(0, 0, 0, 84); gr.addColorStop(0, '#39445e'); gr.addColorStop(1, '#1c2234'); c.fillStyle = gr; c.fillRect(0, 0, 84, 84);
    if (m.kind === 'human' || m.kind === 'skeleton') drawHuman(c, { x: 42, y: 74, dir: 'down', look: { skin: 0, hairStyle: m.kind === 'skeleton' ? 5 : 0, hair: 0, eye: 0, accent: 0, face: 0 }, race: 'human', gender: 'male', mon: id, custom: { skin: m.skin || (m.kind === 'skeleton' ? m.col : undefined), hair: m.hair }, hairless: m.kind === 'skeleton', scale: Math.min(2.4, 3 / Math.max(1, m.size)) * m.size * 0.8, t: 0 });
    else drawCreature(c, { x: 42, y: 70, kind: m.kind, id, col: m.col, acc: m.acc, size: Math.min(2.4, 2.1 / Math.max(1, m.size * 0.7)) * m.size * 0.9 + 0.3, t: 0 });
    if (!k) cv.style.filter = 'brightness(0) opacity(0.6)'; card.appendChild(cv);
    const info = el('div', 'binfo'); if (!k) info.innerHTML = `<b>???</b><div class="dim">Убейте это существо, чтобы записать его в журнал.</div>`;
    else { const drops = k >= 3 ? `<div class="bd">Добыча: ${m.drops.map(d => ITEMS[d[0]].icon).join(' ')}</div>` : '<div class="dim">Добыча: убейте ещё (3)</div>'; info.innerHTML = `<b>${m.name}</b>${m.boss ? ' <span class="bossb">БОСС</span>' : ''}${m.rare ? ' <span class="rareb">РЕДКИЙ</span>' : ''}<div class="dim">Ур. ${m.lvl[0]}${m.lvl[1] > m.lvl[0] ? '–' + m.lvl[1] : ''} · Убито: ${k}${m.night ? ' · 🌙 ночью' : ''}${m.tame ? ' · 🐾 приручается' : ''}</div><div class="bdesc">${m.desc}</div>${drops}${k >= 5 ? `<div class="bd">Слабость: ${m.weak}</div>` : '<div class="dim">Слабость: убейте ещё (5)</div>'}`; }
    card.appendChild(info); g.appendChild(card);
  });
};

/* ---------- Питомцы ---------- */
UI.tabPets = function (b) {
  const p = G.prof;
  if (p.cls !== 'hunter') { b.innerHTML = '<p class="hint">Питомцев могут держать только Охотники.</p>'; return; }
  b.innerHTML = `<div class="pets-l" id="pl2"><h3>🐾 Ваши питомцы <small>${p.pets.length}/8</small></h3></div><div class="pets-r" id="pr"></div>`; const pl = $('#pl2');
  if (!p.pets.length) pl.innerHTML += '<p class="hint">У вас нет питомцев. Купите в Зверинце Рурика, найдите в бою или приручите дикого зверя: ослабьте его (&lt;40% здоровья), возьмите «Приманку» и используйте умение «Приручение».</p>';
  if (!UI.petSel || !p.pets.find(x => x.uid === UI.petSel)) UI.petSel = p.pets[0] ? p.pets[0].uid : null;
  p.pets.forEach(pd => { const d = PETS[pd.id], rar = RARITY[d.r]; const r = el('div', 'petrow' + (UI.petSel === pd.uid ? ' sel' : '') + (p.activePet === pd.uid ? ' active' : ''), `<span class="si" style="border-color:${rar.c}">${d.icon}</span><span><b style="color:${rar.c}">${pd.name}</b><small>${rar.n} · ур. ${pd.lvl}${p.activePet === pd.uid ? ' · активен' : ''}</small></span>`); r.onclick = () => { UI.petSel = pd.uid; Snd.play('click'); UI.renderPanel(); }; pl.appendChild(r); });
  const pd = p.pets.find(x => x.uid === UI.petSel), pr = $('#pr'); if (!pd) { pr.innerHTML = '<p class="hint">Выберите питомца.</p>'; return; }
  const d = PETS[pd.id], rar = RARITY[d.r], st = petStats(pd), need = Math.floor(20 * Math.pow(pd.lvl, 1.5));
  pr.innerHTML = `<canvas id="petcv" width="200" height="150"></canvas><h3 style="color:${rar.c}">${pd.name}</h3><div class="tt-sub">${rar.n} · ${d.perk}</div><div class="bar xp big"><div class="fill" style="width:${pd.lvl >= MAX_LEVEL ? 100 : pd.xp / need * 100}%"></div><span>Ур. ${pd.lvl} · ${pd.xp}/${need}</span></div><div class="stat-grid"><div class="st"><span>❤ Здоровье</span><b>${Math.round(st.maxHp)}</b></div><div class="st"><span>⚔ Урон</span><b>${Math.round(st.dmg)}</b></div><div class="st"><span>👟 Скорость</span><b>${d.spd}</b></div><div class="st"><span>✨ Бонус хозяину</span><b>${d.perk}</b></div></div><div class="row" id="pact"></div>`;
  const c = $('#petcv').getContext('2d'); c.imageSmoothingEnabled = false; const g = c.createLinearGradient(0, 0, 0, 150); g.addColorStop(0, '#39445e'); g.addColorStop(1, '#1c2234'); c.fillStyle = g; c.fillRect(0, 0, 200, 150); c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(100, 128, 40, 10, 0, 0, TAU); c.fill(); drawCreature(c, { x: 100, y: 124, kind: d.kind, id: pd.id, col: d.col, acc: d.acc, size: d.size * 1.8, t: performance.now() / 1000, aura: rar.c + '44' });
  const act = $('#pact'); if (p.activePet === pd.uid) act.appendChild(UI.btn('Отозвать', () => summonPet(null), 'small')); else act.appendChild(UI.btn('Призвать', () => summonPet(pd.uid), 'primary small'));
  act.appendChild(UI.btn(`🦴 Покормить (${countItem('treat')})`, () => useItemId('treat'), 'small'));
  act.appendChild(UI.btn('Отпустить', () => UI.confirm(`Отпустить питомца «${pd.name}»? Он уйдёт навсегда.`, () => releasePet(pd.uid), 'Отпустить'), 'danger small'));
};

/* ---------- Календарь ---------- */
UI.tabCal = function (b) {
  const d = gt(); if (UI.calMonth === null) UI.calMonth = d.month; const m = UI.calMonth, yr = d.year;
  b.innerHTML = `<div class="cal-l"><div class="cal-nav"><button class="btn small" id="cprev">◀</button><h3>${SEASON_ICON[Math.floor(m / 3)]} ${MONTHS[m]}, ${yr}</h3><button class="btn small" id="cnext">▶</button></div><div class="cal-grid" id="cg"></div><div class="dim">Месяц — 28 дней (4 недели). Полнолуние — 14-го числа. Сезоны меняются каждые 3 месяца.</div></div><div class="cal-r"><div class="cal-now"><div class="big">${timeStr()}</div><div>${WEEKDAYS[d.wd]}, ${d.day} ${MONTHS_GEN[d.month]} ${d.year}</div><div>${SEASON_ICON[d.season]} ${SEASONS[d.season]} · ${moonIcon(d.day)} · ${isNight() ? '🌙 ночь' : d.hf < 8 ? '🌅 утро' : d.hf > 18 ? '🌇 вечер' : '☀️ день'}</div></div><h4>Сейчас идёт</h4><div id="cnow"></div><h4>Ближайшие события</h4><div id="cup"></div></div>`;
  $('#cprev').onclick = () => { UI.calMonth = (UI.calMonth + 11) % 12; UI.renderPanel(); }; $('#cnext').onclick = () => { UI.calMonth = (UI.calMonth + 1) % 12; UI.renderPanel(); };
  const g = $('#cg'); WD_SHORT.forEach(w => g.appendChild(el('div', 'ch', w)));
  const baseAbs = ((yr - START_YEAR) * 12 + m) * DAYS_IN_MONTH;
  for (let i = 0; i < DAYS_IN_MONTH; i++) { const abs = baseAbs + i, cd = calc(abs * 1440 + 720); const evs = eventsOnDay(abs); const cell = el('div', 'cd' + (abs === d.absDay ? ' today' : '') + (abs < d.absDay ? ' past' : '') + (cd.wd === 6 ? ' sun' : ''), `<i>${i + 1}</i><span class="mo">${(i + 1) === 14 ? '🌕' : ''}</span><div class="ev">${evs.map(e => e.icon).join('')}</div>`); if (evs.length) tipOn(cell, () => evs.map(e => `<div class="tt-name">${e.icon} ${e.id === 'festival' ? FESTIVAL_NAMES[Math.floor(m / 3)] : e.name}</div><div class="tt-sub">${e.from}:00 – ${pad2(e.to % 24)}:00</div><div class="tt-desc">${e.desc}</div>`).join('<hr>')); g.appendChild(cell); }
  const now = EVENTS.filter(e => G.events[e.id]); $('#cnow').innerHTML = now.length ? now.map(e => `<div class="evc active"><b>${e.icon} ${evName(e)}</b><div>${e.desc}</div></div>`).join('') : '<div class="dim">Сейчас особых событий нет.</div>';
  $('#cup').innerHTML = upcomingEvents(6).map(u => { const cd = calc(u.absDay * 1440), dl = u.absDay - d.absDay; return `<div class="evc"><b>${u.ev.icon} ${u.ev.id === 'festival' ? FESTIVAL_NAMES[Math.floor(cd.month / 3)] : u.ev.name}</b><div class="dim">${cd.day} ${MONTHS_GEN[cd.month]} · ${WEEKDAYS[cd.wd]} · ${u.ev.from}:00–${pad2(u.ev.to % 24)}:00 · ${dl === 0 ? 'сегодня' : dl === 1 ? 'завтра' : 'через ' + dl + ' дн.'}</div></div>`; }).join('');
};

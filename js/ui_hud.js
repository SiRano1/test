'use strict';
/* ===== Интерфейс: HUD, диалоги, магазин, подсказки ===== */
const STAT_NAMES = { dmg: 'Урон', def: 'Защита', hp: 'Здоровье', res: 'Ресурс', crit: 'Крит', critDmg: 'Крит. урон', spd: 'Скорость', regen: 'Восст. ресурса', lifesteal: 'Вампиризм', luck: 'Удача', xp: 'Опыт' };
const PCT_STATS = ['crit', 'critDmg', 'lifesteal', 'luck', 'xp'];
function fmtStat(k, v) { return PCT_STATS.includes(k) ? Math.round(v * 100) + '%' : (Number.isInteger(v) ? v : (Math.round(v * 10) / 10)); }
function itemTipHtml(it, showPrice, price) {
  const col = TIER_COL[it.tier] || '#ccc', p = G.prof; let h = `<div class="tt-name" style="color:${col}">${it.icon} ${it.name}</div>`;
  const kind = it.type === 'weapon' ? `${WTYPE_NAME[it.wtype]} · ${CLASSES[it.cls].name}` : it.type === 'armor' ? `${SLOT_NAME[it.slot]} · ${ATYPE_NAME[it.atype]} броня` : it.slot ? SLOT_NAME[it.slot] : ({ potion: 'Зелье', elixir: 'Усилитель', scroll: 'Свиток', quest: 'Задание', material: 'Материал', petfood: 'Корм', misc: 'Разное' })[it.type] || '';
  h += `<div class="tt-sub">${kind}${it.slot || it.tier ? ` · ${TIER_LABEL[it.tier]}` : ''}</div>`;
  if (it.slot) { const err = p && canEquip(it); h += `<div class="tt-req ${err ? 'bad' : ''}">Требуется уровень ${it.req}${err ? ' — ' + err : ''}</div>`; const cur = p && ITEMS[p.equip[it.slot]]; for (const k of Object.keys(it.stats)) { const v = it.stats[k], cv = cur && cur.id !== it.id ? (cur.stats[k] || 0) : null; let cmp = ''; if (cv !== null) { const d = v - cv; if (Math.abs(d) > 1e-6) cmp = ` <span class="${d > 0 ? 'up' : 'down'}">(${d > 0 ? '+' : ''}${fmtStat(k, d)})</span>`; } h += `<div class="tt-stat">${STAT_NAMES[k] || k} <b>+${fmtStat(k, v)}</b>${cmp}</div>`; } }
  h += `<div class="tt-desc">${it.desc || ''}</div>`;
  if (showPrice && it.price > 0) h += `<div class="tt-price">💰 ${price !== undefined ? price : it.price}</div>`;
  return h;
}
const UIH = { last: {}, t: 0, tt: 0 };

UI.tipEl = null;
UI.tip = function (html, e) { let t = UI.tipEl; if (!t) { t = UI.tipEl = el('div', 'tooltip'); document.body.appendChild(t); } if (html === null) { t.style.display = 'none'; return; } t.innerHTML = html; t.style.display = 'block'; const w = t.offsetWidth, h = t.offsetHeight; let x = e.clientX + 16, y = e.clientY + 12; if (x + w > innerWidth - 8) x = e.clientX - w - 12; if (y + h > innerHeight - 8) y = innerHeight - h - 8; t.style.left = x + 'px'; t.style.top = Math.max(4, y) + 'px'; };
function tipOn(node, fn) { node.addEventListener('mouseenter', e => UI.tip(fn(), e)); node.addEventListener('mousemove', e => UI.tip(fn(), e)); node.addEventListener('mouseleave', () => UI.tip(null)); }

/* ---------- HUD ---------- */
UI.buildHud = function () {
  const h = $('#hud');
  h.innerHTML = `
  <div id="h-player" class="hud-box">
    <canvas id="h-port" width="64" height="64"></canvas>
    <div class="hp-info"><div class="h-name" id="h-name"></div>
      <div class="bar hp"><div class="fill" id="b-hp"></div><span id="t-hp"></span></div>
      <div class="bar res"><div class="fill" id="b-res"></div><span id="t-res"></span></div>
      <div class="bar xp"><div class="fill" id="b-xp"></div><span id="t-xp"></span></div></div>
    <div id="h-buffs"></div><div id="h-pet"></div>
  </div>
  <div id="h-top" class="hud-box">
    <div class="clock"><span id="c-icon">☀️</span><div><div id="c-time">08:00</div><div id="c-date"></div></div></div>
    <div class="c-row"><span id="c-season"></span><span id="c-moon"></span><span id="c-weather"></span><span id="c-gold" class="gold"></span></div>
    <div id="c-events"></div>
  </div>
  <div id="h-quests" class="hud-box"></div>
  <div id="h-target" class="hidden"></div>
  <div id="h-menu"></div>
  <div id="h-log"></div>
  <div id="h-mini"><canvas id="h-minicv" width="176" height="176"></canvas><div id="h-zone"></div></div>
  <div id="h-action"></div>`;
  const menu = $('#h-menu'); [['🎒', 'inv', 'Инвентарь (I)'], ['🧍', 'char', 'Персонаж (C)'], ['📈', 'skills', 'Умения (K)'], ['📜', 'quests', 'Задания (J)'], ['🗺️', 'map', 'Карта (M)'], ['📖', 'bestiary', 'Бестиарий (B)'], ['🐾', 'pets', 'Питомцы (P)'], ['📅', 'calendar', 'Календарь (L)']].forEach(([ic, tab, tip]) => { const b = el('button', 'mbtn', ic); b.dataset.tab = tab; b.onclick = () => { Snd.play('click'); UI.togglePanel(tab); }; tipOn(b, () => tip); menu.appendChild(b); });
  const mb = el('button', 'mbtn', '⚙️'); mb.onclick = () => { Snd.play('click'); UI.showScreen('pause', true); }; tipOn(mb, () => 'Меню (Esc)'); menu.appendChild(mb);
};
UI.enterGame = function () {
  UI.hideScreen(); UI.hideDeath(); $('#hud').classList.remove('hidden'); $('#dialog').classList.add('hidden'); $('#shop').classList.add('hidden'); $('#panel').classList.add('hidden'); UIH.last = {}; UI.dirty = true; UI.logDirty = true; UI.setPaused();
  const p = G.prof; portrait($('#h-port'), { race: p.race, gender: p.gender, look: p.look, cls: p.cls, player: true, weapon: null, armor: armorTiers(), t: 0 });
};
UI.hideHud = function () { $('#hud').classList.add('hidden'); $('#dialog').classList.add('hidden'); $('#shop').classList.add('hidden'); $('#panel').classList.add('hidden'); G.panel = null; G.dialog = null; G.shop = null; };
const CK = (a, b) => a === b;
function setTxt(id, v) { if (UIH.last[id] !== v) { UIH.last[id] = v; const e = $('#' + id); if (e) e.textContent = v; } }
function setHtml(id, v) { if (UIH.last[id] !== v) { UIH.last[id] = v; const e = $('#' + id); if (e) e.innerHTML = v; return true; } return false; }
UI.hudFrame = function (dt) {
  const P = G.P, p = G.prof, S = G.S; if (!P || !p) return; UIH.t += dt;
  // полоски — каждый кадр (дёшево)
  $('#b-hp').style.width = clamp(P.hp / P.maxHp * 100, 0, 100) + '%'; $('#b-res').style.width = clamp(P.res / P.maxRes * 100, 0, 100) + '%'; $('#b-xp').style.width = (p.lvl >= MAX_LEVEL ? 100 : clamp(p.xp / xpNeed(p.lvl) * 100, 0, 100)) + '%';
  const C = CLASSES[p.cls], R = RES[C.res];
  setTxt('t-hp', `❤ ${Math.ceil(P.hp)} / ${Math.ceil(P.maxHp)}`); setTxt('t-res', `${R.icon} ${R.name}: ${Math.floor(P.res)} / ${Math.floor(P.maxRes)}`); setTxt('t-xp', p.lvl >= MAX_LEVEL ? 'Макс. уровень' : `Опыт ${p.xp} / ${xpNeed(p.lvl)}`);
  const res = $('#b-res'); if (UIH.last.rescol !== C.res) { UIH.last.rescol = C.res; res.style.background = `linear-gradient(#${''}${R.color}, ${R.color2})`; res.style.background = `linear-gradient(${R.color}, ${R.color2})`; }
  // редкое обновление
  if (UIH.t > 0.12 || UI.dirty) {
    UIH.t = 0; const d = gt(), n = nightAmount();
    setTxt('h-name', `${p.name} · ${C.icon} ${C.name} · ур. ${p.lvl}`);
    const ic = n > 0.6 ? '🌙' : (d.hf < 8 || d.hf > 18) ? '🌅' : '☀️'; setTxt('c-icon', ic); setTxt('c-time', timeStr()); setTxt('c-date', dateStr());
    setTxt('c-season', `${SEASON_ICON[d.season]} ${SEASONS[d.season]}`); setTxt('c-moon', `${moonIcon(d.day)}`); setTxt('c-weather', G.weather.amt > 0.3 ? (G.weather.kind === 'snow' ? '🌨️ Снег' : '🌧️ Дождь') : ''); setTxt('c-gold', `💰 ${fmt(p.gold)}`);
    const evs = EVENTS.filter(e => G.events[e.id]).map(e => `<div class="ev" data-id="${e.id}">${e.icon} ${evName(e)}</div>`).join(''); if (setHtml('c-events', evs)) $$('#c-events .ev').forEach(n2 => tipOn(n2, () => { const ev = EVENTS.find(e => e.id === n2.dataset.id); return `<div class="tt-name">${ev.icon} ${evName(ev)}</div><div class="tt-desc">${ev.desc}</div>`; }));
    setTxt('h-zone', `${G.world.zoneName(P.x, P.y)}${isSafeTile(P.x / TS, P.y / TS) ? ' · 🛡 безопасная зона' : (P.y >= OW_H * TS ? ' · ⚠ подземелье' : '')}`);
    $('#h-mini').style.display = G.settings.minimap ? '' : 'none';
    // баффы
    const bf = P.buffs.map(b => `<span class="buff" data-i="${b.id}">${b.icon}<i>${Math.max(0, Math.ceil(b.until - G.t))}</i></span>`).join('') + (P.form ? `<span class="buff form">${SKILLS[P.form].icon}<i>форма</i></span>` : ''); setHtml('h-buffs', bf);
    const pd = activePetData(); const pe = G.petEnt; setHtml('h-pet', pd && pe ? `<div class="pet-mini" style="border-color:${RARITY[PETS[pd.id].r].c}">${PETS[pd.id].icon} <b>${pd.name}</b> ур.${pd.lvl}<div class="bar small"><div class="fill" style="width:${clamp(pe.hp / pe.maxHp * 100, 0, 100)}%;background:#5c5"></div></div>${pe.down ? '<small>без сил</small>' : ''}</div>` : '');
    UI.updateQuestTracker(); UI.updateTarget(); UI.updateLog(); UI.updateMenuBtns();
  }
  if (UI.dirty || UIH.actionSig !== UI.actionSig()) { UIH.actionSig = UI.actionSig(); UI.buildActionBar(); }
  UI.updateCooldowns(); UI.drawMinimap(dt);
  if (UI.dirty) { UI.dirty = false; if (G.panel) UI.renderPanel(); if (G.shop) UI.renderShop(); }
};
UI.actionSig = function () { const p = G.prof; return [p.cls, Object.keys(p.skills).length, Object.values(p.skills).join(''), p.equip.weapon, G.P.form, countItem('hp_0') + countItem('hp_1') + countItem('hp_2'), countItem('rs_0') + countItem('rs_1') + countItem('rs_2'), p.inv.filter(s => ITEMS[s.id].type === 'elixir').length, G.petEnt ? 1 : 0, p.pets.length].join('|'); };
UI.updateMenuBtns = function () { const p = G.prof; $$('#h-menu .mbtn').forEach(b => { b.classList.toggle('on', G.panel === b.dataset.tab); b.classList.toggle('alert', b.dataset.tab === 'skills' && p.sp > 0); }); const m = $('#h-menu [data-tab=pets]'); if (m) m.style.display = p.cls === 'hunter' ? '' : 'none'; };
UI.buildActionBar = function () {
  const bar = $('#h-action'), p = G.prof, C = CLASSES[p.cls]; bar.innerHTML = '';
  const w = ITEMS[p.equip.weapon]; const hand = el('div', 'hand'); hand.innerHTML = G.P.form ? `<div class="hi">${SKILLS[G.P.form].icon}</div><div class="hl"><small>Облик</small><b>${SKILLS[G.P.form].name.replace('Облик ', '')}</b></div>` : w ? `<div class="hi" style="border-color:${TIER_COL[w.tier]}">${w.icon}</div><div class="hl"><small>В руке</small><b style="color:${TIER_COL[w.tier]}">${w.name}</b></div>` : `<div class="hi">✊</div><div class="hl"><small>В руке</small><b>Пусто</b></div>`; if (w && !G.P.form) tipOn(hand, () => itemTipHtml(w)); bar.appendChild(hand);
  const skills = hotbarSkills(); const sb = el('div', 'slots');
  skills.slice(0, 5).forEach((id, i) => { const S = SKILLS[id], r = p.skills[id]; const s = el('div', 'slot skill' + (G.P.form === id ? ' active' : ''), `<span class="ic">${S.icon}</span><span class="key">${i + 1}</span>${S.cost ? `<span class="cost" style="color:${RES[C.res].color}">${S.cost}</span>` : ''}<div class="cd"></div>`); s.dataset.skill = id; s.onclick = () => castSkill(id); tipOn(s, () => `<div class="tt-name">${S.icon} ${S.name} <small>ранг ${r}/3</small></div><div class="tt-sub">${S.type === 'form' ? 'Облик' : 'Умение'} · ${S.cost ? 'Стоимость: ' + S.cost + ' ' + RES[C.res].name.toLowerCase() : 'Без затрат'} · Перезарядка ${S.cd} с</div><div class="tt-desc">${S.desc.replace('{v}', S.v[r - 1])}</div>`); sb.appendChild(s); });
  for (let i = skills.length; i < 5; i++) sb.appendChild(el('div', 'slot empty', `<span class="key">${i + 1}</span>`));
  bar.appendChild(sb);
  const pb = el('div', 'slots pots');
  const mk = (key, icon, count, tipTxt, fn, cdKey) => { const s = el('div', 'slot pot' + (count ? '' : ' none'), `<span class="ic">${icon}</span><span class="key">${key}</span><span class="cnt">${count}</span><div class="cd"></div>`); s.dataset.pcd = cdKey || ''; s.onclick = fn; tipOn(s, () => tipTxt); pb.appendChild(s); return s; };
  mk('Q', '🧪', countItem('hp_0') + countItem('hp_1') + countItem('hp_2'), '<div class="tt-name">🧪 Зелье здоровья</div><div class="tt-desc">Клавиша Q. Использует подходящее по силе зелье.</div>', () => usePotionSlot('hp'), 'hp');
  mk('R', '⚗️', countItem('rs_0') + countItem('rs_1') + countItem('rs_2'), `<div class="tt-name">⚗️ Тоник</div><div class="tt-desc">Клавиша R. Восстанавливает ${RES[C.res].name.toLowerCase()}.</div>`, () => usePotionSlot('rs'), 'rs');
  const el1 = p.inv.filter(s => ITEMS[s.id].type === 'elixir'); const ec = el1.reduce((a, s) => a + s.n, 0); mk('V', el1.length ? ITEMS[el1[0].id].icon : '🍾', ec, `<div class="tt-name">🍾 Эликсир</div><div class="tt-desc">Клавиша V. ${el1.length ? ITEMS[el1[0].id].name + ' — ' + ITEMS[el1[0].id].desc : 'Нет эликсиров.'}</div>`, () => { if (el1.length) useItemId(el1[0].id); });
  bar.appendChild(pb);
  const R = RACES[p.race].active; const ex = el('div', 'slots'); const rs = el('div', 'slot racial', `<span class="ic">${R.icon}</span><span class="key">F</span><div class="cd"></div>`); rs.dataset.racial = R.id; rs.onclick = () => useRacial(); tipOn(rs, () => `<div class="tt-name">${R.icon} ${R.name}</div><div class="tt-sub">Способность расы · перезарядка ${R.cd} с</div><div class="tt-desc">${R.desc}</div>`); ex.appendChild(rs);
  if (p.cls === 'hunter') { const ts = el('div', 'slot pet' + (G.petEnt ? ' active' : ''), `<span class="ic">🐾</span><span class="key">T</span>`); ts.onclick = () => { if (G.petEnt) summonPet(null); else if (p.pets.length) summonPet(p.pets[0].uid); }; tipOn(ts, () => '<div class="tt-name">🐾 Питомец</div><div class="tt-desc">T — призвать/отозвать. Управление в окне «Питомцы» (P).</div>'); ex.appendChild(ts); }
  bar.appendChild(ex);
};
UI.updateCooldowns = function () {
  $$('#h-action .slot[data-skill]').forEach(s => { const id = s.dataset.skill, S = SKILLS[id], rem = ((G.cd[id] || 0) - G.t); const cd = $('.cd', s); const k = rem > 0 ? clamp(rem / S.cd, 0, 1) : 0; cd.style.height = k * 100 + '%'; cd.textContent = rem > 0.05 ? (rem < 10 ? rem.toFixed(1) : Math.ceil(rem)) : ''; const noRes = G.P.res < S.cost && !(G.P.form === id); s.classList.toggle('nores', noRes); s.classList.toggle('active', G.P.form === id); });
  const r = $('#h-action .slot.racial'); if (r) { const a = RACES[G.prof.race].active, rem = (G.cd[a.id] || 0) - G.t, cd = $('.cd', r); cd.style.height = (rem > 0 ? clamp(rem / a.cd, 0, 1) : 0) * 100 + '%'; cd.textContent = rem > 0.05 ? Math.ceil(rem) : ''; }
  $$('#h-action .slot.pot').forEach(s => { const k = s.dataset.pcd; if (!k) return; const rem = G.potCd[k] - G.t, cd = $('.cd', s); cd.style.height = (rem > 0 ? clamp(rem / 5, 0, 1) : 0) * 100 + '%'; cd.textContent = rem > 0.05 ? Math.ceil(rem) : ''; });
};
UI.updateQuestTracker = function () {
  const p = G.prof, list = Object.keys(p.quests).filter(id => p.quests[id].state === 'active' && !(p.flags.untrack && p.flags.untrack[id])).sort((a, b) => (QUESTS[b].main ? 1 : 0) - (QUESTS[a].main ? 1 : 0)).slice(0, 4);
  const html = list.length ? '<div class="qt-title">📜 Задания</div>' + list.map(id => { const q = p.quests[id], d = QUESTS[id]; const objs = q.ready ? `<div class="qo done">✔ Вернитесь к: ${(NPCS.find(n => n.id === (d.turnIn || d.giver)) || { name: '—' }).name}</div>` : d.obj.map((o, i) => { const pr = objProgress(q, d, i), nd = objNeed(o), dn = pr >= nd; return `<div class="qo ${dn ? 'done' : ''}">${dn ? '✔' : '•'} ${o.text}${nd > 1 ? ` ${pr}/${nd}` : ''}</div>`; }).join(''); return `<div class="qt ${d.main ? 'main' : ''}"><div class="qn">${d.main ? '⭐ ' : ''}${d.name}</div>${objs}</div>`; }).join('') : '';
  setHtml('h-quests', html); $('#h-quests').style.display = list.length ? '' : 'none';
};
UI.updateTarget = function () {
  const t = $('#h-target'); let m = G.target && !G.target.dead && G.t - G.targetT < 6 ? G.target : null; const boss = G.mons.find(b => b.boss && !b.dead && !b.hidden && b.state === 'chase' && Math.hypot(b.x - G.P.x, b.y - G.P.y) < 700); if (boss) m = boss;
  if (!m) { t.classList.add('hidden'); UIH.last.tgt = null; return; } t.classList.remove('hidden'); t.className = m.boss ? 'boss' : '';
  const st = [m.stun > G.t ? '💫' : '', m.root > G.t ? '🌿' : '', m.slow > G.t ? '❄️' : '', m.dots.length ? '🔥' : ''].join('');
  t.innerHTML = `<div class="tn">${m.boss ? '☠ ' : ''}${m.d.name} <small>ур. ${m.lvl}</small> ${st}</div><div class="bar"><div class="fill" style="width:${clamp(m.hp / m.maxHp * 100, 0, 100)}%;background:${m.boss ? '#c33' : '#d44'}"></div><span>${Math.ceil(m.hp)} / ${m.maxHp}</span></div>`;
};
UI.updateLog = function () {
  const now = G.t, recent = G.log.filter(l => now - l.t < 14).slice(-6); const html = recent.map(l => `<div class="lg ${l.cls}" style="opacity:${clamp(1 - (now - l.t - 9) / 5, 0.2, 1)}">${l.text}</div>`).join(''); setHtml('h-log', html);
};
let _miniAcc = 0;
UI.drawMinimap = function (dt) {
  _miniAcc += dt; if (_miniAcc < 0.08 || !G.settings.minimap) return; _miniAcc = 0;
  const cv = $('#h-minicv'), c = cv.getContext('2d'), S = cv.width, P = G.P, w = G.world, k = S / 46; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, S, S); c.fillStyle = '#080a10'; c.fillRect(0, 0, S, S); c.imageSmoothingEnabled = false;
  const px = P.x / TS, py = P.y / TS; c.save(); c.translate(S / 2, S / 2); c.scale(k, k); c.drawImage(w.minimap, -px, -py); c.restore();
  const tx = x => (x - px) * k + S / 2, ty = y => (y - py) * k + S / 2;
  const rev = (x, y) => G.revealed[Math.floor(y) * WW + Math.floor(x)];
  for (const n of G.npcs) { if (n.inside) continue; const x = n.x / TS, y = n.y / TS; if (!rev(x, y)) continue; const mk = npcQuestMark(n); c.fillStyle = mk ? (mk === '?' ? '#ffe066' : '#7fd0ff') : '#8f8'; c.beginPath(); c.arc(tx(x), ty(y), mk ? 3.5 : 2.2, 0, TAU); c.fill(); }
  for (const m of G.mons) { if (m.dead || m.hidden) continue; if (m.state !== 'chase' && !m.boss) continue; const x = m.x / TS, y = m.y / TS; if (Math.hypot(x - px, y - py) > 22) continue; c.fillStyle = m.boss ? '#f4f' : '#f44'; c.beginPath(); c.arc(tx(x), ty(y), m.boss ? 4 : 2, 0, TAU); c.fill(); }
  c.save(); c.translate(S / 2, S / 2); c.rotate(P.aim + Math.PI / 2); c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 5); c.lineTo(0, 2); c.lineTo(-5, 5); c.closePath(); c.fill(); c.stroke(); c.restore();
  const n = nightAmount(); if (n > 0.3) { c.fillStyle = `rgba(10,20,60,${n * 0.35})`; c.fillRect(0, 0, S, S); }
};

/* ---------- Диалог ---------- */
UI.showDialog = function () { const d = $('#dialog'); d.classList.remove('hidden'); UI.setPaused(); UI.renderDialog(false); };
UI.hideDialog = function () { clearInterval(UI._typ); $('#dialog').classList.add('hidden'); UI.setPaused(); };
UI.renderDialog = function (keepPortrait) {
  const d = G.dialog; if (!d) return; const n = d.npc, def = n.def, box = $('#dialog'), rel = relOf(def.id);
  if (!keepPortrait || !$('#d-port')) { box.innerHTML = `<div class="dlg"><canvas id="d-port" width="104" height="104"></canvas><div class="dlg-main"><div class="dlg-head"><b>${def.name}</b> <span>${def.title}</span><span class="relbar" title="Отношение"><i style="width:${rel.rel}%"></i></span><em>${relTier(rel.rel)}</em></div><div class="dlg-text" id="d-text"></div><div class="dlg-opts" id="d-opts"></div></div></div>`; portrait($('#d-port'), { race: def.race, gender: def.gender, look: def.look, cls: def.cls, small: def.small, t: 0 }); }
  const tx = $('#d-text'); const full = d.text; let i = 0; clearInterval(UI._typ); tx.textContent = '';
  UI._typ = setInterval(() => { i += 2; tx.textContent = full.slice(0, i); if (i >= full.length) clearInterval(UI._typ); }, 16); tx.onclick = () => { clearInterval(UI._typ); tx.textContent = full; };
  const op = $('#d-opts'); op.innerHTML = ''; d.opts.forEach((o, idx) => { const b = el('button', 'dopt ' + (o.cls || ''), `<i>${idx + 1}</i> ${o.label}`); b.onclick = () => { Snd.play('click'); o.fn(); }; op.appendChild(b); });
  const hd = $('.dlg-head'); if (hd) { $('.relbar i', hd).style.width = rel.rel + '%'; $('em', hd).textContent = relTier(rel.rel); }
};
UI.dialogPick = function (i) { const d = G.dialog; if (d && d.opts[i]) { Snd.play('click'); d.opts[i].fn(); } };

/* ---------- Магазин ---------- */
UI.showShop = function () { const s = $('#shop'); s.classList.remove('hidden'); UI.setPaused(); UI.shopSel = null; UI.renderShop(); };
UI.hideShop = function () { $('#shop').classList.add('hidden'); UI.tip(null); G.shop = null; UI.setPaused(); };
UI.renderShop = function () {
  const sh = G.shop; if (!sh) return; const p = G.prof, def = sh.def, npcId = def.npc, disc = shopDiscount(npcId);
  const box = $('#shop'); const tabs = [['buy', '🛒 Купить'], ['sell', '💰 Продать']]; if (def.pets) tabs.splice(1, 0, ['pets', '🐾 Питомцы']); if (def.bin) { tabs.length = 0; tabs.push(['sell', '💰 Продать']); sh.tab = 'sell'; }
  box.innerHTML = `<div class="shop-win"><div class="shop-head"><div><h2>${def.name}</h2><em>${def.greeting}</em></div><div class="shop-gold">💰 ${fmt(p.gold)}${disc > 0 ? `<small>Скидка ${Math.round(disc * 100)}%${G.events.market ? ' · рынок' : ''}</small>` : ''}</div><button class="xbtn" id="shx">✕</button></div><div class="tabs" id="stabs"></div><div class="shop-body"><div class="shop-list" id="slist"></div><div class="shop-detail" id="sdet"></div></div></div>`;
  $('#shx').onclick = () => UI.hideShop(); const tb = $('#stabs'); tabs.forEach(([k, n]) => { const b = el('button', 'tab' + (sh.tab === k ? ' on' : ''), n); b.onclick = () => { sh.tab = k; UI.shopSel = null; UI.renderShop(); Snd.play('click'); }; tb.appendChild(b); });
  const list = $('#slist'), det = $('#sdet');
  const setDet = html => { det.innerHTML = html; };
  if (sh.tab === 'buy') {
    const ids = def.stock(); ids.forEach(id => { const it = ITEMS[id], price = itemPrice(it, npcId), err = it.slot ? canEquip(it) : null; const r = el('div', 'srow' + (p.gold < price ? ' poor' : '') + (err ? ' lock' : ''), `<span class="si" style="border-color:${TIER_COL[it.tier]}">${it.icon}</span><span class="sn"><b style="color:${TIER_COL[it.tier]}">${it.name}</b><small>${it.slot ? itemStatsText(it).slice(0, 3).join(' · ') : it.desc.slice(0, 60)}</small></span><span class="sp">${err ? '🔒 ' : ''}💰 ${price}</span>`); r.onclick = () => { UI.shopSel = { t: 'item', id }; UI.renderShop(); }; r.ondblclick = () => buyItem(id); tipOn(r, () => itemTipHtml(it, true, price)); if (UI.shopSel && UI.shopSel.id === id) r.classList.add('sel'); list.appendChild(r); });
    const sel = UI.shopSel && UI.shopSel.t === 'item' ? ITEMS[UI.shopSel.id] : null;
    if (sel) { setDet(itemTipHtml(sel, true, itemPrice(sel, npcId)) + `<div class="row"><button class="btn primary" id="bbuy">Купить · 💰 ${itemPrice(sel, npcId)}</button></div><p class="hint">Двойной щелчок по товару — быстрая покупка.</p>`); $('#bbuy').onclick = () => buyItem(sel.id); } else setDet('<p class="hint">Выберите товар, чтобы увидеть подробности. Серые замки — предметы, которые ваш класс не может использовать.</p>');
  } else if (sh.tab === 'pets') {
    (def.pets || []).forEach(pid => { const d = PETS[pid], price = petPrice(pid, npcId), rar = RARITY[d.r]; const r = el('div', 'srow' + (p.gold < price ? ' poor' : ''), `<span class="si" style="border-color:${rar.c}">${d.icon}</span><span class="sn"><b style="color:${rar.c}">${d.name}</b><small>${rar.n} · ${d.perk}</small></span><span class="sp">💰 ${price}</span>`); r.onclick = () => { UI.shopSel = { t: 'pet', id: pid }; UI.renderShop(); }; r.ondblclick = () => buyPet(pid); if (UI.shopSel && UI.shopSel.id === pid) r.classList.add('sel'); list.appendChild(r); });
    const sel = UI.shopSel && UI.shopSel.t === 'pet' ? PETS[UI.shopSel.id] : null;
    if (sel) { const rar = RARITY[sel.r], cv = '<canvas id="pcv" width="120" height="100"></canvas>'; setDet(`<div class="pet-det">${cv}<div class="tt-name" style="color:${rar.c}">${sel.name}</div><div class="tt-sub">${rar.n} питомец</div><div class="tt-stat">Здоровье <b>${Math.round(sel.hp * rar.m)}</b></div><div class="tt-stat">Урон <b>${Math.round(sel.dmg * rar.m)}</b></div><div class="tt-stat">Особенность <b>${sel.perk}</b></div>${p.cls !== 'hunter' ? '<div class="tt-req bad">Питомцев может держать только Охотник</div>' : ''}</div><div class="row"><button class="btn primary" id="bbuy">Купить · 💰 ${petPrice(UI.shopSel.id, npcId)}</button></div>`); const c = $('#pcv').getContext('2d'); c.imageSmoothingEnabled = false; const g = c.createLinearGradient(0, 0, 0, 100); g.addColorStop(0, '#39445e'); g.addColorStop(1, '#1c2234'); c.fillStyle = g; c.fillRect(0, 0, 120, 100); drawCreature(c, { x: 60, y: 84, kind: sel.kind, id: UI.shopSel.id, col: sel.col, acc: sel.acc, size: sel.size * 1.6, t: 0, aura: rar.c + '44' }); $('#bbuy').onclick = () => buyPet(UI.shopSel.id); } else setDet('<p class="hint">Питомцы редких видов дороже, но сильнее. Легендарных зверей не купить — их можно найти или приручить в дикой природе.</p>');
  } else {
    p.inv.forEach((s, idx) => { if (def.bin && !FOODTYPES.includes(ITEMS[s.id].type)) return; const it = ITEMS[s.id], price = sellPrice(it), no = it.type === 'quest' || it.price <= 0; const r = el('div', 'srow' + (no ? ' lock' : ''), `<span class="si" style="border-color:${TIER_COL[it.tier]}">${it.icon}</span><span class="sn"><b style="color:${TIER_COL[it.tier]}">${it.name}${s.n > 1 ? ' ×' + s.n : ''}</b><small>${no ? 'Нельзя продать' : ''}</small></span><span class="sp">${no ? '—' : '💰 ' + price}</span>`); r.onclick = () => { UI.shopSel = { t: 'sell', idx }; UI.renderShop(); }; r.ondblclick = () => sellItem(idx); tipOn(r, () => itemTipHtml(it)); if (UI.shopSel && UI.shopSel.idx === idx) r.classList.add('sel'); list.appendChild(r); });
    if (!p.inv.length) list.innerHTML = '<div class="empty">Сумка пуста</div>';
    const sel = UI.shopSel && UI.shopSel.t === 'sell' ? p.inv[UI.shopSel.idx] : null;
    if (sel) { const it = ITEMS[sel.id]; setDet(itemTipHtml(it) + `<div class="row"><button class="btn primary" id="bsell">Продать · 💰 ${sellPrice(it)}</button></div><p class="hint">Двойной щелчок — продать одну штуку.</p>`); $('#bsell').onclick = () => sellItem(UI.shopSel.idx); } else setDet('<p class="hint">Выберите предмет для продажи. Торговцы платят 40% от цены.</p>');
  }
};

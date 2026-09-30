'use strict';
/* ===== Интерфейс: крафт, заточка, доска заказов, проекты города ===== */
const _renderShopBase = UI.renderShop;
UI.renderShop = function () {
  const sh = G.shop; if (!sh) return;
  if (sh.craft) return UI.renderCraft(); if (sh.board) return UI.renderBoard(); if (sh.projects) return UI.renderProjects();
  return _renderShopBase.call(UI);
};
function shopFrame(title, sub, tabsHtml) {
  const p = G.prof, box = $('#shop');
  box.innerHTML = `<div class="shop-win"><div class="shop-head"><div><h2>${title}</h2><em>${sub || ''}</em></div><div class="shop-gold">💰 ${fmt(p.gold)}</div><button class="xbtn" id="shx">✕</button></div><div class="tabs" id="stabs"></div><div class="shop-body"><div class="shop-list" id="slist"></div><div class="shop-detail" id="sdet"></div></div></div>`;
  $('#shx').onclick = () => UI.hideShop();
  return { list: $('#slist'), det: $('#sdet'), tabs: $('#stabs') };
}
const ingText = ([id, n]) => { const have = countItem(id), ok = have >= n; return `<span style="color:${ok ? '#8f8' : '#f88'}">${ITEMS[id].icon} ${ITEMS[id].name} ${have}/${n}</span>`; };

UI.renderCraft = function () {
  const sh = G.shop, kind = sh.craft, p = G.prof, f = shopFrame(sh.def.name, kind === 'smith' ? 'Ковка, плавка и заточка снаряжения' : kind === 'cook' ? 'Готовьте блюда: еда даёт бонусы на несколько минут' : 'Варите зелья из трав и трофеев');
  const tabs = [['make', '🔧 Создать']]; if (kind === 'smith') tabs.push(['up', '⚒ Заточка']);
  tabs.forEach(([k, n]) => { const b = el('button', 'tab' + (sh.tab === k ? ' on' : ''), n); b.onclick = () => { sh.tab = k; UI.shopSel = null; UI.renderShop(); Snd.play('click'); }; f.tabs.appendChild(b); });
  if (sh.tab === 'up') {
    ['weapon', 'head', 'body', 'boots'].forEach(sl => {
      const id = p.equip[sl], it = id && ITEMS[id]; if (!it) return; const n = p.plus[sl] || 0, c = upgradeCost(n), max = n >= plusMax();
      const r = el('div', 'srow', `<span class="si" style="border-color:${TIER_COL[it.tier]}">${it.icon}</span><span class="sn"><b style="color:${TIER_COL[it.tier]}">${it.name} +${n}</b><small>${max ? 'Максимум' : `Слитки: ${countItem('iron_ingot')}/${c.ingots} · Золото ${c.gold}`}</small></span><span class="sp">${max ? '—' : '+' + (n + 1)}</span>`);
      r.onclick = () => upgradeItem(sl); tipOn(r, () => itemTipHtml(it) + `<div class="tt-hint">Нажмите для заточки. С +4 возможна неудача.</div>`); f.list.appendChild(r);
    });
    if (!f.list.children.length) f.list.innerHTML = '<div class="empty">Наденьте снаряжение, чтобы заточить его.</div>';
    f.det.innerHTML = `<p class="hint">Каждый уровень заточки даёт +10% к урону оружия или защите/здоровью брони. Нужны железные слитки (3 руды → 1 слиток на вкладке «Создать»). Предел: +${plusMax()}${p.projects.forge ? '' : ' (проект «Большая кузница» повышает до +8)'}.</p>`; return;
  }
  const recs = recipesFor(kind);
  recs.forEach((r, i) => {
    const it = ITEMS[r.out], ok = canCraft(r); const row = el('div', 'srow' + (ok ? '' : ' poor'), `<span class="si" style="border-color:${TIER_COL[it.tier]}">${it.icon}</span><span class="sn"><b style="color:${TIER_COL[it.tier]}">${it.name}${r.n > 1 ? ' ×' + r.n : ''}</b><small>${r.ing.map(([id, n]) => `${ITEMS[id].icon}${n}`).join(' ')}${r.gold ? ' 💰' + r.gold : ''}</small></span><span class="sp">${ok ? '✔' : '✖'}</span>`);
    row.onclick = () => { UI.shopSel = i; UI.renderShop(); Snd.play('click'); }; row.ondblclick = () => doCraft(kind, r); tipOn(row, () => itemTipHtml(it)); if (UI.shopSel === i) row.classList.add('sel'); f.list.appendChild(row);
  });
  const r = recs[UI.shopSel];
  if (r) { const it = ITEMS[r.out]; f.det.innerHTML = itemTipHtml(it) + `<h4 style="color:#e6d6a6">Ингредиенты</h4><div>${r.ing.map(ingText).join('<br>')}${r.gold ? `<br><span style="color:${p.gold >= r.gold ? '#8f8' : '#f88'}">💰 ${r.gold}</span>` : ''}</div><div class="row"><button class="btn primary" id="bcr">Создать</button></div><p class="hint">Двойной щелчок — быстрое создание.</p>`; $('#bcr').onclick = () => doCraft(kind, r); }
  else f.det.innerHTML = '<p class="hint">Выберите рецепт. Ингредиенты добывайте на ферме, в рыбалке, в бою и на сборе трав.</p>';
};

UI.renderBoard = function () {
  const d = ensureDaily(), p = G.prof, f = shopFrame('📋 Доска заказов', `Заказы обновляются каждое утро в 6:00 · выполнено всего: ${d.total}`);
  f.list.innerHTML = ''; d.list.forEach((b, i) => {
    const it = b.k === 'deliver' ? ITEMS[b.id] : null, m = b.k === 'kill' ? MON[b.id] : null, done = bountyDone(b), prog = b.k === 'kill' ? `${Math.min(b.prog, b.n)}/${b.n}` : `${Math.min(countItem(b.id), b.n)}/${b.n}`;
    const r = el('div', 'srow' + (b.claimed ? ' lock' : ''), `<span class="si">${b.k === 'kill' ? '⚔️' : it.icon}</span><span class="sn"><b>${b.k === 'kill' ? `Охота: ${m.name} ×${b.n}` : `Доставка: ${it.name} ×${b.n}`}</b><small>Прогресс ${prog} · 💰 ${b.gold} · ⭐ ${b.xp} опыта</small></span><span class="sp">${b.claimed ? '✔ сдано' : done ? '<button class="btn small primary">Сдать</button>' : '…'}</span>`);
    r.onclick = () => { if (!b.claimed && done) claimBounty(i); }; f.list.appendChild(r);
  });
  f.det.innerHTML = '<p class="hint">Заказы подбираются под ваш уровень. Убивайте монстров — прогресс идёт сам. Доставку берите из урожая, рыбы и трофеев. За каждые 5 выполненных заказов — самоцвет.</p><p class="hint">Совет: чем больше делаете каждый день — ферма, рыбалка, заказы, подземелья — тем быстрее богатеет ваш дом и город.</p>';
};

UI.renderProjects = function () {
  const p = G.prof, f = shopFrame('🏗 Проекты города', 'Вкладывайтесь в Эльдергард — он отблагодарит вас навсегда');
  Object.keys(PROJECTS).forEach(id => {
    const pr = PROJECTS[id], done = p.projects[id], can = projectCan(id);
    const r = el('div', 'srow' + (done ? ' lock' : can ? '' : ' poor'), `<span class="si">${pr.icon}</span><span class="sn"><b>${pr.name}${done ? ' ✔' : ''}</b><small>${pr.desc}</small><small>💰 ${pr.gold} · ${pr.items.map(([i, n]) => `${ITEMS[i].icon}${ITEMS[i].name} ${countItem(i)}/${n}`).join(', ')}</small></span><span class="sp">${done ? 'построено' : can ? '<button class="btn small primary">Купить</button>' : ''}</span>`);
    r.onclick = () => { if (!done) buyProject(id); }; f.list.appendChild(r);
  });
  f.det.innerHTML = '<p class="hint">Проекты города дают постоянные бонусы. Материалы — с фермы, из рыбалки, крафта и трофеев.</p>';
};

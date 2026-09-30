'use strict';
/* ===== Интерфейс: меню, профили, создание персонажа, настройки ===== */
const UI = {
  dirty: true, logDirty: true, deathShown: false, screen: null, overlay: false, panelTab: 'inv', toastQ: [],
  toast(text, cls) {
    const box = $('#toasts'); const t = el('div', 'toast ' + (cls || ''), text); box.appendChild(t); while (box.children.length > 5) box.removeChild(box.firstChild);
    setTimeout(() => t.classList.add('out'), 3200); setTimeout(() => t.remove(), 3800);
  },
  banner(title, sub) { const b = $('#banner'); b.innerHTML = `<div class="b-title">${title}</div><div class="b-sub">${sub || ''}</div>`; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); },
  fade(fn) { const f = $('#fade'); f.classList.add('on'); setTimeout(() => { fn && fn(); setTimeout(() => f.classList.remove('on'), 600); }, 700); },
  setPaused() { G.paused = !!(G.panel || G.dialog || G.shop || UI.screen || UI.modal); },
  frame(dt) { UI.hudFrame(dt); },

  /* ---------- Экраны ---------- */
  showScreen(name, overlay) {
    UI.screen = name; UI.overlay = !!overlay; const s = $('#screen'); s.classList.remove('hidden'); s.className = 'screen ' + name + (overlay ? ' overlay' : '');
    if (G.mode === 'play') { UI.setPaused(); }
    UI.stopPreview();
    ({ main: UI.scrMain, profiles: UI.scrProfiles, creator: UI.scrCreator, settings: UI.scrSettings, controls: UI.scrControls, about: UI.scrAbout, pause: UI.scrPause })[name](s);
  },
  hideScreen() { UI.screen = null; UI.stopPreview(); $('#screen').classList.add('hidden'); $('#screen').innerHTML = ''; UI.setPaused(); },
  escape() {
    if (UI.modal) { UI.closeModal(); return; }
    if (UI.screen) { if (G.mode === 'play' && UI.overlay) { if (UI.screen === 'pause') UI.hideScreen(); else UI.showScreen('pause', true); } else if (UI.screen === 'main') { } else UI.showScreen(G.mode === 'play' ? 'pause' : 'main', G.mode === 'play'); return; }
    if (G.mode !== 'play') return;
    if (G.dialog) { closeDialog(); return; } if (G.shop) { UI.hideShop(); return; } if (G.panel) { UI.closePanel(); return; }
    UI.showScreen('pause', true);
  },
  btn(label, fn, cls, sub) { const b = el('button', 'btn ' + (cls || ''), label + (sub ? `<small>${sub}</small>` : '')); b.onclick = () => { Snd.init(); Snd.play('click'); fn(); }; return b; },
  title(sub) { return `<div class="game-title"><div class="t1">Хроники</div><div class="t2">ЭЛЬДЕРГАРДА</div><div class="t3">${sub || 'Пепел и Луна'}</div></div>`; },
  confirm(text, yes, yesLabel) {
    const m = el('div', 'modal'); m.innerHTML = `<div class="modal-box"><p>${text}</p><div class="row"></div></div>`; const row = $('.row', m);
    row.appendChild(UI.btn(yesLabel || 'Да', () => { UI.closeModal(); yes(); }, 'danger')); row.appendChild(UI.btn('Отмена', () => UI.closeModal()));
    document.body.appendChild(m); UI.modal = m; UI.setPaused();
  },
  closeModal() { if (UI.modal) { UI.modal.remove(); UI.modal = null; UI.setPaused(); } },

  scrMain(s) {
    s.innerHTML = `<div class="menu-wrap">${UI.title()}<div class="menu-list" id="mm"></div><div class="menu-foot">v1.0 · WASD — движение · ЛКМ — атака · Esc — меню</div></div>`;
    const list = $('#mm'), last = Save.last();
    if (last) list.appendChild(UI.btn('▶ Продолжить', () => { UI.hideScreen(); startGame(last); }, 'primary', `${last.name} — ${CLASSES[last.cls].name}, ур. ${last.lvl}`));
    list.appendChild(UI.btn('⚔ Новая игра', () => UI.showScreen('creator')));
    list.appendChild(UI.btn('👤 Профили', () => UI.showScreen('profiles'), '', `${Save.list().length} сохранено`));
    list.appendChild(UI.btn('⚙ Настройки', () => UI.showScreen('settings')));
    list.appendChild(UI.btn('⌨ Управление', () => UI.showScreen('controls')));
    list.appendChild(UI.btn('📖 Об игре', () => UI.showScreen('about')));
  },

  /* ---------- Профили ---------- */
  scrProfiles(s) {
    const list = Save.list().sort((a, b) => b.lastPlayed - a.lastPlayed);
    s.innerHTML = `<div class="page"><h2>Профили игры</h2><p class="hint">Каждый профиль — отдельный герой со своим миром, заданиями и прогрессом.</p><div class="prof-list" id="pl"></div><div class="row"><span id="pbtns"></span></div></div>`;
    const pl = $('#pl');
    if (!list.length) pl.innerHTML = '<div class="empty">Пока нет ни одного профиля. Создайте нового героя!</div>';
    list.forEach(p => {
      const card = el('div', 'prof-card'); const cv = el('canvas'); cv.width = 72; cv.height = 72; card.appendChild(cv); portrait(cv, { race: p.race, gender: p.gender, look: p.look, cls: p.cls, player: true, weapon: null, armor: {}, t: 0 });
      const pt = Math.floor(p.playtime / 60), d = calc(p.min || START_ABS_MIN);
      const info = el('div', 'prof-info', `<div class="pn">${p.name}</div><div>${RACES[p.race].name} · ${p.gender === 'female' ? 'жен.' : 'муж.'} · ${CLASSES[p.cls].icon} ${CLASSES[p.cls].name} · <b>ур. ${p.lvl}</b></div><div class="dim">Игровое время: ${Math.floor(pt / 60)} ч ${pt % 60} мин · ${d.day} ${MONTHS_GEN[d.month]} ${d.year} · 💰 ${fmt(p.gold)}</div><div class="dim">Сохранено: ${new Date(p.lastPlayed).toLocaleString('ru-RU')} · Сложность: ${{ easy: 'Лёгкая', normal: 'Обычная', hard: 'Тяжёлая' }[p.difficulty]}</div>`);
      card.appendChild(info); const act = el('div', 'prof-act');
      act.appendChild(UI.btn('Играть', () => { UI.hideScreen(); startGame(p); }, 'primary'));
      act.appendChild(UI.btn('Экспорт', () => { const b = new Blob([JSON.stringify(p)], { type: 'application/json' }), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${p.name}.eldergard.json`; a.click(); }));
      act.appendChild(UI.btn('Удалить', () => UI.confirm(`Удалить профиль «${p.name}»? Это действие нельзя отменить.`, () => { if (G.mode === 'play' && G.prof && G.prof.id === p.id) { } Save.del(p.id); UI.showScreen('profiles', UI.overlay); }, 'Удалить'), 'danger'));
      card.appendChild(act); pl.appendChild(card);
    });
    const pb = $('#pbtns'); pb.appendChild(UI.btn('➕ Новый герой', () => UI.showScreen('creator')));
    const imp = UI.btn('📥 Импорт', () => inp.click()); const inp = el('input'); inp.type = 'file'; inp.accept = '.json'; inp.style.display = 'none';
    inp.onchange = () => { const f = inp.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { const p = JSON.parse(r.result); if (!p.race || !p.cls || !p.lvl) throw 0; p.id = 'p' + Date.now().toString(36); Save.put(p); UI.showScreen('profiles', UI.overlay); UI.toast('Профиль импортирован', 'good'); } catch (e) { UI.toast('Неверный файл профиля', 'warn'); } }; r.readAsText(f); };
    pb.appendChild(imp); pb.appendChild(inp);
    pb.appendChild(UI.btn('← Назад', () => UI.showScreen(G.mode === 'play' && UI.overlay ? 'pause' : 'main', UI.overlay)));
  },

  /* ---------- Создание персонажа ---------- */
  cr: null,
  scrCreator(s) {
    if (!UI.cr) UI.cr = { step: 0, name: '', race: 'human', gender: 'male', cls: 'berserk', difficulty: 'normal', look: { skin: 0, hairStyle: 0, hair: 1, eye: 0, accent: 0, face: 0 }, anim: 'idle', view: 'down', auto: true };
    const c = UI.cr; const steps = ['Раса', 'Внешность', 'Класс', 'Имя и сложность'];
    s.innerHTML = `<div class="creator"><div class="cr-left"><div class="steps" id="steps"></div><div class="cr-body" id="crbody"></div><div class="cr-nav" id="crnav"></div></div><div class="cr-right"><div class="cr-stage"><canvas id="prev" width="440" height="470"></canvas><div class="cr-tools" id="crtools"></div></div><div class="cr-info" id="crinfo"></div></div></div>`;
    const st = $('#steps'); steps.forEach((n, i) => { const b = el('button', 'step' + (i === c.step ? ' on' : ''), `<i>${i + 1}</i> ${n}`); b.onclick = () => { Snd.play('click'); c.step = i; UI.scrCreator(s); }; st.appendChild(b); });
    const body = $('#crbody'), race = RACES[c.race], look = c.look;
    const swatches = (arr, key, cur) => { const d = el('div', 'swatches'); arr.forEach((col, i) => { const b = el('button', 'sw' + (i === cur ? ' on' : '')); b.style.background = col; b.onclick = () => { look[key] = i; Snd.play('click'); refresh(); }; d.appendChild(b); }); return d; };
    const chips = (arr, key, cur) => { const d = el('div', 'chips'); arr.forEach((n, i) => { const b = el('button', 'chip' + (i === cur ? ' on' : ''), n); b.onclick = () => { look[key] = i; Snd.play('click'); refresh(); }; d.appendChild(b); }); return d; };
    const refresh = () => { UI.scrCreator(s); };
    if (c.step === 0) {
      body.innerHTML = '<h3>Выберите расу</h3><p class="hint">У каждой расы есть пассивный бонус и активная способность (клавиша F).</p>'; const g = el('div', 'cards');
      for (const k in RACES) { const r = RACES[k]; const cd = el('button', 'card' + (k === c.race ? ' on' : ''), `<div class="ci">${r.icon}</div><div class="cn">${r.name}</div><div class="cdesc">${r.desc}</div><div class="cp">✦ ${r.passive}</div><div class="cp act">${r.active.icon} <b>${r.active.name}</b>: ${r.active.desc} <i>(перезарядка ${r.active.cd} с)</i></div>`); cd.onclick = () => { c.race = k; look.skin = Math.min(look.skin, RACES[k].skins.length - 1); Snd.play('click'); refresh(); }; g.appendChild(cd); }
      body.appendChild(g);
    } else if (c.step === 1) {
      body.innerHTML = '<h3>Пол и внешность</h3>';
      const gr = el('div', 'row'); ['male', 'female'].forEach(g => { const b = el('button', 'chip big' + (c.gender === g ? ' on' : ''), g === 'male' ? '♂ Мужской' : '♀ Женский'); b.onclick = () => { c.gender = g; Snd.play('click'); refresh(); }; gr.appendChild(b); }); body.appendChild(gr);
      const sec = (t, node) => { body.appendChild(el('div', 'lab', t)); body.appendChild(node); };
      sec('Цвет кожи', swatches(race.skins, 'skin', look.skin)); sec('Причёска', chips(LOOK.hairStyles, 'hairStyle', look.hairStyle)); sec('Цвет волос', swatches(LOOK.hairColors, 'hair', look.hair)); sec('Цвет глаз', swatches(LOOK.eyes, 'eye', look.eye)); sec('Черты лица', chips(LOOK.faces, 'face', look.face)); sec('Цвет одежды (акцент)', swatches(LOOK.accents, 'accent', look.accent));
      const rb = el('div', 'row'); rb.appendChild(UI.btn('🎲 Случайная внешность', () => { look.skin = randi(0, race.skins.length - 1); look.hairStyle = randi(0, 5); look.hair = randi(0, 7); look.eye = randi(0, 5); look.accent = randi(0, 7); look.face = randi(0, 4); c.gender = pick(['male', 'female']); refresh(); })); body.appendChild(rb);
    } else if (c.step === 2) {
      body.innerHTML = '<h3>Выберите класс</h3><p class="hint">У каждого класса своё оружие и стиль боя. Чужое оружие надеть нельзя.</p>'; const g = el('div', 'cards');
      for (const k in CLASSES) { const C = CLASSES[k]; const cd = el('button', 'card' + (k === c.cls ? ' on' : ''), `<div class="ci">${C.icon}</div><div class="cn">${C.name} <small>${C.tagline}</small></div><div class="cdesc">${C.desc}</div><div class="cp">${RES[C.res].icon} ${RES[C.res].name} · Оружие: ${WICON[C.weapon]} ${WTYPE_NAME[C.weapon]}</div>`); cd.onclick = () => { c.cls = k; Snd.play('click'); refresh(); }; g.appendChild(cd); }
      body.appendChild(g);
    } else {
      body.innerHTML = '<h3>Имя героя и сложность</h3>'; const inp = el('input', 'txt'); inp.placeholder = 'Введите имя…'; inp.maxLength = 16; inp.value = c.name; inp.oninput = () => { c.name = inp.value; }; body.appendChild(el('div', 'lab', 'Имя')); body.appendChild(inp);
      const rn = el('div', 'row'); rn.appendChild(UI.btn('🎲 Случайное имя', () => { const a = ['Арн', 'Лира', 'Торин', 'Мира', 'Кейн', 'Элвин', 'Сельма', 'Горн', 'Ниа', 'Рагнар', 'Вельда', 'Дорн'], b = ['', 'ис', 'ар', 'дан', 'вик', 'ель']; c.name = pick(a) + pick(b); inp.value = c.name; })); body.appendChild(rn);
      body.appendChild(el('div', 'lab', 'Сложность')); const dr = el('div', 'chips'); [['easy', 'Лёгкая', 'Враги слабее'], ['normal', 'Обычная', 'Баланс'], ['hard', 'Тяжёлая', 'Враги сильнее и выносливее']].forEach(([k, n, d]) => { const b = el('button', 'chip big' + (c.difficulty === k ? ' on' : ''), `${n}<small>${d}</small>`); b.onclick = () => { c.difficulty = k; Snd.play('click'); refresh(); }; dr.appendChild(b); }); body.appendChild(dr);
      body.appendChild(el('div', 'summary', `<b>${c.name || 'Безымянный'}</b> — ${race.name}, ${c.gender === 'male' ? 'мужчина' : 'женщина'}, ${CLASSES[c.cls].icon} ${CLASSES[c.cls].name}`));
    }
    const nav = $('#crnav'); nav.appendChild(UI.btn('← В меню', () => { UI.cr = null; UI.showScreen(G.mode === 'play' ? 'pause' : 'main', G.mode === 'play'); }));
    if (c.step > 0) nav.appendChild(UI.btn('Назад', () => { c.step--; UI.scrCreator(s); }));
    if (c.step < 3) nav.appendChild(UI.btn('Далее →', () => { c.step++; UI.scrCreator(s); }, 'primary'));
    else nav.appendChild(UI.btn('⚔ Начать приключение', () => {
      const name = (c.name || '').trim(); if (!name) { UI.toast('Введите имя героя', 'warn'); Snd.play('error'); return; }
      const prof = newProfile({ name, race: c.race, gender: c.gender, look: Object.assign({}, c.look), cls: c.cls, difficulty: c.difficulty }); Save.put(prof); UI.cr = null; UI.hideScreen(); startGame(prof);
    }, 'primary big'));
    // инфо-панель справа
    const C = CLASSES[c.cls], info = $('#crinfo'); const w0 = ITEMS[`w_${C.weapon}_0`];
    info.innerHTML = `<div class="ih"><b>${race.icon} ${race.name}</b> · <b>${C.icon} ${C.name}</b></div><div class="il"><b>Раса:</b> ${race.passive}<br><b>${race.active.icon} ${race.active.name}:</b> ${race.active.desc}</div><div class="il"><b>Класс:</b> ${C.style}<br><b>Особенность:</b> ${C.trait}<br><b>Оружие:</b> ${w0.icon} ${w0.name} · <b>Ресурс:</b> ${RES[C.res].icon} ${RES[C.res].name}<br><b>Умения:</b> ${Object.keys(SKILLS).filter(k => SKILLS[k].cls === c.cls && SKILLS[k].type !== 'passive').map(k => SKILLS[k].icon + ' ' + SKILLS[k].name).join(', ')}</div>`;
    const tools = $('#crtools'); [['idle', 'Покой'], ['walk', 'Ходьба'], ['attack', 'Атака'], ['cast', 'Умение']].forEach(([k, n]) => { const b = el('button', 'chip' + (c.anim === k && !c.auto ? ' on' : ''), n); b.onclick = () => { c.anim = k; c.auto = false; UI.scrCreator(s); }; tools.appendChild(b); });
    [['down', '⬇'], ['side', '➡'], ['up', '⬆']].forEach(([k, n]) => { const b = el('button', 'chip' + (c.view === k ? ' on' : ''), n); b.onclick = () => { c.view = k; UI.scrCreator(s); }; tools.appendChild(b); });
    UI.startPreview();
  },
  startPreview() {
    const cv = $('#prev'); if (!cv) return; const c = cv.getContext('2d'); let run = true, t0 = performance.now(); UI._prevStop = () => { run = false; };
    const loop = () => {
      if (!run) return; const cr = UI.cr; const t = (performance.now() - t0) / 1000; c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = false;
      const g = c.createLinearGradient(0, 0, 0, 470); g.addColorStop(0, '#2a3a5a'); g.addColorStop(0.62, '#6a8ab0'); g.addColorStop(0.62, '#4a7a3a'); g.addColorStop(1, '#2f5a2a'); c.fillStyle = g; c.fillRect(0, 0, 440, 470);
      c.fillStyle = 'rgba(255,255,255,0.15)'; for (let i = 0; i < 20; i++) c.fillRect((i * 97) % 440, 300 + (i * 53) % 160, 3, 8);
      const C = CLASSES[cr.cls]; let anim = cr.anim, atk = null, moving = false;
      if (cr.auto) { const ph = Math.floor(t / 2.2) % 3; anim = ['idle', 'walk', 'attack'][ph]; }
      if (anim === 'walk') moving = true;
      const kinds = { berserk: 'slash', mage: 'cast', assassin: 'stab', druid: 'slash', hunter: 'shoot' };
      if (anim === 'attack') atk = { kind: kinds[cr.cls], p: (t * 1.4) % 1 }; if (anim === 'cast') atk = { kind: 'cast', p: (t * 1.2) % 1 };
      c.save(); c.translate(220, 420); c.scale(1, 1);
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(0, 4, 90, 22, 0, 0, TAU); c.fill();
      drawHuman(c, { x: 0, y: 0, dir: cr.view, flip: false, look: cr.look, race: cr.race, gender: cr.gender, cls: cr.cls, player: true, weapon: { wtype: C.weapon, tier: 1 }, armor: {}, t, moving, atk, scale: 6.2 });
      c.restore(); UI._prevRAF = requestAnimationFrame(loop);
    }; loop();
  },
  stopPreview() { if (UI._prevStop) { UI._prevStop(); UI._prevStop = null; } cancelAnimationFrame(UI._prevRAF); },

  /* ---------- Настройки ---------- */
  scrSettings(s) {
    const st = G.settings;
    s.innerHTML = `<div class="page"><h2>Настройки</h2><div class="set-grid" id="sg"></div><div class="row" id="sb"></div></div>`; const g = $('#sg');
    const sec = t => g.appendChild(el('h3', '', t));
    const slider = (label, key, min, max, step, fmtf) => { const r = el('label', 'set-row'); r.innerHTML = `<span>${label}</span>`; const i = el('input'); i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = st[key]; const v = el('b', '', (fmtf || (x => Math.round(x * 100) + '%'))(st[key])); i.oninput = () => { st[key] = +i.value; v.textContent = (fmtf || (x => Math.round(x * 100) + '%'))(st[key]); saveSettings(); if (key === 'sfx') Snd.play('click'); if (key === 'zoom' && G.mode === 'play') { } }; r.appendChild(i); r.appendChild(v); g.appendChild(r); };
    const toggle = (label, key) => { const r = el('label', 'set-row'); r.innerHTML = `<span>${label}</span>`; const i = el('input'); i.type = 'checkbox'; i.checked = !!st[key]; i.onchange = () => { st[key] = i.checked; saveSettings(); }; const sw = el('span', 'switch'); r.appendChild(i); r.appendChild(sw); g.appendChild(r); };
    const select = (label, key, opts, cb) => { const r = el('label', 'set-row'); r.innerHTML = `<span>${label}</span>`; const sl = el('select'); opts.forEach(([v, n]) => { const o = el('option', '', n); o.value = v; if (String(st[key]) === String(v)) o.selected = true; sl.appendChild(o); }); sl.onchange = () => { st[key] = isNaN(+sl.value) ? sl.value : +sl.value; saveSettings(); cb && cb(); }; r.appendChild(sl); g.appendChild(r); };
    sec('🔊 Звук'); slider('Общая громкость', 'master', 0, 1, 0.05); slider('Музыка', 'music', 0, 1, 0.05); slider('Звуковые эффекты', 'sfx', 0, 1, 0.05);
    sec('🎮 Игра'); select('Сложность (для новых монстров)', 'difficulty', [['easy', 'Лёгкая'], ['normal', 'Обычная'], ['hard', 'Тяжёлая']], () => { if (G.prof) G.prof.difficulty = st.difficulty; });
    select('Длина игровых суток', 'dayLen', [[1, 'Медленно (24 мин)'], [2, 'Обычно (12 мин)'], [4, 'Быстро (6 мин)']]);
    toggle('Режим разработчика (панель F2)', 'dev'); toggle('Автосохранение (каждую минуту)', 'autosave'); toggle('Пауза при открытии окон', 'pauseOnPanel'); toggle('Имена персонажей над головой', 'showNames');
    sec('🖥 Графика и интерфейс'); slider('Масштаб камеры', 'zoom', 1, 2.5, 0.1, x => x.toFixed(1) + '×'); toggle('Числа урона', 'dmgNumbers'); toggle('Тряска экрана', 'shake'); toggle('Погода (дождь/снег)', 'weather'); toggle('Частицы и эффекты', 'particles'); toggle('Миникарта', 'minimap');
    const b = $('#sb'); b.appendChild(UI.btn('⛶ Полный экран', () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); else document.exitFullscreen(); }));
    b.appendChild(UI.btn('Сбросить', () => { G.settings = Object.assign({}, DEFAULT_SETTINGS); saveSettings(); UI.scrSettings(s); }));
    b.appendChild(UI.btn('← Назад', () => { saveSettings(); UI.showScreen(G.mode === 'play' && UI.overlay ? 'pause' : 'main', UI.overlay); }, 'primary'));
  },
  scrControls(s) {
    const rows = [['W A S D / стрелки', 'Движение'], ['ЛКМ / Пробел', 'Обычная атака (в сторону курсора)'], ['1 – 5', 'Умения класса'], ['Q', 'Зелье здоровья'], ['R', 'Тоник (мана / выносливость / ярость)'], ['V', 'Эликсир-усилитель'], ['F', 'Расовая способность'], ['E', 'Действие: говорить, грядка (посадить/полить/собрать), рыбалка, портал, ящик, доска заказов, сон'], ['T', 'Охотник: призвать/отозвать питомца · Друид: вернуть человеческий облик'], ['I', 'Инвентарь'], ['C', 'Персонаж'], ['K', 'Ветка умений'], ['J', 'Задания'], ['M', 'Карта'], ['B', 'Бестиарий'], ['P', 'Питомцы'], ['L', 'Календарь и события'], ['Esc', 'Меню / закрыть окно'], ['F1', 'Эта подсказка']];
    s.innerHTML = `<div class="page"><h2>Управление</h2><table class="keys">${rows.map(r => `<tr><td><kbd>${r[0]}</kbd></td><td>${r[1]}</td></tr>`).join('')}</table><div class="row" id="cb"></div></div>`;
    $('#cb').appendChild(UI.btn('← Назад', () => { if (G.mode === 'play' && UI.overlay) UI.hideScreen(); else UI.showScreen('main'); }, 'primary'));
  },
  scrAbout(s) {
    s.innerHTML = `<div class="page"><h2>Об игре</h2><div class="about"><p><b>Хроники Эльдергарда: Пепел и Луна</b> — RPG с открытым миром в жанре средневекового фэнтези.</p><p>Создайте героя: 5 рас, 5 классов (Берсерк, Маг, Ассасин, Друид, Охотник), выберите внешность. Исследуйте мир — города, леса, горы, болота и пепельные земли. Выполняйте сюжетные и побочные задания, сражайтесь с монстрами и заполняйте бестиарий, приручайте зверей, торгуйте, участвуйте в событиях календаря.</p><p>Мир живёт своей жизнью: смена дня и ночи, времена года, погода, NPC с расписанием, памятью и отношением к вам.</p><p class="dim">Игра работает целиком в браузере, все данные и профили хранятся локально.</p></div><div class="row" id="ab"></div></div>`;
    $('#ab').appendChild(UI.btn('← Назад', () => UI.showScreen('main'), 'primary'));
  },
  scrPause(s) {
    s.innerHTML = `<div class="menu-wrap small"><h2>Пауза</h2><div class="menu-list" id="pm"></div><div class="menu-foot" id="pf"></div></div>`; const l = $('#pm'); const p = G.prof;
    $('#pf').textContent = `${p.name} · ${CLASSES[p.cls].name} · ур. ${p.lvl} · ${dateStr()} ${timeStr()}`;
    l.appendChild(UI.btn('▶ Продолжить', () => UI.hideScreen(), 'primary')); l.appendChild(UI.btn('💾 Сохранить игру', () => saveGame(false)));
    l.appendChild(UI.btn('⚙ Настройки', () => UI.showScreen('settings', true))); l.appendChild(UI.btn('⌨ Управление', () => UI.showScreen('controls', true)));
    l.appendChild(UI.btn('👤 Профили', () => UI.showScreen('profiles', true)));
    l.appendChild(UI.btn('🚪 Выйти в главное меню', () => { saveGame(true); G.mode = 'menu'; UI.hideHud(); UI.screen = null; UI.showScreen('main'); }, 'danger'));
  },

  /* ---------- Смерть, вступление, финал ---------- */
  showDeath() { UI.deathShown = true; const d = $('#death'); d.classList.remove('hidden'); d.innerHTML = `<div class="death-box"><h1>Вы погибли</h1><p>Тьма отступает… Вас принесли в Эльдергард. Вы потеряли 10% золота.</p><div id="db"></div></div>`; $('#db').appendChild(UI.btn('Возродиться', () => respawnPlayer(), 'primary')); },
  hideDeath() { UI.deathShown = false; $('#death').classList.add('hidden'); },
  showIntro() {
    const pages = [`Год ${START_YEAR}. Король Эльдергарда мёртв, а трон пуст. По королевству ползут слухи о культе Пепла — безумцах, что поклоняются древнему огню и превращают зверей и людей в своё оружие.`, `Вы — ${G.prof.name}. Всю жизнь вы скитались по дорогам, пока не пришло письмо: умер ваш дед Гаррет, бывший королевский лесничий. В завещании — ферма к югу от вольного города Эльдергард и странная приписка: «Пепел просыпается. Ферма — ключ».`, `Вы просыпаетесь в старом доме деда. Здесь всё начнётся: прочтите письмо, заберите припасы, выйдите на ферму и посадите первые семена — подсказки и стрелка покажут путь. Потом — в город, к мэру Маррену. Днём — грядки, рыбалка, ремесло, заказы; ночью и в подземельях — настоящие опасности.`, `Мир открыт. Стройте ферму, развивайте город, копите силу — и когда придёт время, вы встретите Пепел лицом к лицу. Безопасные зоны (🛡): город, хутор, башня, ферма. Удачи, ${G.prof.name}.`];
    let i = 0; const m = el('div', 'modal story'); document.body.appendChild(m); UI.modal = m; UI.setPaused();
    const show = () => { m.innerHTML = `<div class="story-box"><div class="st-title">Пролог</div><p>${pages[i]}</p><div class="row"></div></div>`; $('.row', m).appendChild(UI.btn(i < pages.length - 1 ? 'Далее →' : '⚔ В путь!', () => { i++; if (i >= pages.length) UI.closeModal(); else show(); }, 'primary')); };
    show();
  },
  showLetter() {
    const m = el('div', 'modal story'); document.body.appendChild(m); UI.modal = m; UI.setPaused(); Snd.play('quest');
    m.innerHTML = `<div class="story-box letter"><div class="st-title">✉ Письмо деда</div><p><i>«Дорогой внук! Если ты читаешь это — значит, меня уже нет, а ты добрался до нашего дома. Не печалься: я прожил долгую жизнь королевским лесничим, а под старость выбрал тишину, грядки и озеро.</i></p><p><i>Но тишина не вечна. Я видел знаки: ночные огни на северо-востоке, волчьи стаи у дорог, печати Пепла на плечах разбойников. Культ ищет то, что спрятано в горах. Я не успел остановить их.</i></p><p><i>Ферма — твоя. Земля кормит, а сытый человек силён. Возьми припасы из сундука, посади семена и ступай к мэру Маррену в Эльдергард: он знает больше. Пепел просыпается, и нужен тот, кто ему ответит. Твой дед Гаррет.»</i></p><div class="row"></div></div>`;
    $('.row', m).appendChild(UI.btn('Сложить письмо', () => UI.closeModal(), 'primary'));
  },
  showEnding() {
    const p = G.prof, m = el('div', 'modal story'); const pt = Math.floor(p.playtime / 60); document.body.appendChild(m); UI.modal = m; UI.setPaused(); Snd.play('levelup');
    m.innerHTML = `<div class="story-box"><div class="st-title">🏆 Пепел угас</div><p>Малгрет Пепельный повержен, культ разбит, а Эльдергард празднует победу. Имя героя ${p.name} будет жить в песнях бардов.</p><p>Но мир огромен: остались нераскрытые тайны, редкие звери и легендарные враги.</p><div class="dim">Уровень: ${p.lvl} · Убито монстров: ${p.kills} · Смертей: ${p.deaths} · Время: ${Math.floor(pt / 60)} ч ${pt % 60} мин</div><div class="row"></div></div>`;
    $('.row', m).appendChild(UI.btn('Продолжить приключение', () => { UI.closeModal(); saveGame(true); }, 'primary'));
  }
};

/* Портрет персонажа на маленьком холсте */
function portrait(cv, o) {
  const c = cv.getContext('2d'), s = cv.width; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, s, s); c.imageSmoothingEnabled = false;
  const g = c.createLinearGradient(0, 0, 0, s); g.addColorStop(0, '#39445e'); g.addColorStop(1, '#1c2234'); c.fillStyle = g; c.fillRect(0, 0, s, s);
  const sc = s / 29; drawHuman(c, Object.assign({ x: s / 2, y: s * 0.42 + 27 * sc, dir: 'down', scale: sc, t: 0 }, o));
}

'use strict';
/* ===== Ядро игры: состояние, профили, статы, инвентарь, время ===== */
const DEFAULT_SETTINGS = { master: 0.8, music: 0.5, sfx: 0.7, difficulty: 'normal', dayLen: 2, dmgNumbers: true, shake: true, weather: true, minimap: true, zoom: 1.5, particles: true, autosave: true, pauseOnPanel: true, showNames: true };
const G = {
  mode: 'menu', world: null, prof: null, P: null, mons: [], npcs: [], petEnt: null, proj: [], fx: [], texts: [], areas: [], timers: [], lightning: [],
  cam: { x: 0, y: 0, zoom: 1.5 }, t: 0, min: START_ABS_MIN, timeScale: 2, settings: null, keys: new Set(), mouse: { x: 0, y: 0, wx: 0, wy: 0, down: false },
  paused: false, panel: null, dialog: null, shop: null, events: {}, weather: { kind: 'clear', amt: 0, target: 0 }, log: [], target: null, targetT: 0,
  cd: {}, potCd: { hp: 0, rs: 0 }, revealed: new Uint8Array(WW * WH), opened: new Set(), tourney: null, raid: null, dpr: 1, shakeT: 0, shakeA: 0, cutscene: null, lastSave: 0, deathT: 0, mapDirty: true, lastRain: 0
};

/* ===== Настройки ===== */
function loadSettings() {
  let s = {}; try { s = JSON.parse(localStorage.getItem('rpg_settings') || '{}'); } catch (e) { }
  G.settings = Object.assign({}, DEFAULT_SETTINGS, s); applySettings();
}
function saveSettings() { try { localStorage.setItem('rpg_settings', JSON.stringify(G.settings)); } catch (e) { } applySettings(); }
function applySettings() {
  const s = G.settings; Snd.vol.master = s.master; Snd.vol.music = s.music; Snd.vol.sfx = s.sfx; Snd.apply();
  G.timeScale = s.dayLen; G.cam.zoom = s.zoom;
}

/* ===== Профили (сохранения) ===== */
const Save = {
  key: 'rpg_profiles_v1',
  list() { try { return JSON.parse(localStorage.getItem(this.key) || '[]'); } catch (e) { return []; } },
  get(id) { return this.list().find(p => p.id === id); },
  put(p) { const l = this.list(); const i = l.findIndex(x => x.id === p.id); if (i >= 0) l[i] = p; else l.push(p); try { localStorage.setItem(this.key, JSON.stringify(l)); return true; } catch (e) { return false; } },
  del(id) { const l = this.list().filter(p => p.id !== id); localStorage.setItem(this.key, JSON.stringify(l)); if (localStorage.getItem('rpg_last') === id) localStorage.removeItem('rpg_last'); },
  last() { const id = localStorage.getItem('rpg_last'); return id ? this.get(id) : null; },
  setLast(id) { try { localStorage.setItem('rpg_last', id); } catch (e) { } }
};

function newProfile(o) {
  const C = CLASSES[o.cls];
  const p = {
    id: 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1000), name: o.name || 'Герой', created: Date.now(), lastPlayed: Date.now(), playtime: 0,
    race: o.race, gender: o.gender, look: o.look, cls: o.cls, difficulty: o.difficulty || 'normal',
    lvl: 1, xp: 0, sp: 1, skills: {}, hp: 9999, res: 9999, gold: 60, inv: [], equip: { weapon: `w_${C.weapon}_0` },
    pos: { x: WORLD_SPAWN.x * TS, y: WORLD_SPAWN.y * TS }, min: START_ABS_MIN, quests: {}, bestiary: {}, pets: [], activePet: null, rel: {}, opened: [], defeated: [], revealed: '',
    flags: {}, kills: 0, deaths: 0, heard: {}, version: 2, farm: {}, daily: null, projects: {}, plus: {}
  };
  for (const id in SKILLS) if (SKILLS[id].cls === o.cls && SKILLS[id].start) p.skills[id] = 1;
  p.inv = [{ id: 'hp_0', n: 3 }, { id: 'rs_0', n: 2 }, { id: 'scroll_town', n: 1 }];
  if (o.cls === 'hunter') p.inv.push({ id: 'lure', n: 4 }, { id: 'treat', n: 2 });
  if (o.cls === 'mage') p.equip.body = 'a_cloth_body_0';
  p.quests.st1 = { state: 'active', prog: [0], ready: false };
  return p;
}

/* ===== Время ===== */
function gt() { return calc(G.min); }
function timeStr() { const d = gt(); return `${pad2(d.hour)}:${pad2(d.minute)}`; }
function dateStr() { const d = gt(); return `${WD_SHORT[d.wd]}, ${d.day} ${MONTHS_GEN[d.month]} ${d.year}`; }
function nightAmount() { const h = gt().hf; return h >= 21 || h < 5 ? 1 : h >= 19.5 ? (h - 19.5) / 1.5 : h < 6.5 ? 1 - (h - 5) / 1.5 : 0; }
function isNight() { return nightAmount() > 0.5; }

/* ===== Статы ===== */
function recalc() {
  const p = G.prof, C = CLASSES[p.cls], R = RACES[p.race], L = p.lvl, P = G.P;
  const s = { maxHp: C.base.hp + C.growth.hp * (L - 1), maxRes: C.base.res, dmg: C.base.dmg + C.growth.dmg * 0.8 * (L - 1), def: C.base.def + C.growth.def * (L - 1), spd: C.base.spd, crit: C.base.crit, critDmg: 1.5, dodge: 0, regen: C.base.regen, hpRegen: p.cls === 'druid' ? 1.2 : 0.4, lifesteal: 0, luck: 1, xp: 1, gold: 1, atkSpd: 1, dr: 0, range: 1, petDmg: 0, petHp: 0 };
  const add = (st) => { for (const k in st) { const v = st[k]; switch (k) { case 'hp': s.maxHp += v; break; case 'res': s.maxRes += v; break; case 'luck': s.luck += v; break; case 'xp': s.xp += v; break; default: s[k] = (s[k] || 0) + v; } } };
  for (const sl in p.equip) { const it = ITEMS[p.equip[sl]]; if (!it) continue; const pl = (p.plus && p.plus[sl]) || 0, st = Object.assign({}, it.stats); if (pl) { if (st.dmg) st.dmg *= 1 + 0.1 * pl; if (st.def) st.def *= 1 + 0.1 * pl; if (st.hp) st.hp *= 1 + 0.1 * pl; } add(st); }
  const m = R.mods; if (m.xp) s.xp *= m.xp; if (m.crit) s.crit += m.crit; if (m.regen) s.regen *= m.regen; if (m.def) s.def *= m.def; if (m.gold) s.gold *= m.gold; if (m.dmg) s.dmg *= m.dmg; if (m.hp) s.maxHp *= m.hp; if (m.dodge) s.dodge += m.dodge; if (m.luck) s.luck *= m.luck;
  const sk = id => p.skills[id] || 0, sv = id => SKILLS[id].v[sk(id) - 1];
  if (sk('bloodlust')) s.lifesteal += sv('bloodlust') / 100; if (sk('unbroken')) s.maxHp *= 1 + sv('unbroken') / 100;
  if (sk('wisdom')) { s.maxRes *= 1 + sv('wisdom') / 100; s.regen *= 1 + sv('wisdom') / 100; }
  if (sk('deadly')) s.crit += sv('deadly') / 100; if (sk('evasion')) s.dodge += sv('evasion') / 100; if (sk('barkskin')) s.def *= 1 + sv('barkskin') / 100;
  if (sk('bond')) { s.petDmg += sv('bond') / 100; s.petHp += sv('bond') / 100; } if (sk('eagleeye')) { s.crit += sv('eagleeye') / 100; s.range *= 1.1; }
  // питомец
  const ap = activePetData();
  if (ap) { const pm = PETS[ap.id].mods; if (pm.gold) s.gold += pm.gold; if (pm.hpPct) s.maxHp *= 1 + pm.hpPct; if (pm.crit) s.crit += pm.crit; if (pm.dmgPct) s.dmg *= 1 + pm.dmgPct; if (pm.defPct) s.def *= 1 + pm.defPct; if (pm.spdPct) s.spd *= 1 + pm.spdPct; if (pm.regen) s.hpRegen += pm.regen; if (pm.critDmg) s.critDmg += pm.critDmg; }
  // формы
  if (P && P.form) {
    const v = SKILLS[P.form].v[sk(P.form) - 1] / 100;
    if (P.form === 'wolf') { s.spd *= 1 + v; s.dmg *= 1.2; s.atkSpd *= 1.3; }
    if (P.form === 'bear') { s.maxHp *= 1 + v; s.dr += 0.3; s.def *= 1.3; }
    if (P.form === 'eagle') { s.dodge += v; s.spd *= 1.15; }
  }
  // баффы
  if (P) {
    P.buffs = P.buffs.filter(b => b.until > G.t);
    for (const b of P.buffs) { const m2 = b.mods; if (m2.dmgPct) s.dmg *= 1 + m2.dmgPct; if (m2.spdPct) s.spd *= 1 + m2.spdPct; if (m2.defPct) s.def *= 1 + m2.defPct; if (m2.xpPct) s.xp += m2.xpPct; if (m2.goldPct) s.gold += m2.goldPct; if (m2.luckPct) s.luck += m2.luckPct; if (m2.hpRegen) s.hpRegen += m2.hpRegen; if (m2.dr) s.dr += m2.dr; if (m2.atkSpdPct) s.atkSpd *= 1 + m2.atkSpdPct; if (m2.dodge) s.dodge += m2.dodge; }
  }
  s.dr = Math.min(0.8, s.dr); s.dodge = Math.min(0.6, s.dodge); s.crit = Math.min(0.85, s.crit);
  const oldMax = P ? P.maxHp : s.maxHp;
  G.S = s;
  if (P) { P.maxHp = s.maxHp; P.maxRes = s.maxRes; if (oldMax > 0 && oldMax !== s.maxHp && P.hp > 0) P.hp = clamp(P.hp * s.maxHp / oldMax, 1, s.maxHp); P.hp = Math.min(P.hp, s.maxHp); P.res = Math.min(P.res, s.maxRes); }
  return s;
}
function activePetData() { const p = G.prof; return p && p.activePet ? p.pets.find(x => x.uid === p.activePet) : null; }
function weaponData() { const it = ITEMS[G.prof.equip.weapon]; return it ? { wtype: it.wtype, tier: it.tier } : null; }
function armorTiers() { const e = G.prof.equip, f = s => e[s] ? ITEMS[e[s]].tier : -1; return { body: f('body'), head: f('head'), boots: f('boots') }; }

/* ===== Инвентарь ===== */
function invCap() { return 40 + (G.prof && G.prof.projects && G.prof.projects.bag ? 10 : 0); }
function addItem(id, n = 1, silent) {
  const it = ITEMS[id]; if (!it) return 0; const inv = G.prof.inv; let left = n;
  for (const s of inv) { if (s.id === id && s.n < it.stack && left > 0) { const a = Math.min(left, it.stack - s.n); s.n += a; left -= a; } }
  while (left > 0 && inv.length < invCap()) { const a = Math.min(left, it.stack); inv.push({ id, n: a }); left -= a; }
  if (left > 0) { logMsg('Сумка полна!', 'warn'); Snd.play('error'); }
  const got = n - left;
  if (got > 0 && !silent) { logMsg(`Получено: ${it.icon} ${it.name}${got > 1 ? ' ×' + got : ''}`, 'item'); Snd.play('pickup'); if (G.P) floatText(G.P.x, G.P.y - 50, `+${it.icon}`, '#fff'); }
  if (got > 0) { questRecheck(); if (window.UI) UI.dirty = true; }
  return got;
}
function countItem(id) { let n = 0; for (const s of G.prof.inv) if (s.id === id) n += s.n; return n; }
function removeItem(id, n = 1) {
  const inv = G.prof.inv; let left = n;
  for (let i = inv.length - 1; i >= 0 && left > 0; i--) { if (inv[i].id === id) { const a = Math.min(left, inv[i].n); inv[i].n -= a; left -= a; if (inv[i].n <= 0) inv.splice(i, 1); } }
  if (window.UI) UI.dirty = true; return n - left;
}
function addGold(n) { G.prof.gold += Math.floor(n); if (window.UI) UI.dirty = true; }
function canEquip(it) {
  const p = G.prof, C = CLASSES[p.cls];
  if (!it.slot) return 'Нельзя надеть';
  if (it.type === 'weapon' && it.cls !== p.cls) return `${C.name} не может использовать: ${WTYPE_NAME[it.wtype].toLowerCase()} (оружие класса «${CLASSES[it.cls].name}»)`;
  if (it.type === 'armor' && !C.armor.includes(it.atype)) return `${C.name} не носит ${ATYPE_NAME[it.atype].toLowerCase()} броню`;
  if (p.lvl < it.req) return `Нужен уровень ${it.req}`;
  return null;
}
function equipItem(idx) {
  const p = G.prof, s = p.inv[idx]; if (!s) return; const it = ITEMS[s.id], err = canEquip(it);
  if (err) { logMsg(err, 'warn'); Snd.play('error'); toast(err, 'warn'); return; }
  const old = p.equip[it.slot]; p.equip[it.slot] = it.id; removeItem(it.id, 1); if (old) addItem(old, 1, true);
  if (G.P && G.P.form) setForm(null, true);
  recalc(); Snd.play('click'); logMsg(`Надето: ${it.icon} ${it.name}`); UI.dirty = true;
}
function unequip(slot) { const p = G.prof, id = p.equip[slot]; if (!id) return; if (p.inv.length >= invCap()) { toast('Сумка полна', 'warn'); return; } delete p.equip[slot]; addItem(id, 1, true); recalc(); Snd.play('click'); UI.dirty = true; }
function itemStatsText(it) {
  const names = { dmg: 'Урон', def: 'Защита', hp: 'Здоровье', res: 'Ресурс', crit: 'Крит', critDmg: 'Крит. урон', spd: 'Скорость', regen: 'Восст. ресурса', lifesteal: 'Вампиризм', luck: 'Удача', xp: 'Опыт' };
  return Object.keys(it.stats || {}).map(k => { const v = it.stats[k], pct = ['crit', 'critDmg', 'lifesteal', 'luck', 'xp'].includes(k); return `${names[k] || k} +${pct ? Math.round(v * 100) + '%' : (Number.isInteger(v) ? v : v.toFixed(1))}`; });
}
function usePotionSlot(kind) {
  const P = G.P; if (!P || P.dead) return; const pre = kind === 'hp' ? 'hp_' : 'rs_'; if (G.potCd[kind] > G.t) { return; }
  const ids = [0, 1, 2].map(i => pre + i).filter(id => countItem(id) > 0); if (!ids.length) { toast(kind === 'hp' ? 'Нет зелий здоровья' : 'Нет тоников', 'warn'); Snd.play('error'); return; }
  // берём наименьшее, которое покрывает нужду, иначе самое большое
  const need = kind === 'hp' ? P.maxHp - P.hp : P.maxRes - P.res; let chosen = ids[ids.length - 1];
  for (const id of ids) { const e = ITEMS[id].effect; if ((e.heal || e.res) >= need * 0.9) { chosen = id; break; } }
  useItemId(chosen);
}
function useItemId(id) {
  const it = ITEMS[id], P = G.P; if (!it || !countItem(id) || P.dead) return false; const e = it.effect;
  if (it.type === 'petfood') { const ap = activePetData(); if (!ap) { toast('Нет активного питомца', 'warn'); return false; } removeItem(id, 1); petGainXp(ap, 60); Snd.play('pickup'); logMsg('Питомец доволен!'); return true; }
  if (!e) return false;
  if (e.heal) { if (P.hp >= P.maxHp) { toast('Здоровье полное', 'warn'); return false; } G.potCd.hp = G.t + 5; P.hp = Math.min(P.maxHp, P.hp + e.heal); floatText(P.x, P.y - 50, `+${e.heal}`, '#5f5'); burst(P.x, P.y - 16, '#5f5', 10); Snd.play('heal'); }
  else if (e.res) { if (P.res >= P.maxRes) { toast('Ресурс полный', 'warn'); return false; } G.potCd.rs = G.t + 5; P.res = Math.min(P.maxRes, P.res + e.res); floatText(P.x, P.y - 50, `+${e.res}`, RES[CLASSES[G.prof.cls].res].color); burst(P.x, P.y - 16, '#8cf', 10); Snd.play('heal'); }
  else if (e.buff) { addBuff(id, it.name, it.icon, e.buff, e.dur); Snd.play('heal'); burst(P.x, P.y - 16, '#ff8', 12); }
  else if (e.town) { teleportTown(); }
  removeItem(id, 1); return true;
}
function addBuff(id, name, icon, mods, dur) {
  const P = G.P; P.buffs = P.buffs.filter(b => b.id !== id); P.buffs.push({ id, name, icon, mods, until: G.t + dur, dur }); recalc(); UI.dirty = true;
}
function teleportTown() { const P = G.P; burst(P.x, P.y - 16, '#fff', 20); P.x = 50 * TS + 16; P.y = 53 * TS; G.petEnt && (G.petEnt.x = P.x, G.petEnt.y = P.y); burst(P.x, P.y - 16, '#fff', 20); Snd.play('cast'); logMsg('Вы перенеслись на площадь Эльдергарда.'); }

/* ===== Опыт и уровни ===== */
function gainXp(n, silent) {
  const p = G.prof; if (p.lvl >= MAX_LEVEL) return; const amt = Math.round(n * G.S.xp); p.xp += amt; if (!silent && G.P) floatText(G.P.x, G.P.y - 62, `+${amt} XP`, '#fd6');
  while (p.lvl < MAX_LEVEL && p.xp >= xpNeed(p.lvl)) {
    p.xp -= xpNeed(p.lvl); p.lvl++; p.sp++; recalc(); G.P.hp = G.P.maxHp; G.P.res = G.P.maxRes;
    Snd.play('levelup'); logMsg(`⭐ Новый уровень: ${p.lvl}! Получено очко умений.`, 'good'); toast(`⭐ Уровень ${p.lvl}! +1 очко умений`, 'good'); burst(G.P.x, G.P.y - 20, '#ffe066', 40, 90);
    ringFx(G.P.x, G.P.y, '#ffe066', 70);
  }
  if (p.lvl >= MAX_LEVEL) p.xp = 0; UI.dirty = true;
}
function learnSkill(id) {
  const p = G.prof, s = SKILLS[id]; if (s.cls !== p.cls) return; const r = p.skills[id] || 0;
  if (r >= 3) return toast('Максимальный ранг', 'warn'); if (p.sp < 1) return toast('Нет очков умений', 'warn'); if (p.lvl < s.req) return toast(`Нужен уровень ${s.req}`, 'warn');
  if (s.tier === 2) { const t1 = Object.keys(SKILLS).find(k => SKILLS[k].cls === p.cls && SKILLS[k].branch === s.branch && SKILLS[k].tier === 1); if (!(p.skills[t1] > 0)) return toast('Сначала изучите умение первого яруса этой ветки', 'warn'); }
  p.sp--; p.skills[id] = r + 1; recalc(); Snd.play('levelup'); logMsg(`Изучено: ${s.icon} ${s.name} (ранг ${r + 1})`, 'good'); UI.dirty = true;
}
function respecSkills() {
  const p = G.prof; let total = 0; for (const id in p.skills) total += p.skills[id]; const start = Object.keys(SKILLS).filter(k => SKILLS[k].cls === p.cls && SKILLS[k].start).length;
  p.skills = {}; for (const id in SKILLS) if (SKILLS[id].cls === p.cls && SKILLS[id].start) p.skills[id] = 1;
  p.sp += total - start; if (G.P.form) setForm(null, true); recalc(); UI.dirty = true;
}
function hotbarSkills() { const p = G.prof; return Object.keys(SKILLS).filter(id => SKILLS[id].cls === p.cls && SKILLS[id].type !== 'passive' && p.skills[id] > 0); }

/* ===== Журнал сообщений / тосты ===== */
function logMsg(text, cls) { G.log.push({ text, cls: cls || '', t: G.t }); if (G.log.length > 60) G.log.shift(); if (window.UI) UI.logDirty = true; }
function toast(text, cls) { if (window.UI) UI.toast(text, cls); }

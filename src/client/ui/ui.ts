import { AFFIX_BY_ID } from '../../data/affixes';
import { CLASS_NAMES, itemDef } from '../../data/items';
import { getLang, L, setLang, t, type Loc } from '../../data/loc';
import { LORE_BY_ID } from '../../data/lore';
import { SHOPS } from '../../data/shops';
import { S, tr, type StrKey } from '../../data/strings';
import { tierForFloor } from '../../data/tiers';
import { formatTime } from '../../core/math';
import type { Game, ItemRef } from '../../game/game';
import { STATION_NAMES } from '../../data/recipes';
import { UPGRADES } from '../../data/manor';
import { QUESTS } from '../../data/quests';
import { NPCS } from '../../data/npcs';
import { REACTION_LABEL } from '../../game/systems/relations';
import { hearts } from '../../game/state';
import { countItem } from '../../game/systems/inventory';
import { rotatingPrice } from '../../game/systems/economy';
import { SEASONS } from '../../game/systems/calendar';
import { epilogue, type EndingId } from '../../data/endings';
import { FACTIONS, repTier } from '../../data/factions';
import { WEATHER_ICONS, seasonName, weekday } from '../../game/systems/calendar';
import { formatAffix, itemName, RARITY_NAMES } from '../../game/systems/loot';
import { classLevel, classXpToNext, weaponClassOf, xpToNext } from '../../game/systems/stats';
import { talentBlock, talentPoints, talentsOf } from '../../game/systems/talents';
import { TALENT_BY_ID } from '../../data/talents';
import { WEAPON_PROFILES } from '../../game/combat/weapons';
import { listSaves, type KV } from '../../game/systems/save';
import { EQUIP_SLOTS, WEAPON_CLASSES, type EquipSlot, type ItemStack, type WeaponClass } from '../../game/types';
import type { Audio } from '../engine/audio';
import type { Renderer } from '../gfx/renderer';
import { clear, h, show } from './dom';

export interface UiCallbacks {
  newGame(name: string, slot: number): void;
  continueGame(slot: number): void;
  saveAndQuit(): void;
  settingsChanged(): void;
}

type MenuTab = 'inv' | 'skills' | 'quests' | 'relations' | 'chronicle' | 'settings';

const SLOT_LABEL: Record<EquipSlot, Loc> = {
  weapon: L('Оружие', 'Weapon'), weapon2: L('Запас', 'Spare'), head: L('Шлем', 'Head'), body: L('Тело', 'Body'),
  feet: L('Ноги', 'Feet'), amulet: L('Амулет', 'Amulet'), ring1: L('Кольцо', 'Ring'), ring2: L('Кольцо', 'Ring'),
};

const KIND_NAMES: Record<string, Loc> = {
  weapon: L('Оружие', 'Weapon'), armor: L('Броня', 'Armor'), accessory: L('Украшение', 'Accessory'), material: L('Материал', 'Material'),
  consumable: L('Зелье', 'Potion'), food: L('Еда', 'Food'), quest: L('Особый предмет', 'Key item'), seed: L('Семена', 'Seeds'), gift: L('Подарок', 'Gift'),
};

export class Ui {
  game: Game | null = null;
  private hud: HTMLElement;
  private hpBar!: HTMLElement;
  private hpLag!: HTMLElement;
  private stBar!: HTMLElement;
  private mpBar!: HTMLElement;
  private enBar!: HTMLElement;
  private hpText!: HTMLElement;
  private heroLine!: HTMLElement;
  private clock!: HTMLElement;
  private floorLabel!: HTMLElement;
  private quickbar!: HTMLElement;
  private toasts!: HTMLElement;
  private prompt!: HTMLElement;
  private bossbar!: HTMLElement;
  private dialogueEl: HTMLElement;
  private menuEl: HTMLElement;
  private shopEl: HTMLElement;
  private loreEl: HTMLElement;
  private overlayEl: HTMLElement;
  private titleEl: HTMLElement;
  private pauseEl: HTMLElement;
  private elevatorEl: HTMLElement;
  private dayEl: HTMLElement;
  private panelEl: HTMLElement;
  private giftEl: HTMLElement;
  private serviceSel: ItemRef | null = null;
  private buildMsg = '';
  menuTab: MenuTab = 'inv';
  private skillCls: WeaponClass | null = null;
  private skillSel: string | null = null;
  menuOpen = false;
  pauseOpen = false;
  private selInv: number | null = null;
  private selEquip: EquipSlot | null = null;
  private chronicleSel: string | null = null;
  private typed = 0;
  private dialogueKey = '';
  private choiceFocus = 0;
  private hpLagV = 1;
  private hudTimer = 0;
  private overlayBlocking = false;
  private unsub: (() => void)[] = [];

  constructor(root: HTMLElement, private renderer: Renderer, private audio: Audio, private kv: KV, private cb: UiCallbacks) {
    this.hud = h('div', { id: 'hud', class: 'hidden' });
    this.dialogueEl = h('div', { id: 'dialogue', class: 'panel interactive hidden' });
    this.menuEl = h('div', { id: 'menu', class: 'panel interactive hidden' });
    this.shopEl = h('div', { id: 'shop', class: 'panel interactive hidden', style: 'left:20px;right:20px;top:14px;bottom:14px;display:flex;flex-direction:column' });
    this.loreEl = h('div', { id: 'lore', class: 'panel interactive hidden' });
    this.overlayEl = h('div', { class: 'overlay dim hidden' });
    this.titleEl = h('div', { id: 'title', class: 'overlay hidden' });
    this.pauseEl = h('div', { class: 'overlay dim hidden' });
    this.elevatorEl = h('div', { class: 'panel interactive hidden', style: 'left:170px;right:170px;top:40px' });
    this.dayEl = h('div', {});
    this.panelEl = h('div', { class: 'panel interactive hidden', style: 'left:20px;right:20px;top:14px;bottom:14px;display:flex;flex-direction:column' });
    this.giftEl = h('div', { class: 'panel interactive hidden', style: 'left:110px;right:110px;top:40px' });
    root.append(this.hud, this.dialogueEl, this.menuEl, this.shopEl, this.panelEl, this.loreEl, this.elevatorEl, this.giftEl, this.dayEl, this.overlayEl, this.pauseEl, this.titleEl);
    this.buildHud();
  }

  // ───────────────────────── Подключение игры ─────────────────────────

  attach(game: Game): void {
    for (const u of this.unsub) u();
    this.unsub = [];
    this.game = game;
    this.menuOpen = this.pauseOpen = false;
    show(this.titleEl, false);
    show(this.hud, true);
    const ev = game.events;
    this.unsub.push(
      ev.on('toast', (e) => this.toast(e.text, e.color)),
      ev.on('dialogue', () => this.renderDialogue()),
      ev.on('shop', () => this.renderShop()),
      ev.on('inventory', () => {
        this.renderQuick();
        if (this.menuOpen) this.renderMenu();
        if (game.mode === 'shop') this.renderShop();
      }),
      ev.on('lore', () => this.renderLore()),
      ev.on('elevator', () => this.renderElevator()),
      ev.on('death', (d) => this.showDeath(d.gold, d.items, d.exhausted)),
      ev.on('dayStart', (d) => this.dayText(d.text)),
      ev.on('boss', () => this.renderBoss()),
      ev.on('panel', () => this.renderPanel()),
      ev.on('ending', (e) => (e ? this.showEnding(e.id) : undefined)),
      ev.on('tierEnter', (e) => this.dayText(`${tr('tierTitle', { n: ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][e.tier - 1] ?? e.tier })} · ${t(tierForFloor(e.tier * 10 - 9).name)}`)),
      ev.on('scene', () => {
        this.renderQuick();
        this.renderFloorLabel();
      }),
      ev.on('fx', (fx) => {
        if (fx.t === 'sfx') this.audio.play(fx.id, fx.vol);
        else if (fx.t === 'shake') {
          if (game.state.settings.shake) this.renderer.cam.shake(fx.power, fx.dur);
        } else if (fx.t === 'flash') this.renderer.flash(fx.color, fx.dur);
        else this.renderer.particles.spawn(fx);
      }),
    );
    this.renderQuick();
    this.renderFloorLabel();
    for (const el of [this.dialogueEl, this.menuEl, this.shopEl, this.loreEl, this.overlayEl, this.pauseEl, this.elevatorEl, this.panelEl, this.giftEl]) show(el, false);
  }

  detach(): void {
    for (const u of this.unsub) u();
    this.unsub = [];
    this.game = null;
    show(this.hud, false);
    for (const el of [this.dialogueEl, this.menuEl, this.shopEl, this.loreEl, this.overlayEl, this.pauseEl, this.elevatorEl, this.panelEl, this.giftEl]) show(el, false);
  }

  /** Пауза игры из-за открытого интерфейса. */
  get blocking(): boolean {
    return this.menuOpen || this.pauseOpen || this.overlayBlocking || !this.titleEl.classList.contains('hidden');
  }

  // ───────────────────────── HUD ─────────────────────────

  private buildHud(): void {
    const bar = (cls: string) => {
      const i = h('i');
      const el = h('div', { class: `bar ${cls}` }, i);
      return [el, i] as const;
    };
    const [hp, hpI] = bar('hp');
    this.hpLag = h('b');
    hp.prepend(this.hpLag);
    this.hpText = h('span');
    hp.append(this.hpText);
    const [st, stI] = bar('st');
    const [mp, mpI] = bar('mp');
    const [en, enI] = bar('en');
    this.hpBar = hpI;
    this.stBar = stI;
    this.mpBar = mpI;
    this.enBar = enI;
    this.heroLine = h('div', { class: 'hero-line' });
    this.clock = h('div', { class: 'clock panel' });
    this.floorLabel = h('div', { class: 'floor-label panel hidden' });
    this.quickbar = h('div', { class: 'quickbar' });
    this.toasts = h('div', { class: 'toasts' });
    this.prompt = h('div', { class: 'prompt hidden' });
    this.bossbar = h('div', { class: 'bossbar hidden' });
    const enRow = h('div', { class: 'row', style: 'justify-content:flex-start;gap:3px;font-size:6px;color:var(--ink-dim)' }, en, h('span', null, ''));
    this.hud.append(h('div', { class: 'bars' }, this.heroLine, hp, st, mp, enRow), this.clock, this.floorLabel, this.bossbar, this.quickbar, this.toasts, this.prompt);
  }

  private renderQuick(): void {
    const g = this.game;
    if (!g) return;
    clear(this.quickbar);
    const s = g.state;
    const w = s.equipment.weapon;
    const weapon = h('div', { class: `qslot big ${w ? '' : 'empty'}`, title: 'R' }, w ? h('img', { src: this.renderer.bank.iconUrl(w.def) }) : null, h('span', { class: 'k' }, 'R'));
    const cls = w ? itemDef(w.def).weapon!.cls : null;
    const skill = h('div', { class: 'qslot big', id: 'skillslot' }, h('span', { class: 'k' }, 'Q'), h('div', { class: 'cd', style: 'transform:scaleY(0)' }));
    if (cls) skill.append(h('span', { style: 'position:absolute;left:0;right:0;top:8px;text-align:center;font-size:6px;color:var(--gold)' }, t(g.player?.profile.skill.name ?? L('', '')).slice(0, 6)));
    this.quickbar.append(weapon, skill);
    s.quick.forEach((def, i) => {
      const n = def ? s.inventory.reduce((a, x) => a + (x && x.def === def ? x.qty : 0), 0) : 0;
      this.quickbar.append(
        h('div', { class: `qslot ${n ? '' : 'empty'}`, title: def ? t(itemDef(def).name) : '' },
          def ? h('img', { src: this.renderer.bank.iconUrl(def) }) : null,
          h('span', { class: 'k' }, i + 1),
          def ? h('span', { class: 'n' }, n) : null),
      );
    });
  }

  private renderFloorLabel(): void {
    const g = this.game;
    if (!g) return;
    const sc = g.scene;
    if (sc.kind === 'dungeon') {
      this.floorLabel.textContent = `${t(tierForFloor(sc.floor).name)} · ${tr('floor', { n: sc.floor })}`;
      show(this.floorLabel, true);
    } else show(this.floorLabel, false);
  }

  private renderBoss(): void {
    const b = this.game?.boss;
    if (!b) return show(this.bossbar, false);
    clear(this.bossbar);
    const name = (b as unknown as { def: { name: Loc } }).def.name;
    this.bossbar.append(h('div', null, t(name)), h('div', { class: 'bar' }, h('i', { id: 'bossfill' })));
    show(this.bossbar, true);
  }

  toast(text: string, color?: string): void {
    const el = h('div', { class: 'toast', style: color ? `color:${color}` : undefined }, text);
    this.toasts.append(el);
    while (this.toasts.children.length > 6) this.toasts.firstChild!.remove();
    setTimeout(() => el.remove(), 3200);
  }

  private dayText(text: string): void {
    clear(this.dayEl);
    this.dayEl.append(h('div', { class: 'daytext' }, text));
  }

  /** Обновление каждый кадр. */
  update(dt: number): void {
    const g = this.game;
    if (!g) return;
    const p = g.player;
    const s = g.state;
    if (p) {
      const hpK = Math.max(0, p.hp / p.maxHp);
      this.hpBar.style.transform = `scaleX(${hpK})`;
      this.hpLagV = hpK > this.hpLagV ? hpK : Math.max(hpK, this.hpLagV - dt * 0.5);
      this.hpLag.style.transform = `scaleX(${this.hpLagV})`;
      this.stBar.style.transform = `scaleX(${Math.max(0, p.stamina / p.maxStamina)})`;
      this.mpBar.style.transform = `scaleX(${Math.max(0, p.mana / p.maxMana)})`;
      this.enBar.style.transform = `scaleX(${Math.max(0, s.hero.energy / s.hero.maxEnergy)})`;
      const cd = document.querySelector('#skillslot .cd') as HTMLElement | null;
      if (cd) cd.style.transform = `scaleY(${p.weaponCls ? Math.min(1, p.skillCd / p.profile.skill.cd) : 1})`;
    }
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.1;
      const tm = s.time;
      this.hpText.textContent = p ? `${Math.ceil(p.hp)}/${p.maxHp}` : '';
      this.heroLine.textContent = `${s.hero.name} · ${tr('level', { n: s.hero.level })}`;
      clear(this.clock);
      this.clock.append(
        h('div', null, `${seasonName(tm.season)}, ${tm.day} · ${weekday(tm.day)}`),
        h('div', { class: 'time' }, `${formatTime(tm.minutes)} `, h('span', { style: 'font-family:inherit' }, tm.minutes >= 20 * 60 && (tm.weather === 'sunny' || tm.weather === 'cloudy') ? '☾' : WEATHER_ICONS[tm.weather])),
        h('div', { class: 'gold' }, `◆ ${s.hero.gold}`),
      );
    }
    const bf = document.getElementById('bossfill');
    if (bf && g.boss) bf.style.transform = `scaleX(${Math.max(0, g.boss.hp / g.boss.maxHp)})`;
    // подсказка взаимодействия
    const it = g.mode === 'play' && !g.transition && !this.blocking ? g.world.findInteractable() : null;
    if (it?.interaction) {
      const [sx, sy] = this.renderer.worldToScreen(it.x, it.y - Math.max(16, it.hh * 2 + 10));
      this.prompt.style.left = `${Math.round(sx)}px`;
      this.prompt.style.top = `${Math.round(sy)}px`;
      clear(this.prompt);
      this.prompt.append(h('kbd', null, 'E'), ` ${it.interaction.label()}`);
      show(this.prompt, true);
    } else show(this.prompt, false);
    // печатная машинка
    if (g.dialogue && !this.dialogueEl.classList.contains('hidden')) {
      const full = g.dialogue.text;
      if (this.typed < full.length) {
        this.typed = Math.min(full.length, this.typed + dt * 70);
        const txt = this.dialogueEl.querySelector('.txt');
        if (txt) txt.textContent = full.slice(0, Math.floor(this.typed));
        if (this.typed >= full.length) this.renderDialogue();
      }
    }
  }

  // ───────────────────────── Диалог ─────────────────────────

  private renderDialogue(): void {
    const g = this.game!;
    const d = g.dialogue;
    if (!d) {
      show(this.dialogueEl, false);
      return;
    }
    const key = `${d.line.id}:${d.page}`;
    if (key !== this.dialogueKey) {
      this.dialogueKey = key;
      this.typed = 0;
      this.choiceFocus = 0;
    }
    clear(this.dialogueEl);
    const full = d.text;
    const done = this.typed >= full.length;
    this.dialogueEl.append(h('div', { class: 'name' }, d.speaker), h('div', { class: 'txt' }, full.slice(0, Math.floor(this.typed))));
    const choices = done ? d.choices : [];
    if (choices.length) {
      const list = h('div', { class: 'choices' });
      choices.forEach((c, i) =>
        list.append(h('button', { class: i === this.choiceFocus ? 'focus' : '', onclick: () => this.choose(i) }, `${i + 1}. ${t(c.text)}`)),
      );
      this.dialogueEl.append(list);
    } else if (done) this.dialogueEl.append(h('div', { class: 'more' }, '▼'));
    const extra = h('div', { style: 'position:absolute;right:16px;top:-9px;display:flex;gap:2px' });
    if (done && d.line.id !== 'gift' && d.line.id !== 'say' && !d.line.id.startsWith('thanks') && !NPCS[d.npc]?.speakerOnly) {
      if (g.canGift(d.npc)) extra.append(h('button', { style: 'font-size:7px', onclick: () => this.openGiftPicker() }, `🎁 ${tr('gift')}`));
      if (g.canInvite(d.npc)) extra.append(h('button', { style: 'font-size:7px', onclick: () => { g.inviteCompanion(d.npc); this.renderDialogue(); } }, `⚔ ${tr('invite')}`));
    }
    if (extra.childElementCount) this.dialogueEl.append(extra);
    this.dialogueEl.onclick = (e) => {
      if ((e.target as HTMLElement).tagName !== 'BUTTON') this.advanceDialogue();
    };
    show(this.dialogueEl, true);
  }

  private advanceDialogue(): void {
    const g = this.game!;
    const d = g.dialogue;
    if (!d) return;
    if (this.typed < d.text.length) {
      this.typed = d.text.length;
      this.renderDialogue();
      return;
    }
    if (d.choices.length) return;
    this.audio.play('talk');
    g.dialogueAdvance();
  }

  private choose(i: number): void {
    this.audio.play('ui');
    this.game!.dialogueChoose(i);
  }

  // ───────────────────────── Меню (инвентарь и др.) ─────────────────────────

  toggleMenu(tab?: MenuTab): void {
    const g = this.game;
    if (!g) return;
    if (this.menuOpen && (!tab || tab === this.menuTab)) {
      this.menuOpen = false;
      g.paused = this.pauseOpen;
      show(this.menuEl, false);
      this.audio.play('uiback');
      return;
    }
    if (g.mode !== 'play') return;
    this.menuOpen = true;
    if (tab) this.menuTab = tab;
    g.paused = true;
    this.selInv = null;
    this.selEquip = null;
    this.audio.play('ui');
    this.renderMenu();
    show(this.menuEl, true);
  }

  private renderMenu(): void {
    const g = this.game!;
    clear(this.menuEl);
    const tabs: [MenuTab, Loc][] = [
      ['inv', S.inventory], ['skills', L('Навыки', 'Skills')], ['quests', S.quests], ['relations', S.relations],
      ['chronicle', L('Летопись', 'Chronicle')], ['settings', S.settings],
    ];
    const bar = h('div', { class: 'tabs' });
    for (const [id, name] of tabs)
      bar.append(h('button', { class: this.menuTab === id ? 'on' : '', onclick: () => ((this.menuTab = id), this.renderMenu()) }, t(name)));
    bar.append(h('span', { style: 'flex:1' }), h('button', { onclick: () => this.toggleMenu() }, '✕'));
    const body = h('div', { class: 'tab-body' });
    this.menuEl.append(bar, body);
    if (this.menuTab === 'inv') this.renderInventory(body, g);
    else if (this.menuTab === 'skills') this.renderSkills(body, g);
    else if (this.menuTab === 'quests') this.renderQuests(body, g);
    else if (this.menuTab === 'relations') this.renderRelations(body, g);
    else if (this.menuTab === 'chronicle') this.renderChronicle(body, g);
    else this.renderSettings(body, g);
  }

  private slotEl(stack: ItemStack | null, opts: { sel?: boolean; label?: string; quick?: boolean; onclick?: () => void; ondbl?: () => void; drag?: number; drop?: (from: number) => void; hover?: () => void }): HTMLElement {
    const el = h('div', {
      class: `slot ${stack ? `r${stack.rarity}` : ''} ${opts.sel ? 'sel' : ''} ${opts.quick ? 'quick' : ''}`,
      onclick: opts.onclick, ondblclick: opts.ondbl, onmouseenter: opts.hover,
      draggable: opts.drag !== undefined && !!stack ? 'true' : undefined,
    });
    if (stack) {
      el.append(h('img', { src: this.renderer.bank.iconUrl(stack.def), draggable: 'false' }));
      if (stack.qty > 1) el.append(h('span', { class: 'n' }, stack.qty));
    } else if (opts.label) el.append(h('span', { class: 'lbl' }, opts.label));
    if (opts.drag !== undefined) el.addEventListener('dragstart', (e) => e.dataTransfer?.setData('text/plain', String(opts.drag)));
    if (opts.drop) {
      el.addEventListener('dragover', (e) => e.preventDefault());
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        const from = Number(e.dataTransfer?.getData('text/plain'));
        if (!Number.isNaN(from)) opts.drop!(from);
      });
    }
    return el;
  }

  private renderInventory(body: HTMLElement, g: Game): void {
    const s = g.state;
    const eq = h('div', { class: 'equip' });
    for (const slot of EQUIP_SLOTS) {
      eq.append(this.slotEl(s.equipment[slot], {
        sel: this.selEquip === slot, label: t(SLOT_LABEL[slot]),
        onclick: () => ((this.selEquip = slot), (this.selInv = null), this.renderMenu()),
        ondbl: () => g.unequip(slot),
      }));
    }
    const st = g.stats();
    const stats = h('div', { class: 'stats' });
    const row = (k: StrKey, v: string) => stats.append(h('span', null, tr(k)), h('b', null, v));
    const p = g.player;
    row('st_maxHp', `${Math.ceil(p.hp)}/${Math.round(st.maxHp)}`);
    row('st_atk', `${Math.round(st.atk * (1 + st.dmgPct / 100))}`);
    row('st_def', `${Math.round(st.def)}`);
    row('st_crit', `${Math.round(st.crit * 100)}%`);
    row('st_speed', `${Math.round(st.speed * 100)}%`);
    if (st.luck) row('st_luck', `${Math.round(st.luck)}`);
    if (st.lifesteal) row('st_lifesteal', `${Math.round(st.lifesteal * 100)}%`);
    if (st.regen) row('st_regen', `${st.regen.toFixed(1)}/с`);
    for (const k of ['fire', 'ice', 'shock', 'holy'] as const) if (st[k]) row(`st_${k}`, `+${Math.round(st[k])}`);
    const xpNeed = xpToNext(s.hero.level);
    const left = h('div', { class: 'col', style: 'width:118px' },
      h('div', { class: 'gold-text', style: 'font-size:8px' }, `${s.hero.name} · ${tr('level', { n: s.hero.level })}`),
      h('div', { class: 'bar', style: 'height:3px' }, h('i', { style: `background:var(--gold);transform:scaleX(${s.hero.xp / xpNeed})` })),
      h('div', { style: 'display:flex;gap:6px' }, eq, stats),
      h('div', { class: 'gold-text' }, `◆ ${s.hero.gold}`),
    );
    const grid = h('div', { class: 'grid' });
    s.inventory.forEach((stack, i) => {
      grid.append(this.slotEl(stack, {
        sel: this.selInv === i, quick: !!stack && s.quick.includes(stack.def),
        onclick: () => ((this.selInv = i), (this.selEquip = null), this.renderMenu()),
        ondbl: () => g.useItem(i), drag: i, drop: (from) => g.moveItem(from, i),
      }));
    });
    const detail = h('div', { class: 'detail' });
    const selStack = this.selInv !== null ? s.inventory[this.selInv] : this.selEquip ? s.equipment[this.selEquip] : null;
    if (selStack) this.fillDetail(detail, selStack, g);
    else detail.append(h('div', { class: 'sub' }, getLang() === 'ru' ? 'Выберите предмет. Двойной щелчок — использовать/надеть, перетаскивание — переложить.' : 'Select an item. Double-click to use/equip, drag to move.'));
    const right = h('div', { class: 'col', style: 'flex:1' },
      h('div', { class: 'row', style: 'justify-content:space-between' }, h('h2', { style: 'margin:0' }, tr('inventory')), h('button', { onclick: () => g.sortInventory() }, getLang() === 'ru' ? 'Сортировать' : 'Sort')),
      grid, detail);
    body.append(left, right);
  }

  private fillDetail(el: HTMLElement, s: ItemStack, g: Game, price?: number, noActions = false): void {
    const d = itemDef(s.def);
    el.append(h('div', { class: `t r${s.rarity}` }, itemName(s)));
    const sub = [t(KIND_NAMES[d.kind]!)];
    if (s.rarity > 0 || d.kind === 'weapon' || d.kind === 'armor') sub.unshift(t(RARITY_NAMES[s.rarity]!));
    if (d.weapon) sub.push(t(CLASS_NAMES[d.weapon.cls]));
    el.append(h('div', { class: 'sub' }, sub.join(' · ')));
    if (d.weapon) el.append(h('div', null, `${tr('st_atk')}: ${Math.round(d.weapon.atk * (1 + 0.08 * s.upgrade) * 10) / 10}`));
    if (d.armor) el.append(h('div', null, `${tr('st_def')}: ${Math.round(d.armor.def * (1 + 0.08 * s.upgrade))} · ${tr('st_maxHp')}: +${Math.round(d.armor.hp * (1 + 0.08 * s.upgrade))}`));
    for (const a of s.affixes) {
      const ad = AFFIX_BY_ID[a.id];
      if (ad) el.append(h('div', { class: 'aff' }, `${formatAffix(a)} ${tr(`st_${ad.stat}` as StrKey)}`));
    }
    if (d.desc) el.append(h('div', { class: 'sub' }, t(d.desc)));
    if (price !== undefined) el.append(h('div', { class: 'gold-text' }, `${tr('price')}: ◆ ${price}`));
    if (price !== undefined || noActions) return;
    const acts = h('div', { class: 'actions' });
    if (this.selEquip) acts.append(h('button', { onclick: () => g.unequip(this.selEquip!) }, tr('unequip')));
    else if (this.selInv !== null) {
      const i = this.selInv;
      if (d.kind === 'weapon' || d.kind === 'armor' || d.kind === 'accessory') acts.append(h('button', { onclick: () => g.equip(i) }, tr('equip')));
      if (d.use) {
        acts.append(h('button', { onclick: () => g.useItem(i) }, tr('use')));
        for (let q = 0; q < 4; q++) acts.append(h('button', { onclick: () => g.setQuick(q, d.id), title: tr('toQuick') }, `→${q + 1}`));
      }
      if (d.kind !== 'quest') acts.append(h('button', { onclick: () => ((this.selInv = null), g.dropItem(i)) }, tr('drop')));
    }
    el.append(acts);
  }

  private renderSkills(body: HTMLElement, g: Game): void {
    const s = g.state;
    if (!this.skillCls) this.skillCls = weaponClassOf(s) ?? 'sword';
    const cls = this.skillCls;
    const left = h('div', { class: 'col', style: 'width:132px;flex:none' }, h('h2', null, t(L('Мастерство', 'Mastery'))));
    for (const c of WEAPON_CLASSES) {
      const xp = s.hero.classXp[c];
      const lvl = classLevel(xp);
      let rest = xp;
      for (let l = 1; l < lvl; l++) rest -= classXpToNext(l);
      const need = classXpToNext(lvl);
      const pts = talentPoints(s, c);
      left.append(h('div', { class: `mastery interactive ${c === cls ? 'on' : ''}`, onclick: () => ((this.skillCls = c), (this.skillSel = null), this.renderMenu()) },
        h('div', { class: 'row' },
          h('span', null, t(CLASS_NAMES[c])),
          h('span', { class: 'gold-text num' }, String(lvl)),
          pts.free > 0 ? h('span', { class: 'pts num' }, `+${pts.free}`) : h('span', { class: 'sub' }, '')),
        h('div', { class: 'bar', style: 'height:3px' }, h('i', { style: `background:var(--gold);transform:scaleX(${Math.min(1, rest / need)})` }))));
    }
    left.append(h('p', { class: 'help' }, t(L(
      'Каждое попадание учит владению оружием. Уровень класса даёт +2% урона и очко таланта. Таланты работают, только пока это оружие в руках.',
      'Every hit teaches you the weapon. Each class level grants +2% damage and a talent point. Talents only work while that weapon is in hand.',
    ))));

    const pts = talentPoints(s, cls);
    const right = h('div', { class: 'col', style: 'flex:1;min-width:0' },
      h('div', { class: 'row' },
        h('h2', null, `${t(CLASS_NAMES[cls])} · ${t(WEAPON_PROFILES[cls].skill.name)}`),
        h('span', { class: 'sub' }, `${t(L('Очки', 'Points'))}: `, h('b', { class: 'gold-text num' }, `${pts.free}/${pts.total}`))));
    const tiers = h('div', { class: 'tal-tree' });
    for (const tier of [1, 2, 3] as const) {
      const row = h('div', { class: 'tal-row' }, h('span', { class: 'tal-tier' }, ['I', 'II', 'III'][tier - 1]!));
      for (const d of talentsOf(cls).filter((x) => x.tier === tier)) {
        const why = talentBlock(s, d.id);
        const st = why === 'owned' ? 'owned' : why === null ? 'ready' : why === 'points' ? 'poor' : 'locked';
        row.append(h('button', {
          class: `tal ${st} ${this.skillSel === d.id ? 'sel' : ''}`,
          onclick: () => ((this.skillSel = d.id), this.renderMenu()),
          ondblclick: () => { if (g.learnTalent(d.id)) this.renderMenu(); },
        }, t(d.name)));
      }
      tiers.append(row);
    }
    right.append(tiers);
    const sel = this.skillSel ? TALENT_BY_ID[this.skillSel] : null;
    const detail = h('div', { class: 'detail', style: 'min-height:44px' });
    if (sel && sel.cls === cls) {
      const why = talentBlock(s, sel.id);
      const reason: Record<string, Loc> = {
        owned: L('Изучено', 'Learned'),
        points: L('Не хватает очков', 'Not enough points'),
        prereq: L('Нужен талант предыдущей ступени', 'Requires a talent from the previous tier'),
      };
      detail.append(
        h('div', { class: 't' }, t(sel.name)),
        h('div', null, t(sel.desc)),
        h('div', { class: 'sub' }, `${t(L('Стоимость', 'Cost'))}: ${sel.tier}`));
      const act = h('div', { class: 'actions' });
      if (why === null) act.append(h('button', { onclick: () => { if (g.learnTalent(sel.id)) this.renderMenu(); } }, t(L('Изучить', 'Learn'))));
      else act.append(h('span', { class: why === 'owned' ? 'gold-text' : 'sub' }, t(reason[why] ?? L('—', '—'))));
      detail.append(act);
    } else {
      detail.append(h('div', { class: 't' }, t(WEAPON_PROFILES[cls].skill.name), h('span', { class: 'sub' }, ' · Q')), h('div', null, t(WEAPON_PROFILES[cls].skill.desc)));
    }
    right.append(detail);
    const cost = g.talentResetCost(cls);
    if (cost > 0)
      right.append(h('div', { class: 'row', style: 'justify-content:flex-end' },
        h('button', { disabled: s.hero.gold < cost ? true : undefined, onclick: () => { if (g.resetTalents(cls)) ((this.skillSel = null), this.renderMenu()); } },
          `${t(L('Забыть таланты', 'Reset talents'))} · ${tr('gold', { n: cost })}`)));
    body.append(left, right);
  }

  private renderQuests(body: HTMLElement, g: Game): void {
    const s = g.state;
    const col = h('div', { class: 'col', style: 'width:100%;overflow-y:auto' });
    const active = QUESTS.filter((q) => s.quests[q.id]?.status === 'active');
    const done = QUESTS.filter((q) => s.quests[q.id]?.status === 'done');
    col.append(h('h2', null, tr('active')));
    if (!active.length) col.append(h('div', { class: 'help' }, t(L('Нет активных заданий. Поговорите с жителями.', 'No active quests. Talk to the townsfolk.'))));
    for (const q of active) {
      const [a, b] = g.questProgress(q.id);
      const giver = NPCS[q.giver];
      col.append(h('div', { class: 'detail', style: 'min-height:0' },
        h('div', { class: 't', style: q.main ? 'color:var(--gold)' : '' }, `${q.main ? '★ ' : ''}${t(q.title)}`),
        h('div', null, t(q.desc)),
        h('div', { class: 'sub' }, `${giver ? t(giver.name) : ''}${b > 1 ? ` · ${a}/${b}` : ''}`)));
    }
    if (done.length) {
      col.append(h('h2', { style: 'margin-top:6px' }, tr('completed')));
      for (const q of done) col.append(h('div', { class: 'sub', style: 'color:var(--ink-dim);font-size:7px' }, `✓ ${t(q.title)}`));
    }
    body.append(col);
  }

  private renderRelations(body: HTMLElement, g: Game): void {
    const s = g.state;
    const col = h('div', { class: 'col', style: 'width:100%;overflow-y:auto' });
    col.append(h('h2', null, tr('factions')));
    for (const f of FACTIONS) {
      const v = s.factions[f.id];
      col.append(h('div', { class: 'row', style: 'justify-content:flex-start;gap:6px;font-size:7px' },
        h('span', { style: 'width:150px' }, t(f.name)),
        h('div', { class: 'bar', style: 'width:80px;height:4px' }, h('i', { style: `background:${v >= 0 ? 'var(--st)' : 'var(--hp)'};transform:scaleX(${Math.abs(v) / 100})` })),
        h('span', { class: 'num', style: 'width:26px' }, `${Math.round(v)}`),
        h('span', { style: 'width:60px;color:var(--gold)' }, repTier(v)),
        h('span', { style: 'color:var(--ink-dim);font-size:6px' }, t(f.perk))));
    }
    col.append(h('h2', { style: 'margin-top:4px' }, tr('relations')));
    const met = Object.keys(NPCS).filter((id) => !NPCS[id]!.speakerOnly && (s.flags[`dlg:${id}_meet`] || s.npcs[id]));
    if (!met.length) col.append(h('div', { class: 'help' }, t(L('Вы ещё ни с кем не знакомы.', "You haven't met anyone yet."))));
    for (const id of met) {
      const n = NPCS[id]!;
      const hs = hearts(s, id);
      const max = n.romance ? 10 : 10;
      const known = Object.entries(s.giftLog[id] ?? {}).filter(([, r]) => r === 'love' || r === 'like').map(([it]) => t(itemDef(it).name));
      col.append(h('div', { class: 'row', style: 'justify-content:flex-start;gap:6px;font-size:7px' },
        h('span', { style: 'width:120px;color:var(--ink)' }, t(n.name)),
        h('span', { style: 'width:70px;color:var(--ink-dim)' }, t(n.role)),
        h('span', { style: 'color:#ff8aa0;letter-spacing:0' }, '♥'.repeat(Math.min(hs, max)) + '♡'.repeat(Math.max(0, max - hs))),
        h('span', { style: 'color:var(--ink-dim);font-size:6px' }, `${t(SEASONS[n.birthday[0]]!)} ${n.birthday[1]}`),
        known.length ? h('span', { style: 'color:var(--st);font-size:6px' }, `${t(REACTION_LABEL.like)}: ${known.slice(0, 3).join(', ')}`) : null));
    }
    body.append(col);
  }

  private renderChronicle(body: HTMLElement, g: Game): void {
    const s = g.state;
    const list = h('div', { class: 'list' });
    const text = h('div', { class: 'text' });
    if (!s.lore.length) text.append(t(L('Летопись пуста. Записки, фрески и дневники из подземелья появятся здесь.', 'The Chronicle is empty. Notes, frescoes and diaries from below will appear here.')));
    for (const id of s.lore) {
      const lo = LORE_BY_ID[id];
      if (!lo) continue;
      list.append(h('button', { class: this.chronicleSel === id ? 'focus' : '', onclick: () => ((this.chronicleSel = id), this.renderMenu()) }, `${lo.floor}. ${t(lo.title)}`));
    }
    const sel = this.chronicleSel && LORE_BY_ID[this.chronicleSel];
    if (sel) text.append(h('b', null, t(sel.title)), '\n\n', t(sel.text));
    body.append(h('div', { class: 'chronicle' }, list, text));
  }

  private renderSettings(body: HTMLElement, g: Game | null): void {
    const st = g ? g.state.settings : this.globalSettings();
    const box = h('div', { class: 'settings' });
    box.append(
      h('div', { class: 'row' }, h('label', null, tr('language')),
        h('button', { class: getLang() === 'ru' ? 'focus' : '', onclick: () => this.setLanguage('ru') }, 'Русский'),
        h('button', { class: getLang() === 'en' ? 'focus' : '', onclick: () => this.setLanguage('en') }, 'English')),
      h('div', { class: 'row' }, h('label', null, tr('volume')),
        h('input', { type: 'range', min: 0, max: 100, value: Math.round(st.volume * 100), oninput: (e: Event) => {
          st.volume = Number((e.target as HTMLInputElement).value) / 100;
          this.audio.setVolume(st.volume);
          this.cb.settingsChanged();
        } })),
      h('div', { class: 'row' }, h('label', null, tr('shake')),
        h('button', { onclick: () => ((st.shake = !st.shake), this.cb.settingsChanged(), g ? this.renderMenu() : this.renderTitle()) }, st.shake ? tr('on') : tr('off'))),
      h('h2', { style: 'margin-top:6px' }, tr('controls')),
      h('div', { class: 'help' }, tr('controlsText')),
      h('div', { class: 'help' }, t(L('Геймпад: X — атака, B — перекат, LT — блок, Y — навык, A — действие, RB — смена оружия, крестовина — быстрые слоты.', 'Gamepad: X — attack, B — roll, LT — block, Y — skill, A — interact, RB — swap weapon, D-pad — quick slots.'))),
    );
    body.append(box);
  }

  private globalSettings() {
    return this.titleSettings;
  }
  titleSettings = { lang: 'ru' as 'ru' | 'en', volume: 0.6, shake: true };

  private setLanguage(l: 'ru' | 'en'): void {
    setLang(l);
    if (this.game) this.game.state.settings.lang = l;
    this.titleSettings.lang = l;
    this.cb.settingsChanged();
    if (this.game) {
      this.renderMenu();
      this.renderQuick();
      this.renderFloorLabel();
    } else this.renderTitle();
  }

  // ───────────────────────── Магазин ─────────────────────────

  private renderShop(): void {
    const g = this.game!;
    if (g.mode !== 'shop' || !g.shopId) {
      show(this.shopEl, false);
      return;
    }
    const shop = SHOPS[g.shopId]!;
    clear(this.shopEl);
    const s = g.state;
    const detail = h('div', { class: 'detail', style: 'min-height:48px' });
    const stock = h('div', { class: 'shop-list' });
    if (shop.rotating) {
      stock.append(h('div', { class: 'sub', style: 'color:var(--gold)' }, tr('rareGoods')));
      s.economy.rotating.forEach((st, i) => {
        const price = rotatingPrice(s, st, shop);
        stock.append(h('div', {
          class: `shop-row ${s.hero.gold < price ? 'poor' : ''}`, onclick: () => g.buyRotating(i),
          onmouseenter: () => { clear(detail); this.fillDetail(detail, st, g, price); },
        }, h('img', { src: this.renderer.bank.iconUrl(st.def) }), h('span', { class: `nm r${st.rarity}` }, itemName(st)), h('span', { class: 'pr' }, `◆ ${price}`)));
      });
    }
    for (const it of g.shopItems()) {
      const d = itemDef(it.def);
      stock.append(h('div', {
        class: `shop-row ${s.hero.gold < it.price ? 'poor' : ''}`,
        onclick: () => g.buy(it.def),
        onmouseenter: () => {
          clear(detail);
          this.fillDetail(detail, { uid: '', def: it.def, qty: 1, rarity: 0, affixes: [], upgrade: 0 }, g, it.price);
        },
      }, h('img', { src: this.renderer.bank.iconUrl(it.def) }), h('span', { class: 'nm' }, t(d.name)), h('span', { class: 'pr' }, `◆ ${it.price}`)));
    }
    const grid = h('div', { class: 'grid' });
    s.inventory.forEach((stack, i) => {
      const q = stack ? g.sellQuote(i) : null;
      const el = this.slotEl(stack, {
        onclick: () => {
          if (q !== null) g.sell(i, 1);
        },
        hover: () => {
          clear(detail);
          if (stack) this.fillDetail(detail, stack, g, q ?? 0);
          if (stack && q === null) detail.append(h('div', { class: 'sub' }, t(L('Здесь это не купят.', "They won't buy this here."))));
        },
      });
      if (stack && q === null) el.style.opacity = '0.4';
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (q !== null && stack) g.sell(i, stack.qty);
      });
      grid.append(el);
    });
    this.shopEl.append(
      h('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:4px' },
        h('h2', { style: 'margin:0' }, t(shop.name)),
        h('span', { class: 'gold-text' }, `◆ ${s.hero.gold}`),
        h('button', { onclick: () => g.closeShop() }, `✕ ${tr('leave')}`)),
      h('div', { style: 'display:flex;gap:8px;flex:1;min-height:0' },
        h('div', { class: 'col' }, h('div', { class: 'sub', style: 'color:var(--ink-dim)' }, tr('buy')), stock),
        h('div', { class: 'col', style: 'flex:1' },
          h('div', { class: 'sub', style: 'color:var(--ink-dim)' }, `${tr('sell')} — ${t(L('щелчок: 1 шт., ПКМ: всё', 'click: 1, right-click: all'))}`),
          grid, detail)),
    );
    show(this.shopEl, true);
  }

  // ───────────────────────── Панели: крафт, сундук, стройка, услуги ─────────────────────────

  private renderPanel(): void {
    const g = this.game!;
    const m = g.mode;
    if (m !== 'craft' && m !== 'storage' && m !== 'build' && m !== 'service') {
      show(this.panelEl, false);
      this.serviceSel = null;
      return;
    }
    clear(this.panelEl);
    const head = (title: string) =>
      h('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:4px' },
        h('h2', { style: 'margin:0' }, title),
        h('span', { class: 'gold-text num' }, `◆ ${g.state.hero.gold} · ${tr('energy')} ${Math.round(g.state.hero.energy)}`),
        h('button', { onclick: () => g.closePanel() }, `✕ ${tr('leave')}`));
    if (m === 'craft') this.renderCraft(g, head);
    else if (m === 'storage') this.renderStorage(g, head);
    else if (m === 'build') this.renderBuild(g, head);
    else this.renderService(g, head);
    show(this.panelEl, true);
  }

  private itemChip(def: string, have: number, need: number): HTMLElement {
    return h('span', { class: 'row', style: `gap:1px;font-size:6px;color:${have >= need ? 'var(--ink)' : '#e07070'}` },
      h('img', { src: this.renderer.bank.iconUrl(def), style: 'width:10px;height:10px;image-rendering:pixelated' }),
      h('span', { class: 'num' }, `${have}/${need}`));
  }

  private renderCraft(g: Game, head: (t: string) => HTMLElement): void {
    const list = h('div', { class: 'shop-list', style: 'width:auto;flex:1' });
    for (const { r, missing } of g.craftList()) {
      const [out, n] = r.output;
      const d = itemDef(out);
      const inputs = h('span', { class: 'row', style: 'gap:4px' });
      for (const [id, need] of r.inputs) inputs.append(this.itemChip(id, countItem(g.state.inventory, id), need));
      list.append(h('div', { class: `shop-row ${missing.length ? 'poor' : ''}` },
        h('img', { src: this.renderer.bank.iconUrl(out) }),
        h('span', { class: 'nm', style: 'flex:0 0 120px' }, `${t(d.name)}${n > 1 ? ` ×${n}` : ''}`),
        inputs,
        h('span', { style: 'flex:1' }),
        h('span', { class: 'sub', style: 'font-size:6px;color:var(--ink-dim)' }, `${r.energy} ${tr('energyShort')} · ${r.minutes} ${tr('minutesShort')}`),
        h('button', { disabled: missing.length > 0, onclick: () => g.craft(r.id) }, tr('create'))));
    }
    this.panelEl.append(head(t(STATION_NAMES[g.craftStation!])), list);
  }

  private renderStorage(g: Game, head: (t: string) => HTMLElement): void {
    const grid = (src: 'inv' | 'store') => {
      const el = h('div', { class: 'grid' });
      const slots = src === 'inv' ? g.state.inventory : g.state.storage;
      slots.forEach((s, i) => el.append(this.slotEl(s, { onclick: () => g.moveStorage(src, i) })));
      return el;
    };
    this.panelEl.append(head(tr('storage')),
      h('div', { style: 'display:flex;gap:10px' },
        h('div', { class: 'col' }, h('div', { class: 'sub', style: 'color:var(--ink-dim)' }, tr('inventoryShort')), grid('inv')),
        h('div', { class: 'col' }, h('div', { class: 'sub', style: 'color:var(--ink-dim)' }, tr('storage')), grid('store'))),
      h('div', { class: 'help' }, t(L('Щелчок перекладывает стопку в другую сторону.', 'Click moves a stack to the other side.'))));
  }

  private renderBuild(g: Game, head: (t: string) => HTMLElement): void {
    const m = g.state.manor;
    const list = h('div', { class: 'col' });
    if (m.building) list.append(h('div', { class: 'gold-text' }, tr('building', { name: t(UPGRADES.find((u) => u.id === m.building!.id)!.name), n: m.building.daysLeft })));
    for (const u of UPGRADES) {
      const built = m.upgrades.includes(u.id);
      const chips = h('span', { class: 'row', style: 'gap:4px' });
      for (const [id, need] of u.items) chips.append(this.itemChip(id, countItem(g.state.inventory, id), need));
      list.append(h('div', { class: 'detail', style: 'min-height:0;display:flex;gap:6px;align-items:center' },
        h('div', { style: 'flex:1' },
          h('div', { class: 't' }, `${built ? '✓ ' : ''}${t(u.name)}`),
          h('div', { class: 'sub' }, t(u.desc))),
        h('span', { class: 'gold-text num' }, `◆ ${u.cost}`), chips,
        h('button', { disabled: built || !!m.building, onclick: () => { this.buildMsg = g.orderUpgrade(u.id) ?? ''; this.renderPanel(); } }, built ? '✓' : tr('order'))));
    }
    if (this.buildMsg) list.append(h('div', { style: 'color:#e07070' }, this.buildMsg));
    this.panelEl.append(head(tr('build')), list);
  }

  private renderService(g: Game, head: (t: string) => HTMLElement): void {
    const kind = g.service!;
    const grid = h('div', { class: 'grid' });
    const refs: [ItemRef, ItemStack | null][] = [];
    for (const slot of EQUIP_SLOTS) refs.push([{ equip: slot }, g.state.equipment[slot]]);
    g.state.inventory.forEach((s, i) => refs.push([{ inv: i }, s]));
    const same = (a: ItemRef | null, b: ItemRef) => !!a && JSON.stringify(a) === JSON.stringify(b);
    for (const [ref, s] of refs) {
      if (!s) continue;
      const cost = g.serviceCost(ref);
      const el = this.slotEl(s, { sel: same(this.serviceSel, ref), onclick: () => ((this.serviceSel = ref), this.renderPanel()) });
      if (!cost) el.style.opacity = '0.35';
      grid.append(el);
    }
    const detail = h('div', { class: 'detail' });
    const sel = this.serviceSel ? g.refStack(this.serviceSel) : null;
    if (sel && this.serviceSel) {
      this.fillDetail(detail, sel, g, undefined, true);
      const cost = g.serviceCost(this.serviceSel);
      if (cost) {
        const row = h('div', { class: 'row', style: 'justify-content:flex-start;gap:6px;margin-top:3px' }, h('span', { class: 'gold-text num' }, `◆ ${cost.gold}`));
        if (cost.bar) row.append(this.itemChip(cost.bar, countItem(g.state.inventory, cost.bar), cost.bars ?? 0));
        if (cost.chance !== undefined) row.append(h('span', null, `${tr('chance')}: ${Math.round(cost.chance * 100)}%`));
        row.append(h('button', { onclick: () => g.applyService(this.serviceSel!) }, tr(kind)));
        detail.append(row);
      } else detail.append(h('div', { class: 'sub' }, t(L('С этой вещью это сделать нельзя.', "This can't be done to this item."))));
    } else detail.append(h('div', { class: 'sub' }, t(L('Выберите вещь.', 'Choose an item.'))));
    this.panelEl.append(head(tr(kind)), h('div', { style: 'display:flex;flex-direction:column;gap:4px' }, grid, detail));
  }

  // ───────────────────────── Подарки ─────────────────────────

  private openGiftPicker(): void {
    const g = this.game!;
    const npc = g.dialogue?.npc;
    if (!npc) return;
    clear(this.giftEl);
    const grid = h('div', { class: 'grid' });
    g.state.inventory.forEach((s, i) => {
      if (!s || itemDef(s.def).kind === 'quest') return;
      grid.append(this.slotEl(s, { onclick: () => { show(this.giftEl, false); g.giveGift(npc, i); } }));
    });
    this.giftEl.append(h('h2', null, `${tr('gift')}: ${t(NPCS[npc]!.name)}`), grid, h('button', { style: 'margin-top:4px', onclick: () => show(this.giftEl, false) }, tr('back')));
    show(this.giftEl, true);
  }

  // ───────────────────────── Лор, лифт, смерть ─────────────────────────

  private renderLore(): void {
    const g = this.game!;
    const id = g.loreOpen;
    if (!id) return show(this.loreEl, false);
    const lo = LORE_BY_ID[id]!;
    clear(this.loreEl);
    this.loreEl.append(h('h2', null, t(lo.title)), t(lo.text), h('button', { onclick: () => g.closeLore() }, tr('back')));
    show(this.loreEl, true);
  }

  private renderElevator(): void {
    const g = this.game!;
    const stops = g.elevatorStops;
    if (!stops) return show(this.elevatorEl, false);
    clear(this.elevatorEl);
    this.elevatorEl.append(h('h2', null, tr('chooseFloor')));
    const col = h('div', { class: 'col' });
    for (const f of stops) col.append(h('button', { onclick: () => g.chooseElevator(f) }, f === 0 ? tr('town') : `${tr('floor', { n: f })} · ${t(tierForFloor(f).name)}`));
    col.append(h('button', { onclick: () => g.chooseElevator(null) }, tr('back')));
    this.elevatorEl.append(col);
    show(this.elevatorEl, true);
  }

  private showDeath(gold: number, items: number, exhausted: boolean): void {
    clear(this.overlayEl);
    this.overlayBlocking = true;
    if (this.game) this.game.paused = true;
    const close = () => {
      show(this.overlayEl, false);
      this.overlayBlocking = false;
      if (this.game) this.game.paused = false;
    };
    this.overlayEl.append(
      h('h1', null, exhausted ? tr('passedOut') : tr('youDied')),
      h('p', null, tr('diedText', { gold, items })),
      h('button', { onclick: close, id: 'death-ok' }, tr('continue')),
    );
    show(this.overlayEl, true);
  }

  // ───────────────────────── Эпилог ─────────────────────────

  private showEnding(id: EndingId): void {
    const g = this.game!;
    const ep = epilogue(id, g.state);
    let i = 0;
    this.overlayBlocking = true;
    g.paused = true;
    const draw = () => {
      clear(this.overlayEl);
      this.overlayEl.style.background = '#050308f0';
      const last = i >= ep.slides.length;
      this.overlayEl.append(
        h('div', { class: 'sub', style: 'color:var(--ink-dim);font-size:7px;letter-spacing:1px' }, tr('epilogue').toUpperCase()),
        h('h1', null, t(ep.title)),
        last
          ? h('p', { style: 'font-size:10px;color:var(--gold)' }, tr('theEnd'))
          : h('p', { style: 'max-width:330px;font-size:9px;line-height:1.55' }, t(ep.slides[i]!)),
        h('button', {
          id: 'death-ok',
          onclick: () => {
            if (!last) {
              i++;
              this.audio.play('ui');
              return draw();
            }
            show(this.overlayEl, false);
            this.overlayEl.style.background = '';
            this.overlayBlocking = false;
            g.paused = false;
            g.finishEnding();
          },
        }, last ? tr('continueGame') : tr('next')),
        h('div', { class: 'sub', style: 'font-size:6px;color:var(--ink-dim)' }, last ? '' : `${i + 1} / ${ep.slides.length}`),
      );
      show(this.overlayEl, true);
    };
    draw();
  }

  // ───────────────────────── Пауза ─────────────────────────

  togglePause(): void {
    const g = this.game;
    if (!g) return;
    this.pauseOpen = !this.pauseOpen;
    g.paused = this.pauseOpen || this.menuOpen;
    clear(this.pauseEl);
    if (this.pauseOpen) {
      this.pauseEl.append(
        h('h1', null, tr('paused')),
        h('div', { class: 'col', style: 'min-width:150px' },
          h('button', { onclick: () => this.togglePause() }, tr('resume')),
          h('button', { onclick: () => (this.togglePause(), this.toggleMenu('settings')) }, tr('settings')),
          h('button', { onclick: () => this.cb.saveAndQuit() }, tr('saveQuit'))),
      );
    }
    show(this.pauseEl, this.pauseOpen);
    this.audio.play(this.pauseOpen ? 'ui' : 'uiback');
  }

  // ───────────────────────── Титульный экран ─────────────────────────

  showTitle(): void {
    this.detach();
    this.renderTitle();
    show(this.titleEl, true);
  }

  private titleMode: 'main' | 'new' | 'load' | 'settings' = 'main';

  private renderTitle(): void {
    clear(this.titleEl);
    const saves = listSaves(this.kv);
    const hasSave = saves.some(Boolean);
    this.titleEl.append(h('div', { class: 'logo' }, tr('title')), h('div', { class: 'sub' }, tr('subtitle')));
    const menu = h('div', { class: 'menu' });
    if (this.titleMode === 'main') {
      if (hasSave) menu.append(h('button', { id: 'btn-continue', onclick: () => ((this.titleMode = 'load'), this.renderTitle()) }, tr('continue')));
      menu.append(h('button', { id: 'btn-new', onclick: () => ((this.titleMode = 'new'), this.renderTitle()) }, tr('newGame')));
      menu.append(h('button', { onclick: () => ((this.titleMode = 'settings'), this.renderTitle()) }, tr('settings')));
      menu.append(h('div', { class: 'row' },
        h('button', { class: getLang() === 'ru' ? 'focus' : '', onclick: () => this.setLanguage('ru') }, 'RU'),
        h('button', { class: getLang() === 'en' ? 'focus' : '', onclick: () => this.setLanguage('en') }, 'EN')));
    } else if (this.titleMode === 'new') {
      const input = h('input', { type: 'text', id: 'hero-name', maxlength: 16, value: tr('defaultHero') }) as HTMLInputElement;
      const free = saves.findIndex((s) => !s);
      let slot = free >= 0 ? free : 0;
      const slotRow = h('div', { class: 'row' });
      const drawSlots = () => {
        clear(slotRow);
        for (let i = 0; i < saves.length; i++)
          slotRow.append(h('button', { class: i === slot ? 'focus' : '', onclick: () => ((slot = i), drawSlots()) }, `${tr('slot', { n: i + 1 })}${saves[i] ? ' *' : ''}`));
      };
      drawSlots();
      menu.append(h('div', { class: 'sub', style: 'color:var(--ink-dim)' }, tr('heroName')), input, slotRow,
        h('button', { id: 'btn-start', onclick: () => this.cb.newGame(input.value.trim() || tr('defaultHero'), slot) }, tr('start')),
        h('button', { onclick: () => ((this.titleMode = 'main'), this.renderTitle()) }, tr('back')));
      setTimeout(() => input.focus(), 0);
    } else if (this.titleMode === 'load') {
      const slots = h('div', { class: 'slots' });
      saves.forEach((m, i) => {
        if (!m) return;
        slots.append(h('button', { id: `btn-slot-${i}`, onclick: () => this.cb.continueGame(i) },
          `${tr('slot', { n: i + 1 })}: ${m.name} · ${tr('level', { n: m.level })} · ${seasonName(m.season)} ${m.day} · ${tr('floor', { n: m.deepest })}`));
      });
      menu.append(slots, h('button', { onclick: () => ((this.titleMode = 'main'), this.renderTitle()) }, tr('back')));
    } else {
      const body = h('div', {});
      this.renderSettings(body, null);
      menu.append(body, h('button', { onclick: () => ((this.titleMode = 'main'), this.renderTitle()) }, tr('back')));
    }
    this.titleEl.append(menu, h('div', { class: 'foot' }, tr('controlsText')));
  }

  // ───────────────────────── Клавиши интерфейса ─────────────────────────

  /** Обработать нажатия. true — нажатие «съедено» интерфейсом. */
  handleKeys(codes: string[]): boolean {
    const g = this.game;
    if (!g || !codes.length) return false;
    let consumed = false;
    for (const c of codes) {
      if (!this.titleEl.classList.contains('hidden')) continue;
      if (this.overlayBlocking) {
        if (c === 'KeyE' || c === 'Enter' || c === 'Space' || c === 'Escape') (document.getElementById('death-ok') as HTMLButtonElement | null)?.click();
        consumed = true;
        continue;
      }
      if (c === 'Escape') {
        consumed = true;
        if (!this.giftEl.classList.contains('hidden')) show(this.giftEl, false);
        else if (g.mode === 'craft' || g.mode === 'storage' || g.mode === 'build' || g.mode === 'service') g.closePanel();
        else if (this.menuOpen) this.toggleMenu();
        else if (g.mode === 'shop') g.closeShop();
        else if (g.mode === 'lore') g.closeLore();
        else if (g.mode === 'elevator') g.chooseElevator(null);
        else if (g.mode === 'dialogue') {
          /* диалог нельзя пропустить Esc — он короткий */
        } else this.togglePause();
        continue;
      }
      if (this.pauseOpen) continue;
      if ((c === 'KeyI' || c === 'Tab') && (g.mode === 'play' || this.menuOpen)) {
        this.toggleMenu('inv');
        consumed = true;
        continue;
      }
      if (c === 'KeyM' && (g.mode === 'play' || this.menuOpen)) {
        this.toggleMenu('chronicle');
        consumed = true;
        continue;
      }
      if (g.mode === 'dialogue') {
        consumed = true;
        const d = g.dialogue;
        const n = d && this.typed >= d.text.length ? d.choices.length : 0;
        if (n) {
          if (c === 'ArrowUp' || c === 'KeyW') this.choiceFocus = (this.choiceFocus + n - 1) % n;
          else if (c === 'ArrowDown' || c === 'KeyS') this.choiceFocus = (this.choiceFocus + 1) % n;
          else if (c.startsWith('Digit')) {
            const i = Number(c.slice(5)) - 1;
            if (i >= 0 && i < n) this.choose(i);
            continue;
          } else if (c === 'KeyE' || c === 'Enter' || c === 'Space') {
            this.choose(this.choiceFocus);
            continue;
          }
          this.renderDialogue();
        } else if (c === 'KeyE' || c === 'Enter' || c === 'Space' || c === 'KeyF') this.advanceDialogue();
        continue;
      }
      if (g.mode === 'lore' && (c === 'KeyE' || c === 'Enter' || c === 'Space')) {
        g.closeLore();
        consumed = true;
      }
      if (g.mode === 'elevator' || g.mode === 'shop') consumed = true;
    }
    return consumed;
  }
}

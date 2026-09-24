import { Client, type Room } from 'colyseus.js';
import { CLASS_NAMES, itemDef } from '../../data/items';
import { L, t, type Loc } from '../../data/loc';
import { CREST_COLORS, PERM, type ArenaMode, type Crest, type GuildDTO, type HeroDTO, type ItemDTO, type LotDTO } from '../../online/protocol';
import { itemName } from '../../game/systems/loot';
import { WEAPON_CLASSES, type WeaponClass } from '../../game/types';
import type { KV } from '../../game/systems/save';
import type { Settings } from '../../game/state';
import type { Audio } from '../engine/audio';
import type { Renderer } from '../gfx/renderer';
import { ApiFailure, OnlineApi } from '../net/api';
import { NetSession } from '../net/session';
import { crestSvg } from './crest';
import { clear, h, show } from './dom';

export interface OnlineCallbacks {
  back(): void;
  battle(s: NetSession | null): void;
}

type Tab = 'hero' | 'auction' | 'guild' | 'arena' | 'wastes';

const ERR: Record<string, Loc> = {
  offline: L('Сервер недоступен. Запустите его командой npm run server.', 'Server unreachable. Start it with npm run server.'),
  not_enough_gold: L('Недостаточно золота', 'Not enough gold'),
  name_taken: L('Имя занято', 'Name taken'),
  bad_name: L('Имя: 3–16 букв или цифр', 'Name: 3–16 letters or digits'),
  bid_too_low: L('Ставка слишком мала (шаг 5 %)', 'Bid too low (5% step)'),
  no_permission: L('Недостаточно прав', 'No permission'),
  daily_limit: L('Дневной лимит исчерпан', 'Daily limit reached'),
  inventory_full: L('Рюкзак полон', 'Backpack is full'),
  bad_credentials: L('Неверный e-mail или пароль', 'Wrong e-mail or password'),
  treasury_empty: L('В казне не хватает золота', 'Not enough gold in the treasury'),
};

const errText = (e: unknown) => (e instanceof ApiFailure ? t(ERR[e.code] ?? L(`Ошибка: ${e.code}`, `Error: ${e.code}`)) : String(e));

const LEAGUES: Record<HeroDTO['league'], Loc> = {
  bronze: L('Бронза', 'Bronze'), silver: L('Серебро', 'Silver'), gold: L('Золото', 'Gold'),
  platinum: L('Платина', 'Platinum'), diamond: L('Алмаз', 'Diamond'), legend: L('Легенда', 'Legend'),
};

const RANK_PERMS: [number, Loc][] = [
  [PERM.invite, L('приглашать', 'invite')], [PERM.kick, L('исключать', 'kick')], [PERM.withdraw, L('казна', 'treasury')],
  [PERM.storage, L('хранилище', 'storage')], [PERM.war, L('войны', 'wars')], [PERM.crest, L('герб', 'crest')], [PERM.ranks, L('ранги', 'ranks')],
];

/** Онлайн-лобби: вход, герой «Печать», аукцион, гильдия, арена, Пустоши. */
export class OnlineUi {
  readonly el: HTMLElement;
  readonly hudEl: HTMLElement;
  api: OnlineApi;
  hero: HeroDTO | null = null;
  guild: GuildDTO | null = null;
  tab: Tab = 'hero';
  msg = '';
  private busy = false;
  private queueTimer: number | null = null;
  private chat: Room | null = null;
  private chatLog: { name: string; text: string }[] = [];
  private lots: LotDTO[] = [];
  private lotSel: string | null = null;
  private history: { day: number; median: number; volume: number }[] = [];
  private kind = '';
  private listUid: string | null = null;
  private crest: Crest = { shape: 0, division: 1, colors: ['#c83a3a', '#e0b040'], charge: 1 };
  private session: NetSession | null = null;

  constructor(root: HTMLElement, private renderer: Renderer, private audio: Audio, private kv: KV, private settings: () => Settings, private cb: OnlineCallbacks) {
    this.el = h('div', { class: 'panel interactive hidden online', style: 'left:10px;right:10px;top:8px;bottom:8px;display:flex;flex-direction:column' });
    this.hudEl = h('div', { class: 'net-hud hidden' });
    root.append(this.el, this.hudEl);
    this.api = new OnlineApi(this.kv.getItem('dtc.server') ?? `${location.protocol === 'https:' ? 'https' : 'http'}://${location.hostname || 'localhost'}:2567`);
  }

  private device(): string {
    let d = this.kv.getItem('dtc.device');
    if (!d) {
      d = `dev-${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
      this.kv.setItem('dtc.device', d);
    }
    return d;
  }

  open(): void {
    show(this.el, true);
    this.render();
    if (this.kv.getItem('dtc.token')) {
      this.api.token = this.kv.getItem('dtc.token');
      void this.refresh();
    }
  }

  close(): void {
    this.stopQueue();
    void this.chat?.leave().catch(() => {});
    this.chat = null;
    show(this.el, false);
    this.cb.back();
  }

  private async run(fn: () => Promise<void>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.msg = '';
    try {
      await fn();
    } catch (e) {
      this.msg = errText(e);
      this.audio.play('uiback');
    } finally {
      this.busy = false;
      this.render();
    }
  }

  private async refresh(): Promise<void> {
    await this.run(async () => {
      try {
        this.hero = await this.api.hero();
      } catch (e) {
        if (e instanceof ApiFailure && e.code === 'no_hero') this.hero = null;
        else if (e instanceof ApiFailure && e.status === 401) {
          this.api.token = null;
          this.kv.removeItem('dtc.token');
        } else throw e;
      }
      this.guild = this.hero?.guild ? await this.api.guild() : null;
    });
  }

  // ───────────────────────── Отрисовка ─────────────────────────

  render(): void {
    clear(this.el);
    const head = h('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:3px' },
      h('h2', { style: 'margin:0' }, t(L('Онлайн: Печать Вальмарка', 'Online: the Seal of Valmark'))),
      this.hero ? h('span', { class: 'gold-text num' }, `◆ ${this.hero.gold}`) : null,
      h('button', { onclick: () => this.close() }, `✕ ${t(L('В меню', 'To menu'))}`));
    this.el.append(head);
    if (!this.api.token) this.renderConnect();
    else if (!this.hero) this.renderCreate();
    else {
      const tabs = h('div', { class: 'tabs', style: 'padding:0' });
      const names: [Tab, Loc][] = [['hero', L('Герой', 'Hero')], ['auction', L('Аукцион', 'Auction')], ['guild', L('Гильдия', 'Guild')], ['arena', L('Арена', 'Arena')], ['wastes', L('Пустоши', 'Wastes')]];
      for (const [id, n] of names) tabs.append(h('button', { class: this.tab === id ? 'on' : '', onclick: () => this.switchTab(id) }, t(n)));
      const body = h('div', { class: 'tab-body', style: 'flex-direction:column;overflow-y:auto' });
      this.el.append(tabs, body);
      if (this.tab === 'hero') this.renderHero(body);
      else if (this.tab === 'auction') this.renderAuction(body);
      else if (this.tab === 'guild') this.renderGuild(body);
      else if (this.tab === 'arena') this.renderArena(body);
      else this.renderWastes(body);
    }
    if (this.msg) this.el.append(h('div', { class: 'net-msg' }, this.msg));
  }

  private switchTab(tab: Tab): void {
    this.tab = tab;
    this.msg = '';
    if (tab === 'auction') void this.loadLots();
    else if (tab === 'guild') void this.loadGuild();
    else if (tab === 'arena' || tab === 'wastes') void this.loadBoards();
    this.render();
  }

  private renderConnect(): void {
    const server = h('input', { type: 'text', value: this.api.base, style: 'width:180px' }) as HTMLInputElement;
    const email = h('input', { type: 'text', placeholder: 'e-mail', style: 'width:120px' }) as HTMLInputElement;
    const pass = h('input', { type: 'password', placeholder: t(L('пароль', 'password')), style: 'width:90px' }) as HTMLInputElement;
    const setServer = () => {
      this.api.base = server.value.trim().replace(/\/$/, '');
      this.kv.setItem('dtc.server', this.api.base);
    };
    this.el.append(h('div', { class: 'col', style: 'gap:6px;padding:6px' },
      h('p', { class: 'help' }, t(L(
        'Онлайн-герой живёт на сервере: аукцион с живыми игроками, рейтинговая арена, гильдии и открытое PvP в Пустошах. Одиночные сохранения в онлайн не переносятся.',
        'Your online hero lives on the server: a live auction house, ranked arena, guilds and open PvP in the Wastes. Offline saves do not carry over.'))),
      h('div', { class: 'row', style: 'justify-content:flex-start;gap:4px' }, t(L('Сервер', 'Server')), server),
      h('div', { class: 'row', style: 'justify-content:flex-start;gap:4px' },
        h('button', { id: 'btn-guest', onclick: () => void this.run(async () => {
          setServer();
          await this.api.guest(this.device());
          this.kv.setItem('dtc.token', this.api.token!);
          this.hero = await this.api.hero().catch(() => null);
        }) }, t(L('Войти как гость', 'Play as guest')))),
      h('div', { class: 'row', style: 'justify-content:flex-start;gap:4px' }, email, pass,
        h('button', { onclick: () => void this.run(async () => {
          setServer();
          await this.api.login(email.value.trim(), pass.value);
          this.kv.setItem('dtc.token', this.api.token!);
          this.hero = await this.api.hero().catch(() => null);
        }) }, t(L('Войти по e-mail', 'Log in with e-mail'))))));
  }

  private renderCreate(): void {
    const name = h('input', { type: 'text', id: 'online-name', maxlength: 16, placeholder: t(L('Имя героя', 'Hero name')) }) as HTMLInputElement;
    let cls: WeaponClass = 'sword';
    const row = h('div', { class: 'row', style: 'justify-content:flex-start;gap:3px' });
    const draw = () => {
      clear(row);
      for (const c of WEAPON_CLASSES) row.append(h('button', { class: c === cls ? 'focus' : '', onclick: () => ((cls = c), draw()) }, t(CLASS_NAMES[c])));
    };
    draw();
    this.el.append(h('div', { class: 'col', style: 'gap:6px;padding:6px' },
      h('p', { class: 'help' }, t(L('Создайте онлайн-героя. Класс оружия определяет стартовое снаряжение; сменить оружие можно в любой момент.', 'Create your online hero. The weapon class sets the starting kit; you can change weapons any time.'))),
      name, row,
      h('button', { id: 'btn-create-online', onclick: () => void this.run(async () => {
        this.hero = await this.api.post<HeroDTO>('/api/hero', { name: name.value.trim(), cls });
      }) }, t(L('Создать героя', 'Create hero')))));
  }

  private icon(def: string): HTMLElement {
    return h('img', { src: this.renderer.bank.iconUrl(def), style: 'width:14px;height:14px;image-rendering:pixelated' });
  }

  private itemRow(i: ItemDTO, ...extra: (HTMLElement | string | null)[]): HTMLElement {
    const stack = { ...i, rarity: i.rarity as 0 };
    return h('div', { class: 'shop-row' }, this.icon(i.def), h('span', { class: `nm r${i.rarity}`, style: 'flex:1' }, `${itemName(stack)}${i.qty > 1 ? ` ×${i.qty}` : ''}${i.upgrade ? ` +${i.upgrade}` : ''}`), ...extra);
  }

  private renderHero(body: HTMLElement): void {
    const hr = this.hero!;
    const status = { blue: L('синий', 'blue'), purple: L('фиолетовый', 'purple'), red: L('Отступник', 'Outlaw') }[hr.status];
    body.append(
      h('div', { class: 'row', style: 'justify-content:flex-start;gap:8px' },
        h('b', null, hr.name), h('span', null, `${t(CLASS_NAMES[hr.cls])} · ${t(L('ур.', 'lv.'))} ${hr.level}`),
        h('span', { class: 'gold-text' }, `${t(L('Лига', 'League'))}: ${t(LEAGUES[hr.league])} (${hr.rating})`),
        h('span', null, `${t(L('Карма', 'Karma'))}: ${hr.karma} · ${t(status)}`),
        h('span', null, `${t(L('Жетоны арены', 'Arena tokens'))}: ${hr.tokens}`),
        hr.guild ? h('span', null, `[${hr.guild.tag}] ${hr.guild.name}`) : null),
      h('div', { class: 'sub' }, t(L('Экипировка (щелчок — снять):', 'Equipment (click to unequip):'))));
    const eq = h('div', { class: 'col' });
    for (const i of hr.equipment) eq.append(this.itemRow(i, h('span', { class: 'sub' }, i.slot ?? ''), h('button', { onclick: () => void this.run(async () => {
      this.hero = await this.api.post<HeroDTO>('/api/hero/unequip', { slot: i.slot });
    }) }, '↓')));
    const inv = h('div', { class: 'col' });
    for (const i of hr.inventory) {
      const d = itemDef(i.def);
      const wearable = d.weapon || d.armor || d.accessory;
      inv.append(this.itemRow(i, wearable ? h('button', { onclick: () => void this.run(async () => {
        this.hero = await this.api.post<HeroDTO>('/api/hero/equip', { uid: i.uid });
      }) }, t(L('Надеть', 'Equip'))) : null));
    }
    body.append(eq, h('div', { class: 'sub' }, `${t(L('Рюкзак', 'Backpack'))} (${hr.inventory.length}/36)`), inv,
      h('div', { class: 'row', style: 'justify-content:flex-start;gap:4px' },
        h('span', null, `${t(L('Почта', 'Mail'))}: ${hr.mail}`),
        h('button', { disabled: !hr.mail ? true : undefined, onclick: () => void this.run(async () => {
          await this.api.post('/api/mail/collect');
          this.hero = await this.api.hero();
        }) }, t(L('Забрать почту', 'Collect mail'))),
        h('button', { onclick: () => {
          this.api.token = null;
          this.kv.removeItem('dtc.token');
          this.hero = null;
          this.render();
        } }, t(L('Выйти из аккаунта', 'Log out')))));
  }

  // ───── Аукцион ─────

  private async loadLots(): Promise<void> {
    await this.run(async () => {
      this.lots = await this.api.lots(this.kind ? `kind=${this.kind}` : '');
    });
  }

  private renderAuction(body: HTMLElement): void {
    const kinds: [string, Loc][] = [['', L('Все', 'All')], ['weapon', L('Оружие', 'Weapons')], ['armor', L('Броня', 'Armour')], ['accessory', L('Украшения', 'Jewellery')], ['material', L('Материалы', 'Materials')], ['consumable', L('Зелья', 'Potions')]];
    const filt = h('div', { class: 'row', style: 'justify-content:flex-start;gap:2px' });
    for (const [k, n] of kinds) filt.append(h('button', { class: this.kind === k ? 'focus' : '', onclick: () => ((this.kind = k), void this.loadLots()) }, t(n)));
    filt.append(h('button', { onclick: () => void this.loadLots() }, '⟳'));
    const list = h('div', { class: 'shop-list', style: 'flex:1' });
    const now = Date.now();
    for (const l of this.lots) {
      const left = Math.max(0, Math.round((l.endsAt - now) / 60000));
      list.append(h('div', { class: 'shop-row', style: this.lotSel === l.id ? 'background:var(--panel-2)' : '', onclick: () => ((this.lotSel = l.id), void this.loadHistory(l)) },
        this.icon(l.item.def), h('span', { class: `nm r${l.item.rarity}`, style: 'flex:1' }, `${itemName({ ...l.item, rarity: l.item.rarity as 0 })}${l.item.qty > 1 ? ` ×${l.item.qty}` : ''}${l.leading ? ' ★' : ''}${l.mine ? ' ✎' : ''}`),
        h('span', { class: 'sub' }, `${l.seller} · ${left >= 60 ? `${Math.floor(left / 60)} ч` : `${left} мин`}`),
        h('span', { class: 'num', style: 'width:44px;text-align:right' }, `${l.currentBid || l.startBid}`),
        h('span', { class: 'pr num' }, l.buyout ? `◆${l.buyout}` : '—')));
    }
    if (!this.lots.length) list.append(h('div', { class: 'sub' }, t(L('Лотов нет. Выставьте свой!', 'No lots. List your own!'))));
    const detail = h('div', { class: 'detail', style: 'min-height:0' });
    const lot = this.lots.find((l) => l.id === this.lotSel);
    if (lot) {
      const bid = h('input', { type: 'number', value: String(lot.currentBid ? Math.ceil(lot.currentBid * 1.05) : lot.startBid), style: 'width:70px' }) as HTMLInputElement;
      detail.append(h('div', { class: 't' }, itemName({ ...lot.item, rarity: lot.item.rarity as 0 })),
        this.spark(this.history.map((x) => x.median)),
        h('div', { class: 'row', style: 'justify-content:flex-start;gap:3px' }, bid,
          h('button', { disabled: lot.mine ? true : undefined, onclick: () => void this.run(async () => {
            await this.api.post('/api/auction/bid', { lotId: lot.id, amount: Math.round(Number(bid.value)) });
            this.lots = await this.api.lots(this.kind ? `kind=${this.kind}` : '');
            this.hero = await this.api.hero();
          }) }, t(L('Ставка', 'Bid'))),
          lot.buyout && !lot.mine ? h('button', { onclick: () => void this.run(async () => {
            await this.api.post('/api/auction/buyout', { lotId: lot.id });
            this.lots = await this.api.lots(this.kind ? `kind=${this.kind}` : '');
            this.hero = await this.api.hero();
          }) }, `${t(L('Выкуп', 'Buy out'))} ◆${lot.buyout}`) : null,
          lot.mine && !lot.currentBid ? h('button', { onclick: () => void this.run(async () => {
            await this.api.post('/api/auction/cancel', { lotId: lot.id });
            this.lots = await this.api.lots('');
          }) }, t(L('Снять', 'Cancel'))) : null),
        h('div', { class: 'help' }, t(L('Шаг ставки 5 %. Ставка в последние 5 минут продлевает торги. Комиссия 8 %, залог 2 %.', 'Minimum step 5%. A bid in the last 5 minutes extends the lot. 8% fee, 2% deposit.'))));
    }
    // выставить свой лот
    const sell = h('div', { class: 'detail', style: 'min-height:0' }, h('div', { class: 'sub' }, t(L('Выставить из рюкзака:', 'List from backpack:'))));
    const picks = h('div', { class: 'row', style: 'justify-content:flex-start;flex-wrap:wrap;gap:2px' });
    for (const i of this.hero!.inventory) picks.append(h('button', { class: this.listUid === i.uid ? 'focus' : '', title: itemName({ ...i, rarity: i.rarity as 0 }), onclick: () => ((this.listUid = i.uid), this.render()) }, this.icon(i.def)));
    sell.append(picks);
    if (this.listUid) {
      const start = h('input', { type: 'number', value: '100', style: 'width:60px' }) as HTMLInputElement;
      const buyout = h('input', { type: 'number', placeholder: t(L('выкуп', 'buyout')), style: 'width:60px' }) as HTMLInputElement;
      let hours = 24;
      const hrs = h('span', { class: 'row', style: 'gap:2px' });
      const drawH = () => {
        clear(hrs);
        for (const x of [12, 24, 48]) hrs.append(h('button', { class: x === hours ? 'focus' : '', onclick: () => ((hours = x), drawH()) }, `${x}ч`));
      };
      drawH();
      sell.append(h('div', { class: 'row', style: 'justify-content:flex-start;gap:3px' }, start, buyout, hrs,
        h('button', { onclick: () => void this.run(async () => {
          await this.api.post('/api/auction/list', { uid: this.listUid, startBid: Math.round(Number(start.value)), buyout: buyout.value ? Math.round(Number(buyout.value)) : null, hours });
          this.listUid = null;
          this.hero = await this.api.hero();
          this.lots = await this.api.lots('');
        }) }, t(L('Выставить', 'List')))));
    }
    body.append(filt, h('div', { style: 'display:flex;gap:6px;min-height:0;flex:1' }, list, h('div', { class: 'col', style: 'width:200px;gap:4px' }, detail, sell)));
  }

  private async loadHistory(l: LotDTO): Promise<void> {
    this.history = await this.api.get<{ day: number; median: number; volume: number }[]>(`/api/auction/history?def=${l.item.def}&rarity=${l.item.rarity}`).catch(() => []);
    this.render();
  }

  private spark(values: number[]): HTMLElement {
    const box = h('div', { class: 'spark' });
    if (values.length < 2) {
      box.append(h('span', { class: 'sub' }, values.length ? `${t(L('медиана', 'median'))} ◆${values[0]}` : t(L('продаж ещё не было', 'no sales yet'))));
      return box;
    }
    const W = 120, H = 24, lo = Math.min(...values), hi = Math.max(...values), span = Math.max(1, hi - lo);
    const pts = values.map((v, i) => `${((i / (values.length - 1)) * (W - 4) + 2).toFixed(1)},${(H - 3 - ((v - lo) / span) * (H - 6)).toFixed(1)}`).join(' ');
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><polyline points="${pts}" fill="none" stroke="var(--gold)" stroke-width="1"/></svg>`;
    return box;
  }

  // ───── Гильдия ─────

  private invites: { guildId: string; name: string; tag: string }[] = [];
  private territories: { id: number; name: string; tag: string | null; contest: { tag: string; points: number }[] }[] = [];

  private async loadGuild(): Promise<void> {
    await this.run(async () => {
      this.guild = await this.api.guild();
      this.invites = this.guild ? [] : await this.api.get('/api/guild/invites');
      this.territories = await this.api.get('/api/territories');
      if (this.guild && !this.chat) await this.joinChat(this.guild.id);
    });
  }

  private async joinChat(guildId: string): Promise<void> {
    try {
      const room = await new Client(this.api.wsUrl).joinOrCreate('guild_chat', { token: this.api.token, guildId });
      this.chat = room;
      room.onMessage('history', (hs: { name: string; text: string }[]) => ((this.chatLog = hs), this.tab === 'guild' && this.render()));
      room.onMessage('msg', (m: { name: string; text: string }) => {
        this.chatLog.push(m);
        this.chatLog = this.chatLog.slice(-60);
        if (this.tab === 'guild') this.render();
      });
    } catch {
      /* чат недоступен — не мешает остальному */
    }
  }

  private can(perm: number): boolean {
    const g = this.guild!;
    return !!((g.ranks.find((r) => r.rank === g.myRank)?.perms ?? 0) & perm);
  }

  private renderGuild(body: HTMLElement): void {
    const g = this.guild;
    if (!g) {
      const name = h('input', { type: 'text', placeholder: t(L('Название', 'Name')), style: 'width:120px' }) as HTMLInputElement;
      const tag = h('input', { type: 'text', placeholder: t(L('Тег', 'Tag')), maxlength: 4, style: 'width:40px' }) as HTMLInputElement;
      const preview = h('div', null);
      preview.innerHTML = crestSvg(this.crest, 32);
      const opt = (label: Loc, n: number, key: 'shape' | 'division' | 'charge') =>
        h('div', { class: 'row', style: 'justify-content:flex-start;gap:2px' }, h('span', { class: 'sub', style: 'width:50px' }, t(label)),
          ...Array.from({ length: n }, (_, i) => h('button', { class: this.crest[key] === i ? 'focus' : '', onclick: () => ((this.crest = { ...this.crest, [key]: i } as Crest), this.render()) }, String(i + 1))));
      const colors = (idx: 0 | 1) => h('div', { class: 'row', style: 'justify-content:flex-start;gap:2px' }, h('span', { class: 'sub', style: 'width:50px' }, t(idx ? L('Цвет 2', 'Colour 2') : L('Цвет 1', 'Colour 1'))),
        ...CREST_COLORS.map((c) => h('button', { style: `background:${c};width:14px;height:12px;${this.crest.colors[idx] === c ? 'outline:1px solid var(--gold)' : ''}`, onclick: () => {
          const cs = [...this.crest.colors] as [string, string];
          cs[idx] = c;
          this.crest = { ...this.crest, colors: cs };
          this.render();
        } })));
      body.append(h('div', { style: 'display:flex;gap:8px' },
        h('div', { class: 'col', style: 'gap:3px' },
          h('div', { class: 't' }, t(L('Основать гильдию (5000 ◆)', 'Found a guild (5000 ◆)'))),
          h('div', { class: 'row', style: 'justify-content:flex-start;gap:3px' }, name, tag),
          opt(L('Форма', 'Shape'), 4, 'shape'), opt(L('Деление', 'Division'), 5, 'division'), opt(L('Фигура', 'Charge'), 8, 'charge'), colors(0), colors(1),
          h('button', { onclick: () => void this.run(async () => {
            this.guild = await this.api.post<GuildDTO>('/api/guild', { name: name.value.trim(), tag: tag.value.trim(), crest: this.crest });
            this.hero = await this.api.hero();
            await this.joinChat(this.guild.id);
          }) }, t(L('Основать', 'Found')))),
        preview,
        h('div', { class: 'col' }, h('div', { class: 't' }, t(L('Приглашения', 'Invitations'))),
          ...(this.invites.length ? this.invites.map((i) => h('div', { class: 'row', style: 'gap:3px' }, `[${i.tag}] ${i.name}`, h('button', { onclick: () => void this.run(async () => {
            this.guild = await this.api.post<GuildDTO>('/api/guild/accept', { guildId: i.guildId });
            this.hero = await this.api.hero();
            await this.joinChat(this.guild.id);
          }) }, t(L('Вступить', 'Join'))))) : [h('span', { class: 'sub' }, t(L('нет', 'none')))]))));
      return;
    }
    const crest = h('div', null);
    crest.innerHTML = crestSvg(g.crest, 28);
    const amount = h('input', { type: 'number', value: '100', style: 'width:60px' }) as HTMLInputElement;
    const inviteName = h('input', { type: 'text', placeholder: t(L('Имя героя', 'Hero name')), style: 'width:90px' }) as HTMLInputElement;
    const members = h('div', { class: 'col' });
    for (const m of g.members) {
      const rank = g.ranks.find((r) => r.rank === m.rank);
      members.append(h('div', { class: 'row', style: 'justify-content:flex-start;gap:4px' },
        h('span', { style: 'width:90px' }, m.name), h('span', { class: 'sub', style: 'width:60px' }, rank?.title ?? ''), h('span', { class: 'sub' }, `${t(L('ур.', 'lv.'))} ${m.level}`),
        this.can(PERM.ranks) && m.rank > g.myRank && m.rank > 1 ? h('button', { onclick: () => void this.run(async () => { this.guild = await this.api.post('/api/guild/rank', { heroId: m.heroId, rank: m.rank - 1 }); }) }, '▲') : null,
        this.can(PERM.ranks) && m.rank > g.myRank && m.rank < 4 ? h('button', { onclick: () => void this.run(async () => { this.guild = await this.api.post('/api/guild/rank', { heroId: m.heroId, rank: m.rank + 1 }); }) }, '▼') : null,
        this.can(PERM.kick) && m.rank > g.myRank ? h('button', { onclick: () => void this.run(async () => { this.guild = await this.api.post('/api/guild/kick', { heroId: m.heroId }); }) }, '✕') : null));
    }
    const ranks = h('div', { class: 'col' });
    for (const r of g.ranks) ranks.append(h('div', { class: 'sub' }, `${r.title}: ${RANK_PERMS.filter(([p]) => r.perms & p).map(([, n]) => t(n)).join(', ') || '—'}${r.dailyWithdraw > 0 && r.dailyWithdraw < 1e9 ? ` (${r.dailyWithdraw}/день)` : ''}`));
    const storage = h('div', { class: 'col' });
    for (const i of g.storage) storage.append(this.itemRow(i, this.can(PERM.storage) ? h('button', { onclick: () => void this.run(async () => {
      this.guild = await this.api.post('/api/guild/storage/take', { uid: i.uid });
      this.hero = await this.api.hero();
    }) }, '↓') : null));
    const put = h('div', { class: 'row', style: 'justify-content:flex-start;flex-wrap:wrap;gap:2px' });
    for (const i of this.hero!.inventory) put.append(h('button', { title: itemName({ ...i, rarity: i.rarity as 0 }), onclick: () => void this.run(async () => {
      this.guild = await this.api.post('/api/guild/storage/put', { uid: i.uid });
      this.hero = await this.api.hero();
    }) }, this.icon(i.def)));
    const chatBox = h('div', { class: 'chat' });
    for (const m of this.chatLog.slice(-12)) chatBox.append(h('div', null, h('b', null, `${m.name}: `), m.text));
    const say = h('input', { type: 'text', maxlength: 200, style: 'flex:1' }) as HTMLInputElement;
    say.onkeydown = (e) => {
      if (e.key === 'Enter' && say.value.trim()) {
        this.chat?.send('say', say.value.trim());
        say.value = '';
      }
    };
    const terr = h('div', { class: 'col' });
    for (const tt of this.territories) terr.append(h('div', { class: 'row', style: 'justify-content:flex-start;gap:4px' },
      h('span', { style: 'width:110px' }, tt.name), h('span', { class: 'gold-text', style: 'width:30px' }, tt.tag ? `[${tt.tag}]` : '—'),
      h('span', { class: 'sub' }, tt.contest.map((c) => `${c.tag}:${c.points}`).join(' ')),
      this.can(PERM.war) ? h('button', { onclick: () => void this.run(async () => {
        this.territories = await this.api.post('/api/guild/claim', { territory: tt.id });
        this.guild = await this.api.guild();
      }) }, t(L('Заявка', 'Claim'))) : null));
    body.append(
      h('div', { class: 'row', style: 'justify-content:flex-start;gap:6px' }, crest, h('b', null, `[${g.tag}] ${g.name}`),
        h('span', null, `${t(L('Зал', 'Hall'))} ${g.hall}/5`), h('span', { class: 'gold-text' }, `${t(L('Казна', 'Treasury'))}: ◆${g.treasury}`),
        amount,
        h('button', { onclick: () => void this.run(async () => { this.guild = await this.api.post('/api/guild/deposit', { amount: Math.round(Number(amount.value)) }); this.hero = await this.api.hero(); }) }, t(L('Внести', 'Deposit'))),
        this.can(PERM.withdraw) ? h('button', { onclick: () => void this.run(async () => { this.guild = await this.api.post('/api/guild/withdraw', { amount: Math.round(Number(amount.value)) }); this.hero = await this.api.hero(); }) }, t(L('Взять', 'Withdraw'))) : null,
        this.can(PERM.war) && g.hall < 5 ? h('button', { onclick: () => void this.run(async () => { await this.api.post('/api/guild/hall'); this.guild = await this.api.guild(); }) }, `${t(L('Улучшить зал', 'Upgrade hall'))} ◆${10000 * g.hall}`) : null),
      h('div', { style: 'display:flex;gap:8px' },
        h('div', { class: 'col', style: 'flex:1;gap:2px' }, h('div', { class: 't' }, t(L('Состав', 'Members'))), members,
          this.can(PERM.invite) ? h('div', { class: 'row', style: 'justify-content:flex-start;gap:3px' }, inviteName, h('button', { onclick: () => void this.run(async () => { await this.api.post('/api/guild/invite', { name: inviteName.value.trim() }); }) }, t(L('Пригласить', 'Invite')))) : null,
          ranks,
          h('button', { onclick: () => void this.run(async () => { await this.api.post('/api/guild/leave'); this.guild = null; this.hero = await this.api.hero(); void this.chat?.leave(); this.chat = null; }) }, t(L('Покинуть гильдию', 'Leave guild')))),
        h('div', { class: 'col', style: 'flex:1;gap:2px' }, h('div', { class: 't' }, t(L('Чат', 'Chat'))), chatBox, h('div', { class: 'row', style: 'gap:2px' }, say)),
        h('div', { class: 'col', style: 'flex:1;gap:2px' }, h('div', { class: 't' }, t(L('Хранилище', 'Storage'))), storage, h('div', { class: 'sub' }, t(L('Положить:', 'Deposit:'))), put)),
      h('div', { class: 't' }, t(L('Территории Пустошей (итоги по неделям)', 'Territories of the Wastes (weekly results)'))), terr);
  }

  // ───── Арена и Пустоши ─────

  private boards: { arena: { name: string; score: number; wins: number; losses: number }[]; waves: { name: string; score: number }[]; bounties: { name: string; level: number; amount: number; karma: number }[] } = { arena: [], waves: [], bounties: [] };
  private queue: { state: string; mode?: string; size?: number } = { state: 'idle' };

  private async loadBoards(): Promise<void> {
    await this.run(async () => {
      this.boards = {
        arena: await this.api.get('/api/leaderboard?kind=arena'),
        waves: await this.api.get('/api/leaderboard?kind=waves'),
        bounties: await this.api.get('/api/bounties'),
      };
    });
  }

  private renderArena(body: HTMLElement): void {
    let ranked = true;
    const modes: [ArenaMode, Loc, Loc][] = [
      ['duel', L('Дуэль 1×1', 'Duel 1v1'), L('Бой до первого павшего, 3 минуты.', 'Fight until one falls, 3 minutes.')],
      ['team', L('Бой 3×3', 'Team 3v3'), L('Уничтожение команды.', 'Wipe the other team.')],
      ['waves', L('Волны (PvE)', 'Waves (PvE)'), L('Бесконечные волны чудовищ и боссы каждые 10 волн.', 'Endless monster waves, a boss every 10 waves.')],
    ];
    if (this.hero?.guild) modes.push(['raid', L('Рейд «Разлом»', 'Rift raid'), L('4–6 членов гильдии против босса недели. Личная добыча — раз в неделю.', '4–6 guildmates against the boss of the week. Personal loot once a week.')]);
    const rk = h('button', { class: 'focus' }, t(L('Рейтинговый', 'Ranked')));
    rk.onclick = () => {
      ranked = !ranked;
      rk.className = ranked ? 'focus' : '';
    };
    const row = h('div', { class: 'col', style: 'gap:3px' });
    for (const [m, n, d] of modes) row.append(h('div', { class: 'row', style: 'justify-content:flex-start;gap:6px' },
      h('button', { id: `btn-queue-${m}`, disabled: this.queue.state !== 'idle' ? true : undefined, onclick: () => void this.enqueue(m, ranked) }, t(n)), h('span', { class: 'sub' }, t(d))));
    const q = this.queue.state === 'queued'
      ? h('div', { class: 'row', style: 'justify-content:flex-start;gap:6px' }, h('span', { class: 'gold-text' }, `${t(L('Поиск соперников…', 'Searching…'))} (${this.queue.size ?? 1})`), h('button', { onclick: () => void this.leaveQueue() }, t(L('Отмена', 'Cancel'))))
      : null;
    const board = (title: Loc, rows: { name: string; score: number }[]) => h('div', { class: 'col', style: 'flex:1' }, h('div', { class: 't' }, t(title)),
      ...rows.slice(0, 10).map((r, i) => h('div', { class: 'row', style: 'justify-content:flex-start;gap:4px' }, h('span', { class: 'num', style: 'width:14px' }, String(i + 1)), h('span', { style: 'flex:1' }, r.name), h('span', { class: 'num gold-text' }, String(r.score)))));
    body.append(h('div', { class: 'row', style: 'justify-content:flex-start;gap:6px' }, rk, h('span', { class: 'sub' }, t(L('В рейтинге снаряжение приводится к эталону (серебро, ур. 30), таланты учитываются полностью.', 'Ranked normalises gear to a reference (silver, level 30); talents count in full.')))),
      row, q ?? '', h('div', { style: 'display:flex;gap:10px' }, board(L('Рейтинг арены', 'Arena rating'), this.boards.arena), board(L('Рекорд волн', 'Wave records'), this.boards.waves)));
  }

  private async enqueue(mode: ArenaMode, ranked: boolean): Promise<void> {
    await this.run(async () => {
      this.queue = await this.api.post('/api/arena/queue', { mode, ranked });
      this.startQueue();
    });
  }

  private async leaveQueue(): Promise<void> {
    this.stopQueue();
    await this.run(async () => {
      this.queue = await this.api.post('/api/arena/leave');
    });
  }

  private startQueue(): void {
    this.stopQueue();
    this.queueTimer = window.setInterval(async () => {
      const s = await this.api.get<{ state: string; roomId?: string; size?: number }>('/api/arena/queue').catch(() => null);
      if (!s) return;
      this.queue = s;
      if (s.state === 'matched' && s.roomId) {
        this.stopQueue();
        await this.enterBattle('arena', s.roomId);
      } else if (this.tab === 'arena') this.render();
    }, 800);
  }

  private stopQueue(): void {
    if (this.queueTimer !== null) window.clearInterval(this.queueTimer);
    this.queueTimer = null;
  }

  private renderWastes(body: HTMLElement): void {
    body.append(
      h('p', { class: 'help' }, t(L(
        'Пепельные Пустоши — открытое PvP. В лагере в центре драться нельзя. Нападение на «синего» — −50 кармы и фиолетовый флаг на 2 минуты, убийство — −150. Отступники (карма < −300) видны красным, за их головы назначена награда. Смерть стоит 1–3 стопок из рюкзака — их может подобрать кто угодно.',
        'The Ashen Wastes are open PvP. No fighting in the central camp. Attacking a "blue" costs 50 karma and flags you purple for 2 minutes; a kill costs 150. Outlaws (karma < −300) show red and carry bounties. Dying drops 1–3 stacks from your backpack for anyone to take.'))),
      h('button', { id: 'btn-wastes', onclick: () => void this.enterBattle('wastes') }, t(L('Войти в Пустоши', 'Enter the Wastes'))),
      h('div', { class: 't' }, t(L('Охота за головами', 'Bounty board'))),
      ...(this.boards.bounties.length ? this.boards.bounties.map((b) => h('div', { class: 'row', style: 'justify-content:flex-start;gap:6px' }, h('span', { style: 'width:100px;color:#ff7070' }, b.name), h('span', { class: 'sub' }, `${t(L('ур.', 'lv.'))} ${b.level} · ${b.karma}`), h('span', { class: 'gold-text num' }, `◆${b.amount}`))) : [h('span', { class: 'sub' }, t(L('Пока тихо.', 'All quiet for now.')))]));
  }

  private async enterBattle(kind: 'arena' | 'wastes', roomId?: string): Promise<void> {
    await this.run(async () => {
      const s = new NetSession(this.api, this.settings(), this.audio, this.renderer);
      await s.join(kind, roomId);
      this.session = s;
      show(this.el, false);
      show(this.hudEl, true);
      this.cb.battle(s);
    });
  }

  /** HUD во время боя и экран итогов. */
  updateHud(s: NetSession): void {
    const me = s.me;
    const hud = s.hud ?? {};
    const res = s.result;
    const lines: string[] = [];
    if (hud.wave !== undefined) lines.push(`${t(L('Волна', 'Wave'))} ${hud.wave}`);
    if (hud.teams) lines.push(`${hud.teams[0]} : ${hud.teams[1]}`);
    if (hud.timer !== undefined) lines.push(`⏱ ${hud.timer}`);
    if (hud.msg?.startsWith('boss:')) lines.push(`${t(L('Босс', 'Boss'))}: ${hud.msg.slice(5)}%`);
    if (hud.msg === 'camp') lines.push(t(L('Лагерь — безопасно', 'Camp — safe')));
    else if (hud.msg?.startsWith('t')) lines.push(`${t(L('Территория', 'Territory'))} ${Number(hud.msg.slice(1)) + 1}`);
    const key = `${me?.hp}|${me?.maxHp}|${lines.join()}|${res ? 1 : 0}`;
    if (this.hudEl.dataset.key === key) return;
    this.hudEl.dataset.key = key;
    clear(this.hudEl);
    if (me) this.hudEl.append(h('div', { class: 'bar hp', style: 'width:120px' }, h('i', { style: `transform:scaleX(${Math.max(0, me.hp / Math.max(1, me.maxHp))})` }), h('span', null, `${Math.ceil(me.hp)}/${me.maxHp}`)));
    this.hudEl.append(h('div', { class: 'net-info' }, lines.join(' · ')),
      h('button', { class: 'interactive', onclick: () => this.endBattle() }, t(L('Покинуть бой', 'Leave'))));
    if (res) {
      const won = this.hero && res.winners.includes(this.hero.id);
      const d = this.hero ? res.ratings?.[this.hero.id] : undefined;
      this.hudEl.append(h('div', { class: 'net-result interactive' },
        h('h2', null, res.waves ? t(L(`Пройдено волн: ${res.waves}`, `Waves cleared: ${res.waves}`)) : res.draw ? t(L('Ничья', 'Draw')) : won ? t(L('Победа!', 'Victory!')) : t(L('Поражение', 'Defeat'))),
        d && d.delta ? h('div', null, `${t(L('Рейтинг', 'Rating'))}: ${d.rating} (${d.delta > 0 ? '+' : ''}${d.delta})`) : null,
        h('button', { onclick: () => this.endBattle() }, t(L('В лобби', 'Back to lobby')))));
    }
  }

  endBattle(): void {
    this.session?.leave();
    this.session = null;
    show(this.hudEl, false);
    this.cb.battle(null);
    show(this.el, true);
    this.queue = { state: 'idle' };
    void this.refresh();
  }
}

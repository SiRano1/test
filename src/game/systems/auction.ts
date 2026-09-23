import { hashSeed, makeUid, Rng } from '../../core/rng';
import { ITEMS, itemDef } from '../../data/items';
import type { GameState } from '../state';
import type { ItemStack } from '../types';
import { addToContainer } from './inventory';
import { baseSellPrice, makeItem, rollEquipment } from './loot';

/** Офлайн-аукцион «Золотые весы» в Альтенбурге (GDD §11.4). Торгует через Ливию Кроу. */

export interface NpcLot {
  id: string;
  stack: ItemStack;
  seller: string;
  /** Текущая ставка. */
  bid: number;
  buyout: number;
  /** Последний день торгов (totalDays): лот закрывается в полночь. */
  ends: number;
  /** Ставка героя (золото уже удержано), 0 — нет. */
  mine: number;
}

export interface MyLot {
  id: string;
  stack: ItemStack;
  start: number;
  buyout: number;
  bid: number;
  bids: number;
  ends: number;
  deposit: number;
}

export interface AuctionState {
  lots: NpcLot[];
  mine: MyLot[];
  /** Почта: купленное, выигранное и непроданное. Забирается у Ливии. */
  mail: ItemStack[];
  /** Медиана цен по дням: предмет → последние 14 значений. */
  history: Record<string, number[]>;
  /** День последней генерации лотов. */
  day: number;
}

export const COMMISSION = 0.1;
export const DEPOSIT = 0.05;
export const HISTORY_DAYS = 14;

const SELLERS = ['Гильдия Серебряного Ключа', 'Барон Лейтон', 'Дом Мирабель', 'Караван Хаззара', 'Вдова Оквуд', 'Братья Фенч', 'Маркиз Ардейн', 'Старьёвщик Коль'];
const SELLERS_EN = ['Silver Key Guild', 'Baron Leighton', 'House Mirabel', "Hazzar's Caravan", 'Widow Oakwood', 'The Fench Brothers', 'Marquis Ardain', 'Kohl the Ragman'];

export function newAuctionState(): AuctionState {
  return { lots: [], mine: [], mail: [], history: {}, day: 0 };
}

/** Рыночная стоимость лота на аукционе (без сезонности и спроса города). */
export function auctionValue(stack: ItemStack): number {
  return Math.max(3, Math.round(baseSellPrice(stack) * 2 * stack.qty));
}

export function sellerName(lot: NpcLot, lang: 'ru' | 'en'): string {
  const i = SELLERS.indexOf(lot.seller);
  return lang === 'en' && i >= 0 ? SELLERS_EN[i]! : lot.seller;
}

export const minBid = (lot: NpcLot) => Math.max(lot.bid + 1, Math.ceil(lot.bid * 1.05));

function pushHistory(a: AuctionState, def: string, price: number): void {
  const h = (a.history[def] ??= []);
  h.push(Math.round(price));
  if (h.length > HISTORY_DAYS) h.splice(0, h.length - HISTORY_DAYS);
}

function progressTier(s: GameState): number {
  return Math.max(1, Math.min(7, Math.ceil(Math.max(1, s.dungeon.deepest) / 10)));
}

/** Новые лоты на сегодня: 5–15 штук по сезону и прогрессу. */
function generateLots(s: GameState, rng: Rng): NpcLot[] {
  const tier = progressTier(s);
  const n = rng.int(5, 15);
  const mats = Object.values(ITEMS).filter((d) => d.kind === 'material' && d.tier !== undefined && d.tier <= tier && d.tier >= tier - 1 && !d.tags?.includes('shard'));
  const cons = Object.values(ITEMS).filter((d) => d.kind === 'consumable' && d.price > 0);
  const lots: NpcLot[] = [];
  for (let i = 0; i < n; i++) {
    const r = rng.next();
    let stack: ItemStack;
    if (r < 0.55) stack = rollEquipment(rng, { floor: Math.max(1, s.dungeon.deepest), tier, luck: 10 }, 2, 1);
    else if (r < 0.85 && mats.length) stack = makeItem(rng, rng.pick(mats).id, 0, rng.int(3, 10));
    else stack = makeItem(rng, rng.pick(cons).id, 0, rng.int(2, 5));
    const v = auctionValue(stack);
    const buyout = Math.round(v * rng.range(0.85, 1.45));
    lots.push({ id: makeUid(rng), stack, seller: rng.pick(SELLERS), bid: Math.round(buyout * rng.range(0.45, 0.7)), buyout, ends: s.time.totalDays + rng.int(0, 2), mine: 0 });
    const unit = buyout / stack.qty;
    // новый для рынка предмет: неделя «прошлых» торгов вокруг текущей цены
    if (!s.auction.history[stack.def]) {
      let p = unit * rng.range(0.85, 1.15);
      for (let k = 0; k < 7; k++) {
        pushHistory(s.auction, stack.def, p);
        p = Math.max(1, p * rng.range(0.92, 1.09));
      }
    }
    pushHistory(s.auction, stack.def, unit);
  }
  return lots;
}

export interface NightReport {
  won: string[];
  outbid: number;
  sold: { def: string; price: number }[];
  returned: number;
}

/**
 * Полночь на аукционе: закрыть лоты, сделать ставки NPC по нашим лотам, выставить новые.
 * Вызывается после смены дня (s.time.totalDays — уже новый день).
 */
export function auctionNight(s: GameState): NightReport {
  const a = s.auction;
  const today = s.time.totalDays;
  const rng = new Rng(hashSeed(s.seed, 'auction', today));
  const rep: NightReport = { won: [], outbid: 0, sold: [], returned: 0 };

  // лоты NPC: истёкшие закрываются, ставки героя либо выигрывают, либо перебиваются
  const keep: NpcLot[] = [];
  for (const lot of a.lots) {
    if (lot.mine > 0) {
      const v = auctionValue(lot.stack);
      const outbidChance = Math.max(0.05, Math.min(0.9, 1.2 - lot.mine / v));
      if (rng.chance(outbidChance)) {
        s.hero.gold += lot.mine;
        lot.bid = Math.round(lot.mine * rng.range(1.05, 1.2));
        lot.mine = 0;
        rep.outbid++;
      } else if (lot.ends < today) {
        a.mail.push(lot.stack);
        rep.won.push(lot.stack.def);
        pushHistory(a, lot.stack.def, lot.mine / lot.stack.qty);
        continue;
      }
    }
    if (lot.ends >= today) keep.push(lot);
  }

  // наши лоты: ночные покупатели
  const mine: MyLot[] = [];
  for (const lot of a.mine) {
    const v = auctionValue(lot.stack);
    let sold = 0;
    if (lot.buyout > 0 && rng.chance(Math.max(0, Math.min(0.85, 0.5 + (1.1 - lot.buyout / v))))) sold = lot.buyout;
    else if (rng.chance(Math.max(0.08, Math.min(0.9, 1.3 - Math.max(lot.start, lot.bid) / v)))) {
      lot.bid = Math.round(Math.min(Math.max(lot.start, lot.bid * 1.12), Math.max(lot.start, v * 1.2)));
      lot.bids++;
    }
    if (!sold && lot.ends < today && lot.bids > 0) sold = lot.bid;
    if (sold) {
      s.hero.gold += Math.round(sold * (1 - COMMISSION)) + lot.deposit;
      rep.sold.push({ def: lot.stack.def, price: sold });
      pushHistory(a, lot.stack.def, sold / lot.stack.qty);
      s.stats.auctionSales = (s.stats.auctionSales ?? 0) + 1;
      continue;
    }
    if (lot.ends < today) {
      a.mail.push(lot.stack); // залог не возвращается
      rep.returned++;
      continue;
    }
    mine.push(lot);
  }
  a.mine = mine;
  a.lots = [...keep, ...generateLots(s, rng)];
  a.day = today;
  return rep;
}

export function ensureLots(s: GameState): void {
  if (s.auction.day !== s.time.totalDays || !s.auction.lots.length) {
    const rng = new Rng(hashSeed(s.seed, 'auction', s.time.totalDays, 'init'));
    s.auction.lots = [...s.auction.lots.filter((l) => l.ends >= s.time.totalDays), ...generateLots(s, rng)];
    s.auction.day = s.time.totalDays;
  }
}

export function buyout(s: GameState, id: string): boolean {
  const a = s.auction;
  const i = a.lots.findIndex((l) => l.id === id);
  const lot = a.lots[i];
  if (!lot) return false;
  const pay = lot.buyout - lot.mine;
  if (s.hero.gold < pay) return false;
  s.hero.gold -= pay;
  a.lots.splice(i, 1);
  const qty = lot.stack.qty;
  addToContainer(s.inventory, lot.stack);
  if (lot.stack.qty > 0) a.mail.push(lot.stack); // не влезло — остаток на почту
  pushHistory(a, lot.stack.def, lot.buyout / qty);
  return true;
}

export function placeBid(s: GameState, id: string, amount: number): boolean {
  const lot = s.auction.lots.find((l) => l.id === id);
  if (!lot || amount < minBid(lot) || amount >= lot.buyout) return false;
  const extra = amount - lot.mine;
  if (s.hero.gold < extra) return false;
  s.hero.gold -= extra;
  lot.mine = amount;
  lot.bid = amount;
  return true;
}

export function listItem(s: GameState, invIndex: number, start: number, buyoutPrice: number, days: 1 | 2 | 3): MyLot | null {
  const stack = s.inventory[invIndex];
  if (!stack || itemDef(stack.def).kind === 'quest') return null;
  start = Math.max(1, Math.round(start));
  buyoutPrice = Math.round(buyoutPrice);
  if (buyoutPrice > 0 && buyoutPrice < start) return null;
  const deposit = Math.max(1, Math.ceil(start * DEPOSIT));
  if (s.hero.gold < deposit || s.auction.mine.length >= 6) return null;
  s.hero.gold -= deposit;
  s.inventory[invIndex] = null;
  const lot: MyLot = { id: stack.uid, stack, start, buyout: buyoutPrice, bid: 0, bids: 0, ends: s.time.totalDays + days - 1, deposit };
  s.auction.mine.push(lot);
  return lot;
}

/** Снять лот без ставок: вещь на почту, залог сгорает. */
export function cancelLot(s: GameState, id: string): boolean {
  const i = s.auction.mine.findIndex((l) => l.id === id);
  const lot = s.auction.mine[i];
  if (!lot || lot.bids > 0) return false;
  s.auction.mine.splice(i, 1);
  s.auction.mail.push(lot.stack);
  return true;
}

/** Забрать почту в рюкзак (сколько влезет). */
export function collectMail(s: GameState): number {
  let n = 0;
  const rest: ItemStack[] = [];
  for (const st of s.auction.mail) {
    const q = st.qty;
    addToContainer(s.inventory, st);
    if (st.qty > 0) rest.push(st);
    if (st.qty < q) n++;
  }
  s.auction.mail = rest;
  return n;
}

export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const a = [...xs].sort((p, q) => p - q);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m]! : Math.round((a[m - 1]! + a[m]!) / 2);
}

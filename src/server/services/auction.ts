import { randomUUID } from 'node:crypto';
import { ITEMS, itemDef } from '../../data/items';
import type { LotDTO } from '../../online/protocol';
import { ApiError } from '../auth';
import type { Db } from '../db';
import { addGold, getItem, itemDTO, moveItem, sendMail, type ItemRow } from './hero';

/** Аукционный дом «Золотые весы» — онлайн (GDD §12.2). */

export const DURATIONS_H = [12, 24, 48] as const;
export const DEPOSIT = 0.02;
export const FEE = 0.08;
export const MIN_STEP = 0.05;
export const SNIPE_WINDOW = 5 * 60_000;
export const MAX_LOTS = 20;
const DAY = 86_400_000;

interface LotRow {
  id: string;
  seller_id: string;
  item_uid: string;
  def: string;
  rarity: number;
  qty: number;
  start_bid: number;
  buyout: number | null;
  current_bid: number;
  bidder_id: string | null;
  ends_at: number;
  status: 'active' | 'sold' | 'expired' | 'cancelled';
  created_at: number;
}

const lot = (db: Db, id: string): LotRow => {
  const l = db.get<LotRow>('SELECT * FROM auction_lots WHERE id = ?', id);
  if (!l) throw new ApiError(404, 'no_lot');
  return l;
};

export const minNextBid = (l: { start_bid: number; current_bid: number; bidder_id: string | null }) =>
  l.bidder_id ? Math.max(l.current_bid + 1, Math.ceil(l.current_bid * (1 + MIN_STEP))) : l.start_bid;

/** Выставить лот: предмет уходит в эскроу, залог 2 % сгорает. */
export function listLot(db: Db, heroId: string, uid: string, startBid: number, buyout: number | null, hours: number, now: number, requestId: string | null): string {
  if (!DURATIONS_H.includes(hours as 12)) throw new ApiError(400, 'bad_duration');
  if (!Number.isInteger(startBid) || startBid < 1 || startBid > 1e9) throw new ApiError(400, 'bad_price');
  if (buyout !== null && (!Number.isInteger(buyout) || buyout < startBid || buyout > 1e9)) throw new ApiError(400, 'bad_buyout');
  return db.tx(() => {
    const active = db.get<{ n: number }>("SELECT COUNT(*) AS n FROM auction_lots WHERE seller_id = ? AND status = 'active'", heroId)!.n;
    if (active >= MAX_LOTS) throw new ApiError(429, 'too_many_lots');
    const it = getItem(db, uid);
    if (itemDef(it.def).kind === 'quest') throw new ApiError(400, 'not_tradeable');
    const id = randomUUID();
    const deposit = Math.max(1, Math.ceil(startBid * DEPOSIT));
    addGold(db, heroId, -deposit, 'auction_deposit', id, now);
    moveItem(db, uid, ['hero', heroId], ['escrow', id], 'auction_list', requestId, now);
    db.run(
      `INSERT INTO auction_lots (id, seller_id, item_uid, def, rarity, qty, start_bid, buyout, current_bid, bidder_id, ends_at, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, 'active', ?)`,
      id, heroId, uid, it.def, it.rarity, it.qty, startBid, buyout, now + hours * 3_600_000, now,
    );
    return id;
  });
}

/** Ставка: золото замораживается, прежний лидер получает своё обратно сразу. */
export function placeBid(db: Db, heroId: string, lotId: string, amount: number, now: number): { endsAt: number } {
  if (!Number.isInteger(amount) || amount < 1) throw new ApiError(400, 'bad_amount');
  return db.tx(() => {
    const l = lot(db, lotId);
    if (l.status !== 'active' || l.ends_at <= now) throw new ApiError(409, 'lot_closed');
    if (l.seller_id === heroId) throw new ApiError(403, 'own_lot');
    if (l.buyout !== null && amount >= l.buyout) throw new ApiError(400, 'use_buyout');
    if (amount < minNextBid(l)) throw new ApiError(400, 'bid_too_low');
    const extra = l.bidder_id === heroId ? amount - l.current_bid : amount;
    addGold(db, heroId, -extra, 'auction_bid', lotId, now);
    if (l.bidder_id && l.bidder_id !== heroId) addGold(db, l.bidder_id, l.current_bid, 'auction_outbid', lotId, now);
    // анти-снайпинг: ставка в последние 5 минут продлевает лот на 5 минут
    const endsAt = l.ends_at - now < SNIPE_WINDOW ? l.ends_at + SNIPE_WINDOW : l.ends_at;
    db.run('UPDATE auction_lots SET current_bid = ?, bidder_id = ?, ends_at = ? WHERE id = ?', amount, heroId, endsAt, lotId);
    db.run('INSERT INTO auction_bids (lot_id, bidder_id, amount, at) VALUES (?, ?, ?, ?)', lotId, heroId, amount, now);
    return { endsAt };
  });
}

function closeSold(db: Db, l: LotRow, buyerId: string, price: number, now: number): void {
  moveItem(db, l.item_uid, ['escrow', l.id], ['mail', buyerId], 'auction_won', null, now);
  sendMail(db, buyerId, `auction_won:${l.def}`, now, 0, l.item_uid);
  const fee = Math.floor(price * FEE);
  sendMail(db, l.seller_id, `auction_sold:${l.def}`, now, price - fee);
  db.run("UPDATE auction_lots SET status = 'sold', current_bid = ?, bidder_id = ? WHERE id = ?", price, buyerId, l.id);
  const flagged = washTrade(db, l, buyerId, price, now) ? 1 : 0;
  db.run('INSERT INTO sales (def, rarity, qty, price, day, seller_id, buyer_id, flagged, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    l.def, l.rarity, l.qty, price, Math.floor(now / DAY), l.seller_id, buyerId, flagged, now);
}

/** Выкуп: мгновенная покупка по цене выкупа. */
export function buyoutLot(db: Db, heroId: string, lotId: string, now: number): void {
  db.tx(() => {
    const l = lot(db, lotId);
    if (l.status !== 'active' || l.ends_at <= now) throw new ApiError(409, 'lot_closed');
    if (l.buyout === null) throw new ApiError(400, 'no_buyout');
    if (l.seller_id === heroId) throw new ApiError(403, 'own_lot');
    const already = l.bidder_id === heroId ? l.current_bid : 0;
    addGold(db, heroId, -(l.buyout - already), 'auction_buyout', lotId, now);
    if (l.bidder_id && l.bidder_id !== heroId) addGold(db, l.bidder_id, l.current_bid, 'auction_outbid', lotId, now);
    closeSold(db, l, heroId, l.buyout, now);
  });
}

/** Снять лот можно, только пока на него нет ставок. Залог не возвращается. */
export function cancelLot(db: Db, heroId: string, lotId: string, now: number): void {
  db.tx(() => {
    const l = lot(db, lotId);
    if (l.seller_id !== heroId) throw new ApiError(403, 'not_yours');
    if (l.status !== 'active') throw new ApiError(409, 'lot_closed');
    if (l.bidder_id) throw new ApiError(409, 'has_bids');
    moveItem(db, l.item_uid, ['escrow', l.id], ['mail', heroId], 'auction_cancel', null, now);
    sendMail(db, heroId, `auction_cancelled:${l.def}`, now, 0, l.item_uid);
    db.run("UPDATE auction_lots SET status = 'cancelled' WHERE id = ?", l.id);
  });
}

/** Закрыть истёкшие лоты (вызывается таймером сервера). */
export function settleAuctions(db: Db, now: number): { sold: number; expired: number } {
  let sold = 0, expired = 0;
  const due = db.all<LotRow>("SELECT * FROM auction_lots WHERE status = 'active' AND ends_at <= ?", now);
  for (const l of due) {
    db.tx(() => {
      if (l.bidder_id) {
        closeSold(db, l, l.bidder_id, l.current_bid, now);
        sold++;
      } else {
        moveItem(db, l.item_uid, ['escrow', l.id], ['mail', l.seller_id], 'auction_expired', null, now);
        sendMail(db, l.seller_id, `auction_expired:${l.def}`, now, 0, l.item_uid);
        db.run("UPDATE auction_lots SET status = 'expired' WHERE id = ?", l.id);
        expired++;
      }
    });
  }
  return { sold, expired };
}

/**
 * Детектор круговых сделок: цена сильно отличается от медианы, а покупатель и продавец
 * уже торговали друг с другом за неделю — сделка помечается для аудита.
 */
function washTrade(db: Db, l: LotRow, buyerId: string, price: number, now: number): boolean {
  const med = medianPrice(db, l.def, l.rarity, now);
  if (!med) return false;
  const unit = price / l.qty;
  if (unit < med * 4 && unit > med * 0.25) return false;
  const pairs = db.get<{ n: number }>(
    'SELECT COUNT(*) AS n FROM sales WHERE at > ? AND ((seller_id = ? AND buyer_id = ?) OR (seller_id = ? AND buyer_id = ?))',
    now - 7 * DAY, l.seller_id, buyerId, buyerId, l.seller_id,
  )!.n;
  return pairs >= 1;
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const a = [...xs].sort((p, q) => p - q);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m]! : (a[m - 1]! + a[m]!) / 2;
}

export function medianPrice(db: Db, def: string, rarity: number, now: number, days = 14): number {
  const rows = db.all<{ price: number; qty: number }>('SELECT price, qty FROM sales WHERE def = ? AND rarity = ? AND at > ? AND flagged = 0', def, rarity, now - days * DAY);
  return median(rows.map((r) => r.price / r.qty));
}

/** История цен по дням: медиана за штуку и объём. */
export function priceHistory(db: Db, def: string, rarity: number, now: number, days = 14): { day: number; median: number; volume: number }[] {
  const rows = db.all<{ price: number; qty: number; day: number }>(
    'SELECT price, qty, day FROM sales WHERE def = ? AND rarity = ? AND at > ? AND flagged = 0 ORDER BY day', def, rarity, now - days * DAY);
  const byDay = new Map<number, number[]>();
  for (const r of rows) (byDay.get(r.day) ?? byDay.set(r.day, []).get(r.day)!).push(r.price / r.qty);
  return [...byDay.entries()].map(([day, xs]) => ({ day, median: Math.round(median(xs)), volume: xs.length }));
}

export interface LotQuery {
  def?: string;
  kind?: string;
  minRarity?: number;
  mine?: boolean;
  sort?: 'ends' | 'price' | 'new';
  page?: number;
}

export function searchLots(db: Db, heroId: string, q: LotQuery, now: number): LotDTO[] {
  const where = ["l.status = 'active'", 'l.ends_at > ?'];
  const args: (string | number)[] = [now];
  if (q.def) {
    where.push('l.def = ?');
    args.push(q.def);
  }
  if (q.kind) {
    const defs = Object.values(ITEMS).filter((d) => d.kind === q.kind).map((d) => d.id);
    if (!defs.length) return [];
    where.push(`l.def IN (${defs.map(() => '?').join(',')})`);
    args.push(...defs);
  }
  if (q.minRarity) {
    where.push('l.rarity >= ?');
    args.push(q.minRarity);
  }
  if (q.mine) {
    where.push('(l.seller_id = ? OR l.bidder_id = ?)');
    args.push(heroId, heroId);
  }
  const order = q.sort === 'price' ? 'COALESCE(NULLIF(l.current_bid, 0), l.start_bid) ASC' : q.sort === 'new' ? 'l.created_at DESC' : 'l.ends_at ASC';
  const page = Math.max(0, q.page ?? 0);
  const rows = db.all<LotRow & ItemRow & { seller_name: string }>(
    `SELECT l.*, i.uid, i.affixes, i.upgrade, i.owner_kind, i.owner_id, i.slot, h.name AS seller_name
     FROM auction_lots l JOIN items i ON i.uid = l.item_uid JOIN heroes h ON h.id = l.seller_id
     WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT 30 OFFSET ?`,
    ...args, page * 30,
  );
  return rows.map((r) => ({
    id: r.id, seller: r.seller_name, item: itemDTO(r), startBid: r.start_bid, buyout: r.buyout, currentBid: r.current_bid,
    mine: r.seller_id === heroId, leading: r.bidder_id === heroId, endsAt: r.ends_at,
  }));
}

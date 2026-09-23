import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

/**
 * Серверная БД на встроенном SQLite (node:sqlite, синхронный API).
 * Все изменения ценностей идут внутри tx(): BEGIN IMMEDIATE … COMMIT, при ошибке — ROLLBACK.
 * Уникальность item.uid и CHECK(gold >= 0) страхуют от дюпа и ухода в минус на уровне БД.
 */

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY, device_id TEXT UNIQUE, email TEXT UNIQUE COLLATE NOCASE, pass_hash TEXT,
    created_at INTEGER NOT NULL, banned INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS heroes (
    id TEXT PRIMARY KEY, account_id TEXT NOT NULL UNIQUE REFERENCES accounts(id),
    name TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE, cls TEXT NOT NULL, level INTEGER NOT NULL DEFAULT 1, xp INTEGER NOT NULL DEFAULT 0,
    gold INTEGER NOT NULL DEFAULT 0 CHECK (gold >= 0), karma INTEGER NOT NULL DEFAULT 0,
    rating REAL NOT NULL DEFAULT 1500, rd REAL NOT NULL DEFAULT 350, vol REAL NOT NULL DEFAULT 0.06,
    wins INTEGER NOT NULL DEFAULT 0, losses INTEGER NOT NULL DEFAULT 0, waves_best INTEGER NOT NULL DEFAULT 0,
    tokens INTEGER NOT NULL DEFAULT 0, class_xp TEXT NOT NULL DEFAULT '{}', talents TEXT NOT NULL DEFAULT '[]',
    last_seen INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS items (
    uid TEXT PRIMARY KEY, def TEXT NOT NULL, qty INTEGER NOT NULL CHECK (qty > 0), rarity INTEGER NOT NULL DEFAULT 0,
    affixes TEXT NOT NULL DEFAULT '[]', upgrade INTEGER NOT NULL DEFAULT 0,
    owner_kind TEXT NOT NULL CHECK (owner_kind IN ('hero','equip','escrow','guild','mail')),
    owner_id TEXT NOT NULL, slot TEXT)`,
  `CREATE INDEX IF NOT EXISTS items_owner ON items(owner_kind, owner_id)`,
  `CREATE TABLE IF NOT EXISTS item_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT, uid TEXT NOT NULL, from_kind TEXT, from_id TEXT, to_kind TEXT, to_id TEXT,
    reason TEXT NOT NULL, request_id TEXT, at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS gold_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT, hero_id TEXT NOT NULL, delta INTEGER NOT NULL, reason TEXT NOT NULL, ref TEXT, at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS requests (account_id TEXT NOT NULL, id TEXT NOT NULL, response TEXT NOT NULL, at INTEGER NOT NULL,
    PRIMARY KEY (account_id, id))`,
  `CREATE TABLE IF NOT EXISTS mail (
    id INTEGER PRIMARY KEY AUTOINCREMENT, hero_id TEXT NOT NULL, gold INTEGER NOT NULL DEFAULT 0, item_uid TEXT, note TEXT NOT NULL, at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS auction_lots (
    id TEXT PRIMARY KEY, seller_id TEXT NOT NULL, item_uid TEXT NOT NULL UNIQUE, def TEXT NOT NULL, rarity INTEGER NOT NULL, qty INTEGER NOT NULL,
    start_bid INTEGER NOT NULL, buyout INTEGER, current_bid INTEGER NOT NULL DEFAULT 0, bidder_id TEXT,
    ends_at INTEGER NOT NULL, status TEXT NOT NULL CHECK (status IN ('active','sold','expired','cancelled')), created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS lots_active ON auction_lots(status, ends_at)`,
  `CREATE TABLE IF NOT EXISTS auction_bids (id INTEGER PRIMARY KEY AUTOINCREMENT, lot_id TEXT NOT NULL, bidder_id TEXT NOT NULL, amount INTEGER NOT NULL, at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sales (id INTEGER PRIMARY KEY AUTOINCREMENT, def TEXT NOT NULL, rarity INTEGER NOT NULL, qty INTEGER NOT NULL,
    price INTEGER NOT NULL, day INTEGER NOT NULL, seller_id TEXT NOT NULL, buyer_id TEXT NOT NULL, flagged INTEGER NOT NULL DEFAULT 0, at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS guilds (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE, tag TEXT NOT NULL, tag_key TEXT NOT NULL UNIQUE, crest TEXT NOT NULL,
    hall INTEGER NOT NULL DEFAULT 1, treasury INTEGER NOT NULL DEFAULT 0 CHECK (treasury >= 0), created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS guild_members (hero_id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, rank INTEGER NOT NULL, joined_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS guild_ranks (guild_id TEXT NOT NULL, rank INTEGER NOT NULL, title TEXT NOT NULL, perms INTEGER NOT NULL,
    daily_withdraw INTEGER NOT NULL, PRIMARY KEY (guild_id, rank))`,
  `CREATE TABLE IF NOT EXISTS guild_invites (guild_id TEXT NOT NULL, hero_id TEXT NOT NULL, by_id TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (guild_id, hero_id))`,
  `CREATE TABLE IF NOT EXISTS guild_withdrawals (guild_id TEXT NOT NULL, hero_id TEXT NOT NULL, day INTEGER NOT NULL, amount INTEGER NOT NULL,
    PRIMARY KEY (guild_id, hero_id, day))`,
  `CREATE TABLE IF NOT EXISTS guild_log (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, hero_id TEXT, action TEXT NOT NULL, payload TEXT NOT NULL, at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS guild_chat (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, hero_id TEXT NOT NULL, name TEXT NOT NULL, text TEXT NOT NULL, at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS territories (id INTEGER PRIMARY KEY, name TEXT NOT NULL, owner_guild TEXT, since INTEGER)`,
  `CREATE TABLE IF NOT EXISTS territory_points (territory_id INTEGER NOT NULL, guild_id TEXT NOT NULL, week INTEGER NOT NULL, points INTEGER NOT NULL,
    PRIMARY KEY (territory_id, guild_id, week))`,
  `CREATE TABLE IF NOT EXISTS matches (id TEXT PRIMARY KEY, mode TEXT NOT NULL, ranked INTEGER NOT NULL, started_at INTEGER NOT NULL, ended_at INTEGER, result TEXT)`,
  `CREATE TABLE IF NOT EXISTS bounties (target_id TEXT PRIMARY KEY, amount INTEGER NOT NULL CHECK (amount >= 0), updated_at INTEGER NOT NULL)`,
];

/** Ключ уникальности имён: регистр и «ё» не различаются (SQLite NOCASE понимает только ASCII). */
export const nameKey = (s: string) => s.trim().toLocaleLowerCase('ru').replace(/ё/g, 'е');

export class Db {
  readonly raw: DatabaseSync;
  private depth = 0;

  constructor(path = ':memory:') {
    this.raw = new DatabaseSync(path);
    this.raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    for (const s of SCHEMA) this.raw.exec(s);
  }

  get<T>(sql: string, ...args: SQLInputValue[]): T | undefined {
    return this.raw.prepare(sql).get(...args) as T | undefined;
  }

  all<T>(sql: string, ...args: SQLInputValue[]): T[] {
    return this.raw.prepare(sql).all(...args) as T[];
  }

  run(sql: string, ...args: SQLInputValue[]): { changes: number; lastInsertRowid: number } {
    const r = this.raw.prepare(sql).run(...args);
    return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) };
  }

  /** Атомарная операция. Вложенные вызовы выполняются в той же транзакции. */
  tx<T>(fn: () => T): T {
    if (this.depth > 0) return fn();
    this.raw.exec('BEGIN IMMEDIATE');
    this.depth++;
    try {
      const r = fn();
      this.raw.exec('COMMIT');
      return r;
    } catch (e) {
      this.raw.exec('ROLLBACK');
      throw e;
    } finally {
      this.depth--;
    }
  }

  meta(k: string): string | undefined {
    return this.get<{ v: string }>('SELECT v FROM meta WHERE k = ?', k)?.v;
  }

  setMeta(k: string, v: string): void {
    this.run('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', k, v);
  }

  close(): void {
    this.raw.close();
  }
}

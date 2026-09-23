import { randomUUID } from 'node:crypto';
import { ALL_PERMS, CREST_COLORS, PERM, type Crest, type GuildDTO } from '../../online/protocol';
import { ApiError } from '../auth';
import { nameKey, type Db } from '../db';
import { addGold, heroById, heroByName, INV_SIZE, inventory, itemDTO, moveItem, type ItemRow } from './hero';

/** Гильдии (GDD §12.4). */

export const CREATE_COST = 5000;
export const CLAIM_COST = 1000;
export const TERRITORY_INCOME = 400;
const DAY = 86_400_000;
const WEEK = 7 * DAY;

export const DEFAULT_RANKS: { title: string; perms: number; dailyWithdraw: number }[] = [
  { title: 'Глава', perms: ALL_PERMS, dailyWithdraw: 1e12 },
  { title: 'Офицер', perms: PERM.invite | PERM.kick | PERM.withdraw | PERM.storage | PERM.war, dailyWithdraw: 5000 },
  { title: 'Ветеран', perms: PERM.invite | PERM.storage | PERM.withdraw, dailyWithdraw: 500 },
  { title: 'Боец', perms: PERM.storage, dailyWithdraw: 0 },
  { title: 'Новобранец', perms: 0, dailyWithdraw: 0 },
];

/** 12 территорий Пепельных Пустошей (шахты сердцекамня). */
export const TERRITORIES = [
  'Пепельный брод', 'Чёрная жила', 'Вдовий карьер', 'Серный склон', 'Костяной перевал', 'Разлом Эрдхейма',
  'Стеклянные дюны', 'Сторожевой курган', 'Шахта Бродрика', 'Кузнечный провал', 'Тлеющая падь', 'Корона пустошей',
];

export const hallCost = (level: number) => 10_000 * level;
export const maxMembers = (hall: number) => 10 + hall * 10;
export const storageSize = (hall: number) => 20 + hall * 20;
export const weekOf = (now: number) => Math.floor(now / WEEK);

interface GuildRow {
  id: string;
  name: string;
  tag: string;
  crest: string;
  hall: number;
  treasury: number;
}

interface Member {
  hero_id: string;
  guild_id: string;
  rank: number;
}

export function validCrest(c: unknown): c is Crest {
  const x = c as Crest;
  return !!x && [0, 1, 2, 3].includes(x.shape) && [0, 1, 2, 3, 4].includes(x.division) && x.charge >= 0 && x.charge <= 7 && Number.isInteger(x.charge)
    && Array.isArray(x.colors) && x.colors.length === 2 && x.colors.every((col) => CREST_COLORS.includes(col)) && x.colors[0] !== x.colors[1];
}

const log = (db: Db, guildId: string, heroId: string | null, action: string, payload: unknown, now: number) =>
  db.run('INSERT INTO guild_log (guild_id, hero_id, action, payload, at) VALUES (?, ?, ?, ?, ?)', guildId, heroId, action, JSON.stringify(payload), now);

export function memberOf(db: Db, heroId: string): Member | undefined {
  return db.get<Member>('SELECT * FROM guild_members WHERE hero_id = ?', heroId);
}

function need(db: Db, heroId: string, perm = 0): Member & { perms: number; daily: number } {
  const m = memberOf(db, heroId);
  if (!m) throw new ApiError(404, 'not_in_guild');
  const r = db.get<{ perms: number; daily_withdraw: number }>('SELECT perms, daily_withdraw FROM guild_ranks WHERE guild_id = ? AND rank = ?', m.guild_id, m.rank)!;
  if (perm && !(r.perms & perm)) throw new ApiError(403, 'no_permission');
  return { ...m, perms: r.perms, daily: r.daily_withdraw };
}

const guild = (db: Db, id: string): GuildRow => {
  const g = db.get<GuildRow>('SELECT * FROM guilds WHERE id = ?', id);
  if (!g) throw new ApiError(404, 'no_guild');
  return g;
};

export function createGuild(db: Db, heroId: string, name: string, tag: string, crest: Crest, now: number): string {
  name = name.trim();
  tag = tag.trim();
  if (!/^[\p{L}\d' -]{3,24}$/u.test(name)) throw new ApiError(400, 'bad_name');
  if (!/^[\p{L}\d]{2,4}$/u.test(tag)) throw new ApiError(400, 'bad_tag');
  if (!validCrest(crest)) throw new ApiError(400, 'bad_crest');
  return db.tx(() => {
    if (memberOf(db, heroId)) throw new ApiError(409, 'already_in_guild');
    if (db.get('SELECT id FROM guilds WHERE name_key = ?', nameKey(name))) throw new ApiError(409, 'name_taken');
    if (db.get('SELECT id FROM guilds WHERE tag_key = ?', nameKey(tag))) throw new ApiError(409, 'tag_taken');
    const id = randomUUID();
    addGold(db, heroId, -CREATE_COST, 'guild_create', id, now);
    db.run('INSERT INTO guilds (id, name, name_key, tag, tag_key, crest, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', id, name, nameKey(name), tag.toUpperCase(), nameKey(tag), JSON.stringify(crest), now);
    DEFAULT_RANKS.forEach((r, i) => db.run('INSERT INTO guild_ranks (guild_id, rank, title, perms, daily_withdraw) VALUES (?, ?, ?, ?, ?)', id, i, r.title, r.perms, r.dailyWithdraw));
    db.run('INSERT INTO guild_members (hero_id, guild_id, rank, joined_at) VALUES (?, ?, 0, ?)', heroId, id, now);
    log(db, id, heroId, 'create', { name, tag }, now);
    return id;
  });
}

export function invite(db: Db, heroId: string, targetName: string, now: number): void {
  db.tx(() => {
    const m = need(db, heroId, PERM.invite);
    const t = heroByName(db, targetName);
    if (memberOf(db, t.id)) throw new ApiError(409, 'target_in_guild');
    db.run('INSERT OR REPLACE INTO guild_invites (guild_id, hero_id, by_id, at) VALUES (?, ?, ?, ?)', m.guild_id, t.id, heroId, now);
    log(db, m.guild_id, heroId, 'invite', { hero: t.name }, now);
  });
}

export function invitesFor(db: Db, heroId: string): { guildId: string; name: string; tag: string }[] {
  return db.all('SELECT g.id AS guildId, g.name, g.tag FROM guild_invites i JOIN guilds g ON g.id = i.guild_id WHERE i.hero_id = ?', heroId);
}

export function acceptInvite(db: Db, heroId: string, guildId: string, now: number): void {
  db.tx(() => {
    if (memberOf(db, heroId)) throw new ApiError(409, 'already_in_guild');
    if (!db.get('SELECT 1 FROM guild_invites WHERE guild_id = ? AND hero_id = ?', guildId, heroId)) throw new ApiError(403, 'not_invited');
    const g = guild(db, guildId);
    const n = db.get<{ n: number }>('SELECT COUNT(*) AS n FROM guild_members WHERE guild_id = ?', guildId)!.n;
    if (n >= maxMembers(g.hall)) throw new ApiError(409, 'guild_full');
    db.run('DELETE FROM guild_invites WHERE hero_id = ?', heroId);
    db.run('INSERT INTO guild_members (hero_id, guild_id, rank, joined_at) VALUES (?, ?, 4, ?)', heroId, guildId, now);
    log(db, guildId, heroId, 'join', {}, now);
  });
}

export function leave(db: Db, heroId: string, now: number): void {
  db.tx(() => {
    const m = need(db, heroId);
    const others = db.get<{ n: number }>('SELECT COUNT(*) AS n FROM guild_members WHERE guild_id = ? AND hero_id <> ?', m.guild_id, heroId)!.n;
    if (m.rank === 0 && others > 0) throw new ApiError(409, 'transfer_leadership_first');
    db.run('DELETE FROM guild_members WHERE hero_id = ?', heroId);
    log(db, m.guild_id, heroId, 'leave', {}, now);
    if (others === 0) disband(db, m.guild_id, heroId, now);
  });
}

/** Роспуск: казна и хранилище возвращаются последнему главе на почту. */
function disband(db: Db, guildId: string, heroId: string, now: number): void {
  const g = guild(db, guildId);
  if (g.treasury > 0) db.run('INSERT INTO mail (hero_id, gold, note, at) VALUES (?, ?, ?, ?)', heroId, g.treasury, 'guild_disband', now);
  for (const it of db.all<ItemRow>("SELECT * FROM items WHERE owner_kind = 'guild' AND owner_id = ?", guildId)) {
    moveItem(db, it.uid, ['guild', guildId], ['mail', heroId], 'guild_disband', null, now);
    db.run('INSERT INTO mail (hero_id, item_uid, note, at) VALUES (?, ?, ?, ?)', heroId, it.uid, 'guild_disband', now);
  }
  db.run('DELETE FROM guild_ranks WHERE guild_id = ?', guildId);
  db.run('DELETE FROM guild_invites WHERE guild_id = ?', guildId);
  db.run('UPDATE territories SET owner_guild = NULL WHERE owner_guild = ?', guildId);
  db.run('DELETE FROM guilds WHERE id = ?', guildId);
}

export function kick(db: Db, heroId: string, targetId: string, now: number): void {
  db.tx(() => {
    const m = need(db, heroId, PERM.kick);
    const t = memberOf(db, targetId);
    if (!t || t.guild_id !== m.guild_id) throw new ApiError(404, 'not_member');
    if (t.rank <= m.rank) throw new ApiError(403, 'rank_too_high');
    db.run('DELETE FROM guild_members WHERE hero_id = ?', targetId);
    log(db, m.guild_id, heroId, 'kick', { hero: heroById(db, targetId).name }, now);
  });
}

/** Сменить ранг. Глава, назначая нового главу, сам становится офицером. */
export function setRank(db: Db, heroId: string, targetId: string, rank: number, now: number): void {
  if (!Number.isInteger(rank) || rank < 0 || rank > 4) throw new ApiError(400, 'bad_rank');
  db.tx(() => {
    const m = need(db, heroId, PERM.ranks);
    const t = memberOf(db, targetId);
    if (!t || t.guild_id !== m.guild_id || targetId === heroId) throw new ApiError(404, 'not_member');
    if (t.rank <= m.rank && m.rank !== 0) throw new ApiError(403, 'rank_too_high');
    if (rank <= m.rank && m.rank !== 0) throw new ApiError(403, 'rank_too_high');
    if (rank === 0) db.run('UPDATE guild_members SET rank = 1 WHERE hero_id = ?', heroId);
    db.run('UPDATE guild_members SET rank = ? WHERE hero_id = ?', rank, targetId);
    log(db, m.guild_id, heroId, 'rank', { hero: heroById(db, targetId).name, rank }, now);
  });
}

export function setRankPerms(db: Db, heroId: string, rank: number, title: string, perms: number, dailyWithdraw: number, now: number): void {
  if (rank < 1 || rank > 4) throw new ApiError(400, 'bad_rank');
  if (!Number.isInteger(perms) || perms < 0 || perms > ALL_PERMS) throw new ApiError(400, 'bad_perms');
  if (!Number.isInteger(dailyWithdraw) || dailyWithdraw < 0) throw new ApiError(400, 'bad_amount');
  title = title.trim().slice(0, 16) || DEFAULT_RANKS[rank]!.title;
  db.tx(() => {
    const m = need(db, heroId, PERM.ranks);
    if (rank <= m.rank) throw new ApiError(403, 'rank_too_high');
    db.run('UPDATE guild_ranks SET title = ?, perms = ?, daily_withdraw = ? WHERE guild_id = ? AND rank = ?', title, perms, dailyWithdraw, m.guild_id, rank);
    log(db, m.guild_id, heroId, 'perms', { rank, title, perms, dailyWithdraw }, now);
  });
}

export function deposit(db: Db, heroId: string, amount: number, now: number): void {
  if (!Number.isInteger(amount) || amount <= 0) throw new ApiError(400, 'bad_amount');
  db.tx(() => {
    const m = need(db, heroId);
    addGold(db, heroId, -amount, 'guild_deposit', m.guild_id, now);
    db.run('UPDATE guilds SET treasury = treasury + ? WHERE id = ?', amount, m.guild_id);
    log(db, m.guild_id, heroId, 'deposit', { amount }, now);
  });
}

export function withdraw(db: Db, heroId: string, amount: number, now: number): void {
  if (!Number.isInteger(amount) || amount <= 0) throw new ApiError(400, 'bad_amount');
  db.tx(() => {
    const m = need(db, heroId, PERM.withdraw);
    const day = Math.floor(now / DAY);
    const used = db.get<{ amount: number }>('SELECT amount FROM guild_withdrawals WHERE guild_id = ? AND hero_id = ? AND day = ?', m.guild_id, heroId, day)?.amount ?? 0;
    if (used + amount > m.daily) throw new ApiError(403, 'daily_limit');
    const r = db.run('UPDATE guilds SET treasury = treasury - ? WHERE id = ? AND treasury >= ?', amount, m.guild_id, amount);
    if (!r.changes) throw new ApiError(409, 'treasury_empty');
    addGold(db, heroId, amount, 'guild_withdraw', m.guild_id, now);
    db.run(`INSERT INTO guild_withdrawals (guild_id, hero_id, day, amount) VALUES (?, ?, ?, ?)
            ON CONFLICT(guild_id, hero_id, day) DO UPDATE SET amount = amount + excluded.amount`, m.guild_id, heroId, day, amount);
    log(db, m.guild_id, heroId, 'withdraw', { amount }, now);
  });
}

export function storagePut(db: Db, heroId: string, uid: string, now: number): void {
  db.tx(() => {
    const m = need(db, heroId);
    const g = guild(db, m.guild_id);
    const n = db.get<{ n: number }>("SELECT COUNT(*) AS n FROM items WHERE owner_kind = 'guild' AND owner_id = ?", g.id)!.n;
    if (n >= storageSize(g.hall)) throw new ApiError(409, 'storage_full');
    moveItem(db, uid, ['hero', heroId], ['guild', g.id], 'guild_put', null, now);
    log(db, g.id, heroId, 'put', { uid }, now);
  });
}

export function storageTake(db: Db, heroId: string, uid: string, now: number): void {
  db.tx(() => {
    const m = need(db, heroId, PERM.storage);
    if (inventory(db, heroId).length >= INV_SIZE) throw new ApiError(409, 'inventory_full');
    moveItem(db, uid, ['guild', m.guild_id], ['hero', heroId], 'guild_take', null, now);
    log(db, m.guild_id, heroId, 'take', { uid }, now);
  });
}

export function setCrest(db: Db, heroId: string, crest: Crest, now: number): void {
  if (!validCrest(crest)) throw new ApiError(400, 'bad_crest');
  db.tx(() => {
    const m = need(db, heroId, PERM.crest);
    db.run('UPDATE guilds SET crest = ? WHERE id = ?', JSON.stringify(crest), m.guild_id);
    log(db, m.guild_id, heroId, 'crest', crest, now);
  });
}

/** Гильдейский зал 1–5: больше мест и хранилище. Платит казна. */
export function upgradeHall(db: Db, heroId: string, now: number): number {
  return db.tx(() => {
    const m = need(db, heroId, PERM.war);
    const g = guild(db, m.guild_id);
    if (g.hall >= 5) throw new ApiError(409, 'max_level');
    const cost = hallCost(g.hall);
    const r = db.run('UPDATE guilds SET treasury = treasury - ?, hall = hall + 1 WHERE id = ? AND treasury >= ?', cost, g.id, cost);
    if (!r.changes) throw new ApiError(409, 'treasury_empty');
    log(db, g.id, heroId, 'hall', { level: g.hall + 1, cost }, now);
    return g.hall + 1;
  });
}

// ───── Чат ─────

export function postChat(db: Db, heroId: string, text: string, now: number): { name: string; text: string; at: number; guildId: string } {
  const m = need(db, heroId);
  const clean = text.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 200);
  if (!clean) throw new ApiError(400, 'empty');
  const name = heroById(db, heroId).name;
  db.run('INSERT INTO guild_chat (guild_id, hero_id, name, text, at) VALUES (?, ?, ?, ?, ?)', m.guild_id, heroId, name, clean, now);
  // храним 200 последних сообщений
  db.run('DELETE FROM guild_chat WHERE guild_id = ? AND id NOT IN (SELECT id FROM guild_chat WHERE guild_id = ? ORDER BY id DESC LIMIT 200)', m.guild_id, m.guild_id);
  return { name, text: clean, at: now, guildId: m.guild_id };
}

export function chatHistory(db: Db, guildId: string, limit = 50): { name: string; text: string; at: number }[] {
  return db.all<{ name: string; text: string; at: number }>('SELECT name, text, at FROM guild_chat WHERE guild_id = ? ORDER BY id DESC LIMIT ?', guildId, limit).reverse();
}

// ───── Территории ─────

export function ensureTerritories(db: Db): void {
  TERRITORIES.forEach((name, i) => db.run('INSERT OR IGNORE INTO territories (id, name) VALUES (?, ?)', i, name));
}

/** Заявка на территорию на эту неделю (без неё очки не идут). */
export function claimTerritory(db: Db, heroId: string, territoryId: number, now: number): void {
  if (!Number.isInteger(territoryId) || territoryId < 0 || territoryId >= TERRITORIES.length) throw new ApiError(400, 'bad_territory');
  db.tx(() => {
    const m = need(db, heroId, PERM.war);
    const week = weekOf(now);
    if (db.get('SELECT 1 FROM territory_points WHERE territory_id = ? AND guild_id = ? AND week = ?', territoryId, m.guild_id, week)) throw new ApiError(409, 'already_claimed');
    const r = db.run('UPDATE guilds SET treasury = treasury - ? WHERE id = ? AND treasury >= ?', CLAIM_COST, m.guild_id, CLAIM_COST);
    if (!r.changes) throw new ApiError(409, 'treasury_empty');
    db.run('INSERT INTO territory_points (territory_id, guild_id, week, points) VALUES (?, ?, ?, 0)', territoryId, m.guild_id, week);
    log(db, m.guild_id, heroId, 'claim', { territory: TERRITORIES[territoryId] }, now);
  });
}

/** Очки войны: победы членов гильдии в Пустошах на заявленной территории. */
export function addTerritoryPoints(db: Db, heroId: string, territoryId: number, points: number, now: number): void {
  const m = memberOf(db, heroId);
  if (!m) return;
  db.run('UPDATE territory_points SET points = points + ? WHERE territory_id = ? AND guild_id = ? AND week = ?', points, territoryId, m.guild_id, weekOf(now));
}

/** Итог прошедшей недели: у каждой территории новый владелец — гильдия с наибольшими очками. */
export function settleTerritories(db: Db, now: number): { territory: number; owner: string | null }[] {
  ensureTerritories(db);
  const week = weekOf(now) - 1;
  const out: { territory: number; owner: string | null }[] = [];
  db.tx(() => {
    for (let t = 0; t < TERRITORIES.length; t++) {
      const best = db.get<{ guild_id: string; points: number }>(
        'SELECT tp.guild_id, tp.points FROM territory_points tp JOIN guilds g ON g.id = tp.guild_id WHERE territory_id = ? AND week = ? AND points > 0 ORDER BY points DESC LIMIT 1', t, week);
      if (best) {
        db.run('UPDATE territories SET owner_guild = ?, since = ? WHERE id = ?', best.guild_id, now, t);
        log(db, best.guild_id, null, 'territory', { territory: TERRITORIES[t], points: best.points }, now);
        out.push({ territory: t, owner: best.guild_id });
      }
    }
  });
  return out;
}

/** Ежедневная добыча шахт: владелец получает золото в казну. */
export function territoryIncome(db: Db, now: number): number {
  let total = 0;
  db.tx(() => {
    for (const t of db.all<{ owner_guild: string }>('SELECT owner_guild FROM territories WHERE owner_guild IS NOT NULL')) {
      db.run('UPDATE guilds SET treasury = treasury + ? WHERE id = ?', TERRITORY_INCOME, t.owner_guild);
      total += TERRITORY_INCOME;
    }
  });
  return total;
}

export function territoriesDTO(db: Db, now: number): { id: number; name: string; owner: string | null; tag: string | null; contest: { tag: string; points: number }[] }[] {
  ensureTerritories(db);
  const week = weekOf(now);
  return db.all<{ id: number; name: string; owner_guild: string | null; tag: string | null }>(
    'SELECT t.id, t.name, t.owner_guild, g.tag FROM territories t LEFT JOIN guilds g ON g.id = t.owner_guild ORDER BY t.id').map((t) => ({
    id: t.id, name: t.name, owner: t.owner_guild, tag: t.tag,
    contest: db.all<{ tag: string; points: number }>('SELECT g.tag, tp.points FROM territory_points tp JOIN guilds g ON g.id = tp.guild_id WHERE tp.territory_id = ? AND tp.week = ? ORDER BY tp.points DESC', t.id, week),
  }));
}

// ───── DTO ─────

export function guildDTO(db: Db, heroId: string): GuildDTO {
  const m = need(db, heroId);
  const g = guild(db, m.guild_id);
  return {
    id: g.id, name: g.name, tag: g.tag, crest: JSON.parse(g.crest), hall: g.hall, treasury: g.treasury, myRank: m.rank,
    members: db.all<{ heroId: string; name: string; rank: number; level: number }>(
      'SELECT h.id AS heroId, h.name, m.rank, h.level FROM guild_members m JOIN heroes h ON h.id = m.hero_id WHERE m.guild_id = ? ORDER BY m.rank, h.name', g.id),
    ranks: db.all<{ rank: number; title: string; perms: number; daily_withdraw: number }>('SELECT * FROM guild_ranks WHERE guild_id = ? ORDER BY rank', g.id)
      .map((r) => ({ rank: r.rank, title: r.title, perms: r.perms, dailyWithdraw: r.daily_withdraw })),
    storage: db.all<ItemRow>("SELECT * FROM items WHERE owner_kind = 'guild' AND owner_id = ?", g.id).map(itemDTO),
  };
}

export function guildLog(db: Db, heroId: string, limit = 50): { hero: string | null; action: string; payload: unknown; at: number }[] {
  const m = need(db, heroId);
  return db.all<{ name: string | null; action: string; payload: string; at: number }>(
    'SELECT h.name, l.action, l.payload, l.at FROM guild_log l LEFT JOIN heroes h ON h.id = l.hero_id WHERE l.guild_id = ? ORDER BY l.id DESC LIMIT ?', m.guild_id, limit)
    .map((r) => ({ hero: r.name, action: r.action, payload: JSON.parse(r.payload), at: r.at }));
}

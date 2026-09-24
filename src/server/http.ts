import type { IncomingMessage, ServerResponse } from 'node:http';
import { WEAPON_CLASSES, type WeaponClass } from '../game/types';
import type { ArenaMode, Crest } from '../online/protocol';
import { ApiError, bindEmail, emailLogin, guestLogin, RateLimiter, signJwt, verifyJwt } from './auth';
import type { Db } from './db';
import { buyoutLot, cancelLot, listLot, placeBid, priceHistory, searchLots } from './services/auction';
import {
  acceptInvite, claimTerritory, createGuild, deposit, guildDTO, guildLog, invite, invitesFor, kick, leave, memberOf, setCrest, setRank,
  setRankPerms, storagePut, storageTake, territoriesDTO, upgradeHall, withdraw, chatHistory,
} from './services/guild';
import { collectMail, createHero, equip, heroByAccount, heroDTO, unequip } from './services/hero';
import { addBounty, bountyList, touchOnline } from './services/pvp';

/** Очередь арены (реализуется в комнатах Colyseus). */
export interface ArenaQueueApi {
  enqueue(heroId: string, mode: ArenaMode, ranked: boolean): QueueStatus;
  status(heroId: string): QueueStatus;
  leave(heroId: string): void;
}

export type QueueStatus = { state: 'idle' } | { state: 'queued'; mode: ArenaMode; since: number; size: number } | { state: 'matched'; roomId: string; mode: ArenaMode };

export interface ApiCtx {
  db: Db;
  secret: string;
  now: () => number;
  arena?: ArenaQueueApi;
}

interface Req {
  account: string | null;
  body: Record<string, any>;
  query: URLSearchParams;
  ip: string;
}

type Handler = (ctx: ApiCtx, r: Req) => unknown;

interface Route {
  auth: boolean;
  /** Изменяющий запрос: нужен requestId, ответ кэшируется (идемпотентность). */
  mutating: boolean;
  limit?: RateLimiter;
  fn: Handler;
}

const str = (v: unknown, name: string, max = 200): string => {
  if (typeof v !== 'string' || !v.length || v.length > max) throw new ApiError(400, `bad_${name}`);
  return v;
};
const int = (v: unknown, name: string): number => {
  if (typeof v !== 'number' || !Number.isInteger(v)) throw new ApiError(400, `bad_${name}`);
  return v;
};

const bidLimiter = new RateLimiter(60);
const authLimiter = new RateLimiter(20);

const hero = (ctx: ApiCtx, r: Req) => heroByAccount(ctx.db, r.account!);

const ROUTES: Record<string, Route> = {
  'GET /api/health': { auth: false, mutating: false, fn: (ctx) => ({ ok: true, time: ctx.now() }) },

  // ── Аккаунт ──
  'POST /api/auth/guest': {
    auth: false, mutating: false, limit: authLimiter,
    fn: (ctx, r) => {
      const a = guestLogin(ctx.db, str(r.body.deviceId, 'device', 64), ctx.now());
      return { token: signJwt(ctx.secret, { acc: a.id }, undefined, ctx.now()), account: a.id, email: a.email };
    },
  },
  'POST /api/auth/login': {
    auth: false, mutating: false, limit: authLimiter,
    fn: (ctx, r) => {
      const a = emailLogin(ctx.db, str(r.body.email, 'email'), str(r.body.password, 'password'));
      return { token: signJwt(ctx.secret, { acc: a.id }, undefined, ctx.now()), account: a.id, email: a.email };
    },
  },
  'POST /api/auth/bind': {
    auth: true, mutating: false,
    fn: (ctx, r) => (bindEmail(ctx.db, r.account!, str(r.body.email, 'email'), str(r.body.password, 'password')), { ok: true }),
  },

  // ── Герой ──
  'GET /api/hero': {
    auth: true, mutating: false,
    fn: (ctx, r) => {
      const h = hero(ctx, r);
      touchOnline(ctx.db, h.id, ctx.now(), true);
      return heroDTO(ctx.db, heroByAccount(ctx.db, r.account!));
    },
  },
  'POST /api/hero': {
    auth: true, mutating: true,
    fn: (ctx, r) => {
      const cls = r.body.cls as WeaponClass;
      if (!WEAPON_CLASSES.includes(cls)) throw new ApiError(400, 'bad_class');
      return heroDTO(ctx.db, createHero(ctx.db, r.account!, str(r.body.name, 'name', 32), cls, ctx.now()));
    },
  },
  'POST /api/hero/equip': { auth: true, mutating: true, fn: (ctx, r) => (equip(ctx.db, hero(ctx, r).id, str(r.body.uid, 'uid', 64), ctx.now()), heroDTO(ctx.db, hero(ctx, r))) },
  'POST /api/hero/unequip': { auth: true, mutating: true, fn: (ctx, r) => (unequip(ctx.db, hero(ctx, r).id, str(r.body.slot, 'slot', 16), ctx.now()), heroDTO(ctx.db, hero(ctx, r))) },
  'GET /api/mail': {
    auth: true, mutating: false,
    fn: (ctx, r) => ctx.db.all('SELECT m.id, m.gold, m.note, m.at, i.def, i.qty, i.rarity FROM mail m LEFT JOIN items i ON i.uid = m.item_uid WHERE m.hero_id = ? ORDER BY m.id DESC LIMIT 100', hero(ctx, r).id),
  },
  'POST /api/mail/collect': { auth: true, mutating: true, fn: (ctx, r) => collectMail(ctx.db, hero(ctx, r).id, ctx.now()) },

  // ── Аукцион ──
  'GET /api/auction': {
    auth: true, mutating: false,
    fn: (ctx, r) => searchLots(ctx.db, hero(ctx, r).id, {
      def: r.query.get('def') ?? undefined, kind: r.query.get('kind') ?? undefined,
      minRarity: Number(r.query.get('minRarity') ?? 0), mine: r.query.get('mine') === '1',
      sort: (r.query.get('sort') as 'ends' | 'price' | 'new') ?? 'ends', page: Number(r.query.get('page') ?? 0),
    }, ctx.now()),
  },
  'GET /api/auction/history': {
    auth: true, mutating: false,
    fn: (ctx, r) => priceHistory(ctx.db, str(r.query.get('def'), 'def', 64), Number(r.query.get('rarity') ?? 0), ctx.now()),
  },
  'POST /api/auction/list': {
    auth: true, mutating: true,
    fn: (ctx, r) => ({ lotId: listLot(ctx.db, hero(ctx, r).id, str(r.body.uid, 'uid', 64), int(r.body.startBid, 'price'), r.body.buyout == null ? null : int(r.body.buyout, 'buyout'), int(r.body.hours, 'duration'), ctx.now(), r.body.requestId) }),
  },
  'POST /api/auction/bid': { auth: true, mutating: true, limit: bidLimiter, fn: (ctx, r) => placeBid(ctx.db, hero(ctx, r).id, str(r.body.lotId, 'lot', 64), int(r.body.amount, 'amount'), ctx.now()) },
  'POST /api/auction/buyout': { auth: true, mutating: true, limit: bidLimiter, fn: (ctx, r) => (buyoutLot(ctx.db, hero(ctx, r).id, str(r.body.lotId, 'lot', 64), ctx.now()), { ok: true }) },
  'POST /api/auction/cancel': { auth: true, mutating: true, fn: (ctx, r) => (cancelLot(ctx.db, hero(ctx, r).id, str(r.body.lotId, 'lot', 64), ctx.now()), { ok: true }) },

  // ── Гильдия ──
  'GET /api/guild': { auth: true, mutating: false, fn: (ctx, r) => (memberOf(ctx.db, hero(ctx, r).id) ? guildDTO(ctx.db, hero(ctx, r).id) : null) },
  'GET /api/guild/invites': { auth: true, mutating: false, fn: (ctx, r) => invitesFor(ctx.db, hero(ctx, r).id) },
  'GET /api/guild/log': { auth: true, mutating: false, fn: (ctx, r) => guildLog(ctx.db, hero(ctx, r).id) },
  'GET /api/guild/chat': {
    auth: true, mutating: false,
    fn: (ctx, r) => {
      const m = memberOf(ctx.db, hero(ctx, r).id);
      if (!m) throw new ApiError(404, 'not_in_guild');
      return chatHistory(ctx.db, m.guild_id);
    },
  },
  'POST /api/guild': {
    auth: true, mutating: true,
    fn: (ctx, r) => (createGuild(ctx.db, hero(ctx, r).id, str(r.body.name, 'name', 32), str(r.body.tag, 'tag', 8), r.body.crest as Crest, ctx.now()), guildDTO(ctx.db, hero(ctx, r).id)),
  },
  'POST /api/guild/invite': { auth: true, mutating: true, fn: (ctx, r) => (invite(ctx.db, hero(ctx, r).id, str(r.body.name, 'name', 32), ctx.now()), { ok: true }) },
  'POST /api/guild/accept': { auth: true, mutating: true, fn: (ctx, r) => (acceptInvite(ctx.db, hero(ctx, r).id, str(r.body.guildId, 'guild', 64), ctx.now()), guildDTO(ctx.db, hero(ctx, r).id)) },
  'POST /api/guild/leave': { auth: true, mutating: true, fn: (ctx, r) => (leave(ctx.db, hero(ctx, r).id, ctx.now()), { ok: true }) },
  'POST /api/guild/kick': { auth: true, mutating: true, fn: (ctx, r) => (kick(ctx.db, hero(ctx, r).id, str(r.body.heroId, 'hero', 64), ctx.now()), guildDTO(ctx.db, hero(ctx, r).id)) },
  'POST /api/guild/rank': { auth: true, mutating: true, fn: (ctx, r) => (setRank(ctx.db, hero(ctx, r).id, str(r.body.heroId, 'hero', 64), int(r.body.rank, 'rank'), ctx.now()), guildDTO(ctx.db, hero(ctx, r).id)) },
  'POST /api/guild/perms': {
    auth: true, mutating: true,
    fn: (ctx, r) => (setRankPerms(ctx.db, hero(ctx, r).id, int(r.body.rank, 'rank'), String(r.body.title ?? ''), int(r.body.perms, 'perms'), int(r.body.dailyWithdraw, 'amount'), ctx.now()), guildDTO(ctx.db, hero(ctx, r).id)),
  },
  'POST /api/guild/deposit': { auth: true, mutating: true, fn: (ctx, r) => (deposit(ctx.db, hero(ctx, r).id, int(r.body.amount, 'amount'), ctx.now()), guildDTO(ctx.db, hero(ctx, r).id)) },
  'POST /api/guild/withdraw': { auth: true, mutating: true, fn: (ctx, r) => (withdraw(ctx.db, hero(ctx, r).id, int(r.body.amount, 'amount'), ctx.now()), guildDTO(ctx.db, hero(ctx, r).id)) },
  'POST /api/guild/storage/put': { auth: true, mutating: true, fn: (ctx, r) => (storagePut(ctx.db, hero(ctx, r).id, str(r.body.uid, 'uid', 64), ctx.now()), guildDTO(ctx.db, hero(ctx, r).id)) },
  'POST /api/guild/storage/take': { auth: true, mutating: true, fn: (ctx, r) => (storageTake(ctx.db, hero(ctx, r).id, str(r.body.uid, 'uid', 64), ctx.now()), guildDTO(ctx.db, hero(ctx, r).id)) },
  'POST /api/guild/crest': { auth: true, mutating: true, fn: (ctx, r) => (setCrest(ctx.db, hero(ctx, r).id, r.body.crest as Crest, ctx.now()), guildDTO(ctx.db, hero(ctx, r).id)) },
  'POST /api/guild/hall': { auth: true, mutating: true, fn: (ctx, r) => ({ hall: upgradeHall(ctx.db, hero(ctx, r).id, ctx.now()) }) },
  'POST /api/guild/claim': { auth: true, mutating: true, fn: (ctx, r) => (claimTerritory(ctx.db, hero(ctx, r).id, int(r.body.territory, 'territory'), ctx.now()), territoriesDTO(ctx.db, ctx.now())) },
  'GET /api/territories': { auth: false, mutating: false, fn: (ctx) => territoriesDTO(ctx.db, ctx.now()) },

  // ── Рейтинги, награды ──
  'GET /api/leaderboard': {
    auth: false, mutating: false,
    fn: (ctx, r) => r.query.get('kind') === 'waves'
      ? ctx.db.all('SELECT name, level, waves_best AS score FROM heroes WHERE waves_best > 0 ORDER BY waves_best DESC LIMIT 50')
      : ctx.db.all('SELECT name, level, CAST(rating AS INTEGER) AS score, wins, losses FROM heroes WHERE wins + losses > 0 ORDER BY rating DESC LIMIT 50'),
  },
  'GET /api/bounties': { auth: false, mutating: false, fn: (ctx) => bountyList(ctx.db) },
  'POST /api/bounties': { auth: true, mutating: true, fn: (ctx, r) => ({ amount: addBounty(ctx.db, hero(ctx, r).id, str(r.body.name, 'name', 32), int(r.body.amount, 'amount'), ctx.now()) }) },

  // ── Арена ──
  'POST /api/arena/queue': {
    auth: true, mutating: false,
    fn: (ctx, r) => {
      if (!ctx.arena) throw new ApiError(503, 'arena_offline');
      const mode = r.body.mode as ArenaMode;
      if (!['duel', 'team', 'waves', 'raid'].includes(mode)) throw new ApiError(400, 'bad_mode');
      return ctx.arena.enqueue(hero(ctx, r).id, mode, !!r.body.ranked);
    },
  },
  'GET /api/arena/queue': { auth: true, mutating: false, fn: (ctx, r) => ctx.arena?.status(hero(ctx, r).id) ?? { state: 'idle' } },
  'POST /api/arena/leave': { auth: true, mutating: false, fn: (ctx, r) => (ctx.arena?.leave(hero(ctx, r).id), { state: 'idle' }) },
};

/** Выполнить запрос API (без сети — используется и HTTP-сервером, и тестами). */
export function handleApi(ctx: ApiCtx, method: string, path: string, headers: Record<string, string | undefined>, body: Record<string, any>, query = new URLSearchParams(), ip = 'local'): { status: number; json: unknown } {
  const route = ROUTES[`${method} ${path}`];
  if (!route) return { status: 404, json: { error: 'not_found' } };
  try {
    let account: string | null = null;
    const auth = headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      const p = verifyJwt(ctx.secret, auth.slice(7), ctx.now());
      if (p && typeof p.acc === 'string') account = p.acc;
    }
    if (route.auth && !account) throw new ApiError(401, 'unauthorized');
    if (account && ctx.db.get<{ banned: number }>('SELECT banned FROM accounts WHERE id = ?', account)?.banned) throw new ApiError(403, 'banned');
    if (route.limit && !route.limit.allow(account ?? ip, ctx.now())) throw new ApiError(429, 'rate_limited');
    const req: Req = { account, body, query, ip };
    if (!route.mutating) return { status: 200, json: route.fn(ctx, req) ?? null };
    const rid = str(body.requestId, 'request', 64);
    // идемпотентность: повтор того же requestId возвращает сохранённый ответ, а не выполняется второй раз
    const json = ctx.db.tx(() => {
      const prev = ctx.db.get<{ response: string }>('SELECT response FROM requests WHERE account_id = ? AND id = ?', account!, rid);
      if (prev) return JSON.parse(prev.response);
      const res = route.fn(ctx, req) ?? null;
      ctx.db.run('INSERT INTO requests (account_id, id, response, at) VALUES (?, ?, ?, ?)', account!, rid, JSON.stringify(res), ctx.now());
      return res;
    });
    return { status: 200, json };
  } catch (e) {
    if (e instanceof ApiError) return { status: e.status, json: { error: e.code } };
    console.error(e);
    return { status: 500, json: { error: 'internal' } };
  }
}

/** HTTP-обработчик для node:http. */
export function httpHandler(ctx: ApiCtx) {
  return (req: IncomingMessage, res: ServerResponse): void => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.writeHead(204).end();
      return;
    }
    const url = new URL(req.url ?? '/', 'http://x');
    if (!url.pathname.startsWith('/api/')) {
      res.writeHead(404).end();
      return;
    }
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 64_000) req.destroy();
    });
    req.on('end', () => {
      let body: Record<string, any> = {};
      if (raw) {
        try {
          body = JSON.parse(raw);
        } catch {
          res.writeHead(400, { 'content-type': 'application/json' }).end('{"error":"bad_json"}');
          return;
        }
      }
      const out = handleApi(ctx, req.method ?? 'GET', url.pathname, req.headers as Record<string, string>, body, url.searchParams, req.socket.remoteAddress ?? '');
      res.writeHead(out.status, { 'content-type': 'application/json' }).end(JSON.stringify(out.json));
    });
  };
}

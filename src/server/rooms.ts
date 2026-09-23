import { matchMaker, Room, type Client } from '@colyseus/core';
import type { ArenaMode, NetSnapshot } from '../online/protocol';
import { MODE_SIZE } from '../online/protocol';
import { ApiError, RateLimiter, verifyJwt } from './auth';
import type { Db } from './db';
import type { ArenaQueueApi, QueueStatus } from './http';
import { finishMatch, loadSimHero } from './services/arena';
import { memberOf, postChat, chatHistory } from './services/guild';
import { heroByAccount, heroById } from './services/hero';
import { touchOnline } from './services/pvp';
import { wastesHooks } from './services/wastes';
import { ArenaSim } from './sim/arena';
import { mapToNet, SIM_DT, SimCore } from './sim/core';
import { WastesSim } from './sim/wastes';

/** Общие зависимости комнат (одна БД на процесс). */
export const env: { db: Db; secret: string; now: () => number } = { db: null as unknown as Db, secret: '', now: () => Date.now() };

interface Seat {
  heroId: string;
}

function authHero(options: { token?: string }): Seat {
  const p = options?.token ? verifyJwt(env.secret, options.token, env.now()) : null;
  if (!p || typeof p.acc !== 'string') throw new ApiError(401, 'unauthorized');
  return { heroId: heroByAccount(env.db, p.acc).id };
}

const SNAP_EVERY = 2; // снимок на каждый второй шаг: 15 Гц

/** Комната с серверной симуляцией: ввод от клиентов, снимки обратно. */
abstract class SimRoom<S extends SimCore> extends Room {
  sim!: S;
  protected tick = 0;
  protected byClient = new Map<string, string>();

  protected startSim(): void {
    this.onMessage('in', (client, msg) => {
      const heroId = this.byClient.get(client.sessionId);
      if (heroId) this.sim.input(heroId, msg);
    });
    this.setPatchRate(null);
    this.setSimulationInterval(() => this.update(), SIM_DT * 1000);
  }

  protected update(): void {
    this.sim.step(SIM_DT);
    this.afterUpdate();
    if (++this.tick % SNAP_EVERY) return;
    const ents = this.sim.snapshot();
    const fx = this.sim.takeFx();
    for (const c of this.clients) {
      const heroId = this.byClient.get(c.sessionId);
      const me = heroId ? this.sim.heroes.get(heroId) : undefined;
      const snap: NetSnapshot & { fx: unknown } = { t: this.sim.time, ack: me?.seq ?? 0, you: me?.id ?? -1, ents, hud: this.hudFor(heroId), fx };
      c.send('snap', snap);
    }
  }

  protected afterUpdate(): void {}
  protected hudFor(_heroId: string | undefined): NetSnapshot['hud'] {
    return undefined;
  }
}

// ───────────────────────── Арена ─────────────────────────

export class ArenaRoom extends SimRoom<ArenaSim> {
  private entrants: { heroId: string; team: 'A' | 'B' }[] = [];
  private startedAt = 0;
  private finished = false;
  private waitTimer = 20;

  override onCreate(options: { mode: ArenaMode; ranked: boolean; entrants: { heroId: string; team: 'A' | 'B' }[] }): void {
    this.entrants = options.entrants;
    this.maxClients = options.entrants.length;
    this.autoDispose = true;
    this.sim = new ArenaSim(options.mode, !!options.ranked, options.entrants.map((e) => ({ hero: loadSimHero(env.db, e.heroId), team: e.team })), Math.floor(Math.random() * 1e9));
    this.sim.phase = 'countdown';
    this.sim.timer = 999; // ждём участников
    this.startedAt = env.now();
    this.startSim();
  }

  override onAuth(_client: Client, options: { token?: string }): Seat {
    const seat = authHero(options);
    if (!this.entrants.some((e) => e.heroId === seat.heroId)) throw new ApiError(403, 'not_your_match');
    return seat;
  }

  override onJoin(client: Client, _options: unknown, seat: Seat): void {
    this.byClient.set(client.sessionId, seat.heroId);
    client.send('map', { map: mapToNet(this.sim.map, this.sim.theme), mode: this.sim.mode });
    if (this.clients.length >= this.entrants.length && this.sim.timer > 3) this.sim.timer = 3;
  }

  override onLeave(client: Client): void {
    const heroId = this.byClient.get(client.sessionId);
    if (heroId && !this.finished) this.sim.forfeit(heroId);
  }

  protected override afterUpdate(): void {
    // кто не пришёл за 20 секунд — поражение
    if (this.sim.phase === 'countdown' && this.sim.timer > 3) {
      this.waitTimer -= SIM_DT;
      if (this.waitTimer <= 0) {
        const joined = new Set(this.byClient.values());
        for (const e of this.entrants) if (!joined.has(e.heroId)) this.sim.forfeit(e.heroId);
        this.sim.timer = 3;
      }
    }
    if (this.sim.result && !this.finished) {
      this.finished = true;
      const ratings = finishMatch(env.db, this.sim.result, this.startedAt, env.now());
      this.broadcast('result', { ...this.sim.result, ratings });
      arenaQueue.release(this.entrants.map((e) => e.heroId));
      this.clock.setTimeout(() => this.disconnect(), 4000);
    }
  }

  protected override hudFor(): NetSnapshot['hud'] {
    return this.sim.hud();
  }
}

/** Подбор соперников: дуэль — ближайший по рейтингу (окно растёт с ожиданием), 3×3 — «змейкой», волны — сразу. */
export class ArenaQueue implements ArenaQueueApi {
  private waiting: { heroId: string; mode: ArenaMode; ranked: boolean; rating: number; since: number }[] = [];
  private matched = new Map<string, QueueStatus>();

  enqueue(heroId: string, mode: ArenaMode, ranked: boolean): QueueStatus {
    const cur = this.status(heroId);
    if (cur.state !== 'idle') return cur;
    this.waiting.push({ heroId, mode, ranked: mode === 'waves' ? false : ranked, rating: heroById(env.db, heroId).rating, since: env.now() });
    this.tryMatch();
    return this.status(heroId);
  }

  status(heroId: string): QueueStatus {
    const m = this.matched.get(heroId);
    if (m) return m;
    const w = this.waiting.find((x) => x.heroId === heroId);
    return w ? { state: 'queued', mode: w.mode, since: w.since, size: this.waiting.filter((x) => x.mode === w.mode).length } : { state: 'idle' };
  }

  leave(heroId: string): void {
    this.waiting = this.waiting.filter((x) => x.heroId !== heroId);
    this.matched.delete(heroId);
  }

  release(heroIds: string[]): void {
    for (const id of heroIds) this.matched.delete(id);
  }

  tryMatch(): void {
    const now = env.now();
    for (const mode of ['waves', 'duel', 'team'] as ArenaMode[])
      for (const ranked of [false, true]) {
        const pool = this.waiting.filter((w) => w.mode === mode && w.ranked === ranked).sort((a, b) => a.since - b.since);
        const need = MODE_SIZE[mode];
        while (pool.length >= need) {
          let group: typeof pool;
          if (mode === 'duel') {
            const a = pool[0]!;
            const window = 100 + ((now - a.since) / 1000) * 10;
            const b = pool.slice(1).sort((x, y) => Math.abs(x.rating - a.rating) - Math.abs(y.rating - a.rating))[0]!;
            if (Math.abs(b.rating - a.rating) > window && ranked) break;
            group = [a, b];
          } else group = pool.slice(0, need);
          for (const g of group) pool.splice(pool.indexOf(g), 1);
          this.waiting = this.waiting.filter((w) => !group.includes(w));
          const sorted = [...group].sort((x, y) => y.rating - x.rating);
          // «змейка»: 1-й и 4-й, 5-й против 2-го, 3-го, 6-го — команды примерно равны
          const teams = sorted.map((g, i) => ({ heroId: g.heroId, team: (mode === 'waves' ? 'A' : [0, 3, 4].includes(i) ? 'A' : 'B') as 'A' | 'B' }));
          for (const g of group) this.matched.set(g.heroId, { state: 'queued', mode, since: g.since, size: need });
          void matchMaker.createRoom('arena', { mode, ranked, entrants: teams }).then((room) => {
            for (const g of group) this.matched.set(g.heroId, { state: 'matched', roomId: room.roomId, mode });
          });
        }
      }
  }
}

export const arenaQueue = new ArenaQueue();

// ───────────────────────── Пустоши ─────────────────────────

export class WastesRoom extends SimRoom<WastesSim> {
  private lastTouch = 0;

  override onCreate(): void {
    this.maxClients = 64;
    this.autoDispose = false;
    this.sim = new WastesSim(wastesHooks(env.db, env.now), 11);
    this.startSim();
  }

  override onAuth(_client: Client, options: { token?: string }): Seat {
    return authHero(options);
  }

  override onJoin(client: Client, _options: unknown, seat: Seat): void {
    if (this.sim.heroes.has(seat.heroId)) throw new ApiError(409, 'already_in_wastes');
    this.byClient.set(client.sessionId, seat.heroId);
    this.sim.join(loadSimHero(env.db, seat.heroId));
    client.send('map', { map: mapToNet(this.sim.map, this.sim.theme), mode: 'wastes' });
  }

  override onLeave(client: Client): void {
    const heroId = this.byClient.get(client.sessionId);
    this.byClient.delete(client.sessionId);
    if (heroId) this.sim.removeHero(heroId);
  }

  protected override afterUpdate(): void {
    // карма восстанавливается только в лагере: раз в минуту отмечаем, кто где
    this.lastTouch += SIM_DT;
    if (this.lastTouch < 60) return;
    this.lastTouch = 0;
    for (const [id, p] of this.sim.heroes) touchOnline(env.db, id, env.now(), this.sim.hudFor(p).msg === 'camp');
  }

  protected override hudFor(heroId: string | undefined): NetSnapshot['hud'] {
    const p = heroId ? this.sim.heroes.get(heroId) : undefined;
    return p ? this.sim.hudFor(p) : undefined;
  }
}

// ───────────────────────── Гильдейский чат ─────────────────────────

export class GuildChatRoom extends Room {
  private limiter = new RateLimiter(20);
  private guildId = '';

  override onCreate(options: { guildId: string }): void {
    this.guildId = options.guildId;
    this.autoDispose = true;
    this.setPatchRate(null);
    this.onMessage('say', (client, text: unknown) => {
      const heroId = (client.auth as Seat | undefined)?.heroId;
      if (!heroId || typeof text !== 'string' || !this.limiter.allow(heroId, env.now())) return;
      try {
        const m = postChat(env.db, heroId, text, env.now());
        if (m.guildId === this.guildId) this.broadcast('msg', { name: m.name, text: m.text, at: m.at });
      } catch {
        /* пустое сообщение или герой вышел из гильдии */
      }
    });
  }

  override onAuth(_client: Client, options: { token?: string; guildId?: string }): Seat {
    const seat = authHero(options);
    const m = memberOf(env.db, seat.heroId);
    if (!m || m.guild_id !== options.guildId) throw new ApiError(403, 'not_member');
    return seat;
  }

  override onJoin(client: Client): void {
    client.send('history', chatHistory(env.db, this.guildId));
  }
}

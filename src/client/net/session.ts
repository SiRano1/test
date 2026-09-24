import { Client, type Room } from 'colyseus.js';
import { EventBus } from '../../core/events';
import { Rng } from '../../core/rng';
import { TileMap } from '../../core/tilemap';
import { MONSTERS } from '../../data/monsters';
import { Boss } from '../../game/entities/boss';
import { Enemy, type Telegraph } from '../../game/entities/enemy';
import type { Entity } from '../../game/entities/entity';
import { Marker } from '../../game/entities/marker';
import { Pickup } from '../../game/entities/pickup';
import { Player, type PlayerState } from '../../game/entities/player';
import { Projectile } from '../../game/entities/projectile';
import type { Fx, GameEvents } from '../../game/events';
import type { InputFrame } from '../../game/input';
import { newGameState, type GameState, type Settings } from '../../game/state';
import { computeStats } from '../../game/systems/stats';
import type { WeaponClass } from '../../game/types';
import { World, type GameApi } from '../../game/world';
import type { NetEntity, NetSnapshot } from '../../online/protocol';
import type { Audio } from '../engine/audio';
import type { Renderer, RenderSource } from '../gfx/renderer';
import type { OnlineApi } from './api';

const noop = () => {};

/** Заглушка фасада игры для «зеркального» мира клиента: он только рисуется. */
function stubApi(state: GameState, events: EventBus<GameEvents>): GameApi {
  return new Proxy({ state, events, stats: () => computeStats(state), plotLabel: () => '', useEnergy: () => true, giveItem: () => false, shopOpen: false } as unknown as GameApi, {
    get: (t, k) => (k in t ? (t as any)[k] : noop),
  });
}

class GhostHero extends Player {
  tx = 0;
  ty = 0;
  netName = '';
  netTag = 'blue';
  netWeapon: string;

  constructor(api: GameApi, cls: WeaponClass) {
    super(api);
    this.netWeapon = `iron_${cls}`;
    this.light = { r: 40, color: '#ffe0b0', power: 0.6 };
  }
  override update(): void {}
}

class GhostEnemy extends Enemy {
  tx = 0;
  ty = 0;
  tg: Telegraph | null = null;
  override telegraph(): Telegraph | null {
    return this.tg;
  }
  override update(): void {}
}

class GhostBoss extends Boss {
  tx = 0;
  ty = 0;
  tg: Telegraph | null = null;
  override telegraph(): Telegraph | null {
    return this.tg;
  }
  override update(): void {}
}

export interface NetResult {
  winners: string[];
  losers: string[];
  draw: boolean;
  waves: number;
  ratings?: Record<string, { rating: number; delta: number }>;
}

/**
 * Сетевой сеанс: подключение к комнате, «зеркальный» мир из снимков сервера и отправка ввода.
 * Клиент ничего не решает — только рисует то, что прислал сервер, и шлёт намерения.
 */
export class NetSession {
  room: Room | null = null;
  world: World | null = null;
  readonly events = new EventBus<GameEvents>();
  state: GameState;
  mode = '';
  hud: NetSnapshot['hud'] = undefined;
  result: NetResult | null = null;
  ended = false;
  me: GhostHero | null = null;
  private ents = new Map<number, Entity>();
  private seq = 0;
  private sendT = 0;
  private pressed = new Set<string>();
  private you = -1;
  private rng = new Rng(1);

  constructor(private api: OnlineApi, settings: Settings, private audio: Audio, private renderer: Renderer) {
    this.state = newGameState('net', 1);
    this.state.settings = settings;
    this.state.time.minutes = 12 * 60;
  }

  /** Источник для рендера (та же отрисовка, что и в одиночной игре). */
  get view(): RenderSource {
    return { world: this.world!, state: this.state, busy: false, mode: 'play', fade: 0, events: this.events } as unknown as RenderSource;
  }

  get ready(): boolean {
    return !!this.world;
  }

  async join(kind: 'arena' | 'wastes', roomId?: string): Promise<void> {
    const client = new Client(this.api.wsUrl);
    const room = kind === 'arena' ? await client.joinById(roomId!, { token: this.api.token }) : await client.joinOrCreate('wastes', { token: this.api.token });
    this.room = room;
    room.onMessage('map', (m: { map: { w: number; h: number; tiles: number[]; theme: string }; mode: string }) => this.setMap(m.map, m.mode));
    room.onMessage('snap', (s: NetSnapshot & { fx?: Fx[] }) => this.apply(s));
    room.onMessage('result', (r: NetResult) => (this.result = r));
    room.onLeave(() => (this.ended = true));
  }

  leave(): void {
    void this.room?.leave().catch(noop);
    this.ended = true;
  }

  private setMap(m: { w: number; h: number; tiles: number[]; theme: string }, mode: string): void {
    const map = new TileMap(m.w, m.h, 0);
    map.tiles.set(m.tiles);
    const w = new World(stubApi(this.state, this.events), 'dungeon', map, 1, m.theme);
    w.darkness = mode === 'wastes' ? 0.35 : 0.5;
    this.world = w;
    this.mode = mode;
    this.ents.clear();
    this.me = null;
  }

  private apply(s: NetSnapshot & { fx?: Fx[] }): void {
    const w = this.world;
    if (!w) return;
    this.hud = s.hud;
    this.you = s.you;
    const seen = new Set<number>();
    for (const n of s.ents) {
      seen.add(n.id);
      let e = this.ents.get(n.id);
      if (!e) {
        e = this.create(n, w) ?? undefined;
        if (!e) continue;
        this.ents.set(n.id, e);
        w.addNow(e);
      }
      this.sync(e, n);
    }
    for (const [id, e] of this.ents)
      if (!seen.has(id)) {
        e.removed = true;
        this.ents.delete(id);
      }
    w.entities = w.entities.filter((e) => !e.removed);
    const me = this.ents.get(this.you);
    this.me = me instanceof GhostHero ? me : null;
    w.player = this.me as never;
    for (const fx of s.fx ?? []) {
      if (fx.t === 'sfx') this.audio.play(fx.id, fx.vol);
      else if (fx.t === 'shake') {
        if (this.state.settings.shake) this.renderer.cam.shake(fx.power, fx.dur);
      } else if (fx.t !== 'flash') this.renderer.particles.spawn(fx);
    }
  }

  private create(n: NetEntity, w: World): Entity | null {
    switch (n.k) {
      case 'hero': {
        const st = newGameState(n.n ?? '', 1);
        const h = new GhostHero(stubApi(st, this.events), n.s as WeaponClass);
        h.x = h.tx = n.x;
        h.y = h.ty = n.y;
        return h;
      }
      case 'mob': {
        const def = MONSTERS[n.s];
        if (!def) return null;
        const e = def.boss ? new GhostBoss(n.s, n.x, n.y, 1) : new GhostEnemy(n.s, n.x, n.y, 1);
        e.tx = n.x;
        e.ty = n.y;
        return e;
      }
      case 'proj':
        return new Projectile(n.x, n.y, n.a ?? 0, 0, 'enemy', { dmg: 0, crit: 0, critMul: 1, knock: 0, source: null }, n.s, { color: n.c });
      case 'loot': {
        const p = new Pickup(n.x, n.y, this.rng, n.s === '__coin' ? null : { uid: '', def: n.s, qty: 1, rarity: 0, affixes: [], upgrade: 0 }, n.s === '__coin' ? 1 : 0);
        p.vx = p.vy = p.vz = p.z = 0;
        return p;
      }
      case 'fx':
        return new Marker(n.x, n.y, n.a ?? 16, 1, null as never, { dmg: 0, crit: 0, critMul: 1, knock: 0, source: null }, '#ff4040', false);
    }
    void w;
    return null;
  }

  private sync(e: Entity, n: NetEntity): void {
    if (e instanceof GhostHero) {
      e.tx = n.x;
      e.ty = n.y;
      e.facing = (n.f ?? 0) as 0;
      e.hp = n.hp ?? e.hp;
      e.maxHp = n.mhp ?? e.maxHp;
      e.dead = n.st === 'dead';
      e.state = (n.st === 'dead' ? 'dead' : n.st ?? 'free') as PlayerState;
      e.swingP = n.sp ?? 0;
      e.attackAngle = n.a ?? 0;
      e.aim = n.a ?? e.aim;
      e.netName = n.n ?? '';
      e.netTag = n.c ?? 'blue';
    } else if (e instanceof GhostEnemy || e instanceof GhostBoss) {
      e.tx = n.x;
      e.ty = n.y;
      e.facing = (n.f ?? 0) as 0;
      e.flip = n.f === 1;
      e.hp = n.hp ?? e.hp;
      e.maxHp = n.mhp ?? e.maxHp;
      e.dead = n.st === 'dead';
      e.state = (n.st === 'dead' ? 'recover' : n.st ?? 'chase') as never;
      e.tg = n.tg ? { kind: n.tg[0] as Telegraph['kind'], x: n.tg[1], y: n.tg[2], angle: n.tg[3], p: n.tg[4], r: n.a ?? 30, half: n.sp ?? 1 } : null;
    } else if (e instanceof Projectile) {
      e.x = n.x;
      e.y = n.y;
      e.angle = n.a ?? e.angle;
    } else if (e instanceof Marker) {
      e.t = n.sp ?? 0;
    } else {
      e.x = n.x;
      e.y = n.y;
    }
  }

  /** Кадр клиента: плавное следование за снимками и отправка ввода 30 раз в секунду. */
  update(dt: number, inp: InputFrame): void {
    if (!this.world) return;
    const k = Math.min(1, dt * 16);
    for (const e of this.ents.values()) {
      e.animT += dt;
      if (e instanceof GhostHero || e instanceof GhostEnemy || e instanceof GhostBoss) {
        const dx = e.tx - e.x, dy = e.ty - e.y;
        (e as { moving?: boolean }).moving = Math.hypot(dx, dy) > 0.6;
        e.x += dx * k;
        e.y += dy * k;
        if (e.dead) e.deathT += dt;
      }
    }
    for (const a of inp.pressed) this.pressed.add(a);
    this.sendT -= dt;
    if (this.sendT > 0 || !this.room) return;
    this.sendT = 1 / 30;
    this.room.send('in', {
      seq: ++this.seq, mx: inp.mx, my: inp.my, ax: inp.aimX, ay: inp.aimY,
      p: [...this.pressed], d: [...inp.down],
    });
    this.pressed.clear();
  }

  /** Имена и полоски здоровья героев поверх мира. */
  drawOverlay(ctx: CanvasRenderingContext2D): void {
    if (!this.world) return;
    const cx = this.renderer.cam.rx, cy = this.renderer.cam.ry;
    const colors: Record<string, string> = { blue: '#8ab8ff', purple: '#d08aff', red: '#ff6060' };
    ctx.font = '8px "Pixelify Sans", monospace';
    ctx.textAlign = 'center';
    for (const e of this.ents.values()) {
      if (!(e instanceof GhostHero) || e.dead) continue;
      const x = Math.round(e.x - cx), y = Math.round(e.y - cy);
      ctx.fillStyle = '#000';
      ctx.fillText(e.netName, x + 1, y - 27);
      ctx.fillStyle = e === this.me ? '#ffe070' : (colors[e.netTag] ?? '#fff');
      ctx.fillText(e.netName, x, y - 28);
      ctx.fillStyle = '#1a1014';
      ctx.fillRect(x - 8, y - 25, 16, 3);
      ctx.fillStyle = e.netTag === 'red' ? '#d04848' : '#58c858';
      ctx.fillRect(x - 7, y - 24, Math.max(1, Math.round((14 * e.hp) / Math.max(1, e.maxHp))), 1);
    }
    ctx.textAlign = 'left';
  }
}

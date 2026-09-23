import { Rng } from '../../core/rng';
import { Tile, TileMap } from '../../core/tilemap';
import { TIERS } from '../../data/tiers';
import { Enemy } from '../../game/entities/enemy';
import { Marker } from '../../game/entities/marker';
import { Pickup } from '../../game/entities/pickup';
import { Projectile } from '../../game/entities/projectile';
import type { Fx } from '../../game/events';
import type { Action, InputFrame } from '../../game/input';
import { newGameState } from '../../game/state';
import type { Team } from '../../game/entities/entity';
import { World } from '../../game/world';
import type { NetEntity, NetInput } from '../../online/protocol';
import { FxSink, NetGameApi, NetHero, type SimHero } from './hero';

export const SIM_HZ = 30;
export const SIM_DT = 1 / SIM_HZ;

const ACTIONS = new Set<Action>(['attack', 'block', 'dodge', 'skill', 'swap', 'interact']);

/** Сетевые данные карты для клиента: ширина, высота, тайлы и тема палитры. */
export interface NetMap {
  w: number;
  h: number;
  tiles: number[];
  theme: string;
}

export function mapToNet(map: TileMap, theme: string): NetMap {
  return { w: map.w, h: map.h, tiles: Array.from(map.tiles), theme };
}

/** Стены по краям, чтобы рендер не показывал «сплошной камень» за пределами поля. */
function frame(map: TileMap): void {
  for (let y = 0; y < map.h; y++)
    for (let x = 0; x < map.w; x++) {
      const t = map.get(x, y);
      if (t !== Tile.WALL) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) if (map.get(x + dx, y + dy) === Tile.FLOOR || map.get(x + dx, y + dy) === Tile.SHALLOW) near = true;
      if (!near) map.set(x, y, Tile.VOID);
    }
}

/** Ристалище арены: зал с четырьмя колоннами. */
export function arenaMap(w = 26, h = 18): TileMap {
  const m = new TileMap(w, h, Tile.WALL);
  m.fillRect(2, 2, w - 4, h - 4, Tile.FLOOR);
  for (const [x, y] of [[7, 6], [w - 8, 6], [7, h - 7], [w - 8, h - 7]] as const) m.fillRect(x, y, 1, 1, Tile.WALL);
  frame(m);
  return m;
}

/** Пепельные Пустоши: большое поле с камнями, водой и безопасным лагерем в центре. */
export const WASTES_W = 72;
export const WASTES_H = 54;
export const CAMP = { x: 32, y: 23, w: 8, h: 8 };

export function wastesMap(seed = 7): TileMap {
  const rng = new Rng(seed);
  const m = new TileMap(WASTES_W, WASTES_H, Tile.WALL);
  m.fillRect(2, 2, WASTES_W - 4, WASTES_H - 4, Tile.FLOOR);
  for (let i = 0; i < 70; i++) {
    const w = rng.int(1, 3), h = rng.int(1, 3);
    const x = rng.int(3, WASTES_W - 6), y = rng.int(3, WASTES_H - 6);
    if (x + w > CAMP.x - 2 && x < CAMP.x + CAMP.w + 2 && y + h > CAMP.y - 2 && y < CAMP.y + CAMP.h + 2) continue;
    m.fillRect(x, y, w, h, Tile.WALL);
  }
  for (let i = 0; i < 8; i++) {
    const x = rng.int(4, WASTES_W - 10), y = rng.int(4, WASTES_H - 8);
    if (x + 6 > CAMP.x - 2 && x < CAMP.x + CAMP.w + 2 && y + 4 > CAMP.y - 2 && y < CAMP.y + CAMP.h + 2) continue;
    for (let j = y; j < y + 4; j++) for (let k = x; k < x + 6; k++) if (m.get(k, j) === Tile.FLOOR) m.set(k, j, Tile.SHALLOW);
  }
  frame(m);
  return m;
}

/** Территория Пустошей по координатам (сетка 4 × 3 = 12 территорий). */
export const territoryAt = (x: number, y: number) =>
  Math.min(3, Math.max(0, Math.floor((x / 16) / (WASTES_W / 4)))) + 4 * Math.min(2, Math.max(0, Math.floor((y / 16) / (WASTES_H / 3))));

export const inCamp = (x: number, y: number) => {
  const tx = x / 16, ty = y / 16;
  return tx >= CAMP.x && tx < CAMP.x + CAMP.w && ty >= CAMP.y && ty < CAMP.y + CAMP.h;
};

/**
 * Общая часть серверных симуляций: мир из src/game в сетевом режиме, герои со своим вводом,
 * проверка ввода (анти-чит), снимки для клиентов.
 */
export abstract class SimCore {
  readonly world: World;
  readonly fx = new FxSink();
  readonly heroes = new Map<string, NetHero>();
  protected pressed = new Map<string, Set<Action>>();
  protected latest = new Map<string, NetInput>();
  time = 0;
  lastFx: Fx[] = [];

  constructor(readonly map: TileMap, readonly theme: string, seed: number, tier = 7) {
    const api = new NetGameApi(newGameState('server', seed), this.fx);
    this.world = new World(api, 'dungeon', map, seed, theme);
    this.world.netMode = true;
    this.world.tier = TIERS[tier - 1] ?? null;
    this.world.floor = tier * 10;
    this.world.hooks = {
      damage: (t, spec, n) => {
        this.onDamageAny(t, spec.source);
        this.onDamage(t, spec.source, n);
      },
    };
  }

  addHero(h: SimHero, x: number, y: number, team: Team, normalized: boolean): NetHero {
    const p = new NetHero(h, normalized, this.fx);
    p.x = x;
    p.y = y;
    p.team = team;
    p.hp = p.maxHp;
    p.api.onDeath = () => this.onHeroDeath(p);
    this.world.addNow(p);
    this.world.heroes.push(p);
    this.heroes.set(h.id, p);
    return p;
  }

  removeHero(id: string): void {
    const p = this.heroes.get(id);
    if (!p) return;
    this.world.remove(p);
    this.world.heroes = this.world.heroes.filter((x) => x !== p);
    this.heroes.delete(id);
  }

  /** Принять ввод клиента. Невалидный ввод отбрасывается (защита от подделки). */
  input(heroId: string, raw: unknown): void {
    const i = raw as NetInput;
    if (!i || typeof i.seq !== 'number' || !Number.isFinite(i.mx) || !Number.isFinite(i.my)) return;
    const p = this.heroes.get(heroId);
    if (!p || i.seq <= p.seq) return;
    const l = Math.hypot(i.mx, i.my);
    const mx = l > 1 ? i.mx / l : i.mx, my = l > 1 ? i.my / l : i.my;
    const okAim = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    const clean: NetInput = {
      seq: i.seq, mx, my, ax: okAim(i.ax), ay: okAim(i.ay),
      p: (Array.isArray(i.p) ? i.p : []).filter((a): a is Action => ACTIONS.has(a as Action)).slice(0, 6),
      d: (Array.isArray(i.d) ? i.d : []).filter((a): a is Action => ACTIONS.has(a as Action)).slice(0, 6),
    };
    this.latest.set(heroId, clean);
    const acc = this.pressed.get(heroId) ?? new Set<Action>();
    for (const a of clean.p) acc.add(a as Action);
    this.pressed.set(heroId, acc);
    p.seq = i.seq;
  }

  private applyInputs(): void {
    for (const [id, p] of this.heroes) {
      const i = this.latest.get(id);
      const frame: InputFrame = {
        mx: i?.mx ?? 0, my: i?.my ?? 0, aimX: i?.ax ?? null, aimY: i?.ay ?? null,
        down: new Set((i?.d ?? []) as Action[]), pressed: this.pressed.get(id) ?? new Set(), released: new Set(),
      };
      p.netInput = frame;
      this.pressed.set(id, new Set());
    }
  }

  step(dt = SIM_DT): void {
    this.time += dt;
    this.applyInputs();
    this.world.step(dt);
    // подбираемая добыча в боевых комнатах живёт только там, где её собирают (см. Пустоши)
    this.afterStep(dt);
  }

  protected afterStep(_dt: number): void {
    for (const e of this.world.entities) if (e instanceof Pickup) this.world.remove(e);
  }

  protected onDamage(_target: unknown, _source: unknown, _n: number): void {}
  protected onDamageAny(_target: unknown, _source: unknown): void {}
  protected abstract onHeroDeath(p: NetHero): void;

  /** Имя/подпись героя в снимке (команда, статус). */
  protected heroTag(p: NetHero): { n: string; c: string } {
    return { n: p.hero.name, c: p.team === 'enemy' ? 'red' : 'blue' };
  }

  snapshot(): NetEntity[] {
    const out: NetEntity[] = [];
    const r = (v: number) => Math.round(v * 10) / 10;
    for (const e of this.world.entities) {
      if (e.removed) continue;
      if (e instanceof NetHero) {
        const tag = this.heroTag(e);
        out.push({
          id: e.id, k: 'hero', x: r(e.x), y: r(e.y), s: e.hero.cls, f: e.facing, hp: Math.round(e.hp), mhp: e.maxHp,
          n: tag.n, c: tag.c, st: e.dead ? 'dead' : e.state, sp: Math.round(e.swingP * 100) / 100, a: Math.round(e.attackAngle * 100) / 100,
        });
      } else if (e instanceof Enemy) {
        const tg = e.telegraph();
        out.push({
          id: e.id, k: 'mob', x: r(e.x), y: r(e.y), s: e.def.sprite, f: e.facing, hp: Math.round(e.hp), mhp: e.maxHp,
          st: e.dead ? 'dead' : e.state, n: e.def.boss || e.def.elite ? e.def.id : undefined,
          tg: tg ? [tg.kind, r(tg.x), r(tg.y), Math.round(tg.angle * 100) / 100, Math.round(tg.p * 100) / 100] : undefined,
          a: tg ? Math.round((tg.r) * 10) / 10 : undefined, sp: tg ? Math.round(tg.half * 100) / 100 : undefined,
        });
      } else if (e instanceof Projectile) {
        out.push({ id: e.id, k: 'proj', x: r(e.x), y: r(e.y), s: e.sprite, a: Math.round(e.angle * 100) / 100, c: e.opts.color });
      } else if (e instanceof Pickup) {
        out.push({ id: e.id, k: 'loot', x: r(e.x), y: r(e.y), s: e.stack?.def ?? '__coin' });
      } else if (e instanceof Marker) {
        out.push({ id: e.id, k: 'fx', x: r(e.x), y: r(e.y), s: 'marker', a: e.r, sp: Math.round(e.p * 100) / 100 });
      }
    }
    return out;
  }

  takeFx(): Fx[] {
    return this.fx.take();
  }
}

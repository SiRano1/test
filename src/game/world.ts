import type { EventBus } from '../core/events';
import { dist } from '../core/math';
import { Rng } from '../core/rng';
import type { TileMap } from '../core/tilemap';
import type { TierDef } from '../data/tiers';
import { hitboxTouches, resolveHit, type Hitbox, type HitSpec } from './combat/combat';
import { Pickup } from './entities/pickup';
import { Actor, type Entity } from './entities/entity';
import type { GameEvents, Fx } from './events';
import type { GameState, SceneRef } from './state';
import type { ItemStack, Stats, WeaponClass } from './types';
import type { InputFrame } from './input';

export type WorldKind = 'town' | 'interior' | 'dungeon';

export interface SpawnSpec {
  x: number;
  y: number;
  facing?: 0 | 1 | 2 | 3;
}

/** То, что мир требует от игры (реализует Game). Разрывает циклическую зависимость. */
export interface GameApi {
  state: GameState;
  events: EventBus<GameEvents>;
  stats(): Stats;
  giveItem(stack: ItemStack): boolean;
  giveGold(n: number): void;
  addXp(n: number): void;
  addClassXp(cls: WeaponClass, n: number): void;
  useEnergy(n: number): boolean;
  onPlayerDeath(): void;
  toast(text: string, color?: string): void;
  goTo(ref: SceneRef, spawn?: SpawnSpec): void;
  talk(npcId: string): void;
  sleep(): void;
  readLore(id: string): void;
  openElevator(): void;
  openShop(id: string): void;
  descend(): void;
  ascendToTown(): void;
  bossDefeated(floor: number, id?: string): void;
  setBoss(e: Actor | null): void;
  markRunLoot(uid: string): void;
  openCrafting(station: import('../data/recipes').Station): void;
  openStorage(): void;
  counter(npc: string): void;
  plotAction(index: number): void;
  plotLabel(index: number): string;
}

/** Интерфейс ломаемых объектов (урны, жилы, треснувшие стены). */
export interface Breakable {
  breakable: true;
  onStruck(w: World, hb: Hitbox): void;
}

export function isBreakable(e: Entity): e is Entity & Breakable {
  return (e as any).breakable === true;
}

export class World {
  entities: Entity[] = [];
  hitboxes: Hitbox[] = [];
  time = 0;
  hitstopT = 0;
  player!: Actor & { controlled: true };
  rng: Rng;
  input: InputFrame | null = null;
  /** Тема рендера: 'town', 'interior', 'tier1'… */
  theme: string;
  /** Базовая тьма (подземелье). Для города считается по времени суток. */
  darkness = 0;
  floor = 0;
  tier: TierDef | null = null;
  /** Произвольные данные сцены (комнаты, арена босса…). */
  meta: Record<string, unknown> = {};
  private pending: Entity[] = [];

  constructor(
    readonly game: GameApi,
    readonly kind: WorldKind,
    readonly map: TileMap,
    seed: number,
    theme: string,
  ) {
    this.rng = new Rng(seed);
    this.theme = theme;
  }

  add<T extends Entity>(e: T): T {
    this.pending.push(e);
    return e;
  }

  /** Немедленное добавление (при построении сцены). */
  addNow<T extends Entity>(e: T): T {
    this.entities.push(e);
    e.onAdd?.(this);
    return e;
  }

  remove(e: Entity): void {
    e.removed = true;
  }

  fx(e: Fx): void {
    this.game.events.emit('fx', e);
  }

  hitstop(t: number): void {
    this.hitstopT = Math.max(this.hitstopT, t);
  }

  shake(power: number, dur: number): void {
    this.fx({ t: 'shake', power, dur });
  }

  spawnHitbox(h: Omit<Hitbox, 'hit'> & { hit?: Set<number> }): Hitbox {
    const hb: Hitbox = { ...h, hit: h.hit ?? new Set() };
    this.hitboxes.push(hb);
    return hb;
  }

  actors(): Actor[] {
    return this.entities.filter((e): e is Actor => e instanceof Actor && !e.dead);
  }

  enemies(): Actor[] {
    return this.entities.filter((e): e is Actor => e instanceof Actor && e.team === 'enemy' && !e.dead);
  }

  /** Расход стамины на блок: у игрока — реальная стамина, у монстров — всегда хватает. */
  drainStamina(a: Actor, n: number): boolean {
    const p = a as any;
    if (typeof p.stamina === 'number') {
      if (p.stamina <= 0) return false;
      p.stamina = Math.max(0, p.stamina - n * (p.blockCost ?? 1));
      p.staminaDelay = 0.8;
      return true;
    }
    return true;
  }

  onParry(target: Actor, _src: Actor | null): void {
    if (target === this.player) {
      (this.player as any).onParried?.();
      const cls = (this.player as any).weaponCls as WeaponClass | undefined;
      if (cls) this.game.addClassXp(cls, 3);
    }
  }

  onDamage(target: Actor, spec: HitSpec, n: number): void {
    if (spec.source === this.player && spec.cls) this.game.addClassXp(spec.cls, 1 + n / 12);
    if (target === this.player) (this.player as any).onHurt?.(this);
  }

  findInteractable(): Entity | null {
    const p = this.player;
    if (!p || p.dead) return null;
    const fx = Math.cos(p.aim), fy = Math.sin(p.aim);
    const px = p.x + fx * 8, py = p.y - 2 + fy * 8;
    let best: Entity | null = null;
    let bestD = Infinity;
    for (const e of this.entities) {
      const it = e.interaction;
      if (!it || e.removed) continue;
      if (it.enabled && !it.enabled(this)) continue;
      const d = Math.min(dist(px, py, e.x, e.y - 4), dist(p.x, p.y, e.x, e.y) + 4);
      const range = (it.range ?? 14) + Math.max(e.hw, e.hh);
      if (d <= range && d < bestD) {
        best = e;
        bestD = d;
      }
    }
    return best;
  }

  step(dt: number): void {
    if (this.pending.length) {
      for (const e of this.pending) {
        this.entities.push(e);
        e.onAdd?.(this);
      }
      this.pending = [];
    }
    if (this.hitstopT > 0) {
      this.hitstopT -= dt;
      return;
    }
    this.time += dt;
    for (const e of this.entities) if (!e.removed) e.update(this, dt);
    this.updateHitboxes(dt);
    this.separate();
    if (this.entities.some((e) => e.removed)) {
      for (const e of this.entities) if (e.removed) e.onRemove?.(this);
      this.entities = this.entities.filter((e) => !e.removed);
    }
  }

  private updateHitboxes(dt: number): void {
    const actors = this.actors();
    for (const hb of this.hitboxes) {
      if (hb.follow) {
        hb.x = hb.owner.x + hb.ox;
        hb.y = hb.owner.y + hb.oy;
      }
      if (hb.delay > 0) {
        hb.delay -= dt;
        continue;
      }
      // владелец погиб или оглушён — удар прерывается (кроме снарядов/отложенных ударов)
      if (hb.follow && (hb.owner.dead || hb.owner.stun > 0 || hb.owner.hurt > 0.15)) {
        hb.t = 0;
        continue;
      }
      for (const a of actors) {
        if (a.team === hb.team || a.team === 'neutral' || hb.hit.has(a.id)) continue;
        const pad = Math.max(a.hw, a.hh) + 2;
        if (!hitboxTouches(hb, a.x, a.y - 4, pad)) continue;
        hb.hit.add(a.id);
        let dx = a.x - hb.x, dy = a.y - hb.y;
        const l = Math.hypot(dx, dy) || 1;
        dx /= l;
        dy /= l;
        if (hb.shape === 'arc' && l < 4) {
          dx = Math.cos(hb.angle);
          dy = Math.sin(hb.angle);
        }
        resolveHit(this, a, hb.spec, dx, dy);
      }
      if (hb.breaks) {
        for (const e of this.entities) {
          if (!isBreakable(e) || e.removed || hb.hit.has(e.id)) continue;
          if (!hitboxTouches(hb, e.x, e.y - 4, Math.max(e.hw, e.hh) + 2)) continue;
          hb.hit.add(e.id);
          e.onStruck(this, hb);
        }
      }
      hb.t -= dt;
    }
    this.hitboxes = this.hitboxes.filter((h) => h.t > 0);
  }

  /** Мягкое расталкивание тел. */
  private separate(): void {
    const list = this.entities.filter((e) => e.pushable && !(e as Actor).dead);
    for (let i = 0; i < list.length; i++) {
      const a = list[i]!;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j]!;
        const ra = Math.max(a.hw, a.hh), rb = Math.max(b.hw, b.hh);
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const min = ra + rb;
        if (d >= min || d === 0) continue;
        const push = (min - d) * 0.5;
        const nx = dx / d, ny = dy / d;
        const total = a.mass + b.mass;
        const fa = b.mass / total, fb = a.mass / total;
        this.map.move(a, -nx * push * fa, -ny * push * fa, (a as Actor).flyer);
        this.map.move(b, nx * push * fb, ny * push * fb, (b as Actor).flyer);
      }
    }
  }

  /** Разбрасывает предметы и золото вокруг точки. */
  dropLoot(x: number, y: number, stacks: ItemStack[], gold: number): void {
    for (const s of stacks) this.add(new Pickup(x, y, this.rng, s, 0));
    if (gold > 0) {
      const coins = Math.min(6, Math.max(1, Math.round(gold / 15)));
      let left = gold;
      for (let i = 0; i < coins; i++) {
        const n = i === coins - 1 ? left : Math.max(1, Math.round(gold / coins));
        left -= n;
        if (n > 0) this.add(new Pickup(x, y, this.rng, null, n));
      }
    }
  }
}

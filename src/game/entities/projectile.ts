import { resolveHit, type HitSpec } from '../combat/combat';
import type { World } from '../world';
import { Entity, type Actor, type Team } from './entity';

export interface ProjectileOpts {
  pierce?: number;
  radius?: number;
  life?: number;
  /** Взрыв по площади при попадании/исчезновении. */
  explode?: { r: number; mult: number; color: string };
  color?: string;
  /** Пролетает сквозь стены (волны босса). */
  ghost?: boolean;
  /** Замедление/ускорение со временем (множитель скорости в секунду). */
  accel?: number;
}

export class Projectile extends Entity {
  vx: number;
  vy: number;
  life: number;
  pierce: number;
  radius: number;
  hitSet = new Set<number>();
  angle: number;
  reflected = false;

  constructor(
    x: number, y: number, angle: number, speed: number,
    public team: Team, public spec: HitSpec, sprite: string, public opts: ProjectileOpts = {},
  ) {
    super();
    this.x = x;
    this.y = y;
    this.z = 6;
    this.angle = angle;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.sprite = sprite;
    this.life = opts.life ?? 2.2;
    this.pierce = opts.pierce ?? 0;
    this.radius = opts.radius ?? 3;
    this.hw = this.hh = 1;
    if (opts.color) this.light = { r: 18, color: opts.color, power: 0.6 };
  }

  override update(w: World, dt: number): void {
    this.life -= dt;
    this.animT += dt;
    if (this.opts.accel) {
      const k = Math.pow(this.opts.accel, dt);
      this.vx *= k;
      this.vy *= k;
    }
    const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
    if (!this.opts.ghost && w.map.solidForFlyer(Math.floor(nx / 16), Math.floor(ny / 16))) {
      this.impact(w);
      return;
    }
    this.x = nx;
    this.y = ny;
    this.angle = Math.atan2(this.vy, this.vx);
    for (const a of w.actors()) {
      if (a.team === this.team || a.team === 'neutral' || this.hitSet.has(a.id)) continue;
      const r = this.radius + Math.max(a.hw, a.hh);
      if (Math.hypot(a.x - this.x, a.y - 4 - this.y) > r) continue;
      this.hitSet.add(a.id);
      const l = Math.hypot(this.vx, this.vy) || 1;
      const res = resolveHit(w, a, { ...this.spec, projectile: true }, this.vx / l, this.vy / l);
      if (res === 'parry') {
        this.reflect(w, a);
        return;
      }
      if (res === 'miss') continue;
      if (this.pierce-- <= 0) {
        this.impact(w);
        return;
      }
    }
    if (this.life <= 0) this.impact(w);
  }

  /** Отражение парированием: снаряд летит обратно, урон ×1.5. */
  private reflect(w: World, by: Actor): void {
    this.team = by.team;
    this.vx = -this.vx * 1.2;
    this.vy = -this.vy * 1.2;
    this.spec = { ...this.spec, dmg: this.spec.dmg * 1.5, source: by };
    this.hitSet.clear();
    this.hitSet.add(by.id);
    this.life = 1.5;
    this.reflected = true;
  }

  private impact(w: World): void {
    if (this.removed) return;
    w.remove(this);
    const ex = this.opts.explode;
    if (ex) {
      w.fx({ t: 'ring', x: this.x, y: this.y, r: ex.r, color: ex.color, dur: 0.3 });
      w.fx({ t: 'sfx', id: 'boom' });
      w.shake(2, 0.15);
      w.spawnHitbox({
        owner: (this.spec.source ?? w.player) as Actor, team: this.team, shape: 'circle', x: this.x, y: this.y, r: ex.r,
        angle: 0, half: 0, follow: false, ox: 0, oy: 0, t: 0.08, delay: 0, breaks: true,
        spec: { ...this.spec, dmg: this.spec.dmg * ex.mult, projectile: true }, hit: new Set(this.hitSet),
      });
    } else w.fx({ t: 'debris', x: this.x, y: this.y, color: this.opts.color ?? '#c8c0b0', n: 3 });
  }
}

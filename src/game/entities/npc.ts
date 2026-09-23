import { dist, facingFromVec, TILE } from '../../core/math';
import { findPath } from '../../core/pathfind';
import { npcDef, type NpcDef } from '../../data/npcs';
import { tr } from '../../data/strings';
import type { World } from '../world';
import { Entity } from './entity';

/** Житель: идёт по пути к цели расписания, у цели бродит в радиусе roam, поворачивается к герою. */
export class Npc extends Entity {
  def: NpcDef;
  homeX: number;
  homeY: number;
  moving = false;
  talking = false;
  /** Радиус блуждания у цели (px). */
  roam: number;
  idleFacing: 0 | 1 | 2 | 3;
  path: [number, number][] | null = null;
  private goalTx = -1;
  private goalTy = -1;
  private onArrive: (() => void) | null = null;
  private wanderT = 0;
  private wx: number;
  private wy: number;
  private stuck = 0;
  /** Уходит со сцены (не останавливается поговорить). */
  leaving = false;

  constructor(id: string, x: number, y: number, roam = 0, facing: 0 | 1 | 2 | 3 = 0) {
    super();
    this.def = npcDef(id);
    this.x = this.homeX = this.wx = x;
    this.y = this.homeY = this.wy = y;
    this.roam = roam;
    this.idleFacing = facing;
    this.facing = facing;
    this.hw = 5;
    this.hh = 3;
    this.sprite = `npc:${id}`;
    this.pushable = true;
    this.mass = 1000;
    this.wanderT = Math.random() * 3;
    this.interaction = {
      label: () => tr('talk'),
      range: 18,
      enabled: () => !this.leaving,
      act: (w) => w.game.talk(this.def.id),
    };
  }

  /** Отправить к тайлу (tx, ty). onArrive — по прибытии. */
  walkTo(w: World, tx: number, ty: number, roam: number, facing: 0 | 1 | 2 | 3, onArrive?: () => void): void {
    if (tx === this.goalTx && ty === this.goalTy && !onArrive) return;
    this.goalTx = tx;
    this.goalTy = ty;
    this.homeX = tx * TILE + 8;
    this.homeY = ty * TILE + 10;
    this.roam = roam * TILE;
    this.idleFacing = facing;
    this.onArrive = onArrive ?? null;
    this.leaving = !!onArrive;
    this.repath(w);
  }

  private repath(w: World): void {
    const sx = Math.floor(this.x / TILE), sy = Math.floor(this.y / TILE);
    this.path = findPath(w.map, sx, sy, this.goalTx, this.goalTy, 6000);
    this.stuck = 0;
    if (!this.path) {
      // цель недостижима — телепорт (редко: заблокированная дверь)
      this.x = this.homeX;
      this.y = this.homeY;
      this.arrive();
    }
  }

  private arrive(): void {
    this.path = null;
    this.wx = this.homeX;
    this.wy = this.homeY;
    const cb = this.onArrive;
    this.onArrive = null;
    cb?.();
  }

  override update(w: World, dt: number): void {
    this.animT += dt;
    const p = w.player;
    const near = !this.leaving && p && dist(p.x, p.y, this.x, this.y) < 26;
    if (this.talking || near) {
      this.moving = false;
      if (p) this.facing = facingFromVec(p.x - this.x, p.y - this.y, this.facing);
      return;
    }
    const sp = this.leaving ? 40 : 32;
    if (this.path) {
      if (!this.path.length) return this.arrive();
      const [tx, ty] = this.path[0]!;
      const gx = tx * TILE + 8, gy = ty * TILE + 10;
      const dx = gx - this.x, dy = gy - this.y;
      const d = Math.hypot(dx, dy);
      if (d < 3) {
        this.path.shift();
        return;
      }
      const ox = this.x, oy = this.y;
      w.map.move(this, (dx / d) * sp * dt, (dy / d) * sp * dt);
      if (Math.hypot(this.x - ox, this.y - oy) < sp * dt * 0.3) {
        this.stuck += dt;
        if (this.stuck > 1.5) this.repath(w);
      } else this.stuck = 0;
      this.facing = facingFromVec(dx, dy, this.facing);
      this.moving = true;
      return;
    }
    // у цели: лёгкое блуждание
    if (this.roam <= 0) {
      const dx = this.homeX - this.x, dy = this.homeY - this.y;
      if (Math.hypot(dx, dy) > 2) {
        w.map.move(this, Math.sign(dx) * Math.min(Math.abs(dx), sp * dt), Math.sign(dy) * Math.min(Math.abs(dy), sp * dt));
        this.moving = true;
      } else {
        this.facing = this.idleFacing;
        this.moving = false;
      }
      return;
    }
    this.wanderT -= dt;
    if (this.wanderT <= 0) {
      this.wanderT = 2 + Math.random() * 4;
      if (Math.random() < 0.6) {
        this.wx = this.homeX + (Math.random() * 2 - 1) * this.roam;
        this.wy = this.homeY + (Math.random() * 2 - 1) * this.roam * 0.6;
      }
    }
    const dx = this.wx - this.x, dy = this.wy - this.y;
    const d = Math.hypot(dx, dy);
    if (d > 2) {
      const hit = w.map.move(this, (dx / d) * 24 * dt, (dy / d) * 24 * dt);
      if (hit.hitX || hit.hitY) {
        this.wx = this.x;
        this.wy = this.y;
      }
      this.facing = facingFromVec(dx, dy, this.facing);
      this.moving = true;
    } else {
      this.moving = false;
      this.facing = this.idleFacing;
    }
  }
}

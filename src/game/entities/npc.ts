import { dist, facingFromVec } from '../../core/math';
import { npcDef, type NpcDef } from '../../data/npcs';
import { tr } from '../../data/strings';
import type { World } from '../world';
import { Entity } from './entity';

/** Житель города: бродит у своей точки, поворачивается к герою, говорит по E. */
export class Npc extends Entity {
  def: NpcDef;
  homeX: number;
  homeY: number;
  wanderT = 0;
  tx: number;
  ty: number;
  moving = false;
  talking = false;
  /** Радиус блуждания вокруг дома (px), 0 — стоит на месте. */
  roam: number;
  /** Фиксированное направление взгляда в покое. */
  idleFacing: 0 | 1 | 2 | 3;

  constructor(id: string, x: number, y: number, roam = 24, facing: 0 | 1 | 2 | 3 = 0) {
    super();
    this.def = npcDef(id);
    this.x = this.homeX = this.tx = x;
    this.y = this.homeY = this.ty = y;
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
      act: (w) => w.game.talk(this.def.id),
    };
  }

  override update(w: World, dt: number): void {
    this.animT += dt;
    const p = w.player;
    const near = p && dist(p.x, p.y, this.x, this.y) < 30;
    if (this.talking || near) {
      this.moving = false;
      if (p) this.facing = facingFromVec(p.x - this.x, p.y - this.y, this.facing);
      return;
    }
    if (this.roam <= 0) {
      this.facing = this.idleFacing;
      this.moving = false;
      return;
    }
    this.wanderT -= dt;
    if (this.wanderT <= 0) {
      this.wanderT = 2 + Math.random() * 4;
      if (Math.random() < 0.5) {
        this.tx = this.homeX + (Math.random() * 2 - 1) * this.roam;
        this.ty = this.homeY + (Math.random() * 2 - 1) * this.roam * 0.6;
      }
    }
    const dx = this.tx - this.x, dy = this.ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d > 2) {
      const sp = 28;
      const hit = w.map.move(this, (dx / d) * sp * dt, (dy / d) * sp * dt);
      if (hit.hitX || hit.hitY) {
        this.tx = this.x;
        this.ty = this.y;
      }
      this.facing = facingFromVec(dx, dy, this.facing);
      this.moving = true;
    } else this.moving = false;
  }
}

import type { Rng } from '../../core/rng';
import { itemDef } from '../../data/items';
import { RARITY_COLORS, type ItemStack } from '../types';
import type { World } from '../world';
import { Entity } from './entity';

/** Предмет или золото на земле: выпрыгивает, затем притягивается к герою. */
export class Pickup extends Entity {
  vx: number;
  vy: number;
  vz: number;
  age = 0;
  failedAt = -99;

  constructor(x: number, y: number, rng: Rng, public stack: ItemStack | null, public gold: number) {
    super();
    this.x = x;
    this.y = y;
    const a = rng.range(0, Math.PI * 2);
    const sp = rng.range(20, 55);
    this.vx = Math.cos(a) * sp;
    this.vy = Math.sin(a) * sp * 0.7;
    this.vz = rng.range(60, 110);
    this.z = 2;
    this.layer = 1;
    this.sprite = stack ? `icon:${stack.def}` : 'coin';
    if (stack && stack.rarity > 0) this.light = { r: 10 + stack.rarity * 4, color: RARITY_COLORS[stack.rarity], power: 0.5 };
  }

  override update(w: World, dt: number): void {
    this.age += dt;
    this.animT += dt;
    // баллистика «выпрыгивания»
    if (this.z > 0 || this.vz > 0) {
      this.vz -= 320 * dt;
      this.z = Math.max(0, this.z + this.vz * dt);
      if (this.z === 0 && this.vz < 0) this.vz = Math.abs(this.vz) > 40 ? -this.vz * 0.35 : 0;
      w.map.move(this, this.vx * dt, this.vy * dt);
      this.vx *= Math.pow(0.1, dt);
      this.vy *= Math.pow(0.1, dt);
    }
    const p = w.player;
    if (!p || p.dead || this.age < 0.45) return;
    const dx = p.x - this.x, dy = p.y - 4 - this.y;
    const d = Math.hypot(dx, dy);
    const recentlyFailed = w.time - this.failedAt < 1.5;
    if (d < 44 && !recentlyFailed) {
      const sp = 60 + (44 - d) * 5;
      this.x += (dx / d) * sp * dt;
      this.y += (dy / d) * sp * dt;
    }
    if (d < 7 && !recentlyFailed) this.collect(w);
  }

  private collect(w: World): void {
    if (this.stack) {
      const before = this.stack.qty;
      const ok = w.game.giveItem(this.stack);
      if (!ok) {
        this.failedAt = w.time;
        if (this.stack.qty === before) return;
      }
      if (this.stack.qty > 0) return;
      const d = itemDef(this.stack.def);
      w.fx({ t: 'sparkle', x: this.x, y: this.y, color: RARITY_COLORS[this.stack.rarity], n: 4 + this.stack.rarity * 3 });
      w.fx({ t: 'sfx', id: this.stack.rarity >= 2 ? 'rare' : 'pickup' });
      void d;
    } else {
      w.game.giveGold(this.gold);
      w.fx({ t: 'sfx', id: 'coin' });
      w.fx({ t: 'sparkle', x: this.x, y: this.y, color: '#ffd040', n: 3 });
    }
    w.remove(this);
  }
}

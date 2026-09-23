import type { HitSpec } from '../combat/combat';
import type { World } from '../world';
import { Entity, type Actor } from './entity';

/** Телеграф удара по площади: круг на полу растёт, затем наносит урон. */
export class Marker extends Entity {
  t = 0;

  constructor(x: number, y: number, public r: number, public delay: number, public owner: Actor, public spec: HitSpec, public color: string, public debris = true) {
    super();
    this.x = x;
    this.y = y;
    this.layer = 0;
    this.sprite = 'marker';
  }

  get p(): number {
    return Math.min(1, this.t / this.delay);
  }

  override update(w: World, dt: number): void {
    this.t += dt;
    if (this.t >= this.delay) {
      w.spawnHitbox({
        owner: this.owner, team: this.owner.team, shape: 'circle', x: this.x, y: this.y, r: this.r, angle: 0, half: Math.PI,
        follow: false, ox: 0, oy: 0, t: 0.1, delay: 0, breaks: false, spec: this.spec,
      });
      if (this.debris) w.fx({ t: 'debris', x: this.x, y: this.y, color: '#8a8070', n: 8 });
      w.fx({ t: 'ring', x: this.x, y: this.y, r: this.r, color: this.color, dur: 0.2 });
      w.fx({ t: 'sfx', id: 'boom', vol: 0.6 });
      w.shake(2, 0.12);
      w.remove(this);
    }
  }
}

import type { AttackDef } from '../../data/monsters';
import type { World } from '../world';
import { Enemy } from './enemy';
import { Marker } from './marker';

/**
 * Босс: общий ИИ монстра + фазы. Фаза 2 включается на 50% HP:
 * открывает «запасные» атаки (weight 0 → 2), ускоряет перезарядку и может телепортироваться.
 */
export class Boss extends Enemy {
  phase = 1;
  /** Арена босса (в пикселях) для телепортов и падающих камней. */
  arena: { x: number; y: number; w: number; h: number } | null = null;
  awake = false;
  intro = 0;

  constructor(id: string, x: number, y: number, floor: number) {
    super(id, x, y, floor);
    this.state = 'idle';
  }

  override update(w: World, dt: number): void {
    if (!this.awake) {
      this.animT += dt;
      const p = w.player;
      if (p && !p.dead && Math.hypot(p.x - this.x, p.y - this.y) < 110) {
        this.awake = true;
        this.intro = 1.2;
        w.game.setBoss(this);
        w.fx({ t: 'sfx', id: 'roar' });
        w.shake(4, 0.6);
      }
      return;
    }
    if (this.intro > 0) {
      this.intro -= dt;
      this.animT += dt;
      return;
    }
    super.update(w, dt);
    if (!this.dead && this.phase === 1 && this.hp < this.maxHp * 0.5) this.enterPhase2(w);
  }

  protected enterPhase2(w: World): void {
    this.phase = 2;
    this.stun = 0;
    this.hurt = 0;
    this.setState('recover');
    this.st = -0.6;
    w.fx({ t: 'flash', color: '#ffffff', dur: 0.25 });
    w.fx({ t: 'sfx', id: 'roar' });
    w.shake(5, 0.5);
    for (const a of this.def.attacks) a.weight === 0 && (this.cds[a.id] = 0);
  }

  protected override chooseAttack(w: World, d: number): AttackDef | null {
    const p = w.player;
    if (!p) return null;
    const ready = this.def.attacks.filter((a) => {
      const weight = a.weight === 0 ? (this.phase >= 2 ? 2 : 0) : (a.weight ?? 1);
      return weight > 0 && (this.cds[a.id] ?? 0) <= 0 && d <= a.range && d >= (a.minRange ?? 0);
    });
    if (!ready.length) return null;
    return w.rng.weighted(ready.map((a) => [a, a.weight === 0 ? 2 : (a.weight ?? 1)] as const));
  }

  protected override execute(w: World, a: AttackDef): void {
    // «Обвал» у Горма: несколько камней вокруг героя
    if (a.kind === 'slam' && this.def.id === 'gorm') {
      const p = w.player;
      if (p) {
        const n = this.phase >= 2 ? 6 : 4;
        for (let i = 0; i < n; i++) {
          const ang = w.rng.range(0, Math.PI * 2), r = w.rng.range(0, 50);
          w.add(new Marker(p.x + Math.cos(ang) * r, p.y + Math.sin(ang) * r, a.radius ?? 18, 0.9 + i * 0.12, this, this.spec(a), '#ff6040'));
        }
      }
      return;
    }
    super.execute(w, a);
    if (this.phase >= 2) this.cds[a.id] = (this.cds[a.id] ?? 0) * 0.7;
    // Настоятель после «кольца костей» телепортируется
    if (a.kind === 'nova' && this.def.id === 'bone_abbot' && this.arena) {
      const ar = this.arena;
      for (let i = 0; i < 12; i++) {
        const nx = w.rng.range(ar.x + 24, ar.x + ar.w - 24), ny = w.rng.range(ar.y + 24, ar.y + ar.h - 24);
        if (!w.map.overlapsSolid(nx, ny, this.hw, this.hh)) {
          w.fx({ t: 'death', x: this.x, y: this.y - 8, color: '#8fd0ff' });
          this.x = nx;
          this.y = ny;
          w.fx({ t: 'death', x: this.x, y: this.y - 8, color: '#8fd0ff' });
          break;
        }
      }
    }
  }

  override die(w: World): void {
    super.die(w);
    w.game.setBoss(null);
    w.fx({ t: 'flash', color: '#ffffff', dur: 0.5 });
    w.shake(6, 0.8);
  }
}

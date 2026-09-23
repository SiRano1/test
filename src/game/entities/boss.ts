import type { AttackDef } from '../../data/monsters';
import type { World } from '../world';
import { Enemy } from './enemy';
import { Marker } from './marker';

/** Боссы с третьей фазой (ярость на 25% HP). */
const RAGE = new Set(['brodrik', 'halvard', 'hunger_avatar', 'ash_seraph']);
/** Боссы, гасящие свет вокруг героя. */
const DARK = new Set(['keeper_silence']);

/**
 * Босс: общий ИИ монстра + фазы. Фаза 2 на 50% HP открывает «запасные» атаки (weight 0),
 * фаза 3 (у некоторых) на 25% — ускоряет замахи и перезарядку.
 */
export class Boss extends Enemy {
  phase = 1;
  arena: { x: number; y: number; w: number; h: number } | null = null;
  awake = false;
  intro = 0;

  constructor(id: string, x: number, y: number, floor: number) {
    super(id, x, y, floor);
    this.state = 'idle';
  }

  /** Гасит ли босс свет (для рендера). */
  get darkAura(): boolean {
    return this.awake && !this.dead && (DARK.has(this.def.id) || (this.def.id === 'halvard' && this.phase >= 3));
  }

  override update(w: World, dt: number): void {
    if (!this.awake) {
      this.animT += dt;
      const p = this.foe(w);
      if (p && !p.dead && Math.hypot(p.x - this.x, p.y - this.y) < 110) this.wake(w);
      return;
    }
    if (this.intro > 0) {
      this.intro -= dt;
      this.animT += dt;
      return;
    }
    super.update(w, dt);
    if (this.dead) return;
    if (this.phase === 1 && this.hp < this.maxHp * 0.5) this.enterPhase(w, 2);
    if (this.phase === 2 && RAGE.has(this.def.id) && this.hp < this.maxHp * 0.25) this.enterPhase(w, 3);
    w.meta.darkAura = this.darkAura;
  }

  wake(w: World): void {
    if (this.awake) return;
    this.awake = true;
    this.intro = 1.2;
    w.game.setBoss(this);
    w.fx({ t: 'sfx', id: 'roar' });
    w.shake(4, 0.6);
  }

  protected enterPhase(w: World, phase: number): void {
    this.phase = phase;
    this.stun = 0;
    this.hurt = 0;
    this.setState('recover');
    this.st = -0.6;
    w.fx({ t: 'flash', color: phase === 3 ? '#c040ff' : '#ffffff', dur: 0.3 });
    w.fx({ t: 'sfx', id: 'roar' });
    w.shake(5, 0.5);
    if (phase === 2) for (const a of this.def.attacks) if (a.weight === 0) this.cds[a.id] = 0;
    if (phase === 3) this.windupMul = 0.8;
  }

  protected override chooseAttack(w: World, d: number): AttackDef | null {
    const p = this.foe(w);
    if (!p) return null;
    const ready = this.def.attacks.filter((a) => {
      const weight = a.weight === 0 ? (this.phase >= 2 ? 2 : 0) : (a.weight ?? 1);
      return weight > 0 && (this.cds[a.id] ?? 0) <= 0 && d <= a.range && d >= (a.minRange ?? 0);
    });
    if (!ready.length) return null;
    return w.rng.weighted(ready.map((a) => [a, a.weight === 0 ? 2 : (a.weight ?? 1)] as const));
  }

  protected override execute(w: World, a: AttackDef): void {
    const p = this.foe(w);
    if (a.kind === 'slam' && p) {
      // «Дождь» маркеров вокруг героя: форма зависит от босса
      const spec = this.spec(a);
      const r = a.radius ?? 20;
      const color = a.element === 'fire' ? '#ff8030' : this.def.id === 'halvard' || this.def.id === 'hunger_avatar' ? '#a040ff' : '#ff4040';
      const pts: [number, number, number][] = [];
      if (this.def.id === 'ash_seraph') {
        // огненный крест
        for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]] as const) pts.push([p.x + dx * r * 1.6, p.y + dy * r * 1.6, 0.9 + Math.hypot(dx, dy) * 0.12]);
      } else if (this.def.id === 'brodrik' && this.arena) {
        // раскалённые сектора арены
        const ar = this.arena;
        for (let i = 0; i < (this.phase >= 3 ? 8 : 5); i++) pts.push([w.rng.range(ar.x + 20, ar.x + ar.w - 20), w.rng.range(ar.y + 20, ar.y + ar.h - 20), 1.1 + i * 0.1]);
        pts.push([p.x, p.y, 1.2]);
      } else {
        const n = this.phase >= 3 ? 7 : this.phase >= 2 ? 5 : 4;
        pts.push([p.x, p.y, 0.9]);
        for (let i = 1; i < n; i++) {
          const ang = w.rng.range(0, Math.PI * 2), rr = w.rng.range(20, 60);
          pts.push([p.x + Math.cos(ang) * rr, p.y + Math.sin(ang) * rr, 0.9 + i * 0.12]);
        }
      }
      for (const [x, y, delay] of pts) w.add(new Marker(x, y, r, delay * this.windupMul + 0.2, this, spec, color, this.def.id !== 'halvard'));
      return;
    }
    super.execute(w, a);
    if (this.phase >= 2) this.cds[a.id] = (this.cds[a.id] ?? 0) * (this.phase >= 3 ? 0.55 : 0.7);
    // телепорт после «кольца»: Настоятель, Хранитель, Аватар
    if (a.kind === 'nova' && this.arena && ['bone_abbot', 'keeper_silence', 'hunger_avatar'].includes(this.def.id)) {
      const ar = this.arena;
      for (let i = 0; i < 12; i++) {
        const nx = w.rng.range(ar.x + 24, ar.x + ar.w - 24), ny = w.rng.range(ar.y + 24, ar.y + ar.h - 24);
        if (!w.map.overlapsSolid(nx, ny, this.hw, this.hh, this.flyer)) {
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
    w.meta.darkAura = false;
    w.fx({ t: 'flash', color: '#ffffff', dur: 0.5 });
    w.shake(6, 0.8);
  }
}

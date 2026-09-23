import { angleDiff, dist } from '../../core/math';
import { findPath } from '../../core/pathfind';
import { monsterDef, type AttackDef, type MonsterDef } from '../../data/monsters';
import type { HitSpec } from '../combat/combat';
import { rollEquipment, makeItem } from '../systems/loot';
import type { World } from '../world';
import { Actor } from './entity';
import { Marker } from './marker';
import { Projectile } from './projectile';

export type EnemyState = 'idle' | 'chase' | 'windup' | 'active' | 'recover';

/** Масштаб силы монстра от этажа (относительно начала его родного яруса). */
export function floorScale(floor: number, tier: number): number {
  const rel = Math.max(0, floor - ((tier - 1) * 10 + 1));
  return 1 + 0.1 * rel;
}

export interface Telegraph {
  kind: AttackDef['kind'];
  x: number;
  y: number;
  angle: number;
  r: number;
  half: number;
  /** 0..1 */
  p: number;
}

export class Enemy extends Actor {
  def: MonsterDef;
  state: EnemyState = 'idle';
  st = 0;
  atk: AttackDef | null = null;
  cds: Record<string, number> = {};
  lockAngle = 0;
  lockX = 0;
  lockY = 0;
  homeX: number;
  homeY: number;
  wanderT = 0;
  wanderA = 0;
  path: [number, number][] | null = null;
  pathT = 0;
  lastSeen = -99;
  atkPower: number;
  xp: number;
  summoned: Enemy[] = [];
  /** Призван другим монстром (не даёт лута). */
  minion = false;
  wobble = Math.random() * 10;

  constructor(id: string, x: number, y: number, public floor: number) {
    super();
    this.def = monsterDef(id);
    const d = this.def;
    // у боссов характеристики подобраны вручную — без масштабирования по этажу
    const sc = d.boss ? 1 : floorScale(floor, d.tier);
    this.x = this.homeX = x;
    this.y = this.homeY = y;
    this.team = 'enemy';
    this.hp = this.maxHp = Math.round(d.hp * sc);
    this.atkPower = d.atk * sc;
    this.stats.def = d.def * (1 + 0.05 * Math.max(0, floor - 1));
    this.xp = Math.round(d.xp * (0.8 + 0.2 * sc));
    this.hw = d.hw;
    this.hh = d.hh;
    this.poise = d.poise;
    this.mass = d.mass;
    this.flyer = !!d.flyer;
    this.undead = !!d.undead;
    this.resist = d.resist ?? {};
    this.sprite = d.sprite;
    this.light = d.light ? { ...d.light, power: 0.7 } : undefined;
    this.wanderT = Math.random() * 2;
    for (const a of d.attacks) this.cds[a.id] = Math.random() * 0.8;
  }

  /** Данные для отрисовки телеграфа атаки. */
  telegraph(): Telegraph | null {
    if (this.state !== 'windup' || !this.atk) return null;
    const a = this.atk;
    const p = Math.min(1, this.st / a.windup);
    switch (a.kind) {
      case 'arc':
        return { kind: 'arc', x: this.x, y: this.y - 4, angle: this.lockAngle, r: a.radius ?? 20, half: a.arc ?? 1, p };
      case 'lunge':
        return { kind: 'lunge', x: this.x, y: this.y - 4, angle: this.lockAngle, r: (a.lungeSpeed ?? 150) * a.active, half: 0, p };
      case 'nova':
        return { kind: 'nova', x: this.x, y: this.y - 4, angle: 0, r: a.radius ?? 40, half: Math.PI, p };
      case 'projectile':
        return { kind: 'projectile', x: this.x, y: this.y - 6, angle: this.lockAngle, r: 26, half: a.spread ?? 0, p };
      default:
        return { kind: a.kind, x: this.x, y: this.y - 6, angle: 0, r: 0, half: 0, p };
    }
  }

  protected canSee(w: World): boolean {
    const p = w.player;
    if (!p || p.dead) return false;
    const d = dist(this.x, this.y, p.x, p.y);
    if (d > this.def.aggro * 16) return false;
    return w.map.lineOfSight(this.x, this.y - 4, p.x, p.y - 4);
  }

  protected setState(s: EnemyState): void {
    this.state = s;
    this.st = 0;
  }

  override update(w: World, dt: number): void {
    this.animT += dt;
    this.flash = Math.max(0, this.flash - dt);
    if (this.dead) {
      this.deathT += dt;
      this.alpha = Math.max(0, 1 - this.deathT / 0.45);
      if (this.deathT > 0.45) w.remove(this);
      return;
    }
    this.tickStatuses(w, dt);
    if (this.dead) return;
    for (const k in this.cds) this.cds[k] = Math.max(0, this.cds[k]! - dt);
    this.applyKnock(w, dt);
    if (this.stun > 0) {
      this.stun -= dt;
      if (this.state === 'windup' || this.state === 'active') this.setState('recover');
      return;
    }
    if (this.hurt > 0) {
      this.hurt -= dt;
      // лёгкий удар сбивает замах (если монстр не устойчив)
      if (this.state === 'windup' && this.poise < 0.9) this.setState('chase');
      return;
    }
    this.st += dt;
    this.think(w, dt);
  }

  protected think(w: World, dt: number): void {
    const p = w.player;
    switch (this.state) {
      case 'idle': {
        this.wander(w, dt);
        if (this.canSee(w)) {
          this.lastSeen = w.time;
          this.setState('chase');
          w.fx({ t: 'text', x: this.x, y: this.y - 22, text: '!', color: '#ff5050' });
        }
        break;
      }
      case 'chase': {
        if (!p || p.dead) return this.setState('idle');
        if (this.canSee(w)) this.lastSeen = w.time;
        else if (w.time - this.lastSeen > 6) return this.setState('idle');
        const d = dist(this.x, this.y, p.x, p.y);
        const attack = this.chooseAttack(w, d);
        if (attack && this.st > 0.15) return this.beginAttack(w, attack);
        this.approach(w, dt, d);
        break;
      }
      case 'windup': {
        const a = this.atk!;
        // отслеживаем цель, кроме последних 30% замаха
        if (p && this.st < a.windup * 0.7 && a.kind !== 'slam') this.lockAngle = this.turnToward(this.lockAngle, Math.atan2(p.y - this.y, p.x - this.x), 4 * dt);
        this.facingFrom(this.lockAngle);
        if (this.st >= a.windup) {
          this.setState('active');
          this.execute(w, a);
        }
        break;
      }
      case 'active': {
        const a = this.atk!;
        if (a.kind === 'lunge') {
          const sp = a.lungeSpeed ?? 150;
          const hit = w.map.move(this, Math.cos(this.lockAngle) * sp * dt, Math.sin(this.lockAngle) * sp * dt, this.flyer);
          if ((hit.hitX || hit.hitY) && this.def.ai === 'charger') {
            // врезался в стену — оглушён
            this.stun = 1.2;
            w.shake(2, 0.15);
            w.fx({ t: 'debris', x: this.x + Math.cos(this.lockAngle) * 8, y: this.y, color: '#8a8070', n: 6 });
            this.setState('recover');
            return;
          }
        }
        if (this.st >= a.active) this.setState('recover');
        break;
      }
      case 'recover': {
        if (this.st >= (this.atk?.recover ?? 0.4)) this.setState('chase');
        break;
      }
    }
  }

  protected turnToward(cur: number, target: number, maxStep: number): number {
    let d = target - cur;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return cur + Math.max(-maxStep, Math.min(maxStep, d));
  }

  protected facingFrom(a: number): void {
    const c = Math.cos(a);
    this.flip = c < 0;
    this.facing = Math.abs(c) > Math.abs(Math.sin(a)) ? (c < 0 ? 1 : 2) : Math.sin(a) < 0 ? 3 : 0;
  }

  protected chooseAttack(w: World, d: number): AttackDef | null {
    const p = w.player;
    if (!p) return null;
    const los = w.map.lineOfSight(this.x, this.y - 4, p.x, p.y - 4);
    const ready = this.def.attacks.filter(
      (a) => (this.cds[a.id] ?? 0) <= 0 && d <= a.range && d >= (a.minRange ?? 0) && (a.weight ?? 1) > 0 && (los || a.kind === 'summon'),
    );
    if (!ready.length) return null;
    return w.rng.weighted(ready.map((a) => [a, a.weight ?? 1] as const));
  }

  protected beginAttack(w: World, a: AttackDef): void {
    const p = w.player;
    this.atk = a;
    this.setState('windup');
    this.lockAngle = p ? Math.atan2(p.y - this.y, p.x - this.x) : 0;
    if (p) {
      this.lockX = p.x;
      this.lockY = p.y;
    }
    this.cds[a.id] = a.cooldown + a.windup + a.active + a.recover;
    if (a.kind === 'slam' && p) {
      w.add(new Marker(p.x, p.y, a.radius ?? 20, a.windup, this, this.spec(a), '#ff4040'));
    }
    w.fx({ t: 'sfx', id: 'windup', vol: 0.4 });
  }

  spec(a: AttackDef): HitSpec {
    return {
      dmg: this.atkPower * a.dmg, element: a.element ?? 'phys', crit: 0.03, critMul: 1.5,
      knock: 120 * (a.kind === 'lunge' ? 1.3 : 1), heavy: a.dmg >= 1.3, unblockable: a.unblockable,
      status: a.status, source: this,
    };
  }

  protected execute(w: World, a: AttackDef): void {
    const spec = this.spec(a);
    const ang = this.lockAngle;
    switch (a.kind) {
      case 'arc':
        w.spawnHitbox({ owner: this, team: 'enemy', shape: 'arc', x: this.x, y: this.y - 4, r: a.radius ?? 20, angle: ang, half: a.arc ?? 1, follow: true, ox: 0, oy: -4, t: a.active, delay: 0, breaks: false, spec });
        w.fx({ t: 'slash', x: this.x, y: this.y - 4, angle: ang, r: a.radius ?? 20, half: a.arc ?? 1, color: '#ff9090', dur: a.active + 0.05 });
        w.fx({ t: 'sfx', id: 'eswing' });
        break;
      case 'lunge':
        w.spawnHitbox({ owner: this, team: 'enemy', shape: 'circle', x: this.x, y: this.y - 4, r: Math.max(this.hw, this.hh) + 5, angle: 0, half: Math.PI, follow: true, ox: 0, oy: -4, t: a.active, delay: 0, breaks: false, spec });
        w.fx({ t: 'sfx', id: 'lunge' });
        break;
      case 'projectile': {
        const n = a.projCount ?? 1;
        const spread = a.spread ?? 0;
        for (let i = 0; i < n; i++) {
          const off = n === 1 ? 0 : -spread / 2 + (spread * i) / (n - 1);
          const wave = a.projSprite === 'wave';
          w.add(new Projectile(this.x, this.y - 6, ang + off, a.projSpeed ?? 140, 'enemy', spec, a.projSprite ?? 'arrow', {
            life: wave ? 2.4 : 2, radius: wave ? 7 : 3, ghost: wave, color: a.projSprite === 'bone_shard' ? '#c8d8ff' : undefined,
          }));
        }
        w.fx({ t: 'sfx', id: 'bow' });
        break;
      }
      case 'nova':
        w.spawnHitbox({ owner: this, team: 'enemy', shape: 'circle', x: this.x, y: this.y - 4, r: a.radius ?? 40, angle: 0, half: Math.PI, follow: false, ox: 0, oy: 0, t: a.active, delay: 0, breaks: false, spec });
        w.fx({ t: 'ring', x: this.x, y: this.y - 4, r: a.radius ?? 40, color: '#c8d8ff', dur: 0.35 });
        w.shake(3, 0.25);
        w.fx({ t: 'sfx', id: 'boom' });
        break;
      case 'summon': {
        const s = a.summon!;
        this.summoned = this.summoned.filter((m) => !m.dead && !m.removed);
        const n = Math.min(s.count, s.max - this.summoned.length);
        for (let i = 0; i < n; i++) {
          const ang2 = (i / Math.max(1, n)) * Math.PI * 2 + w.rng.range(0, 1);
          let sx = this.x + Math.cos(ang2) * 24, sy = this.y + Math.sin(ang2) * 24;
          if (w.map.overlapsSolid(sx, sy, 5, 3)) {
            sx = this.x;
            sy = this.y;
          }
          // приспешники босса — с базовыми характеристиками яруса, иначе бой превращается в свалку
          const m = new Enemy(s.id, sx, sy, this.def.boss ? (this.def.tier - 1) * 10 + 3 : this.floor);
          m.minion = true;
          m.state = 'chase';
          this.summoned.push(w.add(m));
          w.fx({ t: 'death', x: sx, y: sy, color: '#c8d8ff' });
        }
        w.fx({ t: 'sfx', id: 'summon' });
        break;
      }
      case 'slam':
        break; // урон наносит Marker
    }
  }

  protected approach(w: World, dt: number, d: number): void {
    const p = w.player!;
    const sp = this.def.speed * this.moveMul();
    let tx = p.x, ty = p.y;
    const keep = this.def.keepDistance;
    let dirSign = 1;
    if (keep) {
      if (d < keep - 12) dirSign = -1;
      else if (d < keep + 16) {
        // держим дистанцию — стрейф
        const a = Math.atan2(p.y - this.y, p.x - this.x) + Math.PI / 2;
        const s = Math.sin(w.time * 0.9 + this.wobble) > 0 ? 1 : -1;
        w.map.move(this, Math.cos(a) * sp * 0.5 * s * dt, Math.sin(a) * sp * 0.5 * s * dt, this.flyer);
        this.facingFrom(Math.atan2(p.y - this.y, p.x - this.x));
        return;
      }
    }
    const los = w.map.lineOfSight(this.x, this.y - 2, p.x, p.y - 2);
    if (!los && !this.flyer) {
      this.pathT -= dt;
      if (this.pathT <= 0 || !this.path) {
        this.pathT = 0.5;
        this.path = findPath(w.map, Math.floor(this.x / 16), Math.floor(this.y / 16), Math.floor(p.x / 16), Math.floor(p.y / 16), 600);
      }
      if (this.path && this.path.length) {
        const [nx, ny] = this.path[0]!;
        tx = nx * 16 + 8;
        ty = ny * 16 + 8;
        if (dist(this.x, this.y, tx, ty) < 4) this.path.shift();
      }
    } else this.path = null;
    let ax = tx - this.x, ay = ty - this.y;
    const l = Math.hypot(ax, ay) || 1;
    ax /= l;
    ay /= l;
    if (this.def.ai === 'flyer') {
      // рваный полёт летучей мыши
      const perp = Math.sin(w.time * 6 + this.wobble) * 0.8;
      ax += -ay * perp;
      ay += ax * perp;
    }
    w.map.move(this, ax * sp * dirSign * dt, ay * sp * dirSign * dt, this.flyer);
    this.facingFrom(Math.atan2(p.y - this.y, p.x - this.x));
  }

  protected wander(w: World, dt: number): void {
    this.wanderT -= dt;
    if (this.wanderT <= 0) {
      this.wanderT = w.rng.range(1, 3);
      this.wanderA = w.rng.chance(0.4) ? NaN : w.rng.range(0, Math.PI * 2);
      if (dist(this.x, this.y, this.homeX, this.homeY) > 40) this.wanderA = Math.atan2(this.homeY - this.y, this.homeX - this.x);
    }
    if (!Number.isNaN(this.wanderA)) {
      const sp = this.def.speed * 0.35;
      w.map.move(this, Math.cos(this.wanderA) * sp * dt, Math.sin(this.wanderA) * sp * dt, this.flyer);
      this.facingFrom(this.wanderA);
    }
  }

  override die(w: World): void {
    if (this.dead) return;
    this.dead = true;
    this.deathT = 0;
    this.pushable = false;
    w.fx({ t: 'death', x: this.x, y: this.y - 6, color: this.undead ? '#e8e0c8' : '#a04040', big: !!this.def.boss || !!this.def.elite });
    w.fx({ t: 'sfx', id: this.def.boss ? 'bossdie' : 'die' });
    for (const m of this.summoned) if (!m.dead) m.die(w);
    if (this.minion) return;
    w.game.addXp(this.xp);
    const rng = w.rng;
    const stacks = [];
    for (const [item, chance, min, max] of this.def.drops) if (rng.chance(chance)) stacks.push(makeItem(rng, item, 0, rng.int(min, max)));
    const luck = w.game.stats().luck;
    const eqChance = this.def.boss ? 1 : this.def.elite ? 0.5 : 0.04 + luck * 0.002;
    if (rng.chance(eqChance)) stacks.push(rollEquipment(rng, { floor: this.floor, tier: this.def.tier, luck }, this.def.boss ? 4 : this.def.elite ? 2 : 0, this.def.boss ? 2 : 0));
    const gold = rng.int(this.def.gold[0], this.def.gold[1]);
    w.dropLoot(this.x, this.y - 4, stacks, Math.round(gold * floorScale(this.floor, this.def.tier)));
    w.game.state.stats[`kill_${this.def.id}`] = (w.game.state.stats[`kill_${this.def.id}`] ?? 0) + 1;
    if (this.def.boss) w.game.bossDefeated(this.floor);
  }

  /** Угол между взглядом и направлением на цель (для ИИ блока/уклонения). */
  facingDiff(x: number, y: number): number {
    return angleDiff(this.lockAngle, Math.atan2(y - this.y, x - this.x));
  }
}

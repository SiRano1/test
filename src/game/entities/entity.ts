import type { Facing } from '../../core/math';
import { baseStats, type Element, type Stats, type StatusId } from '../types';
import type { World } from '../world';

export interface Light {
  r: number;
  color: string;
  flicker?: number;
  /** 0..1 — насколько «прожигает» тьму. */
  power?: number;
}

export interface Interaction {
  label: () => string;
  /** Дальность от точки перед героем (px). */
  range?: number;
  enabled?: (w: World) => boolean;
  act: (w: World) => void;
}

export abstract class Entity {
  static seq = 1;
  readonly id = Entity.seq++;
  x = 0;
  y = 0;
  /** Высота над землёй (визуально). */
  z = 0;
  hw = 4;
  hh = 3;
  removed = false;
  /** Участвует в мягком расталкивании. */
  pushable = false;
  /** Масса для расталкивания. */
  mass = 1;
  sprite = '';
  facing: Facing = 0;
  animT = 0;
  flash = 0;
  /** 0 — декаль на полу, 1 — сортировка по Y, 2 — поверх всего. */
  layer: 0 | 1 | 2 = 1;
  light?: Light;
  interaction?: Interaction;
  /** Прозрачность при отрисовке. */
  alpha = 1;
  /** Спрайт отражён по X. */
  flip = false;

  update(_w: World, _dt: number): void {}
  onAdd?(w: World): void;
  onRemove?(w: World): void;
}

/** 'trap' — ловушки: бьют и героя, и чудовищ. */
export type Team = 'player' | 'enemy' | 'neutral' | 'trap' | `p:${string}`;

export interface Status {
  id: StatusId;
  t: number;
  power: number;
  tick: number;
}

export abstract class Actor extends Entity {
  team: Team = 'neutral';
  hp = 10;
  maxHp = 10;
  stats: Stats = baseStats();
  /** Скорость отбрасывания. */
  kx = 0;
  ky = 0;
  invuln = 0;
  stun = 0;
  hurt = 0;
  poise = 0;
  flyer = false;
  dead = false;
  deathT = 0;
  undead = false;
  resist: Partial<Record<Element, number>> = {};
  statuses: Status[] = [];
  blocking = false;
  blockStart = -99;
  blockRatio = 0.6;
  parryWindow = 0.15;
  /** Множитель входящего урона (сюжетный режим). */
  dmgTakenMul = 1;
  /** Направление взгляда/прицела (рад). */
  aim = Math.PI / 2;
  override pushable = true;

  hasStatus(id: StatusId): boolean {
    return this.statuses.some((s) => s.id === id);
  }

  addStatus(id: StatusId, duration: number, power = 1): void {
    const ex = this.statuses.find((s) => s.id === id);
    if (ex) {
      ex.t = Math.max(ex.t, duration);
      ex.power = Math.max(ex.power, power);
    } else this.statuses.push({ id, t: duration, power, tick: 0 });
  }

  /** Множитель скорости от статусов. */
  moveMul(): number {
    let m = 1;
    if (this.hasStatus('slow')) m *= 0.55;
    if (this.hasStatus('freeze')) m *= 0.3;
    return m;
  }

  /** Тикает статусы; возвращает урон за кадр (для чисел урона). */
  tickStatuses(w: World, dt: number): void {
    for (const s of this.statuses) {
      s.t -= dt;
      s.tick -= dt;
      if (s.tick <= 0 && (s.id === 'burn' || s.id === 'poison' || s.id === 'bleed')) {
        s.tick = s.id === 'bleed' ? 0.5 : 1;
        const dmg = Math.max(1, Math.round(s.power * (s.id === 'burn' ? 3 : s.id === 'poison' ? 2 : 2.5)));
        if (!this.dead) {
          this.hp -= dmg;
          w.fx({ t: 'dmg', x: this.x, y: this.y - 14, n: dmg, color: s.id === 'burn' ? '#ff9a40' : s.id === 'poison' ? '#9ae05a' : '#e04848' });
          if (this.hp <= 0) this.die(w, null);
        }
      }
    }
    this.statuses = this.statuses.filter((s) => s.t > 0);
  }

  /** Применяет отбрасывание с трением. */
  applyKnock(w: World, dt: number): void {
    if (Math.abs(this.kx) < 1 && Math.abs(this.ky) < 1) {
      this.kx = this.ky = 0;
      return;
    }
    w.map.move(this, this.kx * dt, this.ky * dt, this.flyer);
    const f = Math.pow(0.0015, dt);
    this.kx *= f;
    this.ky *= f;
  }

  abstract die(w: World, killer: Actor | null): void;
}

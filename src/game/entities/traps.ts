import { TILE } from '../../core/math';
import { L, t } from '../../data/loc';
import { tr } from '../../data/strings';
import type { HitSpec } from '../combat/combat';
import type { StatusId } from '../types';
import type { Breakable, World } from '../world';
import type { Hitbox } from '../combat/combat';
import type { Actor } from './entity';
import { Chest, Prop } from './props';
import { Projectile } from './projectile';

export type TrapKind = 'spikes' | 'dart' | 'fire' | 'frost' | 'spore';

const center = (tx: number) => tx * TILE + 8;

/** Урон ловушек растёт с глубиной, но не зависит от уровня героя. */
export const trapDamage = (floor: number) => 6 + floor * 1.5;

function trapSpec(w: World, mult: number, extra: Partial<HitSpec> = {}): HitSpec {
  return { dmg: trapDamage(w.floor) * mult, crit: 0, critMul: 1, knock: 60, source: null, ...extra };
}

/** Удар ловушки по всем телам в круге (и героям, и чудовищам). */
function burst(w: World, x: number, y: number, r: number, t: number, spec: HitSpec): void {
  w.spawnHitbox({
    owner: w.player as Actor, team: 'trap', shape: 'circle', x, y, r, angle: 0, half: Math.PI,
    follow: false, ox: 0, oy: 0, t, delay: 0, breaks: false, spec,
  });
}

const near = (w: World, x: number, y: number, d: number) => {
  const p = w.player;
  return !!p && Math.hypot(p.x - x, p.y - y) < d;
};

/** Шипы: спрятаны → дрожат → выскакивают. Ритм виден заранее. */
export class SpikeTrap extends Prop {
  phase = 0;
  private t: number;

  constructor(tx: number, ty: number, offset: number) {
    super(center(tx), ty * TILE + 15, 'trap:spikes:0', { layer: 0, hw: 7, hh: 7 });
    this.t = offset;
  }

  override update(w: World, dt: number): void {
    this.t += dt;
    const p = this.t % 2.8;
    const ph = p < 1.6 ? 0 : p < 2.05 ? 1 : 2;
    if (ph === this.phase) return;
    this.phase = ph;
    this.sprite = `trap:spikes:${ph}`;
    if (ph === 1 && near(w, this.x, this.y, 90)) w.fx({ t: 'sfx', id: 'trap' });
    if (ph === 2) burst(w, this.x, this.y - 7, 8, 0.6, trapSpec(w, 1, { unblockable: true, status: { id: 'bleed', chance: 0.3, duration: 2, power: 1 } }));
  }
}

/** Решётка с пламенем: копит жар и выбрасывает столб огня. */
export class FireGrate extends Prop {
  phase = 0;
  private t: number;

  constructor(tx: number, ty: number, offset: number) {
    super(center(tx), ty * TILE + 15, 'trap:fire:0', { layer: 0, hw: 7, hh: 7 });
    this.t = offset;
  }

  override update(w: World, dt: number): void {
    this.t += dt;
    const p = this.t % 3.6;
    const ph = p < 2.4 ? 0 : p < 3.0 ? 1 : 2;
    if (ph !== this.phase) {
      this.phase = ph;
      this.sprite = `trap:fire:${ph}`;
      this.light = ph === 0 ? undefined : { r: ph === 2 ? 40 : 18, color: '#ff8030', power: ph === 2 ? 0.9 : 0.4, flicker: 0.2 };
      if (ph === 2) {
        if (near(w, this.x, this.y, 120)) w.fx({ t: 'sfx', id: 'flame' });
        burst(w, this.x, this.y - 7, 13, 0.55, trapSpec(w, 0.9, { unblockable: true, element: 'fire', status: { id: 'burn', chance: 0.8, duration: 3, power: Math.max(1, w.floor / 8) } }));
      }
    }
    if (ph === 2 && (this.t * 20) % 2 < 1) w.fx({ t: 'sparkle', x: this.x, y: this.y - 10, color: '#ffa040', n: 1 });
  }
}

/** Руна-ловушка: срабатывает, когда на неё наступают (иней или споры). */
export class RuneTrap extends Prop {
  private armed = 0;
  private cooldown = 0;

  constructor(tx: number, ty: number, public kind: 'frost' | 'spore') {
    super(center(tx), ty * TILE + 15, `trap:${kind}:0`, { layer: 0, hw: 7, hh: 7 });
  }

  override update(w: World, dt: number): void {
    if (this.cooldown > 0) {
      this.cooldown -= dt;
      if (this.cooldown <= 0) this.sprite = `trap:${this.kind}:0`;
      return;
    }
    if (this.armed > 0) {
      this.armed -= dt;
      if (this.armed <= 0) this.fire(w);
      return;
    }
    for (const a of w.actors()) {
      if (a.flyer || Math.hypot(a.x - this.x, a.y - (this.y - 7)) > 7) continue;
      this.armed = 0.4;
      this.sprite = `trap:${this.kind}:1`;
      this.light = { r: 20, color: this.kind === 'frost' ? '#8ad8ff' : '#a0e060', power: 0.6 };
      w.fx({ t: 'sfx', id: 'trap' });
      return;
    }
  }

  private fire(w: World): void {
    const frost = this.kind === 'frost';
    const col = frost ? '#8ad8ff' : '#a0d060';
    const status: { id: StatusId; chance: number; duration: number; power?: number } = frost
      ? { id: 'freeze', chance: 1, duration: 1.6 }
      : { id: 'poison', chance: 1, duration: 5, power: Math.max(1, w.floor / 10) };
    burst(w, this.x, this.y - 7, 24, 0.15, trapSpec(w, 0.6, { unblockable: true, element: frost ? 'ice' : 'phys', status }));
    w.fx({ t: 'ring', x: this.x, y: this.y - 7, r: 24, color: col, dur: 0.35 });
    w.fx({ t: 'sparkle', x: this.x, y: this.y - 8, color: col, n: 12 });
    w.fx({ t: 'sfx', id: frost ? 'cast' : 'pot' });
    this.cooldown = 7;
    this.light = undefined;
  }
}

/** Самострел в стене: стреляет вниз по комнате, когда герой рядом. Дротик можно отбить парированием. */
export class DartTrap extends Prop {
  private t: number;

  constructor(tx: number, ty: number, offset: number) {
    super(center(tx), ty * TILE + 12, 'trap:dart', { layer: 0, hw: 4, hh: 4 });
    this.t = offset;
  }

  override update(w: World, dt: number): void {
    this.t -= dt;
    if (this.t > 0) return;
    const p = w.player;
    if (!p || p.dead || Math.abs(p.x - this.x) > 60 || p.y < this.y || p.y - this.y > 170) {
      this.t = 0.3;
      return;
    }
    this.t = 2.2;
    w.fx({ t: 'sfx', id: 'bow' });
    w.add(new Projectile(this.x, this.y + 4, Math.PI / 2, 190, 'trap', trapSpec(w, 0.8, { knock: 40, status: w.tier && w.tier.id >= 3 ? { id: 'poison', chance: 0.4, duration: 3, power: 1 } : undefined }), 'dart', { life: 1.2 }));
  }
}

// ─────────────────────────── Головоломки ───────────────────────────

export const PLATE_SYMBOLS = [L('Солнце', 'Sun'), L('Луна', 'Moon'), L('Звезда', 'Star'), L('Корона', 'Crown')];

/** Сундук под печатью: открывается, когда головоломка решена. */
export class SealedChest extends Chest {
  sealed = true;

  constructor(x: number, y: number) {
    super(x, y, 2);
    this.sprite = 'chest_sealed';
    this.light = { r: 16, color: '#8a70c0', power: 0.3 };
    const base = this.interaction!;
    this.interaction = {
      label: () => (this.sealed ? t(L('Запечатано', 'Sealed')) : base.label()),
      enabled: (w) => (this.sealed ? true : base.enabled!(w)),
      act: (w) => {
        if (this.sealed) w.fx({ t: 'text', x: this.x, y: this.y - 20, text: t(L('Печать держит крышку', 'The seal holds the lid')), color: '#c0a8ff' });
        else base.act(w);
      },
    };
  }

  unseal(w: World, quiet = false): void {
    if (!this.sealed) return;
    this.sealed = false;
    this.sprite = 'chest_epic';
    this.light = { r: 30, color: '#c07bff', power: 0.5 };
    if (quiet) return;
    w.fx({ t: 'sparkle', x: this.x, y: this.y - 8, color: '#c07bff', n: 20 });
    w.fx({ t: 'sfx', id: 'solve' });
    w.game.toast(t(L('Механизм щёлкнул — печать снята!', 'The mechanism clicks — the seal is broken!')), '#c0a8ff');
    w.game.state.stats.puzzles = (w.game.state.stats.puzzles ?? 0) + 1;
  }
}

/** Плиты с символами: наступить в порядке, выбитом на скрижали. */
export class PlatePuzzle {
  progress = 0;
  plates: PressurePlate[] = [];
  solved = false;

  constructor(public order: number[], public chest: SealedChest) {}

  press(w: World, plate: PressurePlate): void {
    if (this.solved) return;
    if (plate.symbol === this.order[this.progress]) {
      plate.pressed = true;
      this.progress++;
      w.fx({ t: 'sfx', id: 'plate' });
      if (this.progress >= this.order.length) {
        this.solved = true;
        this.chest.unseal(w);
      }
      return;
    }
    // ошибка: плиты сбрасываются, из щелей бьёт пар
    this.progress = 0;
    for (const p of this.plates) p.pressed = false;
    w.fx({ t: 'sfx', id: 'block' });
    w.fx({ t: 'ring', x: plate.x, y: plate.y - 7, r: 14, color: '#e0e0e0', dur: 0.3 });
    burst(w, plate.x, plate.y - 7, 10, 0.1, trapSpec(w, 0.4, { unblockable: true }));
  }

  orderText(): string {
    return this.order.map((i) => t(PLATE_SYMBOLS[i]!)).join(' → ');
  }
}

export class PressurePlate extends Prop {
  pressed = false;
  private onIt = false;

  constructor(tx: number, ty: number, public symbol: number, private puzzle: PlatePuzzle) {
    super(center(tx), ty * TILE + 15, `plate:${symbol}:0`, { layer: 0, hw: 7, hh: 7 });
    puzzle.plates.push(this);
  }

  override update(w: World): void {
    this.sprite = `plate:${this.symbol}:${this.pressed || this.puzzle.solved ? 1 : 0}`;
    const p = w.player;
    const on = !!p && !p.dead && Math.hypot(p.x - this.x, p.y - (this.y - 7)) < 7;
    if (on && !this.onIt && !this.pressed) this.puzzle.press(w, this);
    this.onIt = on;
  }
}

/** Скрижаль на стене с порядком символов. */
export class Tablet extends Prop {
  constructor(tx: number, ty: number, puzzle: PlatePuzzle) {
    super(center(tx), ty * TILE + 15, `tablet:${puzzle.order.join('')}`, { layer: 0, hw: 8, hh: 6 });
    this.interaction = {
      label: () => tr('read'),
      range: 20,
      act: (w) => w.fx({ t: 'text', x: this.x, y: this.y + 4, text: puzzle.orderText(), color: '#f0e0b0' }),
    };
  }
}

/** Жаровни: зажечь все одновременно ударами (каждая гаснет через несколько секунд). */
export class BrazierPuzzle {
  braziers: PuzzleBrazier[] = [];
  solved = false;

  constructor(public chest: SealedChest) {}

  check(w: World): void {
    if (this.solved || !this.braziers.every((b) => b.lit > 0)) return;
    this.solved = true;
    for (const b of this.braziers) b.lit = Infinity;
    this.chest.unseal(w);
  }
}

export class PuzzleBrazier extends Prop implements Breakable {
  readonly breakable = true as const;
  lit = 0;

  constructor(tx: number, ty: number, private puzzle: BrazierPuzzle, private burnTime: number) {
    super(center(tx), ty * TILE + 13, 'pbrazier:0', { block: true, hw: 4, hh: 3 });
    puzzle.braziers.push(this);
  }

  onStruck(w: World, hb: Hitbox): void {
    if (hb.owner !== w.player || this.puzzle.solved) return;
    this.lit = this.burnTime;
    this.flash = 0.1;
    w.fx({ t: 'sfx', id: 'flame' });
    w.fx({ t: 'sparkle', x: this.x, y: this.y - 12, color: '#ffa040', n: 6 });
    this.puzzle.check(w);
  }

  override update(_w: World, dt: number): void {
    if (this.lit > 0 && this.lit !== Infinity) this.lit = Math.max(0, this.lit - dt);
    const on = this.lit > 0;
    this.sprite = on ? 'brazier' : 'pbrazier:0';
    // догорающая жаровня мерцает слабее
    this.light = on ? { r: this.lit < 1.5 ? 30 : 52, color: '#ffb060', power: 0.85, flicker: this.lit < 1.5 ? 0.4 : 0.12 } : undefined;
  }
}

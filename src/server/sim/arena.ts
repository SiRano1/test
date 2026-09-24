import { TILE } from '../../core/math';
import { Tile } from '../../core/tilemap';
import { ABYSS_BOSSES, bossForFloor, TIERS } from '../../data/tiers';
import { Boss } from '../../game/entities/boss';
import { Enemy } from '../../game/entities/enemy';
import type { ArenaMode } from '../../online/protocol';
import { arenaMap, SimCore } from './core';
import type { NetHero, SimHero } from './hero';

export interface ArenaResult {
  mode: ArenaMode;
  ranked: boolean;
  winners: string[];
  losers: string[];
  draw: boolean;
  waves: number;
  duration: number;
}

export const FIGHT_LIMIT = 180;
export const COUNTDOWN = 3;

/**
 * Арена: дуэль 1×1, бой 3×3 (уничтожение команды) и PvE-волны.
 * Команда A — 'player', команда B — 'enemy': хитбоксы разных команд бьют друг друга.
 */
export class ArenaSim extends SimCore {
  phase: 'countdown' | 'fight' | 'between' | 'over' = 'countdown';
  timer = COUNTDOWN;
  wave = 0;
  fightTime = 0;
  result: ArenaResult | null = null;
  readonly side = new Map<string, 'A' | 'B'>();

  /** Кооперативные режимы: все герои в одной команде против чудовищ. */
  readonly coop: boolean;
  boss: Boss | null = null;

  constructor(readonly mode: ArenaMode, readonly ranked: boolean, entrants: { hero: SimHero; team: 'A' | 'B' }[], seed: number, readonly week = 0) {
    const coop = mode === 'waves' || mode === 'raid';
    super(coop ? arenaMap(30, 20) : arenaMap(), mode === 'waves' ? 'tier6' : mode === 'raid' ? 'tier8' : 'tier7', seed, mode === 'waves' ? 1 : 7);
    this.coop = coop;
    const W = this.map.w * TILE, H = this.map.h * TILE;
    const idx = { A: 0, B: 0 };
    for (const { hero, team } of entrants) {
      const i = idx[team]++;
      const x = coop ? W / 2 + (i - 2) * 24 : team === 'A' ? 4 * TILE : W - 4 * TILE;
      const y = coop ? H - 5 * TILE : H / 2 + (i - 1) * 36;
      const p = this.addHero(hero, x, y, coop || team === 'A' ? 'player' : 'enemy', ranked);
      p.aim = team === 'A' ? 0 : Math.PI;
      this.side.set(hero.id, team);
    }
  }

  alive(team: 'A' | 'B'): NetHero[] {
    return [...this.heroes.values()].filter((p) => this.side.get(p.hero.id) === team && !p.dead);
  }

  override step(dt?: number): void {
    if (this.phase === 'over') return;
    if (this.phase === 'countdown') {
      this.timer -= dt ?? 1 / 30;
      this.latest.clear(); // до старта герои стоят
      this.pressed.clear();
      super.step(dt);
      if (this.timer <= 0) {
        this.phase = this.mode === 'waves' ? 'between' : 'fight';
        this.timer = 0.5;
        if (this.mode === 'raid') this.spawnRaidBoss();
      }
      return;
    }
    super.step(dt);
    const d = dt ?? 1 / 30;
    if (this.mode === 'waves') return this.stepWaves(d);
    if (this.mode === 'raid') return this.stepRaid(d);
    this.fightTime += d;
    const a = this.alive('A').length, b = this.alive('B').length;
    if (!a || !b) return this.finish(a ? 'A' : b ? 'B' : null);
    if (this.fightTime >= FIGHT_LIMIT) {
      // время вышло: побеждает команда с большей долей здоровья
      const share = (t: 'A' | 'B') => this.alive(t).reduce((s, p) => s + p.hp / p.maxHp, 0);
      const sa = share('A'), sb = share('B');
      this.finish(Math.abs(sa - sb) < 0.05 ? null : sa > sb ? 'A' : 'B');
    }
  }

  private stepWaves(dt: number): void {
    const heroesAlive = [...this.heroes.values()].some((p) => !p.dead);
    if (!heroesAlive) {
      this.phase = 'over';
      this.result = { mode: 'waves', ranked: false, winners: [], losers: [...this.heroes.keys()], draw: false, waves: Math.max(0, this.wave - 1), duration: this.time };
      return;
    }
    if (this.phase === 'between') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.spawnWave(++this.wave);
        this.phase = 'fight';
      }
      return;
    }
    if (!this.world.enemies().length) {
      this.phase = 'between';
      this.timer = 4;
      // передышка: немного здоровья и все павшие встают
      for (const p of this.heroes.values()) {
        if (p.dead) {
          p.dead = false;
          p.state = 'free';
          p.hp = Math.round(p.maxHp * 0.3);
        } else p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.25);
      }
    }
  }

  /**
   * Рейд «Разлом»: босс недели (эхо прежних стражей по кругу) с силой Бездны,
   * здоровье растёт с числом участников.
   */
  spawnRaidBoss(): void {
    const id = ABYSS_BOSSES[this.week % ABYSS_BOSSES.length]!;
    const b = new Boss(id, (this.map.w / 2) * TILE, 5 * TILE, 90);
    const party = this.heroes.size;
    b.hp = b.maxHp = Math.round(b.maxHp * (0.6 + 0.35 * party));
    b.arena = { x: 0, y: 0, w: this.map.w * TILE, h: this.map.h * TILE };
    this.world.add(b);
    b.wake(this.world);
    this.boss = b;
  }

  private stepRaid(dt: number): void {
    this.fightTime += dt;
    const ids = [...this.heroes.keys()];
    if (this.boss?.dead) {
      this.phase = 'over';
      this.result = { mode: 'raid', ranked: false, winners: ids, losers: [], draw: false, waves: 0, duration: this.fightTime };
    } else if (![...this.heroes.values()].some((p) => !p.dead) || this.fightTime > 600) {
      this.phase = 'over';
      this.result = { mode: 'raid', ranked: false, winners: [], losers: ids, draw: false, waves: 0, duration: this.fightTime };
    }
  }

  /** Волна n: ярус растёт каждые две волны, каждая 5-я — с элитой, каждая 10-я — с боссом. */
  spawnWave(n: number): void {
    const tier = TIERS[Math.min(6, Math.floor((n - 1) / 2))]!;
    const floor = (tier.id - 1) * 10 + 1 + ((n - 1) % 2) * 4;
    this.world.tier = tier;
    const count = Math.min(14, 2 + n);
    const spots = this.freeTiles();
    const rng = this.world.rng;
    for (let i = 0; i < count && spots.length; i++) {
      const [tx, ty] = spots.splice(rng.int(0, spots.length - 1), 1)[0]!;
      this.world.add(new Enemy(rng.weighted(tier.monsters), tx * TILE + 8, ty * TILE + 8, floor));
    }
    if (n % 5 === 0 && tier.elites.length && spots.length) {
      const [tx, ty] = spots.pop()!;
      this.world.add(new Enemy(rng.pick(tier.elites), tx * TILE + 8, ty * TILE + 8, floor));
    }
    if (n % 10 === 0) {
      const b = new Boss(bossForFloor(Math.min(60, tier.id * 10)), (this.map.w / 2) * TILE, 3 * TILE, tier.id * 10);
      b.arena = { x: 0, y: 0, w: this.map.w * TILE, h: this.map.h * TILE };
      this.world.add(b);
      b.wake(this.world);
    }
  }

  private freeTiles(): [number, number][] {
    const out: [number, number][] = [];
    const heroes = [...this.heroes.values()];
    for (let y = 2; y < this.map.h - 2; y++)
      for (let x = 2; x < this.map.w - 2; x++) {
        if (this.map.get(x, y) !== Tile.FLOOR) continue;
        const px = x * TILE + 8, py = y * TILE + 8;
        if (heroes.some((h) => Math.hypot(h.x - px, h.y - py) < 90)) continue;
        out.push([x, y]);
      }
    return out;
  }

  private finish(winner: 'A' | 'B' | null): void {
    this.phase = 'over';
    const ids = [...this.side.keys()];
    this.result = {
      mode: this.mode, ranked: this.ranked, draw: winner === null, waves: 0, duration: this.fightTime,
      winners: winner ? ids.filter((id) => this.side.get(id) === winner) : [],
      losers: winner ? ids.filter((id) => this.side.get(id) !== winner) : [],
    };
  }

  /** Сдача / отключение: герой считается павшим. */
  forfeit(heroId: string): void {
    const p = this.heroes.get(heroId);
    if (p && !p.dead) p.die(this.world);
  }

  protected onHeroDeath(_p: NetHero): void {}

  protected override heroTag(p: NetHero) {
    return { n: p.hero.name, c: this.coop ? 'blue' : this.side.get(p.hero.id) === 'A' ? 'blue' : 'red' };
  }

  hud() {
    return {
      wave: this.mode === 'waves' ? this.wave : undefined,
      timer: this.phase === 'countdown' ? Math.ceil(this.timer) : this.coop ? undefined : Math.max(0, Math.ceil(FIGHT_LIMIT - this.fightTime)),
      teams: this.coop ? undefined : ([this.alive('A').length, this.alive('B').length] as [number, number]),
      msg: this.mode === 'raid' && this.boss ? `boss:${Math.round((100 * Math.max(0, this.boss.hp)) / this.boss.maxHp)}` : undefined,
    };
  }
}


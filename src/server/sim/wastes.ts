import { TILE } from '../../core/math';
import { Tile } from '../../core/tilemap';
import { TIERS } from '../../data/tiers';
import { Enemy } from '../../game/entities/enemy';
import type { Actor } from '../../game/entities/entity';
import { Pickup } from '../../game/entities/pickup';
import type { ItemStack } from '../../game/types';
import { karmaStatus } from '../../online/protocol';
import { CAMP, inCamp, SimCore, territoryAt, wastesMap, WASTES_H, WASTES_W } from './core';
import { NetHero, type SimHero } from './hero';

export const FLAG_TIME = 120;
export const RESPAWN = 5;
export const MOB_TARGET = 26;
export const LOOT_DECAY = 60;
const RED = -300;

/** Всё, что Пустоши сохраняют в БД (реализует комната). */
export interface WastesHooks {
  /** Подобрана добыча: stack с dbUid — выпавшая вещь игрока, иначе новая. */
  loot(heroId: string, stack: ItemStack | null, gold: number, dbUid: string | null): void;
  /** Удар по «синему» без флага: вернуть новую карму нападавшего. */
  attack(attackerId: string, victimId: string): number;
  /** Убийство героя героем: вернуть новую карму убийцы и награду. */
  kill(killerId: string, victimId: string, victimFlagged: boolean, territory: number): { karma: number; bounty: number };
  /** Потеря при смерти: снять стопки у жертвы и вернуть их для выброса на землю. */
  drop(victimId: string): ItemStack[];
  /** Выпавшая вещь никем не подобрана — вернуть владельцу. */
  expire(dbUid: string, ownerId: string): void;
  monsterKill(heroId: string, territory: number, xp: number): void;
}

interface DropInfo {
  dbUid: string;
  owner: string;
  age: number;
}

/**
 * Пепельные Пустоши: открытое PvP. Каждый герой — своя команда (p:<id>), монстры бьют всех,
 * в лагере в центре драться нельзя. Карма, фиолетовый флаг, отступники, потеря вещей при смерти.
 */
export class WastesSim extends SimCore {
  private respawnAt = new Map<string, number>();
  private drops = new Map<Pickup, DropInfo>();
  private mobTimer = 0;
  /** Кто по кому бил недавно: чтобы штраф за нападение шёл один раз на жертву. */
  private aggression = new Map<string, number>();

  constructor(readonly hooks: WastesHooks, seed = 11) {
    super(wastesMap(seed), 'tier6', seed, 6);
    this.world.hooks.canHit = (src, target) => this.canHit(src, target);
    for (let i = 0; i < MOB_TARGET; i++) this.spawnMob();
  }

  campSpawn(): [number, number] {
    const rng = this.world.rng;
    return [(CAMP.x + 1 + rng.int(0, CAMP.w - 3)) * TILE + 8, (CAMP.y + 1 + rng.int(0, CAMP.h - 3)) * TILE + 10];
  }

  join(h: SimHero): NetHero {
    const [x, y] = this.campSpawn();
    return this.addHero(h, x, y, `p:${h.id}`, false);
  }

  flagged(p: NetHero): boolean {
    return this.time - p.aggressedAt < FLAG_TIME;
  }

  status(p: NetHero): 'blue' | 'purple' | 'red' {
    return karmaStatus(p.hero.karma, this.flagged(p));
  }

  private canHit(src: Actor | null, target: Actor): boolean {
    if (!(src instanceof NetHero) || !(target instanceof NetHero)) {
      // монстры не заходят в лагерь, а если дотянутся — лагерь всё равно защищает
      return !(target instanceof NetHero && inCamp(target.x, target.y));
    }
    return !inCamp(src.x, src.y) && !inCamp(target.x, target.y);
  }

  protected override onDamage(target: unknown, source: unknown, _n: number): void {
    if (!(target instanceof NetHero) || !(source instanceof NetHero) || source === target) return;
    target.lastHitBy = source;
    target.lastHitAt = this.time;
    const key = `${source.hero.id}>${target.hero.id}`;
    const innocent = !this.flagged(target) && target.hero.karma >= RED;
    if (innocent && this.time - (this.aggression.get(key) ?? -999) > FLAG_TIME) {
      this.aggression.set(key, this.time);
      source.hero.karma = this.hooks.attack(source.hero.id, target.hero.id);
    }
    if (innocent) source.aggressedAt = this.time;
  }

  protected onHeroDeath(p: NetHero): void {
    const killer = p.lastHitBy && this.time - p.lastHitAt < 10 ? p.lastHitBy : null;
    const t = territoryAt(p.x, p.y);
    if (killer && killer !== p) {
      const r = this.hooks.kill(killer.hero.id, p.hero.id, this.flagged(p), t);
      killer.hero.karma = r.karma;
      if (r.bounty) this.world.fx({ t: 'text', x: killer.x, y: killer.y - 28, text: `+${r.bounty}`, color: '#ffd040' });
    }
    // потеря при смерти: стопки падают на землю, их может подобрать кто угодно
    for (const st of this.hooks.drop(p.hero.id)) {
      const pk = new Pickup(p.x, p.y, this.world.rng, st, 0);
      this.world.add(pk);
      this.drops.set(pk, { dbUid: st.uid, owner: p.hero.id, age: 0 });
    }
    this.respawnAt.set(p.hero.id, this.time + RESPAWN);
  }

  protected override afterStep(dt: number): void {
    // воскрешение в лагере
    for (const [id, at] of this.respawnAt) {
      if (this.time < at) continue;
      const p = this.heroes.get(id);
      this.respawnAt.delete(id);
      if (!p) continue;
      const [x, y] = this.campSpawn();
      p.x = x;
      p.y = y;
      p.dead = false;
      p.state = 'free';
      p.hp = p.maxHp;
      p.statuses = [];
      p.invuln = 2;
    }
    // лагерь лечит
    for (const p of this.heroes.values()) if (!p.dead && inCamp(p.x, p.y)) p.hp = Math.min(p.maxHp, p.hp + 8 * dt);
    // добыча: подбирает ближайший живой герой
    for (const e of this.world.entities) {
      if (!(e instanceof Pickup) || e.removed) continue;
      const info = this.drops.get(e);
      if (info) info.age += dt;
      if (e.age < 0.5) continue;
      let best: NetHero | null = null, bd = 12;
      for (const h of this.heroes.values()) {
        if (h.dead) continue;
        const d = Math.hypot(h.x - e.x, h.y - 4 - e.y);
        if (d < bd) {
          bd = d;
          best = h;
        }
      }
      if (best) {
        this.hooks.loot(best.hero.id, e.stack, e.stack ? 0 : e.gold, info?.dbUid ?? null);
        this.drops.delete(e);
        this.world.remove(e);
        this.world.fx({ t: 'sfx', id: e.stack ? 'pickup' : 'coin' });
      } else if ((info && info.age > LOOT_DECAY) || (!info && e.age > LOOT_DECAY)) {
        if (info) this.hooks.expire(info.dbUid, info.owner);
        this.drops.delete(e);
        this.world.remove(e);
      }
    }
    // убитые монстры: опыт и очки территории тому, кто добил; новые монстры взамен
    for (const e of this.world.entities) {
      if (!(e instanceof Enemy) || !e.dead || (e as any).credited) continue;
      (e as any).credited = true;
      const killer = (e as any).lastHitBy as NetHero | undefined;
      if (killer) this.hooks.monsterKill(killer.hero.id, territoryAt(e.x, e.y), e.xp);
    }
    this.mobTimer -= dt;
    if (this.mobTimer <= 0) {
      this.mobTimer = 3;
      if (this.world.enemies().length < MOB_TARGET) this.spawnMob();
    }
  }

  protected override onDamageAny(target: unknown, source: unknown): void {
    if (target instanceof Enemy && source instanceof NetHero) (target as any).lastHitBy = source;
  }

  /** Монстр на случайной клетке вне лагеря: чем дальше от центра, тем глубже ярус. */
  spawnMob(): void {
    const rng = this.world.rng;
    for (let tries = 0; tries < 30; tries++) {
      const tx = rng.int(3, WASTES_W - 4), ty = rng.int(3, WASTES_H - 4);
      if (this.map.get(tx, ty) !== Tile.FLOOR) continue;
      const cx = CAMP.x + CAMP.w / 2, cy = CAMP.y + CAMP.h / 2;
      const d = Math.hypot(tx - cx, ty - cy);
      if (d < 10) continue;
      if ([...this.heroes.values()].some((h) => Math.hypot(h.x - tx * TILE, h.y - ty * TILE) < 120)) continue;
      const tier = TIERS[Math.min(6, 2 + Math.floor(d / 9))]!;
      const floor = (tier.id - 1) * 10 + 3;
      const id = rng.chance(0.08) && tier.elites.length ? rng.pick(tier.elites) : rng.weighted(tier.monsters);
      // вызывается вне шага мира (в конструкторе и после step) — можно добавлять сразу
      this.world.addNow(new Enemy(id, tx * TILE + 8, ty * TILE + 8, floor));
      return;
    }
  }

  protected override heroTag(p: NetHero) {
    return { n: p.hero.guildTag ? `[${p.hero.guildTag}] ${p.hero.name}` : p.hero.name, c: this.status(p) };
  }

  hudFor(p: NetHero) {
    return { msg: inCamp(p.x, p.y) ? 'camp' : `t${territoryAt(p.x, p.y)}`, timer: this.respawnAt.has(p.hero.id) ? Math.ceil(this.respawnAt.get(p.hero.id)! - this.time) : undefined };
  }
}

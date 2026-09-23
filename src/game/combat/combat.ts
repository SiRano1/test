import { angleDiff, pointInArc } from '../../core/math';
import type { Element, StatusId, WeaponClass } from '../types';
import type { Actor, Team } from '../entities/entity';
import type { World } from '../world';

export interface HitSpec {
  /** Урон до защиты цели (уже с атакой, множителем удара и % бонусами). */
  dmg: number;
  element?: Element;
  /** Плоский стихийный урон. */
  fire?: number;
  ice?: number;
  shock?: number;
  holy?: number;
  crit: number;
  critMul: number;
  /** Сила отбрасывания (px/s). */
  knock: number;
  heavy?: boolean;
  unblockable?: boolean;
  status?: { id: StatusId; chance: number; duration: number; power?: number };
  /** Оглушение при попадании (с). */
  stunOnHit?: number;
  lifesteal?: number;
  source: Actor | null;
  cls?: WeaponClass;
  projectile?: boolean;
}

export interface Hitbox {
  owner: Actor;
  team: Team;
  shape: 'arc' | 'circle';
  x: number;
  y: number;
  r: number;
  angle: number;
  half: number;
  /** Следовать за владельцем со смещением (ox, oy). */
  follow: boolean;
  ox: number;
  oy: number;
  /** Сколько ещё активен. */
  t: number;
  /** Задержка до активации. */
  delay: number;
  hit: Set<number>;
  spec: HitSpec;
  /** Может ломать объекты (урны, жилы, треснувшие стены). */
  breaks: boolean;
}

export type HitResult = 'miss' | 'parry' | 'block' | 'hit' | 'kill' | 'guardbreak';

/** Проверка попадания хитбокса по телу цели. */
export function hitboxTouches(hb: Hitbox, tx: number, ty: number, pad: number): boolean {
  if (hb.shape === 'circle') return Math.hypot(tx - hb.x, ty - hb.y) <= hb.r + pad;
  return pointInArc(tx, ty, hb.x, hb.y, hb.r, hb.angle, hb.half, pad);
}

/**
 * Разрешение удара: неуязвимость → блок/парирование → формула урона → статусы → отбрасывание.
 * Формула (GDD §6.4): dmg × 100/(100+DEF) × (1−резист) → крит → ±10%.
 */
export function resolveHit(w: World, target: Actor, spec: HitSpec, dirX: number, dirY: number): HitResult {
  if (target.dead) return 'miss';
  if (target.invuln > 0) return 'miss';

  const src = spec.source;
  // Блок: удар должен прийти спереди (в пределах ~100° от взгляда цели).
  if (target.blocking && !spec.unblockable) {
    const incoming = Math.atan2(-dirY, -dirX);
    if (angleDiff(incoming, target.aim) < 1.75) {
      const sinceBlock = w.time - target.blockStart;
      if (sinceBlock <= target.parryWindow) {
        w.fx({ t: 'parry', x: target.x + Math.cos(target.aim) * 8, y: target.y - 8 + Math.sin(target.aim) * 8 });
        w.fx({ t: 'sfx', id: 'parry' });
        w.hitstop(0.12);
        if (src && !spec.projectile && !src.dead) {
          src.stun = Math.max(src.stun, 1.3);
          src.kx += -dirX * 90;
          src.ky += -dirY * 90;
        }
        w.onParry(target, src);
        return 'parry';
      }
      const absorbed = spec.dmg * target.blockRatio;
      const through = spec.dmg - absorbed;
      const staminaCost = absorbed * 0.9 + (spec.heavy ? 15 : 0);
      if (w.drainStamina(target, staminaCost)) {
        applyDamage(w, target, { ...spec, dmg: through, crit: 0, status: undefined, knock: spec.knock * 0.4 }, dirX, dirY, true);
        w.fx({ t: 'block', x: target.x + Math.cos(target.aim) * 7, y: target.y - 8 + Math.sin(target.aim) * 7 });
        w.fx({ t: 'sfx', id: 'block' });
        return target.dead ? 'kill' : 'block';
      }
      // пробитие защиты
      target.stun = Math.max(target.stun, 0.7);
      target.blocking = false;
      w.fx({ t: 'text', x: target.x, y: target.y - 22, text: '!', color: '#ffd040' });
      applyDamage(w, target, spec, dirX, dirY, false);
      return target.dead ? 'kill' : 'guardbreak';
    }
  }
  applyDamage(w, target, spec, dirX, dirY, false);
  return target.dead ? 'kill' : 'hit';
}

function applyDamage(w: World, target: Actor, spec: HitSpec, dirX: number, dirY: number, blocked: boolean): void {
  const rng = w.rng;
  const def = target.stats.def;
  let dmg = spec.dmg * (100 / (100 + def * 2));
  const res = (e: Element) => 1 - (target.resist[e] ?? 0);
  if (spec.element && spec.element !== 'phys') dmg *= res(spec.element);
  let extra = (spec.fire ?? 0) * res('fire') + (spec.ice ?? 0) * res('ice') + (spec.shock ?? 0) * res('shock');
  extra += (spec.holy ?? 0) * res('holy') * (target.undead ? 2 : 1);
  if (spec.element === 'holy' && target.undead) dmg *= 1.5;
  dmg += extra;
  let crit = false;
  if (!blocked && rng.chance(spec.crit + (target.stun > 0 ? 0.25 : 0))) {
    crit = true;
    dmg *= target.stun > 0 ? Math.max(spec.critMul, 2.5) : spec.critMul;
  }
  dmg *= rng.range(0.9, 1.1);
  const n = Math.max(1, Math.round(dmg));
  target.hp -= n;
  target.flash = 0.12;

  // статусы
  if (!blocked) {
    if (spec.status && rng.chance(spec.status.chance)) target.addStatus(spec.status.id, spec.status.duration, spec.status.power ?? 1);
    if ((spec.fire ?? 0) > 0 && rng.chance(0.2)) target.addStatus('burn', 3, Math.max(1, (spec.fire ?? 0) / 3));
    if ((spec.ice ?? 0) > 0 && rng.chance(0.3)) target.addStatus('slow', 2);
    if (spec.element === 'fire' && rng.chance(0.25)) target.addStatus('burn', 3, Math.max(1, spec.dmg / 12));
    if (spec.element === 'ice' && rng.chance(0.35)) target.addStatus('slow', 2.5);
    if (spec.stunOnHit) target.stun = Math.max(target.stun, spec.stunOnHit);
  }

  // отбрасывание и оглушение (стаггер)
  const massK = 1 / Math.max(0.3, target.mass);
  target.kx += dirX * spec.knock * massK;
  target.ky += dirY * spec.knock * massK;
  if (!blocked && (spec.heavy || !rng.chance(target.poise))) target.hurt = Math.max(target.hurt, spec.heavy ? 0.35 : 0.2);

  w.fx({ t: 'dmg', x: target.x + rng.range(-3, 3), y: target.y - 16, n, crit, color: target.team === 'player' ? '#ff6060' : crit ? '#ffd040' : '#ffffff' });
  w.fx({ t: 'hit', x: target.x, y: target.y - 6, dx: dirX, dy: dirY, color: target.undead ? '#e8e0c8' : '#d04040' });
  w.fx({ t: 'sfx', id: crit ? 'crit' : target.team === 'player' ? 'hurt' : 'hit' });
  if (!blocked) w.hitstop(crit ? 0.09 : spec.heavy ? 0.075 : 0.045);
  if (target.team === 'player' || spec.heavy || crit) w.shake(target.team === 'player' ? 3 : 2, 0.15);

  const src = spec.source;
  if (src && !src.dead) {
    if (spec.lifesteal) src.hp = Math.min(src.maxHp, src.hp + n * spec.lifesteal);
    if (target.stats.thorns > 0 && !spec.projectile) {
      const back = Math.max(1, Math.round(n * target.stats.thorns));
      src.hp -= back;
      w.fx({ t: 'dmg', x: src.x, y: src.y - 16, n: back, color: '#c0a0ff' });
      if (src.hp <= 0) src.die(w, target);
    }
  }
  w.onDamage(target, spec, n);
  if (target.hp <= 0) target.die(w, src);
}

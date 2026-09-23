import { ApiError } from '../auth';
import type { Db } from '../db';
import { addGold, heroById, heroByName, type HeroRow } from './hero';

/** Карма и охотники за головами (GDD §12.5). */

export const KARMA_MIN = -1000;
export const KARMA_MAX = 1000;
export const RED = -300;
export const ATTACK_UNFLAGGED = -50;
export const KILL_INNOCENT = -150;
export const KILL_WEAKER = -100;
export const KILL_RED = 40;
export const REGEN_PER_HOUR = 10;

const clampK = (k: number) => Math.max(KARMA_MIN, Math.min(KARMA_MAX, k));

export function setKarma(db: Db, heroId: string, karma: number, now: number): number {
  const k = clampK(Math.round(karma));
  db.run('UPDATE heroes SET karma = ? WHERE id = ?', k, heroId);
  syncAutoBounty(db, heroId, k, now);
  return k;
}

/** Автоматическая награда за красных растёт с падением кармы. */
export const autoBounty = (karma: number) => (karma < RED ? (RED - karma) * 3 : 0);

function syncAutoBounty(db: Db, heroId: string, karma: number, now: number): void {
  const auto = autoBounty(karma);
  const cur = db.get<{ amount: number }>('SELECT amount FROM bounties WHERE target_id = ?', heroId)?.amount ?? 0;
  if (auto > cur) db.run('INSERT INTO bounties (target_id, amount, updated_at) VALUES (?, ?, ?) ON CONFLICT(target_id) DO UPDATE SET amount = excluded.amount, updated_at = excluded.updated_at', heroId, auto, now);
}

/** Нападение: удар по «синему» без флага — штраф и фиолетовый флаг на 2 минуты (флаг держит комната). */
export function onAttack(db: Db, attacker: HeroRow, victim: HeroRow, victimFlagged: boolean, now: number): number {
  if (victimFlagged || victim.karma < RED) return attacker.karma;
  return setKarma(db, attacker.id, attacker.karma + ATTACK_UNFLAGGED, now);
}

/** Убийство в PvP-зоне: карма убийце, награда за голову, если была. */
export function onKill(db: Db, killerId: string, victimId: string, victimFlagged: boolean, now: number): { karma: number; bounty: number } {
  return db.tx(() => {
    const k = heroById(db, killerId), v = heroById(db, victimId);
    let delta = 0;
    if (v.karma < RED) delta += KILL_RED;
    else if (!victimFlagged) {
      delta += KILL_INNOCENT;
      if (v.level <= k.level - 10) delta += KILL_WEAKER;
    }
    const karma = setKarma(db, killerId, k.karma + delta, now);
    let bounty = 0;
    const b = db.get<{ amount: number }>('SELECT amount FROM bounties WHERE target_id = ?', victimId);
    if (b && b.amount > 0 && killerId !== victimId) {
      bounty = b.amount;
      db.run('DELETE FROM bounties WHERE target_id = ?', victimId);
      addGold(db, killerId, bounty, 'bounty', victimId, now);
    }
    return { karma, bounty };
  });
}

/** Добавить своё золото к награде за голову. */
export function addBounty(db: Db, heroId: string, targetName: string, amount: number, now: number): number {
  if (!Number.isInteger(amount) || amount < 50) throw new ApiError(400, 'bad_amount');
  return db.tx(() => {
    const t = heroByName(db, targetName);
    if (t.id === heroId) throw new ApiError(400, 'self');
    addGold(db, heroId, -amount, 'bounty_add', t.id, now);
    db.run('INSERT INTO bounties (target_id, amount, updated_at) VALUES (?, ?, ?) ON CONFLICT(target_id) DO UPDATE SET amount = amount + excluded.amount, updated_at = excluded.updated_at', t.id, amount, now);
    return db.get<{ amount: number }>('SELECT amount FROM bounties WHERE target_id = ?', t.id)!.amount;
  });
}

export function bountyList(db: Db): { name: string; level: number; karma: number; amount: number }[] {
  return db.all('SELECT h.name, h.level, h.karma, b.amount FROM bounties b JOIN heroes h ON h.id = b.target_id WHERE b.amount > 0 ORDER BY b.amount DESC LIMIT 30');
}

/**
 * Восстановление кармы: +10 за час, проведённый онлайн в безопасной зоне.
 * «Онлайн» — промежутки между запросами героя не длиннее 10 минут.
 */
export function touchOnline(db: Db, heroId: string, now: number, inSafeZone: boolean): void {
  const h = heroById(db, heroId);
  const gap = now - h.last_seen;
  if (inSafeZone && gap > 0 && gap <= 10 * 60_000 && h.karma < 0) {
    const acc = Number(db.meta(`karma_acc:${heroId}`) ?? 0) + gap;
    const hours = Math.floor(acc / 3_600_000);
    db.setMeta(`karma_acc:${heroId}`, String(acc - hours * 3_600_000));
    if (hours > 0) setKarma(db, heroId, Math.min(0, h.karma + hours * REGEN_PER_HOUR), now);
  }
  db.run('UPDATE heroes SET last_seen = ? WHERE id = ?', now, heroId);
}

/** Потеря при смерти в PvP-зоне: 1–3 стопки, у красных 3–6 (и шанс снять экипировку). */
export function lossCount(karma: number, roll: number): { stacks: number; gearChance: number } {
  return karma < RED ? { stacks: 3 + Math.floor(roll * 4), gearChance: 0.25 } : { stacks: 1 + Math.floor(roll * 3), gearChance: 0 };
}

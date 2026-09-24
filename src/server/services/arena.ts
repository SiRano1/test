import { randomUUID } from 'node:crypto';
import { Rng } from '../../core/rng';
import { rollEquipment } from '../../game/systems/loot';
import { weekOf } from './guild';
import { giveToHero } from './hero';
import { glicko2, teamAverage, type Rating } from '../sim/glicko';
import type { ArenaResult } from '../sim/arena';
import type { SimHero } from '../sim/hero';
import type { Db } from '../db';
import { addGold, addXp, equipment, heroById, itemDTO } from './hero';

/** Данные героя для симуляции (из БД). */
export function loadSimHero(db: Db, heroId: string): SimHero {
  const h = heroById(db, heroId);
  const tag = db.get<{ tag: string }>('SELECT g.tag FROM guild_members m JOIN guilds g ON g.id = m.guild_id WHERE m.hero_id = ?', heroId)?.tag ?? null;
  return {
    id: h.id, name: h.name, cls: h.cls, level: h.level, karma: h.karma,
    classXp: JSON.parse(h.class_xp), talents: JSON.parse(h.talents),
    equipment: equipment(db, heroId).map(itemDTO), guildTag: tag,
  };
}

export const rewardFor = (res: ArenaResult, won: boolean) => {
  if (res.mode === 'waves') return { gold: res.waves * 15, xp: res.waves * 20, tokens: Math.floor(res.waves / 3) };
  if (res.mode === 'raid') return won ? { gold: 400, xp: 600, tokens: 5 } : { gold: 30, xp: 60, tokens: 0 };
  if (res.draw) return { gold: 10, xp: 15, tokens: 0 };
  return won ? { gold: 20, xp: 30, tokens: res.ranked ? 2 : 1 } : { gold: 5, xp: 10, tokens: 0 };
};

/** Записать итог матча: рейтинг (Glicko-2), победы, награды, рекорд волн. */
export function finishMatch(db: Db, res: ArenaResult, startedAt: number, now: number): Record<string, { rating: number; delta: number }> {
  const out: Record<string, { rating: number; delta: number }> = {};
  db.tx(() => {
    const ids = [...res.winners, ...res.losers];
    const rating = (id: string): Rating => {
      const h = heroById(db, id);
      return { rating: h.rating, rd: h.rd, vol: h.vol };
    };
    const before = new Map(ids.map((id) => [id, rating(id)]));
    if (res.mode === 'raid') {
      // личная добыча рейда — раз в неделю на героя
      const week = weekOf(now);
      const rng = new Rng((now ^ 0x9e3779b9) >>> 0);
      for (const id of res.winners) {
        const key = `raid:${id}:${week}`;
        if (db.meta(key)) continue;
        db.setMeta(key, '1');
        const it = rollEquipment(rng, { floor: 90, tier: 7, luck: 20 }, 4, 2);
        giveToHero(db, id, { def: it.def, qty: 1, rarity: it.rarity, affixes: it.affixes }, 'raid_loot', now);
        giveToHero(db, id, { def: 'abyss_shard', qty: 3 }, 'raid_loot', now);
      }
    } else if (res.mode !== 'waves') {
      const A = res.winners.length ? res.winners : res.losers.slice(0, Math.ceil(res.losers.length / 2));
      const B = res.winners.length ? res.losers : res.losers.slice(Math.ceil(res.losers.length / 2));
      for (const id of ids) {
        const mine = A.includes(id);
        const opp = teamAverage((mine ? B : A).map((x) => before.get(x)!));
        const score = res.draw ? 0.5 : res.winners.includes(id) ? 1 : 0;
        const r0 = before.get(id)!;
        if (res.ranked) {
          const r1 = glicko2(r0, [{ opp, score }]);
          db.run('UPDATE heroes SET rating = ?, rd = ?, vol = ? WHERE id = ?', r1.rating, r1.rd, r1.vol, id);
          out[id] = { rating: Math.round(r1.rating), delta: Math.round(r1.rating - r0.rating) };
        } else out[id] = { rating: Math.round(r0.rating), delta: 0 };
        if (!res.draw) db.run(`UPDATE heroes SET ${res.winners.includes(id) ? 'wins = wins + 1' : 'losses = losses + 1'} WHERE id = ?`, id);
      }
    } else {
      for (const id of ids) db.run('UPDATE heroes SET waves_best = MAX(waves_best, ?) WHERE id = ?', res.waves, id);
    }
    for (const id of ids) {
      const rw = rewardFor(res, res.winners.includes(id));
      addGold(db, id, rw.gold, `arena_${res.mode}`, null, now);
      addXp(db, id, rw.xp);
      if (rw.tokens) db.run('UPDATE heroes SET tokens = tokens + ? WHERE id = ?', rw.tokens, id);
    }
    db.run('INSERT INTO matches (id, mode, ranked, started_at, ended_at, result) VALUES (?, ?, ?, ?, ?, ?)',
      randomUUID(), res.mode, res.ranked ? 1 : 0, startedAt, now, JSON.stringify({ ...res, ratings: out }));
  });
  return out;
}

/** Сезоны по 8 недель: в начале нового — мягкий сброс рейтинга всем героям. */
export const SEASON_WEEKS = 8;
export const seasonOf = (now: number) => Math.floor(weekOf(now) / SEASON_WEEKS);

export function seasonTick(db: Db, now: number): boolean {
  const season = seasonOf(now);
  const cur = Number(db.meta('season') ?? season);
  if (db.meta('season') === undefined) {
    db.setMeta('season', String(season));
    return false;
  }
  if (season === cur) return false;
  db.tx(() => {
    db.run('UPDATE heroes SET rating = 0.7 * rating + 0.3 * 1500, rd = MAX(rd, 150)');
    db.setMeta('season', String(season));
  });
  return true;
}

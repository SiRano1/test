import { TILE } from '../../core/math';
import { placeFor, scheduledNpcs, type Place } from '../../data/schedules';
import { Npc } from '../entities/npc';
import type { GameState } from '../state';
import { interiorDoorTile } from '../town/interiors';
import { buildingById } from '../town/town';
import type { World } from '../world';

/** Какой сцене соответствует мир: 'town', id интерьера или null (подземелье). */
export function sceneIdOf(w: World): string | null {
  if (w.kind === 'town') return 'town';
  if (w.kind === 'interior') return (w.meta.interior as string) ?? null;
  return null;
}

/** Тайл перед дверью здания на улице. */
function townDoor(building: string): [number, number] {
  const b = buildingById(building);
  return [b.x + b.door, b.y + b.h];
}

/** Здание, «внутри» которого находится место (интерьер или дом). */
function buildingOf(p: Place): string | null {
  if (p.scene === 'town') return null;
  if (p.scene === 'off') return p.home ?? null;
  return p.scene;
}

/**
 * Режиссёр жителей: по расписанию решает, кто присутствует в текущей сцене,
 * отправляет их ходить к нужным местам и выводит за дверь.
 */
export class NpcDirector {
  /** Где житель был в прошлый раз (сцена). */
  private where = new Map<string, string>();
  private tick = 0;

  constructor(private state: GameState, private override?: (id: string) => Place | null) {}

  private placeNow(id: string): Place | null {
    const tm = this.state.time;
    const fest = this.override?.(id);
    if (fest) return fest;
    const rom = this.state.romance;
    // супруг(а) живёт в усадьбе: утро и вечер дома, днём — прежние дела
    if (rom.stage === 'married' && rom.partner === id && (tm.minutes < 9 * 60 || tm.minutes >= 19 * 60)) {
      return { scene: 'manor', x: 9, y: 7, roam: 2, f: 0 };
    }
    return placeFor(id, tm.minutes, (tm.day - 1) % 7, tm.weather);
  }

  /** Расставить жителей при построении сцены. */
  populate(w: World): void {
    const cur = sceneIdOf(w);
    for (const id of scheduledNpcs()) {
      const p = this.placeNow(id);
      if (!p) continue;
      this.where.set(id, p.scene);
      if (!cur || p.scene !== cur || p.x === undefined) continue;
      const n = new Npc(id, p.x * TILE + 8, p.y! * TILE + 10, (p.roam ?? 0) * TILE, p.f ?? 0);
      w.addNow(n);
      n.walkTo(w, p.x, p.y!, p.roam ?? 0, p.f ?? 0);
    }
  }

  update(w: World, dt: number): void {
    this.tick -= dt;
    if (this.tick > 0) return;
    this.tick = 0.5;
    const cur = sceneIdOf(w);
    const present = new Map<string, Npc>();
    for (const e of w.entities) if (e instanceof Npc && !e.removed) present.set(e.def.id, e);
    for (const id of scheduledNpcs()) {
      const p = this.placeNow(id);
      if (!p) continue;
      const prev = this.where.get(id) ?? p.scene;
      this.where.set(id, p.scene);
      if (!cur) continue;
      const ent = present.get(id);
      if (ent) {
        if (ent.leaving) continue;
        if (p.scene === cur && p.x !== undefined) ent.walkTo(w, p.x, p.y!, p.roam ?? 0, p.f ?? 0);
        else {
          // уходит со сцены: к двери
          const [tx, ty] = cur === 'town' ? townDoor(buildingOf(p) ?? 'tavern') : interiorDoorTile(cur);
          ent.walkTo(w, tx, ty, 0, 0, () => w.remove(ent));
        }
      } else if (p.scene === cur && prev !== cur && p.x !== undefined) {
        // приходит в сцену: появляется у входа
        let sx: number, sy: number;
        if (cur === 'town') {
          const from = prev === 'town' ? null : prev === 'off' ? null : prev;
          const b = from ?? this.homeOf(id);
          [sx, sy] = b ? townDoor(b) : [p.x, p.y!];
        } else [sx, sy] = interiorDoorTile(cur);
        const n = new Npc(id, sx * TILE + 8, sy * TILE + 10, 0, p.f ?? 0);
        w.add(n);
        n.walkTo(w, p.x, p.y!, p.roam ?? 0, p.f ?? 0);
      }
    }
  }

  /** Дом жителя — здание из его «off»-записи. */
  private homeOf(id: string): string | null {
    const tm = this.state.time;
    for (const mins of [0, 23 * 60, 25 * 60]) {
      const p = placeFor(id, mins, (tm.day - 1) % 7, tm.weather);
      if (p?.scene === 'off' && p.home) return p.home;
    }
    return null;
  }

  isPresent(w: World, id: string): boolean {
    return w.entities.some((e) => e instanceof Npc && e.def.id === id && !e.leaving && !e.removed);
  }
}

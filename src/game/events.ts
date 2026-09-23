import type { Actor } from './entities/entity';

/** Визуальные/звуковые эффекты: логика сообщает, клиент рисует и озвучивает. */
export type Fx =
  | { t: 'dmg'; x: number; y: number; n: number; crit?: boolean; color?: string }
  | { t: 'text'; x: number; y: number; text: string; color: string }
  | { t: 'hit'; x: number; y: number; dx: number; dy: number; color: string }
  | { t: 'death'; x: number; y: number; color: string; big?: boolean }
  | { t: 'dust'; x: number; y: number; n?: number }
  | { t: 'slash'; x: number; y: number; angle: number; r: number; half: number; color: string; heavy?: boolean; dur?: number }
  | { t: 'ring'; x: number; y: number; r: number; color: string; dur?: number }
  | { t: 'shake'; power: number; dur: number }
  | { t: 'sfx'; id: string; vol?: number }
  | { t: 'flash'; color: string; dur: number }
  | { t: 'parry'; x: number; y: number }
  | { t: 'block'; x: number; y: number }
  | { t: 'sparkle'; x: number; y: number; color: string; n?: number }
  | { t: 'debris'; x: number; y: number; color: string; n?: number };

export interface GameEvents extends Record<string, unknown> {
  fx: Fx;
  toast: { text: string; color?: string };
  scene: { kind: string };
  inventory: void;
  dialogue: void;
  shop: { id: string } | null;
  elevator: { stops: number[] } | null;
  lore: { id: string } | null;
  death: { gold: number; items: number; exhausted: boolean };
  dayStart: { text: string };
  boss: { actor: Actor | null };
  levelUp: { level: number };
  menu: { open: string | null };
  autosave: void;
  panel: { kind: 'craft' | 'storage' | 'build' | 'service' } | null;
  tierEnter: { tier: number };
}

export const TILE = 16;

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const len = (x: number, y: number) => Math.hypot(x, y);
export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(bx - ax, by - ay);
export const dist2 = (ax: number, ay: number, bx: number, by: number) => (bx - ax) ** 2 + (by - ay) ** 2;

/** Двигает значение к цели не более чем на step. */
export function approach(v: number, target: number, step: number): number {
  return v < target ? Math.min(v + step, target) : Math.max(v - step, target);
}

export function norm(x: number, y: number): [number, number] {
  const l = Math.hypot(x, y);
  return l > 1e-9 ? [x / l, y / l] : [0, 0];
}

/** Нормализация угла в (-π, π]. */
export function wrapAngle(a: number): number {
  while (a <= -Math.PI) a += Math.PI * 2;
  while (a > Math.PI) a -= Math.PI * 2;
  return a;
}

export function angleDiff(a: number, b: number): number {
  return Math.abs(wrapAngle(a - b));
}

/** Направление взгляда для спрайтов: 0 вниз, 1 влево, 2 вправо, 3 вверх. */
export type Facing = 0 | 1 | 2 | 3;

export function facingFromVec(x: number, y: number, prev: Facing = 0): Facing {
  if (Math.abs(x) < 1e-6 && Math.abs(y) < 1e-6) return prev;
  if (Math.abs(x) > Math.abs(y) * 1.05) return x < 0 ? 1 : 2;
  return y < 0 ? 3 : 0;
}

export function vecFromFacing(f: Facing): [number, number] {
  return f === 0 ? [0, 1] : f === 1 ? [-1, 0] : f === 2 ? [1, 0] : [0, -1];
}

/** Округление вектора к одному из 8 направлений. */
export function snap8(x: number, y: number): [number, number] {
  if (x === 0 && y === 0) return [0, 0];
  const a = Math.round(Math.atan2(y, x) / (Math.PI / 4)) * (Math.PI / 4);
  return [Math.cos(a), Math.sin(a)];
}

/** Попадание точки в дугу (сектор) с центром (cx,cy). */
export function pointInArc(
  px: number, py: number, cx: number, cy: number,
  radius: number, angle: number, halfWidth: number, pad = 0,
): boolean {
  const dx = px - cx, dy = py - cy;
  const d = Math.hypot(dx, dy);
  if (d > radius + pad) return false;
  if (d < pad + 2) return true;
  const a = Math.atan2(dy, dx);
  // учитываем размер цели: расширяем дугу на угол, под которым видна цель
  const widen = Math.atan2(pad, Math.max(d, 1));
  return angleDiff(a, angle) <= halfWidth + widen;
}

export function formatTime(minutes: number): string {
  const m = Math.floor(minutes) % (24 * 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
}

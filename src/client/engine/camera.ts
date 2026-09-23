import { clamp } from '../../core/math';

export const VIEW_W = 480;
export const VIEW_H = 270;

export class Camera {
  x = 0;
  y = 0;
  shakeT = 0;
  shakePower = 0;
  shakeEnabled = true;
  ox = 0;
  oy = 0;

  follow(tx: number, ty: number, mapW: number, mapH: number, dt: number, snap = false): void {
    const gx = tx - VIEW_W / 2, gy = ty - VIEW_H / 2;
    const k = snap ? 1 : 1 - Math.pow(0.0005, dt);
    this.x += (gx - this.x) * k;
    this.y += (gy - this.y) * k;
    this.x = mapW <= VIEW_W ? (mapW - VIEW_W) / 2 : clamp(this.x, 0, mapW - VIEW_W);
    this.y = mapH <= VIEW_H ? (mapH - VIEW_H) / 2 : clamp(this.y, 0, mapH - VIEW_H);
    if (this.shakeT > 0 && this.shakeEnabled) {
      this.shakeT -= dt;
      const p = this.shakePower * Math.min(1, this.shakeT * 6);
      this.ox = (Math.random() * 2 - 1) * p;
      this.oy = (Math.random() * 2 - 1) * p;
    } else {
      this.ox = this.oy = 0;
    }
  }

  shake(power: number, dur: number): void {
    this.shakePower = Math.max(this.shakePower * (this.shakeT > 0 ? 1 : 0), power);
    this.shakeT = Math.max(this.shakeT, dur);
  }

  /** Целочисленная позиция для отрисовки (без субпикселей). */
  get rx(): number {
    return Math.round(this.x + this.ox);
  }
  get ry(): number {
    return Math.round(this.y + this.oy);
  }
}

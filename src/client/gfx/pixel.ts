/** Утилиты процедурного пиксель-арта. */

export type Canvas = HTMLCanvasElement;
export type Ctx = CanvasRenderingContext2D;

export function makeCanvas(w: number, h: number): [Canvas, Ctx] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function rgb(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** amt < 0 — темнее, > 0 — светлее. */
export function shade(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  if (amt < 0) return rgb(r * (1 + amt), g * (1 + amt), b * (1 + amt));
  return rgb(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
}

export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgb(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** Детерминированный хэш координат (0..1). */
export function hash2(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Сетка пикселей с палитрой и авто-обводкой. */
export class Grid {
  px: (string | null)[];

  constructor(readonly w: number, readonly h: number) {
    this.px = new Array(w * h).fill(null);
  }

  get(x: number, y: number): string | null {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.px[y * this.w + x]!;
  }

  set(x: number, y: number, c: string | null): this {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    this.px[y * this.w + x] = c;
    return this;
  }

  rect(x: number, y: number, w: number, h: number, c: string | null): this {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c);
    return this;
  }

  /** Эллипс (заливка) в прямоугольнике. */
  ellipse(x: number, y: number, w: number, h: number, c: string | null): this {
    const cx = x + w / 2 - 0.5, cy = y + h / 2 - 0.5, rx = w / 2, ry = h / 2;
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++) if (((i - cx) / rx) ** 2 + ((j - cy) / ry) ** 2 <= 1.05) this.set(i, j, c);
    return this;
  }

  line(x0: number, y0: number, x1: number, y1: number, c: string): this {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.set(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c);
    return this;
  }

  /** Заменить цвет только там, где уже что-то нарисовано. */
  tint(x: number, y: number, w: number, h: number, c: string): this {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (this.get(i, j)) this.set(i, j, c);
    return this;
  }

  /** Обводка: прозрачные пиксели рядом с непрозрачными. */
  outline(color: string, diagonal = false): this {
    const add: [number, number][] = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)) continue;
        const n = [[1, 0], [-1, 0], [0, 1], [0, -1], ...(diagonal ? [[1, 1], [-1, 1], [1, -1], [-1, -1]] : [])];
        if (n.some(([dx, dy]) => this.get(x + dx!, y + dy!) && this.get(x + dx!, y + dy!) !== color)) add.push([x, y]);
      }
    for (const [x, y] of add) this.set(x, y, color);
    return this;
  }

  flipX(): Grid {
    const g = new Grid(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) g.set(this.w - 1 - x, y, this.get(x, y));
    return g;
  }

  clone(): Grid {
    const g = new Grid(this.w, this.h);
    g.px = [...this.px];
    return g;
  }

  /** Сдвиг содержимого (для «подпрыгивания» при ходьбе). */
  shift(dx: number, dy: number): Grid {
    const g = new Grid(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) g.set(x + dx, y + dy, this.get(x, y));
    return g;
  }

  toCanvas(scale = 1): Canvas {
    const [c, ctx] = makeCanvas(this.w * scale, this.h * scale);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const col = this.get(x, y);
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    return c;
  }
}

/** Белый силуэт спрайта (для вспышки при попадании). */
export function whiteOf(src: Canvas, color = '#ffffff'): Canvas {
  const [c, ctx] = makeCanvas(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

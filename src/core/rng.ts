/** Детерминированный ГПСЧ (mulberry32). Одинаковый seed → одинаковая последовательность на клиенте и сервере. */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0 || 0x9e3779b9;
  }

  get state(): number {
    return this.s;
  }
  set state(v: number) {
    this.s = v >>> 0;
  }

  /** [0, 1) */
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Целое в [min, max] включительно. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('Rng.pick: empty array');
    return arr[Math.floor(this.next() * arr.length)]!;
  }

  weighted<T>(list: readonly (readonly [T, number])[]): T {
    let total = 0;
    for (const [, w] of list) total += Math.max(0, w);
    if (total <= 0) throw new Error('Rng.weighted: no positive weights');
    let r = this.next() * total;
    for (const [v, w] of list) {
      r -= Math.max(0, w);
      if (r < 0) return v;
    }
    return list[list.length - 1]![0];
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }
    return arr;
  }

  /** Независимый поток для подсистемы — не сдвигает основной. */
  fork(label: string | number): Rng {
    return new Rng(hashSeed(this.s, label));
  }
}

/** FNV-1a над строковым представлением частей. */
export function hashSeed(...parts: (string | number)[]): number {
  let h = 0x811c9dc5;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    h ^= 0x7c;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

let uidCounter = 0;
/** Уникальный id экземпляра предмета/сущности (для офлайна; сервер выдаёт свои uuid). */
export function makeUid(rng?: Rng): string {
  uidCounter = (uidCounter + 1) % 0xffffff;
  const r = rng ? Math.floor(rng.next() * 0xffffffff) : Math.floor(Math.random() * 0xffffffff);
  return `${Date.now().toString(36)}-${uidCounter.toString(36)}-${r.toString(36)}`;
}

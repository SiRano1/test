import { ITEMS } from '../../data/items';
import { HERO_LOOK, NPCS, type Look } from '../../data/npcs';
import { humanoid, monsterFrames, type Dir } from './characters';
import { iconGrid } from './icons';
import { makeCanvas, whiteOf, type Canvas } from './pixel';
import { propArt, type Art } from './props';

/** Кеш всех сгенерированных спрайтов. Генерирует по требованию. */
export class SpriteBank {
  private cache = new Map<string, Canvas>();
  private arts = new Map<string, Art | null>();
  private flips = new Map<Canvas, Canvas>();
  private whites = new Map<Canvas, Canvas>();
  private reds = new Map<Canvas, Canvas>();
  season = 0;
  heroLook: Look = HERO_LOOK;

  /** Кадр гуманоида: id = 'hero' | id NPC. */
  char(id: string, dir: Dir, frame: 0 | 1 | 2): Canvas {
    const key = `char:${id}:${dir}:${frame}`;
    let c = this.cache.get(key);
    if (!c) {
      const look = id === 'hero' ? this.heroLook : NPCS[id]?.look ?? HERO_LOOK;
      c = humanoid(look, dir, frame).toCanvas();
      this.cache.set(key, c);
    }
    return c;
  }

  monster(sprite: string, frame: number): Canvas {
    const key = `mon:${sprite}`;
    let frames = this.monsterCache.get(key);
    if (!frames) {
      frames = monsterFrames(sprite).map((g) => g.toCanvas());
      this.monsterCache.set(key, frames);
    }
    return frames[frame % frames.length]!;
  }

  monsterFrameCount(sprite: string): number {
    this.monster(sprite, 0);
    return this.monsterCache.get(`mon:${sprite}`)!.length;
  }

  private monsterCache = new Map<string, Canvas[]>();

  icon(def: string): Canvas {
    const key = `icon:${def}`;
    let c = this.cache.get(key);
    if (!c) {
      const d = ITEMS[def];
      c = d ? iconGrid(d.icon).toCanvas() : iconGrid({ shape: 'coin', c1: '#ffd040' }).toCanvas();
      this.cache.set(key, c);
    }
    return c;
  }

  /** Иконка как data URL (для DOM-интерфейса). */
  iconUrl(def: string, scale = 3): string {
    const key = `url:${def}:${scale}`;
    const hit = this.urlCache.get(key);
    if (hit) return hit;
    const src = this.icon(def);
    const [c, ctx] = makeCanvas(src.width * scale, src.height * scale);
    ctx.drawImage(src, 0, 0, c.width, c.height);
    const url = c.toDataURL();
    this.urlCache.set(key, url);
    return url;
  }
  private urlCache = new Map<string, string>();

  prop(key: string): Art | null {
    const k = key.startsWith('tree') || key.startsWith('bush') || key.startsWith('building') ? `${key}@${this.season}` : key;
    if (!this.arts.has(k)) this.arts.set(k, propArt(key, this.season));
    return this.arts.get(k)!;
  }

  flipped(c: Canvas): Canvas {
    let f = this.flips.get(c);
    if (!f) {
      const [fc, ctx] = makeCanvas(c.width, c.height);
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(c, 0, 0);
      f = fc;
      this.flips.set(c, f);
    }
    return f;
  }

  white(c: Canvas): Canvas {
    let w = this.whites.get(c);
    if (!w) this.whites.set(c, (w = whiteOf(c)));
    return w;
  }

  red(c: Canvas): Canvas {
    let w = this.reds.get(c);
    if (!w) this.reds.set(c, (w = whiteOf(c, '#ff3030')));
    return w;
  }

  /** Сбросить кеш сезонных объектов (смена сезона). */
  setSeason(s: number): void {
    this.season = s;
  }
}

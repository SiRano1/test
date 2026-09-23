import { TILE } from '../../core/math';
import { Tile } from '../../core/tilemap';
import { tr } from '../../data/strings';
import type { Hitbox } from '../combat/combat';
import { makeItem, rollChest } from '../systems/loot';
import type { SceneRef } from '../state';
import type { ItemStack } from '../types';
import type { Breakable, SpawnSpec, World } from '../world';
import { Entity, type Interaction } from './entity';

/** Статичный объект, занимающий тайлы (блокирует проход). */
export class Prop extends Entity {
  blocks: [number, number][] = [];

  constructor(x: number, y: number, sprite: string, opts: { hw?: number; hh?: number; block?: boolean; layer?: 0 | 1 | 2 } = {}) {
    super();
    this.x = x;
    this.y = y;
    this.sprite = sprite;
    this.hw = opts.hw ?? 6;
    this.hh = opts.hh ?? 4;
    if (opts.layer !== undefined) this.layer = opts.layer;
    if (opts.block) this.blocks.push([Math.floor(x / TILE), Math.floor((y - 1) / TILE)]);
  }

  /** Блокировать прямоугольник тайлов. */
  blockRect(tx: number, ty: number, w: number, h: number): this {
    for (let j = ty; j < ty + h; j++) for (let i = tx; i < tx + w; i++) this.blocks.push([i, j]);
    return this;
  }

  override onAdd(w: World): void {
    for (const [tx, ty] of this.blocks) w.map.block(tx, ty, 1);
  }
  override onRemove(w: World): void {
    for (const [tx, ty] of this.blocks) w.map.block(tx, ty, -1);
  }
}

export class Chest extends Prop {
  opened = false;

  constructor(x: number, y: number, public quality: 0 | 1 | 2, public fixed?: { items: ItemStack[]; gold: number }) {
    super(x, y, quality === 2 ? 'chest_epic' : quality === 1 ? 'chest_rare' : 'chest', { block: true, hw: 7, hh: 5 });
    if (quality > 0) this.light = { r: 18 + quality * 6, color: quality === 2 ? '#c07bff' : '#5aa6ff', power: 0.4 };
    this.interaction = {
      label: () => tr('open'),
      enabled: () => !this.opened,
      act: (w) => this.open(w),
    };
  }

  open(w: World): void {
    if (this.opened) return;
    this.opened = true;
    this.sprite += '_open';
    this.light = undefined;
    const tier = w.tier?.id ?? 1;
    const loot = this.fixed ?? rollChest(w.rng, { floor: w.floor, tier, luck: w.game.stats().luck }, this.quality);
    w.dropLoot(this.x, this.y + 6, loot.items, loot.gold);
    w.fx({ t: 'sfx', id: 'chest' });
    w.fx({ t: 'sparkle', x: this.x, y: this.y - 6, color: '#ffd040', n: 10 });
  }
}

/** Рудная жила: ломается ударами, тратит бодрость. */
export class OreNode extends Prop implements Breakable {
  readonly breakable = true as const;
  hits = 0;

  constructor(x: number, y: number, public ore: string, public hp = 3) {
    super(x, y, `ore:${ore}`, { block: true, hw: 7, hh: 5 });
  }

  onStruck(w: World, _hb: Hitbox): void {
    if (_hb.owner !== w.player) return;
    this.hits++;
    this.flash = 0.1;
    w.fx({ t: 'debris', x: this.x, y: this.y - 6, color: '#8a8070', n: 3 });
    w.fx({ t: 'sfx', id: 'pick' });
    if (this.hits < this.hp) return;
    if (!w.game.useEnergy(4)) {
      this.hits = this.hp - 1;
      w.fx({ t: 'text', x: this.x, y: this.y - 18, text: tr('tooTired'), color: '#ffb060' });
      return;
    }
    w.remove(this);
    const rng = w.rng;
    const stacks = [makeItem(rng, this.ore, 0, rng.int(1, 3))];
    if (this.ore !== 'stone' && rng.chance(0.4)) stacks.push(makeItem(rng, 'stone', 0, 1));
    if (rng.chance(0.03 + w.floor * 0.002)) stacks.push(makeItem(rng, rng.pick(['pearl', 'coal_crystal', 'frost_crystal'].slice(0, Math.min(3, 1 + Math.floor(w.floor / 15)))), 0, 1));
    w.dropLoot(this.x, this.y - 4, stacks, 0);
    w.fx({ t: 'debris', x: this.x, y: this.y - 6, color: '#a09080', n: 10 });
    w.fx({ t: 'sfx', id: 'rockbreak' });
    w.game.state.stats.oreMined = (w.game.state.stats.oreMined ?? 0) + 1;
  }
}

/** Урна / ящик: один удар, мелкий лут. */
export class Breakpot extends Prop implements Breakable {
  readonly breakable = true as const;

  constructor(x: number, y: number, sprite: string) {
    super(x, y, sprite, { block: true, hw: 5, hh: 4 });
  }

  onStruck(w: World): void {
    w.remove(this);
    w.fx({ t: 'debris', x: this.x, y: this.y - 5, color: this.sprite === 'crate' ? '#8a6040' : '#a07860', n: 8 });
    w.fx({ t: 'sfx', id: 'pot' });
    const rng = w.rng;
    const r = rng.next();
    if (r < 0.25) w.dropLoot(this.x, this.y - 4, [], rng.int(1, 4 + w.floor));
    else if (r < 0.3) w.dropLoot(this.x, this.y - 4, [makeItem(rng, 'potion_small')], 0);
    else if (r < 0.34) w.dropLoot(this.x, this.y - 4, [makeItem(rng, 'bread')], 0);
  }
}

/** Треснувшая стена: тайник за ней. */
export class CrackedWall extends Prop implements Breakable {
  readonly breakable = true as const;
  hits = 0;

  constructor(public tx: number, public ty: number) {
    super(tx * TILE + 8, ty * TILE + 15, 'cracked', { hw: 8, hh: 8, layer: 1 });
  }

  onStruck(w: World, hb: Hitbox): void {
    if (hb.owner !== w.player) return;
    this.hits++;
    this.flash = 0.1;
    w.fx({ t: 'debris', x: this.x, y: this.y - 8, color: '#6a625a', n: 4 });
    w.fx({ t: 'sfx', id: 'hollow' });
    if (this.hits < 3) return;
    w.map.set(this.tx, this.ty, Tile.RUBBLE);
    w.remove(this);
    w.fx({ t: 'debris', x: this.x, y: this.y - 8, color: '#6a625a', n: 14 });
    w.fx({ t: 'sfx', id: 'rockbreak' });
    w.game.toast(tr('secretFound'), '#ffd040');
    w.game.state.stats.secrets = (w.game.state.stats.secrets ?? 0) + 1;
  }
}

/** Невидимая точка взаимодействия (лестницы, кровать, прилавок). */
export class Spot extends Entity {
  constructor(x: number, y: number, interaction: Interaction, sprite = '', hw = 8, hh = 8) {
    super();
    this.x = x;
    this.y = y;
    this.hw = hw;
    this.hh = hh;
    this.sprite = sprite;
    this.layer = 0;
    this.interaction = interaction;
  }
}

/** Прямоугольная зона-триггер (двери): срабатывает, когда герой входит в неё. */
export class Trigger extends Entity {
  armed = false;

  constructor(public rx: number, public ry: number, public rw: number, public rh: number, public onEnter: (w: World) => void) {
    super();
    this.x = rx + rw / 2;
    this.y = ry + rh;
    this.layer = 0;
  }

  inside(w: World): boolean {
    const p = w.player;
    return !!p && p.x >= this.rx && p.x <= this.rx + this.rw && p.y >= this.ry && p.y <= this.ry + this.rh;
  }

  override update(w: World): void {
    const inside = this.inside(w);
    if (!inside) this.armed = true;
    else if (this.armed && !w.player.dead) {
      this.armed = false;
      this.onEnter(w);
    }
  }
}

export function door(rx: number, ry: number, rw: number, rh: number, to: SceneRef, spawn?: SpawnSpec): Trigger {
  return new Trigger(rx, ry, rw, rh, (w) => {
    w.fx({ t: 'sfx', id: 'door' });
    w.game.goTo(to, spawn);
  });
}

/** Лор: записка или фреска. */
export class LoreObject extends Prop {
  constructor(x: number, y: number, public loreId: string, kind: 'note' | 'fresco' | 'diary') {
    super(x, y, `lore_${kind}`, { hw: 6, hh: 4, layer: kind === 'fresco' ? 1 : 0 });
    this.light = { r: 16, color: '#ffe0a0', power: 0.35, flicker: 0.1 };
    this.interaction = {
      label: () => tr('read'),
      act: (w) => w.game.readLore(this.loreId),
    };
  }
}

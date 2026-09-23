import { TILE } from '../../core/math';
import { L, t } from '../../data/loc';
import { customerInterval, isShopHours, marketValue, learnPrice, popularityDelta, REACTION_ICON, reactTo, sellFromDisplay, willBuy } from '../systems/playershop';
import type { World } from '../world';
import { Entity } from './entity';
import { Npc } from './npc';
import { Prop } from './props';

/** Лавка героя: витрины в два ряда, прилавок, дверь внизу. */
export const SHOP_W = 14;
export const SHOP_H = 10;
export const DISPLAY_TILES: [number, number][] = [[2, 5], [4, 5], [9, 5], [11, 5], [2, 7], [4, 7], [9, 7], [11, 7]];
export const SHOP_COUNTER = { x: 5, y: 3, w: 4 };
const DOOR: [number, number] = [Math.floor(SHOP_W / 2) - 1, SHOP_H - 2];
export const VISITORS = ['visitor_0', 'visitor_1', 'visitor_2', 'visitor_3', 'visitor_4', 'visitor_5'];

/** Витрина: тумба с предметом (рисуется по state.shop.displays[index]). */
export class DisplayStand extends Prop {
  constructor(public index: number) {
    const [tx, ty] = DISPLAY_TILES[index]!;
    super(tx * TILE + 8, ty * TILE + 15, 'furn:pedestal:1x1', { block: true, hw: 7, hh: 4 });
    this.interaction = {
      label: () => t(L('Витрина', 'Display')),
      range: 12,
      act: (w) => w.game.openShopfront(index),
    };
  }
}

/** Покупатель: подходит к витрине, смотрит на цену, реагирует и покупает или уходит. */
export class Customer extends Npc {
  phase: 'toStand' | 'browse' | 'toCounter' | 'leave' = 'toStand';
  private t = 0;
  /** Личная «справедливая цена»: ±15 % от рыночной. */
  readonly fairness: number;

  constructor(look: string, public target: number, fairness: number) {
    super(look, DOOR[0] * TILE + 8, DOOR[1] * TILE + 10, 0, 3);
    this.fairness = fairness;
    this.interaction = undefined;
  }

  begin(w: World): void {
    const [tx, ty] = DISPLAY_TILES[this.target]!;
    this.walkTo(w, tx, ty + 1, 0, 3, () => {
      this.phase = 'browse';
      this.t = 1.6 + w.rng.range(0, 1.2);
    });
  }

  private leave(w: World): void {
    this.phase = 'leave';
    this.walkTo(w, DOOR[0], DOOR[1] + 1, 0, 0, () => w.remove(this));
  }

  override update(w: World, dt: number): void {
    super.update(w, dt);
    if (this.phase !== 'browse') return;
    this.facing = 3;
    this.t -= dt;
    if (this.t > 0) return;
    const shop = w.game.state.shop;
    const d = shop.displays[this.target];
    if (!d) {
      w.fx({ t: 'text', x: this.x, y: this.y - 24, text: '?', color: '#c0c0c0' });
      return this.leave(w);
    }
    const reaction = reactTo(d.price, marketValue(w.game.state, d.stack), this.fairness);
    const buy = willBuy(reaction, w.rng);
    const icon = REACTION_ICON[reaction];
    w.fx({ t: 'text', x: this.x, y: this.y - 24, text: icon.text, color: icon.color });
    learnPrice(shop, d.stack.def, d.price, reaction);
    shop.popularity = Math.max(0, Math.min(100, shop.popularity + popularityDelta(reaction, buy)));
    if (!buy) return this.leave(w);
    const price = sellFromDisplay(w.game.state, shop, this.target);
    w.game.events.emit('inventory', undefined);
    this.phase = 'toCounter';
    this.walkTo(w, SHOP_COUNTER.x + 1 + (this.id % 2), SHOP_COUNTER.y + 1, 0, 3, () => {
      w.fx({ t: 'text', x: this.x, y: this.y - 26, text: `+${price}`, color: '#ffd040' });
      w.fx({ t: 'sfx', id: 'chest' });
      this.leave(w);
    });
  }
}

/** Невидимый распорядитель лавки: впускает покупателей, пока лавка открыта. */
export class ShopFloor extends Entity {
  private next = 1.5;
  private dayIncome = 0;

  override update(w: World, dt: number): void {
    const g = w.game;
    if (!g.shopOpen) return;
    const s = g.state;
    if (!isShopHours(s)) {
      g.shopOpen = false;
      g.toast(t(L(`Лавка закрылась. Выручка: ${s.shop.income - this.dayIncome} з.`, `The shop has closed. Takings: ${s.shop.income - this.dayIncome} g.`)), '#ffd040');
      return;
    }
    this.next -= dt;
    if (this.next > 0) return;
    this.next = customerInterval(s.shop.popularity) * w.rng.range(0.7, 1.3);
    const inside = w.entities.filter((e) => e instanceof Customer && !e.removed) as Customer[];
    if (inside.length >= 3) return;
    const busy = new Set(inside.filter((c) => c.phase !== 'leave').map((c) => c.target));
    const free = s.shop.displays.map((d, i) => (d && !busy.has(i) ? i : -1)).filter((i) => i >= 0);
    if (!free.length) return;
    const c = new Customer(w.rng.pick(VISITORS), w.rng.pick(free), w.rng.range(0.85, 1.15));
    w.add(c);
    c.begin(w);
    w.fx({ t: 'sfx', id: 'door' });
  }

  startDay(income: number): void {
    this.dayIncome = income;
    this.next = 1;
  }
}

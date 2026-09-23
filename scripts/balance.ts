/**
 * Бот-плейтестер: проходит этажи подземелья в безголовой симуляции и собирает статистику.
 * Запуск: npx tsx scripts/balance.ts [этажей] [прогонов]
 */
import { dist } from '../src/core/math';
import { findPath } from '../src/core/pathfind';
import { Tile } from '../src/core/tilemap';
import { itemDef } from '../src/data/items';
import { Enemy } from '../src/game/entities/enemy';
import { Game } from '../src/game/game';
import type { Action, InputFrame } from '../src/game/input';
import { World } from '../src/game/world';

const DT = 1 / 60;
const FLOORS = Number(process.argv[2] ?? 10);
const RUNS = Number(process.argv[3] ?? 5);

function frame(mx: number, my: number, pressed: Action[] = [], down: Action[] = [], aim?: [number, number]): InputFrame {
  const l = Math.hypot(mx, my) || 1;
  return { mx: mx / l, my: my / l, aimX: aim?.[0] ?? null, aimY: aim?.[1] ?? null, pressed: new Set(pressed), down: new Set(down), released: new Set() };
}

function autoEquip(g: Game) {
  const s = g.state;
  s.inventory.forEach((it, i) => {
    if (!it) return;
    const d = itemDef(it.def);
    if (d.kind === 'weapon' && d.weapon!.cls === 'sword') {
      const cur = s.equipment.weapon;
      if (!cur || d.weapon!.atk * (1 + it.rarity * 0.15) > itemDef(cur.def).weapon!.atk * (1 + cur.rarity * 0.15)) g.equip(i);
    }
    if (d.armor) {
      const cur = s.equipment[d.armor.slot];
      if (!cur || d.armor.def > itemDef(cur.def).armor!.def) g.equip(i);
    }
  });
}

interface RunStats {
  reached: number;
  deaths: number;
  time: number;
  potions: number;
  level: number;
  bossTime: number;
}

function run(seed: number): RunStats {
  const g = Game.newGame('Бот', seed);
  const st: RunStats = { reached: 0, deaths: 0, time: 0, potions: 0, level: 1, bossTime: 0 };
  const startFloor = Number(process.env.START ?? 1);
  if (process.env.KIT) {
    // «подготовленный игрок»: медное снаряжение, уровень и зелья
    g.state.equipment.weapon = { uid: 'k1', def: 'copper_sword', qty: 1, rarity: 1, affixes: [{ id: 'sharp', value: 8 }], upgrade: 0 };
    g.state.equipment.body = { uid: 'k2', def: 'copper_body', qty: 1, rarity: 0, affixes: [], upgrade: 0 };
    g.state.equipment.head = { uid: 'k3', def: 'copper_head', qty: 1, rarity: 0, affixes: [], upgrade: 0 };
    g.state.hero.level = Number(process.env.KIT);
    g.give('potion_small', 6);
    g.refreshStats();
    g.player.hp = g.player.maxHp;
  }
  g.goTo({ kind: 'dungeon', floor: startFloor });
  for (let i = 0; i < 60; i++) g.update(DT, frame(0, 0));
  let floorT = 0;
  let path: [number, number][] | null = null;
  let pathT = 0;
  let stuckT = 0;
  let lastPos = [0, 0];
  const maxTicks = 60 * 60 * 25;
  for (let tick = 0; tick < maxTicks; tick++) {
    st.time += DT;
    floorT += DT;
    if (g.transition) {
      g.update(DT, frame(0, 0));
      continue;
    }
    if (g.mode === 'dead' || g.player.dead) {
      g.update(DT, frame(0, 0));
      if (g.scene.kind !== 'dungeon' && !g.transition) {
        st.deaths++;
        if (st.deaths >= 3) break;
        g.paused = false;
        g.goTo({ kind: 'dungeon', floor: Math.max(1, Math.floor(g.state.dungeon.deepest / 5) * 5 || 1) });
        floorT = 0;
      }
      continue;
    }
    if (g.mode !== 'play') {
      g.paused = false;
      if (g.dialogue) g.dialogueAdvance();
      if (g.mode === 'lore') g.closeLore();
      g.update(DT, frame(0, 0));
      continue;
    }
    const p = g.player;
    const w = g.world;
    const sc = g.scene;
    if (sc.kind !== 'dungeon') {
      const d = g.state.stats.deaths ?? 0;
      if (d > st.deaths) {
        st.deaths = d;
        if (d >= 3) break;
        g.paused = false;
        const stops = g.state.dungeon.elevator;
        g.goTo({ kind: 'dungeon', floor: stops.length ? stops[stops.length - 1]! : 1 });
        floorT = 0;
        continue;
      }
      break;
    }
    st.reached = Math.max(st.reached, sc.floor);
    if (sc.floor > FLOORS) break;
    const enemies = w.enemies() as Enemy[];
    // лечение
    if (p.hp < p.maxHp * 0.35) {
      const idx = g.state.inventory.findIndex((s) => s && (s.def === 'potion_small' || s.def === 'potion_heal'));
      if (idx >= 0) {
        g.useItem(idx);
        st.potions++;
      }
    }
    let target: Enemy | null = null;
    let best = Infinity;
    for (const e of enemies) {
      const d = dist(p.x, p.y, e.x, e.y);
      const seen = e.state !== 'idle' || (d < 120 && w.map.lineOfSight(p.x, p.y - 4, e.x, e.y - 4));
      if (seen && d < best) {
        best = d;
        target = e;
      }
    }
    // уклонение от замаха
    const threat = enemies.find((e) => e.state === 'windup' && e.atk && e.st > e.atk.windup * 0.55 && dist(p.x, p.y, e.x, e.y) < (e.atk.range ?? 30) + 18);
    let inp: InputFrame;
    if (threat && p.stamina > 25) {
      const ax = p.x - threat.x, ay = p.y - threat.y;
      inp = frame(ax, ay, ['dodge']);
    } else if (target) {
      const d = best;
      if (d < 22) inp = frame(0, 0, ['attack'], ['attack'], [target.x, target.y - 4]);
      else {
        pathT -= DT;
        if (!path || pathT <= 0) {
          path = findPath(w.map, Math.floor(p.x / 16), Math.floor(p.y / 16), Math.floor(target.x / 16), Math.floor(target.y / 16), 3000);
          pathT = 0.4;
        }
        const next = path?.[0];
        const tx = next ? next[0] * 16 + 8 : target.x, ty = next ? next[1] * 16 + 8 : target.y;
        if (next && dist(p.x, p.y, tx, ty) < 5) path!.shift();
        inp = frame(tx - p.x, ty - p.y, [], [], [target.x, target.y - 4]);
      }
    } else {
      // к лестнице вниз
      let ex = -1, ey = -1;
      for (let y = 0; y < w.map.h && ex < 0; y++) for (let x = 0; x < w.map.w; x++) if (w.map.get(x, y) === Tile.STAIRS_DOWN) { ex = x; ey = y; break; }
      if (ex < 0) {
        // арена босса: подходим к центру, чтобы разбудить
        const b = w.meta.rooms as { role: string; x: number; y: number; w: number; h: number }[];
        const arena = b?.find((r) => r.role === 'boss');
        if (arena) { ex = arena.x + Math.floor(arena.w / 2); ey = arena.y + Math.floor(arena.h / 2); }
      }
      if (ex >= 0 && dist(p.x, p.y, ex * 16 + 8, ey * 16 + 8) < 14 && w.map.get(ex, ey) === Tile.STAIRS_DOWN) {
        autoEquip(g);
        g.descend();
        floorT = 0;
        path = null;
        continue;
      }
      pathT -= DT;
      if (!path || pathT <= 0) {
        path = ex >= 0 ? findPath(w.map, Math.floor(p.x / 16), Math.floor(p.y / 16), ex, ey, 5000) : null;
        pathT = 1;
      }
      const next = path?.[0];
      if (next) {
        const tx = next[0] * 16 + 8, ty = next[1] * 16 + 8;
        if (dist(p.x, p.y, tx, ty) < 5) path!.shift();
        inp = frame(tx - p.x, ty - p.y);
      } else inp = frame(0, 0);
    }
    // застрял — ударить (мог упереться в урну) и сменить путь
    if (tick % 60 === 0) {
      if (dist(lastPos[0]!, lastPos[1]!, p.x, p.y) < 3 && (inp.mx || inp.my)) stuckT++;
      else stuckT = 0;
      lastPos = [p.x, p.y];
      if (stuckT > 2) {
        inp = { ...inp, pressed: new Set(['attack']) };
        path = null;
      }
    }
    if (g.boss) st.bossTime += DT;
    g.update(DT, inp);
    if (floorT > 240) {
      // слишком долго на этаже — вниз
      g.descend();
      floorT = 0;
    }
  }
  st.level = g.state.hero.level;
  return st;
}

// учёт урона по герою от каждого вида монстров
const dmgBy: Record<string, number> = {};
const orig = World.prototype.onDamage;
World.prototype.onDamage = function (target, spec, n) {
  if (target === this.player && spec.source) {
    const id = (spec.source as unknown as { def?: { id: string } }).def?.id ?? 'other';
    dmgBy[id] = (dmgBy[id] ?? 0) + n;
  }
  return orig.call(this, target, spec, n);
};
process.on('exit', () => console.log('урон по герою:', JSON.stringify(dmgBy)));

const results: RunStats[] = [];
for (let i = 0; i < RUNS; i++) {
  const r = run(1000 + i * 7919);
  results.push(r);
  console.log(`прогон ${i + 1}: этаж ${r.reached}, смертей ${r.deaths}, время ${(r.time / 60).toFixed(1)} мин, зелий ${r.potions}, уровень ${r.level}, бой с боссом ${r.bossTime.toFixed(0)} с`);
}
const avg = (k: keyof RunStats) => (results.reduce((a, r) => a + r[k], 0) / results.length).toFixed(1);
console.log(`средн.: этаж ${avg('reached')}, смертей ${avg('deaths')}, уровень ${avg('level')}, босс ${avg('bossTime')} с`);

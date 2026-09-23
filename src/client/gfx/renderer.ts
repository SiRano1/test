import { Tile } from '../../core/tilemap';
import { itemDef } from '../../data/items';
import { Boss } from '../../game/entities/boss';
import { Enemy } from '../../game/entities/enemy';
import type { Entity } from '../../game/entities/entity';
import { Marker } from '../../game/entities/marker';
import { Npc } from '../../game/entities/npc';
import { Pickup } from '../../game/entities/pickup';
import { Player } from '../../game/entities/player';
import { Projectile } from '../../game/entities/projectile';
import { CrackedWall, Prop, Spot, Trigger } from '../../game/entities/props';
import type { Game } from '../../game/game';
import { duskTint, townDarkness } from '../../game/systems/calendar';
import type { World } from '../../game/world';
import { Camera, VIEW_H, VIEW_W } from '../engine/camera';
import { SpriteBank } from './bank';
import type { Dir } from './characters';
import { Particles } from './particles';
import { makeCanvas, rgba, type Canvas, type Ctx } from './pixel';
import { WINDOW_LIGHTS } from './props';
import { paintTiles, townPalette } from './tiles';

interface LightSrc {
  x: number;
  y: number;
  r: number;
  color: string;
  power: number;
}

const FACING_DIR: [Dir, boolean][] = [['down', false], ['side', true], ['side', false], ['up', false]];

export class Renderer {
  readonly cam = new Camera();
  readonly bank = new SpriteBank();
  readonly particles = new Particles();
  private staticLayer: Canvas | null = null;
  private staticCtx: Ctx | null = null;
  private staticWorld: World | null = null;
  private staticVersion = -1;
  private lightCanvas: Canvas;
  private lightCtx: Ctx;
  private flashT = 0;
  private flashDur = 1;
  private flashColor = '#fff';
  time = 0;

  constructor(private ctx: Ctx) {
    [this.lightCanvas, this.lightCtx] = makeCanvas(VIEW_W, VIEW_H);
  }

  flash(color: string, dur: number): void {
    this.flashColor = color;
    this.flashT = this.flashDur = dur;
  }

  worldToScreen(x: number, y: number): [number, number] {
    return [x - this.cam.rx, y - this.cam.ry];
  }

  screenToWorld(x: number, y: number): [number, number] {
    return [x + this.cam.rx, y + this.cam.ry];
  }

  private ensureStatic(w: World, season: number): void {
    if (this.staticWorld === w && this.staticVersion === w.map.version) return;
    const fresh = this.staticWorld !== w;
    if (fresh) {
      [this.staticLayer, this.staticCtx] = makeCanvas(w.map.w * 16, w.map.h * 16);
      this.particles.clear();
    }
    this.bank.setSeason(season);
    paintTiles(this.staticCtx!, w.map, w.theme, season);
    this.staticWorld = w;
    this.staticVersion = w.map.version;
    if (fresh) {
      const p = w.player;
      if (p) this.cam.follow(p.x, p.y - 8, w.map.w * 16, w.map.h * 16, 0, true);
    }
  }

  private game: Game | null = null;

  render(game: Game, dt: number): void {
    this.game = game;
    const ctx = this.ctx;
    const w = game.world;
    const season = game.state.time.season;
    this.time += dt;
    this.ensureStatic(w, season);
    const p = w.player;
    if (p) this.cam.follow(p.x, p.y - 8, w.map.w * 16, w.map.h * 16, dt);
    this.particles.update(game.busy && game.mode !== 'dead' ? 0 : dt);
    const cx = this.cam.rx, cy = this.cam.ry;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.drawImage(this.staticLayer!, cx, cy, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);
    if (w.kind === 'town') this.drawWater(w, season, cx, cy);

    // пол: декали, маркеры, телеграфы
    const ents = w.entities;
    for (const e of ents) if (e.layer === 0 && !e.removed) this.drawEntity(e, cx, cy, w);
    for (const e of ents) if (e instanceof Enemy && !e.dead) this.drawTelegraph(e, cx, cy);
    // тени
    for (const e of ents) {
      if (e.layer !== 1 || e.removed) continue;
      if (e instanceof Player || e instanceof Enemy || e instanceof Npc || e instanceof Pickup) {
        const sw = e instanceof Boss ? 12 : e instanceof Pickup ? 4 : Math.max(5, e.hw + 1);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(Math.round(e.x - cx), Math.round(e.y - cy), sw, Math.max(2, sw * 0.4), 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // сортировка по Y
    const sorted = ents.filter((e) => e.layer === 1 && !e.removed).sort((a, b) => a.y - b.y);
    for (const e of sorted) this.drawEntity(e, cx, cy, w);
    for (const e of ents) if (e.layer === 2 && !e.removed) this.drawEntity(e, cx, cy, w);

    this.particles.draw(ctx, cx, cy);
    this.drawLighting(game, cx, cy);
    for (const e of sorted) if (e instanceof Enemy && !e.dead && e.hp < e.maxHp && !(e instanceof Boss)) this.drawHpBar(e, cx, cy);

    // экранные эффекты
    if (this.flashT > 0) {
      this.flashT -= dt;
      ctx.fillStyle = rgba(this.flashColor, Math.max(0, this.flashT / this.flashDur) * 0.6);
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (p && p.hp < p.maxHp * 0.25 && !p.dead) {
      const a = 0.18 + Math.sin(this.time * 6) * 0.08;
      const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.6);
      g.addColorStop(0, 'rgba(120,0,0,0)');
      g.addColorStop(1, `rgba(140,0,0,${a})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    const fade = game.fade;
    if (fade > 0) {
      ctx.fillStyle = `rgba(0,0,0,${fade})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  private drawWater(w: World, season: number, cx: number, cy: number): void {
    const ctx = this.ctx;
    const tx0 = Math.floor(cx / 16), ty0 = Math.floor(cy / 16);
    const P = townPalette(season);
    for (let ty = ty0; ty <= ty0 + 17; ty++)
      for (let tx = tx0; tx <= tx0 + 30; tx++) {
        const t = w.map.get(tx, ty);
        if (t !== Tile.WATER && t !== Tile.DEEPWATER) continue;
        const ph = this.time * 1.5 + tx * 0.7 + ty * 1.3;
        const off = Math.floor((Math.sin(ph) + 1) * 4);
        ctx.fillStyle = rgba('#ffffff', 0.18);
        ctx.fillRect(tx * 16 - cx + off, ty * 16 - cy + 5 + ((tx + ty) % 3) * 3, 5, 1);
        ctx.fillStyle = rgba(P.water, 0.4);
        ctx.fillRect(tx * 16 - cx + ((off + 8) % 16), ty * 16 - cy + 11, 4, 1);
      }
  }

  private drawTelegraph(e: Enemy, cx: number, cy: number): void {
    const tg = e.telegraph();
    if (!tg) return;
    const ctx = this.ctx;
    const x = tg.x - cx, y = tg.y - cy;
    const a = 0.15 + tg.p * 0.35;
    ctx.fillStyle = `rgba(255,50,40,${a})`;
    ctx.strokeStyle = `rgba(255,120,100,${0.4 + tg.p * 0.5})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (tg.kind === 'arc') {
      ctx.moveTo(x, y);
      ctx.arc(x, y, tg.r * (0.4 + 0.6 * tg.p), tg.angle - tg.half, tg.angle + tg.half);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, tg.r, tg.angle - tg.half, tg.angle + tg.half);
      ctx.stroke();
    } else if (tg.kind === 'lunge') {
      const len = tg.r * tg.p;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(tg.angle);
      ctx.fillRect(0, -4, len, 8);
      ctx.strokeRect(0, -4, tg.r, 8);
      ctx.restore();
    } else if (tg.kind === 'nova') {
      ctx.arc(x, y, tg.r * tg.p, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, tg.r, 0, Math.PI * 2);
      ctx.stroke();
    } else if (tg.kind === 'projectile') {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(tg.angle);
      ctx.fillStyle = `rgba(255,80,60,${0.3 + tg.p * 0.5})`;
      ctx.fillRect(4, -1, 10 + tg.p * 16, 2);
      ctx.restore();
    } else if (tg.kind === 'summon') {
      ctx.arc(x, y + 4, 10 + tg.p * 8, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawHpBar(e: Enemy, cx: number, cy: number): void {
    const ctx = this.ctx;
    const w = e.def.elite ? 20 : 14;
    const x = Math.round(e.x - cx - w / 2), y = Math.round(e.y - cy - (e.def.elite ? 30 : 24));
    ctx.fillStyle = '#1a1014';
    ctx.fillRect(x - 1, y - 1, w + 2, 4);
    ctx.fillStyle = '#5a1a1a';
    ctx.fillRect(x, y, w, 2);
    ctx.fillStyle = e.def.elite ? '#ffb040' : '#e04040';
    ctx.fillRect(x, y, Math.max(1, Math.round((w * e.hp) / e.maxHp)), 2);
  }

  private blit(img: Canvas, x: number, y: number, ax: number, ay: number, flip = false, flash = 0, alpha = 1, red = 0): void {
    const ctx = this.ctx;
    const src = flip ? this.bank.flipped(img) : img;
    const dx = Math.round(x - (flip ? img.width - ax : ax)), dy = Math.round(y - ay);
    if (alpha < 1) ctx.globalAlpha = alpha;
    ctx.drawImage(src, dx, dy);
    if (red > 0) {
      ctx.globalAlpha = red * alpha;
      ctx.drawImage(this.bank.red(src), dx, dy);
    }
    if (flash > 0) {
      ctx.globalAlpha = Math.min(1, flash * 8) * alpha;
      ctx.drawImage(this.bank.white(src), dx, dy);
    }
    ctx.globalAlpha = 1;
  }

  private drawEntity(e: Entity, cx: number, cy: number, w: World): void {
    const x = e.x - cx, y = e.y - cy;
    if (x < -80 || y < -40 || x > VIEW_W + 80 || y > VIEW_H + 120) return;
    if (e instanceof Player) return this.drawPlayer(e, x, y);
    if (e instanceof Enemy) return this.drawEnemy(e, x, y);
    if (e instanceof Npc) {
      const [dir, flip] = FACING_DIR[e.facing]!;
      const frame = e.moving ? ([1, 0, 2, 0] as const)[Math.floor(e.animT * 7) % 4]! : 0;
      return this.blit(this.bank.char(e.def.id, dir, frame), x, y, 8, 20, flip);
    }
    if (e instanceof Pickup) {
      const img = e.stack ? this.bank.icon(e.stack.def) : this.bank.icon('__coin');
      const bob = e.z > 0 ? e.z : Math.sin(e.animT * 4) * 1.5 + 1.5;
      const ctx = this.ctx;
      if (e.stack) {
        ctx.save();
        ctx.translate(Math.round(x), Math.round(y - bob - 6));
        ctx.scale(0.75, 0.75);
        ctx.drawImage(img, -8, -8);
        ctx.restore();
      } else {
        ctx.fillStyle = '#1a1014';
        ctx.fillRect(Math.round(x) - 3, Math.round(y - bob) - 6, 6, 6);
        ctx.fillStyle = '#ffd040';
        ctx.fillRect(Math.round(x) - 2, Math.round(y - bob) - 5, 4, 4);
        ctx.fillStyle = '#fff0a0';
        ctx.fillRect(Math.round(x) - 2, Math.round(y - bob) - 5, 1, 1);
      }
      return;
    }
    if (e instanceof Projectile) return this.drawProjectile(e, x, y);
    if (e instanceof Marker) {
      const ctx = this.ctx;
      ctx.fillStyle = `rgba(255,60,40,${0.15 + e.p * 0.3})`;
      ctx.strokeStyle = `rgba(255,140,100,${0.5 + e.p * 0.5})`;
      ctx.beginPath();
      ctx.arc(x, y, e.r * e.p, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, e.r, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    if (e instanceof Spot || e instanceof Trigger) return;
    if (e instanceof CrackedWall) {
      const art = this.bank.prop('cracked');
      if (art) this.blit(art.frames[0]!, x, y, art.ax, art.ay, false, e.flash);
      return;
    }
    if (e instanceof Prop) {
      const art = this.bank.prop(e.sprite);
      if (!art) return;
      const f = art.fps ? Math.floor((this.time + e.id * 0.37) * art.fps) % art.frames.length : 0;
      this.blit(art.frames[f]!, x, y, art.ax, art.ay, false, e.flash);
      void w;
    }
  }

  private drawPlayer(p: Player, x: number, y: number): void {
    const ctx = this.ctx;
    const [dir, flip] = FACING_DIR[p.facing]!;
    let frame: 0 | 1 | 2 = 0;
    if (p.moving && (p.state === 'free' || p.state === 'block' || p.state === 'charge')) frame = ([1, 0, 2, 0] as const)[Math.floor(p.animT * 8) % 4]!;
    const img = this.bank.char('hero', dir, frame);
    let alpha = 1;
    if (p.invuln > 0 && p.state !== 'dodge' && Math.floor(this.time * 20) % 2 === 0) alpha = 0.45;
    if (p.dead) alpha = Math.max(0.2, 1 - p.deathT);
    const weaponBehind = p.facing === 3;
    if (weaponBehind) this.drawWeapon(p, x, y);
    if (p.state === 'dodge') {
      // «шлейф» переката
      ctx.globalAlpha = 0.3;
      ctx.drawImage(flip ? this.bank.flipped(img) : img, Math.round(x - 8 - p.dodgeX * 6), Math.round(y - 20 - p.dodgeY * 6));
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y - 6));
      ctx.scale(1.1, 0.8);
      ctx.drawImage(flip ? this.bank.flipped(img) : img, -8, -14);
      ctx.restore();
    } else this.blit(img, x, y, 8, 20, flip, p.flash, alpha);
    if (!weaponBehind) this.drawWeapon(p, x, y);
    if (p.state === 'charge') {
      const k = p.chargeP;
      ctx.strokeStyle = k >= 1 ? '#ffe070' : `rgba(255,255,255,${0.3 + k * 0.5})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(Math.round(x), Math.round(y - 8), 14 - k * 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
      ctx.stroke();
    }
    if (p.stun > 0) this.drawStars(x, y - 24);
  }

  private drawWeapon(p: Player, x: number, y: number): void {
    const w = p.weaponCls ? this.bank.icon(this.weaponDef(p)) : null;
    if (!w) return;
    const ctx = this.ctx;
    let angle: number | null = null;
    let dist = 7;
    if (p.state === 'attack' || p.state === 'heavy') {
      const sw = p.swing;
      const half = sw && sw.half > 0 ? sw.half : 0.2;
      const dirS = p.swingDir;
      const prog = p.phase === 'windup' ? 0 : p.phase === 'active' ? p.swingP : 1;
      angle = p.attackAngle - dirS * half + dirS * 2 * half * prog;
      if (p.profile.ranged) angle = p.attackAngle;
      if (p.weaponCls === 'spear') {
        angle = p.attackAngle;
        dist = p.phase === 'windup' ? 3 : 10;
      }
    } else if (p.state === 'skill') {
      angle = p.attackAngle + (p.profile.skill.id === 'whirl' ? p.st * 26 : 0);
    } else if (p.state === 'block' || p.state === 'charge') {
      angle = p.aim;
      dist = 6;
    }
    if (angle === null) return;
    ctx.save();
    ctx.translate(Math.round(x + Math.cos(angle) * dist), Math.round(y - 8 + Math.sin(angle) * dist));
    ctx.rotate(angle + Math.PI / 4);
    ctx.drawImage(w, -8, -8);
    ctx.restore();
  }

  private weaponDef(_p: Player): string {
    const eq = this.game?.state.equipment.weapon;
    return eq ? eq.def : 'rusty_sword';
  }

  private drawEnemy(e: Enemy, x: number, y: number): void {
    const sprite = e.sprite;
    const n = this.bank.monsterFrameCount(sprite);
    const moving = e.state === 'chase' || e.state === 'idle';
    const fps = e.def.flyer ? 10 : 6;
    let frame = moving ? Math.floor(e.animT * fps) % n : 0;
    if (e.state === 'active') frame = n > 1 ? 1 : 0;
    const img = this.bank.monster(sprite, frame);
    const ax = img.width / 2, ay = img.height;
    const tg = e.state === 'windup' && e.atk ? Math.min(1, e.st / e.atk.windup) : 0;
    const red = tg > 0 ? 0.25 + 0.45 * Math.abs(Math.sin(tg * Math.PI * 3)) : 0;
    const floatY = e.def.flyer ? Math.sin(e.animT * 5) * 2 + 4 : 0;
    const alpha = e.def.sprite === 'ghost' ? 0.8 * e.alpha : e.alpha;
    let shake = 0;
    if (tg > 0.6) shake = (Math.random() - 0.5) * 2;
    this.blit(img, x + shake, y - floatY, ax, ay, e.flip, e.flash, alpha, red);
    if (e.stun > 0) this.drawStars(x, y - img.height - 2);
    if (e instanceof Boss && !e.awake) {
      this.ctx.fillStyle = 'rgba(160,200,255,0.5)';
      this.ctx.fillRect(Math.round(x) - 1, Math.round(y - img.height - 6 + Math.sin(this.time * 3) * 2), 2, 2);
    }
  }

  private drawStars(x: number, y: number): void {
    const ctx = this.ctx;
    for (let i = 0; i < 3; i++) {
      const a = this.time * 5 + (i * Math.PI * 2) / 3;
      ctx.fillStyle = '#ffe070';
      ctx.fillRect(Math.round(x + Math.cos(a) * 6), Math.round(y + Math.sin(a) * 2), 2, 2);
    }
  }

  private drawProjectile(e: Projectile, x: number, y: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y - e.z));
    ctx.rotate(e.angle);
    switch (e.sprite) {
      case 'arrow':
        ctx.fillStyle = '#8a5a33';
        ctx.fillRect(-6, 0, 10, 1);
        ctx.fillStyle = '#d8d8e0';
        ctx.fillRect(4, -1, 3, 3);
        ctx.fillStyle = '#e8e0d0';
        ctx.fillRect(-7, -1, 2, 3);
        break;
      case 'spear':
        ctx.fillStyle = '#8a5a33';
        ctx.fillRect(-10, 0, 16, 1);
        ctx.fillStyle = '#c8d0e0';
        ctx.fillRect(6, -1, 4, 3);
        break;
      case 'bone_shard':
        ctx.fillStyle = '#e8e0c8';
        ctx.fillRect(-3, -1, 6, 2);
        ctx.fillStyle = '#8fd0ff';
        ctx.fillRect(2, -1, 2, 2);
        break;
      case 'wave':
        ctx.fillStyle = 'rgba(120,190,230,0.8)';
        ctx.fillRect(-3, -7, 6, 14);
        ctx.fillStyle = '#e8f4ff';
        ctx.fillRect(2, -7, 2, 14);
        break;
      case 'bolt':
      case 'orb': {
        const r = e.sprite === 'orb' ? 5 : 3;
        const col = e.opts.color ?? '#c0a0ff';
        ctx.fillStyle = rgba(col, 0.4);
        ctx.beginPath();
        ctx.arc(0, 0, r + 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-1, -1, 2, 2);
        break;
      }
      default:
        ctx.fillStyle = '#fff';
        ctx.fillRect(-2, -2, 4, 4);
    }
    ctx.restore();
  }

  // ─────────────── Свет ───────────────

  private drawLighting(game: Game, cx: number, cy: number): void {
    const w = game.world;
    const ctx = this.ctx;
    const mins = game.state.time.minutes;
    let dark = w.darkness;
    let darkColor = w.tier?.palette.dark ?? '#060408';
    const night = w.kind === 'town' ? townDarkness(mins) : 0;
    if (w.kind === 'town') {
      dark = night;
      darkColor = '#0a1030';
      const dusk = duskTint(mins);
      if (dusk > 0) {
        ctx.fillStyle = `rgba(255,120,40,${dusk * 0.14})`;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      }
    }
    if (dark <= 0.01) return;
    const lights: LightSrc[] = [];
    const p = w.player;
    if (p) {
      const r = w.kind === 'dungeon' ? 92 : w.kind === 'interior' ? 70 : 56;
      lights.push({ x: p.x, y: p.y - 8, r: r + Math.sin(this.time * 7) * 2, color: '#ffc880', power: 1 });
    }
    for (const e of w.entities) {
      const L = e.light;
      if (!L || e.removed) continue;
      if ((e as unknown as { nightOnly?: boolean }).nightOnly && night < 0.15) continue;
      const fl = L.flicker ? 1 + Math.sin(this.time * 11 + e.id) * L.flicker * 0.5 + (Math.random() - 0.5) * L.flicker * 0.3 : 1;
      lights.push({ x: e.x, y: e.y - 8, r: L.r * fl, color: L.color, power: L.power ?? 0.8 });
    }
    if (w.kind === 'town' && night > 0.15) {
      for (const e of w.entities) {
        if (!(e instanceof Prop) || !e.sprite.startsWith('building:')) continue;
        const wins = WINDOW_LIGHTS[e.sprite.slice(9)];
        if (!wins) continue;
        for (const wl of wins) lights.push({ x: e.x + wl.x, y: e.y + wl.y, r: 22, color: '#ffc060', power: 0.9 });
      }
    }
    const lc = this.lightCtx;
    lc.globalCompositeOperation = 'source-over';
    lc.clearRect(0, 0, VIEW_W, VIEW_H);
    lc.fillStyle = rgba(darkColor, dark);
    lc.fillRect(0, 0, VIEW_W, VIEW_H);
    lc.globalCompositeOperation = 'destination-out';
    for (const L of lights) {
      const x = L.x - cx, y = L.y - cy;
      if (x < -L.r || y < -L.r || x > VIEW_W + L.r || y > VIEW_H + L.r) continue;
      const g = lc.createRadialGradient(x, y, 0, x, y, L.r);
      g.addColorStop(0, `rgba(0,0,0,${L.power})`);
      g.addColorStop(0.55, `rgba(0,0,0,${L.power * 0.6})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lc.fillStyle = g;
      lc.beginPath();
      lc.arc(x, y, L.r, 0, Math.PI * 2);
      lc.fill();
    }
    ctx.drawImage(this.lightCanvas, 0, 0);
    // цветное свечение
    ctx.globalCompositeOperation = 'lighter';
    for (const L of lights) {
      const x = L.x - cx, y = L.y - cy;
      if (x < -L.r || y < -L.r || x > VIEW_W + L.r || y > VIEW_H + L.r) continue;
      const g = ctx.createRadialGradient(x, y, 0, x, y, L.r * 0.8);
      g.addColorStop(0, rgba(L.color, 0.16 * L.power * dark));
      g.addColorStop(1, rgba(L.color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - L.r, y - L.r, L.r * 2, L.r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /** Иконка предмета для UI. */
  iconUrl(def: string): string {
    itemDef(def);
    return this.bank.iconUrl(def);
  }
}

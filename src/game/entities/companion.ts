import { dist, facingFromVec } from '../../core/math';
import { findPath } from '../../core/pathfind';
import { npcDef, type NpcDef } from '../../data/npcs';
import type { HitSpec } from '../combat/combat';
import type { World } from '../world';
import { Actor } from './entity';
import { Projectile } from './projectile';

export type CompanionStyle = 'spear' | 'bow' | 'staff' | 'sword' | 'shield' | 'holy';

const STYLE: Record<CompanionStyle, { range: number; ranged: boolean; mult: number; cd: number; color: string; weapon: string }> = {
  sword: { range: 22, ranged: false, mult: 1, cd: 0.7, color: '#f0f0ff', weapon: 'iron_sword' },
  spear: { range: 34, ranged: false, mult: 1.1, cd: 0.9, color: '#e0f0ff', weapon: 'iron_spear' },
  shield: { range: 20, ranged: false, mult: 1.2, cd: 1, color: '#fff0c0', weapon: 'iron_shield' },
  bow: { range: 130, ranged: true, mult: 0.9, cd: 1.1, color: '#e0d0a0', weapon: 'iron_bow' },
  staff: { range: 120, ranged: true, mult: 1, cd: 1.2, color: '#ff9040', weapon: 'iron_staff' },
  holy: { range: 110, ranged: true, mult: 0.8, cd: 1.3, color: '#fff0a0', weapon: 'silver_staff' },
};

/**
 * Компаньон: следует за героем, атакует его цели, раз в 12 с применяет навык.
 * Сила растёт с уровнем героя и дружбой. Может один раз за день поднять павшего героя.
 */
export class Companion extends Actor {
  def: NpcDef;
  style: CompanionStyle;
  atkPower: number;
  cd = 0;
  skillCd = 6;
  swingT = 0;
  swingAngle = 0;
  moving = false;
  canRevive: boolean;
  path: [number, number][] | null = null;
  pathT = 0;
  downed = false;

  constructor(id: string, x: number, y: number, heroLevel: number, hearts: number, canRevive: boolean) {
    super();
    this.def = npcDef(id);
    this.style = (this.def.companion ?? 'sword') as CompanionStyle;
    this.team = 'player';
    this.x = x;
    this.y = y;
    this.hw = 5;
    this.hh = 3;
    this.mass = 2;
    this.sprite = `npc:${id}`;
    const k = 1 + heroLevel * 0.12 + hearts * 0.03;
    this.hp = this.maxHp = Math.round(80 * k * (id === 'halvard' ? 3 : 1));
    this.atkPower = 8 * k * (id === 'halvard' ? 2.5 : 1);
    this.stats.def = 4 + heroLevel * 1.5;
    this.canRevive = canRevive;
    this.blockRatio = 0.6;
  }

  get weaponIcon(): string {
    return STYLE[this.style].weapon;
  }

  private target(w: World): Actor | null {
    let best: Actor | null = null;
    let bd = 150;
    for (const e of w.enemies()) {
      const d = dist(this.x, this.y, e.x, e.y);
      if (d < bd && w.map.lineOfSight(this.x, this.y - 4, e.x, e.y - 4)) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  private spec(mult: number): HitSpec {
    const el = this.style === 'staff' ? 'fire' : this.style === 'holy' ? 'holy' : 'phys';
    return { dmg: this.atkPower * mult, element: el, crit: 0.08, critMul: 1.75, knock: 90, source: this };
  }

  override update(w: World, dt: number): void {
    this.animT += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.cd -= dt;
    this.skillCd -= dt;
    this.swingT = Math.max(0, this.swingT - dt);
    if (this.dead) {
      this.deathT += dt;
      this.alpha = Math.max(0.3, 1 - this.deathT);
      return;
    }
    this.tickStatuses(w, dt);
    this.applyKnock(w, dt);
    if (this.stun > 0 || this.hurt > 0) {
      this.stun = Math.max(0, this.stun - dt);
      this.hurt = Math.max(0, this.hurt - dt);
      return;
    }
    const p = w.player;
    if (!p) return;
    const st = STYLE[this.style];
    // лекарь подлечивает героя
    if (this.style === 'holy' && this.skillCd <= 0 && p.hp < p.maxHp * 0.55 && !p.dead) {
      this.skillCd = 12;
      const heal = Math.round(p.maxHp * 0.25);
      p.hp = Math.min(p.maxHp, p.hp + heal);
      w.fx({ t: 'dmg', x: p.x, y: p.y - 18, n: heal, color: '#70ff70' });
      w.fx({ t: 'sparkle', x: p.x, y: p.y - 8, color: '#fff0a0', n: 12 });
      w.fx({ t: 'sfx', id: 'heal' });
    }
    const tgt = this.target(w);
    let gx = p.x - Math.cos(p.aim) * 18, gy = p.y - Math.sin(p.aim) * 12;
    if (tgt) {
      const d = dist(this.x, this.y, tgt.x, tgt.y);
      const a = Math.atan2(tgt.y - this.y, tgt.x - this.x);
      this.facing = facingFromVec(Math.cos(a), Math.sin(a), this.facing);
      if (d <= st.range + Math.max(tgt.hw, tgt.hh)) {
        gx = this.x;
        gy = this.y;
        if (this.cd <= 0) this.attack(w, tgt, a);
      } else {
        gx = tgt.x - Math.cos(a) * (st.ranged ? st.range * 0.7 : st.range * 0.6);
        gy = tgt.y - Math.sin(a) * (st.ranged ? st.range * 0.7 : st.range * 0.6);
      }
    }
    // держимся рядом с героем
    if (dist(this.x, this.y, p.x, p.y) > 180) {
      this.x = p.x - Math.cos(p.aim) * 14;
      this.y = p.y - Math.sin(p.aim) * 10;
    }
    const d = dist(this.x, this.y, gx, gy);
    if (d > 6) {
      const sp = 84 * w.map.groundMul(this.x, this.y);
      let tx = gx, ty = gy;
      if (!w.map.lineOfSight(this.x, this.y - 2, gx, gy - 2)) {
        this.pathT -= dt;
        if (this.pathT <= 0 || !this.path) {
          this.pathT = 0.6;
          this.path = findPath(w.map, Math.floor(this.x / 16), Math.floor(this.y / 16), Math.floor(gx / 16), Math.floor(gy / 16), 800);
        }
        const n = this.path?.[0];
        if (n) {
          tx = n[0] * 16 + 8;
          ty = n[1] * 16 + 8;
          if (dist(this.x, this.y, tx, ty) < 4) this.path!.shift();
        }
      } else this.path = null;
      const l = Math.hypot(tx - this.x, ty - this.y) || 1;
      w.map.move(this, ((tx - this.x) / l) * sp * dt, ((ty - this.y) / l) * sp * dt);
      if (!tgt) this.facing = facingFromVec(tx - this.x, ty - this.y, this.facing);
      this.moving = true;
    } else this.moving = false;
  }

  private attack(w: World, tgt: Actor, a: number): void {
    const st = STYLE[this.style];
    this.cd = st.cd;
    this.swingT = 0.2;
    this.swingAngle = a;
    const useSkill = this.skillCd <= 0 && this.style !== 'holy';
    if (useSkill) this.skillCd = 12;
    const mult = st.mult * (useSkill ? 2 : 1);
    if (st.ranged) {
      const sprite = this.style === 'bow' ? 'arrow' : 'bolt';
      const n = useSkill ? 3 : 1;
      for (let i = 0; i < n; i++)
        w.add(new Projectile(this.x, this.y - 6, a + (i - (n - 1) / 2) * 0.2, 240, 'player', this.spec(mult), sprite, {
          color: this.style === 'bow' ? undefined : st.color, life: 1.2,
        }));
      w.fx({ t: 'sfx', id: this.style === 'bow' ? 'bow' : 'cast', vol: 0.6 });
    } else {
      const r = st.range + (useSkill ? 10 : 0);
      w.spawnHitbox({
        owner: this, team: 'player', shape: useSkill ? 'circle' : 'arc', x: this.x, y: this.y - 4, r, angle: a, half: useSkill ? Math.PI : 1.1,
        follow: true, ox: 0, oy: -4, t: 0.12, delay: 0, breaks: false, spec: this.spec(mult),
      });
      w.fx({ t: 'slash', x: this.x, y: this.y - 4, angle: a, r, half: useSkill ? Math.PI : 1.1, color: st.color, dur: 0.15, heavy: useSkill });
      w.fx({ t: 'sfx', id: 'swing', vol: 0.5 });
    }
    void tgt;
  }

  override die(w: World): void {
    if (this.dead) return;
    this.dead = true;
    this.downed = true;
    this.pushable = false;
    this.deathT = 0;
    w.fx({ t: 'text', x: this.x, y: this.y - 22, text: '…', color: '#c0c0c0' });
    w.fx({ t: 'sfx', id: 'hurt' });
  }
}

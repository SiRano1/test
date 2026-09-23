import { facingFromVec, snap8 } from '../../core/math';
import { itemDef } from '../../data/items';
import { tr } from '../../data/strings';
import type { HitSpec } from '../combat/combat';
import { ELEMENT_COLORS, HEAVY_MANA, staffElement, WEAPON_PROFILES, type SwingDef, type WeaponProfile } from '../combat/weapons';
import type { InputFrame } from '../input';
import type { Element, ItemStack, Stats, WeaponClass } from '../types';
import type { GameApi, World } from '../world';
import { activeTalents } from '../systems/talents';
import { Actor } from './entity';
import { Projectile } from './projectile';

export type PlayerState = 'free' | 'attack' | 'charge' | 'heavy' | 'dodge' | 'block' | 'skill' | 'hurt' | 'dead';

const WALK_SPEED = 88;
const DODGE_SPEED = 250;
const DODGE_TIME = 0.3;
const DODGE_IFRAMES = 0.22;
const DODGE_COST = 20;
const BUFFER = 0.18;

export class Player extends Actor {
  readonly controlled = true as const;
  state: PlayerState = 'free';
  st = 0;
  stamina = 100;
  maxStamina = 100;
  mana = 60;
  maxMana = 60;
  staminaDelay = 0;
  weaponCls: WeaponClass | null = null;
  profile: WeaponProfile = WEAPON_PROFILES.fist;
  element: Element = 'phys';
  combo = 0;
  phase: 'windup' | 'active' | 'recover' = 'windup';
  phaseT = 0;
  swing: SwingDef | null = null;
  swingDir = 1;
  attackAngle = 0;
  holdT = 0;
  chargeT = 0;
  dodgeX = 0;
  dodgeY = 0;
  skillCd = 0;
  moving = false;
  bufAttack = -99;
  bufDodge = -99;
  /** Для отрисовки оружия: прогресс взмаха 0..1. */
  swingP = 0;
  private skillHits = 0;
  private lastStep = 0;
  /** Посох без маны бьёт как палка. */
  private forceMelee = false;
  /** Изученные таланты текущего класса оружия. */
  talents = new Set<string>();
  /** Множитель расхода стамины на блок. */
  blockCost = 1;
  /** После парирования (талант «Ответный удар») следующий удар — критический. */
  counterCrit = false;

  constructor(private game: GameApi) {
    super();
    this.team = 'player';
    this.hw = 5;
    this.hh = 3;
    this.mass = 4;
    this.sprite = 'hero';
    const h = game.state.hero;
    this.hp = h.hp;
    this.stamina = h.stamina;
    this.mana = h.mana;
    this.refresh();
  }

  /** Пересчитать характеристики после смены экипировки/баффов. */
  refresh(): void {
    const st: Stats = this.game.stats();
    this.stats = st;
    this.maxHp = Math.round(st.maxHp);
    this.maxStamina = Math.round(st.maxStamina);
    this.maxMana = Math.round(st.maxMana);
    this.hp = Math.min(this.hp, this.maxHp);
    this.stamina = Math.min(this.stamina, this.maxStamina);
    this.mana = Math.min(this.mana, this.maxMana);
    const w: ItemStack | null = this.game.state.equipment.weapon;
    if (w) {
      const d = itemDef(w.def);
      this.weaponCls = d.weapon!.cls;
      this.profile = WEAPON_PROFILES[this.weaponCls];
      this.element = this.weaponCls === 'staff' ? staffElement(d.material) : 'phys';
    } else {
      this.weaponCls = null;
      this.profile = WEAPON_PROFILES.fist;
      this.element = 'phys';
    }
    this.talents = new Set(activeTalents(this.game.state, this.weaponCls).map((d) => d.id));
    this.profile = this.tunedProfile(this.profile);
    this.blockRatio = this.tal('sh_bastion') ? 0.95 : this.profile.blockRatio;
    this.parryWindow = this.profile.parry + (this.tal('sh_parry') ? 0.1 : 0);
    this.blockCost = this.tal('sh_unbreak') ? 0.5 : 1;
    this.dmgTakenMul = this.game.state.settings.story ? 0.5 : 1;
  }

  tal(id: string): boolean {
    return this.talents.has(id);
  }

  /** Профиль оружия с поправками талантов (дальность, четвёртый удар, откаты). */
  private tunedProfile(base: WeaponProfile): WeaponProfile {
    if (this.talents.size === 0) return base;
    const p: WeaponProfile = { ...base, combo: base.combo.map((c) => ({ ...c })), heavy: { ...base.heavy }, skill: { ...base.skill } };
    if (this.tal('sp_reach')) {
      for (const c of p.combo) c.r *= 1.2;
      p.heavy.r *= 1.2;
    }
    if (this.tal('sw_fourth')) {
      const last = p.combo[p.combo.length - 1]!;
      p.combo.push({ ...last, mult: 1.9, windup: 0.1, active: 0.14, recover: 0.4, r: last.r + 3, half: 1.6, step: 10, stamina: 16, knock: 240 });
    }
    if (this.tal('sp_lunge')) p.heavy.mult *= 1.3;
    if (this.tal('sp_dragon')) p.heavy.mult *= 1.3;
    if (this.tal('sh_hammer')) {
      p.heavy.mult *= 1.4;
      p.heavy.r *= 1.3;
    }
    if (this.tal('sw_whirl2') || this.tal('sp_throw2') || this.tal('sh_ram')) p.skill.cd = 3.5;
    return p;
  }

  /** Сколько держать атаку для заряженного удара. */
  get chargeTime(): number {
    return this.tal('bw_draw') ? 0.31 : 0.45;
  }

  get chargeP(): number {
    return this.state === 'charge' ? Math.min(1, this.chargeT / this.chargeTime) : 0;
  }

  get skillReady(): boolean {
    return this.skillCd <= 0;
  }

  private spend(n: number): boolean {
    if (n <= 0) return true;
    if (this.stamina <= 0) {
      this.game.events.emit('fx', { t: 'text', x: this.x, y: this.y - 24, text: tr('exhausted'), color: '#ffd040' });
      return false;
    }
    this.stamina -= n;
    this.staminaDelay = 0.6;
    if (this.stamina <= 0) {
      this.stamina = 0;
      this.staminaDelay = 1.3;
    }
    return true;
  }

  private spendMana(n: number): boolean {
    if (this.mana < n) {
      this.game.events.emit('fx', { t: 'text', x: this.x, y: this.y - 24, text: '✦', color: '#8ab0ff' });
      return false;
    }
    this.mana -= n;
    return true;
  }

  private setState(s: PlayerState): void {
    this.state = s;
    this.st = 0;
    this.blocking = s === 'block';
  }

  private updateAim(inp: InputFrame): void {
    if (inp.aimX !== null && inp.aimY !== null) {
      this.aim = Math.atan2(inp.aimY - (this.y - 6), inp.aimX - this.x);
    } else if (inp.stickAimX !== undefined && Math.hypot(inp.stickAimX, inp.stickAimY ?? 0) > 0.3) {
      this.aim = Math.atan2(inp.stickAimY ?? 0, inp.stickAimX);
    } else if (inp.mx !== 0 || inp.my !== 0) {
      const [sx, sy] = snap8(inp.mx, inp.my);
      this.aim = Math.atan2(sy, sx);
    }
  }

  override update(w: World, dt: number): void {
    const inp = w.input;
    this.st += dt;
    this.animT += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.skillCd = Math.max(0, this.skillCd - dt);
    this.tickStatuses(w, dt);
    this.regen(dt);
    if (this.dead) {
      this.deathT += dt;
      return;
    }
    if (!inp) return;
    if (inp.pressed.has('attack')) this.bufAttack = w.time;
    if (inp.pressed.has('dodge')) this.bufDodge = w.time;
    if (inp.down.has('attack')) this.holdT += dt;
    else this.holdT = 0;

    // оглушение / урон прерывают действия
    if (this.stun > 0 || this.hurt > 0) {
      this.stun = Math.max(0, this.stun - dt);
      this.hurt = Math.max(0, this.hurt - dt);
      if (this.state !== 'hurt') this.setState('hurt');
      this.applyKnock(w, dt);
      return;
    }
    if (this.state === 'hurt') this.setState('free');
    this.applyKnock(w, dt);

    switch (this.state) {
      case 'free':
        this.updateAim(inp);
        this.move(w, inp, dt, 1);
        this.tryActions(w, inp);
        break;
      case 'block':
        this.updateAim(inp);
        this.move(w, inp, dt, 0.4);
        if (!inp.down.has('block')) this.setState('free');
        else if (this.buffered(w, 'dodge')) this.startDodge(w, inp);
        break;
      case 'attack':
      case 'heavy':
        this.updateSwing(w, inp, dt);
        break;
      case 'charge':
        this.updateAim(inp);
        this.move(w, inp, dt, 0.45);
        this.chargeT += dt;
        if (!inp.down.has('attack')) {
          if (this.chargeT >= this.chargeTime) this.startHeavy(w);
          else this.setState('free');
        } else if (this.buffered(w, 'dodge')) this.startDodge(w, inp);
        break;
      case 'dodge':
        this.updateDodge(w, dt);
        break;
      case 'skill':
        this.updateSkill(w, dt);
        break;
    }
  }

  private buffered(w: World, what: 'attack' | 'dodge'): boolean {
    const t = what === 'attack' ? this.bufAttack : this.bufDodge;
    if (w.time - t <= BUFFER) {
      if (what === 'attack') this.bufAttack = -99;
      else this.bufDodge = -99;
      return true;
    }
    return false;
  }

  private tryActions(w: World, inp: InputFrame): void {
    if (this.buffered(w, 'dodge')) return this.startDodge(w, inp);
    if (inp.down.has('block')) {
      this.setState('block');
      this.blockStart = w.time;
      return;
    }
    if (inp.pressed.has('skill')) return this.startSkill(w);
    if (this.buffered(w, 'attack')) return this.startAttack(w, 0);
    if (inp.down.has('attack') && this.holdT > 0.2) {
      this.setState('charge');
      this.chargeT = 0;
    }
  }

  private move(w: World, inp: InputFrame, dt: number, mul: number): void {
    const sp = WALK_SPEED * this.stats.speed * this.moveMul() * mul * w.map.groundMul(this.x, this.y);
    this.moving = inp.mx !== 0 || inp.my !== 0;
    if (this.moving) {
      w.map.move(this, inp.mx * sp * dt, inp.my * sp * dt);
      if (w.time - this.lastStep > 0.28 && mul >= 1) {
        this.lastStep = w.time;
        if (w.kind !== 'interior') w.fx({ t: 'dust', x: this.x, y: this.y, n: 1 });
      }
    }
    this.facing = facingFromVec(Math.cos(this.aim), Math.sin(this.aim), this.facing);
  }

  // ───── Атаки ─────

  private startAttack(w: World, combo: number): void {
    const p = this.profile;
    const def = p.combo[combo % p.combo.length]!;
    if (p.ranged === 'bolt') {
      if (!this.spendMana(p.mana ?? 0)) {
        // без маны посох бьёт как палка
        return this.startMelee(w, WEAPON_PROFILES.fist.combo[0]!, 0, true);
      }
    } else if (!this.spend(def.stamina * this.staminaMul())) return;
    this.startMelee(w, def, combo, false);
  }

  private startMelee(w: World, def: SwingDef, combo: number, forceMelee: boolean): void {
    this.setState('attack');
    this.forceMelee = forceMelee;
    this.combo = combo;
    this.swing = def;
    this.phase = 'windup';
    this.phaseT = 0;
    this.swingDir = combo % 2 === 0 ? 1 : -1;
    this.attackAngle = this.aim;
    this.facing = facingFromVec(Math.cos(this.aim), Math.sin(this.aim), this.facing);
    const ranged = forceMelee ? undefined : this.profile.ranged;
    w.fx({ t: 'sfx', id: ranged ? (ranged === 'arrow' ? 'bow' : 'cast') : 'swing' });
  }

  private startHeavy(w: World): void {
    const h = this.profile.heavy;
    if (this.profile.ranged === 'bolt') {
      if (!this.spendMana(HEAVY_MANA)) return this.setState('free');
    } else if (!this.spend(h.stamina * this.staminaMul())) return this.setState('free');
    this.setState('heavy');
    this.forceMelee = false;
    this.swing = h;
    this.phase = 'windup';
    this.phaseT = 0;
    this.swingDir = 1;
    this.attackAngle = this.aim;
    w.fx({ t: 'sfx', id: 'heavy' });
  }

  private staminaMul(): number {
    return this.tal('sw_stamina') ? 0.85 : 1;
  }

  private atkSpeed(): number {
    return this.stats.atkSpeed;
  }

  private updateSwing(w: World, inp: InputFrame, dt: number): void {
    const sw = this.swing!;
    const heavy = this.state === 'heavy';
    this.phaseT += dt * this.atkSpeed();
    const a = this.attackAngle;
    const fx = Math.cos(a), fy = Math.sin(a);
    const lunge = heavy && this.profile.heavy.kind === 'lunge';

    if (this.phase === 'windup') {
      this.swingP = 0;
      const stepT = sw.windup + sw.active;
      if (sw.step > 0) w.map.move(this, (fx * sw.step * dt) / stepT, (fy * sw.step * dt) / stepT);
      if (this.phaseT >= sw.windup) {
        this.phase = 'active';
        this.phaseT = 0;
        this.release(w, heavy);
      }
    } else if (this.phase === 'active') {
      this.swingP = Math.min(1, this.phaseT / Math.max(0.01, sw.active));
      if (lunge) {
        const sp = this.tal('sp_dragon') ? 340 : 260;
        w.map.move(this, fx * sp * dt, fy * sp * dt);
      }
      else if (sw.step > 0) w.map.move(this, (fx * sw.step * dt) / (sw.windup + sw.active), (fy * sw.step * dt) / (sw.windup + sw.active));
      if (this.phaseT >= sw.active) {
        this.phase = 'recover';
        this.phaseT = 0;
      }
    } else {
      this.swingP = 1;
      // отмена восстановления перекатом
      if (this.buffered(w, 'dodge')) return this.startDodge(w, inp);
      const p = this.profile;
      if (!heavy && this.phaseT > sw.recover * 0.25 && this.buffered(w, 'attack')) {
        this.updateAim(inp);
        const next = p.ranged ? 0 : (this.combo + 1) % p.combo.length;
        if (p.ranged || this.combo + 1 < p.combo.length) return this.startAttack(w, next);
        this.bufAttack = w.time; // после финального удара — начнём заново после паузы
      }
      if (this.phaseT >= sw.recover) {
        if (!heavy && inp.down.has('attack') && this.holdT > 0.2) {
          this.setState('charge');
          this.chargeT = 0;
        } else this.setState('free');
      }
    }
  }

  private baseSpec(mult: number, knock: number, heavy: boolean): HitSpec {
    const st = this.stats;
    let dmg = Math.max(1, st.atk) * mult * (1 + st.dmgPct / 100);
    if (this.tal('sw_oath') && this.hp < this.maxHp * 0.3) dmg *= 1.3;
    let crit = st.crit;
    if (this.counterCrit) {
      crit = 1;
      this.counterCrit = false;
    }
    return {
      dmg, element: this.element, fire: st.fire, ice: st.ice, shock: st.shock, holy: st.holy,
      crit, critMul: st.critMul, knock: knock * st.knockback, heavy, lifesteal: st.lifesteal,
      source: this, cls: this.weaponCls ?? undefined, status: this.talentStatus(),
    };
  }

  /** Статус, который накладывают удары благодаря талантам. */
  private talentStatus(): HitSpec['status'] {
    if (this.tal('sw_bleed')) return { id: 'bleed', chance: 0.25, duration: 3, power: Math.max(1, this.stats.atk / 8) };
    if (this.tal('bw_poison')) return { id: 'poison', chance: 0.25, duration: 4, power: Math.max(1, this.stats.atk / 8) };
    if (this.tal('sp_sweep') || this.tal('st_ice')) return { id: 'slow', chance: 0.3, duration: 2 };
    return undefined;
  }

  /** Парирование удалось: талант «Ответный удар» заряжает крит. */
  onParried(): void {
    if (this.tal('sh_counter')) this.counterCrit = true;
  }

  /** Момент удара: создаём хитбокс/снаряд. */
  private release(w: World, heavy: boolean): void {
    const sw = this.swing!;
    const a = this.attackAngle;
    const fx = Math.cos(a), fy = Math.sin(a);
    const p = this.forceMelee ? WEAPON_PROFILES.fist : this.profile;
    const spec = this.baseSpec(sw.mult, sw.knock, heavy);
    const ox = fx * 4, oy = fy * 4 - 5;
    if (p.ranged) {
      const kind = heavy ? p.heavy.kind : p.ranged;
      if (p.ranged === 'arrow') {
        const pr = new Projectile(this.x + ox, this.y + oy, a, (p.projSpeed ?? 250) * (heavy ? 1.4 : 1), 'player', spec, 'arrow', { pierce: heavy ? 3 : this.tal('bw_pierce') ? 1 : 0, life: 1.4 });
        w.add(pr);
      } else {
        const col = ELEMENT_COLORS[this.element];
        const orb = kind === 'orb';
        const meteor = orb && this.tal('st_meteor');
        const pr = new Projectile(this.x + ox, this.y + oy, a, (p.projSpeed ?? 200) * (orb ? 0.75 : 1), 'player', spec, orb ? 'orb' : 'bolt', {
          color: col, radius: orb ? 5 : 3, life: 1.3, explode: orb ? { r: meteor ? 42 : 30, mult: meteor ? 1.3 : 1, color: col } : undefined,
        });
        w.add(pr);
        if (!orb && this.tal('st_echo') && w.rng.chance(0.2)) {
          w.add(new Projectile(this.x + ox, this.y + oy, a + w.rng.range(-0.12, 0.12), (p.projSpeed ?? 200) * 0.9, 'player', this.baseSpec(sw.mult, sw.knock, false), 'bolt', { color: col, radius: 3, life: 1.3 }));
        }
      }
      return;
    }
    const kind = heavy ? p.heavy.kind : 'arc';
    if (kind === 'slam') {
      w.spawnHitbox({ owner: this, team: 'player', shape: 'circle', x: this.x + fx * 10, y: this.y - 4 + fy * 10, r: sw.r, angle: a, half: Math.PI, follow: false, ox: 0, oy: 0, t: sw.active, delay: 0, breaks: true, spec: { ...spec, stunOnHit: 1 } });
      w.fx({ t: 'ring', x: this.x + fx * 10, y: this.y - 2 + fy * 10, r: sw.r, color: '#fff0c0', dur: 0.25 });
      w.fx({ t: 'debris', x: this.x + fx * 10, y: this.y + fy * 10, color: '#8a8070', n: 8 });
      w.shake(3, 0.2);
      return;
    }
    if (kind === 'lunge') {
      w.spawnHitbox({ owner: this, team: 'player', shape: 'arc', x: this.x, y: this.y - 4, r: sw.r + 10, angle: a, half: sw.half, follow: true, ox: 0, oy: -4, t: sw.active, delay: 0, breaks: true, spec });
      w.fx({ t: 'slash', x: this.x, y: this.y - 4, angle: a, r: 30, half: 0.35, color: p.color, heavy: true, dur: sw.active });
      return;
    }
    w.spawnHitbox({ owner: this, team: 'player', shape: 'arc', x: this.x, y: this.y - 4, r: sw.r, angle: a, half: sw.half, follow: true, ox: 0, oy: -4, t: sw.active, delay: 0, breaks: true, spec });
    w.fx({ t: 'slash', x: this.x, y: this.y - 4, angle: a, r: sw.r, half: sw.half, color: p.color, heavy, dur: sw.active + 0.05 });
    if (heavy && this.tal('sw_wave')) {
      w.add(new Projectile(this.x + fx * 10, this.y - 5 + fy * 10, a, 230, 'player', this.baseSpec(sw.mult * 0.6, 120, false), 'wave', { pierce: 4, life: 0.6, radius: 6, color: '#d0e0ff' }));
    }
  }

  // ───── Перекат ─────

  private startDodge(w: World, inp: InputFrame): void {
    if (!this.spend(DODGE_COST)) {
      if (this.state !== 'free' && this.state !== 'block') this.setState('free');
      return;
    }
    let dx = inp.mx, dy = inp.my;
    if (dx === 0 && dy === 0) {
      dx = Math.cos(this.aim);
      dy = Math.sin(this.aim);
    }
    const l = Math.hypot(dx, dy) || 1;
    this.dodgeX = dx / l;
    this.dodgeY = dy / l;
    this.setState('dodge');
    this.invuln = Math.max(this.invuln, DODGE_IFRAMES);
    this.facing = facingFromVec(this.dodgeX, this.dodgeY, this.facing);
    w.fx({ t: 'sfx', id: 'dodge' });
    w.fx({ t: 'dust', x: this.x, y: this.y, n: 4 });
  }

  private updateDodge(w: World, dt: number): void {
    const t = this.st;
    if (t < DODGE_TIME) {
      const k = 1 - (t / DODGE_TIME) * 0.5;
      w.map.move(this, this.dodgeX * DODGE_SPEED * k * dt, this.dodgeY * DODGE_SPEED * k * dt);
    } else if (t > DODGE_TIME + 0.06) this.setState('free');
  }

  // ───── Навык (Q) ─────

  private startSkill(w: World): void {
    const sk = this.profile.skill;
    if (!this.weaponCls || this.skillCd > 0) return;
    if (sk.mana > 0 ? !this.spendMana(sk.mana) : !this.spend(sk.stamina)) return;
    this.skillCd = sk.cd;
    this.setState('skill');
    this.skillHits = 0;
    this.attackAngle = this.aim;
    w.fx({ t: 'sfx', id: 'skill' });
  }

  private updateSkill(w: World, dt: number): void {
    const id = this.profile.skill.id;
    const a = this.attackAngle;
    const t = this.st;
    const fx = Math.cos(a), fy = Math.sin(a);
    const done = () => this.setState('free');
    switch (id) {
      case 'whirl': {
        // два оборота, по хитбоксу на каждый
        if (this.skillHits < 2 && t >= 0.08 + this.skillHits * 0.2) {
          this.skillHits++;
          w.spawnHitbox({ owner: this, team: 'player', shape: 'circle', x: this.x, y: this.y - 4, r: 30, angle: 0, half: Math.PI, follow: true, ox: 0, oy: -4, t: 0.12, delay: 0, breaks: true, spec: this.baseSpec(this.tal('sw_whirl2') ? 2.25 : 1.5, 150, true) });
          w.fx({ t: 'slash', x: this.x, y: this.y - 4, angle: a + this.skillHits * Math.PI, r: 30, half: Math.PI, color: '#f0f0ff', heavy: true, dur: 0.2 });
          w.fx({ t: 'sfx', id: 'swing' });
        }
        this.swingP = (t / 0.5) % 1;
        if (t > 0.55) done();
        break;
      }
      case 'throw':
        if (this.skillHits === 0 && t >= 0.1) {
          this.skillHits = 1;
          w.add(new Projectile(this.x + fx * 6, this.y - 5 + fy * 6, a, 300, 'player', this.baseSpec(this.tal('sp_throw2') ? 2.5 : 1.8, 160, true), 'spear', { pierce: 5, life: 0.7 }));
        }
        if (t > 0.35) done();
        break;
      case 'triple':
        if (this.skillHits === 0 && t >= 0.1) {
          this.skillHits = 1;
          for (const off of this.tal('bw_rain') ? [-0.4, -0.2, 0, 0.2, 0.4] : [-0.22, 0, 0.22])
            w.add(new Projectile(this.x + fx * 4, this.y - 5 + fy * 4, a + off, 280, 'player', this.baseSpec(1, 70, false), 'arrow', { life: 1.2 }));
        }
        if (t > 0.35) done();
        break;
      case 'burst':
        if (this.skillHits === 0 && t >= 0.15) {
          this.skillHits = 1;
          const col = ELEMENT_COLORS[this.element];
          w.spawnHitbox({ owner: this, team: 'player', shape: 'circle', x: this.x, y: this.y - 4, r: 50, angle: 0, half: Math.PI, follow: false, ox: 0, oy: 0, t: 0.12, delay: 0, breaks: true, spec: { ...this.baseSpec(1.8, 200, true), stunOnHit: this.tal('st_zero') ? 1.2 : undefined } });
          w.fx({ t: 'ring', x: this.x, y: this.y - 4, r: 50, color: col, dur: 0.35 });
          w.shake(3, 0.2);
        }
        if (t > 0.45) done();
        break;
      case 'bash':
        if (t < 0.2) {
          w.map.move(this, fx * 220 * dt, fy * 220 * dt);
          if (this.skillHits === 0) {
            this.skillHits = 1;
            w.spawnHitbox({ owner: this, team: 'player', shape: 'arc', x: this.x, y: this.y - 4, r: 20, angle: a, half: 1.2, follow: true, ox: 0, oy: -4, t: 0.2, delay: 0, breaks: true, spec: { ...this.baseSpec(1.1, 200, true), stunOnHit: this.tal('sh_ram') ? 2.5 : 1.5 } });
          }
        }
        if (t > 0.4) done();
        break;
      default:
        done();
    }
  }

  // ───── Ресурсы ─────

  private regen(dt: number): void {
    if (this.staminaDelay > 0) this.staminaDelay -= dt;
    else if (this.stamina < this.maxStamina) {
      const k = this.state === 'block' ? 0.35 : this.state === 'charge' ? 0.2 : 1;
      this.stamina = Math.min(this.maxStamina, this.stamina + this.stats.staminaRegen * k * dt);
    }
    this.mana = Math.min(this.maxMana, this.mana + (this.tal('st_mana') ? 3.5 : 2) * dt);
    if (this.stats.regen > 0 && !this.dead) this.hp = Math.min(this.maxHp, this.hp + this.stats.regen * dt);
  }

  onHurt(_w: World): void {
    this.invuln = Math.max(this.invuln, 0.7);
  }

  override die(w: World): void {
    if (this.dead) return;
    this.dead = true;
    this.hp = 0;
    this.state = 'dead';
    this.deathT = 0;
    this.blocking = false;
    w.fx({ t: 'sfx', id: 'death' });
    w.fx({ t: 'flash', color: '#600000', dur: 0.6 });
    w.shake(5, 0.4);
    this.game.onPlayerDeath();
  }
}

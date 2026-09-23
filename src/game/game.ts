import { EventBus } from '../core/events';
import { Rng } from '../core/rng';
import { CLASS_NAMES, itemDef } from '../data/items';
import { setLang, t } from '../data/loc';
import { SHOPS } from '../data/shops';
import { tr } from '../data/strings';
import { isElevatorFloor, MAX_STORY_FLOOR } from '../data/tiers';
import '../data/dialogue';
import { buildDungeon } from './dungeon/dungeonWorld';
import type { Actor } from './entities/entity';
import { Npc } from './entities/npc';
import { Pickup } from './entities/pickup';
import { Player } from './entities/player';
import type { GameEvents } from './events';
import type { InputFrame } from './input';
import { DAY_END, DAY_START, hearts, newGameState, npcState, QUICK_SLOTS, type GameState, type SceneRef } from './state';
import { advanceDay, REAL_SECONDS_PER_MINUTE, seasonName } from './systems/calendar';
import { DialogueRunner, pickLine, type DialogueHost } from './systems/dialogue';
import { buyPrice, dailyEconomy, recordSale, sellPrice, shopStock } from './systems/economy';
import { addToContainer, capacityFor, makeStack, sortContainer } from './systems/inventory';
import { itemName, makeItem } from './systems/loot';
import { classLevel, computeStats, xpToNext, type Buff } from './systems/stats';
import { bedSpawn, buildInterior, infirmarySpawn, interiorEntry } from './town/interiors';
import { buildTown, doorSpawn } from './town/town';
import type { EquipSlot, ItemStack, Stats, WeaponClass } from './types';
import type { GameApi, SpawnSpec, World } from './world';

export type Mode = 'play' | 'dialogue' | 'shop' | 'elevator' | 'lore' | 'dead';

interface Transition {
  t: number;
  dur: number;
  ref: SceneRef;
  spawn?: SpawnSpec;
  swapped: boolean;
  after?: () => void;
}

const FACING_AIM = [Math.PI / 2, Math.PI, 0, -Math.PI / 2];

export class Game implements GameApi, DialogueHost {
  state: GameState;
  world!: World;
  player!: Player;
  readonly events = new EventBus<GameEvents>();
  buffs: Buff[] = [];
  mode: Mode = 'play';
  /** Пауза из интерфейса (меню, инвентарь). */
  paused = false;
  dialogue: DialogueRunner | null = null;
  shopId: string | null = null;
  elevatorStops: number[] | null = null;
  loreOpen: string | null = null;
  transition: Transition | null = null;
  scene: SceneRef = { kind: 'town' };
  boss: Actor | null = null;
  private runLoot = new Set<string>();
  private cachedStats: Stats | null = null;
  private deathTimer = -1;
  private talkingNpc: Npc | null = null;
  readonly rng = new Rng((Date.now() ^ 0x2545f491) >>> 0);

  constructor(state: GameState) {
    this.state = state;
    setLang(state.settings.lang);
    const loc = state.location;
    const ref: SceneRef = loc.scene.kind === 'dungeon' ? { kind: 'town' } : loc.scene;
    const spawn = loc.scene.kind === 'dungeon' ? doorSpawn('crypt') : loc.x >= 0 ? { x: loc.x, y: loc.y } : ref.kind === 'interior' && ref.id === 'manor' ? bedSpawn() : undefined;
    this.swapWorld(ref, spawn);
  }

  static newGame(name: string, seed = (Math.random() * 0xffffffff) >>> 0): Game {
    const s = newGameState(name, seed);
    const g0 = new Rng(seed);
    const give = (def: string, qty = 1) => addToContainer(s.inventory, makeItem(g0, def, 0, qty));
    s.equipment.weapon = makeItem(g0, 'rusty_sword');
    s.equipment.body = makeItem(g0, 'leather_body');
    give('potion_small', 3);
    give('bread', 3);
    s.hero.hp = Math.round(computeStats(s).maxHp);
    return new Game(s);
  }

  // ───────────────────────── Основной цикл ─────────────────────────

  get busy(): boolean {
    return this.paused || this.mode !== 'play' || !!this.transition;
  }

  update(dt: number, input: InputFrame): void {
    if (this.transition) return this.updateTransition(dt);
    this.state.playtime += dt;
    if (this.mode === 'dead') {
      this.world.input = null;
      this.world.step(dt);
      this.deathTimer -= dt;
      if (this.deathTimer <= 0 && this.deathTimer > -50) {
        this.deathTimer = -99;
        this.respawnAfterDeath();
      }
      return;
    }
    if (this.busy) return;

    this.world.input = input;
    if (input.pressed.has('interact')) {
      const e = this.world.findInteractable();
      if (e?.interaction) e.interaction.act(this.world);
    }
    for (let i = 0; i < QUICK_SLOTS; i++) if (input.pressed.has(`quick${i + 1}` as 'quick1')) this.useQuick(i);
    if (input.pressed.has('swap')) this.swapWeapons();

    this.world.step(dt);
    this.tickTime(dt);
    this.tickBuffs(dt);
    this.syncHero();
  }

  private tickTime(dt: number): void {
    if (this.world.kind === 'interior' && this.world.hitstopT > 0) return;
    const tm = this.state.time;
    tm.minutes += dt / REAL_SECONDS_PER_MINUTE;
    if (tm.minutes >= DAY_END) this.passOut();
  }

  private tickBuffs(dt: number): void {
    if (!this.buffs.length) return;
    let changed = false;
    for (const b of this.buffs) {
      b.t -= dt;
      if (b.t <= 0) changed = true;
    }
    if (changed) {
      this.buffs = this.buffs.filter((b) => b.t > 0);
      this.refreshStats();
    }
  }

  private syncHero(): void {
    const p = this.player, h = this.state.hero;
    if (!p) return;
    h.hp = Math.max(0, Math.round(p.hp));
    h.stamina = p.stamina;
    h.mana = p.mana;
  }

  // ───────────────────────── Сцены ─────────────────────────

  goTo(ref: SceneRef, spawn?: SpawnSpec, after?: () => void): void {
    if (this.transition) return;
    this.transition = { t: 0, dur: 0.55, ref, spawn, swapped: false, after };
    // закрыть всё, что было открыто в старой сцене
    if (this.dialogue) {
      this.dialogue = null;
      if (this.talkingNpc) this.talkingNpc.talking = false;
      this.talkingNpc = null;
      this.events.emit('dialogue', undefined);
    }
    if (this.shopId) this.closeShop();
    if (this.loreOpen) this.closeLore();
    if (this.elevatorStops) {
      this.elevatorStops = null;
      this.events.emit('elevator', null);
    }
    this.mode = 'play';
  }

  /** 0..1 — затемнение экрана при переходе. */
  get fade(): number {
    const tr2 = this.transition;
    if (!tr2) return 0;
    const half = tr2.dur / 2;
    return tr2.t < half ? tr2.t / half : Math.max(0, 1 - (tr2.t - half) / half);
  }

  private updateTransition(dt: number): void {
    const tr2 = this.transition!;
    tr2.t += dt;
    if (!tr2.swapped && tr2.t >= tr2.dur / 2) {
      tr2.swapped = true;
      this.swapWorld(tr2.ref, tr2.spawn);
      tr2.after?.();
    }
    if (tr2.t >= tr2.dur) this.transition = null;
  }

  private swapWorld(ref: SceneRef, spawn?: SpawnSpec): void {
    this.syncHero();
    const prevKind = this.scene.kind;
    let world: World;
    let sp: SpawnSpec | undefined = spawn;
    if (ref.kind === 'town') {
      world = buildTown(this);
      sp ??= doorSpawn('manor');
    } else if (ref.kind === 'interior') {
      world = buildInterior(this, ref.id);
      sp ??= interiorEntry(ref.id);
    } else {
      const d = buildDungeon(this, ref.floor);
      world = d.world;
      sp ??= d.spawn;
      if (prevKind !== 'dungeon') this.runLoot.clear();
      this.onEnterFloor(ref.floor);
    }
    const p = new Player(this);
    p.x = sp.x;
    p.y = sp.y;
    p.facing = sp.facing ?? 0;
    p.aim = FACING_AIM[p.facing]!;
    world.player = p;
    world.addNow(p);
    this.world = world;
    this.player = p;
    this.scene = ref;
    this.boss = null;
    this.events.emit('boss', { actor: null });
    if (ref.kind !== 'dungeon') this.state.location = { scene: ref, x: sp.x, y: sp.y };
    else this.state.location = { scene: { kind: 'town' }, ...doorSpawn('crypt') };
    this.events.emit('scene', { kind: ref.kind });
  }

  private onEnterFloor(floor: number): void {
    const d = this.state.dungeon;
    if (floor > d.deepest) d.deepest = floor;
    if (isElevatorFloor(floor) && !d.elevator.includes(floor)) {
      d.elevator.push(floor);
      d.elevator.sort((a, b) => a - b);
      this.toast(tr('elevatorUnlocked', { n: floor }), '#ffd040');
    }
  }

  descend(): void {
    if (this.scene.kind !== 'dungeon') return;
    const next = Math.min(this.scene.floor + 1, MAX_STORY_FLOOR + 30);
    this.useEnergy(1, true);
    this.world.fx({ t: 'sfx', id: 'stairs' });
    this.goTo({ kind: 'dungeon', floor: next });
  }

  ascendToTown(): void {
    this.world.fx({ t: 'sfx', id: 'stairs' });
    this.goTo({ kind: 'town' }, doorSpawn('crypt'));
  }

  openElevator(): void {
    const stops = this.state.dungeon.elevator;
    if (this.scene.kind === 'town' && stops.length === 0) {
      this.world.fx({ t: 'sfx', id: 'door' });
      this.goTo({ kind: 'dungeon', floor: 1 });
      return;
    }
    this.elevatorStops = this.scene.kind === 'town' ? [1, ...stops] : [0, ...stops];
    this.mode = 'elevator';
    this.events.emit('elevator', { stops: this.elevatorStops });
  }

  chooseElevator(floor: number | null): void {
    this.mode = 'play';
    this.elevatorStops = null;
    this.events.emit('elevator', null);
    if (floor === null) return;
    this.world.fx({ t: 'sfx', id: 'lift' });
    if (floor === 0) this.goTo({ kind: 'town' }, doorSpawn('crypt'));
    else this.goTo({ kind: 'dungeon', floor });
  }

  // ───────────────────────── Сервисы для мира ─────────────────────────

  stats(): Stats {
    return (this.cachedStats ??= computeStats(this.state, this.buffs));
  }

  refreshStats(): void {
    this.cachedStats = null;
    this.player?.refresh();
    this.events.emit('inventory', undefined);
  }

  toast(text: string, color?: string): void {
    this.events.emit('toast', { text, color });
  }

  markRunLoot(uid: string): void {
    this.runLoot.add(uid);
  }

  giveItem(stack: ItemStack): boolean {
    const d = itemDef(stack.def);
    const name = itemName(stack);
    const qty0 = stack.qty;
    const added = addToContainer(this.state.inventory, stack);
    if (added > 0) {
      if (this.scene.kind === 'dungeon') {
        for (const s of this.state.inventory) if (s && s.def === stack.def) this.runLoot.add(s.uid);
      }
      this.toast(`${name}${added > 1 ? ` ×${added}` : ''}`, stack.rarity > 0 ? ['#fff', '#5aa6ff', '#c07bff', '#ff9a2e'][stack.rarity] : undefined);
      if ((d.kind === 'consumable' || d.kind === 'food') && !this.state.quick.includes(d.id)) {
        const free = this.state.quick.indexOf(null);
        if (free >= 0) this.state.quick[free] = d.id;
      }
      if (d.tags?.includes('shard')) this.toast(tr('shardFound'), '#ffd0a0');
      this.events.emit('inventory', undefined);
    }
    if (added < qty0 && stack.qty > 0) this.toast(tr('inventoryFull'), '#ff8080');
    return stack.qty <= 0;
  }

  give(def: string, qty = 1): void {
    const s = makeStack(def, qty);
    if (!this.giveItem(s) && s.qty > 0 && this.world) this.world.add(new Pickup(this.player.x, this.player.y, this.world.rng, s, 0));
  }

  giveGold(n: number): void {
    this.state.hero.gold += n;
    this.events.emit('inventory', undefined);
  }

  addXp(n: number): void {
    const h = this.state.hero;
    h.xp += n;
    let leveled = false;
    while (h.xp >= xpToNext(h.level)) {
      h.xp -= xpToNext(h.level);
      h.level++;
      leveled = true;
      this.toast(tr('levelUp', { n: h.level }), '#ffd040');
      this.events.emit('levelUp', { level: h.level });
    }
    if (leveled) {
      this.refreshStats();
      if (this.player) {
        this.player.hp = this.player.maxHp;
        this.world.fx({ t: 'sparkle', x: this.player.x, y: this.player.y - 10, color: '#ffd040', n: 20 });
        this.world.fx({ t: 'sfx', id: 'levelup' });
      }
    }
  }

  addClassXp(cls: WeaponClass, n: number): void {
    const cx = this.state.hero.classXp;
    const before = classLevel(cx[cls]);
    cx[cls] += n;
    const after = classLevel(cx[cls]);
    if (after > before) {
      this.toast(tr('classUp', { cls: t(CLASS_NAMES[cls]), n: after }), '#a0e0ff');
      this.refreshStats();
    }
  }

  useEnergy(n: number, force = false): boolean {
    const h = this.state.hero;
    if (h.energy <= 0 && !force) return false;
    h.energy = Math.max(0, h.energy - n);
    return true;
  }

  setBoss(e: Actor | null): void {
    this.boss = e;
    this.events.emit('boss', { actor: e });
  }

  bossDefeated(floor: number): void {
    const d = this.state.dungeon;
    if (!d.bosses.includes(floor)) d.bosses.push(floor);
    // открыть лестницу вниз на арене
    const w = this.world;
    const rooms = w.meta.rooms as { role: string; x: number; y: number; w: number; h: number }[] | undefined;
    const arena = rooms?.find((r) => r.role === 'boss');
    if (arena) w.map.set(arena.x + Math.floor(arena.w / 2), arena.y + Math.floor(arena.h / 2) - 1, 12 /* STAIRS_DOWN */);
    this.state.flags[`boss_${floor}`] = true;
  }

  // ───────────────────────── Смерть, сон, новый день ─────────────────────────

  onPlayerDeath(): void {
    this.mode = 'dead';
    this.deathTimer = 2.2;
  }

  private respawnAfterDeath(): void {
    const h = this.state.hero;
    const goldLoss = Math.min(1000, Math.floor(h.gold * 0.1));
    h.gold -= goldLoss;
    // до 4 стопок из добычи этого спуска
    const candidates: number[] = [];
    this.state.inventory.forEach((s, i) => s && this.runLoot.has(s.uid) && itemDef(s.def).kind !== 'quest' && candidates.push(i));
    this.rng.shuffle(candidates);
    const lost = candidates.slice(0, Math.min(4, candidates.length));
    for (const i of lost) this.state.inventory[i] = null;
    this.state.stats.deaths = (this.state.stats.deaths ?? 0) + 1;
    this.state.flags.woke_infirmary = true;
    this.newDay(false);
    this.state.time.minutes = 8 * 60;
    h.hp = Math.round(this.stats().maxHp * 0.6);
    h.stamina = this.stats().maxStamina;
    this.mode = 'play';
    this.goTo({ kind: 'interior', id: 'church' }, infirmarySpawn(), () => {
      this.events.emit('death', { gold: goldLoss, items: lost.length, exhausted: false });
    });
  }

  private passOut(): void {
    const h = this.state.hero;
    const loss = Math.min(500, Math.floor(h.gold * 0.05));
    h.gold -= loss;
    this.state.time.minutes = DAY_END;
    this.newDay(true);
    this.goTo({ kind: 'interior', id: 'manor' }, bedSpawn(), () => {
      this.events.emit('death', { gold: loss, items: 0, exhausted: true });
    });
  }

  sleep(): void {
    const late = this.state.time.minutes >= 24 * 60;
    this.newDay(late);
    this.player.hp = this.player.maxHp;
    this.goTo({ kind: 'interior', id: 'manor' }, bedSpawn());
  }

  /** Начать новый день: календарь, восстановление, автосохранение. */
  private newDay(tired: boolean): void {
    advanceDay(this.state);
    dailyEconomy(this.state);
    const h = this.state.hero;
    h.energy = Math.round(h.maxEnergy * (tired ? 0.75 : 1));
    h.hp = this.stats().maxHp;
    h.stamina = this.stats().maxStamina;
    h.mana = this.stats().maxMana;
    this.buffs = [];
    this.cachedStats = null;
    const tm = this.state.time;
    this.events.emit('dayStart', { text: tr('newDay', { season: seasonName(tm.season), day: tm.day }) });
    this.state.location = { scene: { kind: 'interior', id: 'manor' }, ...bedSpawn() };
    this.events.emit('autosave', undefined);
  }

  // ───────────────────────── Диалоги ─────────────────────────

  talk(npcId: string): void {
    const line = pickLine(this, npcId);
    this.dialogue = new DialogueRunner(this, npcId, line);
    this.mode = 'dialogue';
    const ns = npcState(this.state, npcId);
    if (!ns.talkedToday) {
      ns.talkedToday = true;
      ns.points += 20;
    }
    this.talkingNpc = (this.world.entities.find((e) => e instanceof Npc && e.def.id === npcId) as Npc) ?? null;
    if (this.talkingNpc) this.talkingNpc.talking = true;
    this.world.fx({ t: 'sfx', id: 'talk' });
    this.events.emit('dialogue', undefined);
  }

  dialogueAdvance(): void {
    if (!this.dialogue) return;
    if (!this.dialogue.advance()) this.endDialogue();
    else this.events.emit('dialogue', undefined);
  }

  dialogueChoose(i: number): void {
    if (!this.dialogue) return;
    if (!this.dialogue.choose(i)) this.endDialogue();
    else this.events.emit('dialogue', undefined);
  }

  private endDialogue(): void {
    this.dialogue = null;
    if (this.talkingNpc) this.talkingNpc.talking = false;
    this.talkingNpc = null;
    if (this.mode === 'dialogue') this.mode = this.shopId ? 'shop' : 'play';
    this.events.emit('dialogue', undefined);
    if (this.shopId) this.events.emit('shop', { id: this.shopId });
  }

  flag(id: string): boolean {
    return !!this.state.flags[id];
  }

  setFlag(id: string, v = true): void {
    if (v) this.state.flags[id] = true;
    else delete this.state.flags[id];
  }

  healFull(): void {
    this.player.hp = this.player.maxHp;
    this.player.stamina = this.player.maxStamina;
    this.player.statuses = [];
    this.world.fx({ t: 'sparkle', x: this.player.x, y: this.player.y - 10, color: '#a0ffa0', n: 14 });
    this.world.fx({ t: 'sfx', id: 'heal' });
  }

  friendship(npc: string, delta: number): void {
    npcState(this.state, npc).points = Math.max(0, npcState(this.state, npc).points + delta);
  }

  hearts(npc: string): number {
    return hearts(this.state, npc);
  }

  // ───────────────────────── Лор ─────────────────────────

  readLore(id: string): void {
    if (!this.state.lore.includes(id)) {
      this.state.lore.push(id);
      this.toast(tr('loreFound'), '#ffe0a0');
      this.world.fx({ t: 'sfx', id: 'lore' });
    }
    this.loreOpen = id;
    this.mode = 'lore';
    this.events.emit('lore', { id });
  }

  closeLore(): void {
    this.loreOpen = null;
    this.mode = 'play';
    this.events.emit('lore', null);
  }

  // ───────────────────────── Магазины ─────────────────────────

  openShop(id: string): void {
    this.shopId = id;
    if (this.mode !== 'dialogue') {
      this.mode = 'shop';
      this.events.emit('shop', { id });
    }
  }

  closeShop(): void {
    this.shopId = null;
    this.mode = 'play';
    this.events.emit('shop', null);
  }

  shopItems(): { def: string; price: number }[] {
    if (!this.shopId) return [];
    const shop = SHOPS[this.shopId]!;
    return shopStock(this.state, shop.id).map((def) => ({ def, price: buyPrice(this.state, def, shop) }));
  }

  sellQuote(index: number): number | null {
    const s = this.state.inventory[index];
    if (!s || !this.shopId) return null;
    const shop = SHOPS[this.shopId]!;
    const d = itemDef(s.def);
    if (d.kind === 'quest' || !shop.buys(d)) return null;
    return sellPrice(this.state, s, shop);
  }

  buy(def: string): boolean {
    if (!this.shopId) return false;
    const shop = SHOPS[this.shopId]!;
    const price = buyPrice(this.state, def, shop);
    const h = this.state.hero;
    if (h.gold < price) {
      this.toast(tr('notEnoughGold'), '#ff8080');
      return false;
    }
    if (capacityFor(this.state.inventory, def) < 1) {
      this.toast(tr('inventoryFull'), '#ff8080');
      return false;
    }
    h.gold -= price;
    this.giveItem(makeItem(this.rng, def, 0, 1));
    this.world.fx({ t: 'sfx', id: 'coin' });
    return true;
  }

  sell(index: number, qty = 1): boolean {
    const s = this.state.inventory[index];
    const unit = this.sellQuote(index);
    if (!s || unit === null) return false;
    const n = Math.min(qty, s.qty);
    let total = 0;
    for (let i = 0; i < n; i++) {
      total += this.sellQuote(index) ?? unit;
      recordSale(this.state, s.def, 1);
    }
    s.qty -= n;
    if (s.qty <= 0) this.state.inventory[index] = null;
    this.state.hero.gold += total;
    this.state.stats.goldEarned = (this.state.stats.goldEarned ?? 0) + total;
    this.world.fx({ t: 'sfx', id: 'coin' });
    this.events.emit('inventory', undefined);
    return true;
  }

  // ───────────────────────── Инвентарь ─────────────────────────

  equip(index: number): void {
    const inv = this.state.inventory;
    const s = inv[index];
    if (!s) return;
    const d = itemDef(s.def);
    let slot: EquipSlot | null = null;
    if (d.kind === 'weapon') slot = 'weapon';
    else if (d.armor) slot = d.armor.slot;
    else if (d.accessory) {
      if (d.accessory.slot === 'amulet') slot = 'amulet';
      else slot = !this.state.equipment.ring1 ? 'ring1' : !this.state.equipment.ring2 ? 'ring2' : 'ring1';
    }
    if (!slot) return this.useItem(index);
    const prev = this.state.equipment[slot];
    this.state.equipment[slot] = s;
    inv[index] = prev;
    this.world.fx({ t: 'sfx', id: 'equip' });
    this.refreshStats();
  }

  unequip(slot: EquipSlot): void {
    const s = this.state.equipment[slot];
    if (!s) return;
    const i = this.state.inventory.indexOf(null);
    if (i < 0) return this.toast(tr('inventoryFull'), '#ff8080');
    this.state.inventory[i] = s;
    this.state.equipment[slot] = null;
    this.refreshStats();
  }

  swapWeapons(): void {
    const e = this.state.equipment;
    [e.weapon, e.weapon2] = [e.weapon2, e.weapon];
    this.world.fx({ t: 'sfx', id: 'equip' });
    this.refreshStats();
  }

  useItem(index: number): void {
    const inv = this.state.inventory;
    const s = inv[index];
    if (!s) return;
    const d = itemDef(s.def);
    if (d.kind === 'weapon' || d.kind === 'armor' || d.kind === 'accessory') return this.equip(index);
    const u = d.use;
    if (!u) return;
    const p = this.player;
    if (u.heal) p.hp = Math.min(p.maxHp, p.hp + u.heal);
    if (u.stamina) p.stamina = Math.min(p.maxStamina, p.stamina + u.stamina);
    if (u.mana) p.mana = Math.min(p.maxMana, p.mana + u.mana);
    if (u.energy) this.state.hero.energy = Math.min(this.state.hero.maxEnergy, this.state.hero.energy + u.energy);
    if (u.cure) p.statuses = [];
    if (u.buff) {
      this.buffs = this.buffs.filter((b) => b.stat !== u.buff!.stat);
      this.buffs.push({ stat: u.buff.stat, value: u.buff.value, t: u.buff.seconds });
      this.refreshStats();
    }
    s.qty--;
    if (s.qty <= 0) inv[index] = null;
    this.world.fx({ t: 'sfx', id: d.kind === 'food' ? 'eat' : 'drink' });
    if (u.heal) this.world.fx({ t: 'dmg', x: p.x, y: p.y - 18, n: u.heal, color: '#70ff70' });
    this.world.fx({ t: 'sparkle', x: p.x, y: p.y - 8, color: d.icon.c1, n: 6 });
    this.events.emit('inventory', undefined);
  }

  useQuick(i: number): void {
    const def = this.state.quick[i];
    if (!def) return;
    const idx = this.state.inventory.findIndex((s) => s?.def === def);
    if (idx >= 0) this.useItem(idx);
  }

  moveItem(from: number, to: number): void {
    const inv = this.state.inventory;
    if (from === to) return;
    const a = inv[from], b = inv[to];
    if (a && b && a.def === b.def && a.affixes.length === 0 && b.affixes.length === 0) {
      const max = itemDef(a.def).stack;
      const n = Math.min(max - b.qty, a.qty);
      b.qty += n;
      a.qty -= n;
      if (a.qty <= 0) inv[from] = null;
    } else {
      inv[from] = b;
      inv[to] = a;
    }
    this.events.emit('inventory', undefined);
  }

  dropItem(index: number): void {
    const s = this.state.inventory[index];
    if (!s || itemDef(s.def).kind === 'quest') return;
    this.state.inventory[index] = null;
    const pk = new Pickup(this.player.x, this.player.y - 4, this.world.rng, s, 0);
    pk.failedAt = this.world.time + 1;
    this.world.add(pk);
    this.events.emit('inventory', undefined);
  }

  sortInventory(): void {
    sortContainer(this.state.inventory);
    this.events.emit('inventory', undefined);
  }

  setQuick(slot: number, def: string | null): void {
    this.state.quick[slot] = def;
    this.events.emit('inventory', undefined);
  }

  // ───────────────────────── Сохранение ─────────────────────────

  /** Состояние, готовое к записи. */
  snapshot(): GameState {
    this.syncHero();
    if (this.scene.kind !== 'dungeon' && this.player) this.state.location = { scene: this.scene, x: this.player.x, y: this.player.y };
    return this.state;
  }

  seasonLabel(): string {
    return seasonName(this.state.time.season);
  }

  timeOfDayOk(): boolean {
    return this.state.time.minutes >= DAY_START;
  }
}

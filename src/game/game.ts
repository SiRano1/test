import { EventBus } from '../core/events';
import { Rng } from '../core/rng';
import { CLASS_NAMES, itemDef } from '../data/items';
import { setLang, t, type Loc } from '../data/loc';
import { SHOPS } from '../data/shops';
import { tr } from '../data/strings';
import { isElevatorFloor, MAX_STORY_FLOOR } from '../data/tiers';
import '../data/dialogue';
import '../data/dialogue2';
import '../data/dialogue3';
import '../data/dialogue4';
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
import { learnTalent, resetTalents, talentPoints } from './systems/talents';
import { Festivals } from './systems/festivals';
import { auctionNight, buyout, cancelLot, collectMail, ensureLots, listItem, placeBid } from './systems/auction';
import { isShopHours, marketValue } from './systems/playershop';
import { ShopFloor } from './entities/customer';
import { festivalToday } from '../data/festivals';
import { bedSpawn, buildInterior, infirmarySpawn, interiorEntry } from './town/interiors';
import { buildTown, doorSpawn } from './town/town';
import type { EquipSlot, ItemStack, Stats, WeaponClass } from './types';
import type { GameApi, SpawnSpec, World } from './world';
import { CROPS, ITEMS } from '../data/items';
import { UPGRADE_BY_ID } from '../data/manor';
import { npcDef, type FactionId } from '../data/npcs';
import { QUEST_BY_ID, type QuestDef } from '../data/quests';
import { RECIPE_BY_ID, type Station } from '../data/recipes';
import { L } from '../data/loc';
import { NpcDirector } from './systems/npcs';
import { addAffix, enchantCost, forgeRarity, knownRecipes, missingFor, rerollAffixes, rerollCost, SHARPEN_CHANCE, sharpenCost } from './systems/crafting';
import { GIFT_POINTS, giftReaction, isBirthday, reactionLine } from './systems/relations';
import { growNight, initGarden, isRainy } from './systems/garden';
import { countItem, removeItem } from './systems/inventory';
import { rotatingPrice } from './systems/economy';
import { weekday } from './systems/calendar';
import { Companion } from './entities/companion';
import { Boss } from './entities/boss';
import { endingConditions, THRONE_PAGES, type EndingId } from '../data/endings';
import { FACTIONS, RIVALRY } from '../data/factions';

export type Mode = 'play' | 'dialogue' | 'shop' | 'elevator' | 'lore' | 'dead' | 'craft' | 'storage' | 'build' | 'service' | 'auction' | 'shopfront';
export type Service = 'sharpen' | 'enchant' | 'reroll';
export type ItemRef = { inv: number } | { equip: EquipSlot };

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
  readonly npcs: NpcDirector;
  readonly fest: Festivals;
  craftStation: Station | null = null;
  service: Service | null = null;
  private questT = 0;

  constructor(state: GameState) {
    this.state = state;
    this.fest = new Festivals(this);
    this.npcs = new NpcDirector(state, (id) => this.fest.placeFor(id));
    if (!state.economy.rotating.length) dailyEconomy(state);
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
    this.npcs.update(this.world, dt);
    this.fest.update(this.world, dt);
    this.tickTime(dt);
    this.tickBuffs(dt);
    this.syncHero();
    this.questT -= dt;
    if (this.questT <= 0) {
      this.questT = 1;
      this.checkQuests();
    }
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
    this.fest.onSceneChange();
    this.shopOpen = false;
    const prevKind = this.scene.kind;
    let world: World;
    let sp: SpawnSpec | undefined = spawn;
    if (ref.kind === 'town') {
      world = buildTown(this);
      sp ??= doorSpawn('manor');
      this.npcs.populate(world);
    } else if (ref.kind === 'interior') {
      world = buildInterior(this, ref.id);
      sp ??= interiorEntry(ref.id);
      this.npcs.populate(world);
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
    if (ref.kind === 'dungeon') {
      const c = this.state.companion;
      if (c && c.day === this.state.time.totalDays && !c.down) this.spawnCompanion(world, c.npc, p.x + 14, p.y);
      if (ref.floor === 70 && this.state.flags.free_fight && !this.state.ending) this.spawnFreeFight(world);
    }
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
    const tier = Math.ceil(floor / 10);
    if (floor % 10 === 1 && !this.state.flags[`tier_seen_${tier}`]) {
      this.state.flags[`tier_seen_${tier}`] = true;
      setTimeout(() => this.events.emit('tierEnter', { tier }), 700);
    }
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
    if (this.scene.kind === 'town' && this.fest.dungeonLocked()) {
      this.toast(t(L('Сегодня праздник: Йорн откроет склеп только в 22:00', 'It is a festival: Yorn opens the crypt only at 22:00')), '#ffd080');
      return;
    }
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

  /** Изучить талант (очки дают уровни мастерства класса). */
  learnTalent(id: string): boolean {
    if (!learnTalent(this.state, id)) return false;
    this.world.fx({ t: 'sfx', id: 'levelup' });
    this.refreshStats();
    return true;
  }

  /** Цена сброса талантов класса. */
  talentResetCost(cls: WeaponClass): number {
    return 40 * talentPoints(this.state, cls).spent;
  }

  resetTalents(cls: WeaponClass): boolean {
    const cost = this.talentResetCost(cls);
    if (cost <= 0 || this.state.hero.gold < cost) return false;
    this.state.hero.gold -= cost;
    resetTalents(this.state, cls);
    this.refreshStats();
    return true;
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

  bossDefeated(floor: number, id?: string): void {
    if (id === 'hunger_avatar') {
      setTimeout(() => this.chooseEnding('free', true), 2500);
      return;
    }
    if (id === 'halvard') setTimeout(() => this.startEnding(), 2500);
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
    if (this.fest.onPlayerDown()) return;
    // компаньон с 8+ ♥ один раз за день поднимает героя
    const comp = this.world.entities.find((e): e is Companion => e instanceof Companion && !e.dead && e.canRevive);
    if (comp && this.state.companion && !this.state.companion.revived) {
      this.state.companion.revived = true;
      comp.canRevive = false;
      const p = this.player;
      setTimeout(() => {
        p.dead = false;
        p.state = 'free';
        p.hp = Math.round(p.maxHp * 0.4);
        p.invuln = 2;
        this.world.fx({ t: 'sparkle', x: p.x, y: p.y - 10, color: '#fff0a0', n: 24 });
        this.world.fx({ t: 'sfx', id: 'heal' });
        this.toast(tr('revived', { name: t(comp.def.name) }), '#fff0a0');
      }, 900);
      return;
    }
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
    const rained = isRainy(this.state.time.weather);
    this.state.companion = null;
    advanceDay(this.state);
    dailyEconomy(this.state);
    const night = auctionNight(this.state);
    if (night.sold.length || night.won.length || night.outbid || night.returned) {
      const gold = night.sold.reduce((n, x) => n + Math.round(x.price * 0.9), 0);
      const parts: string[] = [];
      if (night.sold.length) parts.push(t(L(`продано лотов: ${night.sold.length} (+${gold} з.)`, `lots sold: ${night.sold.length} (+${gold} g)`)));
      if (night.won.length) parts.push(t(L(`выиграно: ${night.won.length}`, `won: ${night.won.length}`)));
      if (night.outbid) parts.push(t(L(`ставку перебили: ${night.outbid}`, `outbid: ${night.outbid}`)));
      if (night.returned) parts.push(t(L(`не продано: ${night.returned}`, `unsold: ${night.returned}`)));
      setTimeout(() => this.toast(`${t(L('Аукцион', 'Auction'))}: ${parts.join(', ')}`, '#ffd040'), 3000);
    }
    const withered = growNight(this.state, rained, this.state.time.season);
    if (withered) this.toast(tr('withered', { n: withered }), '#c0a080');
    // романтика: свадьба и утренние хлопоты супруга
    const rom = this.state.romance;
    if (rom.stage === 'engaged' && this.state.time.totalDays >= rom.weddingDay && rom.partner) {
      rom.stage = 'married';
      this.friendship(rom.partner, 500);
      setTimeout(() => this.toast(tr('married', { name: t(npcDef(rom.partner!).name) }), '#ff8aa0'), 1600);
    } else if (rom.stage === 'married' && rom.partner) {
      const r = this.rng.next();
      if (r < 0.4) {
        const food = this.rng.pick(['bread', 'cheese', 'honey_bread', 'baked_potato', 'herb_stew']);
        addToContainer(this.state.storage, makeItem(this.rng, food, 0, 1));
        setTimeout(() => this.toast(tr('spouseBreakfast', { name: t(npcDef(rom.partner!).name) }), '#ffd0a0'), 1600);
      } else if (r < 0.75 && this.state.manor.garden.length) {
        for (const p of this.state.manor.garden) if (p.seed) p.watered = true;
        setTimeout(() => this.toast(tr('spouseWatered', { name: t(npcDef(rom.partner!).name) }), '#a0d0ff'), 1600);
      }
    }
    const b = this.state.manor.building;
    if (b) {
      b.daysLeft--;
      if (b.daysLeft <= 0) {
        this.state.manor.upgrades.push(b.id);
        this.state.manor.building = null;
        if (b.id === 'garden') initGarden(this.state);
        setTimeout(() => this.toast(tr('buildDone', { name: t(UPGRADE_BY_ID[b.id]!.name) }), '#ffd040'), 1500);
      }
    }
    const h = this.state.hero;
    h.energy = Math.round(h.maxEnergy * (tired ? 0.75 : 1));
    h.hp = this.stats().maxHp;
    h.stamina = this.stats().maxStamina;
    h.mana = this.stats().maxMana;
    this.buffs = [];
    this.cachedStats = null;
    const tm = this.state.time;
    this.events.emit('dayStart', { text: tr('newDay', { season: seasonName(tm.season), day: tm.day }) });
    const fest = festivalToday(this.state);
    if (fest) setTimeout(() => this.toast(`${t(L('Сегодня', 'Today'))}: ${t(fest.name)}! ${t(fest.desc)}`, '#ffd080'), 2200);
    this.state.location = { scene: { kind: 'interior', id: 'manor' }, ...bedSpawn() };
    this.events.emit('autosave', undefined);
  }

  // ───────────────────────── Диалоги ─────────────────────────

  /** Прилавок: торговать можно, только если хозяин на месте. */
  counter(npcId: string): void {
    if (this.npcs.isPresent(this.world, npcId)) this.talk(npcId);
    else this.toast(tr('nobodyHere'), '#c0a080');
  }

  talk(npcId: string): void {
    if (this.turnInItems(npcId)) return; // сдача задания открыла свой диалог
    const line = pickLine(this, npcId);
    this.completeTalkQuests(npcId);
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
    const d = this.dialogue;
    if (!d) return;
    // выбор мог открыть новый разговор (say) — тогда старый не закрываем поверх нового
    if (!d.choose(i) && this.dialogue === d) this.endDialogue();
    else this.events.emit('dialogue', undefined);
  }

  /** Короткая сцена: несколько реплик жителя без выбора. */
  say(npc: string, pages: Loc[], onEnd?: () => void): void {
    this.dialogue = new DialogueRunner(this, npc, { id: 'say', npc, priority: 0, pages, onEnd: onEnd ? () => onEnd() : undefined });
    this.mode = 'dialogue';
    this.events.emit('dialogue', undefined);
  }

  addBuff(stat: keyof Stats, value: number, seconds: number): void {
    this.buffs = this.buffs.filter((b) => b.stat !== stat);
    this.buffs.push({ stat, value, t: seconds });
    this.refreshStats();
  }

  /** Праздничные действия из диалогов. */
  festival(action: 'tourney' | 'contest' | 'rings' | 'giver' | 'dance'): void {
    const f = this.fest;
    if (action === 'tourney') f.startTourney();
    else if (action === 'contest') f.harvestContest();
    else if (action === 'rings') f.ringToss();
    else if (action === 'dance') f.dance();
    else {
      const target = f.secretGiver();
      if (target) this.say('ogden', [L(`Ваш адресат — ${npcDef(target).name.ru}. Подарок ему или ей сегодня будет стоить втрое!`, `Your recipient is ${npcDef(target).name.en}. A gift to them today counts triple!`)]);
    }
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
      if (id === 'chronicle_2') this.give('true_chronicle');
      if (id === 'relay_key') this.give('relay_key');
    }
    if (id === 'edmund_letter') this.state.flags.edmund_letter_read = true;
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
    if (this.fest.shopClosed(id)) {
      this.toast(t(L('Сегодня праздник — лавка закрыта', 'It is a festival — the shop is closed')), '#ffd080');
      return;
    }
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

  // ───────────────────────── Задания ─────────────────────────

  startQuest(id: string): void {
    const q = QUEST_BY_ID[id];
    if (!q || this.state.quests[id]) return;
    const base = q.goal.kind === 'kill' ? (this.state.stats[`kill_${q.goal.monster}`] ?? 0) : 0;
    this.state.quests[id] = { status: 'active', progress: 0, base };
    this.toast(tr('questNew', { name: t(q.title) }), '#a0d0ff');
    this.world?.fx({ t: 'sfx', id: 'lore' });
    this.checkQuests();
  }

  questActive(id: string): boolean {
    return this.state.quests[id]?.status === 'active';
  }

  questDone(id: string): boolean {
    return this.state.quests[id]?.status === 'done';
  }

  /** Прогресс задания: [сколько, из скольких]. */
  questProgress(id: string): [number, number] {
    const q = QUEST_BY_ID[id]!;
    const st = this.state.quests[id];
    const s = this.state;
    const g = q.goal;
    switch (g.kind) {
      case 'floor':
        return [Math.min(g.n, s.dungeon.deepest), g.n];
      case 'boss':
        return [s.dungeon.bosses.includes(g.floor) ? 1 : 0, 1];
      case 'lore':
        return [Math.min(g.count, g.ids ? g.ids.filter((x) => s.lore.includes(x)).length : s.lore.length), g.count];
      case 'item':
        return [Math.min(g.qty, countItem(s.inventory, g.item)), g.qty];
      case 'kill':
        return [Math.min(g.n, (s.stats[`kill_${g.monster}`] ?? 0) - (st?.base ?? 0)), g.n];
      case 'upgrade':
        return [s.manor.upgrades.includes(g.id) || s.manor.building?.id === g.id ? 1 : 0, 1];
      case 'talk':
        return [0, 1];
    }
  }

  /** Автоматически завершить задания, чьи условия выполнены (кроме сдачи предметов и разговоров). */
  checkQuests(): void {
    for (const [id, st] of Object.entries(this.state.quests)) {
      if (st.status !== 'active') continue;
      const q = QUEST_BY_ID[id];
      if (!q || q.goal.kind === 'item' || q.goal.kind === 'talk') continue;
      const [a, b] = this.questProgress(id);
      st.progress = a;
      if (a >= b) this.completeQuest(q);
    }
  }

  private completeQuest(q: QuestDef): void {
    const st = this.state.quests[q.id];
    if (!st || st.status === 'done') return;
    st.status = 'done';
    const r = q.reward;
    if (r.gold) this.giveGold(r.gold);
    for (const [id, n] of r.items ?? []) this.give(id, n);
    for (const [npc, pts] of r.friendship ?? []) this.friendship(npc, pts);
    for (const rid of r.recipes ?? []) this.learnRecipe(rid);
    for (const [f, d] of r.rep ?? []) this.rep(f, d);
    for (const f of r.flags ?? []) this.setFlag(f);
    this.toast(tr('questDone', { name: t(q.title) }), '#ffd040');
    this.world?.fx({ t: 'sfx', id: 'levelup' });
    if (q.next) this.startQuest(q.next);
  }

  /** Сдача заданий «принеси предмет». true — открылся диалог благодарности. */
  private turnInItems(npc: string): boolean {
    for (const [id, st] of Object.entries(this.state.quests)) {
      const q = QUEST_BY_ID[id];
      if (st.status !== 'active' || !q || q.giver !== npc || q.goal.kind !== 'item') continue;
      const g = q.goal;
      if (countItem(this.state.inventory, g.item) < g.qty) continue;
      removeItem(this.state.inventory, g.item, g.qty);
      this.events.emit('inventory', undefined);
      const line = { id: `thanks:${id}`, npc, priority: 0, pages: [q.thanks ?? L('Спасибо! Ты очень выручил(а).', 'Thank you! You really helped.')] };
      this.dialogue = new DialogueRunner(this, npc, line);
      this.mode = 'dialogue';
      this.events.emit('dialogue', undefined);
      this.completeQuest(q);
      return true;
    }
    return false;
  }

  private completeTalkQuests(npc: string): void {
    for (const [id, st] of Object.entries(this.state.quests)) {
      const q = QUEST_BY_ID[id];
      if (st.status === 'active' && q?.goal.kind === 'talk' && q.goal.npc === npc) this.completeQuest(q);
    }
  }

  learnRecipe(id: string): void {
    const r = RECIPE_BY_ID[id];
    if (!r || r.known || this.state.recipes.includes(id)) return;
    this.state.recipes.push(id);
    this.toast(tr('recipeLearned', { name: t(itemDef(r.output[0]).name) }), '#a0ffa0');
  }

  /** Изменить репутацию; соперники фракции реагируют вполовину (см. RIVALRY). */
  rep(f: FactionId, delta: number, spill = true): void {
    const before = this.state.factions[f];
    this.state.factions[f] = Math.max(-100, Math.min(100, before + delta));
    if (spill) for (const [other, k] of Object.entries(RIVALRY[f]) as [FactionId, number][]) this.rep(other, delta * k * 0.5, false);
    if (spill && delta !== 0) this.toast(`${t(FACTIONS.find((x) => x.id === f)!.name)} ${delta > 0 ? '+' : ''}${delta}`, delta > 0 ? '#a0e0a0' : '#e0a0a0');
  }

  // ───────────────────────── Компаньоны ─────────────────────────

  canInvite(npc: string): boolean {
    const d = npcDef(npc);
    const c = this.state.companion;
    return !!d.companion && npc !== 'halvard' && hearts(this.state, npc) >= 4 && this.state.time.minutes < 18 * 60 && !(c && c.day === this.state.time.totalDays);
  }

  inviteCompanion(npc: string): void {
    if (!this.canInvite(npc)) return;
    this.state.companion = { npc, day: this.state.time.totalDays, revived: false, down: false };
    this.toast(tr('companionJoined', { name: t(npcDef(npc).name) }), '#a0d0ff');
  }

  private spawnCompanion(world: World, npc: string, x: number, y: number): Companion {
    const h = hearts(this.state, npc);
    const c = new Companion(npc, x, y, this.state.hero.level, h, npc !== 'halvard' && h >= 8 && !this.state.companion?.revived);
    world.addNow(c);
    return c;
  }

  // ───────────────────────── Финалы ─────────────────────────

  /** После победы над Хальвардом: разговор у Трона и выбор. */
  startEnding(): void {
    if (this.state.ending) return;
    const cond = endingConditions(this.state);
    const choices = [
      { text: L('Восстановить Печать.', 'Restore the Seal.'), act: () => this.chooseEnding('restore') },
      { text: L('Разбить Печать и освободить тебя.', 'Break the Seal and set you free.'), act: () => this.chooseEnding('free') },
    ];
    if (cond.take) choices.push({ text: L('Вложить ключ эстафеты. Я займу твоё место.', 'Set the relay key. I will take your place.'), act: () => this.chooseEnding('take') });
    this.dialogue = new DialogueRunner(this, 'halvard', { id: 'throne', npc: 'halvard', priority: 0, pages: THRONE_PAGES, choices });
    this.mode = 'dialogue';
    this.events.emit('dialogue', undefined);
  }

  chooseEnding(id: EndingId, afterFight = false): void {
    if (id === 'free' && !afterFight) {
      if (!endingConditions(this.state).free) return this.chooseEnding('bad');
      // добрый финал: последний бой вместе с королём
      this.state.flags.free_fight = true;
      this.spawnFreeFight(this.world);
      this.toast(tr('kingJoins'), '#c8a8ff');
      return;
    }
    this.state.ending = id;
    this.state.flags[`ending_${id}`] = true;
    this.state.flags.free_fight = false;
    this.mode = 'play';
    this.events.emit('ending', { id });
  }

  /** Аватар Голода и союзник Хальвард посреди арены. */
  spawnFreeFight(w: World): void {
    const rooms = w.meta.rooms as { role: string; x: number; y: number; w: number; h: number }[] | undefined;
    const ar = rooms?.find((r) => r.role === 'boss');
    if (!ar) return;
    const cx = (ar.x + ar.w / 2) * 16, cy = (ar.y + 4) * 16;
    const b = new Boss('hunger_avatar', cx, cy, 70);
    b.arena = { x: ar.x * 16, y: ar.y * 16, w: ar.w * 16, h: ar.h * 16 };
    w.add(b);
    b.wake(w);
    const p = this.player;
    const king = new Companion('halvard', p.x + 20, p.y, this.state.hero.level, 10, false);
    w.add(king);
  }

  /** Эпилог прочитан: вернуться в город (пост-гейм). */
  finishEnding(): void {
    this.events.emit('ending', null);
    this.goTo({ kind: 'town' }, doorSpawn('crypt'));
  }

  // ───────────────────────── Крафт, склад, стройка, услуги ─────────────────────────

  openCrafting(station: Station): void {
    this.craftStation = station;
    this.mode = 'craft';
    this.events.emit('panel', { kind: 'craft' });
  }

  craftList() {
    if (!this.craftStation) return [];
    return knownRecipes(this.state, this.craftStation).map((r) => ({ r, missing: missingFor(this.state, r) }));
  }

  craft(recipeId: string): boolean {
    const r = RECIPE_BY_ID[recipeId];
    if (!r || (!r.known && !this.state.recipes.includes(recipeId))) return false;
    if (missingFor(this.state, r).length) return false;
    const h = this.state.hero;
    if (h.energy < r.energy) {
      this.toast(tr('tooTired'), '#ffb060');
      return false;
    }
    const [out, n] = r.output;
    if (capacityFor(this.state.inventory, out) < n) {
      this.toast(tr('inventoryFull'), '#ff8080');
      return false;
    }
    for (const [id, q] of r.inputs) removeItem(this.state.inventory, id, q);
    h.energy -= r.energy;
    this.state.time.minutes += r.minutes;
    const stack = r.station === 'anvil' ? makeItem(this.rng, out, forgeRarity(this.rng, h.level), n) : makeItem(this.rng, out, 0, n);
    this.giveItem(stack);
    this.state.stats.crafted = (this.state.stats.crafted ?? 0) + 1;
    this.world.fx({ t: 'sfx', id: r.station === 'anvil' || r.station === 'furnace' ? 'pick' : r.station === 'alchemy' ? 'drink' : 'eat' });
    this.events.emit('panel', { kind: 'craft' });
    return true;
  }

  closePanel(): void {
    this.craftStation = null;
    this.service = null;
    this.mode = 'play';
    this.events.emit('panel', null);
  }

  openStorage(): void {
    this.mode = 'storage';
    this.events.emit('panel', { kind: 'storage' });
  }

  /** Переложить стопку между инвентарём и сундуком. */
  moveStorage(from: 'inv' | 'store', index: number): void {
    const src = from === 'inv' ? this.state.inventory : this.state.storage;
    const dst = from === 'inv' ? this.state.storage : this.state.inventory;
    const s = src[index];
    if (!s) return;
    addToContainer(dst, s);
    if (s.qty <= 0) src[index] = null;
    this.events.emit('inventory', undefined);
    this.events.emit('panel', { kind: 'storage' });
  }

  openBuild(): void {
    this.mode = 'build';
    this.events.emit('panel', { kind: 'build' });
  }

  /** Заказать улучшение усадьбы у Борина. Возвращает причину отказа или null. */
  orderUpgrade(id: string): string | null {
    const u = UPGRADE_BY_ID[id];
    const m = this.state.manor;
    if (!u) return 'unknown';
    if (m.upgrades.includes(id)) return tr('alreadyBuilt');
    if (m.building) return tr('busyBuilding');
    if (u.requires?.some((r) => !m.upgrades.includes(r))) return tr('needsFirst');
    if (this.state.hero.gold < u.cost) return tr('notEnoughGold');
    for (const [it, q] of u.items) if (countItem(this.state.inventory, it) < q) return tr('notEnoughMaterials');
    this.state.hero.gold -= u.cost;
    for (const [it, q] of u.items) removeItem(this.state.inventory, it, q);
    m.building = { id, daysLeft: u.days };
    this.toast(tr('buildStarted', { name: t(u.name), n: u.days }), '#ffd040');
    this.world.fx({ t: 'sfx', id: 'coin' });
    this.events.emit('inventory', undefined);
    this.events.emit('panel', { kind: 'build' });
    this.checkQuests();
    return null;
  }

  openService(kind: Service): void {
    this.service = kind;
    this.mode = 'service';
    this.events.emit('panel', { kind: 'service' });
  }

  refStack(ref: ItemRef): ItemStack | null {
    return 'inv' in ref ? this.state.inventory[ref.inv] ?? null : this.state.equipment[ref.equip];
  }

  serviceCost(ref: ItemRef): { gold: number; bar?: string; bars?: number; chance?: number } | null {
    const s = this.refStack(ref);
    if (!s || !this.service) return null;
    if (this.service === 'sharpen') {
      const c = sharpenCost(s);
      return c ? { gold: c.gold, bar: c.bar, bars: c.bars, chance: SHARPEN_CHANCE[s.upgrade] } : null;
    }
    const g = this.service === 'enchant' ? enchantCost(s) : rerollCost(s);
    return g === null ? null : { gold: g };
  }

  applyService(ref: ItemRef): boolean {
    const s = this.refStack(ref);
    const cost = this.serviceCost(ref);
    if (!s || !cost) return false;
    const h = this.state.hero;
    if (h.gold < cost.gold) {
      this.toast(tr('notEnoughGold'), '#ff8080');
      return false;
    }
    if (cost.bar && countItem(this.state.inventory, cost.bar) < (cost.bars ?? 0)) {
      this.toast(tr('notEnoughMaterials'), '#ff8080');
      return false;
    }
    h.gold -= cost.gold;
    if (cost.bar) removeItem(this.state.inventory, cost.bar, cost.bars ?? 0);
    if (this.service === 'sharpen') {
      if (this.rng.chance(cost.chance ?? 1)) {
        s.upgrade++;
        this.toast(tr('sharpenOk', { n: s.upgrade }), '#a0ffa0');
        this.world.fx({ t: 'sfx', id: 'rare' });
      } else {
        this.toast(tr('sharpenFail'), '#ff8080');
        this.world.fx({ t: 'sfx', id: 'block' });
      }
    } else if (this.service === 'enchant') {
      addAffix(this.rng, s);
      this.world.fx({ t: 'sfx', id: 'rare' });
    } else {
      rerollAffixes(this.rng, s);
      this.world.fx({ t: 'sfx', id: 'cast' });
    }
    this.refreshStats();
    this.events.emit('panel', { kind: 'service' });
    return true;
  }

  // ───────────────────────── Подарки ─────────────────────────

  canGift(npc: string): boolean {
    const ns = npcState(this.state, npc);
    const bday = isBirthday(this.state, npcDef(npc));
    return !ns.giftedToday && (ns.giftsWeek < 2 || bday);
  }

  /** Лента и амулет клятвы: особые «подарки» романтики. true — обработано. */
  private romanceGift(npc: string, index: number): boolean {
    const s = this.state.inventory[index]!;
    const def = npcDef(npc);
    const rom = this.state.romance;
    const h = hearts(this.state, npc);
    const say = (pages: import('../data/loc').Loc[]) => {
      this.dialogue = new DialogueRunner(this, npc, { id: 'gift', npc, priority: 0, pages });
      this.mode = 'dialogue';
      this.events.emit('dialogue', undefined);
    };
    const consume = () => {
      s.qty--;
      if (s.qty <= 0) this.state.inventory[index] = null;
      this.events.emit('inventory', undefined);
    };
    if (s.def === 'silver_ribbon') {
      if (!def.romance || rom.partner) {
        say([L('Это… очень мило. Но я не могу это принять.', "That's… very sweet. But I can't accept it.")]);
        return true;
      }
      if (h < 8) {
        say([L('Серебряная лента? Ой… Кажется, ещё рано. Давай получше узнаем друг друга.', "A silver ribbon? Oh… I think it's too soon. Let's get to know each other better.")]);
        return true;
      }
      consume();
      rom.partner = npc;
      rom.stage = 'dating';
      this.friendship(npc, 150);
      say([L('Лента… Да. Да! Я так надеялся(лась), что ты спросишь.', 'A ribbon… Yes. Yes! I so hoped you would ask.'), L('Теперь все в Вальмарке будут знать. И пусть знают.', 'Now all of Valmark will know. And let them.')]);
      this.world.fx({ t: 'sfx', id: 'levelup' });
      return true;
    }
    if (s.def === 'oath_amulet') {
      if (rom.partner !== npc || rom.stage !== 'dating' || h < 10) {
        say([L('Амулет клятвы?.. Не сейчас. Не так.', "An oath amulet?.. Not now. Not like this.")]);
        return true;
      }
      if (!this.state.manor.upgrades.includes('hall')) {
        say([L('Я согласен(на)! Но… может, сначала залатаем крышу в твоей усадьбе? Жить под дырявой крышей — романтично только в балладах.', "I accept! But… maybe patch the roof of your manor first? Living under a leaky roof is only romantic in ballads.")]);
        return true;
      }
      consume();
      rom.stage = 'engaged';
      rom.weddingDay = this.state.time.totalDays + 3;
      say([L('Да. Тысячу раз да. Свадьба через три дня — в храме. Брат Тео уже бежит за свечами.', 'Yes. A thousand times yes. The wedding is in three days — at the temple. Brother Theo is already running for candles.')]);
      this.toast(tr('weddingSoon', { name: t(def.name) }), '#ff8aa0');
      this.world.fx({ t: 'sfx', id: 'levelup' });
      return true;
    }
    return false;
  }

  giveGift(npc: string, index: number): void {
    const s = this.state.inventory[index];
    if (!s) return;
    if ((s.def === 'silver_ribbon' || s.def === 'oath_amulet') && this.romanceGift(npc, index)) return;
    if (!this.canGift(npc)) return;
    const d = itemDef(s.def);
    if (d.kind === 'quest') return;
    const def = npcDef(npc);
    const reaction = giftReaction(def, s.def);
    const bday = isBirthday(this.state, def);
    const ns = npcState(this.state, npc);
    const before = hearts(this.state, npc);
    ns.points = Math.max(0, Math.min(10 * 250 + 249, ns.points + GIFT_POINTS[reaction] * (bday ? 8 : 1) * this.fest.giftMul(npc)));
    ns.giftedToday = true;
    ns.giftsWeek++;
    (this.state.giftLog[npc] ??= {})[s.def] = reaction;
    s.qty--;
    if (s.qty <= 0) this.state.inventory[index] = null;
    const after = hearts(this.state, npc);
    const text = reactionLine(reaction, this.state.time.totalDays + index);
    const pages = bday ? [L('Ты вспомнил(а) про мой день рождения!', 'You remembered my birthday!'), text] : [text];
    this.dialogue = new DialogueRunner(this, npc, { id: 'gift', npc, priority: 0, pages });
    this.mode = 'dialogue';
    this.events.emit('dialogue', undefined);
    this.events.emit('inventory', undefined);
    this.world.fx({ t: 'sfx', id: reaction === 'love' || reaction === 'like' ? 'heal' : 'block' });
    if (after > before) this.toast(`${t(def.name)}: ${'♥'.repeat(after)}`, '#ff8aa0');
  }

  // ───────────────────────── Сад ─────────────────────────

  decorateTown(w: World): void {
    this.fest.decorate(w);
  }

  plotLabel(i: number): string {
    const p = this.state.manor.garden[i];
    if (!p) return '';
    if (p.ready) return tr('harvest');
    if (!p.seed) return tr('plant');
    if (!p.watered && !isRainy(this.state.time.weather)) return tr('water');
    return '';
  }

  plotAction(i: number): void {
    const p = this.state.manor.garden[i];
    if (!p) return;
    const w = this.world;
    const [px, py] = [(w.entities.find((e) => (e as { index?: number }).index === i && e.sprite === 'plot')?.x ?? 0), 0];
    void py;
    if (p.ready && p.seed) {
      const c = CROPS[p.seed]!;
      const n = 1 + (this.rng.chance(0.2 + this.stats().luck * 0.02) ? 1 : 0);
      this.give(c.crop, n);
      if (c.regrow) {
        p.ready = false;
        p.days = c.days - c.regrow;
      } else Object.assign(p, { seed: null, days: 0, ready: false });
      w.fx({ t: 'sfx', id: 'pickup' });
      this.state.stats.harvested = (this.state.stats.harvested ?? 0) + n;
      return;
    }
    if (!p.seed) {
      const season = this.state.time.season;
      const idx = this.state.inventory.findIndex((s) => s && CROPS[s.def]?.seasons.includes(season));
      if (idx < 0) {
        this.toast(tr('needSeeds'), '#c0a080');
        return;
      }
      if (!this.useEnergy(2)) return this.toast(tr('tooTired'), '#ffb060');
      const s = this.state.inventory[idx]!;
      p.seed = s.def;
      p.days = 0;
      p.watered = false;
      s.qty--;
      if (s.qty <= 0) this.state.inventory[idx] = null;
      w.fx({ t: 'dust', x: px, y: this.player.y, n: 3 });
      this.events.emit('inventory', undefined);
      return;
    }
    if (!p.watered) {
      if (!this.useEnergy(1)) return this.toast(tr('tooTired'), '#ffb060');
      p.watered = true;
      w.fx({ t: 'sparkle', x: this.player.x, y: this.player.y - 4, color: '#6ab0ff', n: 6 });
      w.fx({ t: 'sfx', id: 'drink' });
    }
  }

  // ───────────────────────── Ротация у Лис ─────────────────────────

  buyRotating(index: number): boolean {
    const shop = this.shopId ? SHOPS[this.shopId] : null;
    const st = this.state.economy.rotating[index];
    if (!shop?.rotating || !st) return false;
    const price = rotatingPrice(this.state, st, shop);
    if (this.state.hero.gold < price) {
      this.toast(tr('notEnoughGold'), '#ff8080');
      return false;
    }
    if (this.state.inventory.indexOf(null) < 0) {
      this.toast(tr('inventoryFull'), '#ff8080');
      return false;
    }
    this.state.hero.gold -= price;
    this.state.economy.rotating.splice(index, 1);
    this.giveItem(st);
    this.world.fx({ t: 'sfx', id: 'coin' });
    this.events.emit('shop', { id: shop.id });
    return true;
  }

  weekdayName(): string {
    return weekday(this.state.time.day);
  }

  hasItem(def: string, n = 1): boolean {
    return countItem(this.state.inventory, def) >= n;
  }

  take(def: string, n = 1): boolean {
    const ok = removeItem(this.state.inventory, def, n);
    if (ok) this.events.emit('inventory', undefined);
    return ok;
  }

  openAuction(): void {
    ensureLots(this.state);
    this.mode = 'auction';
    this.events.emit('panel', { kind: 'auction' });
  }

  auctionBuyout(id: string): boolean {
    const ok = buyout(this.state, id);
    if (ok) {
      this.world.fx({ t: 'sfx', id: 'buy' });
      this.events.emit('inventory', undefined);
    } else this.toast(tr('notEnoughGold'), '#ff8080');
    return ok;
  }

  auctionBid(id: string, amount: number): boolean {
    const ok = placeBid(this.state, id, amount);
    if (ok) this.world.fx({ t: 'sfx', id: 'ui' });
    else this.toast(tr('notEnoughGold'), '#ff8080');
    return ok;
  }

  auctionList(invIndex: number, start: number, buyoutPrice: number, days: 1 | 2 | 3): boolean {
    const ok = !!listItem(this.state, invIndex, start, buyoutPrice, days);
    if (ok) {
      this.world.fx({ t: 'sfx', id: 'equip' });
      this.events.emit('inventory', undefined);
    }
    return ok;
  }

  auctionCancel(id: string): boolean {
    return cancelLot(this.state, id);
  }

  auctionCollect(): number {
    const n = collectMail(this.state);
    if (n) this.events.emit('inventory', undefined);
    return n;
  }

  // ───────────────────────── Своя лавка ─────────────────────────

  /** Открыта ли лавка для покупателей (только пока герой в торговом зале). */
  shopOpen = false;
  shopfrontSel = 0;

  openShopfront(index?: number): void {
    if (index !== undefined) this.shopfrontSel = index;
    this.mode = 'shopfront';
    this.events.emit('panel', { kind: 'shopfront' });
  }

  /** Выставить стопку из рюкзака на витрину (прежняя возвращается в рюкзак). */
  placeOnDisplay(slot: number, invIndex: number): boolean {
    const sh = this.state.shop;
    const st = this.state.inventory[invIndex];
    if (!st || itemDef(st.def).kind === 'quest') return false;
    const prev = sh.displays[slot];
    this.state.inventory[invIndex] = prev ? prev.stack : null;
    const book = sh.book[st.def];
    sh.displays[slot] = { stack: st, price: book?.ok || marketValue(this.state, st) };
    this.events.emit('inventory', undefined);
    return true;
  }

  takeFromDisplay(slot: number): boolean {
    const d = this.state.shop.displays[slot];
    if (!d) return false;
    const q = d.stack.qty;
    addToContainer(this.state.inventory, d.stack);
    if (d.stack.qty > 0) {
      if (d.stack.qty === q) this.toast(tr('inventoryFull'), '#ff8080');
      return false;
    }
    this.state.shop.displays[slot] = null;
    this.events.emit('inventory', undefined);
    return true;
  }

  setDisplayPrice(slot: number, price: number): void {
    const d = this.state.shop.displays[slot];
    if (d) d.price = Math.max(1, Math.min(999999, Math.round(price)));
  }

  toggleShop(): void {
    if (this.shopOpen) {
      this.shopOpen = false;
      return;
    }
    if (!(this.scene.kind === 'interior' && this.scene.id === 'ashshop')) return;
    if (!isShopHours(this.state)) {
      this.toast(t(L('Лавка работает с 9:00 до 17:00', 'The shop is open 9:00–17:00')), '#ffd080');
      return;
    }
    if (this.fest.today()) {
      this.toast(t(L('Сегодня праздник — весь город на площади', 'It is a festival — the whole town is on the plaza')), '#ffd080');
      return;
    }
    this.shopOpen = true;
    const floor = this.world.entities.find((e): e is ShopFloor => e instanceof ShopFloor);
    floor?.startDay(this.state.shop.income);
    this.world.fx({ t: 'sfx', id: 'door' });
  }

  itemExists(def: string): boolean {
    return !!ITEMS[def];
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

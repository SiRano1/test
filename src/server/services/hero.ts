import { randomUUID } from 'node:crypto';
import { itemDef, ITEMS } from '../../data/items';
import { karmaStatus, leagueOf, type HeroDTO, type ItemDTO } from '../../online/protocol';
import { xpToNext } from '../../game/systems/stats';
import { WEAPON_CLASSES, type WeaponClass } from '../../game/types';
import { ApiError } from '../auth';
import { nameKey, type Db } from '../db';

export const INV_SIZE = 36;
export const START_GOLD = 200;

export interface HeroRow {
  id: string;
  account_id: string;
  name: string;
  cls: WeaponClass;
  level: number;
  xp: number;
  gold: number;
  karma: number;
  rating: number;
  rd: number;
  vol: number;
  wins: number;
  losses: number;
  waves_best: number;
  tokens: number;
  class_xp: string;
  talents: string;
  last_seen: number;
}

export interface ItemRow {
  uid: string;
  def: string;
  qty: number;
  rarity: number;
  affixes: string;
  upgrade: number;
  owner_kind: 'hero' | 'equip' | 'escrow' | 'guild' | 'mail';
  owner_id: string;
  slot: string | null;
}

export const itemDTO = (r: ItemRow): ItemDTO => ({ uid: r.uid, def: r.def, qty: r.qty, rarity: r.rarity, affixes: JSON.parse(r.affixes), upgrade: r.upgrade, slot: r.slot });

export function heroByAccount(db: Db, accountId: string): HeroRow {
  const h = db.get<HeroRow>('SELECT * FROM heroes WHERE account_id = ?', accountId);
  if (!h) throw new ApiError(404, 'no_hero');
  return h;
}

export function heroById(db: Db, id: string): HeroRow {
  const h = db.get<HeroRow>('SELECT * FROM heroes WHERE id = ?', id);
  if (!h) throw new ApiError(404, 'no_hero');
  return h;
}

export function heroByName(db: Db, name: string): HeroRow {
  const h = db.get<HeroRow>('SELECT * FROM heroes WHERE name_key = ?', nameKey(name));
  if (!h) throw new ApiError(404, 'no_such_hero');
  return h;
}

// ───── Золото и предметы: только через эти функции (с журналом) ─────

export function addGold(db: Db, heroId: string, delta: number, reason: string, ref: string | null, now: number): void {
  if (!Number.isInteger(delta)) throw new ApiError(400, 'bad_amount');
  if (delta === 0) return;
  try {
    const r = db.run('UPDATE heroes SET gold = gold + ? WHERE id = ?', delta, heroId);
    if (!r.changes) throw new ApiError(404, 'no_hero');
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(409, 'not_enough_gold');
  }
  db.run('INSERT INTO gold_ledger (hero_id, delta, reason, ref, at) VALUES (?, ?, ?, ?, ?)', heroId, delta, reason, ref, now);
}

export function getItem(db: Db, uid: string): ItemRow {
  const it = db.get<ItemRow>('SELECT * FROM items WHERE uid = ?', uid);
  if (!it) throw new ApiError(404, 'no_item');
  return it;
}

export function createItem(
  db: Db, stack: { def: string; qty: number; rarity?: number; affixes?: { id: string; value: number }[]; upgrade?: number },
  kind: ItemRow['owner_kind'], owner: string, reason: string, now: number, slot: string | null = null,
): string {
  if (!ITEMS[stack.def]) throw new ApiError(400, 'bad_def');
  const uid = randomUUID();
  db.run('INSERT INTO items (uid, def, qty, rarity, affixes, upgrade, owner_kind, owner_id, slot) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    uid, stack.def, stack.qty, stack.rarity ?? 0, JSON.stringify(stack.affixes ?? []), stack.upgrade ?? 0, kind, owner, slot);
  db.run('INSERT INTO item_ledger (uid, from_kind, from_id, to_kind, to_id, reason, at) VALUES (?, NULL, NULL, ?, ?, ?, ?)', uid, kind, owner, reason, now);
  return uid;
}

/** Переместить предмет, проверив текущего владельца. Любое несовпадение — отказ (защита от дюпа и гонок). */
export function moveItem(
  db: Db, uid: string, from: [ItemRow['owner_kind'], string], to: [ItemRow['owner_kind'], string],
  reason: string, requestId: string | null, now: number, slot: string | null = null,
): void {
  const r = db.run('UPDATE items SET owner_kind = ?, owner_id = ?, slot = ? WHERE uid = ? AND owner_kind = ? AND owner_id = ?', to[0], to[1], slot, uid, from[0], from[1]);
  if (r.changes !== 1) throw new ApiError(409, 'item_not_owned');
  db.run('INSERT INTO item_ledger (uid, from_kind, from_id, to_kind, to_id, reason, request_id, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    uid, from[0], from[1], to[0], to[1], reason, requestId, now);
}

export function destroyItem(db: Db, uid: string, from: [ItemRow['owner_kind'], string], reason: string, now: number): void {
  const r = db.run('DELETE FROM items WHERE uid = ? AND owner_kind = ? AND owner_id = ?', uid, from[0], from[1]);
  if (r.changes !== 1) throw new ApiError(409, 'item_not_owned');
  db.run('INSERT INTO item_ledger (uid, from_kind, from_id, to_kind, to_id, reason, at) VALUES (?, ?, ?, NULL, NULL, ?, ?)', uid, from[0], from[1], reason, now);
}

export function inventory(db: Db, heroId: string): ItemRow[] {
  return db.all<ItemRow>("SELECT * FROM items WHERE owner_kind = 'hero' AND owner_id = ? ORDER BY rowid", heroId);
}

export function equipment(db: Db, heroId: string): ItemRow[] {
  return db.all<ItemRow>("SELECT * FROM items WHERE owner_kind = 'equip' AND owner_id = ?", heroId);
}

/** Выдать предмет в рюкзак (стопки складываются), а если места нет — на почту. */
export function giveToHero(db: Db, heroId: string, stack: { def: string; qty: number; rarity?: number; affixes?: { id: string; value: number }[] }, reason: string, now: number): string {
  const d = itemDef(stack.def);
  if (d.stack > 1 && !(stack.rarity ?? 0) && !(stack.affixes ?? []).length) {
    const ex = db.get<ItemRow>("SELECT * FROM items WHERE owner_kind = 'hero' AND owner_id = ? AND def = ? AND rarity = 0 AND qty < ?", heroId, stack.def, d.stack);
    if (ex) {
      const add = Math.min(stack.qty, d.stack - ex.qty);
      db.run('UPDATE items SET qty = qty + ? WHERE uid = ?', add, ex.uid);
      db.run('INSERT INTO item_ledger (uid, from_kind, from_id, to_kind, to_id, reason, at) VALUES (?, NULL, NULL, ?, ?, ?, ?)', ex.uid, 'hero', heroId, `${reason}+${add}`, now);
      if (add === stack.qty) return ex.uid;
      stack = { ...stack, qty: stack.qty - add };
    }
  }
  if (inventory(db, heroId).length >= INV_SIZE) {
    const uid = createItem(db, stack, 'mail', heroId, reason, now);
    db.run('INSERT INTO mail (hero_id, item_uid, note, at) VALUES (?, ?, ?, ?)', heroId, uid, 'inventory_full', now);
    return uid;
  }
  return createItem(db, stack, 'hero', heroId, reason, now);
}

export function sendMail(db: Db, heroId: string, note: string, now: number, gold = 0, itemUid: string | null = null): void {
  db.run('INSERT INTO mail (hero_id, gold, item_uid, note, at) VALUES (?, ?, ?, ?, ?)', heroId, gold, itemUid, note, now);
}

// ───── Создание героя ─────

const START_KIT: Record<WeaponClass, string> = { sword: 'copper_sword', spear: 'copper_spear', bow: 'copper_bow', staff: 'copper_staff', shield: 'copper_shield' };

export function createHero(db: Db, accountId: string, name: string, cls: WeaponClass, now: number): HeroRow {
  name = name.trim();
  if (!/^[\p{L}\d _-]{3,16}$/u.test(name)) throw new ApiError(400, 'bad_name');
  if (!WEAPON_CLASSES.includes(cls)) throw new ApiError(400, 'bad_class');
  return db.tx(() => {
    if (db.get('SELECT id FROM heroes WHERE account_id = ?', accountId)) throw new ApiError(409, 'hero_exists');
    if (db.get('SELECT id FROM heroes WHERE name_key = ?', nameKey(name))) throw new ApiError(409, 'name_taken');
    const id = randomUUID();
    db.run('INSERT INTO heroes (id, account_id, name, name_key, cls, gold, last_seen, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', id, accountId, name, nameKey(name), cls, START_GOLD, now, now);
    db.run('INSERT INTO gold_ledger (hero_id, delta, reason, at) VALUES (?, ?, ?, ?)', id, START_GOLD, 'start', now);
    createItem(db, { def: START_KIT[cls], qty: 1 }, 'equip', id, 'start', now, 'weapon');
    createItem(db, { def: 'leather_body', qty: 1 }, 'equip', id, 'start', now, 'body');
    createItem(db, { def: 'potion_heal', qty: 3 }, 'hero', id, 'start', now);
    return heroById(db, id);
  });
}

// ───── Экипировка ─────

const SLOT_OF = (def: string): string | null => {
  const d = itemDef(def);
  if (d.weapon) return 'weapon';
  if (d.armor) return d.armor.slot;
  if (d.accessory) return d.accessory.slot === 'ring' ? 'ring1' : 'amulet';
  return null;
};

export function equip(db: Db, heroId: string, uid: string, now: number): void {
  db.tx(() => {
    const it = getItem(db, uid);
    if (it.owner_kind !== 'hero' || it.owner_id !== heroId) throw new ApiError(409, 'item_not_owned');
    let slot = SLOT_OF(it.def);
    if (!slot) throw new ApiError(400, 'not_equippable');
    const worn = equipment(db, heroId);
    if (slot === 'ring1' && worn.some((w) => w.slot === 'ring1') && !worn.some((w) => w.slot === 'ring2')) slot = 'ring2';
    const prev = worn.find((w) => w.slot === slot);
    if (prev) moveItem(db, prev.uid, ['equip', heroId], ['hero', heroId], 'unequip', null, now);
    moveItem(db, uid, ['hero', heroId], ['equip', heroId], 'equip', null, now, slot);
  });
}

export function unequip(db: Db, heroId: string, slot: string, now: number): void {
  db.tx(() => {
    const it = equipment(db, heroId).find((w) => w.slot === slot);
    if (!it) throw new ApiError(404, 'slot_empty');
    if (inventory(db, heroId).length >= INV_SIZE) throw new ApiError(409, 'inventory_full');
    moveItem(db, it.uid, ['equip', heroId], ['hero', heroId], 'unequip', null, now);
  });
}

// ───── Опыт ─────

export function addXp(db: Db, heroId: string, n: number): { level: number; up: boolean } {
  const h = heroById(db, heroId);
  let xp = h.xp + Math.max(0, Math.round(n));
  let level = h.level;
  while (level < 60 && xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level++;
  }
  db.run('UPDATE heroes SET xp = ?, level = ? WHERE id = ?', xp, level, heroId);
  return { level, up: level > h.level };
}

// ───── Почта ─────

export function mailCount(db: Db, heroId: string): number {
  return db.get<{ n: number }>('SELECT COUNT(*) AS n FROM mail WHERE hero_id = ?', heroId)!.n;
}

export function collectMail(db: Db, heroId: string, now: number): { gold: number; items: number; left: number } {
  return db.tx(() => {
    let gold = 0, items = 0;
    const rows = db.all<{ id: number; gold: number; item_uid: string | null }>('SELECT id, gold, item_uid FROM mail WHERE hero_id = ? ORDER BY id', heroId);
    for (const m of rows) {
      if (m.item_uid) {
        if (inventory(db, heroId).length >= INV_SIZE) continue;
        moveItem(db, m.item_uid, ['mail', heroId], ['hero', heroId], 'mail', null, now);
        items++;
      }
      if (m.gold) {
        addGold(db, heroId, m.gold, 'mail', String(m.id), now);
        gold += m.gold;
      }
      db.run('DELETE FROM mail WHERE id = ?', m.id);
    }
    return { gold, items, left: mailCount(db, heroId) };
  });
}

// ───── DTO ─────

export function heroDTO(db: Db, h: HeroRow): HeroDTO {
  const g = db.get<{ id: string; name: string; tag: string; rank: number }>(
    'SELECT g.id, g.name, g.tag, m.rank FROM guild_members m JOIN guilds g ON g.id = m.guild_id WHERE m.hero_id = ?', h.id);
  return {
    id: h.id, name: h.name, cls: h.cls, level: h.level, xp: h.xp, gold: h.gold, karma: h.karma,
    status: karmaStatus(h.karma, false), rating: Math.round(h.rating), league: leagueOf(h.rating),
    wins: h.wins, losses: h.losses, wavesBest: h.waves_best, tokens: h.tokens,
    guild: g ?? null,
    inventory: inventory(db, h.id).map(itemDTO),
    equipment: equipment(db, h.id).map(itemDTO),
    mail: mailCount(db, h.id),
  };
}

import { describe, expect, it } from 'vitest';
import { Db } from '../src/server/db';
import { ApiError, bindEmail, emailLogin, guestLogin, jwtSecret, signJwt, verifyJwt, RateLimiter } from '../src/server/auth';
import { addGold, collectMail, createHero, equip, giveToHero, heroById, heroDTO, inventory, INV_SIZE, mailCount } from '../src/server/services/hero';
import { buyoutLot, cancelLot, listLot, minNextBid, placeBid, priceHistory, searchLots, settleAuctions, SNIPE_WINDOW } from '../src/server/services/auction';

const T0 = 1_800_000_000_000;
const H = 3_600_000;

function world() {
  const db = new Db();
  const mk = (dev: string, name: string, cls: 'sword' | 'bow' = 'sword') => {
    const acc = guestLogin(db, dev, T0);
    return createHero(db, acc.id, name, cls, T0);
  };
  return { db, mk };
}

const err = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as ApiError).code;
  }
  return null;
};

describe('Аккаунты и сессии', () => {
  it('гость по устройству, повторный вход — тот же аккаунт; e-mail и пароль', () => {
    const db = new Db();
    const a = guestLogin(db, 'device-0001', T0);
    expect(guestLogin(db, 'device-0001', T0).id).toBe(a.id);
    expect(err(() => guestLogin(db, 'x', T0))).toBe('bad_device');
    bindEmail(db, a.id, 'hero@valmark.test', 'secret-123');
    expect(emailLogin(db, 'HERO@valmark.test', 'secret-123').id).toBe(a.id);
    expect(err(() => emailLogin(db, 'hero@valmark.test', 'wrong-pass'))).toBe('bad_credentials');
  });

  it('JWT: подпись, срок, подделка', () => {
    const db = new Db();
    const s = jwtSecret(db);
    expect(jwtSecret(db)).toBe(s);
    const tok = signJwt(s, { acc: 'a1' }, 60, T0);
    expect(verifyJwt(s, tok, T0)?.acc).toBe('a1');
    expect(verifyJwt(s, tok, T0 + 120_000)).toBeNull();
    const forged = tok.slice(0, -2) + (tok.endsWith('A') ? 'BB' : 'AA');
    expect(verifyJwt(s, forged, T0)).toBeNull();
  });

  it('ограничение частоты', () => {
    const rl = new RateLimiter(3);
    expect([1, 2, 3, 4].map(() => rl.allow('k', T0))).toEqual([true, true, true, false]);
    expect(rl.allow('k', T0 + 61_000)).toBe(true);
  });
});

describe('Онлайн-герой', () => {
  it('создание: имя уникально, стартовый набор', () => {
    const { db, mk } = world();
    const h = mk('dev-aaaaaaaa', 'Эрин');
    expect(h.gold).toBe(200);
    const dto = heroDTO(db, h);
    expect(dto.equipment.map((e) => e.slot).sort()).toEqual(['body', 'weapon']);
    expect(err(() => mk('dev-bbbbbbbb', 'эрин'))).toBe('name_taken');
    expect(err(() => mk('dev-cccccccc', 'x'))).toBe('bad_name');
  });

  it('золото не уходит в минус, всё в журнале', () => {
    const { db, mk } = world();
    const h = mk('dev-aaaaaaaa', 'Эрин');
    expect(err(() => addGold(db, h.id, -500, 'test', null, T0))).toBe('not_enough_gold');
    expect(heroById(db, h.id).gold).toBe(200);
    addGold(db, h.id, 50, 'test', null, T0);
    const sum = db.get<{ s: number }>('SELECT SUM(delta) AS s FROM gold_ledger WHERE hero_id = ?', h.id)!.s;
    expect(sum).toBe(heroById(db, h.id).gold);
  });

  it('стопки складываются, переполнение уходит на почту', () => {
    const { db, mk } = world();
    const h = mk('dev-aaaaaaaa', 'Эрин');
    giveToHero(db, h.id, { def: 'potion_heal', qty: 2 }, 'test', T0);
    expect(inventory(db, h.id).find((i) => i.def === 'potion_heal')!.qty).toBe(5);
    for (let i = 0; i < INV_SIZE + 3; i++) giveToHero(db, h.id, { def: 'copper_sword', qty: 1 }, 'test', T0);
    expect(inventory(db, h.id).length).toBe(INV_SIZE);
    expect(mailCount(db, h.id)).toBe(4);
  });

  it('экипировка меняет вещи местами', () => {
    const { db, mk } = world();
    const h = mk('dev-aaaaaaaa', 'Эрин');
    const uid = giveToHero(db, h.id, { def: 'iron_sword', qty: 1 }, 'test', T0);
    equip(db, h.id, uid, T0);
    const dto = heroDTO(db, h);
    expect(dto.equipment.find((e) => e.slot === 'weapon')!.def).toBe('iron_sword');
    expect(dto.inventory.some((i) => i.def === 'copper_sword')).toBe(true);
  });
});

describe('Онлайн-аукцион', () => {
  const setup = () => {
    const w = world();
    const seller = w.mk('dev-seller-1', 'Продавец');
    const a = w.mk('dev-buyer-a1', 'Аня');
    const b = w.mk('dev-buyer-b1', 'Борис');
    addGold(w.db, a.id, 5000, 'test', null, T0);
    addGold(w.db, b.id, 5000, 'test', null, T0);
    const uid = giveToHero(w.db, seller.id, { def: 'iron_sword', qty: 1, rarity: 2 }, 'test', T0);
    return { ...w, seller, a, b, uid };
  };

  it('выставление: эскроу и залог 2 %', () => {
    const { db, seller, uid } = setup();
    const id = listLot(db, seller.id, uid, 1000, 3000, 24, T0, 'r1');
    expect(heroById(db, seller.id).gold).toBe(200 - 20);
    expect(db.get<{ owner_kind: string }>('SELECT owner_kind FROM items WHERE uid = ?', uid)!.owner_kind).toBe('escrow');
    // тот же предмет второй раз выставить нельзя
    expect(err(() => listLot(db, seller.id, uid, 1000, null, 24, T0, 'r2'))).toBe('item_not_owned');
    expect(searchLots(db, seller.id, {}, T0)[0]!.id).toBe(id);
  });

  it('ставки: шаг 5 %, замороженное золото, мгновенный возврат перебитому', () => {
    const { db, seller, a, b, uid } = setup();
    const id = listLot(db, seller.id, uid, 1000, null, 12, T0, null);
    expect(err(() => placeBid(db, a.id, id, 999, T0))).toBe('bid_too_low');
    placeBid(db, a.id, id, 1000, T0);
    expect(heroById(db, a.id).gold).toBe(5200 - 1000);
    expect(err(() => placeBid(db, b.id, id, 1040, T0))).toBe('bid_too_low');
    expect(minNextBid({ start_bid: 1000, current_bid: 1000, bidder_id: a.id })).toBe(1050);
    placeBid(db, b.id, id, 1050, T0);
    expect(heroById(db, a.id).gold).toBe(5200);
    expect(heroById(db, b.id).gold).toBe(5200 - 1050);
    // лидер повышает свою ставку — доплачивает разницу
    placeBid(db, b.id, id, 1200, T0);
    expect(heroById(db, b.id).gold).toBe(5200 - 1200);
    expect(err(() => placeBid(db, seller.id, id, 2000, T0))).toBe('own_lot');
  });

  it('анти-снайпинг продлевает лот', () => {
    const { db, seller, a, uid } = setup();
    const id = listLot(db, seller.id, uid, 100, null, 12, T0, null);
    const end = T0 + 12 * H;
    const r = placeBid(db, a.id, id, 100, end - 60_000);
    expect(r.endsAt).toBe(end + SNIPE_WINDOW);
  });

  it('закрытие: вещь покупателю, золото продавцу минус 8 %', () => {
    const { db, seller, a, uid } = setup();
    const id = listLot(db, seller.id, uid, 1000, null, 12, T0, null);
    placeBid(db, a.id, id, 1000, T0 + H);
    expect(settleAuctions(db, T0 + 13 * H)).toEqual({ sold: 1, expired: 0 });
    collectMail(db, a.id, T0 + 14 * H);
    collectMail(db, seller.id, T0 + 14 * H);
    expect(inventory(db, a.id).some((i) => i.uid === uid)).toBe(true);
    expect(heroById(db, seller.id).gold).toBe(180 + 920);
    expect(priceHistory(db, 'iron_sword', 2, T0 + 14 * H)[0]!.median).toBe(1000);
  });

  it('выкуп, отмена без ставок, истечение без ставок', () => {
    const { db, seller, a, b, uid } = setup();
    const id = listLot(db, seller.id, uid, 1000, 2000, 12, T0, null);
    placeBid(db, a.id, id, 1000, T0);
    buyoutLot(db, b.id, id, T0 + H);
    expect(heroById(db, a.id).gold).toBe(5200);
    expect(heroById(db, b.id).gold).toBe(5200 - 2000);
    const uid2 = giveToHero(db, seller.id, { def: 'copper_bar', qty: 5 }, 'test', T0);
    const id2 = listLot(db, seller.id, uid2, 50, null, 12, T0, null);
    cancelLot(db, seller.id, id2, T0);
    const uid3 = giveToHero(db, seller.id, { def: 'coal', qty: 5 }, 'test', T0);
    listLot(db, seller.id, uid3, 50, null, 12, T0, null);
    expect(settleAuctions(db, T0 + 13 * H).expired).toBe(1);
    collectMail(db, seller.id, T0 + 13 * H);
    const inv = inventory(db, seller.id).map((i) => i.uid);
    expect(inv).toContain(uid2);
    expect(inv).toContain(uid3);
  });

  it('предмет никогда не существует дважды', () => {
    const { db, seller, a, uid } = setup();
    const id = listLot(db, seller.id, uid, 10, 20, 12, T0, null);
    buyoutLot(db, a.id, id, T0);
    expect(err(() => buyoutLot(db, a.id, id, T0))).toBe('lot_closed');
    expect(db.get<{ n: number }>('SELECT COUNT(*) AS n FROM items WHERE uid = ?', uid)!.n).toBe(1);
    const moves = db.all<{ to_kind: string }>('SELECT to_kind FROM item_ledger WHERE uid = ? ORDER BY id', uid).map((r) => r.to_kind);
    expect(moves).toEqual(['hero', 'escrow', 'mail']);
  });
});

import { acceptInvite, chatHistory, claimTerritory, addTerritoryPoints, createGuild, deposit, guildDTO, guildLog, invite, kick, leave, postChat, setCrest, setRank, setRankPerms, settleTerritories, storagePut, storageTake, territoryIncome, upgradeHall, withdraw, CREATE_COST, weekOf } from '../src/server/services/guild';
import { PERM } from '../src/online/protocol';

describe('Гильдии', () => {
  const crest = { shape: 1 as const, division: 2 as const, colors: ['#c83a3a', '#e0b040'] as [string, string], charge: 3 as const };
  const setup = () => {
    const w = world();
    const lead = w.mk('dev-leader-1', 'Глава');
    const off = w.mk('dev-officer1', 'Офицер');
    const rec = w.mk('dev-recruit1', 'Новичок');
    for (const h of [lead, off, rec]) addGold(w.db, h.id, 20_000, 'test', null, T0);
    const gid = createGuild(w.db, lead.id, 'Стража Трона', 'СТ', crest, T0);
    for (const h of [off, rec]) {
      invite(w.db, lead.id, h.name, T0);
      acceptInvite(w.db, h.id, gid, T0);
    }
    setRank(w.db, lead.id, off.id, 1, T0);
    return { ...w, lead, off, rec, gid };
  };

  it('создание: плата, уникальность, герб', () => {
    const { db, lead, rec } = setup();
    expect(heroById(db, lead.id).gold).toBe(20_200 - CREATE_COST);
    expect(err(() => createGuild(db, rec.id, 'Иная', 'ИН', crest, T0))).toBe('already_in_guild');
    const w2 = world();
    const h = w2.mk('dev-other-01', 'Другой');
    addGold(w2.db, h.id, 10_000, 't', null, T0);
    expect(err(() => createGuild(w2.db, h.id, 'Гильдия', 'Г', crest, T0))).toBe('bad_tag');
    expect(err(() => createGuild(w2.db, h.id, 'Гильдия', 'ГГ', { ...crest, colors: ['#c83a3a', '#c83a3a'] }, T0))).toBe('bad_crest');
    expect(guildDTO(db, lead.id).members.map((m) => m.rank)).toEqual([0, 1, 4]);
  });

  it('права рангов: новобранец не приглашает и не берёт из казны', () => {
    const { db, lead, rec } = setup();
    expect(err(() => invite(db, rec.id, 'Глава', T0))).toBe('no_permission');
    deposit(db, lead.id, 3000, T0);
    expect(err(() => withdraw(db, rec.id, 10, T0))).toBe('no_permission');
    setRankPerms(db, lead.id, 4, 'Юнга', PERM.withdraw, 100, T0);
    withdraw(db, rec.id, 100, T0);
    expect(err(() => withdraw(db, rec.id, 1, T0))).toBe('daily_limit');
    withdraw(db, rec.id, 50, T0 + 86_400_000);
  });

  it('казна: вклад, дневной лимит офицера, журнал', () => {
    const { db, lead, off } = setup();
    deposit(db, lead.id, 8000, T0);
    withdraw(db, off.id, 5000, T0);
    expect(err(() => withdraw(db, off.id, 1, T0))).toBe('daily_limit');
    expect(guildDTO(db, lead.id).treasury).toBe(3000);
    expect(guildLog(db, lead.id).map((l) => l.action)).toContain('withdraw');
  });

  it('хранилище: положить может любой, взять — по праву', () => {
    const { db, lead, rec } = setup();
    const uid = giveToHero(db, rec.id, { def: 'iron_sword', qty: 1 }, 't', T0);
    storagePut(db, rec.id, uid, T0);
    expect(guildDTO(db, lead.id).storage.map((i) => i.uid)).toContain(uid);
    expect(err(() => storageTake(db, rec.id, uid, T0))).toBe('no_permission');
    storageTake(db, lead.id, uid, T0);
    expect(inventory(db, lead.id).some((i) => i.uid === uid)).toBe(true);
  });

  it('исключение, передача главенства, выход', () => {
    const { db, lead, off, rec } = setup();
    expect(err(() => kick(db, off.id, lead.id, T0))).toBe('rank_too_high');
    kick(db, off.id, rec.id, T0);
    expect(err(() => leave(db, lead.id, T0))).toBe('transfer_leadership_first');
    setRank(db, lead.id, off.id, 0, T0);
    leave(db, lead.id, T0);
    expect(guildDTO(db, off.id).members.map((m) => m.rank)).toEqual([0]);
    leave(db, off.id, T0); // последний — гильдия распущена
    expect(db.get('SELECT id FROM guilds')).toBeUndefined();
  });

  it('герб, зал, чат', () => {
    const { db, lead, rec } = setup();
    expect(err(() => setCrest(db, rec.id, crest, T0))).toBe('no_permission');
    setCrest(db, lead.id, { ...crest, charge: 5 }, T0);
    deposit(db, lead.id, 10_000, T0);
    expect(upgradeHall(db, lead.id, T0)).toBe(2);
    for (let i = 0; i < 205; i++) postChat(db, rec.id, `сообщение ${i}`, T0 + i);
    expect(chatHistory(db, guildDTO(db, lead.id).id, 300).length).toBe(200);
    expect(err(() => postChat(db, rec.id, '   ', T0))).toBe('empty');
  });

  it('территории: заявка, очки, итог недели и доход', () => {
    const { db, lead, off } = setup();
    deposit(db, lead.id, 5000, T0);
    claimTerritory(db, off.id, 3, T0);
    expect(err(() => claimTerritory(db, off.id, 3, T0))).toBe('already_claimed');
    addTerritoryPoints(db, off.id, 3, 7, T0);
    const nextWeek = (weekOf(T0) + 1) * 7 * 86_400_000 + 1000;
    expect(settleTerritories(db, nextWeek)).toEqual([{ territory: 3, owner: guildDTO(db, lead.id).id }]);
    const before = guildDTO(db, lead.id).treasury;
    territoryIncome(db, nextWeek);
    expect(guildDTO(db, lead.id).treasury).toBe(before + 400);
  });
});

import { handleApi, type ApiCtx } from '../src/server/http';
import { addBounty, autoBounty, onKill, setKarma, lossCount } from '../src/server/services/pvp';

describe('HTTP API', () => {
  const api = () => {
    const db = new Db();
    let now = T0;
    const ctx: ApiCtx = { db, secret: jwtSecret(db), now: () => now };
    const call = (method: string, path: string, body: Record<string, unknown> = {}, token?: string, query = '') =>
      handleApi(ctx, method, path, token ? { authorization: `Bearer ${token}` } : {}, body, new URLSearchParams(query));
    const login = (dev: string) => (call('POST', '/api/auth/guest', { deviceId: dev }).json as { token: string }).token;
    return { db, ctx, call, login, tick: (ms: number) => (now += ms) };
  };

  it('вход гостем, создание героя, без токена — 401', () => {
    const { call, login } = api();
    expect(call('GET', '/api/hero').status).toBe(401);
    const tok = login('dev-api-0001');
    expect(call('GET', '/api/hero', {}, tok).status).toBe(404);
    const r = call('POST', '/api/hero', { name: 'Сигил', cls: 'bow', requestId: 'r1' }, tok);
    expect(r.status).toBe(200);
    expect((r.json as { cls: string }).cls).toBe('bow');
    expect(call('GET', '/api/hero', {}, tok).status).toBe(200);
    expect(call('POST', '/api/hero', { name: 'Сигил', cls: 'bow' }, tok).json).toEqual({ error: 'bad_request' });
  });

  it('идемпотентность: повтор запроса не списывает золото дважды', () => {
    const { db, call, login } = api();
    const tok = login('dev-api-0002');
    call('POST', '/api/hero', { name: 'Торговец', cls: 'sword', requestId: 'c1' }, tok);
    const heroId = (call('GET', '/api/hero', {}, tok).json as { id: string }).id;
    const uid = giveToHero(db, heroId, { def: 'iron_bar', qty: 3 }, 't', T0);
    const body = { uid, startBid: 100, buyout: null, hours: 24, requestId: 'list-1' };
    const a = call('POST', '/api/auction/list', body, tok);
    const b = call('POST', '/api/auction/list', body, tok);
    expect(a.json).toEqual(b.json);
    expect(heroById(db, heroId).gold).toBe(200 - 2);
    expect(db.get<{ n: number }>("SELECT COUNT(*) AS n FROM auction_lots")!.n).toBe(1);
  });

  it('ошибка отката не оставляет следов, повтор после исправления проходит', () => {
    const { db, call, login } = api();
    const tok = login('dev-api-0003');
    call('POST', '/api/hero', { name: 'Бедняк', cls: 'sword', requestId: 'c1' }, tok);
    const r = call('POST', '/api/guild', { name: 'Нищие', tag: 'НЩ', crest: { shape: 0, division: 0, colors: ['#c83a3a', '#3a5aa8'], charge: 0 }, requestId: 'g1' }, tok);
    expect(r.json).toEqual({ error: 'not_enough_gold' });
    expect(db.get('SELECT 1 FROM requests WHERE id = ?', 'g1')).toBeUndefined();
  });
});

describe('Карма и награды', () => {
  it('убийство невинного, красный статус, автонаграда, охота', () => {
    const { db, mk } = world();
    const pk = mk('dev-pk-00001', 'Разбойник');
    const v = mk('dev-victim01', 'Жертва');
    const hunter = mk('dev-hunter01', 'Охотник');
    for (let i = 0; i < 3; i++) onKill(db, pk.id, v.id, false, T0);
    expect(heroById(db, pk.id).karma).toBe(-450);
    expect(autoBounty(-450)).toBe(450);
    addGold(db, hunter.id, 1000, 't', null, T0);
    expect(addBounty(db, hunter.id, 'Разбойник', 200, T0)).toBe(650);
    const r = onKill(db, hunter.id, pk.id, false, T0);
    expect(r.bounty).toBe(650);
    expect(heroById(db, hunter.id).karma).toBe(40);
    expect(setKarma(db, pk.id, -5000, T0)).toBe(-1000);
    expect(lossCount(-400, 0.99).stacks).toBe(6);
    expect(lossCount(0, 0).stacks).toBe(1);
  });
});

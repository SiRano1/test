import { itemDef } from '../../data/items';
import type { ItemStack } from '../../game/types';
import type { WastesHooks } from '../sim/wastes';
import type { Db } from '../db';
import { addTerritoryPoints } from './guild';
import { addGold, addXp, equipment, giveToHero, heroById, INV_SIZE, inventory, moveItem, sendMail } from './hero';
import { lossCount, onAttack, onKill } from './pvp';

const GROUND: ['escrow', string] = ['escrow', 'wastes'];

/** Связка Пустошей с БД: каждое движение ценностей — в транзакции и с журналом. */
export function wastesHooks(db: Db, now: () => number, rand: () => number = Math.random): WastesHooks {
  return {
    loot(heroId, stack, gold, dbUid) {
      db.tx(() => {
        if (gold > 0) addGold(db, heroId, gold, 'wastes_loot', null, now());
        if (dbUid) {
          const toMail = inventory(db, heroId).length >= INV_SIZE;
          moveItem(db, dbUid, GROUND, [toMail ? 'mail' : 'hero', heroId], 'wastes_pickup', null, now());
          if (toMail) sendMail(db, heroId, 'inventory_full', now(), 0, dbUid);
        } else if (stack) giveToHero(db, heroId, { def: stack.def, qty: stack.qty, rarity: stack.rarity, affixes: stack.affixes }, 'wastes_loot', now());
      });
    },
    attack(attackerId, victimId) {
      return db.tx(() => onAttack(db, heroById(db, attackerId), heroById(db, victimId), false, now()));
    },
    kill(killerId, victimId, victimFlagged, territory) {
      const r = onKill(db, killerId, victimId, victimFlagged, now());
      addTerritoryPoints(db, killerId, territory, 3, now());
      return r;
    },
    drop(victimId) {
      return db.tx(() => {
        const v = heroById(db, victimId);
        const { stacks, gearChance } = lossCount(v.karma, rand());
        const pool = inventory(db, victimId).filter((i) => itemDef(i.def).kind !== 'quest');
        const out: ItemStack[] = [];
        for (let i = 0; i < stacks && pool.length; i++) {
          const it = pool.splice(Math.floor(rand() * pool.length), 1)[0]!;
          moveItem(db, it.uid, ['hero', victimId], GROUND, 'wastes_death', null, now());
          out.push({ uid: it.uid, def: it.def, qty: it.qty, rarity: it.rarity as 0, affixes: JSON.parse(it.affixes), upgrade: it.upgrade });
        }
        // отступник рискует и надетым
        if (gearChance > 0 && rand() < gearChance) {
          const worn = equipment(db, victimId).filter((i) => i.slot !== 'weapon');
          const it = worn[Math.floor(rand() * worn.length)];
          if (it) {
            moveItem(db, it.uid, ['equip', victimId], GROUND, 'wastes_death_gear', null, now());
            out.push({ uid: it.uid, def: it.def, qty: it.qty, rarity: it.rarity as 0, affixes: JSON.parse(it.affixes), upgrade: it.upgrade });
          }
        }
        return out;
      });
    },
    expire(dbUid, ownerId) {
      db.tx(() => {
        moveItem(db, dbUid, GROUND, ['mail', ownerId], 'wastes_returned', null, now());
        sendMail(db, ownerId, 'wastes_returned', now(), 0, dbUid);
      });
    },
    monsterKill(heroId, territory, xp) {
      addXp(db, heroId, Math.round(xp / 3));
      addTerritoryPoints(db, heroId, territory, 1, now());
    },
  };
}

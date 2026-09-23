# Архитектура проекта

## 1. Выбор стека

| Слой | Решение | Почему |
|---|---|---|
| Язык | **TypeScript** (strict) | Один язык на клиенте, сервере и в общих правилах. Формулы боя, лута и цен исполняются одинаково по обе стороны. |
| Клиент | **Собственный 2D-движок на Canvas 2D** + DOM-интерфейс | Пиксель-арт в разрешении 480×270 не требует WebGL. Логика не зависит от рендера, поэтому её можно тестировать в Node. Нулевые рантайм-зависимости. |
| Сборка | **Vite** | Быстрый dev-сервер, одна HTML-сборка для веба (`build:single`). |
| Десктоп | **Electron или Tauri** (этап релиза) | Путь в Steam. Так же выпущены CrossCode и Vampire Survivors. |
| Сервер | **Node.js + Colyseus** | Авторитарные комнаты (арена, PvP-зоны, чат гильдий) с синхронизацией состояния и HTTP-API для экономики. Общий TS-код с клиентом. |
| БД | **PostgreSQL** (прод) / **SQLite** (разработка) | Транзакции для аукциона и казны, уникальные `item_uid`. |
| Тесты | **Vitest** (логика) + **Playwright** (дымовой e2e в Chromium) | Каждое изменение проверяется без ручного запуска. |

Альтернативы: Godot 4 + Nakama — хороший выбор для нативного ПК. Но разделить код правил между клиентом и
сервером там сложнее, и проект нельзя проверять автоматически в браузере. Архитектура ниже устроена так,
что `src/game` (правила) не знает о рендере — при необходимости его можно портировать.

## 2. Структура папок

```
docs/                 GDD, архитектура, дорожная карта
index.html            точка входа клиента
src/
  core/               без DOM: математика, RNG, события, тайловая карта и коллизии, поиск пути
  data/               контент как данные: предметы, монстры, ярусы, NPC, диалоги, рецепты, лор, строки
  game/               без DOM: правила и симуляция
    entities/         Player, Enemy, Boss, Npc, Companion, Customer, Projectile, Pickup, Prop, ловушки и головоломки (traps.ts)
    combat/           урон, статусы, хитбоксы, ИИ монстров и боссов
    dungeon/          генератор этажей, комнаты, ловушки, головоломки
    town/             карта города, интерьеры, расписания NPC
    systems/          инвентарь, лут, экономика, календарь, отношения, крафт, сад, сохранения,
                      таланты (talents.ts), праздники (festivals.ts), своя лавка (playershop.ts), аукцион (auction.ts)
    world.ts          текущая сцена: карта + сущности + шаг симуляции
    game.ts           корневое состояние игры, переходы сцен, фасад для UI
  client/             браузер
    engine/           цикл, ввод (клавиатура/мышь/геймпад), камера, рендер, аудио
    gfx/              процедурный пиксель-арт: спрайты, тайлы, иконки, частицы, свет
    ui/               DOM-интерфейс: HUD, диалоги, инвентарь, магазины, меню
    main.ts           сборка всего вместе
  online/             протокол клиент↔сервер (типы сообщений, валидация) — общий
  server/             Colyseus-сервер, HTTP-API, репозитории БД
tests/                vitest
e2e/                  дымовые Playwright-сценарии
```

**Правило зависимостей**: `core ← data ← game ← client`, `core/data/game/online ← server`.
`game` никогда не импортирует `client`. Проверяется тестом `tests/architecture.test.ts`.

## 3. Основные модули и классы

### Ядро (`core`)
* `Rng` — детерминированный генератор (mulberry32/sfc32) с `fork(label)` для независимых потоков.
* `TileMap` — сетка тайлов и флаги проходимости. `moveAndCollide(body, dx, dy)` раздельно по осям.
* `Vec2`-функции, `Aabb`, `circleHitsArc` (дуговые хитбоксы ударов).
* `EventBus<Events>` — типизированная шина для связи логики и UI.
* `astar(grid, from, to)` — поиск пути для NPC и монстров.

### Логика (`game`)
* `Game` — корень. Хранит `GameState` (сериализуемое), текущий `World`, системы.
  Методы `update(dt, input)`, `enterDungeon(floor)`, `enterTown(spot)`, `sleep()`, `save()`/`load()`.
* `World` — карта + сущности + очереди эффектов. `step(dt)` вызывает ИИ, физику, бой, подбор предметов и триггеры.
* `Entity` — базовая сущность (позиция, тело, спрайт, направление), далее `Actor` (HP, статы, статусы)
  и `Player`, `Enemy`, `Npc`.
* `Combat` — `resolveHit(attacker, target, attack)`: формула из GDD §6.4, блок, парирование, отбрасывание, хитстоп.
* `EnemyBrain` — машина состояний `idle → chase → windup → attack → recover`, конфигурируется данными монстра.
* `DungeonGenerator.generate(seed, tier, floor)` → `FloorLayout` (тайлы, комнаты, спавны, выход).
* Системы: `Inventory`, `LootTable`, `Economy`, `Calendar`, `Relationships`, `Quests`, `Crafting`, `SaveSystem`.

### Клиент (`client`)
* `Loop` — фиксированный шаг 60 Гц, рендер через `requestAnimationFrame`.
* `Input` → `InputFrame` (оси, нажатые и удерживаемые действия, прицел). Этот же тип отправляется на сервер в PvP.
* `Renderer` — статический слой тайлов (предрендер в offscreen canvas), сортировка по Y, эффекты, свет.
* `SpriteBank` — генерирует спрайтовые листы из ASCII-шаблонов и палитр при старте.
* `Ui` — DOM-оверлей. Подписывается на `EventBus` и вызывает методы-фасады `Game`.

## 4. Схема данных

### 4.1. Определения (статические данные, `src/data`)

```ts
ItemDef   { id, kind: 'weapon'|'armor'|'accessory'|'material'|'consumable'|'food'|'seed'|'quest'|'lore',
            name: Loc, desc?: Loc, icon, price, stack, tier,
            weapon?: { cls: 'sword'|'spear'|'bow'|'staff'|'shield', atk, speed, reach },
            armor?:  { slot, def }, use?: Effect[], gender?: 'm'|'f'|'n' }
MonsterDef { id, name: Loc, sprite, palette, hp, atk, def, speed, xp, ai: AiConfig,
             attacks: AttackDef[], drops: DropTable, resist?: Partial<Record<Element, number>> }
TierDef    { id, name: Loc, floors: [from, to], palette, monsters: WeightedList, ores, boss, ambience }
NpcDef     { id, name: Loc, role, faction?, romance: boolean, companion?, birthday,
             gifts: { love, like, dislike, hate }, schedule: ScheduleRule[], palette }
DialogueNode { id, speaker, text: Loc, when?: Condition, choices?: Choice[], effects?: Effect[] }
RecipeDef  { id, station, inputs: [id, qty][], output: [id, qty], energy, unlock? }
LoreDef    { id, tier, floor, kind: 'note'|'fresco'|'diary', title: Loc, text: Loc, unlocks?: string[] }
Loc = { ru: string; en: string }
```

### 4.2. Экземпляры и сохранение

```ts
ItemStack { uid: string, def: string, qty: number, rarity: 0..3, affixes: Affix[], upgrade: 0..5 }
Affix     { id: string, value: number }

SaveData {   // SAVE_VERSION = 3
  version: number, seed, playtime,
  hero: { name, level, xp, hp, stamina, mana, energy, gold, classXp: Record<Cls, number> },
  inventory: (ItemStack|null)[], equipment: Record<Slot, ItemStack|null>, storage: (ItemStack|null)[], quick,
  time: { day, season, year, minutes, weather, tomorrow, totalDays },
  dungeon: { deepest: number, elevator: number[], bosses: number[] }, lore: string[],
  npcs: Record<npcId, { points, talkedToday, giftedToday, giftsWeek, flags: string[] }>,
  factions: Record<factionId, number>, flags: Record<string, boolean>, stats: Record<string, number>,
  manor: { upgrades: string[], building: { id, daysLeft } | null, garden: Plot[] },
  economy: { demand: Record<itemId, number>, rotating: ItemStack[] },
  quests: Record<questId, { status, progress, base }>, recipes: string[], giftLog,
  companion, romance: { partner, stage, weddingDay }, ending, talents: string[],
  fest: { key, target, heard: string[], done: string[] },                 // текущий праздник
  shop: { displays: ({ stack, price } | null)[8], popularity, book, sales, income },
  auction: { lots: NpcLot[], mine: MyLot[], mail: ItemStack[], history: Record<itemId, number[]>, day },
  location: { scene, x, y },
  settings: { lang, volume, shake, story, flashes, speed, contrast }
}
```
Сохранение хранится в `localStorage` (3 слота). Есть экспорт и импорт в JSON-файл.
Поле `version` и таблица миграций `migrations[v] (data) → data` обеспечивают совместимость старых сохранений.

### 4.3. Серверная БД (этап 4)

```sql
accounts(id uuid pk, created_at, device_id unique, email unique null, banned bool)
heroes(id uuid pk, account_id fk, name unique, level, xp, gold bigint check(gold>=0),
       karma int, mmr real, mmr_rd real, mmr_vol real, league text, guild_id fk null)
items(uid uuid pk, def_id text, rarity smallint, affixes jsonb, upgrade smallint,
      owner_kind text check in ('hero','escrow','guild','mail'), owner_id uuid, slot text null)
item_ledger(id bigserial, uid uuid, from_kind, from_id, to_kind, to_id, reason, request_id, at)
auction_lots(id uuid pk, seller_id, item_uid unique, start_bid, buyout null, current_bid, bidder_id null,
             ends_at, status text, created_at)
auction_bids(id bigserial, lot_id, bidder_id, amount, at, request_id unique)
price_history(def_id, rarity, day date, median bigint, volume int, pk(def_id, rarity, day))
guilds(id uuid pk, name unique, tag unique, crest jsonb, level, treasury bigint check(treasury>=0), created_at)
guild_members(guild_id, hero_id pk, rank smallint, joined_at)
guild_ranks(guild_id, rank smallint, title, perms int, daily_withdraw bigint)
guild_log(id bigserial, guild_id, hero_id, action, payload jsonb, at)
territories(id smallint pk, name, owner_guild null, siege_at)
matches(id uuid pk, mode, ranked bool, started_at, ended_at, result jsonb)
bounties(target_id pk, amount bigint, updated_at)
```

## 5. Сетевой протокол (этап 4)

* **HTTP** (`/api/*`, JSON, JWT): аккаунт, герой, аукцион, гильдии, таблицы лидеров.
  Каждый изменяющий запрос содержит `requestId` (идемпотентность).
* **Colyseus rooms**:
  * `arena_duel`, `arena_3v3`, `arena_waves` — авторитарная симуляция `game/combat`, 30 Гц;
  * `wastes` — открытая PvP-зона с интерест-менеджментом по сетке;
  * `guild_chat:{id}`.
* Клиент шлёт `InputFrame` (seq, оси, действия, прицел). Сервер отвечает снапшотами состояния с `lastSeq`
  для сверки. Клиентское предсказание — только для своего движения.

## 6. Тестирование и качество

* `npm run typecheck` — строгий TypeScript.
* `npm test` — юнит-тесты правил: генератор (связность, выход достижим), лут, формулы урона, цены,
  календарь, инвентарь, сохранение и миграции, аукцион и рейтинг.
* `npm run e2e` — запуск собранной игры в Chromium: загрузка без ошибок в консоли, движение, бой,
  спуск в подземелье, скриншоты в `e2e/screens/`.

## 7. Сборка и запуск

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # юнит-тесты
npm run build        # прод-сборка в dist/
npm run build:single # один HTML-файл (веб-демо)
npm run e2e          # дымовой тест в браузере (после build)
npm run server       # онлайн-сервер (этап 4)
```

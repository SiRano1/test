import { registerLines, type DialogueHost as H } from '../game/systems/dialogue';
import { L, t } from './loc';

const deaths = (h: H) => h.state.stats.deaths ?? 0;
const deepest = (h: H) => h.state.dungeon.deepest;
const lore = (h: H, id: string) => h.state.lore.includes(id);
const boss = (h: H, floor: number) => h.state.dungeon.bosses.includes(floor);

// ─────────────────────────── Старый Йорн ───────────────────────────
registerLines([
  {
    id: 'yorn_meet', npc: 'yorn', priority: 100, once: true,
    pages: [
      L('А… Значит, ты и есть наследник старого Эшгроува. {hero}, верно? Я Йорн. Копаю могилы, стерегу склеп и слушаю, как город тихонько умирает.',
        "Ah… So you're old Ashgrove's heir. {hero}, is it? I'm Yorn. I dig graves, guard the crypt, and listen to this town quietly dying."),
      L('Твой дед был упрямцем. Спускался туда, куда даже стража не суётся. В склеп Основателей. Под ним — катакомбы, а под катакомбами… говорят, целое королевство.',
        'Your grandfather was a stubborn one. Went where even the Watch won\'t go. Into the Founders\' Crypt. Beneath it lie the catacombs, and beneath those… a whole kingdom, they say.'),
      L('Последние месяцы мертвецы оттуда лезут наружу. Епископ говорит — Печать слабеет. Если хочешь помочь городу — вниз ведёт только одна дорога.',
        "These past months the dead have been crawling out. The Bishop says the Seal is weakening. If you want to help this town, there's only one way — down."),
    ],
    choices: [
      { text: L('Что меня ждёт внизу?', 'What awaits me down there?'), act: (h) => h.startQuest('q_legacy'), next: 'yorn_below' },
      { text: L('Я справлюсь.', "I'll manage."), act: (h) => { h.give('potion_small', 2); h.startQuest('q_legacy'); } },
    ],
  },
  {
    id: 'yorn_below', npc: 'yorn', priority: 0, hidden: true,
    pages: [
      L('Кости, крысы, нетопыри. Чем глуже — тем злее. Каждый пятый этаж — старый гномий подъёмник, запомни их: потом спустишься сразу туда.',
        'Bones, rats, bats. The deeper, the meaner. Every fifth floor has an old dwarven lift — remember them, later you can ride straight down.'),
      L('А на десятом, говорят, сидит сам Настоятель. Первый смотритель катакомб. Он так и не ушёл со своего поста.',
        'And on the tenth, they say, sits the Abbot himself. The first keeper of the catacombs. He never left his post.'),
      L('Держи пару склянок. И помни: блок в последний миг — лучшая броня. Мертвецы не любят, когда их удар отводят.',
        'Take a couple of vials. And remember: a block at the last instant is the best armour. The dead hate having their blows turned aside.'),
    ],
    onEnd: (h) => h.give('potion_small', 2),
  },
  {
    id: 'yorn_death1', npc: 'yorn', priority: 60, once: true, when: (h) => deaths(h) >= 1,
    pages: [
      L('Сестра Агата рассказала, как тебя вынесли. Не стыдись. Твой дед падал раз двадцать, пока не научился ходить по тем плитам.',
        'Sister Agatha told me how they carried you out. No shame in it. Your grandfather fell twenty times before he learned to walk those stones.'),
      L('Внизу держи стамину про запас. Кто выдохся — тот мёртв.', "Down there, keep some stamina in reserve. The winded are the dead."),
    ],
  },
  {
    id: 'yorn_lift', npc: 'yorn', priority: 40, once: true, when: (h) => deepest(h) >= 5,
    pages: [
      L('Пятый этаж! Нашёл подъёмник? Его строили гномы, задолго до Вальмарка. Скрипит, но держит. Входишь в склеп — и выбираешь этаж.',
        'Fifth floor! Found the lift? Dwarves built it, long before Valmark. It creaks, but it holds. Step into the crypt and pick your floor.'),
    ],
  },
  {
    id: 'yorn_epitaph', npc: 'yorn', priority: 30, once: true, when: (h) => lore(h, 'epitaph'),
    pages: [
      L('Эпитафия Ансельма? Хех. Я сам когда-то заметил: три плиты — три разных года смерти. Будто хоронили его трижды.',
        "Anselm's epitaph? Heh. I noticed it myself once: three slabs, three different years of death. As if they buried him three times."),
      L('Епископ сказал — ошибка каменщика. Три ошибки, у трёх разных каменщиков… Ну-ну.', 'The Bishop said it was a mason\'s mistake. Three mistakes by three masons… Sure.'),
    ],
  },
  {
    id: 'yorn_boss1', npc: 'yorn', priority: 70, once: true, when: (h) => boss(h, 10),
    pages: [
      L('Настоятель… упокоен. Я слышал, как колокола сами звякнули в полночь. Первый осколок Печати, а?',
        'The Abbot… laid to rest. I heard the bells ring by themselves at midnight. The first Seal shard, eh?'),
      L('Знаешь, что странно? Он ведь не нападал на город триста лет. Только теперь. Будто что-то внизу его разбудило.',
        "Know what's odd? He never attacked the town in three hundred years. Only now. As if something below woke him."),
    ],
  },
  { id: 'yorn_d1', npc: 'yorn', priority: 1, pages: [L('Ночью в склепе снова скреблись. Спускайся днём — хоть видно, откуда бегут.', 'Something was scratching in the crypt again last night. Go down by day — at least you see where they come from.')] },
  { id: 'yorn_d2', npc: 'yorn', priority: 1, pages: [L('Лопата да фонарь — вот и всё моё богатство. А ты не жалей монет на зелья.', "A shovel and a lantern — that's all my wealth. But don't you skimp on potions.")] },
  { id: 'yorn_d3', npc: 'yorn', priority: 1, pages: [L('Хрупкие урны внизу — не жалей их. Покойники не обидятся, а медяк-другой найдётся.', "Those brittle urns below — don't spare them. The dead won't mind, and there's a copper or two inside.")] },
  { id: 'yorn_d4', npc: 'yorn', priority: 1, pages: [L('Видишь трещину в стене — бей. Старые строители любили тайники.', 'See a crack in a wall — hit it. The old builders loved their hidey-holes.')] },
]);

// ─────────────────────────── Мира Холт ───────────────────────────
registerLines([
  {
    id: 'mira_meet', npc: 'mira', priority: 100, once: true,
    pages: [
      L('Ой! Простите, я не слышала, как вы вошли. Мира Холт, хранительница архива. Ну, то есть — единственная его посетительница.',
        "Oh! Sorry, I didn't hear you come in. Mira Holt, keeper of the archive. Well — its only visitor, really."),
      L('Вы спускаетесь в катакомбы? Тогда у меня просьба. Там внизу надписи, фрески, может быть — записи. Всё, что найдёте, расскажите мне.',
        "You're going down into the catacombs? Then I have a favour to ask. There are inscriptions down there, frescoes, maybe records. Whatever you find — tell me."),
      L('Официальная история Вальмарка умещается на трёх страницах Книги Света. Не бывает таких коротких историй. Что-то в ней вырезали.',
        "Valmark's official history fits on three pages of the Book of Light. No history is that short. Something was cut out."),
    ],
  },
  {
    id: 'mira_epitaph', npc: 'mira', priority: 50, once: true, when: (h) => lore(h, 'epitaph'),
    pages: [
      L('Три даты смерти одного человека? И кто-то выбил «Лжец»… Это не вандализм. Вандалы не пишут так ровно.',
        'Three dates of death for one man? And someone carved "Liar"… That isn\'t vandalism. Vandals don\'t carve so neatly.'),
      L('В Книге Света Ансельм «вознёсся живым». Если он вознёсся — кого тогда хоронили трижды?',
        'In the Book of Light, Anselm "ascended alive." If he ascended, who was buried three times?'),
    ],
    onEnd: (h) => h.friendship('mira', 30),
  },
  {
    id: 'mira_kneeling', npc: 'mira', priority: 55, once: true, when: (h) => lore(h, 'kneeling'),
    pages: [
      L('Король на коленях, с чёрным пламенем в руках… и люди вокруг скорбят? Вы уверены?',
        'The king on his knees, holding black flame… and the people around him grieving? Are you sure?'),
      L('Во всех наших гобеленах Король-Демон стоит над горой черепов. Кто-то рисовал с натуры. А кто-то — по приказу.',
        'In all our tapestries the Demon King stands over a mountain of skulls. Someone painted from life. Someone else — by order.'),
    ],
    onEnd: (h) => h.friendship('mira', 30),
  },
  {
    id: 'mira_unsigned', npc: 'mira', priority: 56, once: true, when: (h) => lore(h, 'unsigned'),
    pages: [
      L('«Спроси воду в шахтах»… Под катакомбами действительно были шахты. Их затопило при Основателях. Официально — подземные воды.',
        '"Ask the water in the mines"… There really were mines beneath the catacombs. They flooded in the Founders\' time. Officially — groundwater.'),
      L('Будьте осторожны, {hero}. Если кто-то оставил эту записку для вас — значит, кто-то очень не хотел, чтобы её нашли другие.',
        'Be careful, {hero}. If someone left that note for you, someone else very much wanted it never found.'),
    ],
    onEnd: (h) => h.friendship('mira', 30),
  },
  {
    id: 'mira_boss1', npc: 'mira', priority: 70, once: true, when: (h) => boss(h, 10),
    pages: [
      L('Весь город празднует. Епископ служит молебен «во славу Основателей». А я всё думаю про фреску с коленопреклонённым королём.',
        'The whole town is celebrating. The Bishop is holding a service "in glory of the Founders." And I keep thinking about that fresco of the kneeling king.'),
      L('Можно… можно я буду вести летопись ваших находок? Настоящую. Не ту, что на трёх страницах.',
        'May I… may I keep a chronicle of your finds? A real one. Not the three-page kind.'),
    ],
    choices: [
      { text: L('Конечно. Вдвоём правду найти проще.', 'Of course. Truth is easier found by two.'), act: (h) => h.friendship('mira', 60) },
      { text: L('Как хочешь.', 'Suit yourself.') },
    ],
  },
  { id: 'mira_d1', npc: 'mira', priority: 1, pages: [L('Пыль здесь старше меня раз в десять. Иногда мне кажется, что книги шепчутся, когда я выхожу.', 'The dust here is ten times older than me. Sometimes I think the books whisper when I leave.')] },
  { id: 'mira_d2', npc: 'mira', priority: 1, pages: [L('Если найдёте внизу что-нибудь написанное — даже обрывок — несите мне. Я заварю чай.', "If you find anything written down there — even a scrap — bring it to me. I'll brew tea.")] },
  { id: 'mira_d3', npc: 'mira', priority: 1, pages: [L('У меня от бабушки остался медальон с узором из колосьев. Она говорила — фамильный. Смешно: у нашей семьи никогда не было полей.', "My grandmother left me a locket with a wheat-ear pattern. Said it was an heirloom. Funny — our family never owned a field.")] },
]);

// ─────────────────────────── Хильда ───────────────────────────
const trade = { text: L('Торговать', 'Trade'), act: (h: H) => h.openShop('smith') };
const sharpen = { text: L('Заточить снаряжение', 'Sharpen gear'), act: (h: H) => h.openService('sharpen') };
const bye = { text: L('До встречи', 'Goodbye') };
registerLines([
  {
    id: 'hilda_meet', npc: 'hilda', priority: 100, once: true,
    pages: [
      L('Хм. Новое лицо. Хильда Железнорукая — кузница моя, молот мой, правила мои. Ржавчину носить — себя не уважать.',
        "Hm. New face. Hilda Ironhand — my forge, my hammer, my rules. Walking around with rust is disrespecting yourself."),
      L('Приноси руду и кости из катакомб — куплю. Нужна сталь получше — продам. Цена честная, торг неуместен.',
        "Bring ore and bone from the catacombs — I'll buy. Need better steel — I'll sell. Fair prices, no haggling."),
    ],
    choices: [trade, { text: L('Кто ещё в городе работает с металлом?', 'Who else in town works metal?'), next: 'hilda_erik' }, bye],
  },
  {
    id: 'hilda_erik', npc: 'hilda', priority: 0, hidden: true,
    pages: [
      L('Никто. Мой сын Эрик мечтает о славе и лезет с деревянным мечом на стражников. Кузнецом ему не быть, а жаль — руки золотые.',
        'Nobody. My son Erik dreams of glory and pokes guardsmen with a wooden sword. He\'ll never be a smith, and it\'s a pity — hands of gold.'),
    ],
    choices: [trade, sharpen, bye],
  },
  {
    id: 'hilda_boss1', npc: 'hilda', priority: 60, once: true, when: (h) => boss(h, 10),
    pages: [L('Слышала, ты уложил Настоятеля. С медью за спиной? Ладно, уважаю. Покажешь осколок — сделаю скидку на железо.', "Heard you put down the Abbot. With copper on your back? Fine, I respect that. Show me the shard and I'll cut you a deal on iron.")],
    choices: [trade, sharpen, bye],
  },
  { id: 'hilda_d1', npc: 'hilda', priority: 1, pages: [L('Ну? Молот стынет.', "Well? The hammer's getting cold.")], choices: [trade, sharpen, bye] },
  { id: 'hilda_d2', npc: 'hilda', priority: 1, pages: [L('Медь мягкая, железо честное, сталь — для тех, кто собирается жить долго.', 'Copper is soft, iron is honest, steel is for those who plan to live long.')], choices: [trade, sharpen, bye] },
]);

// ─────────────────────────── Сестра Агата ───────────────────────────
const heal = { text: L('Исцелиться', 'Receive healing'), act: (h: H) => { h.healFull(); h.toast(t(L('Раны затянулись.', 'Your wounds close.')), '#a0ffa0'); } };
registerLines([
  {
    id: 'agatha_meet', npc: 'agatha', priority: 100, once: true,
    pages: [
      L('Да пребудет с вами Неугасимый Свет. Я сестра Агата. Здесь лазарет — и, боюсь, в последнее время он не пустует.',
        'May the Undying Light be with you. I am Sister Agatha. This is the infirmary — and I fear lately it is never empty.'),
      L('Если вернётесь из-под земли израненным — приходите. Свет лечит бесплатно. Епископ, правда, любит пожертвования.',
        "If you come back from below wounded — come here. The Light heals for free. The Bishop does, however, love donations."),
    ],
    choices: [heal, bye],
  },
  {
    id: 'agatha_after_death', npc: 'agatha', priority: 80, when: (h) => h.flag('woke_infirmary'),
    pages: [L('Лежите, лежите. Вас нашли у подножия лестницы в склепе. Раны я зашила, а вот кошелёк похудел — там внизу мародёров хватает.', 'Lie still. They found you at the foot of the crypt stairs. I stitched your wounds, but your purse is lighter — there are plenty of scavengers down there.')],
    onEnd: (h) => h.setFlag('woke_infirmary', false),
  },
  { id: 'agatha_d1', npc: 'agatha', priority: 1, pages: [L('Свет не спрашивает, кто вы. Только — больно ли вам.', 'The Light does not ask who you are. Only whether you are hurting.')], choices: [heal, bye] },
  { id: 'agatha_d2', npc: 'agatha', priority: 1, pages: [L('Мертвецы внизу — тоже чьи-то деды. Молитесь за них, даже когда бьёте.', 'The dead below were someone\'s grandfathers too. Pray for them, even as you strike.')], choices: [heal, bye] },
]);

// ─────────────────────────── Марта Пек ───────────────────────────
const tradeM = { text: L('Торговать', 'Trade'), act: (h: H) => h.openShop('grocer') };
registerLines([
  {
    id: 'marta_meet', npc: 'marta', priority: 100, once: true,
    pages: [
      L('Заходи, заходи, солнце! Марта Пек, провизия и всё, чтобы не помереть с голоду. Хлеб утренний, сыр — от вдовы Ханны.',
        "Come in, come in, sunshine! Marta Peck — provisions and everything else to keep you from starving. Bread's from this morning, cheese from Widow Hanna."),
      L('А ещё склянки от Осберта, пока он сам лавку не откроет. Под землю без зелий — только дураки и покойники ходят.',
        "And vials from Osbert, until he opens his own shop. Only fools and corpses go underground without potions."),
    ],
    choices: [tradeM, bye],
  },
  { id: 'marta_d1', npc: 'marta', priority: 1, pages: [L('Поешь перед спуском! Сытый герой — живой герой.', 'Eat before you go down! A fed hero is a living hero.')], choices: [tradeM, bye] },
  { id: 'marta_d2', npc: 'marta', priority: 1, pages: [L('Торговля нынче — тьфу. Караваны не ходят, все боятся мертвецов.', 'Business these days — bah. The caravans don\'t come; everyone fears the dead.')], choices: [tradeM, bye] },
]);

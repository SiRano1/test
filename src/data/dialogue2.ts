import { registerLines, type DialogueHost as H } from '../game/systems/dialogue';
import { L } from './loc';

const lore = (h: H, id: string) => h.state.lore.includes(id);
const met = (h: H, id: string) => h.flag(`dlg:${id}`);
const deepest = (h: H) => h.state.dungeon.deepest;
const bye = { text: L('До встречи', 'Goodbye') };
const shop = (id: string) => ({ text: L('Торговать', 'Trade'), act: (h: H) => h.openShop(id) });

// ── Задания у знакомых жителей ──
registerLines([
  {
    id: 'mira_q_lore', npc: 'mira', priority: 60, once: true, when: (h) => met(h, 'mira_meet') && !h.questActive('q_mira_lore') && !h.questDone('q_mira_lore'),
    pages: [L('Кстати, я серьёзно про записи. Найдёте хотя бы три — я отдам вам бабушкин рецепт медового хлеба. Он приносит удачу, клянусь.', "By the way, I meant it about the writings. Find at least three and I'll give you my grandmother's honey bread recipe. It brings luck, I swear.")],
    choices: [{ text: L('Договорились.', 'Deal.'), act: (h) => h.startQuest('q_mira_lore') }, { text: L('Посмотрим.', "We'll see.") }],
  },
  {
    id: 'hilda_q_ore', npc: 'hilda', priority: 55, once: true, when: (h) => met(h, 'hilda_meet'),
    pages: [L('Раз уж ты шаришь по катакомбам — принеси десяток медной руды. Заплачу честно, а жилы там жирные.', "Since you're poking around the catacombs — bring me ten copper ore. I'll pay fair, and the veins down there are fat.")],
    choices: [{ text: L('Принесу.', "I'll bring it."), act: (h) => h.startQuest('q_hilda_ore') }, { text: L('Позже.', 'Later.') }],
  },
  {
    id: 'marta_q_moss', npc: 'marta', priority: 55, once: true, when: (h) => met(h, 'marta_meet'),
    pages: [L('Солнце, у меня просьба. Для похлёбки нужен могильный мох — он растёт только в сырых склепах. Пять пучков, а?', 'Sunshine, a favour. My stew needs grave moss — it only grows in damp crypts. Five bunches, eh?')],
    choices: [{ text: L('Найду.', "I'll find some."), act: (h) => h.startQuest('q_marta_moss') }, { text: L('Не сейчас.', 'Not now.') }],
  },
  {
    id: 'yorn_borin', npc: 'yorn', priority: 35, once: true, when: (h) => h.questDone('q_legacy'),
    pages: [L('Лифт заработал? Это гном Борин постарался — он у склепа днями торчит. Руки у него золотые: и крышу тебе залатает, если заплатишь.', "Lift working? That's Borin the dwarf's doing — he hangs about the crypt all day. Hands of gold: he'll patch your roof too, if you pay.")],
  },
]);

// ── Мира и находки второго яруса ──
registerLines([
  {
    id: 'mira_gorm_log', npc: 'mira', priority: 57, once: true, when: (h) => lore(h, 'gorm_log'),
    pages: [
      L('«Король ждёт смены»… Смены — как на посту. Будто король не узник, а часовой, которого забыли сменить.', '"The king awaits his relief"… Relief — like a watch post. As if the king were not a prisoner but a sentry nobody came to relieve.'),
      L('Если это правда, то все наши праздники в честь Основателей — поминки по человеку, которого бросили.', "If that's true, every feast we hold for the Founders is a wake for a man they abandoned."),
    ],
    onEnd: (h) => h.friendship('mira', 30),
  },
  {
    id: 'mira_flood', npc: 'mira', priority: 58, once: true, when: (h) => lore(h, 'flood_order'),
    pages: [
      L('«Э. Х., капитан гвардии»… Эдмунд Холлоуэй. Основатель Ордена Стражи. Его статуя стоит у казарм, с мечом, поднятым к небу.', '"E. H., Captain of the Guard"… Edmund Holloway. Founder of the Order of the Watch. His statue stands by the barracks, sword raised to the sky.'),
      L('Капитан Бран — его потомок. Покажите ему. Или… не показывайте. Я не знаю, что правильнее.', "Captain Bran is his descendant. Show him. Or… don't. I don't know which is right."),
    ],
  },
  {
    id: 'mira_doll', npc: 'mira', priority: 65, once: true, when: (h) => lore(h, 'doll'),
    pages: [
      L('Кукла для Элиссы… Покажите ещё раз узор на платье. Колосья, переплетённые в косу…', 'A doll for Elissa… Show me the pattern on the dress again. Wheat ears, woven into a braid…'),
      L('Это узор с моего медальона. Бабушкиного. Совпадение, конечно. Конечно, совпадение.', "That's the pattern on my locket. Grandmother's. A coincidence, of course. Of course it is."),
    ],
    onEnd: (h) => {
      h.friendship('mira', 60);
      h.setFlag('mira_locket');
    },
  },
]);

// ── Осберт, алхимик ──
registerLines([
  {
    id: 'osbert_meet', npc: 'osbert', priority: 100, once: true,
    pages: [
      L('А-а, покупатель! Или подопытный? Шучу-шучу. Осберт Мирт, алхимик, травник, философ по вторникам.', 'Ah, a customer! Or a test subject? Joking, joking. Osbert Myrt, alchemist, herbalist, philosopher on Tuesdays.'),
      L('Если заведёте сад — сажайте лунную полынь. С ней любое зелье лечения крепче вдвое.', 'If you ever keep a garden — plant moonwort. It makes any healing draught twice as strong.'),
    ],
    choices: [shop('alchemist'), bye],
  },
  {
    id: 'osbert_q', npc: 'osbert', priority: 55, once: true, when: (h) => met(h, 'osbert_meet'),
    pages: [L('Мне для опытов нужны крылья нетопырей — четыре штуки. Взамен научу двум рецептам, которые не продаю никому.', "For my experiments I need bat wings — four of them. In return I'll teach you two recipes I sell to no one.")],
    choices: [{ text: L('По рукам.', 'Deal.'), act: (h) => h.startQuest('q_osbert_wings') }, shop('alchemist'), bye],
  },
  { id: 'osbert_d1', npc: 'osbert', priority: 1, pages: [L('Зелье — это просто очень вежливый яд.', 'A potion is simply a very polite poison.')], choices: [shop('alchemist'), bye] },
  { id: 'osbert_d2', npc: 'osbert', priority: 1, pages: [L('Сердцекамень? Не трогайте голыми руками. Он тёплый. Камни не должны быть тёплыми.', "Heartstone? Don't touch it bare-handed. It's warm. Stones shouldn't be warm.")], choices: [shop('alchemist'), bye] },
]);

// ── Кай, стражник ──
registerLines([
  {
    id: 'kai_meet', npc: 'kai', priority: 100, once: true,
    pages: [
      L('Стой! А, наследник Эшгроува. Кай Вернер, Орден Стражи. Капитан велел за тобой присматривать.', "Halt! Oh, Ashgrove's heir. Kai Werner, Order of the Watch. The Captain told me to keep an eye on you."),
      L('Не в обиду: в последний раз, когда кто-то спускался под склеп один, мы вытаскивали его по частям.', 'No offence: the last time someone went under the crypt alone, we carried him out in pieces.'),
    ],
  },
  {
    id: 'kai_q', npc: 'kai', priority: 55, once: true, when: (h) => met(h, 'kai_meet'),
    pages: [L('Крысы из катакомб лезут в погреба. Проредишь десяток — капитан замолвит за тебя словечко.', "Rats from the catacombs are getting into the cellars. Thin out ten and the Captain will put in a good word.")],
    choices: [{ text: L('Займусь.', "I'm on it."), act: (h) => h.startQuest('q_kai_rats') }, bye],
  },
  {
    id: 'kai_flood', npc: 'kai', priority: 50, once: true, when: (h) => lore(h, 'flood_order'),
    pages: [L('Ты видел печать Ордена на том приказе? Не может быть. Орден защищает людей. Мы бы никогда… правда?', "You saw the Order's seal on that order? It can't be. The Order protects people. We would never… right?")],
  },
  { id: 'kai_d1', npc: 'kai', priority: 1, pages: [L('Копьё держи двумя руками — и никто до тебя не дотянется.', 'Hold a spear with both hands and nobody can reach you.')] },
  { id: 'kai_d2', npc: 'kai', priority: 1, pages: [L('Когда-нибудь я стану капитаном. Ну, лет через тридцать.', "Someday I'll be captain. Well, in thirty years.")] },
]);

// ── Борин, гном-механик ──
const build = { text: L('Строительство', 'Construction'), act: (h: H) => h.openBuild() };
registerLines([
  {
    id: 'borin_meet', npc: 'borin', priority: 100, once: true,
    pages: [
      L('Хррм. Человек. Борин Угольная Борода. Этот лифт в склепе — моя работа. Ну, я его починил. Строили его мои прадеды.', "Hrrm. A human. Borin Coalbeard. That lift in the crypt — my work. Well, I fixed it. My great-grandfathers built it."),
      L('Изгнан из клана, если спросишь. За то, что спрашивал, куда делись гномы Эрдхейма. Никто не любит этот вопрос.', "Exiled from my clan, if you're asking. For asking where the dwarves of Erdheim went. Nobody likes that question."),
      L('Усадьба твоя — развалина. Заплатишь — подниму. Камень, дерево, золото — всё по-честному.', "Your manor's a ruin. Pay me and I'll raise it. Stone, wood, gold — all fair and square."),
    ],
    choices: [{ text: L('Давай восстановим зал.', "Let's restore the hall."), act: (h) => { h.startQuest('q_borin_roof'); h.openBuild(); } }, bye],
  },
  { id: 'borin_d1', npc: 'borin', priority: 1, pages: [L('Гномья сталь не ржавеет. Гномья обида — тоже.', "Dwarven steel doesn't rust. Neither does a dwarven grudge.")], choices: [build, bye] },
  { id: 'borin_d2', npc: 'borin', priority: 1, pages: [L('Лифт скрипит на двенадцатой отметке. Не бойся. Наверное.', "The lift creaks at the twelfth mark. Don't worry. Probably.")], choices: [build, bye] },
  {
    id: 'borin_forges', npc: 'borin', priority: 40, once: true, when: (h) => lore(h, 'gorm_log'),
    pages: [L('Гномы Бродрика… Ты нашёл их имена внизу? Значит, они не ушли. Их замуровали. Хррм. Мне надо выпить.', "Brodrik's dwarves… You found their names below? So they didn't leave. They were walled in. Hrrm. I need a drink.")],
    choices: [build, bye],
  },
]);

// ── Капитан Бран ──
registerLines([
  {
    id: 'bran_meet', npc: 'bran', priority: 100, once: true,
    pages: [
      L('Капитан Бран Холлоуэй. Ты тот, кто лезет под склеп. Смело. Глупо, но смело.', "Captain Bran Holloway. You're the one crawling under the crypt. Brave. Foolish, but brave."),
      L('Мой предок основал этот Орден. Эдмунд Холлоуэй вывел людей из-под земли, когда Король-Демон пал. Мы стоим здесь с тех пор.', 'My ancestor founded this Order. Edmund Holloway led the people out from under the earth when the Demon King fell. We have stood here ever since.'),
    ],
  },
  {
    id: 'bran_seal', npc: 'bran', priority: 90, when: (h) => h.questActive('q_seal'),
    pages: [
      L('Покажи. …Это наша печать. Щит и поднятый меч. И подпись: «Э. Х.»', 'Show me. …That is our seal. The shield and the raised sword. And the signature: "E. H."'),
      L('«Никто не должен вернуться к Трону». Он затопил шахты, где были живые люди? Эдмунд? Тот, чей меч висит над воротами?', '"No one is to return to the Throne." He flooded mines with living people inside? Edmund? The one whose sword hangs over our gate?'),
      L('…В хранилище Ордена лежит запечатанное письмо Эдмунда. Завещание: «Вскрыть, когда мёртвые снова пойдут». Я думал — это суеверие.', '…In the Order\'s vault lies a sealed letter from Edmund. His will: "Open when the dead walk again." I thought it superstition.'),
      L('Мёртвые идут. Но я не вскрою его, пока не буду уверен, кому ты служишь. Упокой того, кто стережёт шахты, — и поговорим.', "The dead are walking. But I won't open it until I know whom you serve. Lay to rest whatever guards the mines — then we'll talk."),
    ],
    onEnd: (h) => h.setFlag('bran_letter_known'),
  },
  {
    id: 'bran_q_drowned', npc: 'bran', priority: 50, once: true, when: (h) => met(h, 'bran_meet') && deepest(h) >= 11,
    pages: [L('Из шахт тянется смрад. Утопленники. Орден заплатит за каждого упокоенного — дюжина, и получишь железо из наших запасов.', "A stench rises from the mines. The drowned. The Order pays for each one laid to rest — a dozen, and you'll get iron from our stores.")],
    choices: [{ text: L('Берусь.', "I'll do it."), act: (h) => h.startQuest('q_bran_drowned') }, bye],
  },
  { id: 'bran_d1', npc: 'bran', priority: 1, pages: [L('Порядок держится на тех, кто не спит, пока спят другие.', 'Order is kept by those who stay awake while others sleep.')] },
  { id: 'bran_d2', npc: 'bran', priority: 1, pages: [L('Если встретишь внизу что-то в доспехах Ордена — не медли. Это уже не наш брат.', "If you meet anything below wearing the Order's armour — don't hesitate. It is no longer our brother.")] },
]);

// ── Лис, скупщица ──
registerLines([
  {
    id: 'lis_meet', npc: 'lis', priority: 100, once: true,
    pages: [
      L('Ну-ну. Новенький с полными карманами костей. Лис. Покупаю всё, что блестит, и всё, что не блестит, — тоже, но дешевле.', "Well, well. A newcomer with pockets full of bones. Lis. I buy everything that shines, and everything that doesn't — just cheaper."),
      L('Каждый день у меня пара редких вещичек. Откуда — не спрашивай. Честно добытые. Почти.', "Every day I've got a couple of rare trinkets. Don't ask where from. Honestly acquired. Mostly."),
    ],
    choices: [shop('fence'), bye],
  },
  { id: 'lis_d1', npc: 'lis', priority: 1, pages: [L('Смотри-ка, живой. Мне нравятся живые клиенты — они возвращаются.', 'Look at you, alive. I like living customers — they come back.')], choices: [shop('fence'), bye] },
  { id: 'lis_d2', npc: 'lis', priority: 1, pages: [L('Кроу платят мне, чтобы я не продавала вещи из-под Трона. Я беру их деньги. И продаю.', 'The Crowes pay me not to sell things from beneath the Throne. I take their money. And sell.')], choices: [shop('fence'), bye] },
]);

// ── Таверна: Тильда, Элоиза, Пип ──
registerLines([
  {
    id: 'tilda_meet', npc: 'tilda', priority: 100, once: true,
    pages: [L('Добро пожаловать в «Кривой Фонарь»! Пироги горячие, эль холодный, слухи — свежие. Тильда, хозяйка.', "Welcome to the Crooked Lantern! Pies hot, ale cold, rumours fresh. I'm Tilda, the innkeeper.")],
    choices: [shop('tavern'), bye],
  },
  { id: 'tilda_d1', npc: 'tilda', priority: 1, pages: [L('Говорят, Торговый дом Кроу скупает всё, что выносят из шахт. Золото любит тишину, а?', 'They say the House of Crowe buys up everything brought out of the mines. Gold loves silence, eh?')], choices: [shop('tavern'), bye] },
  { id: 'tilda_d2', npc: 'tilda', priority: 1, pages: [L('Епископ пьёт у меня по пятницам. Только никому!', 'The Bishop drinks here on Fridays. Not a word!')], choices: [shop('tavern'), bye] },
  {
    id: 'eloise_meet', npc: 'eloise', priority: 100, once: true,
    pages: [
      L('О, слушатель! Элоиза, бард. Хотите балладу о Четырёх Основателях? Нет? И правильно. Она скучная и, по-моему, лживая.', "Oh, a listener! Eloise, bard. Want the ballad of the Four Founders? No? Good call. It's dull and, if you ask me, a lie."),
      L('Настоящие песни — старые. Бабушка Ула знает одну про «короля, который съел темноту». Вот её я бы спела.', 'The real songs are old. Granny Ula knows one about "the king who ate the dark". That one I would sing.'),
    ],
  },
  { id: 'eloise_d1', npc: 'eloise', priority: 1, pages: [L('♪ Семь осколков, семь ключей, семь стражей у дверей… ♪ Детская считалка. Откуда она — никто не помнит.', '♪ Seven shards, seven keys, seven wardens by the doors… ♪ A children\'s rhyme. Nobody remembers where it came from.')] },
  { id: 'eloise_d2', npc: 'eloise', priority: 1, pages: [L('Принесёшь из-под земли историю — сложу о тебе песню. Даже если плохо кончится. Особенно если.', "Bring me a story from below and I'll make you a song. Even if it ends badly. Especially then.")] },
  {
    id: 'pip_meet', npc: 'pip', priority: 100, once: true,
    pages: [L('Эй! Ты правда спускаешься к мертвецам?! А правда, что у скелетов нет языков, но они всё равно ругаются? Я Пип! Могу отнести записку кому угодно за медяк!', "Hey! Do you really go down to the dead?! Is it true skeletons have no tongues but still swear? I'm Pip! I'll deliver a note to anyone for a copper!")],
  },
  { id: 'pip_d1', npc: 'pip', priority: 1, pages: [L('Мира покраснела, когда я сказал, что ты про неё спрашивал. Ты ведь не спрашивал? Ну, теперь спроси!', "Mira blushed when I said you asked about her. You didn't? Well, now you should!")] },
  { id: 'pip_d2', npc: 'pip', priority: 1, pages: [L('Гном Борин ругается на лифт по-гномьи. Я выучил три слова! Нет, не скажу.', "Borin swears at the lift in Dwarvish. I learned three words! No, I won't tell you.")] },
]);

// ── Мэтр Альбин, зачарователь ──
const ench = { text: L('Зачаровать вещь', 'Enchant an item'), act: (h: H) => h.openService('enchant') };
const reroll = { text: L('Перековать чары', 'Reroll enchantments'), act: (h: H) => h.openService('reroll') };
registerLines([
  {
    id: 'albin_meet', npc: 'albin', priority: 100, once: true,
    pages: [
      L('Серый Круг приветствует вас. Мэтр Альбин. Я вплетаю силу в металл — за разумную плату, разумеется.', 'The Grey Circle greets you. Master Albin. I weave power into metal — for a reasonable fee, of course.'),
      L('Обычную вещь я могу сделать необычной. Необычную — иной. Результат, увы, не гарантирован: магия капризна, как и её носители.', 'An ordinary item I can make uncommon. An uncommon one — different. Results, alas, not guaranteed: magic is fickle, like its bearers.'),
    ],
    choices: [ench, reroll, shop('enchanter'), bye],
  },
  { id: 'albin_d1', npc: 'albin', priority: 1, pages: [L('Архимагистр Изольда занята. Всегда занята. Особенно когда спрашивают о сердцекамне.', 'Archmagister Isolde is busy. Always busy. Especially when someone asks about heartstone.')], choices: [ench, reroll, shop('enchanter'), bye] },
  { id: 'albin_d2', npc: 'albin', priority: 1, pages: [L('Сила Круга идёт снизу. Как вода из колодца. Никто не спрашивает, что на дне колодца.', 'The Circle\'s power comes from below. Like water from a well. Nobody asks what lies at the bottom of the well.')], choices: [ench, reroll, shop('enchanter'), bye] },
]);

// ── Епископ Мортимер ──
registerLines([
  {
    id: 'mortimer_meet', npc: 'mortimer', priority: 100, once: true,
    pages: [
      L('Дитя Света! Наследник благочестивого рода Эшгроув. Я епископ Мортимер Вейл, пастырь Вальмарка и хранитель Печати.', 'Child of the Light! Heir of the pious house of Ashgrove. I am Bishop Mortimer Vale, shepherd of Valmark and keeper of the Seal.'),
      L('Триста лет назад мой предок Ансельм одолел Короля-Демона. Теперь Печать трещит, и нечестивые кости ползут наверх. Церковь благословляет ваш путь.', 'Three hundred years ago my ancestor Anselm vanquished the Demon King. Now the Seal cracks and unholy bones crawl upward. The Church blesses your path.'),
    ],
  },
  {
    id: 'mortimer_shard', npc: 'mortimer', priority: 90, when: (h) => h.questActive('q_bishop'),
    pages: [
      L('Осколок! Первый осколок Печати, вырванный у нечестивого стража! Колокола будут звонить весь вечер.', 'A shard! The first shard of the Seal, torn from the unholy warden! The bells shall ring all evening.'),
      L('Храните его, пока не соберёте все семь. Тогда мы вместе восстановим Печать — и Вальмарк снова уснёт спокойно. Вот пожертвование Церкви — на благое дело.', 'Keep it until you gather all seven. Then together we shall restore the Seal — and Valmark will sleep soundly again. Here is the Church\'s donation — for the good work.'),
    ],
  },
  {
    id: 'mortimer_fresco', npc: 'mortimer', priority: 45, once: true, when: (h) => lore(h, 'kneeling'),
    pages: [L('Фреска с коленопреклонённым? Искусство древних еретиков, дитя. Демон рядился в корону, чтобы обманывать глупцов. Не смотрите на неё долго.', 'A fresco of a kneeling one? The art of ancient heretics, child. The demon wore a crown to deceive fools. Do not look at it too long.')],
  },
  { id: 'mortimer_d1', npc: 'mortimer', priority: 1, pages: [L('Свет не гаснет. Он лишь ждёт тех, кто поднимет фонарь.', 'The Light does not go out. It only waits for those who raise the lantern.')] },
  { id: 'mortimer_d2', npc: 'mortimer', priority: 1, pages: [L('Церковь нуждается в пожертвованиях. Печать не чинится молитвами одними.', 'The Church needs donations. A Seal is not mended by prayer alone.')] },
]);

// ── Вдова Ханна ──
registerLines([
  {
    id: 'hanna_meet', npc: 'hanna', priority: 100, once: true,
    pages: [L('Наследник усадьбы? У вас там отличная земля во дворе была, пока дед не забросил. Семена берите у Марты, а поливать — каждый день, кроме дождливых.', "The manor's heir? You had fine soil in that yard until your grandfather let it go. Get seeds from Marta, and water every day — except rainy ones.")],
  },
  { id: 'hanna_d1', npc: 'hanna', priority: 1, pages: [L('Что не по сезону посажено — то к смене сезона сгниёт. Земля помнит календарь лучше людей.', "What's planted out of season rots when the season turns. Soil remembers the calendar better than people.")] },
  { id: 'hanna_d2', npc: 'hanna', priority: 1, pages: [L('Муж мой был шахтёром. Ушёл в шахты за перевалом и не вернулся. Говорят, там тоже слышат шёпот в камне.', 'My husband was a miner. Went to the mines past the pass and never came back. They say they hear whispers in the stone there too.')] },
]);

// ── Сестра Агата: второй ярус ──
registerLines([
  {
    id: 'agatha_scratch', npc: 'agatha', priority: 45, once: true, when: (h) => lore(h, 'scratched'),
    pages: [L('Сорок чёрточек… Сорок душ. Я помолюсь за них. Даже если Церковь не велит молиться за «слуг Демона».', "Forty marks… Forty souls. I will pray for them. Even if the Church forbids praying for the \"Demon's servants\".")],
  },
]);

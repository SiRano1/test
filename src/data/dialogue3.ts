import { registerLines, type DialogueHost as H, type DLine } from '../game/systems/dialogue';
import { L, type Loc } from './loc';

const lore = (h: H, id: string) => h.state.lore.includes(id);
const met = (h: H, id: string) => h.flag(`dlg:${id}`);
const hs = (h: H, npc: string) => h.hearts(npc);
const bye = { text: L('До встречи', 'Goodbye') };
const trading = { text: L('Лавка Торгового дома', 'Trading House wares'), act: (h: H) => h.openShop('trading') };
const quest = (id: string, text: Loc = L('Возьмусь.', "I'll do it.")) => ({ text, act: (h: H) => h.startQuest(id) });
const ending = (h: H) => h.state.ending;

// ─────────────── Главная линия: связующие реплики ───────────────
registerLines([
  {
    id: 'mira_king_daughter', npc: 'mira', priority: 75, once: true, when: (h) => lore(h, 'king_daughter'),
    pages: [
      L('«Хальвард и Элисса. Праздник первого урожая»… Колосья на платье. Мой медальон.', '"Halvard and Elissa. Feast of the First Harvest"… The wheat on the dress. My locket.'),
      L('{hero}, мне страшно это произносить. Что если Король-Демон — мой… прапрапра… Я даже не знаю, сколько «пра».', "{hero}, I'm afraid to say it aloud. What if the Demon King is my… great-great-great… I don't even know how many \"greats\"."),
    ],
    onEnd: (h) => h.friendship('mira', 80),
  },
  {
    id: 'mira_halvard_letter', npc: 'mira', priority: 74, once: true, when: (h) => lore(h, 'halvard_letter'),
    pages: [L('«Я не выбирал тьму — я выбрал вас». Он писал это Основателям. Тем, кто потом сделал из него чудовище. Я не могу перестать об этом думать.', '"I did not choose the dark — I chose you." He wrote that to the Founders. The ones who later made a monster of him. I can\'t stop thinking about it.')],
  },
  {
    id: 'mira_chronicle', npc: 'mira', priority: 90, when: (h) => h.hasItem('true_chronicle'),
    pages: [
      L('Это… летопись? Подлинная? «Принцесса Элисса ушла с беженцами под именем Холт»…', 'Is that… the chronicle? The true one? "Princess Elissa left with the refugees under the name Holt"…'),
      L('Холт. Моя фамилия. Бабушкин медальон. Значит, всё правда. Я — его кровь.', 'Holt. My name. Grandmother\'s locket. So it\'s all true. I am his blood.'),
      L('Если вы отдадите её мне — я опубликую её. Всю. Пусть весь Вальмарк узнает. Епископ меня возненавидит. Но я больше не хочу жить в трёхстраничной истории.', "If you give it to me — I'll publish it. All of it. Let all of Valmark know. The Bishop will hate me. But I don't want to live in a three-page history anymore."),
    ],
    choices: [
      { text: L('Она твоя. По праву крови.', 'It is yours. By right of blood.'), act: (h) => { h.take('true_chronicle'); h.setFlag('chronicle_mira'); h.friendship('mira', 250); h.rep('church', -10); } },
      { text: L('Мне нужно подумать.', 'I need to think.') },
    ],
  },
  {
    id: 'mira_ice_mirror', npc: 'mira', priority: 73, once: true, when: (h) => lore(h, 'ice_mirror'),
    pages: [L('«Я вернусь за тобой, папа». Она не вернулась. Но я могу. Возьмите меня с собой, когда пойдёте к Трону. Пожалуйста.', '"I\'ll come back for you, Papa." She never did. But I can. Take me with you when you go to the Throne. Please.')],
    onEnd: (h) => h.friendship('mira', 80),
  },
  {
    id: 'mira_letters', npc: 'mira', priority: 72, once: true, when: (h) => lore(h, 'letter_4'),
    pages: [L('«Пусть просто скажет, что ты была счастлива». Я скажу ему. Если вы дадите мне шанс — я скажу.', '"Let them only tell me you were happy." I\'ll tell him. If you give me the chance — I will.')],
  },
  {
    id: 'isolde_chronicle', npc: 'isolde', priority: 90, when: (h) => h.hasItem('true_chronicle'),
    pages: [
      L('Вы нашли летопись архивариуса. Не отрицайте — я чувствую холод библиотеки на вашем плаще.', "You've found the archivist's chronicle. Don't deny it — I can feel the library's cold on your cloak."),
      L('Отдайте её Кругу. Мы изучим её, а не сожжём, как Церковь, и не выставим напоказ, как эта девочка из архива. Знание должно храниться у тех, кто способен его вынести.', "Give it to the Circle. We will study it, not burn it like the Church, nor parade it like that girl from the archive. Knowledge should rest with those able to bear it."),
    ],
    choices: [
      { text: L('Отдать летопись Кругу.', 'Give the chronicle to the Circle.'), act: (h) => { h.take('true_chronicle'); h.setFlag('chronicle_mages'); h.rep('mages', 25); } },
      { text: L('Нет.', 'No.') },
    ],
  },
  {
    id: 'mortimer_chronicle', npc: 'mortimer', priority: 90, when: (h) => h.hasItem('true_chronicle'),
    pages: [L('Ересь в кожаном переплёте. Я вижу её в ваших руках, дитя. Отдайте её Свету — и Свет позаботится, чтобы никто больше не смутился духом.', 'Heresy in a leather binding. I see it in your hands, child. Give it to the Light — and the Light will see that no one is troubled in spirit again.')],
    choices: [
      { text: L('Отдать епископу.', 'Give it to the Bishop.'), act: (h) => { h.take('true_chronicle'); h.setFlag('chronicle_burned'); h.rep('church', 25); h.friendship('mira', -150); } },
      { text: L('Нет.', 'No.') },
    ],
  },
  {
    id: 'corvin_chronicle', npc: 'corvin', priority: 90, when: (h) => h.hasItem('true_chronicle'),
    pages: [L('Постой. Летопись? Отдай её мне — не архимагистру. Изольда её спрячет. А я… я знаю, как использовать Голод. Представь: сила, что держала целое королевство, — в руках тех, кто достоин.', "Wait. The chronicle? Give it to me — not the Archmagister. Isolde will hide it. And I… I know how to use the Hunger. Imagine: the power that held a whole kingdom — in the hands of the worthy.")],
    choices: [
      { text: L('Держи.', 'Take it.'), act: (h) => { h.take('true_chronicle'); h.setFlag('chronicle_corvin'); h.rep('mages', 10); } },
      { text: L('Ни за что.', 'Never.') },
    ],
  },
  {
    id: 'bran_letter', npc: 'bran', priority: 88, when: (h) => h.flag('bran_letter_known') && h.state.factions.watch >= 50 && h.questDone('q_gorm') && !h.flag('edmund_letter_given'),
    pages: [
      L('Ты упокоил Горма. Сделал для Ордена больше, чем любой из нас за век. Я вскрыл письмо Эдмунда.', "You laid Gorm to rest. You've done more for the Order than any of us in a century. I opened Edmund's letter."),
      L('Читай. Я не могу произнести это вслух. Ещё не могу.', "Read it. I can't say it aloud. Not yet."),
    ],
    onEnd: (h) => { h.setFlag('edmund_letter_given'); h.give('edmund_letter'); h.readLore('edmund_letter'); },
  },
  {
    id: 'bran_pact', npc: 'bran', priority: 60, once: true, when: (h) => lore(h, 'silence_pact'),
    pages: [L('«Я не подпишу. Но и не остановлю вас». Эдмунд. Трус — но не предатель. Не знаю, что из этого хуже.', '"I will not sign. But neither will I stop you." Edmund. A coward — but not a traitor. I don\'t know which is worse.')],
  },
  {
    id: 'borin_brodrik', npc: 'borin', priority: 70, once: true, when: (h) => lore(h, 'farewell_rune'),
    pages: [
      L('«Скажи нашему королю, что мы не ушли»… Хррм. Они не бросили его. Мои предки не бросили его.', '"Tell our King we did not leave"… Hrrm. They didn\'t abandon him. My ancestors didn\'t abandon him.'),
      L('Клан изгнал меня за вопрос. Теперь у меня есть ответ. Спасибо, человек. Я… пойду выпью. За Бродрика.', 'The clan exiled me for asking. Now I have the answer. Thank you, human. I… will go have a drink. To Brodrik.'),
    ],
    onEnd: (h) => h.friendship('borin', 200),
  },
  {
    id: 'mortimer_confession', npc: 'mortimer', priority: 65, once: true, when: (h) => lore(h, 'confession'),
    pages: [L('Исповедь? Подделка еретиков. Ансельм вознёсся живым, это знает каждый ребёнок. …Уходите. Мне нужно помолиться.', 'A confession? A heretics\' forgery. Anselm ascended alive, every child knows that. …Leave. I need to pray.')],
  },
  {
    id: 'isolde_blueprint', npc: 'isolde', priority: 65, once: true, when: (h) => lore(h, 'seal_blueprint'),
    pages: [L('«С. Р.»… Сорайя Ренн. Моя прапрабабка. Вы хотите, чтобы я извинилась за неё? Сила Круга держит этот город на плаву. Иногда цена велика. Не мне её возвращать.', '"S. R."… Soraya Renn. My great-great-grandmother. Do you want me to apologise for her? The Circle\'s power keeps this town afloat. Sometimes the price is great. It is not mine to repay.')],
  },
]);

// ─────────────── Новые жители: знакомство, будни, задания ───────────────
registerLines([
  { id: 'veila_meet', npc: 'veila', priority: 100, once: true, pages: [
    L('Осторожно, не наступи на мяту! Ой, прости. Вейла. Я собираю травы для Осберта — ну и для бабушки Улы. Она пьёт только мои отвары.', "Careful, don't step on the mint! Oh, sorry. Veila. I gather herbs for Osbert — and for Granny Ula. She only drinks my brews."),
    L('Если найдёшь внизу светогрибы — принесёшь посмотреть? Говорят, они светятся, потому что помнят солнце.', "If you find glowshrooms down there — will you bring one to show me? They say they glow because they remember the sun."),
  ] },
  { id: 'veila_d1', npc: 'veila', priority: 1, pages: [L('Лунная полынь любит, когда с ней разговаривают. Я не шучу.', "Moonwort likes being talked to. I'm not joking.")] },
  { id: 'veila_d2', npc: 'veila', priority: 1, pages: [L('Бабушка говорит, я пахну рекой. По-моему, это комплимент.', "Granny says I smell like the river. I think that's a compliment.")] },
  { id: 'ula_meet', npc: 'ula', priority: 100, once: true, pages: [
    L('Садись, садись, внучок. Бабушка Ула. Я знаю все сказки Вальмарка — и те, что рассказывают, и те, что шёпотом.', 'Sit, sit, dearie. Granny Ula. I know every tale in Valmark — the ones they tell aloud and the ones they whisper.'),
    L('Приходи раз в неделю — расскажу новую. Старым сказкам нужны новые уши.', 'Come once a week and I\'ll tell you a new one. Old tales need new ears.'),
  ] },
  { id: 'sebastian_meet', npc: 'sebastian', priority: 100, once: true, pages: [
    L('Наследник Эшгроува. Себастьян Кроу. Не утруждайтесь реверансами — в этом городе все и так знают, кто им платит.', "Ashgrove's heir. Sebastian Crowe. Don't bother bowing — everyone in this town already knows who pays them."),
    L('Вы приносите из-под земли любопытные вещи. Матушка хочет с вами поговорить. Я — просто хочу посмотреть, надолго ли вас хватит.', "You bring curious things up from below. Mother wants to talk to you. I — simply want to see how long you'll last."),
  ] },
  { id: 'sebastian_q', npc: 'sebastian', priority: 50, once: true, when: (h) => met(h, 'sebastian_meet'), pages: [
    L('Услуга за услугу. У матушки скоро именины, а я, как обычно, забыл. Пять речных жемчужин — и я ваш должник.', "A favour for a favour. Mother's name-day is soon, and as usual I forgot. Five river pearls — and I'm in your debt."),
  ], choices: [quest('q_traders_pearls'), bye] },
  { id: 'sebastian_d1', npc: 'sebastian', priority: 1, pages: [L('Деньги не пахнут. Но иногда звенят подозрительно глухо.', "Money doesn't smell. But sometimes it rings suspiciously dull.")] },
  { id: 'livia_meet', npc: 'livia', priority: 100, once: true, pages: [
    L('Ливия Кроу. Торговый дом кормит этот город, пока Церковь молится, а маги пишут трактаты. Присаживайтесь.', 'Livia Crowe. The Trading House feeds this town while the Church prays and the mages write treatises. Have a seat.'),
    L('Через нас идут лоты на аукцион Альтенбурга. Выставляйте находки — мы возьмём скромную комиссию. Совсем скромную.', 'Lots for the Altenburg auction pass through us. List your finds — we take a modest commission. Very modest.'),
  ], choices: [{ text: L('Аукцион', 'Auction'), act: (h) => h.openAuction() }, trading, bye] },
  { id: 'livia_q', npc: 'livia', priority: 50, once: true, when: (h) => met(h, 'livia_meet') && h.state.dungeon.deepest >= 61, pages: [
    L('Говорят, в Тронном зале лежит королевское золото. Старая чеканка. Принесите два слитка — заплачу втрое. И забудьте, что я спрашивала.', 'They say royal gold lies in the Throne Hall. Old minting. Bring me two ingots — I\'ll pay triple. And forget I asked.'),
  ], choices: [quest('q_traders_gold'), bye] },
  { id: 'livia_d1', npc: 'livia', priority: 1, pages: [L('Стабильность — вот настоящее золото. Всё остальное — просто металл.', 'Stability — that is real gold. Everything else is just metal.')], choices: [{ text: L('Аукцион', 'Auction'), act: (h) => h.openAuction() }, trading, bye] },
  { id: 'ogden_meet', npc: 'ogden', priority: 100, once: true, pages: [
    L('А! Наш герой! Огден Пратт, бургомистр. Вы же не собираетесь… ну… разрушать что-нибудь? Ливия… то есть Торговый дом… очень ценит спокойствие.', "Ah! Our hero! Ogden Pratt, mayor. You aren't planning to… well… break anything? Livia… I mean the Trading House… greatly values calm."),
  ] },
  { id: 'ogden_d1', npc: 'ogden', priority: 1, pages: [L('Налоги? Какие налоги? Ах, эти. Они… сами собираются. Почти.', 'Taxes? What taxes? Ah, those. They… collect themselves. Almost.')] },
  { id: 'isolde_meet', npc: 'isolde', priority: 100, once: true, pages: [
    L('Архимагистр Изольда Ренн. Я занята, но вы спускаетесь туда, куда Круг не может. Это делает вас… полезным.', 'Archmagister Isolde Renn. I am busy, but you descend where the Circle cannot. That makes you… useful.'),
  ] },
  { id: 'isolde_q1', npc: 'isolde', priority: 50, once: true, when: (h) => met(h, 'isolde_meet') && h.state.dungeon.deepest >= 41, pages: [
    L('В Ледяной библиотеке оседает эфирная пыль. Принесите три меры — и Круг запомнит ваше имя.', 'Ether dust settles in the Frozen Library. Bring three measures — and the Circle will remember your name.'),
  ], choices: [quest('q_mages_dust'), bye] },
  { id: 'isolde_q2', npc: 'isolde', priority: 49, once: true, when: (h) => h.questDone('q_mages_dust'), pages: [
    L('Библиотеке Круга нужны древние страницы. Десяток. Никто не читает их лучше нас.', 'The Circle\'s library needs ancient pages. A dozen, less two. No one reads them better than we do.'),
  ], choices: [quest('q_mages_tomes'), bye] },
  { id: 'isolde_d1', npc: 'isolde', priority: 1, pages: [L('Магия — это не дар. Это долг. Иногда — чужой.', "Magic is not a gift. It is a debt. Sometimes someone else's.")] },
  { id: 'nisa_meet', npc: 'nisa', priority: 100, once: true, pages: [
    L('Ты — тот, кто спускается вниз? Ниса Ренн. Да, та самая Ренн, племянница. Нет, я не такая скучная, как тётя.', "You're the one who goes below? Nisa Renn. Yes, that Renn — the niece. No, I'm not as dull as my aunt."),
    L('Я умею поджигать вещи. Взглядом — пока нет, но работаю над этим.', "I can set things on fire. Not with a look yet — but I'm working on it."),
  ] },
  { id: 'nisa_d1', npc: 'nisa', priority: 1, pages: [L('Если что-нибудь загорится — это не я. Скорее всего.', "If anything catches fire — it wasn't me. Probably.")] },
  { id: 'corvin_meet', npc: 'corvin', priority: 100, once: true, pages: [
    L('Магистр Корвин. Ты чувствуешь, как дрожит земля по ночам? Это не Печать слабеет. Это Сила просится наружу. Глупо держать её взаперти.', "Magister Corvin. Do you feel the earth tremble at night? It isn't the Seal weakening. It's Power asking to be let out. Foolish to keep it locked away."),
  ] },
  { id: 'corvin_q', npc: 'corvin', priority: 50, once: true, when: (h) => met(h, 'corvin_meet') && h.state.dungeon.deepest >= 61, pages: [
    L('Осколки бездны. Два. Принеси — и я заплачу щедрее Торгового дома. Архимагистру об этом знать не обязательно.', "Abyss shards. Two. Bring them — and I'll pay better than the Trading House. The Archmagister needn't know."),
  ], choices: [quest('q_mages_corvin'), bye] },
  { id: 'corvin_d1', npc: 'corvin', priority: 1, pages: [L('Голод — это просто слово, которым трусы называют силу.', 'Hunger is just the word cowards use for power.')] },
  { id: 'daren_meet', npc: 'daren', priority: 100, once: true, pages: [
    L('Дарен Грей. Охочусь на чудовищ за деньги. Здесь чудовищ хватает, а денег — нет. Забавный город.', "Daren Grey. I hunt monsters for coin. Plenty of monsters here, not much coin. Funny town."),
    L('Если понадобится лишний меч внизу — ставь выпивку. Потом, может, и сдружимся.', "If you need an extra blade down below — buy me a drink. Maybe later we'll be friends."),
  ] },
  { id: 'daren_d1', npc: 'daren', priority: 1, pages: [L('Лучший трофей — тот, что не пытался тебя убить. Таких не бывает.', "The best trophy is one that didn't try to kill you. There are none.")] },
  { id: 'theo_meet', npc: 'theo', priority: 100, once: true, pages: [
    L('Мир вам. Брат Тео, послушник. Епископ велел мне молиться за вас. Я молюсь. Но иногда… иногда я не уверен, кому.', "Peace be with you. Brother Theo, acolyte. The Bishop told me to pray for you. I do. But sometimes… sometimes I'm not sure to whom."),
  ] },
  { id: 'theo_d1', npc: 'theo', priority: 1, pages: [L('Свет, который нужно охранять ложью, — это ещё Свет?', 'Is a light that must be guarded by lies still a Light?')] },
  { id: 'erik_meet', npc: 'erik', priority: 100, once: true, pages: [
    L('Эй! Ты тот самый! Я Эрик, сын Хильды. Мама говорит, мне быть кузнецом, а я хочу быть героем, как ты. Ну, может, как ты, только без смертей.', "Hey! You're the one! I'm Erik, Hilda's son. Mum says I'm to be a smith, but I want to be a hero like you. Well, like you, minus the dying."),
  ] },
  { id: 'erik_d1', npc: 'erik', priority: 1, pages: [L('Смотри, какой я щит выковал! Ну, почти выковал. Мама доделала.', 'Look at the shield I forged! Well, almost forged. Mum finished it.')] },
  { id: 'mortimer_q', npc: 'mortimer', priority: 50, once: true, when: (h) => met(h, 'mortimer_meet'), pages: [
    L('Церкви нужны кости из катакомб, дитя. Пятнадцать. Мы погребём их с честью, как положено.', 'The Church needs bones from the catacombs, child. Fifteen. We shall bury them with honour, as is proper.'),
  ], choices: [quest('q_church_bones'), bye] },
  { id: 'bran_q_guards', npc: 'bran', priority: 50, once: true, when: (h) => met(h, 'bran_meet') && h.state.dungeon.deepest >= 61, pages: [
    L('Внизу, у Трона, стоят стражи в старой форме. Нашей. Упокой десятерых — они заслужили покой больше, чем мы.', 'Below, by the Throne, stand guards in old uniforms. Ours. Put ten to rest — they deserve peace more than we do.'),
  ], choices: [quest('q_watch_guards'), bye] },
]);

// ─────────────── Сказки бабушки Улы (раз в неделю) ───────────────
const TALES: Loc[][] = [
  [L('Жил-был король, который съел темноту. Все думали — он стал тёмным. А он просто держал её внутри, как ребёнок держит страшный секрет, чтобы другие спали спокойно.', 'Once there was a king who ate the dark. Everyone thought he had become dark. But he only held it inside, the way a child holds a scary secret so others can sleep.'),
    L('Сказка кончается так: «И ждал он, когда придут его сменить». А кто пришёл — я не знаю. Моя бабушка тоже не знала.', 'The tale ends: "And he waited for someone to come and relieve him." Who came — I don\'t know. My grandmother didn\'t either.')],
  [L('Четыре гостя ушли с пира, обещая вернуться. Один унёс хлеб, другой — свечи, третий — золото, четвёртый — ключ от двери. Хозяин ждёт их до сих пор. Стол накрыт.', 'Four guests left the feast, promising to return. One took the bread, another the candles, the third the gold, the fourth the key to the door. The host is waiting still. The table is set.')],
  [L('Девочка с колосками на платье ушла из-под горы и спрятала свои колоски в медальон, чтобы никто не узнал её. Но колоски всё равно прорастают. Всегда прорастают.', 'A girl with wheat on her dress left the mountain and hid her wheat in a locket so no one would know her. But wheat always sprouts. It always does.')],
  [L('Гномы-кузнецы выковали семь ключей и раздали их верным. Восьмой ключ — ключ смены — они отдали огню, чтобы тот хранил его, пока не придёт храбрый. Огонь — хороший сторож. Он не спит.', 'The dwarven smiths forged seven keys and gave them to the loyal. The eighth key — the key of relief — they gave to the fire to keep until the brave one came. Fire is a good watchman. It never sleeps.')],
];
registerLines(TALES.map<DLine>((pages, i) => ({
  id: `ula_tale_${i}`, npc: 'ula', priority: 20,
  when: (h) => met(h, 'ula_meet') && Math.floor((h.state.time.totalDays - 1) / 7) % TALES.length === i && !h.flag(`ula_week_${Math.floor((h.state.time.totalDays - 1) / 7)}`),
  pages,
  onEnd: (h) => h.setFlag(`ula_week_${Math.floor((h.state.time.totalDays - 1) / 7)}`),
})));
registerLines([{ id: 'ula_d1', npc: 'ula', priority: 1, pages: [L('Приходи через недельку, внучок. Новая сказка ещё не дозрела.', "Come back in a week, dearie. The next tale isn't ripe yet.")] }]);

// ─────────────── Сердечные сцены ───────────────
const heart = (npc: string, n: number, pages: Loc[], extra: Partial<DLine> = {}): DLine => ({
  id: `${npc}_heart${n}`, npc, priority: 80, once: true, when: (h) => hs(h, npc) >= n, pages, onEnd: (h) => h.friendship(npc, 40), ...extra,
});
registerLines([
  heart('mira', 2, [L('Знаете, я редко с кем разговариваю. Книги не перебивают. Но с вами… с вами как-то не хочется, чтобы разговор кончался.', "You know, I rarely talk to anyone. Books don't interrupt. But with you… with you I don't want the conversation to end.")]),
  heart('mira', 4, [L('Я нашла в архиве письмо своей прапрабабки. Она писала: «Никогда не спускайся под склеп». Будто знала. Будто боялась, что мы найдём дорогу домой.', "I found a letter from my great-great-grandmother in the archive. She wrote: \"Never go beneath the crypt.\" As if she knew. As if she feared we'd find the way home.")]),
  heart('mira', 6, [L('Я испекла медовый хлеб по бабушкиному рецепту. Получилось ужасно. Но я хотела, чтобы вы попробовали первым. …Ну как? Только честно. Нет, не надо честно.', "I baked honey bread from grandmother's recipe. It came out terrible. But I wanted you to taste it first. …Well? Honestly. No, don't be honest.")], { onEnd: (h) => { h.friendship('mira', 40); h.give('honey_bread', 2); } }),
  heart('mira', 8, [L('Когда вы уходите вниз, я сижу у окна архива и считаю фонари. Если вы не возвращаетесь до последнего — я иду к склепу. Йорн уже привык. Говорит, я как собака у двери.', "When you go below, I sit by the archive window counting lanterns. If you're not back by the last one, I walk to the crypt. Yorn's used to it. Says I'm like a dog by the door.")]),
  heart('mira', 10, [L('{hero}. Что бы там ни было внизу — король, Голод, правда, — я хочу встретить это рядом с вами. Не в архиве. Рядом.', "{hero}. Whatever waits below — the king, the Hunger, the truth — I want to face it beside you. Not in the archive. Beside you.")]),
  heart('kai', 4, [L('Капитан говорит, я слишком много спрашиваю. А я просто хочу понять, от чего мы защищаем город. Ты ведь понимаешь? Ты там был.', "The Captain says I ask too many questions. I just want to understand what we're protecting the town from. You get it, right? You've been down there.")]),
  heart('kai', 6, [L('Я тренировался с копьём до рассвета. Хочу однажды спуститься с тобой — не как обуза. Как напарник.', "I trained with the spear till dawn. Someday I want to go down with you — not as a burden. As a partner.")]),
  heart('lis', 4, [L('Знаешь, почему я скупщица? Потому что вещи честнее людей. Им всё равно, кто их держит. …Но тебе, кажется, не всё равно.', "Know why I'm a fence? Because things are more honest than people. They don't care who holds them. …But you seem to care."), L('Держи. Это не краденое. Почти.', "Here. It's not stolen. Mostly.")], { onEnd: (h) => { h.friendship('lis', 40); h.give('ring'); } }),
  heart('lis', 6, [L('Кроу платят мне за молчание. Я молчу о многом. Но тебе расскажу одно: в подвалах Торгового дома лежит королевская корона. Настоящая. Они держат её триста лет.', "The Crowes pay me for silence. I keep quiet about a lot. But I'll tell you one thing: in the Trading House cellars lies a royal crown. The real one. They've kept it for three hundred years.")]),
  heart('theo', 4, [L('Я читал Книгу Света тысячу раз. На тысяча первый я заметил, что в ней нет ни одного имени простых людей. Только святые и демоны. А где все остальные?', "I've read the Book of Light a thousand times. On the thousand-and-first I noticed it doesn't name a single ordinary person. Only saints and demons. Where is everyone else?")]),
  heart('theo', 6, [L('Сегодня я молился не Свету. Я молился за короля под Троном. Если это ересь — пусть. Кто-то же должен.', "Today I didn't pray to the Light. I prayed for the king beneath the Throne. If that's heresy — so be it. Someone has to.")]),
  heart('nisa', 4, [L('Тётя говорит, сила Круга — от сердцекамня. А я провела опыт: камень бьётся. Как сердце. Как будто внутри кто-то живой. Мне стало страшно впервые в жизни.', "Auntie says the Circle's power comes from heartstone. I ran an experiment: the stone beats. Like a heart. As if something alive is inside. I was scared for the first time in my life.")]),
  heart('nisa', 6, [L('Если окажется, что наша магия построена на чьей-то боли — я от неё откажусь. Даже если это значит больше никогда ничего не поджечь. …Ну, почти никогда.', "If it turns out our magic is built on someone's pain — I'll give it up. Even if it means never setting anything on fire again. …Well, almost never.")]),
  heart('erik', 4, [L('Мама вчера сказала, что гордится мной. Первый раз. Из-за щита, который я выковал для тебя. Так что… спасибо, что ты есть.', "Mum said yesterday she's proud of me. First time ever. Because of the shield I forged for you. So… thanks for being around.")]),
  heart('erik', 6, [L('Я решил: буду кузнецом. Не потому что мама велит. Потому что хочу ковать оружие для таких, как ты. Это тоже геройство, да?', "I've decided: I'll be a smith. Not because Mum says so. Because I want to forge weapons for people like you. That's heroic too, right?")]),
  heart('veila', 4, [L('Я посадила у реки светогриб, который ты принёс. Он не светится. Наверное, забыл солнце. Буду напоминать ему каждый день.', "I planted the glowshroom you brought by the river. It doesn't glow. It must have forgotten the sun. I'll remind it every day.")]),
  heart('veila', 6, [L('Бабушка сказала, что ты «хороший человек, хоть и пахнешь склепом». От неё это почти признание в любви. От меня… ну, тоже почти.', "Granny said you're \"a good person, even if you smell of the crypt\". From her that's almost a declaration of love. From me… well, almost too.")]),
  heart('sebastian', 4, [L('Все думают, я наследник империи. А я наследник склада с украденным золотом. Смешно, правда? Нет. Не смешно.', "Everyone thinks I'm heir to an empire. I'm heir to a warehouse of stolen gold. Funny, isn't it? No. Not funny.")]),
  heart('sebastian', 6, [L('Я перестал носить фамильный перстень. Матушка заметила. Мы не разговариваем третий день. Лучшие три дня в моей жизни.', "I've stopped wearing the family signet ring. Mother noticed. We haven't spoken in three days. The best three days of my life.")]),
  heart('eloise', 4, [L('Я сочинила песню про тебя. Первый куплет про катакомбы, второй — про шахты. Третий пока пустой. Не умирай, ладно? Мне нужен финал получше.', "I wrote a song about you. First verse about the catacombs, second about the mines. The third is still empty. Don't die, all right? I need a better ending.")]),
  heart('eloise', 6, [L('Спела вчера в таверне балладу о короле, который съел темноту. Все плакали. Даже Дарен. Особенно Дарен.', "Last night I sang the ballad of the king who ate the dark at the tavern. Everyone cried. Even Daren. Especially Daren.")]),
  heart('daren', 4, [L('У меня была дочь. Далеко отсюда. Чудовища не спрашивают, чья она. …Я не рассказываю это людям. Считай, что ты не человек, а собутыльник.', "I had a daughter. Far from here. Monsters don't ask whose she is. …I don't tell people this. Consider yourself not a person but a drinking companion.")]),
  heart('daren', 6, [L('Король под Троном тоже чей-то отец. Если он ждёт, чтобы кто-то пришёл, — я пойду с тобой. Хоть раз хочу прийти вовремя.', "The king beneath the Throne is someone's father too. If he's waiting for someone to come — I'll go with you. Just once I want to arrive in time.")]),
  heart('hilda', 4, [L('Держи. Точильный камень моего отца. Не благодари — просто не затупи.', "Here. My father's whetstone. Don't thank me — just don't go blunt.")], { onEnd: (h) => { h.friendship('hilda', 40); h.give('copper_bar', 3); } }),
  heart('yorn', 4, [L('Твой дед сидел на этой самой лавке и говорил: «Йорн, я найду, кто там поёт внизу». Не нашёл. Ты найдёшь. Я это вижу.', "Your grandfather sat on this very bench and said: \"Yorn, I'll find who's singing down there.\" He didn't. You will. I can see it.")]),
  heart('borin', 4, [L('Хррм. Выпьем. За тех, кто остался внизу. Их там больше, чем ты думаешь.', 'Hrrm. Let\'s drink. To those who stayed below. There are more of them than you think.')]),
]);

// ─────────────── Романтика: лента, амулет, брак ───────────────
registerLines([
  {
    id: 'ribbon_hint', npc: 'marta', priority: 30, once: true, when: (h) => Object.keys(h.state.npcs).some((n) => h.hearts(n) >= 8),
    pages: [L('Солнце, у тебя такое лицо, будто ты влюблён(а). Серебряную ленту — дарят на помолвку перед помолвкой. Продаю, между прочим. А Ливия продаёт амулеты клятвы, если дело зайдёт дальше.', "Sunshine, you've got that face — like you're in love. A silver ribbon — it's given as the promise before a promise. I sell them, by the way. And Livia sells oath amulets, if things go further.")],
  },
]);

// ─────────────── После финала ───────────────
const post = (npc: string, e: 'restore' | 'free' | 'take' | 'bad', pages: Loc[]): DLine => ({ id: `${npc}_post_${e}`, npc, priority: 85, once: true, when: (h) => ending(h) === e, pages });
registerLines([
  post('mira', 'restore', [L('Печать держит. Город празднует. А я слышу его дыхание по ночам — даже здесь, наверху. Может, это просто ветер.', "The Seal holds. The town celebrates. And I hear his breathing at night — even up here. Maybe it's just the wind.")]),
  post('mira', 'free', [L('Он узнал меня. Последнее, что он вспомнил, — лицо Элиссы. У меня её глаза, он сказал. Спасибо, что дал мне прийти вовремя.', "He recognised me. The last thing he remembered was Elissa's face. I have her eyes, he said. Thank you for letting me arrive in time.")]),
  post('mira', 'bad', [L('Он свободен. И пуст. И где-то на юге растёт тень. Мы что-то сделали не так. Мы — вместе.', "He's free. And empty. And somewhere to the south a shadow grows. We did something wrong. Together.")]),
  post('bran', 'free', [L('Орден присягнул памяти короля. Впервые за триста лет я знаю, кому служу.', "The Order has sworn to the king's memory. For the first time in three hundred years I know whom I serve.")]),
  post('bran', 'restore', [L('Ты выбрал порядок. Я понимаю. Но письмо Эдмунда я теперь перечитываю каждую ночь.', "You chose order. I understand. But I reread Edmund's letter every night now.")]),
  post('mortimer', 'restore', [L('Свет победил! Книга получит новую главу, а вы — место в ней. Среди святых, дитя моё.', 'The Light has triumphed! The Book shall gain a new chapter, and you a place in it. Among the saints, my child.')]),
  post('mortimer', 'free', [L('Вы… разрушили всё. Всё, во что верил Вальмарк. …И всё же люди в храме теперь молятся дольше. И искреннее. Я не понимаю, почему.', 'You… destroyed everything. Everything Valmark believed. …And yet people in the temple now pray longer. And more sincerely. I do not understand why.')]),
  post('yorn', 'restore', [L('Внизу снова тихо. Слишком тихо. Я привык к пению, знаешь ли.', "It's quiet below again. Too quiet. I'd got used to the singing, you know.")]),
  post('yorn', 'free', [L('Пение внизу кончилось. А вчера я видел во сне твоего деда. Он смеялся. Давно я не видел, как он смеётся.', "The singing below has stopped. And last night I dreamt of your grandfather. He was laughing. I hadn't seen him laugh in a long time.")]),
  post('isolde', 'take', [L('Ритуал Круга — наш долг перед вами. Раз в сезон. Не больше. Не просите больше — сердцекамень теперь бьётся вашим сердцем.', "The Rite of the Circle is our debt to you. Once a season. No more. Don't ask for more — the heartstone now beats with your heart.")]),
  post('borin', 'free', [L('Кузни снова горят! Мой клан спускается домой. Хррм. Ты… ты герой, человек. Выпьем.', "The forges burn again! My clan is going home. Hrrm. You… you're a hero, human. Let's drink.")]),
]);

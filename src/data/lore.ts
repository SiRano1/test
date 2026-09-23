import { L, type Loc } from './loc';

export interface LoreDef {
  id: string;
  floor: number;
  kind: 'note' | 'fresco' | 'diary';
  title: Loc;
  text: Loc;
}

export const LORE: LoreDef[] = [
  // ── Ярус I: Катакомбы ──
  {
    id: 'epitaph', floor: 2, kind: 'fresco',
    title: L('Эпитафия основателя', "A Founder's Epitaph"),
    text: L(
      '«Здесь покоится Ансельм Вейл, что одолел Короля-Демона и вывел народ к свету. Год Пепла — 41-й год Вальмарка».\n\nНиже, другим резцом, кто-то выбил: «Лжец».\n\nСтранно: на соседней плите указан другой год смерти того же Ансельма.',
      '"Here lies Anselm Vale, who vanquished the Demon King and led the people into the light. Year of Ash — 41st year of Valmark."\n\nBelow, carved by a different chisel: "Liar."\n\nOdd: the next slab gives a different year of death for the same Anselm.',
    ),
  },
  {
    id: 'gravedigger', floor: 4, kind: 'diary',
    title: L('Дневник могильщика Тобиаса', "Gravedigger Tobias's Diary"),
    text: L(
      '«Третий раз за месяц. Кости из нижнего склепа лежат иначе, чем я их оставил. Будто кто-то перекладывал их ночью… все черепа смотрят в одну сторону. Вниз. К Трону.\n\nЕпископ велел молчать и не спускаться ниже пятой лестницы. Я и не спускаюсь. Но я слышу, как там кто-то поёт».',
      '"Third time this month. The bones in the lower crypt lie differently than I left them. As if someone rearranged them at night… every skull faces the same way. Down. Toward the Throne.\n\nThe Bishop told me to keep quiet and not to go below the fifth stair. I don\'t. But I hear someone singing down there."',
    ),
  },
  {
    id: 'kneeling', floor: 6, kind: 'fresco',
    title: L('Фреска «Коленопреклонённый»', 'Fresco: "The Kneeling One"'),
    text: L(
      'Выцветшая фреска. Человек в короне стоит на коленях, в сложенных ладонях — чёрное пламя. Вокруг люди и гномы. Их лица не искажены страхом — они скорбят.\n\nКто-то соскоблил лицо короля, но корону оставил.',
      'A faded fresco. A crowned man kneels, cupping black flame in his hands. Around him stand humans and dwarves. Their faces are not twisted with fear — they are grieving.\n\nSomeone scraped away the king\'s face, but left the crown.',
    ),
  },
  {
    id: 'unsigned', floor: 8, kind: 'note',
    title: L('Записка без подписи', 'An Unsigned Note'),
    text: L(
      '«Если ты читаешь это — Печать трещит, и мёртвые снова ходят. Не верь Книге Света. Она написана теми, кто остался наверху.\n\nСпроси воду в шахтах. Вода помнит, кто открыл шлюзы».',
      '"If you are reading this, the Seal is cracking and the dead walk again. Do not trust the Book of Light. It was written by those who stayed above.\n\nAsk the water in the mines. Water remembers who opened the sluices."',
    ),
  },
  // ── Ярус II: Затопленные шахты ──
  {
    id: 'gorm_log', floor: 12, kind: 'diary',
    title: L('Журнал бригадира Горма', "Foreman Gorm's Log"),
    text: L(
      '«Приказ сверху: заложить штольни. Но внизу ещё наши — сорок душ, и гномы Бродрика с ними. Гномы говорят, король ждёт смены. Что нельзя оставлять его одного.\n\nЯ не стану закладывать штольни, пока не выйдет последний».',
      '"Orders from above: seal the adits. But our people are still below — forty souls, and Brodrik\'s dwarves with them. The dwarves say the king awaits his relief. That he must not be left alone.\n\nI will not seal the adits until the last one is out."',
    ),
  },
  {
    id: 'flood_order', floor: 15, kind: 'note',
    title: L('Приказ о затоплении', 'The Flood Order'),
    text: L(
      '«Во имя безопасности выживших: открыть верхние шлюзы. Никто не должен вернуться к Трону. Никто.\n\n— Э. Х., капитан гвардии»\n\nПечать внизу — щит с поднятым мечом. Такой же висит над воротами казарм Вальмарка.',
      '"For the safety of the survivors: open the upper sluices. No one is to return to the Throne. No one.\n\n— E. H., Captain of the Guard"\n\nThe seal below is a shield with a raised sword. The same one hangs over the gates of Valmark\'s barracks.',
    ),
  },
  {
    id: 'scratched', floor: 17, kind: 'fresco',
    title: L('Нацарапано на стене', 'Scratched Into the Wall'),
    text: L(
      'Неровные буквы, выцарапанные чем-то острым, может быть, ногтями:\n\n«МЫ ШЛИ К НЕМУ. ОНИ ОТКРЫЛИ ШЛЮЗЫ».\n\nРядом — сорок чёрточек. Последняя не закончена.',
      'Uneven letters, scratched with something sharp — perhaps fingernails:\n\n"WE WERE GOING TO HIM. THEY OPENED THE SLUICES."\n\nBeside it, forty tally marks. The last one is unfinished.',
    ),
  },
  {
    id: 'doll', floor: 19, kind: 'note',
    title: L('Кукла с биркой', 'A Tagged Doll'),
    text: L(
      'Тряпичная кукла в платье с узором из переплетённых колосьев. К руке привязана бирка: «Для Элиссы. С днём рождения, звёздочка. — Папа».\n\nКукла сухая. Кто-то уносил её с собой, пока вода не поднялась.',
      'A rag doll in a dress embroidered with intertwined wheat ears. A tag is tied to its wrist: "For Elissa. Happy birthday, little star. — Papa."\n\nThe doll is dry. Someone kept it close until the water rose.',
    ),
  },
  // ── Ярус III: Грибной лес ──
  {
    id: 'gardener', floor: 22, kind: 'diary',
    title: L('Дневник королевского садовника', "The Royal Gardener's Diary"),
    text: L(
      '«Принцесса Элисса снова спрятала рыбку в фонтане. Король сделал вид, что не заметил, и весь вечер «искал» её с ней вместе.\n\nСегодня он долго стоял у светогрибов и сказал: «Если мне придётся уйти вниз, пусть сад растёт. Пусть ей будет где прятаться»».',
      '"Princess Elissa hid a fish in the fountain again. The King pretended not to notice and spent the whole evening \'searching\' for it with her.\n\nToday he stood a long time by the glowshrooms and said: \'If I must go below, let the garden grow. Let her have somewhere to hide.\'"',
    ),
  },
  {
    id: 'king_daughter', floor: 25, kind: 'fresco',
    title: L('Фреска «Король и дочь»', 'Fresco: "The King and His Daughter"'),
    text: L(
      'Мозаика почти цела. Король — без короны, в простой рубахе — держит на руках девочку. На её платье вышиты колосья, сплетённые в косу.\n\nВнизу подпись: «Хальвард и Элисса. Праздник первого урожая».\n\nНикакого демона. Никаких черепов. Только отец и дочь.',
      'The mosaic is almost whole. The King — without a crown, in a plain shirt — holds a little girl. Her dress is embroidered with wheat ears woven into a braid.\n\nBelow, an inscription: "Halvard and Elissa. Feast of the First Harvest."\n\nNo demon. No skulls. Just a father and his daughter.',
    ),
  },
  {
    id: 'halvard_letter', floor: 27, kind: 'note',
    title: L('Письмо Хальварда', "Halvard's Letter"),
    text: L(
      '«Ансельм, Сорайя, Гаспар, Эдмунд.\n\nЯ беру Голод в себя. Печать удержит его, пока я держусь. Через сто лет пришлите сменщика — добровольца, и расскажите ему правду.\n\nЕсли меня не сменят, пусть хотя бы помнят, что я не выбирал тьму — я выбрал вас.\n\n— Хальвард»',
      '"Anselm, Soraya, Gaspar, Edmund.\n\nI am taking the Hunger into myself. The Seal will hold it as long as I hold. In a hundred years, send a relief — a volunteer — and tell them the truth.\n\nIf I am not relieved, let them at least remember that I did not choose the dark — I chose you.\n\n— Halvard"',
    ),
  },
  {
    id: 'spore_song', floor: 29, kind: 'note',
    title: L('Споровая запись', 'The Spore Recording'),
    text: L(
      'Грибница впитала звук. Когда ты касаешься её, из спор доносится пение — сотни голосов на незнакомом языке. Один голос звучит ближе остальных. Ребёнок:\n\n«Папа, а ты вернёшься к празднику?»\n\nПение обрывается.',
      'The mycelium soaked up the sound. When you touch it, singing drifts from the spores — hundreds of voices in an unknown tongue. One voice is closer than the rest. A child:\n\n"Papa, will you be back for the feast?"\n\nThe singing stops.',
    ),
  },
  // ── Ярус IV: Кузни гномов ──
  {
    id: 'brodrik_ledger', floor: 32, kind: 'diary',
    title: L('Гроссбух Бродрика', "Brodrik's Ledger"),
    text: L(
      '«Семь осколков. Сталь, закалённая в сердцекамне. Каждый отдан верному: Настоятелю, Горму, Матери сада, мне, Хранителю книг, Серафиму. Седьмой король держит сам.\n\nМы стражи, не тюремщики. Мы ждём смену вместе с ним».',
      '"Seven shards. Steel quenched in heartstone. Each given to one who is loyal: the Abbot, Gorm, the Mother of the garden, myself, the Keeper of books, the Seraph. The seventh the King holds himself.\n\nWe are wardens, not jailers. We wait for the relief alongside him."',
    ),
  },
  {
    id: 'dwarf_oath', floor: 35, kind: 'fresco',
    title: L('Клятва гномов', 'The Dwarven Oath'),
    text: L(
      'Руны, выбитые в базальте над горном:\n\n«ТРОНУ — ДО ПОСЛЕДНЕЙ ИСКРЫ.\nКОРОЛЮ — ДО ПОСЛЕДНЕГО ВЗДОХА.\nСМЕНЕ — ДВЕРЬ И ФАКЕЛ».\n\nПоследняя строка затёрта чьим-то сапогом, но ещё читается.',
      'Runes cut into basalt above the forge:\n\n"TO THE THRONE — UNTIL THE LAST SPARK.\nTO THE KING — UNTIL THE LAST BREATH.\nTO THE RELIEF — A DOOR AND A TORCH."\n\nThe last line has been scuffed by someone\'s boot, but can still be read.',
    ),
  },
  {
    id: 'seal_blueprint', floor: 37, kind: 'note',
    title: L('Чертёж Печати', 'Blueprint of the Seal'),
    text: L(
      'Оригинальная схема Печати: семь осколков по кругу, в центре — Трон. У Трона нарисован второй силуэт с подписью «сменщик» и механизм: «замок смены».\n\nНа полях — изящный почерк: «Убрать замок смены. Печать станет вечной. Носитель не умрёт, пока держит. — С. Р.»',
      'The original design of the Seal: seven shards in a circle, the Throne at the centre. Beside the Throne, a second silhouette labelled "relief" and a mechanism: "the relay lock."\n\nIn the margin, in an elegant hand: "Remove the relay lock. The Seal becomes eternal. The bearer will not die while he holds. — S. R."',
    ),
  },
  {
    id: 'farewell_rune', floor: 39, kind: 'fresco',
    title: L('Прощальная руна', 'The Farewell Rune'),
    text: L(
      '«Люди наверху закрыли шлюзы. Сменщик не придёт.\n\nМы запечатываем кузни изнутри, чтобы Голод не нашёл дорогу через наши горны. Пусть хоть это мы сделаем правильно.\n\nКто прочтёт — скажи нашему королю, что мы не ушли»',
      '"The people above have closed the sluices. The relief will not come.\n\nWe are sealing the forges from within, so the Hunger cannot find its way through our furnaces. Let us at least do this right.\n\nWhoever reads this — tell our King we did not leave."',
    ),
  },
  // ── Ярус V: Ледяная библиотека ──
  {
    id: 'chronicle_1', floor: 42, kind: 'diary',
    title: L('Подлинная летопись, том I', 'The True Chronicle, Volume I'),
    text: L(
      '«В год Тихого слоя шахтёры услышали шёпот. Он называл их по именам и просил глубже. То был Голод — не зверь и не бог, а пустота, что ест жизнь и память.\n\nКороль Хальвард принял его в себя по доброй воле. Ритуал Сдерживания устроен как эстафета: носитель держит век, затем его сменяет доброволец. Так будет, пока Голод не изголодается совсем».',
      '"In the year of the Silent Layer the miners heard a whisper. It called them by name and asked them deeper. It was the Hunger — neither beast nor god, but an emptiness that eats life and memory.\n\nKing Halvard took it into himself of his own will. The Rite of Containment is built as a relay: the bearer holds for a century, then a volunteer relieves him. So it shall be until the Hunger starves at last."',
    ),
  },
  {
    id: 'archivist', floor: 45, kind: 'diary',
    title: L('Дневник архивариуса', "The Archivist's Diary"),
    text: L(
      '«Сорайя забрала ключи от зала Печати. Ансельм сжигает книги во дворе — я слышу, как трещит пергамент.\n\nЯ спрятал летопись в ледник. Холод сохранит её лучше, чем люди. Если ты читаешь это, значит, лёд ещё держит. Не дай им сжечь её второй раз».',
      '"Soraya has taken the keys to the Hall of the Seal. Anselm is burning books in the courtyard — I can hear the parchment crackle.\n\nI have hidden the chronicle in the glacier. The cold will keep it better than people will. If you are reading this, the ice still holds. Do not let them burn it a second time."',
    ),
  },
  {
    id: 'chronicle_2', floor: 47, kind: 'diary',
    title: L('Подлинная летопись, том II', 'The True Chronicle, Volume II'),
    text: L(
      '«Четверо вывели народ наверх: жрец Ансельм Вейл, чародейка Сорайя Ренн, казначей Гаспар Кроу, капитан Эдмунд Холлоуэй.\n\nОни поклялись прислать смену. Не прислали. Сорайя изменила Печать. Гаспар вывез казну. Ансельм написал Книгу Света. Эдмунд открыл шлюзы.\n\nПринцесса Элисса ушла с беженцами под именем Холт».\n\nТы бережно забираешь том с собой.',
      '"Four led the people up: the priest Anselm Vale, the sorceress Soraya Renn, the treasurer Gaspar Crowe, the captain Edmund Holloway.\n\nThey swore to send the relief. They did not. Soraya altered the Seal. Gaspar carried off the treasury. Anselm wrote the Book of Light. Edmund opened the sluices.\n\nPrincess Elissa left with the refugees under the name Holt."\n\nYou carefully take the volume with you.',
    ),
  },
  {
    id: 'ice_mirror', floor: 49, kind: 'fresco',
    title: L('Ледяное зеркало', 'The Ice Mirror'),
    text: L(
      'В толще льда застыло видение: девушка в дорожном плаще оглядывается на тёмный зев шахты. На шее у неё медальон — колосья, сплетённые в косу.\n\nОна что-то шепчет. По губам можно прочесть: «Я вернусь за тобой, папа».\n\nОна не вернулась. Но её правнучка правнучки, похоже, ищет дорогу.',
      'A vision is frozen in the depth of the ice: a young woman in a travelling cloak looks back at the dark mouth of the mine. Around her neck — a locket of wheat ears woven into a braid.\n\nShe whispers something. You can read her lips: "I\'ll come back for you, Papa."\n\nShe never did. But it seems her great-great-granddaughter is looking for the way.',
    ),
  },
  // ── Ярус VI: Пылающий собор ──
  {
    id: 'confession', floor: 52, kind: 'diary',
    title: L('Исповедь Ансельма', "Anselm's Confession"),
    text: L(
      '«Я написал ложь, чтобы люди спали спокойно. Народу нужен враг под ногами и святые над головой. Я дал им и то, и другое.\n\nБог простит. Король — нет.\n\nЯ трижды велел хоронить себя под чужими датами, чтобы никто не нашёл, где я лежу на самом деле. Я здесь. В его соборе. Пусть хоть пепел мой будет рядом с ним».',
      '"I wrote a lie so that people could sleep soundly. A people needs an enemy beneath its feet and saints above its head. I gave them both.\n\nGod will forgive. The King will not.\n\nThree times I had myself buried under false dates, so no one would find where I truly lie. I am here. In his cathedral. Let at least my ashes be near him."',
    ),
  },
  {
    id: 'rite_fresco', floor: 55, kind: 'fresco',
    title: L('Фреска Ритуала', 'Fresco of the Rite'),
    text: L(
      'Огромная роспись над алтарём: семеро стражей стоят кругом, каждый держит осколок. В центре — король на троне, чёрное пламя в груди.\n\nРядом с троном — пустое место, очерченное золотом. Над ним написано: «Здесь встанет тот, кто придёт на смену».\n\nЗолото не потускнело за триста лет.',
      'An enormous painting above the altar: seven wardens stand in a circle, each holding a shard. At the centre, the King on his throne, black flame in his chest.\n\nBeside the throne, an empty space outlined in gold. Above it is written: "Here shall stand the one who comes as relief."\n\nThe gold has not tarnished in three hundred years.',
    ),
  },
  {
    id: 'silence_pact', floor: 57, kind: 'note',
    title: L('Пакт молчания', 'The Pact of Silence'),
    text: L(
      '«Мы, Четверо, клянёмся: правда о Троне умрёт с нами. Наши дети будут знать Короля-Демона. Смена не будет послана — сердцекамень питает Круг, казна кормит город, а город молится Свету.\n\nАнсельм. Сорайя. Гаспар.»\n\nЧетвёртая подпись вырезана ножом. Остались лишь буквы «Э. Х.» — и приписка: «Я не подпишу. Но и не остановлю вас. Да простит меня моя стража».',
      '"We, the Four, swear: the truth of the Throne dies with us. Our children shall know the Demon King. No relief will be sent — heartstone feeds the Circle, the treasury feeds the town, and the town prays to the Light.\n\nAnselm. Soraya. Gaspar."\n\nThe fourth signature has been cut out with a knife. Only the letters "E. H." remain — and a postscript: "I will not sign. But neither will I stop you. May my Watch forgive me."',
    ),
  },
  {
    id: 'relay_key', floor: 59, kind: 'note',
    title: L('Ключ эстафеты', 'The Relay Key'),
    text: L(
      'На алтаре лежит ключ из сердцекамня, тёплый, как ладонь. Рядом табличка: «Замок смены. Тот, кто вложит ключ в Трон, примет ношу добровольно».\n\nСорайя убрала замок из Печати. Но ключ, похоже, выбросить не смогла.\n\nТы забираешь ключ.',
      'On the altar lies a key of heartstone, warm as a palm. Beside it, a plaque: "The relay lock. Whoever sets the key into the Throne takes up the burden of their own will."\n\nSoraya removed the lock from the Seal. But it seems she could not bring herself to throw away the key.\n\nYou take the key.',
    ),
  },
  // ── Ярус VII: Тронный зал ──
  {
    id: 'letter_1', floor: 62, kind: 'note',
    title: L('Письмо дочери, первое', 'First Letter to His Daughter'),
    text: L(
      '«Звёздочка моя. Здесь внизу темно, но я вижу тебя каждую ночь, когда закрываю глаза. Ты, наверное, уже умеешь читать сама. Не обижай садовника — он любит тебя почти так же, как я».',
      '"My little star. It is dark down here, but I see you every night when I close my eyes. You can probably read on your own by now. Don\'t tease the gardener — he loves you almost as much as I do."',
    ),
  },
  {
    id: 'letter_2', floor: 64, kind: 'note',
    title: L('Письмо дочери, второе', 'Second Letter to His Daughter'),
    text: L(
      '«Прошло, наверное, лет двадцать. Я считаю по биению Голода — оно замедляется, когда наверху зима. Ты, должно быть, уже замужем. Надеюсь, он добрый. Надеюсь, ты не ищешь меня».',
      '"Perhaps twenty years have passed. I count by the beating of the Hunger — it slows when it is winter above. You must be married by now. I hope he is kind. I hope you are not looking for me."',
    ),
  },
  {
    id: 'letter_3', floor: 66, kind: 'note',
    title: L('Письмо дочери, третье', 'Third Letter to His Daughter'),
    text: L(
      '«Смена не пришла. Я больше не жду. Иногда Голод говорит моим голосом, и мне страшно, что однажды он заговорит с тобой. Если услышишь меня во сне — не верь. Это не я».',
      '"The relief has not come. I no longer wait. Sometimes the Hunger speaks in my voice, and I fear that one day it will speak to you. If you hear me in your dreams — do not believe it. It is not me."',
    ),
  },
  {
    id: 'letter_4', floor: 68, kind: 'note',
    title: L('Письмо дочери, последнее', 'Last Letter to His Daughter'),
    text: L(
      '«Я забываю твоё лицо, Элисса. Голод ест память, и он добрался до лучшего. Я помню колосья на твоём платье. Помню, как ты смеялась у фонтана.\n\nЕсли кто-нибудь из твоих детей когда-нибудь дойдёт сюда — пусть не спасает меня. Пусть просто скажет, что ты была счастлива».',
      '"I am forgetting your face, Elissa. The Hunger eats memory, and it has reached the best of mine. I remember the wheat on your dress. I remember how you laughed by the fountain.\n\nIf any of your children ever reach this place — let them not save me. Let them only tell me you were happy."',
    ),
  },
  // ── Особые записи (не из подземелья) ──
  {
    id: 'edmund_letter', floor: 0, kind: 'note',
    title: L('Письмо Эдмунда Холлоуэя', "Edmund Holloway's Letter"),
    text: L(
      '«Тому, кто вскроет это, когда мёртвые снова пойдут.\n\nЯ открыл шлюзы. Сорок человек и гномы Бродрика шли к королю, чтобы сменить его, — и я утопил их, потому что Четверо решили, что город важнее одного короля. Я был трусом.\n\nПечать можно разбить, не выпуская Голод, лишь если рядом с королём встанут те, кому он дорог: кровь его крови и стража, что помнит клятву. Орден — это его гвардия. Вспомните, кому мы присягали.\n\n— Эдмунд»',
      '"To whoever opens this when the dead walk again.\n\nI opened the sluices. Forty people and Brodrik\'s dwarves were going to the King to relieve him — and I drowned them, because the Four decided the town mattered more than one king. I was a coward.\n\nThe Seal can be broken without releasing the Hunger only if those who love the King stand beside him: blood of his blood, and a guard that remembers its oath. The Order is his Guard. Remember to whom we swore.\n\n— Edmund"',
    ),
  },
];

export const LORE_BY_ID: Record<string, LoreDef> = Object.fromEntries(LORE.map((l) => [l.id, l]));
export const loreForFloor = (floor: number) => LORE.find((l) => l.floor === floor);

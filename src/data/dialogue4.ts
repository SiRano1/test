import { registerLines, type DialogueHost as H, type DLine } from '../game/systems/dialogue';
import { festivalNow } from './festivals';
import { L, type Loc } from './loc';
import { NPCS } from './npcs';
import { scheduledNpcs } from './schedules';

// ─────────────── Праздники (GDD §9.7) ───────────────

const on = (h: H, id: string) => festivalNow(h.state)?.id === id;
const bye = { text: L('Пойду погуляю', "I'll look around") };
const after = (h: H, hour: number) => h.state.time.minutes >= hour * 60;

registerLines([
  // ── Турнир рыцарей ──
  {
    id: 'bran_tourney', npc: 'bran', priority: 70, when: (h) => on(h, 'tourney') && !h.fest.did('tourney'),
    pages: [
      L('Весенний турнир! Три раунда: оруженосец, рыцарь с напарником и, если выстоите, — сэр Годрик.', 'The spring tourney! Three rounds: a squire, a knight with a partner and, if you last, Sir Godric.'),
      L('Оружие затуплено, но синяки настоящие. Упадёте — проиграли, никто не умирает. Записать вас?', "Blunted weapons, but the bruises are real. Fall and you lose — nobody dies. Shall I sign you up?"),
    ],
    choices: [
      { text: L('Записывайте. Я готов(а).', "Sign me up. I'm ready."), act: (h) => h.festival('tourney') },
      { text: L('Посмотрю со стороны.', "I'll watch from the side.") },
    ],
  },
  {
    id: 'bran_tourney_done', npc: 'bran', priority: 69, when: (h) => on(h, 'tourney') && h.fest.did('tourney'),
    pages: [L('Песок ещё помнит ваши шаги. На следующую весну — снова к барьеру.', 'The sand still remembers your steps. Next spring — to the lists again.')],
  },
  // ── Ярмарка урожая ──
  {
    id: 'marta_fair', npc: 'marta', priority: 70, when: (h) => on(h, 'fair'),
    pages: [L('Ярмарка! Сегодня за еду и зелья платят втрое, а ещё — конкурс урожая и кольца на удачу.', 'The fair! Food and potions fetch triple today, and there\'s the harvest contest and ring toss.')],
    choices: [
      { text: L('Встать за ярмарочный прилавок', 'Take the fair stall'), act: (h) => h.openShop('fair') },
      { text: L('Выставить лучшее на конкурс', 'Enter my best in the contest'), when: (h) => !h.fest.did('contest'), act: (h) => h.festival('contest') },
      { text: L('Бросить кольца (20 з.)', 'Toss rings (20 g)'), act: (h) => h.festival('rings') },
      bye,
    ],
  },
  // ── Ночь духов ──
  {
    id: 'yorn_spirits', npc: 'yorn', priority: 70, when: (h) => on(h, 'spirits') && !h.fest.did('spirits'),
    pages: [
      L('Фонари зажжены. Раз в год Основатели выходят к ним — все четверо. Я сорок лет слушаю, и ни разу они не сказали мне ничего нового.', 'The lanterns are lit. Once a year the Founders come out to them — all four. Forty years I\'ve listened and they\'ve never told me anything new.'),
      L('А вам, может, скажут. Вы спускались туда, куда они никого не пускали. Найдите всех четверых.', 'But they might tell you. You\'ve gone where they let no one go. Find all four.'),
    ],
  },
  {
    id: 'yorn_spirits_done', npc: 'yorn', priority: 69, when: (h) => on(h, 'spirits') && h.fest.did('spirits'),
    pages: [L('Все четверо заговорили? С вами? …Значит, пришло время. Идите спать, ночь длинная.', 'All four spoke? To you? …Then the time has come. Go to bed, the night is long.')],
  },
  // ── Зимний пир ──
  {
    id: 'ogden_feast', npc: 'ogden', priority: 70, when: (h) => on(h, 'feast'),
    pages: [L('Зимний пир! За общим столом места всем. А ещё — тайный даритель, и в восемь начнутся танцы.', 'The Winter Feast! There\'s room for all at the shared table. And the secret gift-giver — and at eight the dancing begins.')],
    choices: [
      { text: L('Кто мой адресат тайного дарителя?', 'Who is my secret gift recipient?'), act: (h) => h.festival('giver') },
      { text: L('Пригласить на танец', 'Ask for a dance'), when: (h) => after(h, 20) && !h.fest.did('dance'), act: (h) => h.festival('dance') },
      bye,
    ],
  },
]);

// ── Праздничная болтовня всех жителей ──
const CHATTER: Record<string, Loc[]> = {
  tourney: [
    L('Ставлю пять медяков на Годрика. Ну ладно, на вас — три.', "Five coppers on Godric. Fine, three on you."),
    L('Прошлой весной Кай продержался два раунда. Он до сих пор об этом рассказывает.', 'Last spring Kai lasted two rounds. He still talks about it.'),
    L('Смотрите, флажки новые! Бургомистр раскошелился.', 'Look, new pennants! The Mayor opened his purse.'),
  ],
  fair: [
    L('Тыквы Ханны в этом году — с колесо телеги!', "Hanna's pumpkins this year — big as cartwheels!"),
    L('Я выиграл(а) ленту в кольца! Правда, потратил(а) на это сорок золотых.', 'I won a ribbon at the rings! Spent forty gold doing it, mind.'),
    L('Пахнет мёдом и жареными каштанами. Вот ради такого и живём.', 'Smells of honey and roast chestnuts. This is what we live for.'),
  ],
  spirits: [
    L('Говорят, если услышишь всех четверых — узнаешь свою судьбу. Я слышу только ветер.', 'They say if you hear all four, you learn your fate. I only hear the wind.'),
    L('Держись ближе к фонарям. Духи добрые, но холодные.', 'Stay near the lanterns. The spirits are kind, but cold.'),
    L('Бабушка Ула опять рассказывает про Основателей. В этот раз — шёпотом.', 'Granny Ula is telling of the Founders again. Whispering, this time.'),
  ],
  feast: [
    L('Глинтвейн Тильды — лучшее, что случается с Вальмарком зимой.', "Tilda's mulled wine is the best thing that happens to Valmark in winter."),
    L('Мне достался тайный подарок! Шерстяные носки. Идеально.', 'I got a secret gift! Woollen socks. Perfect.'),
    L('Эловиза разучила новую песню. Про вас, между прочим.', 'Eloise learned a new song. About you, as it happens.'),
  ],
};

const chatter: DLine[] = [];
for (const [i, npc] of scheduledNpcs().entries()) {
  if (NPCS[npc]?.speakerOnly) continue;
  for (const [fest, lines] of Object.entries(CHATTER)) {
    chatter.push({ id: `${npc}_fest_${fest}`, npc, priority: 40, when: (h) => on(h, fest), pages: [lines[i % lines.length]!] });
  }
}
registerLines(chatter);

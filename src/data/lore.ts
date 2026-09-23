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
];

export const LORE_BY_ID: Record<string, LoreDef> = Object.fromEntries(LORE.map((l) => [l.id, l]));
export const loreForFloor = (floor: number) => LORE.find((l) => l.floor === floor);

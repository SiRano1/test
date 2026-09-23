import type { GameState } from '../game/state';
import { hearts } from '../game/state';
import { countItem } from '../game/systems/inventory';
import { L, type Loc } from './loc';
import { NPCS } from './npcs';

export type EndingId = 'restore' | 'free' | 'take' | 'bad';

/** Условия финалов (GDD §3.3). */
export function endingConditions(s: GameState) {
  const letter = !!s.flags.edmund_letter_read;
  const chronicle = !!s.flags.chronicle_mira;
  const mira = hearts(s, 'mira') >= 6;
  const watch = s.factions.watch >= 25;
  return {
    letter, chronicle, mira, watch,
    free: letter && chronicle && mira && watch,
    take: countItem(s.inventory, 'relay_key') > 0,
    circle: s.factions.mages >= 75,
  };
}

const spouseLine = (s: GameState): Loc | null => {
  const p = s.romance.partner;
  if (!p || s.romance.stage !== 'married') return null;
  const n = NPCS[p]!.name;
  return L(`${n.ru} каждое утро ставит на стол вторую чашку. Даже когда знает, что вы не придёте.`, `${n.en} sets out a second cup every morning. Even knowing you won't come.`);
};

export function epilogue(id: EndingId, s: GameState): { title: Loc; slides: Loc[] } {
  const c = endingConditions(s);
  const miraClose = hearts(s, 'mira') >= 6;
  switch (id) {
    case 'restore':
      return {
        title: L('Печать восстановлена', 'The Seal Restored'),
        slides: [
          L('Семь осколков встают на место. Свет вспыхивает по кругу, и чёрное пламя в груди короля сжимается в точку. Хальвард закрывает глаза. «Ещё триста лет», — шепчет он. Вы не знаете, благодарность это или приговор.',
            'The seven shards slot into place. Light flares around the circle, and the black flame in the king\'s chest shrinks to a point. Halvard closes his eyes. "Another three hundred years," he whispers. You cannot tell whether it is thanks or a sentence.'),
          L('Мертвецы больше не выходят из склепа. Епископ Мортимер служит благодарственный молебен, и колокола звонят три дня. Книга Света получает новую главу — о герое, что снова одолел Короля-Демона.',
            'The dead no longer rise from the crypt. Bishop Mortimer holds a service of thanksgiving, and the bells ring for three days. The Book of Light gains a new chapter — about the hero who vanquished the Demon King again.'),
          L('Торговый дом Кроу открывает шахты заново. Вальмарк богатеет. На площади ставят вашу статую — рядом со статуями Четырёх.',
            'The House of Crowe reopens the mines. Valmark grows rich. A statue of you is raised on the square — beside the statues of the Four.'),
          miraClose
            ? L('Мира уезжает из Вальмарка весной. На прощание она оставляет вам свою летопись — настоящую. «Кто-то должен помнить», — говорит она.', 'Mira leaves Valmark in the spring. In parting she leaves you her chronicle — the true one. "Someone has to remember," she says.')
            : L('Архив закрывают за ненадобностью. Никто не спрашивает, почему.', 'The archive is closed for lack of use. Nobody asks why.'),
          L('Иногда, спускаясь в склеп, вы слышите внизу чьё-то дыхание. Медленное. Терпеливое.', 'Sometimes, descending into the crypt, you hear someone breathing far below. Slow. Patient.'),
        ],
      };
    case 'free':
      return {
        title: L('Король свободен', 'The King Set Free'),
        slides: [
          L('Аватар Голода распадается, как дым на ветру. Без своего сосуда Голод слабеет — он столько веков ел одного-единственного человека, что разучился охотиться. Печать над пустотой гаснет. Больше некого держать.',
            'The Avatar of the Hunger comes apart like smoke in the wind. Without its vessel the Hunger falters — it spent so many centuries eating one single man that it forgot how to hunt. The Seal over the emptiness goes dark. There is no one left to hold.'),
          L('Хальвард опускается на ступени трона. Мира держит его за руку. «У тебя её глаза», — говорит он. Он узнаёт колосья на её медальоне. Он вспоминает лицо дочери. Это последнее, что он вспоминает.',
            'Halvard sinks onto the steps of the throne. Mira holds his hand. "You have her eyes," he says. He recognises the wheat on her locket. He remembers his daughter\'s face. It is the last thing he remembers.'),
          L('Капитан Бран зачитывает письмо Эдмунда на площади. Толпа молчит. Потом кто-то снимает шапку. Потом ещё кто-то. Орден Стражи впервые за триста лет присягает не городу, а памяти короля.',
            'Captain Bran reads Edmund\'s letter aloud on the square. The crowd is silent. Then someone takes off their hat. Then another. For the first time in three hundred years the Order of the Watch swears not to the town, but to the memory of the king.'),
          L('Эрдхейм можно вернуть. Гномы-изгнанники во главе с Борином спускаются в Кузни и зажигают горны. Сады Грибного леса снова светятся — теперь просто светятся.',
            'Erdheim can be reclaimed. The exiled dwarves, led by Borin, go down to the Forges and light the furnaces. The gardens of the Fungal Forest glow again — now they simply glow.'),
          L('Мира пишет новую летопись. Первая строка: «Он не выбирал тьму. Он выбрал нас».', 'Mira writes a new chronicle. Its first line: "He did not choose the dark. He chose us."'),
        ],
      };
    case 'take':
      return {
        title: L('Смена пришла', 'The Relief Has Come'),
        slides: [
          L('Ключ эстафеты входит в Трон с тихим щелчком — будто замок ждал триста лет. Чёрное пламя переходит из груди Хальварда в вашу. Холодно. Потом — очень тихо.',
            'The relay key slides into the Throne with a quiet click — as if the lock had been waiting three hundred years. The black flame passes from Halvard\'s chest into yours. Cold. Then — very quiet.'),
          L('«Спасибо», — говорит король, и в его голосе нет Голода. Он поднимается по лестнице к свету, которого не видел три века. Наверху его встретит внучка его внучки. Он не узнает её. Это ничего.',
            '"Thank you," says the king, and there is no Hunger in his voice. He climbs the stairs toward a light he has not seen in three centuries. Above, his daughter\'s descendant will meet him. He will not recognise her. That is all right.'),
          c.circle
            ? L('Серый Круг проводит Ритуал Круга. Раз в сезон, в ночь полнолуния, вы можете подняться в Вальмарк — на одну ночь. Вы проводите её в таверне, среди друзей.', 'The Grey Circle performs the Rite of the Circle. Once a season, on the night of the full moon, you may climb up to Valmark — for a single night. You spend it in the tavern, among friends.')
            : L('Вы не можете подняться наверх. Но друзья спускаются к вам — по лифту Борина, с фонарями и корзинами еды. Трон становится самым странным местом для пикников во всём королевстве.', 'You cannot climb up. But your friends come down to you — on Borin\'s lift, with lanterns and baskets of food. The Throne becomes the strangest picnic spot in the whole kingdom.'),
          spouseLine(s) ?? L('Вальмарк помнит вас. Эта память — лучшее лекарство от Голода.', 'Valmark remembers you. That memory is the best medicine against the Hunger.'),
          L('Через сто лет придёт смена. Вы уже написали ей письмо. Первая строка: «Не бойся темноты. Бойся забыть».', 'In a hundred years the relief will come. You have already written them a letter. The first line: "Do not fear the dark. Fear forgetting."'),
        ],
      };
    case 'bad':
    default:
      return {
        title: L('Голод на свободе', 'The Hunger Unbound'),
        slides: [
          L('Печать разбита. Хальвард падает — свободный, но пустой: Голод ушёл из него, не встретив ничего, что удержало бы его рядом. Рядом с королём не оказалось тех, кто его любит.',
            'The Seal is broken. Halvard falls — free, but empty: the Hunger left him and found nothing to hold it near. Those who loved the king were not at his side.'),
          L('Тень поднимается по шахтам и уходит на юг, в Пепельные Пустоши. Там она растёт. Караваны перестают ходить.', 'A shadow rises through the mines and drifts south, into the Ashen Wastes. There it grows. The caravans stop coming.'),
          L('Вальмарк стоит. Люди говорят, что вы спасли город. Вы знаете, что лишь отсрочили беду.', 'Valmark stands. People say you saved the town. You know you only delayed the trouble.'),
          L('Под Тронным залом открылся проход в Бездну. Голод ждёт там. Может быть, однажды вы будете готовы.', 'Beneath the Throne Hall a passage to the Abyss has opened. The Hunger waits there. Perhaps one day you will be ready.'),
        ],
      };
  }
}

/** Реплика Хальварда перед выбором. */
export const THRONE_PAGES: Loc[] = [
  L('…Ты… остановился. Голод отступил — ненадолго. Я снова могу говорить своим голосом. Сколько лет прошло? Не отвечай. Я не хочу знать.',
    '…You… stopped. The Hunger has drawn back — for a little while. I can speak in my own voice again. How many years have passed? Don\'t answer. I don\'t want to know.'),
  L('Ты собрал осколки. Значит, стражи отпустили их тебе. Они были верными. Все они.',
    'You gathered the shards. So the wardens gave them up to you. They were loyal. All of them.'),
  L('Теперь выбирать тебе, как когда-то выбирал я. Печать можно восстановить — и я продержусь ещё. Можно разбить — и если рядом те, кто меня помнит, Голод умрёт вместе со мной. А можно… занять моё место.',
    'Now the choice is yours, as once it was mine. The Seal can be restored — and I will hold a while longer. It can be broken — and if those who remember me stand near, the Hunger will die with me. Or you can… take my place.'),
];

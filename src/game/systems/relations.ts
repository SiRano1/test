import { itemDef } from '../../data/items';
import { L, t, type Loc } from '../../data/loc';
import type { NpcDef } from '../../data/npcs';
import type { GameState, GiftReaction } from '../state';

export const GIFT_POINTS: Record<GiftReaction, number> = { love: 80, like: 45, neutral: 20, dislike: -20, hate: -40 };
export const HEART = 250;
export const MAX_HEARTS = 10;

export function giftReaction(n: NpcDef, item: string): GiftReaction {
  const g = n.gifts;
  if (g.love.includes(item)) return 'love';
  if (g.like.includes(item)) return 'like';
  if (g.hate.includes(item)) return 'hate';
  if (g.dislike.includes(item)) return 'dislike';
  // общие вкусы: еду любят почти все, мусор из подземелья — нет
  const d = itemDef(item);
  if (d.kind === 'food') return 'like';
  if (d.tags?.includes('monster')) return 'dislike';
  return 'neutral';
}

export function isBirthday(s: GameState, n: NpcDef): boolean {
  return s.time.season === n.birthday[0] && s.time.day === n.birthday[1];
}

const LINES: Record<GiftReaction, Loc[]> = {
  love: [L('Это… мне? Откуда ты знал? Я правда тронут(а).', 'This… for me? How did you know? I am truly touched.'), L('Ох! Это же моё любимое! Спасибо, {hero}!', "Oh! That's my favourite! Thank you, {hero}!")],
  like: [L('Какая приятная мелочь. Спасибо.', 'What a nice little thing. Thank you.'), L('О, это пригодится. Спасибо!', "Oh, that'll come in handy. Thanks!")],
  neutral: [L('Спасибо, {hero}.', 'Thanks, {hero}.'), L('Хм. Ну, спасибо.', 'Hm. Well, thanks.')],
  dislike: [L('Эм… Спасибо, наверное.', 'Um… Thanks, I suppose.'), L('Не стоило, правда.', "You really shouldn't have.")],
  hate: [L('Что это за гадость? Унеси.', 'What is this filth? Take it away.'), L('Ты издеваешься?', 'Are you mocking me?')],
};

export function reactionLine(r: GiftReaction, seed: number): Loc {
  const arr = LINES[r];
  return arr[seed % arr.length]!;
}

export const REACTION_LABEL: Record<GiftReaction, Loc> = {
  love: L('обожает', 'loves'), like: L('нравится', 'likes'), neutral: L('безразлично', 'neutral'), dislike: L('не нравится', 'dislikes'), hate: L('ненавидит', 'hates'),
};

export const reactionText = (r: GiftReaction) => t(REACTION_LABEL[r]);

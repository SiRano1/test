import { L, type Loc } from './loc';
import type { Stats, WeaponClass } from '../game/types';

export interface TalentDef {
  id: string;
  cls: WeaponClass;
  /** Ступень 1..3: стоимость в очках = ступень. */
  tier: 1 | 2 | 3;
  name: Loc;
  desc: Loc;
  stats?: Partial<Stats>;
}

const T = (id: string, cls: WeaponClass, tier: 1 | 2 | 3, name: Loc, desc: Loc, stats?: Partial<Stats>): TalentDef => ({ id, cls, tier, name, desc, stats });

export const TALENTS: TalentDef[] = [
  // ── Меч ──
  T('sw_edge', 'sword', 1, L('Острота', 'Keen Edge'), L('+10% урона мечом.', '+10% sword damage.'), { dmgPct: 10 }),
  T('sw_stamina', 'sword', 1, L('Выносливый', 'Enduring'), L('Удары мечом тратят на 15% меньше стамины.', 'Sword strikes cost 15% less stamina.')),
  T('sw_riposte', 'sword', 1, L('Контрвыпад', 'Riposte'), L('+6% шанса крита.', '+6% crit chance.'), { crit: 0.06 }),
  T('sw_bleed', 'sword', 2, L('Кровопускание', 'Bloodletting'), L('Удары с шансом 25% вызывают кровотечение.', 'Strikes have a 25% chance to cause bleeding.')),
  T('sw_whirl2', 'sword', 2, L('Вихрь II', 'Whirlwind II'), L('Вихрь сильнее на 50% и перезаряжается быстрее.', 'Whirlwind deals 50% more and recharges faster.')),
  T('sw_fourth', 'sword', 2, L('Четвёртый удар', 'Fourth Strike'), L('Комбо мечом получает четвёртый, завершающий удар.', 'The sword combo gains a fourth, finishing strike.')),
  T('sw_dance', 'sword', 3, L('Танец клинка', 'Blade Dance'), L('+15% к скорости атаки.', '+15% attack speed.'), { atkSpeed: 0.15 }),
  T('sw_wave', 'sword', 3, L('Разрез воздуха', 'Air Cleave'), L('Тяжёлый удар выпускает режущую волну.', 'The heavy strike releases a cutting wave.')),
  T('sw_oath', 'sword', 3, L('Клятва', 'The Oath'), L('+30% урона, пока здоровья меньше 30%.', '+30% damage while below 30% health.')),
  // ── Копьё ──
  T('sp_reach', 'spear', 1, L('Длинное древко', 'Long Shaft'), L('+20% к дальности ударов.', '+20% strike reach.')),
  T('sp_lunge', 'spear', 1, L('Выпад с разбега', 'Running Lunge'), L('Тяжёлый выпад сильнее на 30%.', 'The heavy lunge deals 30% more.')),
  T('sp_sweep', 'spear', 1, L('Подсечка', 'Sweep'), L('Удары замедляют врагов (30%).', 'Strikes slow enemies (30%).')),
  T('sp_pierce', 'spear', 2, L('Пронзание', 'Impale'), L('+15% урона и отбрасывания.', '+15% damage and knockback.'), { dmgPct: 15, knockback: 0.15 }),
  T('sp_throw2', 'spear', 2, L('Бросок II', 'Spear Throw II'), L('Бросок копья сильнее на 40% и чаще.', 'Spear Throw deals 40% more and recharges faster.')),
  T('sp_hedge', 'spear', 2, L('Стойка ежа', 'Hedgehog Stance'), L('+15% отражения урона.', '+15% thorns.'), { thorns: 0.15 }),
  T('sp_flurry', 'spear', 3, L('Шквал', 'Flurry'), L('+20% к скорости атаки.', '+20% attack speed.'), { atkSpeed: 0.2 }),
  T('sp_dragon', 'spear', 3, L('Прыжок дракона', "Dragon's Leap"), L('Тяжёлый выпад дальше и сильнее на 30%.', 'The heavy lunge goes farther and deals 30% more.')),
  T('sp_ghost', 'spear', 3, L('Невидимая пика', 'Ghost Pike'), L('+12% шанса крита.', '+12% crit chance.'), { crit: 0.12 }),
  // ── Лук ──
  T('bw_draw', 'bow', 1, L('Натяжение', 'Quick Draw'), L('Заряженный выстрел готовится на 30% быстрее.', 'Charged shots ready 30% faster.')),
  T('bw_pierce', 'bow', 1, L('Пронзающая стрела', 'Piercing Arrow'), L('Обычные стрелы пробивают одного врага.', 'Normal arrows pierce one enemy.')),
  T('bw_retreat', 'bow', 1, L('Лёгкий шаг', 'Light Step'), L('+8% к скорости бега.', '+8% move speed.'), { speed: 0.08 }),
  T('bw_crit', 'bow', 2, L('Меткость', 'Marksman'), L('+10% шанса крита.', '+10% crit chance.'), { crit: 0.1 }),
  T('bw_rain', 'bow', 2, L('Дождь стрел', 'Arrow Rain'), L('Тройной выстрел выпускает пять стрел.', 'Triple Shot fires five arrows.')),
  T('bw_poison', 'bow', 2, L('Ядовитые стрелы', 'Poisoned Arrows'), L('Стрелы отравляют с шансом 25%.', 'Arrows poison with a 25% chance.')),
  T('bw_eye', 'bow', 3, L('Соколиный глаз', 'Hawk Eye'), L('Критический урон +50%.', 'Critical damage +50%.'), { critMul: 0.5 }),
  T('bw_last', 'bow', 3, L('Последняя стрела', 'The Last Arrow'), L('+20% урона луком.', '+20% bow damage.'), { dmgPct: 20 }),
  T('bw_swift', 'bow', 3, L('Быстрая тетива', 'Swift String'), L('+20% к скорости стрельбы.', '+20% firing speed.'), { atkSpeed: 0.2 }),
  // ── Посох ──
  T('st_fire', 'staff', 1, L('Сила стихий', 'Elemental Might'), L('+10% урона посохом.', '+10% staff damage.'), { dmgPct: 10 }),
  T('st_mana', 'staff', 1, L('Поток маны', 'Mana Flow'), L('+30 маны, мана восстанавливается быстрее.', '+30 mana, faster mana regeneration.'), { maxMana: 30 }),
  T('st_ice', 'staff', 1, L('Иней', 'Hoarfrost'), L('Заклинания замедляют врагов (30%).', 'Spells slow enemies (30%).')),
  T('st_chain', 'staff', 2, L('Цепная молния', 'Chain Lightning'), L('+8 урона молнией.', '+8 shock damage.'), { shock: 8 }),
  T('st_echo', 'staff', 2, L('Эхо заклинания', 'Spell Echo'), L('20% шанс выпустить второй снаряд.', '20% chance to cast a second bolt.')),
  T('st_holy', 'staff', 2, L('Святой свет', 'Holy Light'), L('+8 святого урона (вдвое против нежити).', '+8 holy damage (double against undead).'), { holy: 8 }),
  T('st_meteor', 'staff', 3, L('Метеор', 'Meteor'), L('Сфера взрывается шире и сильнее на 30%.', 'The orb explodes wider and deals 30% more.')),
  T('st_zero', 'staff', 3, L('Абсолютный ноль', 'Absolute Zero'), L('Стихийный взрыв оглушает врагов.', 'Elemental Burst stuns enemies.')),
  T('st_resonance', 'staff', 3, L('Резонанс сердцекамня', 'Heartstone Resonance'), L('+25% урона посохом.', '+25% staff damage.'), { dmgPct: 25 }),
  // ── Щит ──
  T('sh_bastion', 'shield', 1, L('Бастион', 'Bastion'), L('Блок поглощает 95% урона.', 'Blocking absorbs 95% of damage.')),
  T('sh_parry', 'shield', 1, L('Широкое окно', 'Wide Guard'), L('Окно парирования дольше на 0,1 с.', 'The parry window lasts 0.1 s longer.')),
  T('sh_taunt', 'shield', 1, L('Панцирь', 'Carapace'), L('+8 защиты.', '+8 defense.'), { def: 8 }),
  T('sh_spikes', 'shield', 2, L('Шипастый щит', 'Spiked Shield'), L('+20% отражения урона.', '+20% thorns.'), { thorns: 0.2 }),
  T('sh_ram', 'shield', 2, L('Рывок-таран', 'Battering Charge'), L('Удар щитом чаще и оглушает дольше.', 'Shield Bash recharges faster and stuns longer.')),
  T('sh_wall', 'shield', 2, L('Стена', 'The Wall'), L('+40 здоровья.', '+40 health.'), { maxHp: 40 }),
  T('sh_hammer', 'shield', 3, L('Молот правосудия', 'Hammer of Justice'), L('Удар о землю шире и сильнее на 40%.', 'The ground slam is wider and deals 40% more.')),
  T('sh_unbreak', 'shield', 3, L('Нерушимый', 'Unbreakable'), L('Блок тратит вдвое меньше стамины.', 'Blocking costs half the stamina.')),
  T('sh_counter', 'shield', 3, L('Ответный удар', 'Retribution'), L('После парирования следующий удар — критический.', 'After a parry, the next strike is critical.')),
];

export const TALENT_BY_ID: Record<string, TalentDef> = Object.fromEntries(TALENTS.map((x) => [x.id, x]));

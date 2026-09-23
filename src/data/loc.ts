export type Lang = 'ru' | 'en';
export interface Loc {
  ru: string;
  en: string;
}
/** Род для согласования прилагательных в русском: м, ж, ср, мн. */
export type Gender = 'm' | 'f' | 'n' | 'p';
export interface AdjLoc {
  ru: Record<Gender, string>;
  en: string;
}

let lang: Lang = 'ru';
const listeners = new Set<(l: Lang) => void>();

export const getLang = () => lang;
export function setLang(l: Lang) {
  lang = l;
  for (const fn of listeners) fn(l);
}
export function onLangChange(fn: (l: Lang) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const L = (ru: string, en: string): Loc => ({ ru, en });

/** Прилагательное: основа + окончания (м, ж, ср, мн). Пример: adj('Медн', 'ый', 'ая', 'ое', 'ые', 'Copper'). */
export function adj(stem: string, m: string, f: string, n: string, p: string, en: string): AdjLoc {
  return { ru: { m: stem + m, f: stem + f, n: stem + n, p: stem + p }, en };
}

export function t(l: Loc | string | undefined): string {
  if (l === undefined) return '';
  if (typeof l === 'string') return l;
  return l[lang] || l.ru;
}

export function tAdj(a: AdjLoc, g: Gender): string {
  return lang === 'ru' ? a.ru[g] : a.en;
}

/** Подстановка {name} в строку. */
export function fmt(s: string, params?: Record<string, string | number>): string {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`));
}

/** Русское склонение числительных: 1 монета, 2 монеты, 5 монет. */
export function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

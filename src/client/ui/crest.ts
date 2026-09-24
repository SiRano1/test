import type { Crest } from '../../online/protocol';

/** SVG-герб гильдии: форма щита × деление × 2 цвета × фигура. */
const SHAPES = [
  'M4 3 H36 V20 Q36 36 20 45 Q4 36 4 20 Z', // классический щит
  'M20 3 A18 20 0 1 1 19.9 3 Z', // круглый
  'M4 3 H36 V36 L20 45 L4 36 Z', // знамя
  'M20 2 L37 12 L20 46 L3 12 Z', // каплевидный
];

const CHARGES = [
  '',
  'M20 14 L22.5 21 L30 21 L24 25.5 L26.5 33 L20 28.5 L13.5 33 L16 25.5 L10 21 L17.5 21 Z', // звезда
  'M11 30 L11 19 L15.5 24 L20 16 L24.5 24 L29 19 L29 30 Z', // корона
  'M19 10 H21 V27 H25 V29 H21 V34 H19 V29 H15 V27 H19 Z', // меч
  'M24 12 A10 10 0 1 0 24 32 A7.5 7.5 0 1 1 24 12 Z', // луна
  'M13 32 V18 H15 V15 H17 V18 H19 V15 H21 V18 H23 V15 H25 V18 H27 V32 Z', // башня
  'M17 12 A4 4 0 1 1 17.01 12 Z M18.5 19 H21.5 V33 H25 V35.5 H21.5 V31 H18.5 Z', // ключ
  'M20 11 Q27 20 24 27 Q22 32 20 33 Q15 31 15 25 Q15 20 18 17 Q18 22 20 23 Q21 17 20 11 Z', // пламя
];

export function crestSvg(c: Crest, size = 40): string {
  const [a, b] = c.colors;
  const clip = `crest${c.shape}${c.division}${a.slice(1)}${b.slice(1)}${c.charge}${Math.random().toString(36).slice(2, 6)}`;
  const div = [
    '',
    '<rect x="20" y="0" width="20" height="48"/>',
    '<rect x="0" y="24" width="40" height="24"/>',
    '<polygon points="0,0 40,48 0,48"/>',
    '<rect x="20" y="0" width="20" height="24"/><rect x="0" y="24" width="20" height="24"/>',
  ][c.division] ?? '';
  const charge = CHARGES[c.charge] ? `<path d="${CHARGES[c.charge]}" fill="${c.division ? '#e8e2d0' : b}" stroke="#1a1216" stroke-width="1"/>` : '';
  return `<svg viewBox="0 0 40 48" width="${size}" height="${size * 1.2}" xmlns="http://www.w3.org/2000/svg">
    <defs><clipPath id="${clip}"><path d="${SHAPES[c.shape]}"/></clipPath></defs>
    <g clip-path="url(#${clip})"><rect width="40" height="48" fill="${a}"/><g fill="${b}">${div}</g></g>
    ${charge}
    <path d="${SHAPES[c.shape]}" fill="none" stroke="#1a1216" stroke-width="2"/>
  </svg>`;
}

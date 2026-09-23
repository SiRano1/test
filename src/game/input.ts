/** Абстрактный ввод одного кадра. Тот же формат отправляется на сервер в PvP. */
export type Action =
  | 'attack' | 'block' | 'dodge' | 'interact' | 'skill' | 'swap'
  | 'inventory' | 'pause' | 'map' | 'quick1' | 'quick2' | 'quick3' | 'quick4';

export interface InputFrame {
  /** Оси движения −1..1 (уже нормализованные). */
  mx: number;
  my: number;
  /** Точка прицела в мировых координатах (мышь) или null (клавиатура/геймпад). */
  aimX: number | null;
  aimY: number | null;
  /** Направление прицела правого стика (геймпад). */
  stickAimX?: number;
  stickAimY?: number;
  down: ReadonlySet<Action>;
  pressed: ReadonlySet<Action>;
  released: ReadonlySet<Action>;
}

export const emptyInput = (): InputFrame => ({
  mx: 0, my: 0, aimX: null, aimY: null, down: new Set(), pressed: new Set(), released: new Set(),
});

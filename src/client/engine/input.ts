import type { Action, InputFrame } from '../../game/input';

const KEYMAP: Record<string, Action> = {
  KeyJ: 'attack', KeyK: 'block', ShiftLeft: 'block', Space: 'dodge', KeyL: 'dodge',
  KeyE: 'interact', KeyF: 'interact', Enter: 'interact', KeyQ: 'skill', KeyR: 'swap',
  KeyI: 'inventory', Tab: 'inventory', Escape: 'pause', KeyM: 'map',
  Digit1: 'quick1', Digit2: 'quick2', Digit3: 'quick3', Digit4: 'quick4',
};

const MOVE: Record<string, [number, number]> = {
  KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
};

/** Клавиатура + мышь + геймпад → InputFrame. */
export class Input {
  private keys = new Set<string>();
  private down = new Set<Action>();
  private pressed = new Set<Action>();
  private released = new Set<Action>();
  private mouseDown = new Set<number>();
  mouseX = 0;
  mouseY = 0;
  private mouseActiveAt = -1e9;
  private padPrev = new Set<Action>();
  /** Последнее активное устройство — для подсказок. */
  device: 'kbd' | 'mouse' | 'pad' = 'kbd';
  /** Когда true — ввод перехватывает интерфейс (текстовое поле и т. п.). */
  captured = false;
  /** Нажатия клавиш для интерфейса (не для игры). */
  uiKeys: string[] = [];

  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if (this.captured || (e.target as HTMLElement | null)?.tagName === 'INPUT') return;
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (e.repeat) return;
      this.device = 'kbd';
      this.keys.add(e.code);
      this.uiKeys.push(e.code);
      const a = KEYMAP[e.code];
      if (a) {
        if (!this.down.has(a)) this.pressed.add(a);
        this.down.add(a);
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      const a = KEYMAP[e.code];
      if (a && !Object.entries(KEYMAP).some(([k, v]) => v === a && this.keys.has(k))) {
        this.down.delete(a);
        this.released.add(a);
      }
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.down.clear();
      this.mouseDown.clear();
    });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = ((e.clientX - r.left) / r.width) * canvas.width;
      this.mouseY = ((e.clientY - r.top) / r.height) * canvas.height;
      this.mouseActiveAt = performance.now();
      this.device = 'mouse';
    });
    canvas.addEventListener('mousedown', (e) => {
      this.mouseActiveAt = performance.now();
      this.device = 'mouse';
      const a: Action | null = e.button === 0 ? 'attack' : e.button === 2 ? 'block' : null;
      this.mouseDown.add(e.button);
      if (a) {
        if (!this.down.has(a)) this.pressed.add(a);
        this.down.add(a);
      }
    });
    window.addEventListener('mouseup', (e) => {
      this.mouseDown.delete(e.button);
      const a: Action | null = e.button === 0 ? 'attack' : e.button === 2 ? 'block' : null;
      if (a && !Object.entries(KEYMAP).some(([k, v]) => v === a && this.keys.has(k))) {
        this.down.delete(a);
        this.released.add(a);
      }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Мышь считается прицелом, пока ею пользовались последние 4 секунды. */
  get mouseAiming(): boolean {
    return performance.now() - this.mouseActiveAt < 4000 && this.device === 'mouse';
  }

  private pollPad(): { mx: number; my: number; ax: number; ay: number; acts: Set<Action> } | null {
    const pads = navigator.getGamepads?.() ?? [];
    const p = Array.from(pads).find((x) => x && x.connected);
    if (!p) return null;
    const dz = (v: number) => (Math.abs(v) < 0.22 ? 0 : v);
    const acts = new Set<Action>();
    const b = (i: number) => !!p.buttons[i]?.pressed;
    if (b(2)) acts.add('attack'); // X
    if (b(6) || b(4)) acts.add('block'); // LT / LB
    if (b(1)) acts.add('dodge'); // B
    if (b(0)) acts.add('interact'); // A
    if (b(3)) acts.add('skill'); // Y
    if (b(5)) acts.add('swap'); // RB
    if (b(9)) acts.add('pause'); // Start
    if (b(8)) acts.add('inventory'); // Select
    if (b(12)) acts.add('quick1');
    if (b(15)) acts.add('quick2');
    if (b(13)) acts.add('quick3');
    if (b(14)) acts.add('quick4');
    const mx = dz(p.axes[0] ?? 0), my = dz(p.axes[1] ?? 0);
    const ax = dz(p.axes[2] ?? 0), ay = dz(p.axes[3] ?? 0);
    if (acts.size || mx || my) this.device = 'pad';
    return { mx, my, ax, ay, acts };
  }

  /** Снимок ввода на кадр. worldAim переводит экранные координаты мыши в мировые. */
  frame(worldAim: (sx: number, sy: number) => [number, number]): InputFrame {
    let mx = 0, my = 0;
    if (!this.captured) for (const [k, [dx, dy]] of Object.entries(MOVE)) if (this.keys.has(k)) {
      mx += dx;
      my += dy;
    }
    const pad = this.pollPad();
    const down = new Set(this.down);
    const pressed = new Set(this.pressed);
    const released = new Set(this.released);
    let stickAimX: number | undefined, stickAimY: number | undefined;
    if (pad) {
      if (pad.mx || pad.my) {
        mx = pad.mx;
        my = pad.my;
      }
      if (pad.ax || pad.ay) {
        stickAimX = pad.ax;
        stickAimY = pad.ay;
      }
      for (const a of pad.acts) {
        down.add(a);
        if (!this.padPrev.has(a)) pressed.add(a);
      }
      for (const a of this.padPrev) if (!pad.acts.has(a)) released.add(a);
      this.padPrev = pad.acts;
    }
    const l = Math.hypot(mx, my);
    if (l > 1) {
      mx /= l;
      my /= l;
    }
    let aimX: number | null = null, aimY: number | null = null;
    if (this.mouseAiming) [aimX, aimY] = worldAim(this.mouseX, this.mouseY);
    this.pressed.clear();
    this.released.clear();
    return { mx, my, aimX, aimY, stickAimX, stickAimY, down, pressed, released };
  }

  takeUiKeys(): string[] {
    const k = this.uiKeys;
    this.uiKeys = [];
    return k;
  }

  /** Сбросить «залипшие» действия (после закрытия меню). */
  reset(): void {
    this.down.clear();
    this.pressed.clear();
    this.released.clear();
  }
}

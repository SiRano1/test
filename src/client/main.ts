import './ui/styles.css';
import { setLang } from '../data/loc';
import { Game } from '../game/game';
import { emptyInput } from '../game/input';
import { loadGame, MemoryKV, saveGame, type KV } from '../game/systems/save';
import { Audio } from './engine/audio';
import { VIEW_H, VIEW_W } from './engine/camera';
import { Input } from './engine/input';
import { Renderer } from './gfx/renderer';
import { Ui } from './ui/ui';

const STEP = 1 / 60;

function safeStorage(): KV {
  try {
    const k = '__dtc_probe';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return localStorage;
  } catch {
    return new MemoryKV();
  }
}

const SETTINGS_KEY = 'dtc.settings';

function boot(): void {
  const app = document.getElementById('app')!;
  const canvas = document.getElementById('screen') as HTMLCanvasElement;
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const fit = () => {
    const raw = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
    const k = raw >= 1 ? Math.floor(raw) : raw;
    app.style.transform = `scale(${k})`;
    app.style.left = `${Math.round((window.innerWidth - VIEW_W * k) / 2)}px`;
    app.style.top = `${Math.round((window.innerHeight - VIEW_H * k) / 2)}px`;
  };
  fit();
  window.addEventListener('resize', fit);

  const kv = safeStorage();
  const input = new Input(canvas);
  const renderer = new Renderer(ctx);
  const audio = new Audio();
  let game: Game | null = null;
  let slot = 0;

  const saveNow = () => {
    if (game) saveGame(kv, slot, game.snapshot());
  };
  const persistSettings = () => {
    const st = game ? game.state.settings : ui.titleSettings;
    if (game) Object.assign(ui.titleSettings, st);
    try {
      kv.setItem(SETTINGS_KEY, JSON.stringify(st));
    } catch {
      /* нет хранилища — не страшно */
    }
  };

  const start = (g: Game, s: number) => {
    game = g;
    slot = s;
    g.state.settings = { ...g.state.settings, ...ui.titleSettings, lang: ui.titleSettings.lang };
    setLang(g.state.settings.lang);
    audio.setVolume(g.state.settings.volume);
    g.events.on('autosave', () => {
      saveNow();
      g.toast('💾', '#a0a0a0');
    });
    ui.attach(g);
    input.reset();
    (window as unknown as { __dtc: unknown }).__dtc = { game: g, renderer, ui, input };
  };

  const ui = new Ui(document.getElementById('ui')!, renderer, audio, kv, {
    newGame(name, s) {
      audio.unlock();
      const g = Game.newGame(name);
      start(g, s);
      saveNow();
      setTimeout(() => {
        g.toast(g.state.settings.lang === 'ru' ? 'Выйдите из усадьбы и найдите могильщика у кладбища.' : 'Leave the manor and find the gravedigger by the cemetery.', '#ffe0a0');
      }, 1200);
    },
    continueGame(s) {
      audio.unlock();
      const st = loadGame(kv, s);
      if (!st) return;
      start(new Game(st), s);
    },
    saveAndQuit() {
      saveNow();
      game = null;
      ui.showTitle();
    },
    settingsChanged: persistSettings,
  });

  try {
    const raw = kv.getItem(SETTINGS_KEY);
    if (raw) Object.assign(ui.titleSettings, JSON.parse(raw));
  } catch {
    /* повреждённые настройки игнорируем */
  }
  setLang(ui.titleSettings.lang);
  audio.setVolume(ui.titleSettings.volume);
  ui.showTitle();

  const unlock = () => audio.unlock();
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  window.addEventListener('beforeunload', () => {
    if (game && game.scene.kind !== 'dungeon') saveNow();
  });

  let last = performance.now();
  let acc = 0;
  let musicT = 0;
  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const g = game;
    acc += dt * (g?.state.settings.speed ?? 1);
    if (g) {
      while (acc >= STEP) {
        acc -= STEP;
        const keys = input.takeUiKeys();
        const consumed = ui.handleKeys(keys);
        let inp = input.frame((sx, sy) => renderer.screenToWorld(sx, sy));
        if (consumed || ui.blocking) inp = { ...emptyInput(), mx: 0, my: 0 };
        g.update(STEP, inp);
      }
      renderer.render(g, dt);
      ui.update(dt);
      musicT -= dt;
      if (musicT <= 0) {
        musicT = 1;
        const m = g.state.time.minutes;
        audio.startMusic(g.scene.kind === 'dungeon' ? 'dungeon' : m > 20 * 60 ? 'night' : 'town');
      }
    } else {
      acc = 0;
      input.takeUiKeys();
      ctx.fillStyle = '#0b0810';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

boot();

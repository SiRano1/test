// Дымовой тест в настоящем браузере: запуск собранной игры, прохождение ключевых сцен, скриншоты.
// Запуск: npm run build && npm run e2e
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { preview } from 'vite';

const CHROME = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = 'e2e/screens';
mkdirSync(OUT, { recursive: true });

const server = await preview({ preview: { port: 4173, strictPort: true }, logLevel: 'error' });
const browser = await chromium.launch({ executablePath: CHROME, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

const shot = async (name) => page.screenshot({ path: `${OUT}/${name}.png` });
const wait = (ms) => page.waitForTimeout(ms);
const game = (fn, arg) => page.evaluate(fn, arg);

try {
  await page.goto('http://localhost:4173/');
  await wait(600);
  await shot('01-title');
  await page.click('#btn-new');
  await page.click('#btn-start');
  await wait(1500);
  await shot('02-manor');

  // выйти из усадьбы настоящим вводом: вправо к центру, затем вниз в дверь
  await page.keyboard.down('KeyD');
  await wait(560);
  await page.keyboard.up('KeyD');
  await page.keyboard.down('KeyS');
  await wait(1700);
  await page.keyboard.up('KeyS');
  await wait(900);
  const scene1 = await game(() => window.__dtc.game.scene.kind);
  console.log('после выхода из усадьбы:', scene1);
  if (scene1 !== 'town') errors.push('Не удалось выйти из усадьбы пешком');
  await shot('03-town');
  // дойти до склепа пешком нельзя проверить быстро — проверим вход по триггеру двери склепа
  await game(() => window.__dtc.game.goTo({ kind: 'town' }, { x: 11 * 16 + 8, y: 11 * 16 + 4, facing: 3 }));
  await wait(800);
  await page.keyboard.down('KeyW');
  await wait(500);
  await page.keyboard.up('KeyW');
  await wait(900);
  const scene2 = await game(() => window.__dtc.game.scene);
  console.log('после входа в склеп:', JSON.stringify(scene2));
  if (scene2.kind !== 'dungeon') errors.push('Вход в склеп не ведёт в подземелье');

  // разговор с Йорном
  await game(() => {
    const g = window.__dtc.game;
    g.goTo({ kind: 'town' }, { x: 12 * 16 + 8, y: 14 * 16 + 6, facing: 3 });
  });
  await wait(900);
  await page.keyboard.press('KeyE');
  await wait(1200);
  await shot('04-dialogue');
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('KeyE');
    await wait(250);
  }
  await wait(300);

  // подземелье
  await game(() => window.__dtc.game.goTo({ kind: 'dungeon', floor: 1 }));
  await wait(1200);
  await shot('05-dungeon');
  // подтащить врага и ударить
  await game(() => {
    const g = window.__dtc.game;
    const e = g.world.entities.find((x) => x.team === 'enemy');
    if (e) {
      e.x = g.player.x + 20;
      e.y = g.player.y;
    }
  });
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('KeyJ');
    await wait(160);
  }
  await wait(60);
  await shot('06-combat');
  await wait(1500);

  // арена босса
  await game(() => window.__dtc.game.goTo({ kind: 'dungeon', floor: 10 }));
  await wait(1000);
  await game(() => {
    const g = window.__dtc.game;
    g.player.y -= 120;
  });
  await wait(1500);
  await shot('07-boss');

  // ночной город
  await game(() => {
    const g = window.__dtc.game;
    g.state.time.minutes = 22 * 60;
    g.goTo({ kind: 'town' }, { x: 31 * 16, y: 24 * 16 });
  });
  await wait(1200);
  await shot('08-night');

  // инвентарь
  await page.keyboard.press('KeyI');
  await wait(400);
  await shot('09-inventory');
  await page.keyboard.press('KeyI');

  // магазин
  await game(() => window.__dtc.game.goTo({ kind: 'interior', id: 'smithy' }));
  await wait(900);
  await game(() => {
    const g = window.__dtc.game;
    g.talk('hilda');
  });
  await wait(300);
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('KeyE');
    await wait(200);
  }
  await page.keyboard.press('Digit1');
  await wait(500);
  await shot('10-shop');

  const state = await game(() => {
    const g = window.__dtc.game;
    return { scene: g.scene, hp: g.player.hp, mode: g.mode, deepest: g.state.dungeon.deepest };
  });
  console.log('состояние:', JSON.stringify(state));
} catch (e) {
  errors.push(String(e));
} finally {
  await browser.close();
  server.httpServer.close();
}

if (errors.length) {
  console.error('ОШИБКИ:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('e2e: OK, скриншоты в', OUT);

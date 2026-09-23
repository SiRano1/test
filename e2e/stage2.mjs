// Визуальная проверка систем этапа 2 (скриншоты в e2e/screens/s2-*.png).
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { preview } from 'vite';

const CHROME = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync('e2e/screens', { recursive: true });
const server = await preview({ preview: { port: 4174, strictPort: true }, logLevel: 'error' });
const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const wait = (ms) => page.waitForTimeout(ms);
const shot = (n) => page.screenshot({ path: `e2e/screens/s2-${n}.png` });
const ev = (fn) => page.evaluate(fn);

try {
  await page.goto('http://localhost:4174/');
  await wait(400);
  await page.click('#btn-new');
  await page.click('#btn-start');
  await wait(1200);

  // дождливый полдень в городе
  await ev(() => {
    const g = window.__dtc.game;
    g.state.time.minutes = 12 * 60 + 20;
    g.state.time.weather = 'rain';
    g.goTo({ kind: 'town' }, { x: 29 * 16, y: 22 * 16 });
  });
  await wait(1500);
  await shot('01-rain');

  // солнечный полдень: жители на площади
  await ev(() => {
    const g = window.__dtc.game;
    g.state.time.weather = 'sunny';
    g.goTo({ kind: 'town' }, { x: 29 * 16, y: 22 * 16 });
  });
  await wait(1500);
  await shot('02-plaza');

  // вечер в таверне
  await ev(() => {
    const g = window.__dtc.game;
    g.state.time.minutes = 20 * 60 + 30;
    g.goTo({ kind: 'interior', id: 'tavern' });
  });
  await wait(1500);
  await shot('03-tavern');

  // усадьба с улучшениями и крафт
  await ev(() => {
    const g = window.__dtc.game;
    g.state.manor.upgrades.push('hall', 'forge', 'lab', 'garden');
    g.state.manor.garden = Array.from({ length: 12 }, (_, i) => ({ seed: i % 3 ? 'seed_turnip' : 'seed_potato', days: i % 5, watered: i % 2 === 0, ready: i % 4 === 0 }));
    g.give('copper_ore', 10);
    g.give('coal', 2);
    g.state.time.minutes = 10 * 60;
    g.goTo({ kind: 'interior', id: 'manor' });
  });
  await wait(1200);
  await shot('04-manor');
  await ev(() => window.__dtc.game.openCrafting('furnace'));
  await wait(400);
  await shot('05-craft');
  await ev(() => window.__dtc.game.closePanel());
  await ev(() => window.__dtc.game.goTo({ kind: 'town' }, { x: 52 * 16 + 8, y: 12 * 16 + 8 }));
  await wait(1200);
  await shot('06-garden');

  // Затопленные шахты
  await ev(() => window.__dtc.game.goTo({ kind: 'dungeon', floor: 13 }));
  await wait(1400);
  await shot('07-mines');

  // Горм
  await ev(() => {
    const g = window.__dtc.game;
    g.goTo({ kind: 'dungeon', floor: 20 });
  });
  await wait(1200);
  await ev(() => {
    const g = window.__dtc.game;
    g.player.y -= 150;
  });
  await wait(2500);
  await shot('08-gorm');

  // вкладки меню
  await ev(() => {
    const g = window.__dtc.game;
    g.startQuest('q_legacy');
    g.startQuest('q_hilda_ore');
    g.goTo({ kind: 'town' }, { x: 31 * 16, y: 20 * 16 });
  });
  await wait(1000);
  await page.keyboard.press('KeyI');
  await wait(300);
  await page.click('text=Задания');
  await wait(300);
  await shot('09-quests');
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
console.log('stage2 e2e: OK');

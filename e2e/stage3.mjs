// Визуальная проверка систем этапа 3 (скриншоты в e2e/screens/s3-*.png).
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { preview } from 'vite';

const CHROME = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ONLY = process.env.ONLY ?? '';
mkdirSync('e2e/screens', { recursive: true });
const server = await preview({ preview: { port: 4175, strictPort: true }, logLevel: 'error' });
const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const wait = (ms) => page.waitForTimeout(ms);
const shot = (n) => page.screenshot({ path: `e2e/screens/s3-${n}.png` });
const ev = (fn, arg) => page.evaluate(fn, arg);
const want = (n) => !ONLY || ONLY.split(',').includes(n);

try {
  await page.goto('http://localhost:4175/');
  await wait(400);
  await page.click('#btn-new');
  await page.click('#btn-start');
  await wait(1200);

  if (want('talents')) {
    await ev(() => {
      const { game: g, ui } = window.__dtc;
      g.state.hero.classXp.sword = 900;
      g.state.hero.gold = 2000;
      g.learnTalent('sw_edge');
      g.learnTalent('sw_stamina');
      g.learnTalent('sw_fourth');
      ui.toggleMenu('skills');
    });
    await wait(300);
    await page.click('button.tal.ready');
    await wait(200);
    await shot('01-talents');
    await ev(() => window.__dtc.ui.toggleMenu());
  }
  if (want('traps')) {
    // найти этаж с головоломкой-плитами и встать рядом
    const found = await ev(async () => {
      const { game: g } = window.__dtc;
      for (let d = 0; d < 60; d++) {
        g.state.time.totalDays = 100 + d;
        g.goTo({ kind: 'dungeon', floor: 14 });
        await new Promise((r) => setTimeout(r, 450));
        const ents = g.world.entities;
        const tab = ents.find((e) => e.sprite?.startsWith('tablet:'));
        const spikes = ents.filter((e) => e.sprite?.startsWith('trap:'));
        if (tab && spikes.length) {
          for (const e of g.world.enemies()) g.world.remove(e);
          g.player.x = tab.x;
          g.player.y = tab.y + 40;
          g.player.hp = 9999;
          return { d, traps: spikes.length };
        }
      }
      return null;
    });
    console.log('puzzle floor', found);
    await wait(600);
    await shot('02-puzzle');
    await ev(() => {
      const { game: g } = window.__dtc;
      const t = g.world.entities.find((e) => e.sprite?.startsWith('trap:'));
      if (t) {
        g.player.x = t.x + 20;
        g.player.y = t.y;
      }
    });
    await wait(1400);
    await shot('03-trap');
  }
  const fest = async (name, season, day, minutes, spawn, extra) => {
    await ev(({ season, day, minutes, spawn }) => {
      const { game: g } = window.__dtc;
      g.state.time.season = season;
      g.state.time.day = day;
      g.state.time.minutes = minutes;
      g.state.time.weather = season === 3 ? 'snow' : 'sunny';
      g.goTo({ kind: 'town' }, { x: spawn[0] * 16 + 8, y: spawn[1] * 16 + 8, facing: 3 });
    }, { season, day, minutes, spawn });
    await wait(2500);
    if (extra) {
      await ev(extra);
      await wait(extra.wait ?? 1500);
    }
    await shot(name);
  };
  if (want('fest')) {
    const tourney = () => {
      const { game: g } = window.__dtc;
      g.state.hero.level = 6;
      g.festival('tourney');
    };
    tourney.wait = 3800;
    await fest('04-tourney', 0, 13, 11 * 60, [31, 20], tourney);
    await fest('05-fair', 1, 11, 12 * 60, [31, 21]);
    await fest('06-spirits', 2, 27, 21 * 60, [11, 15]);
    await fest('07-feast', 3, 25, 19 * 60, [31, 19]);
  }
} finally {
  console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no page errors');
  await browser.close();
  server.httpServer.close();
}

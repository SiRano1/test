// Онлайн e2e: сервер + два браузерных игрока. Скриншоты в e2e/screens/s4-*.png
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { preview } from 'vite';

const CHROME = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 2601;
const DB = 'server-data/e2e.sqlite';
mkdirSync('e2e/screens', { recursive: true });
rmSync(DB, { force: true });
rmSync(`${DB}-wal`, { force: true });
rmSync(`${DB}-shm`, { force: true });

const server = spawn('npx', ['tsx', 'src/server/main.ts'], { env: { ...process.env, PORT: String(PORT), DB_PATH: DB }, stdio: ['ignore', 'pipe', 'pipe'] });
server.stderr.on('data', (d) => {
  const s = String(d);
  if (!s.includes('ExperimentalWarning') && !s.includes('trace-warnings')) process.stderr.write(`[server] ${s}`);
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(`http://localhost:${PORT}/api/health`)).ok) break;
  } catch {}
  await wait(250);
}

const web = await preview({ preview: { port: 4176, strictPort: true }, logLevel: 'error' });
const browser = await chromium.launch({ executablePath: CHROME });
const errors = [];

async function playerPage(name, cls) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 810 } });
  await ctx.addInitScript((port) => localStorage.setItem('dtc.server', `http://localhost:${port}`), PORT);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e}`));
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errors.push(`${name}: ${m.text()}`));
  await page.goto('http://localhost:4176/');
  await wait(400);
  await page.click('#btn-online');
  await page.click('#btn-guest');
  await page.waitForSelector('#online-name');
  await page.fill('#online-name', name);
  await page.click(`text=${cls}`);
  await page.click('#btn-create-online');
  await wait(500);
  return page;
}

try {
  const a = await playerPage('Сигурд', 'Меч');
  const b = await playerPage('Ярина', 'Лук');
  await a.screenshot({ path: 'e2e/screens/s4-01-hero.png' });

  // гильдия: основать (дадим золота через API сервера не можем — проверим экран конструктора)
  await a.click('text=Гильдия');
  await wait(500);
  await a.screenshot({ path: 'e2e/screens/s4-02-guild.png' });
  await a.click('text=Аукцион');
  await wait(500);
  await a.screenshot({ path: 'e2e/screens/s4-03-auction.png' });

  // дуэль
  await a.click('text=Арена');
  await b.click('text=Арена');
  await wait(400);
  await a.click('#btn-queue-duel');
  await b.click('#btn-queue-duel');
  await wait(4500);
  await a.screenshot({ path: 'e2e/screens/s4-04-duel.png' });
  // сблизиться и атаковать
  await a.keyboard.down('KeyD');
  await wait(1600);
  await a.keyboard.up('KeyD');
  for (let i = 0; i < 6; i++) {
    await a.keyboard.press('KeyJ');
    await wait(250);
  }
  await a.screenshot({ path: 'e2e/screens/s4-05-duel-fight.png' });
  // соперник сдаётся (Esc) — у первого экран победы
  await b.keyboard.press('Escape');
  await wait(1500);
  await a.screenshot({ path: 'e2e/screens/s4-06-result.png' });
  await a.click('text=В лобби');
  await wait(600);

  // Пустоши
  await a.click('text=Пустоши');
  await wait(300);
  await a.click('#btn-wastes');
  await wait(1500);
  await a.keyboard.down('KeyW');
  await wait(1200);
  await a.keyboard.up('KeyW');
  await a.screenshot({ path: 'e2e/screens/s4-07-wastes.png' });
} catch (e) {
  console.log('FAILED:', e.message.split('\n').slice(0, 6).join('\n'));
  process.exitCode = 1;
} finally {
  console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'online e2e: no page errors');
  await browser.close();
  web.httpServer.close();
  server.kill('SIGKILL');
  setTimeout(() => process.exit(), 500);
}

import { createServer, type Server as HttpServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { jwtSecret } from './auth';
import { Db } from './db';
import { httpHandler } from './http';
import { ArenaRoom, arenaQueue, env, GuildChatRoom, WastesRoom } from './rooms';
import { settleAuctions } from './services/auction';
import { ensureTerritories, settleTerritories, territoryIncome, weekOf } from './services/guild';

export interface RunningServer {
  http: HttpServer;
  game: Server;
  db: Db;
  port: number;
  stop(): Promise<void>;
}

/** Запуск онлайн-сервера: HTTP API + комнаты Colyseus на одном порту. */
export async function startServer(opts: { port?: number; dbPath?: string; now?: () => number } = {}): Promise<RunningServer> {
  const path = opts.dbPath ?? ':memory:';
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Db(path);
  env.db = db;
  env.secret = jwtSecret(db);
  env.now = opts.now ?? (() => Date.now());
  ensureTerritories(db);

  const http = createServer(httpHandler({ db, secret: env.secret, now: env.now, arena: arenaQueue }));
  const game = new Server({ transport: new WebSocketTransport({ server: http }), greet: false });
  game.define('arena', ArenaRoom);
  game.define('wastes', WastesRoom);
  game.define('guild_chat', GuildChatRoom).filterBy(['guildId']);

  // фоновые задачи: закрытие лотов, подбор соперников, итоги недели и доход территорий
  let lastWeek = weekOf(env.now());
  let lastDay = Math.floor(env.now() / 86_400_000);
  const timers = [
    setInterval(() => settleAuctions(db, env.now()), 15_000),
    setInterval(() => arenaQueue.tryMatch(), 2_000),
    setInterval(() => {
      const now = env.now();
      if (weekOf(now) !== lastWeek) {
        lastWeek = weekOf(now);
        settleTerritories(db, now);
      }
      const day = Math.floor(now / 86_400_000);
      if (day !== lastDay) {
        lastDay = day;
        territoryIncome(db, now);
      }
    }, 60_000),
  ];

  await game.listen(opts.port ?? 2567);
  const addr = http.address();
  const port = typeof addr === 'object' && addr ? addr.port : (opts.port ?? 2567);
  return {
    http, game, db, port,
    async stop() {
      for (const t of timers) clearInterval(t);
      await game.gracefullyShutdown(false);
      db.close();
    },
  };
}

// запуск из командной строки: npm run server
if (process.argv[1] && /server[\\/]main\.ts$/.test(process.argv[1])) {
  const port = Number(process.env.PORT ?? 2567);
  startServer({ port, dbPath: process.env.DB_PATH ?? 'server-data/dtc.sqlite' }).then((s) => {
    console.log(`Хроники Глубинного Трона — сервер на :${s.port} (API /api/*, комнаты arena / wastes / guild_chat)`);
  });
}

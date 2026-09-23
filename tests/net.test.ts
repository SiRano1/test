import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, type Room } from 'colyseus.js';
import { startServer, type RunningServer } from '../src/server/main';
import { addGold, heroById } from '../src/server/services/hero';
import type { NetSnapshot } from '../src/online/protocol';

let srv: RunningServer;
let base = '';

beforeAll(async () => {
  srv = await startServer({ port: 0 });
  base = `http://localhost:${srv.port}`;
});

afterAll(async () => {
  await srv?.stop();
});

let rid = 0;
async function api<T = any>(method: string, path: string, body?: object, token?: string): Promise<{ status: number; json: T }> {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify({ requestId: `r${++rid}`, ...body }) : undefined,
  });
  return { status: res.status, json: (await res.json()) as T };
}

async function player(dev: string, name: string, cls = 'sword') {
  const { json } = await api<{ token: string }>('POST', '/api/auth/guest', { deviceId: dev });
  const hero = await api<{ id: string }>('POST', '/api/hero', { name, cls }, json.token);
  return { token: json.token, id: hero.json.id };
}

const until = async <T>(fn: () => Promise<T | null> | T | null, ms = 5000): Promise<T> => {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t0 > ms) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, 50));
  }
};

describe('Онлайн: сеть целиком', () => {
  it('REST через HTTP: здоровье сервера и таблица территорий', async () => {
    expect((await api('GET', '/api/health')).json.ok).toBe(true);
    expect((await api<unknown[]>('GET', '/api/territories')).json.length).toBe(12);
  });

  it('дуэль: очередь, комната, снимки, сдача соперника, рейтинг', async () => {
    const a = await player('net-duel-a1', 'Дуэлянт');
    const b = await player('net-duel-b1', 'Соперник');
    expect((await api('POST', '/api/arena/queue', { mode: 'duel', ranked: true }, a.token)).json.state).toBe('queued');
    await api('POST', '/api/arena/queue', { mode: 'duel', ranked: true }, b.token);
    const st = await until(async () => {
      const s = (await api<{ state: string; roomId?: string }>('GET', '/api/arena/queue', undefined, a.token)).json;
      return s.state === 'matched' ? s : null;
    });
    const client = new Client(`ws://localhost:${srv.port}`);
    const ra: Room = await client.joinById(st.roomId!, { token: a.token });
    let snapA: NetSnapshot | null = null;
    let map: { map: { w: number } } | null = null;
    let result: { winners: string[]; ratings: Record<string, { delta: number }> } | null = null;
    ra.onMessage('snap', (s: NetSnapshot) => (snapA = s));
    ra.onMessage('map', (m) => (map = m));
    ra.onMessage('result', (r) => (result = r));
    const rb: Room = await client.joinById(st.roomId!, { token: b.token });
    rb.onMessage('snap', () => {});
    rb.onMessage('map', () => {});
    rb.onMessage('result', () => {});
    // чужой токен в чужую комнату не пускают
    const c = await player('net-duel-c1', 'Чужак');
    await expect(client.joinById(st.roomId!, { token: c.token })).rejects.toBeTruthy();
    await until(() => (snapA && map ? true : null));
    const snap = snapA as unknown as NetSnapshot;
    expect(snap.ents.filter((e) => e.k === 'hero').length).toBe(2);
    expect(snap.you).toBeGreaterThan(0);
    ra.send('in', { seq: 1, mx: 1, my: 0, ax: null, ay: null, p: [], d: [] });
    await rb.leave();
    const res = await until(() => result, 8000);
    expect(res.winners).toEqual([a.id]);
    expect(res.ratings[a.id]!.delta).toBeGreaterThan(0);
    expect(heroById(srv.db, a.id).wins).toBe(1);
    await ra.leave().catch(() => {});
  }, 20000);

  it('Пустоши: вход, свой герой в снимке, повторный вход тем же героем запрещён', async () => {
    const p = await player('net-waste-01', 'Странник', 'bow');
    const client = new Client(`ws://localhost:${srv.port}`);
    const room: Room = await client.joinOrCreate('wastes', { token: p.token });
    let snap: NetSnapshot | null = null;
    room.onMessage('snap', (s: NetSnapshot) => (snap = s));
    room.onMessage('map', () => {});
    const s = await until(() => snap);
    const me = s.ents.find((e) => e.id === s.you)!;
    expect(me.n).toBe('Странник');
    expect(me.c).toBe('blue');
    expect(s.ents.some((e) => e.k === 'mob')).toBe(true);
    await expect(client.joinOrCreate('wastes', { token: p.token })).rejects.toBeTruthy();
    await room.leave();
  }, 15000);

  it('гильдейский чат: история и рассылка', async () => {
    const p = await player('net-guild-01', 'Писарь');
    addGold(srv.db, p.id, 6000, 'test', null, Date.now());
    const g = await api<{ id: string }>('POST', '/api/guild', { name: 'Перья', tag: 'ПР', crest: { shape: 2, division: 1, colors: ['#3a5aa8', '#e8e2d0'], charge: 4 } }, p.token);
    expect(g.status).toBe(200);
    const client = new Client(`ws://localhost:${srv.port}`);
    const room: Room = await client.joinOrCreate('guild_chat', { token: p.token, guildId: g.json.id });
    const got: { text: string }[] = [];
    room.onMessage('history', () => {});
    room.onMessage('msg', (m) => got.push(m));
    room.send('say', 'Привет, гильдия!');
    await until(() => (got.length ? true : null));
    expect(got[0]!.text).toBe('Привет, гильдия!');
    expect((await api<{ text: string }[]>('GET', '/api/guild/chat', undefined, p.token)).json[0]!.text).toBe('Привет, гильдия!');
    await room.leave();
  }, 15000);
});

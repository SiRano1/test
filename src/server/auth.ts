import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Db } from './db';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url');

/** Секрет подписи сессий хранится в БД — токены переживают перезапуск сервера. */
export function jwtSecret(db: Db): string {
  let s = db.meta('jwt_secret');
  if (!s) {
    s = randomBytes(32).toString('hex');
    db.setMeta('jwt_secret', s);
  }
  return s;
}

export function signJwt(secret: string, payload: Record<string, unknown>, ttlSec = 30 * 24 * 3600, now = Date.now()): string {
  const head = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64(JSON.stringify({ ...payload, iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + ttlSec }));
  const sig = b64(createHmac('sha256', secret).update(`${head}.${body}`).digest());
  return `${head}.${body}.${sig}`;
}

export function verifyJwt(secret: string, token: string, now = Date.now()): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [head, body, sig] = parts as [string, string, string];
  const expect = createHmac('sha256', secret).update(`${head}.${body}`).digest();
  const got = Buffer.from(sig, 'base64url');
  if (got.length !== expect.length || !timingSafeEqual(got, expect)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString()) as Record<string, unknown>;
    if (typeof p.exp === 'number' && p.exp * 1000 < now) return null;
    return p;
  } catch {
    return null;
  }
}

export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  const h = scryptSync(pw, salt, 32);
  return `scrypt$${salt.toString('hex')}$${h.toString('hex')}`;
}

export function checkPassword(pw: string, stored: string): boolean {
  const [, saltHex, hashHex] = stored.split('$');
  if (!saltHex || !hashHex) return false;
  const h = scryptSync(pw, Buffer.from(saltHex, 'hex'), 32);
  const want = Buffer.from(hashHex, 'hex');
  return h.length === want.length && timingSafeEqual(h, want);
}

export interface Account {
  id: string;
  device_id: string | null;
  email: string | null;
  pass_hash: string | null;
  banned: number;
}

/** Гостевой вход по идентификатору устройства: создаёт аккаунт при первом входе. */
export function guestLogin(db: Db, deviceId: string, now: number): Account {
  if (!/^[\w-]{8,64}$/.test(deviceId)) throw new ApiError(400, 'bad_device');
  const ex = db.get<Account>('SELECT * FROM accounts WHERE device_id = ?', deviceId);
  if (ex) {
    if (ex.banned) throw new ApiError(403, 'banned');
    return ex;
  }
  const id = randomUUID();
  db.run('INSERT INTO accounts (id, device_id, created_at) VALUES (?, ?, ?)', id, deviceId, now);
  return db.get<Account>('SELECT * FROM accounts WHERE id = ?', id)!;
}

/** Привязать e-mail и пароль к текущему (гостевому) аккаунту. */
export function bindEmail(db: Db, accountId: string, email: string, password: string): void {
  if (!/^[^@\s]{1,64}@[^@\s]{1,255}\.[a-z]{2,}$/i.test(email)) throw new ApiError(400, 'bad_email');
  if (password.length < 8) throw new ApiError(400, 'weak_password');
  const taken = db.get<{ id: string }>('SELECT id FROM accounts WHERE email = ? AND id <> ?', email, accountId);
  if (taken) throw new ApiError(409, 'email_taken');
  db.run('UPDATE accounts SET email = ?, pass_hash = ? WHERE id = ?', email, hashPassword(password), accountId);
}

export function emailLogin(db: Db, email: string, password: string): Account {
  const a = db.get<Account>('SELECT * FROM accounts WHERE email = ?', email);
  if (!a || !a.pass_hash || !checkPassword(password, a.pass_hash)) throw new ApiError(401, 'bad_credentials');
  if (a.banned) throw new ApiError(403, 'banned');
  return a;
}

/** Простое ограничение частоты: окно в минуту на ключ. */
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(private perMinute: number) {}

  allow(key: string, now: number): boolean {
    const arr = (this.hits.get(key) ?? []).filter((t) => now - t < 60_000);
    if (arr.length >= this.perMinute) {
      this.hits.set(key, arr);
      return false;
    }
    arr.push(now);
    this.hits.set(key, arr);
    return true;
  }
}

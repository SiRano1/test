import type { GuildDTO, HeroDTO, LotDTO } from '../../online/protocol';

/** Клиент REST API онлайн-сервера. Токен и идентификатор устройства хранятся в localStorage. */
export class OnlineApi {
  token: string | null = null;
  private seq = 0;

  constructor(public base: string) {}

  get wsUrl(): string {
    return this.base.replace(/^http/, 'ws');
  }

  private rid(): string {
    return `${Date.now().toString(36)}-${(++this.seq).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async call<T>(method: 'GET' | 'POST', path: string, body?: Record<string, unknown>): Promise<T> {
    let res: Response;
    try {
      res = await fetch(this.base + path, {
        method,
        headers: { 'content-type': 'application/json', ...(this.token ? { authorization: `Bearer ${this.token}` } : {}) },
        body: method === 'POST' ? JSON.stringify({ requestId: this.rid(), ...(body ?? {}) }) : undefined,
      });
    } catch {
      throw new ApiFailure(0, 'offline');
    }
    const json = await res.json().catch(() => ({ error: 'bad_json' }));
    if (!res.ok) throw new ApiFailure(res.status, (json as { error?: string }).error ?? 'error');
    return json as T;
  }

  get = <T>(path: string) => this.call<T>('GET', path);
  post = <T>(path: string, body?: Record<string, unknown>) => this.call<T>('POST', path, body);

  async guest(deviceId: string): Promise<void> {
    const r = await this.post<{ token: string }>('/api/auth/guest', { deviceId });
    this.token = r.token;
  }

  async login(email: string, password: string): Promise<void> {
    const r = await this.post<{ token: string }>('/api/auth/login', { email, password });
    this.token = r.token;
  }

  hero = () => this.get<HeroDTO>('/api/hero');
  lots = (q: string) => this.get<LotDTO[]>(`/api/auction${q ? `?${q}` : ''}`);
  guild = () => this.get<GuildDTO | null>('/api/guild');
}

export class ApiFailure extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

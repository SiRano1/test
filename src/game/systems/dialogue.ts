import { t, fmt, type Loc } from '../../data/loc';
import { npcDef } from '../../data/npcs';
import type { GameState } from '../state';

/** Что диалогам нужно от игры. */
export interface DialogueHost {
  state: GameState;
  flag(id: string): boolean;
  setFlag(id: string, v?: boolean): void;
  give(def: string, qty?: number): void;
  openShop(id: string): void;
  healFull(): void;
  toast(text: string, color?: string): void;
  friendship(npc: string, delta: number): void;
  hearts(npc: string): number;
  startQuest(id: string): void;
  questActive(id: string): boolean;
  questDone(id: string): boolean;
  openBuild(): void;
  openService(kind: 'sharpen' | 'enchant' | 'reroll'): void;
  rep(f: 'church' | 'mages' | 'traders' | 'watch', delta: number): void;
  learnRecipe(id: string): void;
  hasItem(def: string, n?: number): boolean;
  take(def: string, n?: number): boolean;
  readLore(id: string): void;
  openAuction(): void;
}

export interface DChoice {
  text: Loc;
  when?: (h: DialogueHost) => boolean;
  act?: (h: DialogueHost) => void;
  /** Перейти к другой реплике (id). */
  next?: string;
}

export interface DLine {
  id: string;
  npc: string;
  /** Чем выше, тем раньше выбирается. */
  priority: number;
  when?: (h: DialogueHost) => boolean;
  /** Показать один раз (ставит флаг dlg:<id>). */
  once?: boolean;
  pages: Loc[];
  choices?: DChoice[];
  onEnd?: (h: DialogueHost) => void;
  /** Можно выбрать напрямую через next, но не при обычном разговоре. */
  hidden?: boolean;
}

const lines: DLine[] = [];
export function registerLines(ls: DLine[]) {
  lines.push(...ls);
}

export function linesFor(npc: string): DLine[] {
  return lines.filter((l) => l.npc === npc);
}

export function lineById(id: string): DLine | undefined {
  return lines.find((l) => l.id === id);
}

/** Выбрать реплику: наибольший приоритет среди подходящих; среди равных — по дню. */
export function pickLine(h: DialogueHost, npc: string): DLine {
  const ok = linesFor(npc).filter((l) => !l.hidden && (!l.once || !h.flag(`dlg:${l.id}`)) && (!l.when || l.when(h)));
  if (!ok.length) {
    return { id: `${npc}:fallback`, npc, priority: 0, pages: [{ ru: '…', en: '…' }] };
  }
  const top = Math.max(...ok.map((l) => l.priority));
  const best = ok.filter((l) => l.priority === top);
  return best[(h.state.time.totalDays + npc.length) % best.length]!;
}

export class DialogueRunner {
  page = 0;
  done = false;

  constructor(private host: DialogueHost, public npc: string, public line: DLine) {
    this.enter(line);
  }

  private enter(line: DLine) {
    this.line = line;
    this.page = 0;
    if (line.once) this.host.setFlag(`dlg:${line.id}`);
  }

  get speaker(): string {
    return t(npcDef(this.npc).name);
  }

  get text(): string {
    const p = this.line.pages[this.page];
    return fmt(t(p), { hero: this.host.state.hero.name });
  }

  get atLastPage(): boolean {
    return this.page >= this.line.pages.length - 1;
  }

  get choices(): DChoice[] {
    if (!this.atLastPage) return [];
    return (this.line.choices ?? []).filter((c) => !c.when || c.when(this.host));
  }

  /** Следующая страница. Возвращает false, если диалог закончен. */
  advance(): boolean {
    if (this.done) return false;
    if (!this.atLastPage) {
      this.page++;
      return true;
    }
    if (this.choices.length) return true; // ждём выбора
    this.finish();
    return false;
  }

  choose(i: number): boolean {
    const c = this.choices[i];
    if (!c) return !this.done;
    c.act?.(this.host);
    if (c.next) {
      const next = lineById(c.next);
      if (next) {
        this.enter(next);
        return true;
      }
    }
    this.finish();
    return false;
  }

  private finish() {
    if (this.done) return;
    this.done = true;
    this.line.onEnd?.(this.host);
  }
}

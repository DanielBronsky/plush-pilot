import { CONFIG } from '../config';
import { migrate } from '../game/progress';
import type { SaveData } from '../game/progress';
import type { Platform } from './platform';

/**
 * localStorage, который никогда не бросает исключений.
 * В некоторых iframe (Safari, приватный режим, запрет cookie) доступ к нему падает.
 * Тогда данные живут только в памяти до перезагрузки.
 */
export class SafeLocalStorage {
  private memory = new Map<string, string>();
  private ls: Storage | null;

  constructor() {
    this.ls = null;
    try {
      const probe = '__probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      this.ls = window.localStorage;
    } catch {
      this.ls = null;
    }
  }

  get available(): boolean {
    return this.ls !== null;
  }

  getItem(key: string): string | null {
    try {
      if (this.ls) return this.ls.getItem(key);
    } catch {
      // упали — читаем из памяти
    }
    return this.memory.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.memory.set(key, value);
    try {
      this.ls?.setItem(key, value);
    } catch {
      // квота или запрет — остаёмся в памяти
    }
  }
}

/** Загрузка и сохранение прогресса через платформу (SDK-хранилище или localStorage). */
export function loadSave(platform: Platform): SaveData {
  try {
    const raw = platform.getItem(CONFIG.save.key);
    return migrate(raw ? JSON.parse(raw) : null);
  } catch {
    return migrate(null);
  }
}

export function writeSave(platform: Platform, save: SaveData): void {
  try {
    platform.setItem(CONFIG.save.key, JSON.stringify(save));
  } catch {
    // Сохранение недоступно — игра продолжает работать.
  }
}

// Адаптер CrazyGames HTML5 SDK v3.
// Сверено с https://docs.crazygames.com/sdk/intro/ , /sdk/game/ , /sdk/video-ads/ , /sdk/data/ (24.11.2026).
import { CONFIG } from '../config';
import { devLog } from '../log';
import type { AdListeners, Platform } from './platform';
import { SafeLocalStorage } from './storage';

export const CRAZYGAMES_SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';

/** Минимальное описание нужной нам части SDK v3. */
export interface CrazySdk {
  init(): Promise<void>;
  environment: 'local' | 'crazygames' | 'disabled' | string;
  game: {
    loadingStart(): void;
    loadingStop(): void;
    gameplayStart(): void;
    gameplayStop(): void;
    happytime(): void;
    settings?: { muteAudio?: boolean };
    addSettingsChangeListener?(fn: (s: { muteAudio?: boolean }) => void): void;
  };
  ad: {
    requestAd(
      type: 'midgame' | 'rewarded',
      callbacks: {
        adStarted?: () => void;
        adFinished?: () => void;
        adError?: (e: { code?: string; message?: string }) => void;
      },
    ): void;
  };
  data?: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
  };
}

declare global {
  interface Window {
    CrazyGames?: { SDK: CrazySdk };
  }
}

/** Страховка: если SDK так и не вызвал ни одного колбэка, игра не должна зависнуть навсегда. */
const AD_SAFETY_TIMEOUT_MS = 90_000;

export class CrazyGamesPlatform implements Platform {
  readonly name = 'crazygames';
  private readonly sdk: CrazySdk;
  private readonly fallback = new SafeLocalStorage();
  private ads: AdListeners = { start: () => {}, end: () => {} };

  constructor(sdk: CrazySdk) {
    this.sdk = sdk;
  }

  /** Любой вызов SDK обёрнут: ошибка SDK не должна ронять игру. */
  private safe(what: string, fn: () => void): void {
    try {
      fn();
    } catch (e) {
      devLog('crazygames', `${what} failed`, e);
    }
  }

  async init(): Promise<void> {
    // init() вызывается снаружи в loadCrazyGames(); здесь ничего не нужно.
  }

  loadingStart(): void {
    this.safe('loadingStart', () => this.sdk.game.loadingStart());
  }
  loadingStop(): void {
    this.safe('loadingStop', () => this.sdk.game.loadingStop());
  }
  gameplayStart(): void {
    this.safe('gameplayStart', () => this.sdk.game.gameplayStart());
  }
  gameplayStop(): void {
    this.safe('gameplayStop', () => this.sdk.game.gameplayStop());
  }
  happyTime(): void {
    this.safe('happytime', () => this.sdk.game.happytime());
  }

  showMidgameAd(): Promise<void> {
    return this.request('midgame').then(() => undefined);
  }

  showRewardedAd(): Promise<boolean> {
    return this.request('rewarded');
  }

  /**
   * Запрос рекламы. Звук выключаем только в adStarted (так просит документация),
   * включаем в adFinished/adError. true — реклама досмотрена.
   */
  private request(type: 'midgame' | 'rewarded'): Promise<boolean> {
    return new Promise(resolve => {
      let started = false;
      let done = false;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (started) this.ads.end();
        resolve(ok);
      };
      const timer = setTimeout(() => finish(false), AD_SAFETY_TIMEOUT_MS);
      try {
        this.sdk.ad.requestAd(type, {
          adStarted: () => {
            started = true;
            this.ads.start();
          },
          adFinished: () => finish(true),
          adError: e => {
            devLog('crazygames', `${type} ad error`, e?.code, e?.message);
            finish(false);
          },
        });
      } catch (e) {
        devLog('crazygames', 'requestAd threw', e);
        finish(false);
      }
    });
  }

  getItem(key: string): string | null {
    try {
      if (this.sdk.data) return this.sdk.data.getItem(key);
    } catch (e) {
      devLog('crazygames', 'data.getItem failed, using localStorage', e);
    }
    return this.fallback.getItem(key);
  }

  setItem(key: string, value: string): void {
    try {
      if (this.sdk.data) {
        this.sdk.data.setItem(key, value);
        return;
      }
    } catch (e) {
      devLog('crazygames', 'data.setItem failed, using localStorage', e);
    }
    this.fallback.setItem(key, value);
  }

  setAdListeners(l: AdListeners): void {
    this.ads = l;
  }

  onPlatformMute(cb: (muted: boolean) => void): void {
    this.safe('muteAudio', () => {
      cb(Boolean(this.sdk.game.settings?.muteAudio));
      this.sdk.game.addSettingsChangeListener?.(s => cb(Boolean(s?.muteAudio)));
    });
  }
}

/** Подключить скрипт SDK. false — не загрузился за отведённое время (офлайн, блокировщик). */
export function loadScript(src: string, timeoutMs: number): Promise<boolean> {
  return new Promise(resolve => {
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    const timer = setTimeout(() => resolve(false), timeoutMs);
    el.onload = () => {
      clearTimeout(timer);
      resolve(true);
    };
    el.onerror = () => {
      clearTimeout(timer);
      resolve(false);
    };
    document.head.appendChild(el);
  });
}

/**
 * Загрузить и инициализировать SDK CrazyGames.
 * null — SDK недоступен или мы не на CrazyGames (environment 'disabled').
 */
export async function loadCrazyGames(): Promise<CrazyGamesPlatform | null> {
  try {
    if (!window.CrazyGames?.SDK) {
      const ok = await loadScript(CRAZYGAMES_SDK_URL, CONFIG.ads.sdkLoadTimeoutMs);
      if (!ok || !window.CrazyGames?.SDK) return null;
    }
    const sdk = window.CrazyGames.SDK;
    await Promise.race([
      sdk.init(),
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error('init timeout')), CONFIG.ads.sdkLoadTimeoutMs),
      ),
    ]);
    devLog('crazygames', 'environment', sdk.environment);
    if (sdk.environment === 'disabled') return null;
    return new CrazyGamesPlatform(sdk);
  } catch (e) {
    devLog('crazygames', 'SDK unavailable', e);
    return null;
  }
}

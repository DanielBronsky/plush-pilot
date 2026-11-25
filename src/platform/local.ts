import { CONFIG } from '../config';
import { devLog } from '../log';
import type { AdListeners, Platform } from './platform';
import { SafeLocalStorage } from './storage';

export interface LocalOptions {
  /** Показывать имитацию рекламы (в dev — да; как запасной вариант в production — нет). */
  simulateAds: boolean;
  /** Имитировать отказ рекламы (?ads=fail) — проверить ветку «реклама недоступна». */
  failAds?: boolean;
  /** ?ads=now — показывать midgame сразу, без 3-минутных ограничений (только для проверки). */
  adsNow?: boolean;
}

/**
 * Платформа для разработки и запасной вариант, если SDK портала недоступен.
 * Реклама — серый оверлей на 2 секунды, все вызовы пишутся в консоль (только в dev).
 */
export class LocalPlatform implements Platform {
  readonly name = 'local';
  private readonly storage = new SafeLocalStorage();
  private ads: AdListeners = { start: () => {}, end: () => {} };
  private readonly opt: LocalOptions;

  constructor(opt: LocalOptions) {
    this.opt = opt;
  }

  /** Режим проверки рекламы: midgame без ограничений по времени. */
  get adsNow(): boolean {
    return Boolean(this.opt.adsNow && this.opt.simulateAds);
  }

  private log(...args: unknown[]): void {
    devLog('platform', ...args);
  }

  async init(): Promise<void> {
    this.log('init', { localStorage: this.storage.available, ...this.opt });
  }
  loadingStart(): void {
    this.log('loadingStart');
  }
  loadingStop(): void {
    this.log('loadingStop');
  }
  gameplayStart(): void {
    this.log('gameplayStart');
  }
  gameplayStop(): void {
    this.log('gameplayStop');
  }
  happyTime(): void {
    this.log('happyTime');
  }

  async showMidgameAd(): Promise<void> {
    this.log('midgame ad requested');
    if (!this.opt.simulateAds || this.opt.failAds) return;
    await this.fakeAd('Midgame ad (simulated)');
  }

  async showRewardedAd(): Promise<boolean> {
    this.log('rewarded ad requested');
    if (!this.opt.simulateAds || this.opt.failAds) {
      this.log('rewarded ad unavailable');
      return false;
    }
    await this.fakeAd('Rewarded ad (simulated)');
    return true;
  }

  private fakeAd(label: string): Promise<void> {
    return new Promise(resolve => {
      const el = document.createElement('div');
      el.textContent = label;
      el.style.cssText =
        'position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;' +
        'background:rgba(20,20,30,.92);color:#fff;font:700 22px system-ui,sans-serif;';
      document.body.appendChild(el);
      this.ads.start();
      setTimeout(() => {
        el.remove();
        this.ads.end();
        this.log('ad finished');
        resolve();
      }, CONFIG.ads.localAdDurationMs);
    });
  }

  getItem(key: string): string | null {
    return this.storage.getItem(key);
  }
  setItem(key: string, value: string): void {
    this.storage.setItem(key, value);
  }
  setAdListeners(l: AdListeners): void {
    this.ads = l;
  }
  onPlatformMute(): void {
    // В локальном режиме портала нет.
  }
}

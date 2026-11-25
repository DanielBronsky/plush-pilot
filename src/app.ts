import { Container } from 'pixi.js';
import type { Application } from 'pixi.js';
import { track } from './analytics';
import type { RewardedPlacement } from './analytics';
import type { AudioManager } from './audio/audio';
import { CONFIG } from './config';
import { canShowMidgame } from './game/adPolicy';
import type { AdClock } from './game/adPolicy';
import type { SaveData, Settings } from './game/progress';
import { devLog } from './log';
import type { Platform } from './platform/platform';
import { writeSave } from './platform/storage';
import { Tweens, ease } from './render/tween';
import { Button } from './ui/button';
import { readSafeInsets } from './ui/layout';
import type { Insets } from './ui/layout';
import type { Screen } from './ui/screen';
import { GameScreen } from './ui/screens/gameScreen';
import { MenuScreen } from './ui/screens/menuScreen';
import { showToast } from './ui/toast';

/** Связывает Pixi, экраны, сохранения, звук, платформу и рекламу. */
export class App {
  readonly pixi: Application;
  readonly tweens = new Tweens();
  readonly audio: AudioManager;
  readonly platform: Platform;
  save: SaveData;
  safe: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

  private screen: Screen | null = null;
  private readonly screenLayer = new Container();
  private readonly toastLayer = new Container();
  private gameplayActive = false;
  private adInProgress = false;
  private readonly adClock: AdClock;
  frameErrors = 0;

  constructor(pixi: Application, platform: Platform, audio: AudioManager, save: SaveData) {
    this.pixi = pixi;
    this.platform = platform;
    this.audio = audio;
    this.save = save;
    this.adClock = { sessionStart: performance.now(), lastAdAt: null };
    pixi.stage.addChild(this.screenLayer, this.toastLayer);
    this.toastLayer.eventMode = 'none';
  }

  get width(): number {
    return this.pixi.screen.width;
  }
  get height(): number {
    return this.pixi.screen.height;
  }

  start(): void {
    this.applySettings();
    Button.onAnyTap = () => this.audio.play('button');
    this.pixi.ticker.add(tk => {
      try {
        this.tweens.update(tk.deltaMS);
        this.screen?.update(tk.deltaMS);
      } catch (e) {
        this.frameErrors++;
        devLog('app', 'frame error', e);
      }
    });
    this.pixi.renderer.on('resize', () => this.layout());
    window.addEventListener('orientationchange', () => setTimeout(() => this.layout(), 300));
    const setFocus = (f: boolean) => {
      this.audio.setMuted('focus', !f);
      if (!f) this.screen?.onAutoPause();
    };
    document.addEventListener('visibilitychange', () => setFocus(!document.hidden));
    window.addEventListener('blur', () => setFocus(false));
    window.addEventListener('focus', () => setFocus(true));
    const unlock = () => this.audio.unlock();
    for (const ev of ['pointerdown', 'pointerup', 'touchend', 'keydown'] as const)
      window.addEventListener(ev, unlock);
    this.platform.setAdListeners({
      start: () => this.audio.setMuted('ad', true),
      end: () => this.audio.setMuted('ad', false),
    });
    this.platform.onPlatformMute(m => this.audio.setMuted('platform', m));
    this.goMenu();
  }

  layout(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.render.maxResolution);
    if (dpr !== this.pixi.renderer.resolution) {
      this.pixi.renderer.resolution = dpr;
      this.pixi.renderer.resize(window.innerWidth, window.innerHeight);
    }
    this.safe = readSafeInsets();
    this.screen?.layout(this.width, this.height, this.safe);
  }

  private show(next: Screen): void {
    const prev = this.screen;
    this.screen = next;
    this.screenLayer.addChild(next);
    next.layout(this.width, this.height, this.safe);
    if (prev) {
      prev.interactiveChildren = false;
      this.tweens.killOwner(prev);
      this.tweens.to(prev, { alpha: 0 }, { duration: 220 }).then(() => prev.destroy());
    }
    next.alpha = 0;
    this.tweens.to(next, { alpha: 1 }, { duration: 220, ease: ease.outCubic });
  }

  goMenu(): void {
    this.gameplay(false);
    this.show(new MenuScreen(this));
  }

  play(): void {
    this.show(new GameScreen(this));
  }

  setBackground(color: number): void {
    this.pixi.renderer.background.color = color;
    const css = `#${color.toString(16).padStart(6, '0')}`;
    document.documentElement.style.background = css;
    document.body.style.background = css;
  }

  gameplay(on: boolean): void {
    if (on === this.gameplayActive) return;
    this.gameplayActive = on;
    if (on) this.platform.gameplayStart();
    else this.platform.gameplayStop();
  }

  updateSettings(patch: Partial<Settings>): void {
    this.save = { ...this.save, settings: { ...this.save.settings, ...patch } };
    this.persist();
    this.applySettings();
  }

  private applySettings(): void {
    this.audio.setSound(this.save.settings.sound);
    this.audio.setMusic(this.save.settings.music);
  }

  /** Конец забега: монеты в копилку, лучшая волна. */
  finishRun(wave: number, coins: number): void {
    this.save = {
      ...this.save,
      coins: this.save.coins + coins,
      bestWave: Math.max(this.save.bestWave, wave),
    };
    this.persist();
  }

  persist(): void {
    writeSave(this.platform, this.save);
  }

  /** Midgame между забегами (по правилам интервала). */
  async maybeMidgame(afterWave: number): Promise<void> {
    if (this.adInProgress || !canShowMidgame(performance.now(), this.adClock)) return;
    track('midgame_shown', { afterWave });
    await this.runAd(() => this.platform.showMidgameAd());
  }

  async rewarded(placement: RewardedPlacement): Promise<boolean> {
    if (this.adInProgress) return false;
    track('rewarded_offer_shown', { placement });
    const last = this.adClock.lastAdAt;
    const ok = await this.runAd(() => this.platform.showRewardedAd());
    if (!ok) {
      this.adClock.lastAdAt = last;
      this.toast('Ad not available right now');
    }
    track('rewarded_watched', { placement, success: ok });
    return ok;
  }

  private async runAd<T>(show: () => Promise<T>): Promise<T | false> {
    this.adInProgress = true;
    this.pixi.stage.interactiveChildren = false;
    try {
      return await show();
    } catch (e) {
      devLog('app', 'ad error', e);
      return false;
    } finally {
      this.adClock.lastAdAt = performance.now();
      this.adInProgress = false;
      this.pixi.stage.interactiveChildren = true;
      this.audio.setMuted('ad', false);
    }
  }

  toast(text: string): void {
    showToast(this.toastLayer, this.tweens, text, this.width, this.height - this.safe.bottom - 110);
  }

  get currentScreen(): Screen | null {
    return this.screen;
  }
}

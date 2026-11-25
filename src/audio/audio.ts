import { CONFIG } from '../config';
import { devLog } from '../log';
import { FileMusic, Music } from './music';
import type { MusicPlayer } from './music';
import { SampleBank } from './samples';
import { playSfx } from './sfx';
import type { SfxName } from './sfx';

export type { SfxName };

/**
 * Звук игры.
 * - AudioContext создаётся только после первого жеста пользователя (unlock).
 * - Звук глушится по любой из причин: потеря фокуса, реклама, просьба портала.
 * - Пока всё заглушено, контекст ставится на паузу (не тратит батарею).
 */
export class AudioManager {
  sound = true;
  music = true;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private tune: MusicPlayer | null = null;
  private readonly samples = new SampleBank();
  private readonly mutedBy = new Set<string>();

  /** Вызывается на первом pointerdown/keydown. Повторные вызовы безопасны. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctx =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        this.sfxBus = this.ctx.createGain();
        this.sfxBus.connect(this.master);
        this.musicBus = this.ctx.createGain();
        this.musicBus.connect(this.master);
        const ctx = this.ctx;
        const bus = this.musicBus;
        const file = CONFIG.audio.musicFile;
        const procedural = () => new Music(ctx, bus, CONFIG.audio.musicBpm);
        this.tune = file ? new FileMusic(ctx, bus, file, procedural) : procedural();
        this.samples.load(ctx);
        this.apply();
      }
      if (this.ctx.state === 'suspended' && this.mutedBy.size === 0)
        void this.ctx.resume().catch(() => {});
    } catch (e) {
      devLog('audio', 'unlock failed', e);
    }
  }

  /**
   * Контекст стоит и его надо возобновить. Кроме 'suspended' бывает 'interrupted' —
   * так iOS Safari помечает звук после звонка, Siri или возврата из фона.
   */
  private get needsResume(): boolean {
    const st = this.ctx?.state as string | undefined;
    return st !== undefined && st !== 'running' && st !== 'closed';
  }

  get unlocked(): boolean {
    return this.ctx !== null;
  }

  get state(): string {
    return this.ctx?.state ?? 'none';
  }

  get muted(): boolean {
    return this.mutedBy.size > 0;
  }

  play(name: SfxName, variant = 0): void {
    if (!this.ctx || !this.sfxBus || !this.sound || this.muted || this.ctx.state !== 'running')
      return;
    try {
      if (!this.samples.play(this.ctx, this.sfxBus, name, variant))
        playSfx(this.ctx, this.sfxBus, name, variant);
    } catch (e) {
      devLog('audio', 'sfx failed', e);
    }
  }

  setMuted(reason: string, muted: boolean): void {
    if (muted) this.mutedBy.add(reason);
    else this.mutedBy.delete(reason);
    this.apply();
  }

  setSound(on: boolean): void {
    this.sound = on;
    this.apply();
  }

  setMusic(on: boolean): void {
    this.music = on;
    this.apply();
  }

  private apply(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.sfxBus || !this.musicBus) return;
    const t = ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : CONFIG.audio.masterVolume, t, 0.03);
    this.sfxBus.gain.setTargetAtTime(this.sound ? CONFIG.audio.sfxVolume : 0, t, 0.03);
    this.musicBus.gain.setTargetAtTime(this.music ? CONFIG.audio.musicVolume : 0, t, 0.3);
    // Музыка-файл играет сама по себе: на паузе/в рекламе её надо остановить явно.
    if (this.music && !this.muted) this.tune?.start();
    else this.tune?.stop();
    try {
      if (this.muted && ctx.state === 'running') void ctx.suspend().catch(() => {});
      if (!this.muted && this.needsResume) void ctx.resume().catch(() => {});
    } catch {
      // некоторые браузеры бросают при suspend/resume в момент закрытия вкладки
    }
  }
}

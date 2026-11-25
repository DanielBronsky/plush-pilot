/** Слой над SDK портала. Игра знает только этот интерфейс. */
export interface Platform {
  readonly name: string;
  init(): Promise<void>;
  loadingStart(): void;
  loadingStop(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  happyTime(): void;
  /** Межуровневая реклама. Завершается всегда (даже при ошибке). */
  showMidgameAd(): Promise<void>;
  /** Реклама за награду. true — досмотрена, награду можно выдать. */
  showRewardedAd(): Promise<boolean>;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  /** Слушатели реального начала/конца рекламы (выключить звук, поставить паузу). */
  setAdListeners(l: AdListeners): void;
  /** Портал просит выключить звук (у CrazyGames — settings.muteAudio). */
  onPlatformMute(cb: (muted: boolean) => void): void;
}

export interface AdListeners {
  start(): void;
  end(): void;
}

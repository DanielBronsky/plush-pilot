import { CONFIG } from '../config';

export interface Settings {
  sound: boolean;
  music: boolean;
  /** Автоприцел: самолёт сам стреляет по ближайшему врагу. */
  autoAim: boolean;
}

export interface SaveData {
  v: number;
  /** Лучшая достигнутая волна. */
  bestWave: number;
  coins: number;
  settings: Settings;
}

export function defaultSave(): SaveData {
  return {
    v: CONFIG.save.version,
    bestWave: 0,
    coins: 0,
    settings: { sound: true, music: true, autoAim: false },
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const int = (v: unknown, min: number, max: number, def: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.floor(v))) : def;

/** Привести любые данные к текущему формату. Никогда не бросает. */
export function migrate(raw: unknown): SaveData {
  const out = defaultSave();
  if (!isObj(raw)) return out;
  out.bestWave = int(raw.bestWave, 0, 1e6, 0);
  out.coins = int(raw.coins, 0, 1e9, 0);
  if (isObj(raw.settings)) {
    const s = raw.settings;
    if (typeof s.sound === 'boolean') out.settings.sound = s.sound;
    if (typeof s.music === 'boolean') out.settings.music = s.music;
    if (typeof s.autoAim === 'boolean') out.settings.autoAim = s.autoAim;
  }
  return out;
}

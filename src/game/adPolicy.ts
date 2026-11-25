import { CONFIG } from '../config';

type AdsConfig = typeof CONFIG.ads;

export interface AdClock {
  sessionStart: number;
  lastAdAt: number | null;
}

/** Можно ли показать midgame-рекламу сейчас: не в первые минуты сессии и не чаще интервала. */
export function canShowMidgame(now: number, clock: AdClock, cfg: AdsConfig = CONFIG.ads): boolean {
  if (now - clock.sessionStart < cfg.midgameSessionGraceMs) return false;
  if (clock.lastAdAt !== null && now - clock.lastAdAt < cfg.midgameIntervalMs) return false;
  return true;
}

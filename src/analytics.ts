// Внутренняя аналитика без внешних сервисов.
// В dev события пишутся в консоль. В production пока никуда не уходят:
// чтобы подключить отправку, добавьте приёмник через addAnalyticsSink().
import { devLog } from './log';

export interface AnalyticsEvents {
  run_start: { bestWave: number };
  run_end: { wave: number; kills: number; coins: number; timeMs: number };
  rewarded_offer_shown: { placement: RewardedPlacement };
  rewarded_watched: { placement: RewardedPlacement; success: boolean };
  midgame_shown: { afterWave: number };
}

export type RewardedPlacement = 'revive' | 'double';
export type AnalyticsEvent = keyof AnalyticsEvents;
export type Sink = <E extends AnalyticsEvent>(event: E, data: AnalyticsEvents[E]) => void;

const sinks: Sink[] = [(event, data) => devLog('analytics', event, data)];

export function addAnalyticsSink(sink: Sink): void {
  sinks.push(sink);
}

export function track<E extends AnalyticsEvent>(event: E, data: AnalyticsEvents[E]): void {
  for (const s of sinks) {
    try {
      s(event, data);
    } catch {
      // Аналитика никогда не должна ломать игру.
    }
  }
}

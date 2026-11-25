import { loadCrazyGames } from './crazygames';
import { LocalPlatform } from './local';
import type { Platform } from './platform';

/**
 * Выбор платформы:
 * - ?platform=local        — всегда LocalPlatform с имитацией рекламы;
 * - ?platform=crazygames   — принудительно пробуем SDK CrazyGames (удобно в dev);
 * - dev-сервер (npm run dev) — LocalPlatform;
 * - production-билд        — SDK CrazyGames; если он недоступен или мы не на CrazyGames —
 *                            LocalPlatform без рекламы (rewarded честно отвечает «недоступно»).
 * ?ads=fail — имитировать недоступную рекламу в LocalPlatform.
 * ?ads=now  — показывать midgame после каждого уровня с 3-го, без 3-минутных ограничений
 *             (только LocalPlatform с имитацией; на CrazyGames не действует).
 */
export async function choosePlatform(search: string, isDev: boolean): Promise<Platform> {
  const params = new URLSearchParams(search);
  const forced = params.get('platform');
  const failAds = params.get('ads') === 'fail';
  if (forced === 'local' || (isDev && forced !== 'crazygames')) {
    return new LocalPlatform({ simulateAds: true, failAds, adsNow: params.get('ads') === 'now' });
  }
  const cg = await loadCrazyGames();
  return cg ?? new LocalPlatform({ simulateAds: false });
}

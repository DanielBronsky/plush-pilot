// Синтез звуковых эффектов через Web Audio API. Никаких файлов.
// Каждая функция планирует короткий звук на ctx.currentTime и сама освобождает узлы после окончания.

export type SfxName =
  | 'button'
  | 'shoot'
  | 'enemyShoot'
  | 'hit'
  | 'kill'
  | 'bigKill'
  | 'hurt'
  | 'pickup'
  | 'waveStart'
  | 'waveClear'
  | 'lose';

let noiseBuffer: AudioBuffer | null = null;

function noise(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
  const len = ctx.sampleRate;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buf;
  return buf;
}

/** Огибающая: быстрая атака и экспоненциальное затухание. */
function env(
  ctx: AudioContext,
  out: AudioNode,
  t0: number,
  peak: number,
  attack: number,
  decay: number,
): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  g.connect(out);
  return g;
}

function tone(
  ctx: AudioContext,
  out: AudioNode,
  type: OscillatorType,
  f0: number,
  f1: number,
  t0: number,
  dur: number,
  peak: number,
  attack = 0.005,
): void {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  o.connect(env(ctx, out, t0, peak, attack, dur));
  o.start(t0);
  o.stop(t0 + attack + dur + 0.02);
}

function noiseBurst(
  ctx: AudioContext,
  out: AudioNode,
  t0: number,
  dur: number,
  peak: number,
  filter: BiquadFilterType,
  f0: number,
  f1: number,
  q = 1,
): void {
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  const bq = ctx.createBiquadFilter();
  bq.type = filter;
  bq.Q.value = q;
  bq.frequency.setValueAtTime(f0, t0);
  bq.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  src.connect(bq);
  bq.connect(env(ctx, out, t0, peak, 0.01, dur));
  src.start(t0, Math.random() * 0.5);
  src.stop(t0 + dur + 0.05);
}

/** Гудок: два расстроенных «квадрата» через фильтр (пока не используется). */
export function honk(
  ctx: AudioContext,
  out: AudioNode,
  t0: number,
  dur: number,
  peak: number,
): void {
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1400;
  lp.connect(env(ctx, out, t0, peak, 0.01, dur));
  for (const f of [392, 494]) {
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(f, t0);
    o.connect(lp);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }
}

const NOTE = (semitonesFromA4: number) => 440 * Math.pow(2, semitonesFromA4 / 12);

export function playSfx(ctx: AudioContext, out: AudioNode, name: SfxName, variant = 0): void {
  const t = ctx.currentTime + 0.005;
  switch (name) {
    case 'button':
      tone(ctx, out, 'sine', 900, 650, t, 0.05, 0.16);
      tone(ctx, out, 'triangle', 1800, 1300, t, 0.03, 0.05);
      break;
    case 'shoot': {
      // Игрушечный «пиу»: короткий квадрат вниз по высоте, чуть разный каждый раз.
      const f = 980 + (variant % 5) * 40;
      tone(ctx, out, 'square', f, f * 0.45, t, 0.06, 0.05);
      noiseBurst(ctx, out, t, 0.03, 0.03, 'highpass', 4000, 2500);
      break;
    }
    case 'enemyShoot':
      tone(ctx, out, 'sawtooth', 420, 260, t, 0.1, 0.05);
      break;
    case 'hit':
      tone(ctx, out, 'triangle', 300, 180, t, 0.06, 0.12);
      noiseBurst(ctx, out, t, 0.04, 0.08, 'bandpass', 1800, 900, 2);
      break;
    case 'kill':
      // «Пуф» плюша: шум вниз + писк.
      noiseBurst(ctx, out, t, 0.22, 0.22, 'lowpass', 2400, 300);
      tone(ctx, out, 'sine', 700, 1400, t, 0.08, 0.08);
      break;
    case 'bigKill':
      noiseBurst(ctx, out, t, 0.45, 0.3, 'lowpass', 1600, 120);
      tone(ctx, out, 'sine', 160, 50, t, 0.4, 0.3);
      break;
    case 'hurt':
      tone(ctx, out, 'square', 260, 110, t, 0.22, 0.12);
      noiseBurst(ctx, out, t, 0.12, 0.15, 'lowpass', 900, 200);
      break;
    case 'pickup':
      tone(
        ctx,
        out,
        'square',
        NOTE(26 + (variant % 3) * 2),
        NOTE(26 + (variant % 3) * 2),
        t,
        0.04,
        0.04,
      );
      tone(
        ctx,
        out,
        'square',
        NOTE(31 + (variant % 3) * 2),
        NOTE(31 + (variant % 3) * 2),
        t + 0.05,
        0.1,
        0.04,
      );
      break;
    case 'waveStart':
      [0, 5, 9].forEach((s, i) =>
        tone(ctx, out, 'triangle', NOTE(s + 3), NOTE(s + 3), t + i * 0.08, 0.16, 0.12),
      );
      break;
    case 'waveClear':
      [3, 7, 10, 15].forEach((s, i) => {
        tone(ctx, out, 'triangle', NOTE(s), NOTE(s), t + i * 0.09, 0.28, 0.16);
        tone(ctx, out, 'sine', NOTE(s + 12), NOTE(s + 12), t + i * 0.09, 0.18, 0.05);
      });
      break;
    case 'lose':
      [-2, -3, -4, -6].forEach((s, i) =>
        tone(ctx, out, 'triangle', NOTE(s), NOTE(s - 0.3), t + i * 0.22, 0.24, 0.16),
      );
      break;
  }
}

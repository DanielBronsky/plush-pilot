// Спокойная процедурная музыка: аккорды I–vi–IV–V, мягкий бас и редкие «капли» пентатоники.
// Планировщик с упреждением: каждые 50 мс планирует ноты на ~0.2 с вперёд по часам AudioContext.
// Когда контекст на паузе (потеря фокуса, реклама), часы стоят — музыка останавливается сама.
import { makeRng } from '../core/rng';

const A4 = 440;
const hz = (midi: number) => A4 * Math.pow(2, (midi - 69) / 12);

// До мажор: C, Am, F, G (корни в MIDI).
const CHORDS = [
  [48, 52, 55, 60],
  [45, 52, 57, 60],
  [41, 53, 57, 60],
  [43, 55, 59, 62],
];
const PENTA = [72, 74, 76, 79, 81, 84];

/** Общий интерфейс музыки: из файла или процедурная (запасной вариант). */
export interface MusicPlayer {
  start(): void;
  stop(): void;
}

/**
 * Музыка из файла (CC0, см. CREDITS.md). Играет через <audio> с loop:
 * так 2-минутный трек не раскодируется целиком в память (≈45 МБ на телефоне).
 * Звук идёт через Web Audio, поэтому общая громкость и заглушение работают как для эффектов.
 * Если файл не загрузится — включается процедурная музыка.
 */
export class FileMusic implements MusicPlayer {
  private readonly el: HTMLAudioElement;
  private wanted = false;
  private fallback: MusicPlayer | null = null;

  constructor(ctx: AudioContext, out: AudioNode, base: string, makeFallback: () => MusicPlayer) {
    const el = new Audio();
    el.loop = true;
    el.preload = 'auto';
    el.crossOrigin = 'anonymous';
    // Только AAC (.m4a): его играют все основные браузеры, а файл втрое меньше OGG.
    // Где AAC нет (редкие сборки Firefox на Linux) — процедурная музыка.
    const useFallback = () => {
      if (this.fallback) return;
      this.fallback = makeFallback();
      if (this.wanted) this.fallback.start();
    };
    el.addEventListener('error', useFallback);
    if (el.canPlayType('audio/mp4; codecs="mp4a.40.2"') === '') queueMicrotask(useFallback);
    else el.src = `${base}.m4a`;
    this.el = el;
    try {
      ctx.createMediaElementSource(el).connect(out);
    } catch {
      // Без Web Audio-маршрута музыка всё равно играет, но громкость регулируется только элементом.
    }
  }

  start(): void {
    this.wanted = true;
    if (this.fallback) {
      this.fallback.start();
      return;
    }
    if (this.el.paused) void this.el.play().catch(() => {});
  }

  stop(): void {
    this.wanted = false;
    this.fallback?.stop();
    if (!this.el.paused) this.el.pause();
  }
}

export class Music implements MusicPlayer {
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextTime = 0;
  private step = 0;
  private readonly rng = makeRng(2024);
  private readonly ctx: AudioContext;
  private readonly out: AudioNode;
  private readonly beat: number;

  constructor(ctx: AudioContext, out: AudioNode, bpm: number) {
    this.ctx = ctx;
    this.out = out;
    this.beat = 60 / bpm;
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  start(): void {
    if (this.timer) return;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 50);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private schedule(): void {
    const ahead = this.ctx.currentTime + 0.2;
    // После долгой паузы не «догоняем» пропущенные ноты.
    if (this.nextTime < this.ctx.currentTime - 0.5) this.nextTime = this.ctx.currentTime + 0.05;
    while (this.nextTime < ahead) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += this.beat / 2; // восьмые
      this.step = (this.step + 1) % (8 * 4 * 2);
    }
  }

  private playStep(step: number, t: number): void {
    const bar = Math.floor(step / 8) % 4;
    const inBar = step % 8;
    const chord = CHORDS[bar]!;
    if (inBar === 0) {
      // Пэд на весь такт.
      for (const n of chord.slice(1)) this.note('triangle', hz(n), t, this.beat * 4, 0.035, 0.4);
      this.note('sine', hz(chord[0]! - 12), t, this.beat * 1.6, 0.12, 0.02);
    }
    if (inBar === 4) this.note('sine', hz(chord[0]! - 12), t, this.beat * 1.4, 0.09, 0.02);
    // Мелодия: редкие ноты пентатоники.
    if (inBar % 2 === 0 && this.rng.next() < 0.45) {
      const n = PENTA[Math.floor(this.rng.next() * PENTA.length)]!;
      this.note('sine', hz(n), t, this.beat * 0.9, 0.05, 0.005);
    }
  }

  private note(
    type: OscillatorType,
    f: number,
    t: number,
    dur: number,
    peak: number,
    attack: number,
  ): void {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}

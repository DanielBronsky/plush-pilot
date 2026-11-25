// Звуки из файлов (CC0, Kenney — см. CREDITS.md). Грузятся после первого жеста пользователя.
// Пока файл не загрузился (или не загрузится вовсе), играет синтезированная замена из sfx.ts.
import { devLog } from '../log';
import type { SfxName } from './sfx';

interface SampleDef {
  files: string[];
  /** Громкость относительно остальных звуков. */
  gain: number;
}

/**
 * Какие файлы из public/sfx играют на каждое событие. Пока файлов нет — всё синтезируется (sfx.ts).
 * Чтобы заменить звук файлом, положите public/sfx/<имя>.wav и впишите имя сюда.
 */
export const SAMPLES: Partial<Record<SfxName, SampleDef>> = {};

const MAJOR = [0, 2, 4, 5, 7, 9, 11];

/**
 * Скорость воспроизведения (= высота тона) для вариантов звука:
 * звёзды звучат всё выше, комбо поднимается по мажорной гамме, выезд — чуть разный каждый раз.
 */
export function playbackRate(name: SfxName, variant: number, random = Math.random()): number {
  const semis = (n: number) => Math.pow(2, n / 12);
  switch (name) {
    case 'pickup':
      return semis(MAJOR[variant % 7]!);
    case 'shoot':
    case 'hit':
      return 0.92 + random * 0.16;
    default:
      return 1;
  }
}

export class SampleBank {
  private readonly buffers = new Map<string, AudioBuffer>();
  private loading = false;

  /** Загрузить все файлы. Ошибки не роняют игру: для таких звуков останется синтез. */
  load(ctx: AudioContext, base = 'sfx/'): void {
    if (this.loading) return;
    this.loading = true;
    const names = new Set(Object.values(SAMPLES).flatMap(s => s?.files ?? []));
    for (const file of names) {
      fetch(`${base}${file}.wav`)
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.arrayBuffer();
        })
        // Старый Safari знает только колбэк-версию decodeAudioData.
        .then(
          data =>
            new Promise<AudioBuffer>((resolve, reject) =>
              ctx.decodeAudioData(data, resolve, reject),
            ),
        )
        .then(buf => this.buffers.set(file, buf))
        .catch(e => devLog('audio', `sample ${file} failed`, e));
    }
  }

  /** Сыграть звук из файла. false — файла нет (ещё не загружен), нужен синтез. */
  play(ctx: AudioContext, out: AudioNode, name: SfxName, variant = 0): boolean {
    const def = SAMPLES[name];
    if (!def) return false;
    const ready = def.files.filter(f => this.buffers.has(f));
    if (ready.length === 0) return false;
    const file = ready[Math.floor(Math.random() * ready.length)]!;
    const src = ctx.createBufferSource();
    src.buffer = this.buffers.get(file)!;
    src.playbackRate.value = playbackRate(name, variant);
    const g = ctx.createGain();
    g.gain.value = def.gain;
    src.connect(g).connect(out);
    src.onended = () => {
      src.disconnect();
      g.disconnect();
    };
    src.start();
    return true;
  }
}

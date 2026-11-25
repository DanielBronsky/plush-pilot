// Маленький tween-модуль. Не зависит от Pixi: обновляется вызовом update(dtMs)
// из тикера приложения, поэтому его можно тестировать в Node.

export type Ease = (t: number) => number;

export const ease = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  inCubic: (t: number) => t * t * t,
  outQuad: (t: number) => t * (2 - t),
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outElastic: (t: number) =>
    t === 0 || t === 1
      ? t
      : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
} satisfies Record<string, Ease>;

type Numeric = Record<string, number>;

export interface TweenOptions {
  duration: number;
  ease?: Ease;
  delay?: number;
  /** Объект-«владелец» для массовой отмены через killOwner (например, экран). */
  owner?: object;
  onUpdate?: (t: number) => void;
  onComplete?: () => void;
}

interface Destroyable {
  destroyed?: boolean;
}

export class Tween {
  elapsed = 0;
  done = false;
  private from: Numeric | null = null;
  private readonly onDone: (() => void)[] = [];

  readonly target: object;
  readonly opts: TweenOptions;
  private readonly to: Numeric;

  constructor(target: object, to: Numeric, opts: TweenOptions) {
    this.target = target;
    this.to = to;
    this.opts = opts;
  }

  /** Вызывается, когда твин закончился или был отменён. */
  then(fn: () => void): this {
    if (this.done) fn();
    else this.onDone.push(fn);
    return this;
  }

  /** Promise, который выполняется при завершении или отмене. */
  promise(): Promise<void> {
    return new Promise(resolve => this.then(resolve));
  }

  /** Возвращает true, когда твин закончен. */
  step(dt: number): boolean {
    if (this.done) return true;
    if ((this.target as Destroyable).destroyed) {
      this.finish(false);
      return true;
    }
    this.elapsed += dt;
    const delay = this.opts.delay ?? 0;
    if (this.elapsed < delay) return false;

    const obj = this.target as Numeric;
    if (!this.from) {
      this.from = {};
      for (const k of Object.keys(this.to)) this.from[k] = obj[k] ?? 0;
    }
    const raw =
      this.opts.duration <= 0 ? 1 : Math.min(1, (this.elapsed - delay) / this.opts.duration);
    const k = (this.opts.ease ?? ease.outQuad)(raw);
    for (const key of Object.keys(this.to)) {
      const a = this.from[key] ?? 0;
      obj[key] = a + (this.to[key]! - a) * k;
    }
    this.opts.onUpdate?.(k);
    if (raw >= 1) {
      this.finish(true);
      return true;
    }
    return false;
  }

  /** Завершить: complete=true — с вызовом onComplete, false — тихая отмена. */
  finish(complete: boolean): void {
    if (this.done) return;
    this.done = true;
    if (complete) this.opts.onComplete?.();
    for (const fn of this.onDone.splice(0)) fn();
  }
}

export class Tweens {
  private list: Tween[] = [];
  /** Множитель длительностей (режим «уменьшить анимации»). */
  speedFactor = 1;

  /** Плавно изменить числовые поля target до значений props. */
  to(target: object, props: Numeric, opts: TweenOptions): Tween {
    const scaled: TweenOptions = {
      ...opts,
      duration: opts.duration * this.speedFactor,
      delay: (opts.delay ?? 0) * this.speedFactor,
    };
    const tw = new Tween(target, props, scaled);
    this.list.push(tw);
    return tw;
  }

  /** Анимация произвольной функции от 0 до 1 (тряска, кривые и т. п.). */
  run(
    duration: number,
    onUpdate: (t: number) => void,
    opts: Omit<TweenOptions, 'duration' | 'onUpdate'> & { target?: object } = {},
  ): Tween {
    // Если target уничтожен (например, Pixi-объект), анимация тихо останавливается.
    const target = opts.target as Destroyable | undefined;
    const proxy = {
      t: 0,
      get destroyed() {
        return target?.destroyed ?? false;
      },
    };
    return this.to(
      proxy,
      { t: 1 },
      { ...opts, duration, ease: opts.ease ?? ease.linear, onUpdate },
    );
  }

  /** Подождать (с учётом speedFactor). */
  wait(ms: number, owner?: object): Tween {
    return this.to({}, {}, { duration: ms, owner });
  }

  update(dtMs: number): void {
    const dt = Math.min(dtMs, 100);
    if (this.list.length === 0) return;
    // Копия: колбэки могут добавлять новые твины.
    const current = this.list;
    this.list = [];
    const keep: Tween[] = [];
    for (const tw of current) if (!tw.step(dt)) keep.push(tw);
    this.list = keep.concat(this.list);
  }

  /** Отменить все твины для target (без onComplete). */
  killOf(target: object): void {
    this.list = this.list.filter(tw => {
      if (tw.target !== target) return true;
      tw.finish(false);
      return false;
    });
  }

  /** Отменить все твины владельца (без onComplete). */
  killOwner(owner: object): void {
    this.list = this.list.filter(tw => {
      if (tw.opts.owner !== owner) return true;
      tw.finish(false);
      return false;
    });
  }

  /** Мгновенно завершить всё (с onComplete). */
  completeAll(): void {
    const current = this.list;
    this.list = [];
    for (const tw of current) tw.finish(true);
  }

  get count(): number {
    return this.list.length;
  }
}

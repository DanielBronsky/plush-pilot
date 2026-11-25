// Управление: клавиатура + мышь на компьютере, два виртуальных джойстика на телефоне.
// Возвращает «сырое» намерение игрока; автоприцел добавляет GameScreen.
import { CONFIG } from '../config';

export interface Stick {
  /** Центр (где палец коснулся) и текущее отклонение, CSS px. */
  ox: number;
  oy: number;
  dx: number;
  dy: number;
  pointer: number;
}

export class InputController {
  /** Клавиатура. */
  private readonly keys = new Set<string>();
  /** Мышь: позиция в CSS px и зажата ли кнопка. */
  mouse = { x: 0, y: 0, down: false, seen: false };
  /** Джойстики: левый — полёт, правый — прицел и огонь. */
  left: Stick | null = null;
  right: Stick | null = null;
  /** Было ли касание пальцем — значит, телефон: показываем джойстики. */
  touchUsed = false;
  private readonly cleanups: (() => void)[] = [];
  private readonly el: HTMLElement;

  constructor(el: HTMLElement) {
    this.el = el;
    const on = <K extends keyof WindowEventMap>(
      t: K,
      fn: (e: WindowEventMap[K]) => void,
      opts?: AddEventListenerOptions,
    ) => {
      window.addEventListener(t, fn, opts);
      this.cleanups.push(() => window.removeEventListener(t, fn));
    };
    on('keydown', e => this.keys.add(e.code));
    on('keyup', e => this.keys.delete(e.code));
    on('blur', () => {
      this.keys.clear();
      this.mouse.down = false;
      this.left = this.right = null;
    });
    on('pointerdown', e => this.down(e));
    on('pointermove', e => this.move(e));
    on('pointerup', e => this.up(e));
    on('pointercancel', e => this.up(e));
  }

  private local(e: PointerEvent): { x: number; y: number } {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private down(e: PointerEvent): void {
    const p = this.local(e);
    if (e.pointerType === 'mouse') {
      this.mouse = { x: p.x, y: p.y, down: e.button === 0, seen: true };
      return;
    }
    this.touchUsed = true;
    const stick: Stick = { ox: p.x, oy: p.y, dx: 0, dy: 0, pointer: e.pointerId };
    const half = this.el.clientWidth / 2;
    if (p.x < half && !this.left) this.left = stick;
    else if (p.x >= half && !this.right) this.right = stick;
  }

  private move(e: PointerEvent): void {
    const p = this.local(e);
    if (e.pointerType === 'mouse') {
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      this.mouse.seen = true;
      return;
    }
    for (const s of [this.left, this.right]) {
      if (!s || s.pointer !== e.pointerId) continue;
      const R = CONFIG.ui.stickRadius;
      let dx = p.x - s.ox;
      let dy = p.y - s.oy;
      const d = Math.hypot(dx, dy);
      // Палец ушёл далеко — центр джойстика едет за ним.
      if (d > R) {
        s.ox += (dx / d) * (d - R);
        s.oy += (dy / d) * (d - R);
        dx = p.x - s.ox;
        dy = p.y - s.oy;
      }
      s.dx = dx;
      s.dy = dy;
    }
  }

  private up(e: PointerEvent): void {
    if (e.pointerType === 'mouse') {
      if (e.button === 0) this.mouse.down = false;
      return;
    }
    if (this.left?.pointer === e.pointerId) this.left = null;
    if (this.right?.pointer === e.pointerId) this.right = null;
  }

  /** Куда лететь: вектор длиной до 1. */
  moveVector(): { x: number; y: number } {
    const k = this.keys;
    let x =
      (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) -
      (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let y =
      (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    if (this.left) {
      x = this.left.dx / CONFIG.ui.stickRadius;
      y = this.left.dy / CONFIG.ui.stickRadius;
    }
    const len = Math.hypot(x, y);
    return len > 1 ? { x: x / len, y: y / len } : { x, y };
  }

  /** Правый джойстик: направление прицела и огонь (если отклонён достаточно). */
  stickAim(): { x: number; y: number; fire: boolean } | null {
    const s = this.right;
    if (!s) return null;
    const d = Math.hypot(s.dx, s.dy);
    return { x: s.dx, y: s.dy, fire: d > CONFIG.ui.stickRadius * 0.3 };
  }

  get spaceDown(): boolean {
    return this.keys.has('Space');
  }

  destroy(): void {
    for (const c of this.cleanups.splice(0)) c();
  }
}

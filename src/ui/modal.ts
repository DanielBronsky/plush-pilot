import { Container, Graphics, Rectangle, Text } from 'pixi.js';
import type { Tweens } from '../render/tween';
import { ease } from '../render/tween';
import type { Insets } from './layout';
import { UI, textStyle } from './style';
import { destroyChildren } from '../render/destroy';

/**
 * Модальное окно: затемнение (перехватывает касания) и белая панель.
 * Содержимое панели раскладывается сверху вниз через addRow().
 */
export class Modal extends Container {
  readonly panel = new Container();
  private readonly dim = new Graphics();
  private readonly bg = new Graphics();
  private readonly rows: { item: Container; h: number; gap: number }[] = [];
  readonly panelWidth: number;
  private readonly tweens: Tweens;
  private closing = false;
  private baseScale = 1;

  constructor(tweens: Tweens, panelWidth: number, title?: string) {
    super();
    this.tweens = tweens;
    this.panelWidth = panelWidth;
    this.dim.eventMode = 'static'; // блокирует касания под окном
    this.addChild(this.dim, this.panel);
    this.panel.addChild(this.bg);
    if (title) {
      const t = new Text({ text: title, style: textStyle(30, UI.ink, '900') });
      t.anchor.set(0.5);
      if (t.width > panelWidth - 40) t.scale.set((panelWidth - 40) / t.width);
      this.addRow(t, 44, 0);
    }
  }

  /** Добавить элемент (центр по горизонтали), h — высота строки. */
  addRow(item: Container, h: number, gap = 14): void {
    this.rows.push({ item, h, gap });
    this.panel.addChild(item);
  }

  /** safe — вырезы и полоска жестов: панель помещается внутрь безопасной области. */
  layout(w: number, h: number, safe: Insets = { top: 0, right: 0, bottom: 0, left: 0 }): void {
    this.dim.clear().rect(0, 0, w, h).fill({ color: 0x0b1020, alpha: 0.6 });
    this.dim.hitArea = new Rectangle(0, 0, w, h);
    const pad = 26;
    let y = pad;
    for (const r of this.rows) {
      y += r.gap;
      r.item.position.set(0, y + r.h / 2);
      y += r.h;
    }
    const ph = y + pad;
    const pw = this.panelWidth;
    this.bg.clear();
    this.bg.roundRect(-pw / 2, 8, pw, ph, 28).fill({ color: 0x000000, alpha: 0.25 });
    this.bg.roundRect(-pw / 2, 0, pw, ph, 28).fill(UI.panel);
    // Если панель не влезает (маленький альбомный экран) — уменьшаем.
    const availH = h - safe.top - safe.bottom - 24;
    const availW = w - safe.left - safe.right - 24;
    const s = Math.min(1, availH / (ph + 8), availW / pw);
    this.baseScale = s;
    this.tweens.killOf(this.panel.scale);
    this.panel.scale.set(s);
    // Центр вращения/масштаба — середина панели, чтобы она «выпрыгивала» из центра.
    this.panel.pivot.set(0, ph / 2);
    this.panel.position.set(
      safe.left + (w - safe.left - safe.right) / 2,
      safe.top + (h - safe.top - safe.bottom) / 2,
    );
  }

  open(): void {
    this.dim.alpha = 0;
    this.tweens.to(this.dim, { alpha: 1 }, { duration: 180 });
    const s = this.baseScale;
    this.panel.scale.set(s * 0.8);
    this.panel.alpha = 0;
    this.tweens.to(this.panel, { alpha: 1 }, { duration: 160 });
    this.tweens.to(this.panel.scale, { x: s, y: s }, { duration: 260, ease: ease.outBack });
  }

  /** Закрыть с анимацией и уничтожить. */
  close(): Promise<void> {
    if (this.closing) return Promise.resolve();
    this.closing = true;
    this.eventMode = 'none';
    this.tweens.to(this.dim, { alpha: 0 }, { duration: 150 });
    return this.tweens
      .to(this.panel, { alpha: 0 }, { duration: 150 })
      .promise()
      .then(() => this.destroy());
  }

  override destroy(): void {
    if (this.destroyed) return;
    this.tweens.killOf(this.dim);
    this.tweens.killOf(this.panel);
    this.tweens.killOf(this.panel.scale);
    destroyChildren(this);
    super.destroy();
  }
}

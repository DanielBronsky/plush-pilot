import { Container, Graphics, Rectangle, Text } from 'pixi.js';
import { shade } from '../render/color';
import { drawIcon } from './icons';
import type { IconName } from './icons';
import { UI, textStyle } from './style';
import { destroyTree } from '../render/destroy';

export interface ButtonOptions {
  width: number;
  height: number;
  color?: number;
  iconColor?: number;
  icon?: IconName;
  label?: string;
  labelSize?: number;
  /** Цвет текста (по умолчанию как у иконки). */
  labelColor?: number;
  onTap: () => void;
}

/**
 * Кнопка: скруглённый фон с «объёмом», иконка и/или текст, бейдж в углу.
 * Касание: приседает при нажатии, срабатывает на отпускание над кнопкой.
 */
export class Button extends Container {
  /** Общий хук для всех кнопок (звук клика). Задаётся в App. */
  static onAnyTap: () => void = () => {};

  private readonly bg = new Graphics();
  private readonly content = new Container();
  private iconG: Graphics | null = null;
  private labelT: Text | null = null;
  private badge: Container | null = null;
  private badgeValue: string | 'ad' | null = null;
  private opts: ButtonOptions;
  private enabled = true;
  private pressed = false;

  constructor(opts: ButtonOptions) {
    super();
    this.opts = opts;
    this.addChild(this.bg, this.content);
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointerdown', () => this.setPressed(true));
    this.on('pointerup', () => this.setPressed(false));
    this.on('pointerupoutside', () => this.setPressed(false));
    this.on('pointerleave', () => this.setPressed(false));
    this.on('pointertap', () => {
      if (!this.enabled) return;
      Button.onAnyTap();
      this.opts.onTap();
    });
    this.redraw();
  }

  get w(): number {
    return this.opts.width;
  }
  get h(): number {
    return this.opts.height;
  }

  resize(width: number, height: number): void {
    if (width === this.opts.width && height === this.opts.height) return;
    this.opts = { ...this.opts, width, height };
    this.redraw();
  }

  setIcon(icon: IconName): void {
    if (icon === this.opts.icon) return;
    this.opts = { ...this.opts, icon };
    this.redraw();
  }

  /**
   * Переключатель (звук, музыка, анимации): включено — зелёная кнопка с белым значком,
   * выключено — серая с серым значком. Так состояние видно сразу, не только по иконке.
   */
  setToggle(on: boolean, icon: IconName): void {
    const color = on ? UI.green : UI.panelShade;
    const iconColor = on ? UI.white : 0x8a93a8;
    const o = this.opts;
    if (o.color === color && o.iconColor === iconColor && o.icon === icon) return;
    this.opts = { ...o, color, iconColor, icon };
    this.redraw();
  }

  setColor(color: number): void {
    if (color === this.opts.color) return;
    this.opts = { ...this.opts, color };
    this.redraw();
  }

  setLabel(label: string): void {
    if (label === this.opts.label) return;
    this.opts = { ...this.opts, label };
    this.redraw();
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.alpha = on ? 1 : 0.45;
    this.cursor = on ? 'pointer' : 'default';
  }

  /** Бейдж в правом верхнем углу: число/текст, 'ad' — значок рекламы, null — убрать. */
  setBadge(value: string | 'ad' | null): void {
    this.badgeValue = value;
    if (this.badge) destroyTree(this.badge);
    this.badge = null;
    if (value === null) return;
    const r = Math.max(12, this.opts.height * 0.22);
    const b = new Container();
    const g = new Graphics();
    const isAd = value === 'ad';
    g.circle(0, 0, r)
      .fill(isAd ? UI.green : UI.red)
      .stroke({ width: 2.5, color: UI.white });
    b.addChild(g);
    if (isAd) {
      b.addChild(drawIcon(new Graphics(), 'ad', r * 1.15, UI.white));
    } else {
      const t = new Text({ text: value, style: textStyle(r * 1.15, UI.white, '900') });
      t.anchor.set(0.5);
      b.addChild(t);
    }
    b.position.set(this.opts.width / 2 - r * 0.45, -this.opts.height / 2 + r * 0.45);
    b.eventMode = 'none';
    this.badge = b;
    this.addChild(b);
  }

  /** Масштаб кнопки в покое; нажатие «приседает» относительно него. */
  private baseScale = 1;

  setBaseScale(k: number): void {
    this.baseScale = k;
    this.scale.set(this.pressed ? k * 0.94 : k);
  }

  private setPressed(on: boolean): void {
    if (on && !this.enabled) return;
    if (on === this.pressed) return;
    this.pressed = on;
    this.content.y = on ? 2 : 0;
    this.scale.set(this.baseScale * (on ? 0.94 : 1));
  }

  private redraw(): void {
    const { width: w, height: h } = this.opts;
    const color = this.opts.color ?? UI.white;
    const r = Math.min(h * 0.32, 22);
    const depth = Math.max(3, h * 0.07);
    this.bg.clear();
    this.bg.roundRect(-w / 2, -h / 2 + depth, w, h, r).fill({ color: 0x000000, alpha: 0.18 });
    this.bg.roundRect(-w / 2, -h / 2, w, h, r).fill(shade(color, 0.8));
    this.bg.roundRect(-w / 2, -h / 2, w, h - depth, r).fill(color);
    this.hitArea = new Rectangle(-w / 2, -h / 2, w, h + depth);

    this.content.scale.set(1);
    this.iconG?.destroy();
    this.iconG = null;
    this.labelT?.destroy();
    this.labelT = null;
    const ink = this.opts.iconColor ?? UI.ink;
    const iconSize = Math.min(h * 0.5, 34);
    if (this.opts.icon) {
      this.iconG = drawIcon(new Graphics(), this.opts.icon, iconSize, ink, color);
      this.content.addChild(this.iconG);
    }
    if (this.opts.label) {
      const size = this.opts.labelSize ?? Math.round(h * 0.36);
      this.labelT = new Text({
        text: this.opts.label,
        style: textStyle(size, this.opts.labelColor ?? ink, '900'),
      });
      this.labelT.anchor.set(0.5);
      this.content.addChild(this.labelT);
    }
    // Иконка слева от текста, если есть оба.
    const gap = 10;
    const contentY = -depth / 2;
    if (this.iconG && this.labelT) {
      const total = iconSize + gap + this.labelT.width;
      this.iconG.position.set(-total / 2 + iconSize / 2, contentY);
      this.labelT.position.set(-total / 2 + iconSize + gap + this.labelT.width / 2, contentY);
      // Длинная надпись не должна вылезать за кнопку.
      const maxW = w - 24;
      if (total > maxW) this.content.scale.set(maxW / total);
    } else {
      this.iconG?.position.set(0, contentY);
      this.labelT?.position.set(0, contentY);
      if (this.labelT && this.labelT.width > w - 20)
        this.labelT.scale.set((w - 20) / this.labelT.width);
    }
    if (this.badgeValue !== null) this.setBadge(this.badgeValue);
  }
}

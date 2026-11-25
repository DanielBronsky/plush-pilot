import { Container } from 'pixi.js';
import type { App } from '../app';
import type { Insets } from './layout';
import { destroyChildren } from '../render/destroy';

/** Базовый экран. App вызывает layout() при каждом изменении размера окна. */
export abstract class Screen extends Container {
  protected readonly app: App;

  constructor(app: App) {
    super();
    this.app = app;
  }

  abstract layout(w: number, h: number, safe: Insets): void;

  update(_dtMs: number): void {}

  /** Окно потеряло фокус или вкладка скрыта. */
  onAutoPause(): void {}

  override destroy(): void {
    this.app.tweens.killOwner(this);
    destroyChildren(this);
    super.destroy();
  }
}

import { Container, Graphics, Text } from 'pixi.js';
import type { Tweens } from '../render/tween';
import { UI, textStyle } from './style';
import { destroyTree } from '../render/destroy';

/** Короткое сообщение внизу экрана, исчезает само. */
export function showToast(
  layer: Container,
  tweens: Tweens,
  text: string,
  w: number,
  y: number,
): void {
  layer.removeChildren().forEach(c => destroyTree(c));
  const c = new Container();
  const t = new Text({ text, style: textStyle(18, UI.white, '800') });
  t.anchor.set(0.5);
  if (t.width > w - 60) t.scale.set((w - 60) / t.width);
  const bw = t.width + 40;
  const g = new Graphics()
    .roundRect(-bw / 2, -22, bw, 44, 22)
    .fill({ color: 0x11162a, alpha: 0.9 });
  c.addChild(g, t);
  c.position.set(w / 2, y);
  c.eventMode = 'none';
  c.alpha = 0;
  layer.addChild(c);
  tweens.to(c, { alpha: 1 }, { duration: 150 });
  tweens.to(c, { alpha: 0 }, { duration: 300, delay: 1800 }).then(() => {
    if (!c.destroyed) destroyTree(c);
  });
}

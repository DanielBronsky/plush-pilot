// Фон арены: луг, забор по краю, деревья за забором и плывущие тени облаков.
import { Container, Graphics } from 'pixi.js';
import { CONFIG } from '../config';
import { makeRng } from '../core/rng';
import { shade } from './color';

const GRASS = 0x7cc46a;
const OUT = 0x5ea54f;

export class ArenaView extends Container {
  private readonly clouds = new Graphics();
  private cloudList: { x: number; y: number; r: number; s: number }[] = [];

  constructor(seed = 1) {
    super();
    const { w, h } = CONFIG.arena;
    const rng = makeRng(seed);
    const g = new Graphics();
    const pad = 900;
    // Снаружи — тёмная трава с деревьями.
    g.rect(-pad, -pad, w + pad * 2, h + pad * 2).fill(OUT);
    // Луг арены с полосами скошенной травы.
    g.rect(0, 0, w, h).fill(GRASS);
    for (let y = 0, i = 0; y < h; y += 110, i++)
      if (i % 2) g.rect(0, y, w, 110).fill({ color: shade(GRASS, 0.93), alpha: 0.7 });
    for (let i = 0; i < 520; i++) {
      const x = rng.next() * w;
      const y = rng.next() * h;
      const s = 3 + rng.next() * 3;
      g.poly([
        x - s,
        y + s,
        x - s * 0.2,
        y - s,
        x,
        y + s,
        x + s * 0.3,
        y - s * 0.8,
        x + s,
        y + s,
      ]).fill(shade(GRASS, 0.82));
    }
    // Цветы.
    const flowers = [0xff5d8f, 0xffd23f, 0xffffff, 0xc05dff];
    for (let i = 0; i < 60; i++) {
      const x = rng.next() * w;
      const y = rng.next() * h;
      for (let k = 0; k < 5; k++) {
        const fx = x + (rng.next() - 0.5) * 40;
        const fy = y + (rng.next() - 0.5) * 26;
        g.circle(fx, fy, 4).fill(flowers[rng.int(0, flowers.length - 1)]!);
        g.circle(fx, fy, 1.8).fill(0xffe27a);
      }
    }
    // Забор.
    const post = (x: number, y: number) => {
      g.roundRect(x - 7, y - 7, 14, 14, 3).fill(0x7a4a2c);
      g.roundRect(x - 5, y - 6, 10, 10, 2).fill(0xa26a40);
    };
    const rail = 0x9a6038;
    g.rect(-6, -10, w + 12, 8).fill(rail);
    g.rect(-6, h + 2, w + 12, 8).fill(rail);
    g.rect(-10, -6, 8, h + 12).fill(rail);
    g.rect(w + 2, -6, 8, h + 12).fill(rail);
    for (let x = 0; x <= w; x += 80) {
      post(x, -6);
      post(x, h + 6);
    }
    for (let y = 80; y < h; y += 80) {
      post(-6, y);
      post(w + 6, y);
    }
    // Деревья за забором.
    const tree = (x: number, y: number, r: number) => {
      g.ellipse(x + r * 0.3, y + r * 0.4, r, r * 0.85).fill({ color: 0x000000, alpha: 0.18 });
      g.circle(x, y, r).fill(0x2f8a3e);
      g.circle(x - r * 0.18, y - r * 0.2, r * 0.78).fill(0x46a852);
      g.circle(x - r * 0.36, y - r * 0.38, r * 0.34).fill(0x6cc970);
    };
    for (let i = 0; i < 140; i++) {
      const side = rng.int(0, 3);
      const along = rng.next();
      const out = 70 + rng.next() * 700;
      const x = side < 2 ? along * (w + 400) - 200 : side === 2 ? -out : w + out;
      const y = side >= 2 ? along * (h + 400) - 200 : side === 0 ? -out : h + out;
      tree(x, y, 40 + rng.next() * 40);
    }
    // Тени облаков поверх всего (плывут).
    for (let i = 0; i < 8; i++)
      this.cloudList.push({
        x: rng.next() * (w + 1200) - 600,
        y: rng.next() * (h + 600) - 300,
        r: 140 + rng.next() * 160,
        s: 18 + rng.next() * 16,
      });
    g.eventMode = 'none';
    this.clouds.eventMode = 'none';
    this.addChild(g);
  }

  /** Слой теней облаков: добавляется поверх игроков отдельно (см. GameScreen). */
  get cloudLayer(): Graphics {
    return this.clouds;
  }

  update(dt: number): void {
    const { w } = CONFIG.arena;
    const g = this.clouds.clear();
    for (const c of this.cloudList) {
      c.x += c.s * dt;
      if (c.x - c.r * 2 > w + 600) c.x = -600 - c.r * 2;
      for (const [dx, dy, k] of [
        [0, 0, 1],
        [c.r * 0.8, c.r * 0.15, 0.75],
        [-c.r * 0.7, c.r * 0.2, 0.7],
      ] as const)
        g.ellipse(c.x + dx, c.y + dy, c.r * k, c.r * k * 0.6).fill({
          color: 0x000000,
          alpha: 0.06,
        });
    }
  }
}

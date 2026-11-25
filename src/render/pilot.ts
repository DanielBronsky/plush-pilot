// Пилот Бубуш: плюшевый комок цвета мха в эстетике ugly-cute.
// Глаза разного размера, кривые клыки, ушки-лоскутки, шов на макушке, лётный шлем с очками.
// Рисуется кодом, мимика меняется перерисовкой лица.
import { Container, Graphics } from 'pixi.js';
import { shade } from './color';

export type Mood = 'normal' | 'focus' | 'angry' | 'happy' | 'scared';

const FUR = 0x7fae4f;
const FUR_DARK = shade(FUR, 0.72);
const PATCH = 0xe9925a;
const INK = 0x2a2238;

export class PilotView extends Container {
  private readonly body = new Graphics();
  private readonly face = new Graphics();
  private readonly hat = new Graphics();
  private mood: Mood | null = null;
  /** Радиус головы. */
  readonly r: number;

  constructor(r = 24) {
    super();
    this.r = r;
    this.addChild(this.body, this.face, this.hat);
    this.drawBody();
    this.drawHat();
    this.setMood('normal');
  }

  setMood(m: Mood): void {
    if (m === this.mood) return;
    this.mood = m;
    this.drawFace(m);
  }

  get currentMood(): Mood {
    return this.mood ?? 'normal';
  }

  private drawBody(): void {
    const g = this.body;
    const r = this.r;
    // Ушки-лоскутки: левое — мох, правое — оранжевая заплатка со стежками.
    g.poly([-r * 0.95, -r * 0.35, -r * 1.35, -r * 0.95, -r * 0.45, -r * 0.82]).fill(FUR_DARK);
    g.poly([-r * 0.88, -r * 0.42, -r * 1.18, -r * 0.84, -r * 0.55, -r * 0.76]).fill(FUR);
    g.poly([r * 0.95, -r * 0.3, r * 1.4, -r * 0.75, r * 0.55, -r * 0.85]).fill(shade(PATCH, 0.8));
    g.poly([r * 0.9, -r * 0.38, r * 1.25, -r * 0.72, r * 0.62, -r * 0.78]).fill(PATCH);
    for (let i = 0; i < 3; i++)
      g.rect(r * (0.75 + i * 0.16), -r * (0.62 + i * 0.03), r * 0.08, r * 0.03).fill(INK);
    // Пушистый край: кружки по окружности.
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const k = i % 2 ? 1.0 : 0.94;
      g.circle(Math.cos(a) * r * 0.86 * k, Math.sin(a) * r * 0.86 * k + 2, r * 0.26).fill(FUR_DARK);
    }
    g.circle(0, 2, r * 0.92).fill(FUR_DARK);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.2;
      const k = i % 2 ? 0.98 : 0.9;
      g.circle(Math.cos(a) * r * 0.82 * k, Math.sin(a) * r * 0.82 * k, r * 0.24).fill(FUR);
    }
    g.circle(0, 0, r * 0.88).fill(FUR);
    // Светлое пятно-мордочка и шов по диагонали.
    g.ellipse(0, r * 0.18, r * 0.62, r * 0.5).fill(shade(FUR, 1.18));
    for (let i = 0; i < 5; i++) {
      const x = -r * 0.62 + i * r * 0.17;
      const y = -r * 0.55 + i * r * 0.03;
      g.moveTo(x, y - r * 0.07)
        .lineTo(x + r * 0.08, y + r * 0.07)
        .stroke({ width: 1.6, color: shade(FUR, 0.6) });
    }
  }

  /** Лётный шлем с очками на лбу. */
  private drawHat(): void {
    const g = this.hat;
    const r = this.r;
    g.ellipse(0, -r * 0.62, r * 0.78, r * 0.4).fill(0x7a4a2c);
    g.ellipse(0, -r * 0.7, r * 0.62, r * 0.26).fill(0x9a6038);
    // Очки.
    g.roundRect(-r * 0.62, -r * 0.58, r * 1.24, r * 0.12, 3).fill(0x3b2a20);
    for (const sx of [-1, 1]) {
      g.circle(sx * r * 0.32, -r * 0.52, r * 0.2).fill(0xc9a227);
      g.circle(sx * r * 0.32, -r * 0.52, r * 0.14).fill(0x9fe0ff);
      g.circle(sx * r * 0.32 - r * 0.05, -r * 0.56, r * 0.05).fill({ color: 0xffffff, alpha: 0.8 });
    }
  }

  private drawFace(m: Mood): void {
    const g = this.face.clear();
    const r = this.r;
    // Глаза: левый большой, правый маленький (асимметрия — часть характера).
    const L = { x: -r * 0.33, y: -r * 0.12, s: r * 0.27 };
    const R = { x: r * 0.36, y: -r * 0.08, s: r * 0.18 };
    const eye = (e: typeof L, px: number, py: number, pupil = 0.5) => {
      g.circle(e.x, e.y, e.s).fill(0xffffff).stroke({ width: 1.5, color: INK });
      g.circle(e.x + px * e.s * 0.4, e.y + py * e.s * 0.4, e.s * pupil).fill(INK);
      g.circle(
        e.x + px * e.s * 0.4 - e.s * 0.18,
        e.y + py * e.s * 0.4 - e.s * 0.2,
        e.s * 0.14,
      ).fill(0xffffff);
    };
    const closed = (e: typeof L, up: boolean) => {
      g.moveTo(e.x - e.s, e.y)
        .quadraticCurveTo(e.x, e.y + (up ? -e.s : e.s) * 0.9, e.x + e.s, e.y)
        .stroke({ width: 2.4, color: INK, cap: 'round' });
    };
    const brow = (e: typeof L, tilt: number) => {
      g.moveTo(e.x - e.s, e.y - e.s * 1.25 - tilt * e.s * 0.4)
        .lineTo(e.x + e.s, e.y - e.s * 1.25 + tilt * e.s * 0.4)
        .stroke({ width: 2.6, color: INK, cap: 'round' });
    };
    const fangs = (y: number, w: number) => {
      // Кривые клыки разной длины.
      g.poly([-w * 0.55, y, -w * 0.35, y, -w * 0.47, y + r * 0.2]).fill(0xffffff);
      g.poly([w * 0.25, y, w * 0.45, y, w * 0.33, y + r * 0.13]).fill(0xffffff);
    };
    const my = r * 0.38;
    switch (m) {
      case 'normal':
        eye(L, 0.2, 0.1);
        eye(R, 0.2, 0.1);
        g.moveTo(-r * 0.38, my - 2)
          .quadraticCurveTo(0, my + r * 0.22, r * 0.38, my - 4)
          .stroke({ width: 2.4, color: INK, cap: 'round' });
        fangs(my, r * 0.62);
        break;
      case 'focus':
        // Прищур: верхние «веки» и сжатый рот.
        eye(L, 0.3, -0.1, 0.55);
        eye(R, 0.3, -0.1, 0.55);
        g.rect(L.x - L.s, L.y - L.s, L.s * 2, L.s * 0.7).fill(FUR);
        g.rect(R.x - R.s, R.y - R.s, R.s * 2, R.s * 0.7).fill(FUR);
        brow(L, 1);
        brow(R, -1);
        g.moveTo(-r * 0.25, my)
          .lineTo(r * 0.28, my - 2)
          .stroke({ width: 2.4, color: INK, cap: 'round' });
        fangs(my, r * 0.5);
        break;
      case 'angry':
        // «> <» и открытый кривой рот.
        for (const [e, d] of [
          [L, 1],
          [R, -1],
        ] as const) {
          g.moveTo(e.x - e.s * d, e.y - e.s * 0.7)
            .lineTo(e.x + e.s * d * 0.6, e.y)
            .lineTo(e.x - e.s * d, e.y + e.s * 0.7)
            .stroke({ width: 2.6, color: INK, cap: 'round', join: 'round' });
        }
        g.poly([
          -r * 0.42,
          my - 3,
          r * 0.4,
          my - 6,
          r * 0.25,
          my + r * 0.22,
          -r * 0.3,
          my + r * 0.25,
        ]).fill(INK);
        fangs(my - 3, r * 0.6);
        break;
      case 'happy':
        closed(L, true);
        closed(R, true);
        g.ellipse(-r * 0.6, r * 0.18, r * 0.14, r * 0.08).fill({ color: 0xff7a9a, alpha: 0.7 });
        g.ellipse(r * 0.6, r * 0.2, r * 0.12, r * 0.07).fill({ color: 0xff7a9a, alpha: 0.7 });
        g.moveTo(-r * 0.42, my - 5)
          .quadraticCurveTo(0, my + r * 0.45, r * 0.42, my - 5)
          .closePath()
          .fill(INK);
        g.ellipse(0, my + r * 0.16, r * 0.16, r * 0.08).fill(0xff6b81);
        fangs(my - 5, r * 0.66);
        break;
      case 'scared':
        eye(L, 0, 0, 0.3);
        eye(R, 0, 0, 0.3);
        g.circle(0, my + 2, r * 0.12).fill(INK);
        // Капля пота.
        g.poly([r * 0.78, -r * 0.3, r * 0.7, -r * 0.08, r * 0.86, -r * 0.08]).fill(0x8fd3ff);
        g.circle(r * 0.78, -r * 0.08, r * 0.08).fill(0x8fd3ff);
        break;
    }
  }
}

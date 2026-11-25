import { Container, Graphics, GraphicsContext } from 'pixi.js';
import { CONFIG } from '../config';
import { destroyChildren } from './destroy';

// Белые фигуры, цвет задаётся через tint. Общие на все частицы.
let circleCtx: GraphicsContext | null = null;
let rectCtx: GraphicsContext | null = null;

function shapes() {
  circleCtx ??= new GraphicsContext().circle(0, 0, 10).fill(0xffffff);
  rectCtx ??= new GraphicsContext().rect(-6, -3.5, 12, 7).fill(0xffffff);
  return { circleCtx, rectCtx };
}

export interface ParticleSpec {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Время жизни, мс. */
  life: number;
  color: number;
  shape: 'circle' | 'rect';
  scale?: number;
  /** Насколько частица растёт за жизнь (1 — не растёт). */
  grow?: number;
  gravity?: number;
  spin?: number;
  drag?: number;
  alpha?: number;
  /** Растяжение по осям (полосы скорости); поворот тогда не случайный. */
  stretch?: { x: number; y: number };
}

interface Live extends Required<Omit<ParticleSpec, 'stretch'>> {
  sx: number;
  sy: number;
  g: Graphics;
  age: number;
  scale0: number;
}

/** Простой пул частиц. Обновляется из тикера экрана через update(dt). */
export class Particles extends Container {
  private live: Live[] = [];
  private pool: { circle: Graphics[]; rect: Graphics[] } = { circle: [], rect: [] };

  constructor() {
    super();
    this.eventMode = 'none';
  }

  spawn(p: ParticleSpec): void {
    if (this.live.length >= CONFIG.render.maxParticles) return;
    const { circleCtx: c, rectCtx: r } = shapes();
    const g = this.pool[p.shape].pop() ?? new Graphics(p.shape === 'circle' ? c : r);
    g.visible = true;
    g.tint = p.color;
    g.position.set(p.x, p.y);
    g.rotation = p.stretch ? 0 : Math.random() * Math.PI * 2;
    const scale = p.scale ?? 1;
    const sx = p.stretch?.x ?? 1;
    const sy = p.stretch?.y ?? 1;
    g.scale.set(scale * sx, scale * sy);
    g.alpha = p.alpha ?? 1;
    this.addChild(g);
    this.live.push({
      ...p,
      grow: p.grow ?? 1,
      gravity: p.gravity ?? 0,
      spin: p.spin ?? 0,
      drag: p.drag ?? 0,
      alpha: p.alpha ?? 1,
      scale,
      sx,
      sy,
      g,
      age: 0,
      scale0: scale,
    });
  }

  update(dtMs: number): void {
    if (this.live.length === 0) return;
    const dt = Math.min(dtMs, 50) / 1000;
    let w = 0;
    for (const p of this.live) {
      p.age += dtMs;
      if (p.age >= p.life) {
        this.release(p);
        continue;
      }
      const k = p.age / p.life;
      p.vy += p.gravity * dt;
      const d = 1 - p.drag * dt;
      p.vx *= d;
      p.vy *= d;
      p.g.x += p.vx * dt;
      p.g.y += p.vy * dt;
      p.g.rotation += p.spin * dt;
      const sc = p.scale0 * (1 + (p.grow - 1) * k);
      p.g.scale.set(sc * p.sx, sc * p.sy);
      p.g.alpha = p.alpha * (k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4);
      this.live[w++] = p;
    }
    this.live.length = w;
  }

  private release(p: Live): void {
    p.g.visible = false;
    this.removeChild(p.g);
    this.pool[p.shape].push(p.g);
  }

  clear(): void {
    for (const p of this.live) this.release(p);
    this.live.length = 0;
  }

  get activeCount(): number {
    return this.live.length;
  }

  override destroy(): void {
    this.clear();
    for (const g of [...this.pool.circle, ...this.pool.rect]) g.destroy();
    this.pool = { circle: [], rect: [] };
    destroyChildren(this);
    super.destroy();
  }
}

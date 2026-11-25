// Самолётик игрока, враги, пули и монеты. Всё рисуется кодом; общая геометрия — в GraphicsContext.
import { Container, Graphics, GraphicsContext } from 'pixi.js';
import type { Enemy, EnemyKind } from '../core/sim';
import { shade } from './color';
import { PilotView } from './pilot';

const INK = 0x2a2238;

/** Игрушечный самолётик, нос смотрит вправо (+x). Пилот в кабине всегда «стоит» ровно. */
export class PlaneView extends Container {
  readonly craft = new Container();
  readonly pilot = new PilotView(22);
  private readonly prop = new Graphics();
  private readonly shadow = new Graphics();
  private t = 0;

  constructor() {
    super();
    this.shadow.ellipse(10, 26, 52, 34).fill({ color: 0x000000, alpha: 0.18 });
    const g = new Graphics();
    const red = 0xff5a5f;
    const yellow = 0xffcf3f;
    // Хвост.
    g.roundRect(-58, -26, 18, 52, 8).fill(shade(yellow, 0.85));
    g.roundRect(-60, -6, 22, 12, 5).fill(shade(red, 0.8));
    // Крылья.
    g.roundRect(-14, -62, 34, 124, 14).fill(shade(yellow, 0.85));
    g.roundRect(-12, -60, 30, 118, 12).fill(yellow);
    for (const y of [-46, 34]) g.roundRect(-10, y, 26, 8, 4).fill({ color: 0xffffff, alpha: 0.6 });
    // Фюзеляж.
    g.roundRect(-52, -18, 104, 36, 18).fill(shade(red, 0.75));
    g.roundRect(-52, -18, 104, 32, 16).fill(red);
    g.roundRect(-40, -12, 70, 6, 3).fill({ color: 0xffffff, alpha: 0.35 });
    // Нос и кабина.
    g.circle(50, 0, 13).fill(shade(red, 0.6));
    g.circle(50, 0, 7).fill(0xd9d9d9);
    g.circle(-6, 0, 24).fill(shade(red, 0.55));
    g.circle(-6, 0, 21).fill(0x3a2f4a);
    this.craft.addChild(g, this.prop);
    this.pilot.position.set(-6, -4);
    this.addChild(this.shadow, this.craft, this.pilot);
    this.drawProp(0);
  }

  private drawProp(a: number): void {
    const p = this.prop.clear();
    p.circle(56, 0, 26).fill({ color: 0xffffff, alpha: 0.12 });
    for (let i = 0; i < 2; i++) {
      const ang = a + i * Math.PI;
      const s = Math.sin(ang) * 26;
      p.roundRect(54, s < 0 ? s : 0, 5, Math.abs(s) + 1, 2).fill({ color: INK, alpha: 0.75 });
    }
  }

  /** aim — угол прицела, dt — секунды. */
  update(aim: number, dt: number, invuln: boolean): void {
    this.t += dt;
    this.craft.rotation = aim;
    this.shadow.rotation = aim;
    this.drawProp(this.t * 40);
    // Мигание после попадания.
    this.alpha = invuln ? (Math.floor(this.t * 14) % 2 ? 0.45 : 1) : 1;
    // Лёгкое покачивание в полёте.
    this.craft.y = Math.sin(this.t * 3) * 2;
  }
}

// ——— Враги ———

const ctxCache = new Map<string, GraphicsContext>();

function enemyContext(kind: EnemyKind): GraphicsContext {
  const cached = ctxCache.get(kind);
  if (cached) return cached;
  const g = new GraphicsContext();
  if (kind === 'buzzer') {
    // Злой фиолетовый пушок с клыком.
    const c = 0x9b5de5;
    g.circle(4, 8, 26).fill({ color: 0x000000, alpha: 0.18 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.circle(Math.cos(a) * 20, Math.sin(a) * 20, 8).fill(shade(c, 0.75));
    }
    g.circle(0, 0, 22).fill(c);
    g.circle(-8, -4, 7).fill(0xffffff);
    g.circle(8, -4, 7).fill(0xffffff);
    g.circle(-7, -3, 3.5).fill(INK);
    g.circle(9, -3, 3.5).fill(INK);
    g.moveTo(-14, -14).lineTo(-2, -8).stroke({ width: 3, color: INK, cap: 'round' });
    g.moveTo(14, -14).lineTo(2, -8).stroke({ width: 3, color: INK, cap: 'round' });
    g.moveTo(-8, 9).lineTo(8, 9).stroke({ width: 2.5, color: INK, cap: 'round' });
    g.poly([2, 9, 7, 9, 4.5, 16]).fill(0xffffff);
  } else if (kind === 'gunner') {
    // Заводной дрон-стрелок: корпус, кольцо винтов, глаз-визор.
    const c = 0x5c7cfa;
    g.circle(4, 8, 30).fill({ color: 0x000000, alpha: 0.18 });
    g.circle(0, 0, 30).stroke({ width: 5, color: 0xadb5bd });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      g.circle(Math.cos(a) * 30, Math.sin(a) * 30, 7).fill(0x868e96);
    }
    g.circle(0, 0, 22).fill(shade(c, 0.75));
    g.circle(0, -2, 20).fill(c);
    g.roundRect(-13, -8, 26, 10, 5).fill(INK);
    g.circle(0, -3, 4).fill(0xff4d6d);
    g.rect(-4, 10, 8, 6).fill(shade(c, 0.6));
  } else {
    // Надувной толстяк со швом-ртом и ручками.
    const c = 0xff8fab;
    g.circle(6, 12, 52).fill({ color: 0x000000, alpha: 0.18 });
    g.circle(-50, 6, 12).fill(shade(c, 0.8));
    g.circle(50, 6, 12).fill(shade(c, 0.8));
    g.circle(0, 0, 52).fill(shade(c, 0.8));
    g.circle(-4, -4, 48).fill(c);
    g.ellipse(-18, -22, 14, 9).fill({ color: 0xffffff, alpha: 0.4 });
    g.circle(-16, -6, 9).fill(0xffffff);
    g.circle(14, -8, 6).fill(0xffffff);
    g.circle(-15, -5, 4.5).fill(INK);
    g.circle(15, -7, 3).fill(INK);
    g.moveTo(-22, 20).lineTo(22, 18).stroke({ width: 3, color: INK, cap: 'round' });
    for (let i = 0; i < 5; i++)
      g.moveTo(-18 + i * 9, 14)
        .lineTo(-18 + i * 9, 24)
        .stroke({ width: 2, color: INK });
  }
  ctxCache.set(kind, g);
  return g;
}

export class EnemyView extends Container {
  readonly kind: EnemyKind;
  readonly body: Graphics;
  private readonly flash = new Graphics();
  private readonly bar = new Graphics();
  private readonly wings = new Graphics();
  private flashT = 0;
  private t = Math.random() * 10;

  constructor(kind: EnemyKind, r: number) {
    super();
    this.kind = kind;
    this.body = new Graphics(enemyContext(kind));
    this.flash.circle(0, 0, r).fill(0xffffff);
    this.flash.alpha = 0;
    if (kind === 'buzzer') this.addChild(this.wings);
    this.addChild(this.body, this.flash, this.bar);
  }

  hit(): void {
    this.flashT = 0.1;
    this.scale.set(1.15);
  }

  update(e: Enemy, dt: number): void {
    this.t += dt;
    this.position.set(e.x, e.y);
    this.flashT = Math.max(0, this.flashT - dt);
    this.flash.alpha = this.flashT > 0 ? 0.75 : 0;
    const s = this.scale.x + (1 - this.scale.x) * Math.min(1, dt * 12);
    this.scale.set(s);
    if (this.kind === 'buzzer') {
      // Машет крылышками.
      const f = Math.abs(Math.sin(this.t * 22));
      this.wings.clear();
      for (const sx of [-1, 1])
        this.wings
          .ellipse(sx * 24, -10, 16, 6 + f * 8)
          .fill({ color: 0xffffff, alpha: 0.75 })
          .stroke({ width: 2, color: 0xc9b6f2 });
    } else if (this.kind === 'gunner') {
      this.body.rotation = Math.sin(this.t * 2) * 0.1;
    } else {
      this.body.scale.set(1 + Math.sin(this.t * 4) * 0.03, 1 - Math.sin(this.t * 4) * 0.03);
    }
    // Полоска здоровья у раненых.
    this.bar.clear();
    if (e.hp < e.maxHp) {
      const w = e.r * 1.4;
      this.bar.roundRect(-w / 2, -e.r - 16, w, 7, 3).fill({ color: INK, alpha: 0.6 });
      this.bar.roundRect(-w / 2 + 1, -e.r - 15, (w - 2) * (e.hp / e.maxHp), 5, 2).fill(0x51cf66);
    }
  }
}

// ——— Пули и монеты: общие контексты, один Graphics на объект ———

export const shotContexts = {
  player: new GraphicsContext()
    .ellipse(-8, 0, 16, 7)
    .fill({ color: 0xfff3b0, alpha: 0.45 })
    .circle(0, 0, 9)
    .fill(0xffd43b)
    .circle(-2, -2, 4)
    .fill(0xffffff),
  enemy: new GraphicsContext()
    .circle(0, 0, 12)
    .fill(INK)
    .circle(0, 0, 9)
    .fill(0xff4d6d)
    .circle(-3, -3, 3)
    .fill({ color: 0xffffff, alpha: 0.8 }),
  coin: new GraphicsContext()
    .circle(0, 2, 13)
    .fill(0xd69a12)
    .circle(0, 0, 13)
    .fill(0xffc93c)
    .circle(0, 0, 8)
    .fill(0xffd95a)
    .ellipse(-4, -5, 4, 2.5)
    .fill({ color: 0xffffff, alpha: 0.7 }),
};

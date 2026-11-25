import { Container, Graphics, Text } from 'pixi.js';
import type { GraphicsContext } from 'pixi.js';
import { track } from '../../analytics';
import type { App } from '../../app';
import { CONFIG } from '../../config';
import { NO_INPUT, createWorld, nearestEnemy, step } from '../../core/sim';
import type { Input, World } from '../../core/sim';
import { InputController } from '../../game/input';
import { EnemyView, PlaneView, shotContexts } from '../../render/actors';
import { ArenaView } from '../../render/arena';
import { destroyTree } from '../../render/destroy';
import { Particles } from '../../render/particles';
import type { Mood } from '../../render/pilot';
import { ease } from '../../render/tween';
import { Button } from '../button';
import { icon } from '../icons';
import type { Insets } from '../layout';
import { Modal } from '../modal';
import { Screen } from '../screen';
import { UI, textStyle } from '../style';

const STEP = 1 / 60;

/** Бой на арене: симуляция, камера, эффекты, интерфейс, джойстики, пауза и конец игры. */
export class GameScreen extends Screen {
  private world: World;
  private readonly input: InputController;
  private readonly cam = new Container();
  private readonly arena = new ArenaView(1);
  private readonly pickupsLayer = new Container();
  private readonly enemiesLayer = new Container();
  private readonly shotsLayer = new Container();
  private readonly plane = new PlaneView();
  private readonly fx = new Particles();
  private readonly hud = new Container();
  private readonly sticks = new Graphics();
  private readonly modalLayer = new Container();
  private readonly enemyViews = new Map<number, EnemyView>();
  private readonly shotViews = new Map<number, Graphics>();
  private readonly coinViews = new Map<number, Graphics>();
  private readonly hearts = new Container();
  private readonly waveText: Text;
  private readonly coinText: Text;
  private readonly coinBox = new Container();
  private readonly pauseBtn: Button;
  private readonly autoBtn: Button;
  private readonly banner: Text;
  private readonly hurtFlash = new Graphics();
  private modal: Modal | null = null;
  private acc = 0;
  private zoom = 1;
  private shake = 0;
  private moodT = 0;
  private mood: Mood = 'normal';
  private size = { w: 0, h: 0 };
  private safe: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
  private runMs = 0;
  private pickupCount = 0;
  private finished = false;

  constructor(app: App) {
    super(app);
    app.setBackground(0x5ea54f);
    this.world = createWorld((Date.now() & 0xffff) + 1);
    this.input = new InputController(app.pixi.canvas);
    this.cam.addChild(
      this.arena,
      this.pickupsLayer,
      this.enemiesLayer,
      this.shotsLayer,
      this.plane,
      this.fx,
      this.arena.cloudLayer,
    );
    this.cam.eventMode = 'none';

    this.waveText = new Text({ text: '', style: textStyle(26, UI.white, '900') });
    this.waveText.style.stroke = { color: UI.ink, width: 6, join: 'round' };
    this.waveText.anchor.set(0.5);
    this.coinText = new Text({ text: '0', style: textStyle(24, UI.white, '900') });
    this.coinText.style.stroke = { color: UI.ink, width: 5, join: 'round' };
    this.coinText.anchor.set(0, 0.5);
    this.coinText.x = 20;
    this.coinBox.addChild(icon('coin', 28, UI.star), this.coinText);
    this.pauseBtn = new Button({
      width: 56,
      height: 56,
      icon: 'pause',
      onTap: () => this.openPause(),
    });
    this.autoBtn = new Button({
      width: 112,
      height: 46,
      label: 'AUTO AIM',
      labelSize: 16,
      onTap: () => this.toggleAuto(),
    });
    this.refreshAuto();
    this.banner = new Text({ text: '', style: textStyle(54, UI.yellow, '900') });
    this.banner.style.stroke = { color: UI.ink, width: 10, join: 'round' };
    this.banner.anchor.set(0.5);
    this.banner.alpha = 0;
    this.hurtFlash.alpha = 0;
    this.hud.addChild(
      this.hearts,
      this.waveText,
      this.coinBox,
      this.pauseBtn,
      this.autoBtn,
      this.banner,
    );
    this.sticks.eventMode = 'none';
    this.hurtFlash.eventMode = 'none';
    this.addChild(this.cam, this.hurtFlash, this.sticks, this.hud, this.modalLayer);
    this.drawHearts();
    track('run_start', { bestWave: app.save.bestWave });
    app.gameplay(true);
  }

  // ——— Управление ———

  private toggleAuto(): void {
    this.app.updateSettings({ autoAim: !this.app.save.settings.autoAim });
    this.refreshAuto();
  }

  private refreshAuto(): void {
    const on = this.app.save.settings.autoAim;
    this.autoBtn.setColor(on ? UI.green : UI.panelShade);
  }

  private readInput(): Input {
    const p = this.world.player;
    const mv = this.input.moveVector();
    const inp: Input = { ...NO_INPUT, moveX: mv.x, moveY: mv.y };
    if (this.app.save.settings.autoAim) {
      const e = nearestEnemy(this.world, 950);
      if (e) {
        inp.aimX = e.x - p.x;
        inp.aimY = e.y - p.y;
        inp.fire = true;
      } else if (Math.hypot(mv.x, mv.y) > 0.1) {
        inp.aimX = mv.x;
        inp.aimY = mv.y;
      }
      return inp;
    }
    const stick = this.input.stickAim();
    if (stick) {
      inp.aimX = stick.x;
      inp.aimY = stick.y;
      inp.fire = stick.fire;
    } else if (this.input.mouse.seen) {
      const wx = (this.input.mouse.x - this.cam.x) / this.zoom;
      const wy = (this.input.mouse.y - this.cam.y) / this.zoom;
      inp.aimX = wx - p.x;
      inp.aimY = wy - p.y;
      inp.fire = this.input.mouse.down || this.input.spaceDown;
    } else if (Math.hypot(mv.x, mv.y) > 0.1) {
      // Телефон до первого касания правого джойстика: смотрим туда, куда летим.
      inp.aimX = mv.x;
      inp.aimY = mv.y;
    }
    return inp;
  }

  // ——— Кадр ———

  override update(dtMs: number): void {
    const dt = Math.min(dtMs, 100) / 1000;
    this.arena.update(dt);
    this.fx.update(dtMs);
    if (!this.modal && !this.finished) {
      this.runMs += dtMs;
      this.acc += dt;
      const input = this.readInput();
      while (this.acc >= STEP) {
        this.acc -= STEP;
        step(this.world, input, STEP);
        this.handleEvents();
      }
    }
    this.syncViews(dt);
    this.updateCamera(dt);
    this.updateMood(dt);
    this.drawSticks();
    this.coinText.text = String(this.world.coins);
    this.waveText.text = this.world.wave ? `Wave ${this.world.wave}` : 'Get ready!';
    this.hurtFlash.alpha = Math.max(0, this.hurtFlash.alpha - dt * 2.5);
  }

  private handleEvents(): void {
    const a = this.app.audio;
    for (const ev of this.world.events) {
      switch (ev.type) {
        case 'shoot':
          a.play('shoot', Math.floor(Math.random() * 5));
          this.fx.spawn({
            x: ev.x + ev.dx * 60,
            y: ev.y + ev.dy * 60,
            vx: ev.dx * 120,
            vy: ev.dy * 120,
            life: 120,
            color: 0xfff3b0,
            shape: 'circle',
            scale: 0.9,
            grow: 0.3,
          });
          break;
        case 'enemyShoot':
          a.play('enemyShoot');
          break;
        case 'enemyHit':
          a.play('hit');
          this.enemyViews.get(ev.id)?.hit();
          this.burst(ev.x, ev.y, 0xffe27a, 5, 200, 0.35);
          break;
        case 'kill': {
          const big = ev.kind === 'brute';
          a.play(big ? 'bigKill' : 'kill');
          const color =
            ev.kind === 'buzzer' ? 0x9b5de5 : ev.kind === 'gunner' ? 0x5c7cfa : 0xff8fab;
          // «Пух» плюша: клочки цвета врага и белые облачка.
          this.burst(ev.x, ev.y, color, big ? 26 : 14, big ? 420 : 300, big ? 0.9 : 0.6);
          this.burst(ev.x, ev.y, 0xffffff, big ? 10 : 6, 160, 1.2, 2.2);
          this.shake = Math.max(this.shake, big ? 14 : 5);
          const v = this.enemyViews.get(ev.id);
          if (v) {
            this.enemyViews.delete(ev.id);
            destroyTree(v);
          }
          break;
        }
        case 'hurt':
          a.play('hurt');
          this.shake = Math.max(this.shake, 16);
          this.hurtFlash.alpha = 0.45;
          this.setMood('angry', 0.8);
          this.drawHearts();
          break;
        case 'pickup':
          a.play('pickup', this.pickupCount++);
          this.burst(ev.x, ev.y, 0xffd43b, 4, 140, 0.4);
          break;
        case 'spawn': {
          const v = new EnemyView(ev.kind, CONFIG.enemies[ev.kind].radius);
          v.position.set(ev.x, ev.y);
          v.scale.set(0);
          this.app.tweens.to(
            v.scale,
            { x: 1, y: 1 },
            { duration: 300, ease: ease.outBack, owner: this },
          );
          this.enemyViews.set(ev.id, v);
          this.enemiesLayer.addChild(v);
          this.burst(ev.x, ev.y, 0xffffff, 6, 120, 0.8, 1.8);
          break;
        }
        case 'waveStart':
          a.play('waveStart');
          this.showBanner(`Wave ${ev.wave}`);
          break;
        case 'waveClear':
          a.play('waveClear');
          this.showBanner('Wave cleared!');
          this.setMood('happy', 1.4);
          break;
        case 'dead':
          this.finished = true;
          a.play('lose');
          this.app.gameplay(false);
          this.burst(this.world.player.x, this.world.player.y, 0xff5a5f, 30, 400, 0.9);
          this.app.tweens.wait(900, this).then(() => this.gameOver());
          break;
      }
    }
  }

  private burst(
    x: number,
    y: number,
    color: number,
    n: number,
    speed: number,
    scale: number,
    grow = 1,
  ): void {
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.fx.spawn({
        x,
        y,
        vx: Math.cos(ang) * s,
        vy: Math.sin(ang) * s,
        life: 350 + Math.random() * 300,
        color,
        shape: i % 3 === 0 ? 'rect' : 'circle',
        scale: scale * (0.7 + Math.random() * 0.6),
        grow,
        drag: 3,
        spin: 8,
        alpha: grow > 1 ? 0.6 : 1,
      });
    }
  }

  private syncViews(dt: number): void {
    const w = this.world;
    const p = w.player;
    this.plane.position.set(p.x, p.y);
    this.plane.update(Math.atan2(p.aimY, p.aimX), dt, p.invuln > 0 && !this.finished);
    this.plane.visible = !(this.finished && w.phase === 'dead');
    for (const e of w.enemies) this.enemyViews.get(e.id)?.update(e, dt);
    this.syncPool(
      this.shotViews,
      w.bullets,
      b => (b.from === 'player' ? shotContexts.player : shotContexts.enemy),
      this.shotsLayer,
      (g, b) => {
        g.position.set(b.x, b.y);
        g.rotation = Math.atan2(b.vy, b.vx);
      },
    );
    this.syncPool(
      this.coinViews,
      w.pickups,
      () => shotContexts.coin,
      this.pickupsLayer,
      (g, c) => {
        g.position.set(c.x, c.y);
        // Монета крутится, а перед исчезновением мигает.
        g.scale.x = Math.abs(Math.cos(w.time * 5 + c.id));
        g.alpha = c.life < 2 ? (Math.floor(c.life * 8) % 2 ? 0.3 : 1) : 1;
      },
    );
  }

  /** Обновить набор Graphics по списку объектов: новые создать, исчезнувшие удалить. */
  private syncPool<T extends { id: number }>(
    views: Map<number, Graphics>,
    items: T[],
    ctx: (it: T) => GraphicsContext,
    layer: Container,
    place: (g: Graphics, it: T) => void,
  ): void {
    const alive = new Set<number>();
    for (const it of items) {
      alive.add(it.id);
      let g = views.get(it.id);
      if (!g) {
        g = new Graphics(ctx(it));
        views.set(it.id, g);
        layer.addChild(g);
      }
      place(g, it);
    }
    for (const [id, g] of views)
      if (!alive.has(id)) {
        views.delete(id);
        g.destroy();
      }
  }

  private updateCamera(dt: number): void {
    const { w, h } = this.size;
    if (!w) return;
    const p = this.world.player;
    const z = this.zoom;
    const A = CONFIG.arena;
    // Камера держит самолёт в центре, но не показывает слишком много за забором.
    const margin = 160;
    let cx = w / 2 - p.x * z;
    let cy = h / 2 - p.y * z;
    const minX = w - (A.w + margin) * z;
    const minY = h - (A.h + margin) * z;
    cx = minX > margin * z ? (w - A.w * z) / 2 : Math.min(margin * z, Math.max(minX, cx));
    cy = minY > margin * z ? (h - A.h * z) / 2 : Math.min(margin * z, Math.max(minY, cy));
    this.shake = Math.max(0, this.shake - dt * 60);
    const s = this.app.save.settings ? this.shake : 0;
    this.cam.position.set(cx + (Math.random() - 0.5) * s, cy + (Math.random() - 0.5) * s);
    this.cam.scale.set(z);
  }

  private setMood(m: Mood, seconds: number): void {
    this.mood = m;
    this.moodT = seconds;
  }

  private updateMood(dt: number): void {
    this.moodT = Math.max(0, this.moodT - dt);
    let m: Mood = this.mood;
    if (this.moodT <= 0) {
      const p = this.world.player;
      const firing = this.world.events.some(e => e.type === 'shoot') || this.readFireHeld();
      m = p.hp <= 1 ? 'scared' : firing ? 'focus' : 'normal';
    }
    this.plane.pilot.setMood(m);
  }

  private readFireHeld(): boolean {
    if (this.app.save.settings.autoAim) return nearestEnemy(this.world, 950) !== null;
    return this.input.mouse.down || this.input.spaceDown || (this.input.stickAim()?.fire ?? false);
  }

  // ——— Интерфейс ———

  private drawHearts(): void {
    for (const c of this.hearts.removeChildren()) c.destroy();
    const p = this.world.player;
    for (let i = 0; i < p.maxHp; i++) {
      const alive = i < p.hp;
      const g = icon('heart', 26, alive ? UI.heart : 0x000000);
      if (!alive) g.alpha = 0.25;
      g.x = i * 32;
      this.hearts.addChild(g);
    }
  }

  private showBanner(text: string): void {
    const b = this.banner;
    b.text = text;
    this.app.tweens.killOf(b);
    this.app.tweens.killOf(b.scale);
    b.alpha = 1;
    b.scale.set(0.5);
    this.app.tweens.to(b.scale, { x: 1, y: 1 }, { duration: 320, ease: ease.outBack, owner: this });
    this.app.tweens.to(b, { alpha: 0 }, { duration: 400, delay: 1100, owner: this });
  }

  private drawSticks(): void {
    const g = this.sticks.clear();
    if (!this.input.touchUsed) return;
    const R = CONFIG.ui.stickRadius;
    for (const [s, color] of [
      [this.input.left, 0xffffff],
      [this.input.right, 0xffcf3f],
    ] as const) {
      if (!s) continue;
      g.circle(s.ox, s.oy, R)
        .fill({ color: 0x000000, alpha: 0.18 })
        .stroke({ width: 3, color, alpha: 0.6 });
      g.circle(s.ox + s.dx, s.oy + s.dy, R * 0.45).fill({ color, alpha: 0.75 });
    }
  }

  layout(w: number, h: number, safe: Insets): void {
    this.size = { w, h };
    this.safe = safe;
    // Зум: на коротком краю экрана видно не меньше ~720 единиц арены.
    this.zoom = Math.max(0.5, Math.min(1.15, Math.min(w, h) / 720));
    const m = CONFIG.ui.margin;
    const top = safe.top + m;
    this.hearts.position.set(safe.left + m + 16, top + 16);
    this.coinBox.position.set(safe.left + m + 16, top + 54);
    this.waveText.position.set(w / 2, top + 20);
    this.pauseBtn.position.set(w - safe.right - m - 28, top + 28);
    this.autoBtn.position.set(w / 2, h - safe.bottom - m - 28);
    this.banner.position.set(w / 2, h * 0.32);
    this.banner.scale.set(1);
    this.hurtFlash.clear().rect(0, 0, w, h).fill(0xff3b3b);
    this.modal?.layout(w, h, safe);
  }

  // ——— Пауза и конец игры ———

  override onAutoPause(): void {
    if (!this.modal && !this.finished) this.openPause();
  }

  private openPause(): void {
    if (this.modal || this.finished) return;
    this.app.gameplay(false);
    const m = new Modal(this.app.tweens, Math.min(this.size.w - 32, 340), 'Paused');
    m.addRow(
      this.wide('Resume', 'play', UI.green, () => this.closeModal(true), UI.white),
      62,
      18,
    );
    m.addRow(
      this.wide('Restart', 'restart', UI.yellow, () => this.app.play()),
      62,
    );
    m.addRow(
      this.wide('Menu', 'home', UI.panelShade, () => this.app.goMenu()),
      62,
    );
    this.showModal(m);
  }

  private gameOver(): void {
    if (this.destroyed) return;
    const w = this.world;
    this.app.finishRun(w.wave, w.coins);
    track('run_end', {
      wave: w.wave,
      kills: w.kills,
      coins: w.coins,
      timeMs: Math.round(this.runMs),
    });
    const m = new Modal(this.app.tweens, Math.min(this.size.w - 32, 360), 'Game over');
    const stats = new Text({
      text: `Wave ${w.wave}   ·   ${w.kills} knocked out\nBest: wave ${this.app.save.bestWave}`,
      style: textStyle(20, 0x56607a, '800'),
    });
    stats.anchor.set(0.5);
    m.addRow(stats, 56, 10);
    const coins = new Container();
    const ct = new Text({ text: `+${w.coins}`, style: textStyle(30, UI.ink, '900') });
    ct.anchor.set(0, 0.5);
    ct.x = 24;
    coins.addChild(icon('coin', 34, UI.star), ct);
    coins.pivot.x = (24 + ct.width) / 2 - 17;
    m.addRow(coins, 44, 8);
    m.addRow(
      this.wide('Try again', 'restart', UI.green, () => void this.retry(), UI.white),
      62,
      18,
    );
    m.addRow(
      this.wide('Menu', 'home', UI.panelShade, () => this.app.goMenu()),
      62,
    );
    this.showModal(m);
  }

  private async retry(): Promise<void> {
    await this.app.maybeMidgame(this.world.wave);
    this.app.play();
  }

  private wide(
    label: string,
    ic: 'play' | 'restart' | 'home',
    color: number,
    onTap: () => void,
    ink: number = UI.ink,
  ): Button {
    return new Button({
      width: Math.min(this.size.w - 32, 340) - 52,
      height: 62,
      label,
      icon: ic,
      color,
      iconColor: ink,
      labelSize: 24,
      onTap,
    });
  }

  private showModal(m: Modal): void {
    this.modal = m;
    this.modalLayer.addChild(m);
    m.layout(this.size.w, this.size.h, this.safe);
    m.open();
  }

  private closeModal(resume: boolean): void {
    const m = this.modal;
    this.modal = null;
    if (m) void m.close();
    if (resume && !this.finished) this.app.gameplay(true);
  }

  override destroy(): void {
    this.input.destroy();
    this.enemyViews.clear();
    this.shotViews.clear();
    this.coinViews.clear();
    this.modal = null;
    super.destroy();
  }
}

import { Container, Text } from 'pixi.js';
import type { App } from '../../app';
import { CONFIG } from '../../config';
import { ArenaView } from '../../render/arena';
import { PilotView } from '../../render/pilot';
import type { Mood } from '../../render/pilot';
import { Button } from '../button';
import { icon } from '../icons';
import type { Insets } from '../layout';
import { Screen } from '../screen';
import { UI, textStyle } from '../style';

const MOODS: Mood[] = ['normal', 'happy', 'focus', 'angry', 'scared'];

/** Главное меню: луг, большой Бубуш с меняющейся мимикой, «Играть», звук и музыка. */
export class MenuScreen extends Screen {
  private readonly bg = new ArenaView(3);
  private readonly pilot = new PilotView(60);
  private readonly title: Text;
  private readonly play: Button;
  private readonly hint: Text;
  private readonly best: Text;
  private readonly coins = new Container();
  private readonly sound: Button;
  private readonly music: Button;
  private t = 0;
  private moodIdx = 0;

  constructor(app: App) {
    super(app);
    app.setBackground(0x5ea54f);
    this.title = new Text({ text: CONFIG.title, style: textStyle(64, UI.white, '900') });
    this.title.style.stroke = { color: UI.ink, width: 10, join: 'round' };
    this.title.anchor.set(0.5);
    this.play = new Button({
      width: 240,
      height: 78,
      color: UI.green,
      iconColor: UI.white,
      icon: 'play',
      label: 'Play',
      labelSize: 32,
      onTap: () => app.play(),
    });
    const touch = matchMedia('(pointer: coarse)').matches;
    this.hint = new Text({
      text: touch
        ? 'Left thumb: fly  ·  Right thumb: aim & shoot'
        : 'WASD: fly  ·  Mouse: aim  ·  Hold click: shoot',
      style: textStyle(18, UI.white, '800'),
    });
    this.hint.style.stroke = { color: UI.ink, width: 5, join: 'round' };
    this.hint.anchor.set(0.5);
    this.best = new Text({
      text: app.save.bestWave ? `Best: wave ${app.save.bestWave}` : '',
      style: textStyle(20, UI.white, '800'),
    });
    this.best.style.stroke = { color: UI.ink, width: 5, join: 'round' };
    this.best.anchor.set(0.5);
    const ct = new Text({ text: String(app.save.coins), style: textStyle(22, UI.white, '900') });
    ct.style.stroke = { color: UI.ink, width: 5, join: 'round' };
    ct.anchor.set(0, 0.5);
    ct.x = 20;
    this.coins.addChild(icon('coin', 28, UI.star), ct);
    const s = app.save.settings;
    this.sound = new Button({
      width: 60,
      height: 60,
      icon: 'soundOn',
      onTap: () => this.toggle('sound'),
    });
    this.music = new Button({
      width: 60,
      height: 60,
      icon: 'musicOn',
      onTap: () => this.toggle('music'),
    });
    this.sound.setToggle(s.sound, s.sound ? 'soundOn' : 'soundOff');
    this.music.setToggle(s.music, s.music ? 'musicOn' : 'musicOff');
    this.bg.eventMode = 'none';
    this.pilot.eventMode = 'none';
    this.addChild(
      this.bg,
      this.bg.cloudLayer,
      this.pilot,
      this.title,
      this.play,
      this.hint,
      this.best,
      this.coins,
      this.sound,
      this.music,
    );
    app.gameplay(false);
  }

  private toggle(what: 'sound' | 'music'): void {
    const on = !this.app.save.settings[what];
    this.app.updateSettings({ [what]: on });
    if (what === 'sound') this.sound.setToggle(on, on ? 'soundOn' : 'soundOff');
    else this.music.setToggle(on, on ? 'musicOn' : 'musicOff');
  }

  layout(w: number, h: number, safe: Insets): void {
    const k = Math.max(0.75, Math.min(1.4, Math.min(w, h) / 640));
    const cx = w / 2;
    const top = safe.top;
    const bottom = h - safe.bottom;
    // Фон: середина луга, во весь экран.
    this.bg.position.set(w / 2 - CONFIG.arena.w / 2, h / 2 - CONFIG.arena.h / 2);
    this.bg.cloudLayer.position.copyFrom(this.bg.position);
    this.title.scale.set(Math.min(k, (w - 40) / (this.title.width / this.title.scale.x)));
    this.title.position.set(cx, top + (bottom - top) * 0.15);
    this.pilot.scale.set(k);
    this.pilot.position.set(cx, top + (bottom - top) * 0.4);
    this.play.setBaseScale(k);
    this.play.position.set(cx, top + (bottom - top) * 0.64);
    this.best.scale.set(k);
    this.best.position.set(cx, this.play.y + 62 * k);
    this.hint.scale.set(Math.min(k, (w - 30) / (this.hint.width / this.hint.scale.x)));
    this.hint.position.set(cx, this.best.y + 40 * k);
    this.coins.scale.set(k);
    this.coins.position.set(safe.left + CONFIG.ui.margin + 20 * k, top + CONFIG.ui.margin + 22 * k);
    this.sound.setBaseScale(k);
    this.music.setBaseScale(k);
    this.sound.position.set(cx - 40 * k, bottom - CONFIG.ui.margin - 40 * k);
    this.music.position.set(cx + 40 * k, bottom - CONFIG.ui.margin - 40 * k);
  }

  override update(dtMs: number): void {
    const dt = dtMs / 1000;
    this.t += dt;
    this.bg.update(dt);
    // Бубуш покачивается и меняет выражение лица.
    this.pilot.rotation = Math.sin(this.t * 1.6) * 0.06;
    this.pilot.y += Math.sin(this.t * 2.2) * 0.25;
    const idx = Math.floor(this.t / 1.6) % MOODS.length;
    if (idx !== this.moodIdx) {
      this.moodIdx = idx;
      this.pilot.setMood(MOODS[idx]!);
    }
  }
}

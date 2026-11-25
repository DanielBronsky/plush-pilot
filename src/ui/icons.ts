import { Graphics } from 'pixi.js';
import { shade } from '../render/color';

// Иконки рисуются кодом в квадрате size×size с центром в (0, 0).
export type IconName =
  | 'play'
  | 'pause'
  | 'restart'
  | 'undo'
  | 'hint'
  | 'soundOn'
  | 'soundOff'
  | 'musicOn'
  | 'musicOff'
  | 'home'
  | 'grid'
  | 'lock'
  | 'star'
  | 'heart'
  | 'ad'
  | 'motion'
  | 'motionOff'
  | 'next'
  | 'back'
  | 'coin'
  | 'shop'
  | 'check';

/**
 * bg — цвет фона под иконкой (кнопки). Нужен перечёркнутым значкам:
 * черта рисуется с обводкой цвета фона, чтобы не сливаться с рисунком.
 */
export function drawIcon(
  g: Graphics,
  name: IconName,
  s: number,
  color: number,
  bg?: number,
): Graphics {
  const h = s / 2;
  const lw = Math.max(2, s * 0.12);
  const stroke = { width: lw, color, cap: 'round' as const, join: 'round' as const };
  switch (name) {
    case 'play':
      g.poly([-h * 0.55, -h * 0.75, h * 0.8, 0, -h * 0.55, h * 0.75]).fill(color);
      break;
    case 'next':
      g.poly([-h * 0.7, -h * 0.7, h * 0.2, 0, -h * 0.7, h * 0.7]).fill(color);
      g.poly([-h * 0.05, -h * 0.7, h * 0.85, 0, -h * 0.05, h * 0.7]).fill(color);
      break;
    case 'back':
      g.moveTo(h * 0.3, -h * 0.7)
        .lineTo(-h * 0.4, 0)
        .lineTo(h * 0.3, h * 0.7)
        .stroke(stroke);
      break;
    case 'pause':
      g.roundRect(-h * 0.6, -h * 0.75, h * 0.42, h * 1.5, h * 0.12).fill(color);
      g.roundRect(h * 0.18, -h * 0.75, h * 0.42, h * 1.5, h * 0.12).fill(color);
      break;
    case 'restart':
      // По часовой стрелке, разрыв сверху.
      arcArrow(g, h * 0.62, deg(-70), deg(230), false, stroke, color);
      break;
    case 'undo': {
      // Стрелка-крюк влево (как «отменить» в редакторах) — не путается с рестартом.
      const r = h * 0.42;
      const cx = h * 0.2;
      const cy = h * 0.05;
      g.moveTo(-h * 0.45, cy - r)
        .lineTo(cx, cy - r)
        .arc(cx, cy, r, -Math.PI / 2, Math.PI / 2)
        .lineTo(-h * 0.2, cy + r)
        .stroke(stroke);
      const a = lw * 1.6;
      g.poly([
        -h * 0.45 - a * 1.2,
        cy - r,
        -h * 0.45 + a * 0.3,
        cy - r - a * 1.1,
        -h * 0.45 + a * 0.3,
        cy - r + a * 1.1,
      ]).fill(color);
      break;
    }
    case 'hint': {
      // Лампочка.
      g.circle(0, -h * 0.2, h * 0.55).fill(color);
      g.roundRect(-h * 0.3, h * 0.2, h * 0.6, h * 0.4, h * 0.08).fill(color);
      g.roundRect(-h * 0.24, h * 0.66, h * 0.48, h * 0.18, h * 0.08).fill(color);
      break;
    }
    case 'soundOn':
    case 'soundOff': {
      // Динамик в левой половине, волны — в правой, с явным зазором между ними.
      g.poly([
        -h * 0.95,
        -h * 0.28,
        -h * 0.6,
        -h * 0.28,
        -h * 0.15,
        -h * 0.68,
        -h * 0.15,
        h * 0.68,
        -h * 0.6,
        h * 0.28,
        -h * 0.95,
        h * 0.28,
      ]).fill(color);
      if (name === 'soundOn') {
        // Две тонкие концентрические волны; центр — у раструба динамика.
        const a = deg(48);
        const wave = { ...stroke, width: lw * 0.85 };
        // moveTo перед дугой — иначе Pixi тянет линию от предыдущей точки контура.
        for (const r of [h * 0.62, h * 1.12]) {
          g.moveTo(-h * 0.3 + Math.cos(-a) * r, Math.sin(-a) * r)
            .arc(-h * 0.3, 0, r, -a, a)
            .stroke(wave);
        }
      } else {
        g.moveTo(h * 0.35, -h * 0.35)
          .lineTo(h * 0.85, h * 0.35)
          .stroke(stroke);
        g.moveTo(h * 0.85, -h * 0.35)
          .lineTo(h * 0.35, h * 0.35)
          .stroke(stroke);
      }
      break;
    }
    case 'musicOn':
    case 'musicOff': {
      // Две восьмые с ребром: наклонённые овальные головки, штили справа от головок.
      const sw = Math.max(2, s * 0.09);
      const heads: [number, number][] = [
        [-h * 0.42, h * 0.58],
        [h * 0.52, h * 0.42],
      ];
      for (const [x, y] of heads)
        g.poly(ellipsePoly(x, y, h * 0.31, h * 0.22, deg(-24))).fill(color);
      const s1 = heads[0]![0] + h * 0.27;
      const s2 = heads[1]![0] + h * 0.27;
      const top1 = -h * 0.58;
      const top2 = -h * 0.78;
      g.rect(s1 - sw, top1, sw, heads[0]![1] - top1 - h * 0.05).fill(color);
      g.rect(s2 - sw, top2, sw, heads[1]![1] - top2 - h * 0.05).fill(color);
      const bt = h * 0.3;
      g.poly([s1 - sw, top1, s2, top2, s2, top2 + bt, s1 - sw, top1 + bt]).fill(color);
      if (name === 'musicOff') {
        // Просвет цвета фона вокруг черты — нота и черта не сливаются.
        if (bg !== undefined)
          g.moveTo(-h * 0.85, -h * 0.85)
            .lineTo(h * 0.85, h * 0.85)
            .stroke({ ...stroke, width: lw * 1.9, color: bg });
        g.moveTo(-h * 0.85, -h * 0.85)
          .lineTo(h * 0.85, h * 0.85)
          .stroke({ ...stroke, width: lw * 1.1 });
      }
      break;
    }
    case 'home':
      g.poly([
        0,
        -h * 0.85,
        h * 0.85,
        -h * 0.05,
        h * 0.6,
        -h * 0.05,
        h * 0.6,
        h * 0.75,
        -h * 0.6,
        h * 0.75,
        -h * 0.6,
        -h * 0.05,
        -h * 0.85,
        -h * 0.05,
      ]).fill(color);
      break;
    case 'grid': {
      const c = h * 0.72;
      const gap = h * 0.16;
      for (const x of [-1, 1])
        for (const y of [-1, 1])
          g.roundRect(
            x < 0 ? -c : gap / 2,
            y < 0 ? -c : gap / 2,
            c - gap / 2,
            c - gap / 2,
            h * 0.1,
          ).fill(color);
      break;
    }
    case 'lock':
      g.roundRect(-h * 0.62, -h * 0.1, h * 1.24, h * 0.95, h * 0.14).fill(color);
      g.arc(0, -h * 0.12, h * 0.4, Math.PI, 0).stroke({ ...stroke, width: lw * 1.05 });
      break;
    case 'star': {
      const pts: number[] = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? h : h * 0.45;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        pts.push(Math.cos(a) * r, Math.sin(a) * r + h * 0.06);
      }
      g.poly(pts).fill(color);
      break;
    }
    case 'heart': {
      const r = h * 0.48;
      g.circle(-r * 0.92, -h * 0.25, r).fill(color);
      g.circle(r * 0.92, -h * 0.25, r).fill(color);
      g.poly([-h * 0.92, -h * 0.12, h * 0.92, -h * 0.12, 0, h * 0.85]).fill(color);
      break;
    }
    case 'ad': {
      // «Видео»: экран с треугольником.
      // Треугольник вырезан — виден на любом фоне.
      g.roundRect(-h * 0.85, -h * 0.6, h * 1.7, h * 1.2, h * 0.22).fill(color);
      g.poly([-h * 0.22, -h * 0.32, h * 0.38, 0, -h * 0.22, h * 0.32]).cut();
      break;
    }
    case 'coin': {
      // Монета: тёмный обод, светлая середина, звёздочка и блик.
      g.circle(0, h * 0.08, h * 0.92).fill(shade(color, 0.7));
      g.circle(0, 0, h * 0.92).fill(color);
      g.circle(0, 0, h * 0.66).fill(shade(color, 0.86));
      g.star(0, 0, 5, h * 0.42, h * 0.19, 0).fill(shade(color, 1.25));
      g.ellipse(-h * 0.38, -h * 0.42, h * 0.2, h * 0.12).fill({ color: 0xffffff, alpha: 0.6 });
      break;
    }
    case 'shop': {
      // Сумка с ручкой.
      g.roundRect(-h * 0.78, -h * 0.3, h * 1.56, h * 1.15, h * 0.2).fill(color);
      g.arc(0, -h * 0.3, h * 0.42, Math.PI, 0).stroke({ ...stroke, width: lw * 1.1 });
      break;
    }
    case 'check':
      g.moveTo(-h * 0.62, 0)
        .lineTo(-h * 0.15, h * 0.48)
        .lineTo(h * 0.68, -h * 0.5)
        .stroke({ ...stroke, width: lw * 1.4 });
      break;
    case 'motion':
    case 'motionOff': {
      if (name === 'motion') {
        // «Искорки»: одна большая четырёхлучевая звезда и две маленькие — значит, эффекты.
        const sparks: [number, number, number][] = [
          [-h * 0.22, h * 0.12, h * 0.72],
          [h * 0.55, -h * 0.5, h * 0.34],
          [h * 0.58, h * 0.58, h * 0.22],
        ];
        for (const [x, y, r] of sparks) g.star(x, y, 4, r, r * 0.3, 0).fill(color);
      } else {
        // Выключено — как у звука: целая искорка слева и крестик справа.
        g.star(-h * 0.35, 0, 4, h * 0.62, h * 0.62 * 0.3, 0).fill(color);
        g.moveTo(h * 0.35, -h * 0.35)
          .lineTo(h * 0.85, h * 0.35)
          .stroke(stroke);
        g.moveTo(h * 0.85, -h * 0.35)
          .lineTo(h * 0.35, h * 0.35)
          .stroke(stroke);
      }
      break;
    }
  }
  return g;
}

const deg = (d: number) => (d * Math.PI) / 180;

/** Повёрнутый эллипс как многоугольник (у Graphics.ellipse нет поворота). */
function ellipsePoly(cx: number, cy: number, rx: number, ry: number, rot: number): number[] {
  const pts: number[] = [];
  const c = Math.cos(rot);
  const sn = Math.sin(rot);
  for (let i = 0; i < 24; i++) {
    const t = (i / 24) * Math.PI * 2;
    const x = Math.cos(t) * rx;
    const y = Math.sin(t) * ry;
    pts.push(cx + x * c - y * sn, cy + x * sn + y * c);
  }
  return pts;
}

/** Дуга окружности со стрелкой на конце. */
function arcArrow(
  g: Graphics,
  r: number,
  start: number,
  end: number,
  ccw: boolean,
  stroke: { width: number; color: number },
  color: number,
): void {
  g.arc(0, 0, r, start, end, ccw).stroke(stroke);
  const px = Math.cos(end) * r;
  const py = Math.sin(end) * r;
  // Касательная в конце дуги — направление стрелки.
  const dx = ccw ? Math.sin(end) : -Math.sin(end);
  const dy = ccw ? -Math.cos(end) : Math.cos(end);
  const a = stroke.width * 1.5;
  g.poly([
    px + dx * a * 1.3,
    py + dy * a * 1.3,
    px - dy * a,
    py + dx * a,
    px + dy * a,
    py - dx * a,
  ]).fill(color);
}

export function icon(name: IconName, size: number, color: number): Graphics {
  const g = drawIcon(new Graphics(), name, size, color);
  g.eventMode = 'none';
  return g;
}

/**
 * Сундук (цветной, без параметра цвета). s — ширина. open — с откинутой крышкой и сиянием.
 * Центр — середина сундука.
 */
export function drawChest(g: Graphics, s: number, open = false): Graphics {
  const w = s;
  const h = s * 0.72;
  const wood = 0xb5652b;
  const woodDark = 0x7c3f17;
  const gold = 0xffc93c;
  const goldDark = 0xd69a12;
  const top = -h * 0.1;
  g.roundRect(-w / 2 + 3, top + 6, w, h * 0.6, s * 0.08).fill({ color: 0x000000, alpha: 0.2 });
  if (open) {
    // Крышка откинута назад и держится за задний край корпуса (видна её внутренняя сторона).
    g.poly([
      -w / 2,
      top + 2,
      w / 2,
      top + 2,
      w * 0.44,
      top - h * 0.5,
      -w * 0.44,
      top - h * 0.5,
    ]).fill(woodDark);
    g.poly([
      -w * 0.4,
      top - 2,
      w * 0.4,
      top - 2,
      w * 0.36,
      top - h * 0.42,
      -w * 0.36,
      top - h * 0.42,
    ]).fill(0x5e2f10);
    // Сияние и золото внутри.
    g.poly([-w * 0.3, top, w * 0.3, top, w * 0.55, -h * 1.05, -w * 0.55, -h * 1.05]).fill({
      color: 0xfff3b0,
      alpha: 0.5,
    });
    g.ellipse(0, top + 3, w * 0.42, h * 0.1).fill(0xffd23f);
    for (const [cx, cy] of [
      [-0.2, -0.02],
      [0.05, -0.06],
      [0.24, -0.01],
    ])
      g.circle(w * cx, top + h * cy, s * 0.06).fill(0xffe27a);
  }
  // Корпус.
  g.roundRect(-w / 2, top, w, h * 0.6, s * 0.08).fill(woodDark);
  g.roundRect(-w / 2, top, w, h * 0.54, s * 0.08).fill(wood);
  for (const x of [-w * 0.32, w * 0.32 - w * 0.1]) g.rect(x, top, w * 0.1, h * 0.6).fill(goldDark);
  if (!open) {
    // Крышка-полукруг.
    g.roundRect(-w / 2, top - h * 0.42, w, h * 0.46, s * 0.2).fill(woodDark);
    g.roundRect(-w / 2, top - h * 0.42, w, h * 0.4, s * 0.2).fill(0xc97434);
    for (const x of [-w * 0.32, w * 0.32 - w * 0.1])
      g.rect(x, top - h * 0.42, w * 0.1, h * 0.44).fill(gold);
    g.rect(-w / 2, top - h * 0.04, w, h * 0.08).fill(gold);
    // Замок.
    g.roundRect(-w * 0.1, top - h * 0.1, w * 0.2, h * 0.26, s * 0.04).fill(gold);
    g.circle(0, top + h * 0.02, s * 0.03).fill(woodDark);
  }
  return g;
}

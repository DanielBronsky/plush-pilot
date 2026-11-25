// Симуляция арены: игрок, враги, пули, монеты, волны. Без Pixi — тестируется в Node.
// Шаг step() двигает мир на dt секунд и складывает в world.events, что произошло:
// по событиям экран показывает эффекты и играет звуки.
import { CONFIG } from '../config';
import { makeRng } from './rng';
import type { Rng } from './rng';

export type EnemyKind = 'buzzer' | 'gunner' | 'brute';

export interface Body {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

export interface Player extends Body {
  hp: number;
  maxHp: number;
  /** Сколько ещё секунд неуязвим после попадания. */
  invuln: number;
  fireCd: number;
  /** Направление прицела (единичный вектор). */
  aimX: number;
  aimY: number;
}

export interface Enemy extends Body {
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  fireCd: number;
  /** Для стрелка: в какую сторону он кружит вокруг игрока (1 / -1). */
  orbit: number;
}

export interface Bullet extends Body {
  life: number;
  damage: number;
  from: 'player' | 'enemy';
}

export interface Pickup extends Body {
  value: number;
  life: number;
}

export type SimEvent =
  | { type: 'shoot'; x: number; y: number; dx: number; dy: number }
  | { type: 'enemyShoot'; x: number; y: number }
  | { type: 'enemyHit'; id: number; x: number; y: number }
  | { type: 'kill'; id: number; kind: EnemyKind; x: number; y: number }
  | { type: 'hurt'; x: number; y: number; hp: number }
  | { type: 'pickup'; x: number; y: number; value: number }
  | { type: 'spawn'; id: number; kind: EnemyKind; x: number; y: number }
  | { type: 'waveStart'; wave: number }
  | { type: 'waveClear'; wave: number }
  | { type: 'dead' };

export interface Input {
  /** Куда лететь: вектор длиной до 1. */
  moveX: number;
  moveY: number;
  /** Куда целиться: любое ненулевое направление (нулевое — прицел не меняется). */
  aimX: number;
  aimY: number;
  fire: boolean;
}

export const NO_INPUT: Input = { moveX: 0, moveY: 0, aimX: 0, aimY: 0, fire: false };

export interface World {
  time: number;
  player: Player;
  enemies: Enemy[];
  bullets: Bullet[];
  pickups: Pickup[];
  wave: number;
  phase: 'breather' | 'fighting' | 'dead';
  /** До конца передышки. */
  phaseTime: number;
  toSpawn: EnemyKind[];
  spawnCd: number;
  coins: number;
  kills: number;
  events: SimEvent[];
  nextId: number;
  rng: Rng;
}

const P = CONFIG.player;
const A = CONFIG.arena;

export function createWorld(seed = 1): World {
  return {
    time: 0,
    player: {
      id: 0,
      x: A.w / 2,
      y: A.h / 2,
      vx: 0,
      vy: 0,
      r: P.radius,
      hp: P.maxHp,
      maxHp: P.maxHp,
      invuln: 0,
      fireCd: 0,
      aimX: 0,
      aimY: -1,
    },
    enemies: [],
    bullets: [],
    pickups: [],
    wave: 0,
    phase: 'breather',
    phaseTime: CONFIG.waves.breather,
    toSpawn: [],
    spawnCd: 0,
    coins: 0,
    kills: 0,
    events: [],
    nextId: 1,
    rng: makeRng(seed),
  };
}

/** Состав волны: число врагов растёт, стрелки — со 2-й волны, толстяки — с 4-й. */
export function waveComposition(wave: number, rng: Rng): EnemyKind[] {
  const W = CONFIG.waves;
  const count = W.baseCount + W.perWave * (wave - 1);
  const brutes = wave >= 4 ? Math.min(Math.floor(wave / 4), Math.floor(count / 4)) : 0;
  const gunners = wave >= 2 ? Math.round((count - brutes) * Math.min(0.4, 0.15 + wave * 0.03)) : 0;
  const list: EnemyKind[] = [];
  for (let i = 0; i < brutes; i++) list.push('brute');
  for (let i = 0; i < gunners; i++) list.push('gunner');
  while (list.length < count) list.push('buzzer');
  // Перемешиваем, чтобы типы шли вперемешку.
  for (let i = list.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [list[i], list[j]] = [list[j]!, list[i]!];
  }
  return list;
}

export function step(w: World, input: Input, dt: number): void {
  w.events.length = 0;
  if (w.phase === 'dead') return;
  w.time += dt;
  updatePlayer(w, input, dt);
  updateWaves(w, dt);
  for (const e of w.enemies) updateEnemy(w, e, dt);
  separateEnemies(w);
  updateBullets(w, dt);
  updatePickups(w, dt);
  collide(w);
}

function updatePlayer(w: World, input: Input, dt: number): void {
  const p = w.player;
  let mx = input.moveX;
  let my = input.moveY;
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  const k = Math.min(1, P.accel * dt);
  p.vx += (mx * P.speed - p.vx) * k;
  p.vy += (my * P.speed - p.vy) * k;
  p.x = clamp(p.x + p.vx * dt, p.r, A.w - p.r);
  p.y = clamp(p.y + p.vy * dt, p.r, A.h - p.r);
  if (p.x === p.r || p.x === A.w - p.r) p.vx = 0;
  if (p.y === p.r || p.y === A.h - p.r) p.vy = 0;

  const al = Math.hypot(input.aimX, input.aimY);
  if (al > 1e-3) {
    p.aimX = input.aimX / al;
    p.aimY = input.aimY / al;
  }
  p.invuln = Math.max(0, p.invuln - dt);
  p.fireCd = Math.max(0, p.fireCd - dt);
  if (input.fire && p.fireCd <= 0) {
    const a = Math.atan2(p.aimY, p.aimX) + (w.rng.next() - 0.5) * 2 * P.spread;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    w.bullets.push({
      id: w.nextId++,
      x: p.x + dx * p.r,
      y: p.y + dy * p.r,
      vx: dx * P.bulletSpeed + p.vx * 0.3,
      vy: dy * P.bulletSpeed + p.vy * 0.3,
      r: P.bulletRadius,
      life: P.bulletLife,
      damage: P.bulletDamage,
      from: 'player',
    });
    p.fireCd = P.fireInterval;
    w.events.push({ type: 'shoot', x: p.x, y: p.y, dx, dy });
  }
}

function updateWaves(w: World, dt: number): void {
  const W = CONFIG.waves;
  if (w.phase === 'breather') {
    w.phaseTime -= dt;
    if (w.phaseTime <= 0) {
      w.wave++;
      w.phase = 'fighting';
      w.toSpawn = waveComposition(w.wave, w.rng);
      w.spawnCd = 0;
      w.events.push({ type: 'waveStart', wave: w.wave });
    }
    return;
  }
  w.spawnCd -= dt;
  if (w.toSpawn.length > 0 && w.spawnCd <= 0) {
    spawnEnemy(w, w.toSpawn.shift()!);
    w.spawnCd = W.spawnInterval;
  }
  if (w.toSpawn.length === 0 && w.enemies.length === 0) {
    w.events.push({ type: 'waveClear', wave: w.wave });
    w.phase = 'breather';
    w.phaseTime = W.breather;
  }
}

function spawnEnemy(w: World, kind: EnemyKind): void {
  const c = CONFIG.enemies[kind];
  const p = w.player;
  let x = 0;
  let y = 0;
  // Подальше от игрока, внутри арены.
  for (let t = 0; t < 30; t++) {
    x = c.radius + w.rng.next() * (A.w - c.radius * 2);
    y = c.radius + w.rng.next() * (A.h - c.radius * 2);
    if (Math.hypot(x - p.x, y - p.y) >= CONFIG.waves.safeSpawn) break;
  }
  const e: Enemy = {
    id: w.nextId++,
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    r: c.radius,
    hp: c.hp,
    maxHp: c.hp,
    fireCd: kind === 'gunner' ? CONFIG.enemies.gunner.fireInterval * (0.6 + w.rng.next() * 0.8) : 0,
    orbit: w.rng.next() < 0.5 ? 1 : -1,
  };
  w.enemies.push(e);
  w.events.push({ type: 'spawn', id: e.id, kind, x, y });
}

function updateEnemy(w: World, e: Enemy, dt: number): void {
  const p = w.player;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const d = Math.max(1e-6, Math.hypot(dx, dy));
  const ux = dx / d;
  const uy = dy / d;
  let tx: number;
  let ty: number;
  let turn = 3;
  if (e.kind === 'buzzer') {
    const c = CONFIG.enemies.buzzer;
    // Летит на игрока чуть «виляя».
    const wob = Math.sin(w.time * 6 + e.id) * 0.35;
    tx = (ux - uy * wob) * c.speed;
    ty = (uy + ux * wob) * c.speed;
  } else if (e.kind === 'gunner') {
    const c = CONFIG.enemies.gunner;
    // Держит дистанцию и кружит вокруг игрока.
    const radial = d > c.keepDistance + 40 ? 1 : d < c.keepDistance - 60 ? -1 : 0;
    tx = (ux * radial - uy * e.orbit * 0.8) * c.speed;
    ty = (uy * radial + ux * e.orbit * 0.8) * c.speed;
    e.fireCd -= dt;
    if (e.fireCd <= 0 && d < 950 && w.phase !== 'dead') {
      w.bullets.push({
        id: w.nextId++,
        x: e.x + ux * e.r,
        y: e.y + uy * e.r,
        vx: ux * c.bulletSpeed,
        vy: uy * c.bulletSpeed,
        r: c.bulletRadius,
        life: 3,
        damage: c.damage,
        from: 'enemy',
      });
      e.fireCd = c.fireInterval * (0.8 + w.rng.next() * 0.4);
      w.events.push({ type: 'enemyShoot', x: e.x, y: e.y });
    }
  } else {
    const c = CONFIG.enemies.brute;
    tx = ux * c.speed;
    ty = uy * c.speed;
    turn = 1.5;
  }
  const k = Math.min(1, turn * dt);
  e.vx += (tx - e.vx) * k;
  e.vy += (ty - e.vy) * k;
  e.x = clamp(e.x + e.vx * dt, e.r, A.w - e.r);
  e.y = clamp(e.y + e.vy * dt, e.r, A.h - e.r);
}

/** Враги не налезают друг на друга. */
function separateEnemies(w: World): void {
  const list = w.enemies;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]!;
      const b = list[j]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const min = a.r + b.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const push = (min - d) / 2;
      // Тяжёлый толкает лёгкого сильнее.
      const ka = b.r / (a.r + b.r);
      const kb = a.r / (a.r + b.r);
      a.x -= (dx / d) * push * ka * 2;
      a.y -= (dy / d) * push * ka * 2;
      b.x += (dx / d) * push * kb * 2;
      b.y += (dy / d) * push * kb * 2;
    }
  }
}

function updateBullets(w: World, dt: number): void {
  let n = 0;
  for (const b of w.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    const out = b.x < -50 || b.y < -50 || b.x > A.w + 50 || b.y > A.h + 50;
    if (b.life > 0 && !out) w.bullets[n++] = b;
  }
  w.bullets.length = n;
}

function updatePickups(w: World, dt: number): void {
  const p = w.player;
  let n = 0;
  for (const c of w.pickups) {
    c.life -= dt;
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const d = Math.hypot(dx, dy);
    if (d < P.magnet) {
      const s = CONFIG.pickups.speed * (1 - (d / P.magnet) * 0.5);
      c.x += (dx / d) * s * dt;
      c.y += (dy / d) * s * dt;
    } else {
      // Монеты разлетаются и тормозят.
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.vx *= 1 - Math.min(1, 4 * dt);
      c.vy *= 1 - Math.min(1, 4 * dt);
    }
    if (d < p.r + c.r) {
      w.coins += c.value;
      w.events.push({ type: 'pickup', x: c.x, y: c.y, value: c.value });
      continue;
    }
    if (c.life > 0) w.pickups[n++] = c;
  }
  w.pickups.length = n;
}

function collide(w: World): void {
  const p = w.player;
  // Пули игрока по врагам.
  let nb = 0;
  for (const b of w.bullets) {
    let used = false;
    if (b.from === 'player') {
      for (const e of w.enemies) {
        if (e.hp <= 0 || !overlap(b, e)) continue;
        e.hp -= b.damage;
        // Небольшой отброс от попадания.
        e.vx += b.vx * 0.06;
        e.vy += b.vy * 0.06;
        used = true;
        if (e.hp > 0) w.events.push({ type: 'enemyHit', id: e.id, x: b.x, y: b.y });
        break;
      }
    } else if (overlap(b, p)) {
      used = true;
      hurt(w, b.damage);
    }
    if (!used) w.bullets[nb++] = b;
  }
  w.bullets.length = nb;

  // Касание врага.
  for (const e of w.enemies) {
    if (e.hp > 0 && overlap(e, p)) {
      hurt(w, CONFIG.enemies[e.kind].damage);
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.max(1e-6, Math.hypot(dx, dy));
      e.vx = (dx / d) * 600;
      e.vy = (dy / d) * 600;
    }
  }

  // Сбитые враги — монеты.
  let ne = 0;
  for (const e of w.enemies) {
    if (e.hp > 0) {
      w.enemies[ne++] = e;
      continue;
    }
    w.kills++;
    w.events.push({ type: 'kill', id: e.id, kind: e.kind, x: e.x, y: e.y });
    const coins = CONFIG.enemies[e.kind].coins;
    for (let i = 0; i < coins; i++) {
      const a = w.rng.next() * Math.PI * 2;
      const s = 80 + w.rng.next() * 160;
      w.pickups.push({
        id: w.nextId++,
        x: e.x,
        y: e.y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        r: CONFIG.pickups.radius,
        value: 1,
        life: CONFIG.pickups.life,
      });
    }
  }
  w.enemies.length = ne;
}

function hurt(w: World, damage: number): void {
  const p = w.player;
  if (p.invuln > 0 || w.phase === 'dead') return;
  p.hp = Math.max(0, p.hp - damage);
  p.invuln = P.invuln;
  w.events.push({ type: 'hurt', x: p.x, y: p.y, hp: p.hp });
  if (p.hp === 0) {
    w.phase = 'dead';
    w.events.push({ type: 'dead' });
  }
}

/** Ближайший к игроку враг (для автоприцела). */
export function nearestEnemy(w: World, maxDist = Infinity): Enemy | null {
  let best: Enemy | null = null;
  let bd = maxDist;
  for (const e of w.enemies) {
    const d = Math.hypot(e.x - w.player.x, e.y - w.player.y);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

function overlap(a: Body, b: Body): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = a.r + b.r;
  return dx * dx + dy * dy < r * r;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { NO_INPUT, createWorld, nearestEnemy, step, waveComposition } from '../src/core/sim';
import type { Input, World } from '../src/core/sim';
import { makeRng } from '../src/core/rng';

const dt = 1 / 60;
const run = (w: World, input: Input, seconds: number) => {
  const events: World['events'] = [];
  for (let t = 0; t < seconds; t += dt) {
    step(w, input, dt);
    events.push(...w.events);
  }
  return events;
};

describe('waves', () => {
  it('composition grows and adds gunners from wave 2, brutes from wave 4', () => {
    const rng = makeRng(3);
    const w1 = waveComposition(1, rng);
    const w2 = waveComposition(2, rng);
    const w6 = waveComposition(6, rng);
    expect(w1).toHaveLength(CONFIG.waves.baseCount);
    expect(w1.every(k => k === 'buzzer')).toBe(true);
    expect(w2.some(k => k === 'gunner')).toBe(true);
    expect(w2.some(k => k === 'brute')).toBe(false);
    expect(w6.some(k => k === 'brute')).toBe(true);
    expect(w6.length).toBeGreaterThan(w2.length);
  });

  it('first wave starts after the breather and enemies spawn away from the player', () => {
    const w = createWorld(1);
    const ev = run(w, NO_INPUT, CONFIG.waves.breather + 4);
    expect(ev.some(e => e.type === 'waveStart' && e.wave === 1)).toBe(true);
    const spawns = ev.filter(e => e.type === 'spawn');
    expect(spawns.length).toBe(CONFIG.waves.baseCount);
    for (const s of spawns)
      if (s.type === 'spawn')
        expect(Math.hypot(s.x - CONFIG.arena.w / 2, s.y - CONFIG.arena.h / 2)).toBeGreaterThan(
          CONFIG.waves.safeSpawn - 1,
        );
  });

  it('clearing every enemy ends the wave and starts the next after a breather', () => {
    const w = createWorld(2);
    run(w, NO_INPUT, CONFIG.waves.breather + 0.01);
    w.toSpawn = [];
    w.enemies.length = 0;
    const ev = run(w, NO_INPUT, CONFIG.waves.breather + 0.2);
    expect(ev.find(e => e.type === 'waveClear')).toEqual({ type: 'waveClear', wave: 1 });
    expect(ev.some(e => e.type === 'waveStart' && e.wave === 2)).toBe(true);
  });
});

describe('player', () => {
  it('moves, stays inside the arena and aims where told', () => {
    const w = createWorld();
    run(w, { ...NO_INPUT, moveX: 1, aimX: 0, aimY: 1 }, 10);
    expect(w.player.x).toBe(CONFIG.arena.w - w.player.r);
    expect(w.player.aimY).toBeCloseTo(1);
  });

  it('fires at the configured rate', () => {
    const w = createWorld();
    const ev = run(w, { ...NO_INPUT, aimX: 1, fire: true }, 1);
    const shots = ev.filter(e => e.type === 'shoot').length;
    expect(shots).toBeGreaterThanOrEqual(Math.floor(1 / CONFIG.player.fireInterval));
    expect(shots).toBeLessThanOrEqual(Math.ceil(1 / CONFIG.player.fireInterval) + 1);
  });

  it('bullets kill an enemy, which drops coins that the magnet pulls in', () => {
    const w = createWorld();
    w.phase = 'fighting';
    w.wave = 1;
    w.toSpawn = [];
    const p = w.player;
    w.enemies.push({
      id: 99,
      kind: 'buzzer',
      x: p.x + 200,
      y: p.y,
      vx: 0,
      vy: 0,
      r: 26,
      hp: 2,
      maxHp: 2,
      fireCd: 0,
      orbit: 1,
    });
    const ev = run(w, { ...NO_INPUT, aimX: 1, fire: true }, 1.5);
    expect(ev.some(e => e.type === 'kill' && e.id === 99)).toBe(true);
    expect(w.coins).toBe(CONFIG.enemies.buzzer.coins);
    expect(w.kills).toBe(1);
  });

  it('getting hit costs hp, grants invulnerability, and zero hp ends the run', () => {
    const w = createWorld();
    w.phase = 'fighting';
    w.toSpawn = [];
    const p = w.player;
    const hitter = () =>
      w.bullets.push({
        id: w.nextId++,
        x: p.x,
        y: p.y,
        vx: 0,
        vy: 0,
        r: 5,
        life: 1,
        damage: 1,
        from: 'enemy',
      });
    hitter();
    step(w, NO_INPUT, dt);
    expect(p.hp).toBe(p.maxHp - 1);
    hitter();
    step(w, NO_INPUT, dt);
    expect(p.hp).toBe(p.maxHp - 1); // неуязвим
    for (let i = 0; i < 10; i++) {
      p.invuln = 0;
      hitter();
      step(w, NO_INPUT, dt);
    }
    expect(p.hp).toBe(0);
    expect(w.phase).toBe('dead');
    const x = p.x;
    step(w, { ...NO_INPUT, moveX: 1 }, 1);
    expect(p.x).toBe(x); // после смерти мир стоит
  });

  it('nearestEnemy finds the closest one', () => {
    const w = createWorld();
    const mk = (id: number, dx: number) => ({
      id,
      kind: 'buzzer' as const,
      x: w.player.x + dx,
      y: w.player.y,
      vx: 0,
      vy: 0,
      r: 20,
      hp: 1,
      maxHp: 1,
      fireCd: 0,
      orbit: 1,
    });
    w.enemies.push(mk(1, 400), mk(2, -150), mk(3, 300));
    expect(nearestEnemy(w)?.id).toBe(2);
    expect(nearestEnemy(w, 100)).toBeNull();
  });
});

describe('a long simulated fight', () => {
  it('runs 3 minutes with an auto-aiming player without errors or NaN', () => {
    const w = createWorld(7);
    for (let t = 0; t < 180 && w.phase !== 'dead'; t += dt) {
      const e = nearestEnemy(w);
      const input: Input = e
        ? {
            moveX: -(e.x - w.player.x),
            moveY: -(e.y - w.player.y),
            aimX: e.x - w.player.x,
            aimY: e.y - w.player.y,
            fire: true,
          }
        : NO_INPUT;
      const len = Math.hypot(input.moveX, input.moveY) || 1;
      step(w, { ...input, moveX: input.moveX / len, moveY: input.moveY / len }, dt);
      for (const b of [w.player, ...w.enemies]) {
        expect(Number.isFinite(b.x) && Number.isFinite(b.y)).toBe(true);
      }
    }
    expect(w.wave).toBeGreaterThanOrEqual(2);
    expect(w.kills).toBeGreaterThan(5);
  });
});

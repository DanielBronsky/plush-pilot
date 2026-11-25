// Все настраиваемые числа игры в одном месте.
// Расстояния — в единицах арены (≈ CSS px при масштабе 1), время — в секундах, если не сказано иное.

export const CONFIG = {
  title: 'Plush Pilot',

  arena: { w: 2000, h: 1400 },

  player: {
    radius: 34,
    speed: 430,
    /** Плавность разгона/торможения: чем больше, тем резче. */
    accel: 9,
    maxHp: 5,
    /** Неуязвимость после попадания. */
    invuln: 1.1,
    fireInterval: 0.13,
    bulletSpeed: 1100,
    bulletDamage: 1,
    bulletRadius: 9,
    bulletLife: 0.9,
    /** Разброс выстрелов, радианы. */
    spread: 0.05,
    magnet: 170,
  },

  enemies: {
    buzzer: { radius: 26, hp: 2, speed: 250, damage: 1, coins: 1 },
    gunner: {
      radius: 30,
      hp: 4,
      speed: 160,
      damage: 1,
      coins: 2,
      keepDistance: 360,
      fireInterval: 1.8,
      bulletSpeed: 380,
      bulletRadius: 11,
    },
    brute: { radius: 52, hp: 14, speed: 95, damage: 2, coins: 5 },
  },

  waves: {
    /** Пауза перед волной. */
    breather: 2.2,
    baseCount: 5,
    perWave: 2,
    /** Враги волны появляются не сразу, а с интервалом. */
    spawnInterval: 0.55,
    /** Не ближе этого к игроку при появлении. */
    safeSpawn: 520,
  },

  pickups: { radius: 14, life: 9, speed: 520 },

  render: {
    maxResolution: 2,
    maxParticles: 400,
  },

  ui: {
    buttonSize: 60,
    margin: 12,
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    /** Радиус виртуального джойстика на телефоне, CSS px. */
    stickRadius: 64,
  },

  ads: {
    midgameIntervalMs: 3 * 60 * 1000,
    midgameSessionGraceMs: 3 * 60 * 1000,
    localAdDurationMs: 2000,
    sdkLoadTimeoutMs: 6000,
  },

  audio: {
    masterVolume: 0.8,
    sfxVolume: 0.6,
    musicVolume: 0.25,
    musicBpm: 110,
    /** Файл музыки (без расширения) или null — процедурная музыка. */
    musicFile: null as string | null,
  },

  save: { key: 'plushpilot.save', version: 1 },
} as const;

/** Затемнить/осветлить цвет: k < 1 темнее, k > 1 светлее. */
export function shade(color: number, k: number): number {
  const ch = (shift: number) => {
    const v = (color >> shift) & 0xff;
    const out = k < 1 ? v * k : v + (255 - v) * (k - 1);
    return Math.max(0, Math.min(255, Math.round(out)));
  };
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

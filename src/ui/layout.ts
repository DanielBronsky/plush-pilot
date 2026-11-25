/** Безопасные отступы экрана (вырезы, «чёлки», полоска жестов). */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Безопасные отступы, прочитанные из CSS env(safe-area-inset-*). */
export function readSafeInsets(): Insets {
  const el = document.getElementById('safe-probe');
  if (!el) return { top: 0, right: 0, bottom: 0, left: 0 };
  const cs = getComputedStyle(el);
  const px = (v: string) => Math.max(0, parseFloat(v) || 0);
  return {
    top: px(cs.paddingTop),
    right: px(cs.paddingRight),
    bottom: px(cs.paddingBottom),
    left: px(cs.paddingLeft),
  };
}

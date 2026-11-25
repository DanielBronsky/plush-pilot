import type { Container } from 'pixi.js';

// Почему не container.destroy({ children: true }):
// в Pixi v8 эти options передаются каждому ребёнку, и Graphics с собственным
// GraphicsContext тогда НЕ уничтожает контекст — рендерер держит его геометрию,
// память растёт с каждым уровнем. destroy() без options у Graphics освобождает
// собственный контекст и не трогает общий (кэш геометрии машин).

/** Уничтожить всех детей (рекурсивно), сам контейнер оставить. */
export function destroyChildren(c: Container): void {
  for (const ch of c.removeChildren()) destroyTree(ch);
}

/** Уничтожить контейнер со всем содержимым без утечек. */
export function destroyTree(c: Container): void {
  if (c.destroyed) return;
  destroyChildren(c);
  c.destroy();
}

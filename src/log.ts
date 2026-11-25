// Единственное место, где игра пишет в консоль.
// В production-билде ничего не выводится (Vite вырезает ветку по import.meta.env.DEV).
// ?quiet в dev отключает вывод (консоль держит ссылки на объекты — мешает замерам памяти).
const quiet =
  import.meta.env.DEV &&
  typeof location !== 'undefined' &&
  new URLSearchParams(location.search).has('quiet');

export function devLog(tag: string, ...args: unknown[]): void {
  if (import.meta.env.DEV && !quiet) console.log(`[${tag}]`, ...args);
}

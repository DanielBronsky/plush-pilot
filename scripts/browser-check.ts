// Проверка игры в настоящем Chrome (headless): скриншоты, консоль, внешние запросы.
// Пример: npx tsx scripts/browser-check.ts --url http://localhost:5199/ --out shots --size 390x844 --size 900x500
// --step "js-код" выполняется в странице по очереди, после каждого шага — скриншот.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function args() {
  const a = process.argv.slice(2);
  const out = {
    url: 'http://localhost:5199/',
    dir: 'shots',
    sizes: [] as string[],
    steps: [] as string[],
    pre: [] as string[],
    reduced: false,
    wait: 1500,
    dpr: 2,
    mobile: true,
  };
  for (let i = 0; i < a.length; i++) {
    const v = a[i + 1] ?? '';
    switch (a[i]) {
      case '--url':
        out.url = v;
        i++;
        break;
      case '--out':
        out.dir = v;
        i++;
        break;
      case '--size':
        out.sizes.push(v);
        i++;
        break;
      case '--pre':
        out.pre.push(v);
        i++;
        break;
      case '--step':
        out.steps.push(v);
        i++;
        break;
      case '--wait':
        out.wait = Number(v);
        i++;
        break;
      case '--dpr':
        out.dpr = Number(v);
        i++;
        break;
      case '--reduced':
        out.reduced = true;
        break;
      case '--desktop':
        out.mobile = false;
        break;
    }
  }
  if (out.sizes.length === 0) out.sizes.push('390x844');
  return out;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  const o = args();
  mkdirSync(o.dir, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--autoplay-policy=user-gesture-required',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
    ],
  });
  const report: string[] = [];
  const host = new URL(o.url).host;
  for (const size of o.sizes) {
    const [w, h] = size.split('x').map(Number) as [number, number];
    const page = await browser.newPage();
    await page.setViewport({
      width: w,
      height: h,
      deviceScaleFactor: o.dpr,
      isMobile: o.mobile,
      hasTouch: o.mobile,
    });
    page.on('console', m => report.push(`[${size}] console.${m.type()}: ${m.text()}`));
    page.on('pageerror', e => report.push(`[${size}] PAGEERROR: ${(e as Error).message}`));
    page.on('requestfailed', r =>
      report.push(`[${size}] REQFAILED: ${r.url()} ${r.failure()?.errorText}`),
    );
    page.on('request', r => {
      const u = new URL(r.url());
      if (u.protocol.startsWith('http') && u.host !== host)
        report.push(`[${size}] EXTERNAL: ${r.url()}`);
    });
    if (o.reduced)
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    for (const js of o.pre) await page.evaluateOnNewDocument(js);
    await page.goto(o.url, { waitUntil: 'load' });
    await sleep(o.wait);
    await page.screenshot({ path: join(o.dir, `${size}-0.png`) });
    for (let i = 0; i < o.steps.length; i++) {
      try {
        const step = o.steps[i]!;
        // «@click x y» / «@tap x y» — настоящий (trusted) клик или касание.
        if (step === '@reload') {
          await page.reload({ waitUntil: 'load' });
          await sleep(o.wait);
          await page.screenshot({ path: join(o.dir, `${size}-${i + 1}.png`) });
          continue;
        }
        const m = /^@(click|tap) (\d+) (\d+)$/.exec(step);
        if (m) {
          const [x, y] = [Number(m[2]), Number(m[3])];
          if (m[1] === 'click') await page.mouse.click(x, y);
          else await page.touchscreen.tap(x, y);
          await sleep(o.wait);
          await page.screenshot({ path: join(o.dir, `${size}-${i + 1}.png`) });
          continue;
        }
        const r = await page.evaluate(step);
        if (r !== undefined) report.push(`[${size}] step ${i + 1} => ${JSON.stringify(r)}`);
      } catch (e) {
        report.push(`[${size}] step ${i + 1} FAILED: ${(e as Error).message}`);
      }
      await sleep(o.wait);
      await page.screenshot({ path: join(o.dir, `${size}-${i + 1}.png`) });
    }
    await page.close();
  }
  await browser.close();
  writeFileSync(join(o.dir, 'report.txt'), report.join('\n'));
  console.log(report.length ? report.join('\n') : '(консоль чистая, внешних запросов нет)');
}

void main();

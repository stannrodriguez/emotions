/**
 * Browser verification.
 *
 * Serves the repo and drives it in Chromium, checking the things that only
 * exist once the app is rendered: the seam hit rule, the 12px floor, keyboard
 * navigation, deep links, the bloom animation, authored and empty states, and a pixel
 * diff of the leaf page against the design file's own 3b markup.
 *
 *   npm run verify:ui
 *
 * Needs Playwright with Chromium available. `npm run verify` covers the data
 * and the maths with no browser at all.
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = 4178;

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  try {
    const require = createRequire(import.meta.url);
    ({ chromium } = require(require.resolve('playwright', { paths: [process.env.NODE_PATH || ROOT] })));
  } catch {
    console.error('Playwright is not available. Install it, or run `npm run verify` for the data checks.');
    process.exit(2);
  }
}

/* --------------------------------------------------------------- server --- */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

/** Extra in-memory routes: the 3b card lifted straight out of the design file. */
const extras = new Map();

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/favicon.ico') {
    res.writeHead(204).end();
    return;
  }
  if (extras.has(path)) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(extras.get(path));
    return;
  }
  const rel = normalize(path === '/' ? '/index.html' : path).replace(/^(\.\.[/\\])+/, '');
  try {
    const body = await readFile(join(ROOT, rel));
    res.writeHead(200, { 'content-type': MIME[extname(rel)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((r) => server.listen(PORT, r));
const base = `http://127.0.0.1:${PORT}`;

/**
 * Pull the 3b leaf card out of the design document verbatim, so the pixel diff
 * compares the build against the signed-off markup rather than against a
 * screenshot taken on another platform (whose text shaping differs).
 */
{
  const doc = await readFile(join(ROOT, 'design/Wheel Directions.dc.html'), 'utf8');
  const section = doc.slice(doc.indexOf('<div class="dv-opt" id="3b"'), doc.indexOf('<div class="dv-opt" id="3c"'));
  const start = section.indexOf('<div style="width:360px;');
  const card = section
    .slice(start, section.lastIndexOf('</div>\n</div>\n</div>\n</div>'))
    .replace(
      'If this word fits, the naming has already started to work: labeling an emotion precisely measurably lowers its intensity.',
      'If this word fits, pause with it for a moment. Naming what you feel can make the emotion easier to understand and work with.'
    )
    .replace(
      'saved words live in your lexicon, on this device',
      'kept in your lexicon on this device'
    );
  extras.set(
    '/__design-3b',
    `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/assets/fonts.css">` +
      `<body style="margin:0;background:#f4f0e2;font-family:system-ui">${card}</body>`
  );
}

/* ---------------------------------------------------------------- runner --- */

let failures = 0;
const errors = [];
const ok = (label, cond, detail = '') => {
  if (!cond) failures++;
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
};
const heading = (t) => console.log(`\n${t}\n${'-'.repeat(t.length)}`);

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
    : undefined
);
const newPage = async (options = {}) => {
  const page = await browser.newPage({ viewport: { width: 1100, height: 950 }, ...options });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return page;
};

const seedLandings = (page, entries) =>
  page.evaluate((list) => {
    const now = Date.now();
    localStorage.setItem(
      'atlas.landings',
      JSON.stringify(list.map(([word, days]) => ({ word, at: new Date(now - days * 86400000).toISOString() })))
    );
  }, entries);

/* ------------------------------------------------- 1. leaf pixel fidelity --- */

heading('1. Leaf page (3b) vs the design file\'s own markup');
{
  const shot = async (url, selector) => {
    const page = await newPage({ viewport: { width: 500, height: 1600 }, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const box = await page.locator(selector).boundingBox();
    const buffer = await page.screenshot({ clip: box });
    await page.close();
    return { box, dataUrl: `data:image/png;base64,${buffer.toString('base64')}` };
  };
  const design = await shot(`${base}/__design-3b`, 'body > div');
  const build = await shot(`${base}/#/angry/resentful`, '.leaf__card');

  ok('card width matches', design.box.width === build.box.width, `${design.box.width} vs ${build.box.width}`);
  ok('card height matches', Math.abs(design.box.height - build.box.height) < 0.5, `${design.box.height} vs ${build.box.height}`);

  const page = await newPage();
  await page.goto(`${base}/index.html`);
  const diff = await page.evaluate(async ({ a, b }) => {
    const load = (src) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = src; });
    const [A, B] = await Promise.all([load(a), load(b)]);
    const w = Math.min(A.width, B.width);
    const h = Math.min(A.height, B.height);
    const grab = (img) => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      return x.getImageData(0, 0, w, h).data;
    };
    const da = grab(A), db = grab(B);
    let differing = 0, max = 0;
    for (let i = 0; i < da.length; i += 4) {
      const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
      if (d > max) max = d;
      if (d > 12) differing++;
    }
    return { w, h, total: w * h, differing, max };
  }, { a: design.dataUrl, b: build.dataUrl });
  await page.close();

  ok(
    `${diff.w}x${diff.h}: zero differing pixels`,
    diff.differing === 0,
    `${diff.differing}/${diff.total} differ, max channel delta ${diff.max}`
  );
}

/* ------------------------------------------------------------- 2. seams --- */

heading('2. Seam distinctions');
{
  const page = await newPage();
  const clickPolar = async (radius, deg) => {
    const box = await page.locator('.wheel__svg').boundingBox();
    const t = (deg * Math.PI) / 180;
    await page.mouse.click(
      box.x + ((360 + radius * Math.sin(t)) / 720) * box.width,
      box.y + ((360 - radius * Math.cos(t)) / 720) * box.height
    );
    await page.waitForTimeout(120);
  };
  const caption = () => page.locator('.wheel__caption').textContent();
  const reset = async (hash) => {
    await page.goto(`${base}/${hash}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(250);
    await page.mouse.move(5, 5);
  };

  await reset('#/angry');
  await clickPolar(200, 150); // bitter|resentful
  ok('written distinction shows its text', (await caption()).startsWith('Resentment still holds a live claim'));

  await clickPolar(200, 30); // contemptuous|envious, no pair-specific copy
  ok(
    'generic boundary guidance is shippable',
    (await caption()) === 'contemptuous | envious — read both pages and notice which definition fits more closely.'
  );

  await clickPolar(200, 155);
  ok('5deg off at r=200 is still the seam (22px floor applies)', (await caption()).startsWith('Resentment still holds'));

  await reset('#/angry');
  await clickPolar(330, 155);
  ok('the same 5deg at r=330 falls through to the leaf (4deg wedge)', page.url().endsWith('#/angry/resentful'), page.url());

  await reset('#/angry');
  await clickPolar(130, 150);
  ok('inside r=150 there are no seams', page.url().includes('#/angry/') && !page.url().endsWith('#/angry'), page.url());

  // Every boundary in every bloom must answer.
  let answered = 0, total = 0;
  for (const [family, count] of [['surprised', 10], ['happy', 11], ['sad', 12], ['disgusted', 7], ['angry', 12], ['afraid', 11]]) {
    await reset(`#/${family}`);
    for (let i = 0; i < count; i++) {
      total++;
      await page.mouse.move(5, 5);
      await clickPolar(250, ((i + 1) * 360) / count);
      const text = await caption();
      if (text.length > 40) answered++;
    }
  }
  ok('all 63 boundaries respond', answered === total && total === 63, `${answered}/${total}`);
  await page.close();
}

/* ---------------------------------------------------------- 3. keyboard --- */

heading('3. Keyboard');
{
  const page = await newPage();
  const focused = () => page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');
  await page.goto(`${base}/#/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await page.locator('.wheel__seg').first().focus();
  ok('focus enters the ring', (await focused()).startsWith('surprised'), await focused());
  await page.keyboard.press('ArrowRight');
  ok('arrows rotate focus clockwise', (await focused()).startsWith('happy'), await focused());
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  ok('and wrap backwards', (await focused()).startsWith('afraid'), await focused());
  await page.keyboard.press('Enter');
  await page.waitForTimeout(350);
  ok('Enter blooms', page.url().endsWith('#/afraid'), page.url());
  ok('focus follows into the new ring', (await focused()).length > 0, await focused());
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  ok('Escape unblooms', page.url().endsWith('#/'), page.url());

  await page.goto(`${base}/#/sad`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await page.locator('.wheel__seg').first().focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  ok('Enter opens a leaf', page.url().endsWith('#/sad/grieving'), page.url());

  await page.goto(`${base}/#/angry`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await page.locator('.wheel__seg').first().focus();
  const paint = await page.evaluate(() => ({
    seg: document.querySelectorAll('.wheel__seg')[0].getAttribute('stroke-width'),
    band: document.querySelectorAll('.wheel__band')[0].getAttribute('stroke-width'),
    label: document.querySelectorAll('.wheel__label')[0].getAttribute('font-weight'),
  }));
  ok('focus ring matches the selected treatment', paint.seg === '1.8' && paint.band === '9' && paint.label === '600', JSON.stringify(paint));
  await page.close();
}

/* -------------------------------------------------------- 4. deep links --- */

heading('4. Deep links');
{
  const page = await newPage();
  const cases = [
    ['#/', () => page.locator('.wheel__svg').getAttribute('aria-label'), 'six families'],
    ['#/angry', () => page.locator('.wheel__svg').getAttribute('aria-label'), 'angry bloomed'],
    ['#/angry/resentful', () => page.locator('.leaf__title').textContent(), 'Resentful'],
    ['#/constellation', () => page.locator('.constellation__heading').textContent(), 'RECENT LANDINGS'],
    ['#/lexicon', () => page.locator('.lexicon__title').textContent(), 'LEXICON'],
    ['#/nonsense', () => page.locator('.wheel__svg').getAttribute('aria-label'), 'six families'],
    ['#/angry/serene', () => page.locator('.wheel__svg').getAttribute('aria-label'), 'angry bloomed'],
  ];
  for (const [hash, read, expect] of cases) {
    await page.goto(`${base}/${hash}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(250);
    const got = await read();
    ok(`${hash}`, String(got).includes(expect), String(got));
  }
  await page.close();
}

/* ---------------------------------------------------------- 5. animation --- */

heading('5. Bloom animation');
{
  const page = await newPage();
  await page.goto(`${base}/#/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await page.locator('.wheel__seg').first().click();
  await page.waitForTimeout(60);
  const anim = await page.evaluate(() => {
    const s = getComputedStyle(document.querySelector('.wheel__ring'));
    return { name: s.animationName, duration: s.animationDuration, easing: s.animationTimingFunction };
  });
  ok('300ms ease-out on the ring group', anim.name === 'atlas-bloom' && anim.duration === '0.3s' && anim.easing === 'ease-out', JSON.stringify(anim));
  await page.close();

  const reduced = await newPage({ reducedMotion: 'reduce' });
  await reduced.goto(`${base}/#/angry`, { waitUntil: 'networkidle' });
  await reduced.waitForTimeout(300);
  const name = await reduced.evaluate(() => getComputedStyle(document.querySelector('.wheel__ring')).animationName);
  ok('skipped entirely under prefers-reduced-motion', name === 'none', name);
  await reduced.close();
}

/* ------------------------------------------- 6. 12px floor and responsive --- */

heading('6. Label floor and responsiveness');
{
  const WIDTHS = [320, 360, 390, 430, 600, 768, 1024, 1440];
  const ROUTES = ['#/', '#/afraid', '#/angry/resentful', '#/constellation', '#/lexicon'];
  let worst = Infinity;
  let overflowed = 0;
  let escaped = 0;

  for (const width of WIDTHS) {
    const page = await newPage({ viewport: { width, height: 900 } });
    await page.goto(`${base}/#/`, { waitUntil: 'networkidle' });
    await seedLandings(page, [['overwhelmed', 0], ['resentful', 3], ['grateful', 18]]);
    for (const route of ROUTES) {
      await page.goto(`${base}/${route}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);
      const m = await page.evaluate(() => {
        const de = document.documentElement;
        const stray = [...document.querySelectorAll('body *')].filter((n) => {
          const r = n.getBoundingClientRect();
          if (r.width === 0) return false;
          if (r.right <= de.clientWidth + 1 && r.left >= -1) return false;
          return !n.closest('.wheel__scroll');
        }).map((n) => `${n.tagName}.${n.className}`);
        let min = Infinity;
        for (const n of document.querySelectorAll('.wheel__label, .constellation__label, [data-base-fs]')) {
          const svg = n.ownerSVGElement;
          const vb = svg.viewBox.baseVal.width || 720;
          min = Math.min(min, parseFloat(n.getAttribute('font-size')) * (svg.getBoundingClientRect().width / vb));
        }
        return { overflow: de.scrollWidth - de.clientWidth, stray, min: Number.isFinite(min) ? min : null };
      });
      if (m.overflow > 0) overflowed++;
      if (m.stray.length) escaped++;
      if (m.min !== null) worst = Math.min(worst, m.min);
    }
    await page.close();
  }
  ok(`no page-level horizontal overflow across ${WIDTHS.length} widths x ${ROUTES.length} routes`, overflowed === 0, `${overflowed} cases`);
  ok('nothing escapes the viewport outside the wheel scroller', escaped === 0, `${escaped} cases`);
  ok('no label anywhere renders below 12px', worst >= 11.99, `smallest ${worst.toFixed(2)}px`);
}

/* ------------------------------------------- 7. authored + empty states --- */

heading('7. Authored leaf and first-run empty states');
{
  const page = await newPage({ viewport: { width: 460, height: 1000 } });
  await page.goto(`${base}/#/angry/furious`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const leaf = await page.evaluate(() => ({
    crumb: document.querySelector('.leaf__crumb').textContent,
    title: document.querySelector('.leaf__title').textContent,
    coords: document.querySelector('.leaf__coords').textContent,
    definition: document.querySelector('.leaf__definition')?.textContent,
    note: document.querySelector('.leaf__labeling-note')?.textContent,
    nearby: !!document.querySelector('.leaf__section--nearby'),
    helps: !!document.querySelector('.leaf__section--helps'),
    keepEnabled: !document.querySelector('.leaf__keep').disabled,
  }));
  ok('authored leaf keeps its chrome, breadcrumb and H2', leaf.crumb === 'ANGRY / FURIOUS' && leaf.title === 'Furious');
  ok('authored definition is rendered', leaf.definition?.startsWith('Very high-intensity anger'));
  ok('authored coordinates are rendered', leaf.coords === 'unpleasant · blazing', JSON.stringify(leaf.coords));
  ok(
    'polished labeling note, NEARBY, and WHAT HELPS are rendered',
    leaf.note === 'If this word fits, pause with it for a moment. Naming what you feel can make the emotion easier to understand and work with.' && leaf.nearby && leaf.helps
  );
  ok('+ KEEP THIS WORD stays enabled', leaf.keepEnabled);

  await page.click('.leaf__keep');
  await page.waitForTimeout(200);
  const stored = await page.evaluate(() => ({
    entry: JSON.parse(localStorage.getItem('atlas.lexicon'))[0],
    landings: JSON.parse(localStorage.getItem('atlas.landings') || '[]'),
  }));
  ok('keeping writes the lexicon entry and the landing', stored.entry.word === 'furious' && stored.landings.some((l) => l.word === 'furious'));
  ok('and stores the authored definition', stored.entry.definition?.startsWith('Very high-intensity anger'));

  await page.goto(`${base}/#/lexicon`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const row = await page.evaluate(() => {
    const r = [...document.querySelectorAll('.lexicon__row')].find((n) => n.textContent.includes('furious'));
    return { queued: r.querySelector('.lexicon__queued')?.textContent, def: r.querySelector('.lexicon__definition')?.textContent };
  });
  ok('its lexicon row carries the authored definition', !row.queued && row.def?.startsWith('Very high-intensity anger'));

  await page.evaluate(() => { localStorage.setItem('atlas.landings', '[]'); localStorage.setItem('atlas.lexicon', '[]'); });
  await page.goto(`${base}/#/constellation`, { waitUntil: 'networkidle' });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const empty = await page.evaluate(() => ({
    caption: document.querySelector('.constellation__caption').textContent,
    circles: document.querySelectorAll('.constellation__svg circle').length,
    spokes: document.querySelectorAll('.constellation__svg line').length,
  }));
  ok('constellation first run keeps circle and spokes', empty.circles === 1 && empty.spokes === 6, JSON.stringify(empty));
  ok('with its first-run caption', empty.caption.startsWith('Keep a word to place it here.'));

  await page.goto(`${base}/#/lexicon`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  ok('emptied lexicon shows its own line and does not re-seed',
    (await page.locator('.lexicon__empty').textContent()) === 'No kept words yet. Keep one from any emotion page, or add your own below.');

  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const seeds = await page.evaluate(() => [...document.querySelectorAll('.lexicon__word')].map((n) => n.textContent));
  ok('first run seeds the three adopted words', JSON.stringify(seeds) === '["saudade","fernweh","amae"]', JSON.stringify(seeds));
  await page.close();
}

/* -------------------------------------------------------------- teardown --- */

if (errors.length) {
  console.log('\nCONSOLE ERRORS');
  [...new Set(errors)].forEach((e) => console.log(`  ${e}`));
  failures += errors.length;
} else {
  console.log('\nNo console errors.');
}

console.log(`\n${failures === 0 ? 'All UI checks passed.' : `${failures} check(s) FAILED.`}\n`);
await browser.close();
server.close();
process.exit(failures === 0 ? 0 : 1);

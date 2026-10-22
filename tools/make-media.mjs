// Screenshots, README banner and social preview image into docs/media/.
// Needs the site on a local server and an installed Chrome:
//   python3 -m http.server 8765        (in the repository root)
//   cd tools && node make-media.mjs
// Environment: BASE (default http://localhost:8765), CHROME (path to the Chrome binary).

import puppeteer from 'puppeteer-core';
import fs from 'node:fs/promises';

const BASE = process.env.BASE || 'http://localhost:8765';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = new URL('../docs/media/', import.meta.url);
await fs.mkdir(OUT, { recursive: true });

// one characteristic event per era; wait long enough for its animations to finish
const ONLY_BANNER = process.argv.includes('--banner');
const ERA_SHOTS = ONLY_BANNER ? [] : [
  ['era-1-kronika', '1241', 7000],
  ['era-2-torok-kor', '1541', 7000],
  ['era-3-reformkor', '1848', 7000],
  ['era-4-vilaghaboruk', '1920', 9000],
  ['era-5-kadar-kor', '1956', 7000],
  ['era-6-koztarsasag', '2004', 7000],
];

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars'] });
const page = await browser.newPage();
const file = (name) => new URL(name, OUT).pathname;

await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 });
for (const [name, hash, wait] of ERA_SHOTS) {
  await page.goto(`${BASE}/?intro=0#${hash}`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, wait));
  await page.screenshot({ path: file(`${name}.jpg`), type: 'jpeg', quality: 84 });
  console.log('✓', name);
}

if (!ONLY_BANNER) {
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(`${BASE}/?intro=0#1541`, { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 7000));
await page.screenshot({ path: file('mobile.jpg'), type: 'jpeg', quality: 84 });
console.log('✓ mobile');
}

for (const [type, w, h, dpr, name] of [['banner', 1280, 400, 2, 'banner.jpg'], ['social', 1280, 640, 1, 'social-preview.jpg']]) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: dpr });
  await page.goto(`${BASE}/tools/media/banner.html?type=${type}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('body[data-ready]');
  await page.screenshot({ path: file(name), type: 'jpeg', quality: 88, clip: { x: 0, y: 0, width: w, height: h } });
  console.log('✓', name);
}

await browser.close();

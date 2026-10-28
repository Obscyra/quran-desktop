// Measures the text size of every Mushaf page in the app itself and writes src/lib/fit-data.json,
// which ships with the app so a page is sized without measuring each word (see PageSheet.svelte).
// Run with the dev server up (npx vite dev --port 1420) and `npm run bundle` done, using the playwright package:
//   node scripts/learn-fit.mjs
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const url = process.env.APP_URL ?? 'http://127.0.0.1:1420';
const out = new URL('../src/lib/fit-data.json', import.meta.url);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1200, height: 800 } });
await ctx.addInitScript(() => {
  localStorage.setItem('quran.settings.v2', JSON.stringify({ mode: 'reading', flow: 'scroll', readingStyle: 'arabic', tips: false, script: 'mushaf' }));
  localStorage.setItem('quran.welcomed', '1');
});
const p = await ctx.newPage();
const data = {};
for (let ch = 1; ch <= 114; ch++) {
  await p.goto(`${url}/#/${ch}`);
  await p.reload();
  try {
    await p.waitForSelector('.pg .sheet .line', { timeout: 30000 });
  } catch {
    process.stdout.write(`${ch}:FAILED `);
    continue;
  }
  const total = await p.evaluate(() => document.querySelectorAll('.pg').length);
  // walk down the surah until every page has been built and sized
  for (let step = 0; step < total * 3; step++) {
    await p.evaluate(() => document.querySelector('.scroll').scrollBy(0, 1000));
    await p.waitForTimeout(150);
  }
  let tries = 0;
  for (; tries < 40; tries++) {
    const left = await p.evaluate(() => [...document.querySelectorAll('.pg')].filter((g) => !g.querySelector('.lines')?.style.getPropertyValue('--fs')).length);
    if (!left) break;
    await p.evaluate(() => document.querySelector('.scroll').scrollBy(0, -500));
    await p.waitForTimeout(250);
  }
  const got = await p.evaluate(() => window.__fitLearned);
  Object.assign(data, got);
  process.stdout.write(`${ch}:${Object.keys(got).length}/${total} `);
  writeFileSync(out, JSON.stringify(data));
}
writeFileSync(out, JSON.stringify(data));
console.log(`\n${Object.keys(data).length} pages`);
await b.close();

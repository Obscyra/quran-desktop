import { chromium } from 'playwright-core';
import { spawn, execSync } from 'node:child_process';
const exe = process.argv[2] || 'C:\\Users\\magnum\\quran-build\\src-tauri\\target\\release\\Quran.exe';
const tag = process.argv[3] || 'win';
const env = { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=9333', WEBVIEW2_USER_DATA_FOLDER: 'C:\\Users\\magnum\\quran-pw\\udata' };
const child = spawn(exe, [], { env, stdio: 'ignore', detached: false });
let b;
for (let i = 0; i < 40 && !b; i++) { try { b = await chromium.connectOverCDP('http://127.0.0.1:9333'); } catch { await new Promise((r) => setTimeout(r, 500)); } }
if (!b) { console.log('no connect'); child.kill(); process.exit(1); }
const ctx = b.contexts()[0];
let p = ctx.pages()[0];
for (let i = 0; i < 20 && !p; i++) { await new Promise((r) => setTimeout(r, 500)); p = ctx.pages()[0]; }
const viol = [];
await p.exposeFunction('__viol', (s) => viol.push(s));
await p.evaluate(() => {
  localStorage.setItem('quran.settings.v2', JSON.stringify({ mode: 'reading', flow: 'scroll', readingStyle: 'arabic', tips: false }));
  localStorage.setItem('quran.welcomed', '1');
});
await p.evaluate(() => { location.hash = '#/2'; location.reload(); });
await p.waitForSelector('.pg .sheet .line', { timeout: 60000 });
await p.evaluate(() => document.addEventListener('securitypolicyviolation', (e) => window.__viol?.(e.violatedDirective + ' ' + e.blockedURI)));
await p.waitForTimeout(6000);
await p.evaluate(() => {
  window.__lt = [];
  new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(Math.round(e.duration)))).observe({ entryTypes: ['longtask'] });
});
await p.mouse.move(600, 400);
const fast = process.argv[4] === 'fast';
for (let i = 0; i < (fast ? 60 : 40); i++) { await p.mouse.wheel(0, fast ? 700 : 300); await p.waitForTimeout(fast ? 40 : 100); }
await p.waitForTimeout(2000);
const r = await p.evaluate(() => ({ lt: window.__lt, heap: Math.round(performance.memory.usedJSHeapSize / 1e6), built: document.querySelectorAll('.pg .sheet').length, w: innerWidth, h: innerHeight }));
let mem = '';
try { mem = execSync('powershell -NoProfile -Command "[math]::Round((Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like \'*quran-pw*udata*\' -or $_.Name -eq \'Quran.exe\' } | Measure-Object WorkingSetSize -Sum).Sum/1MB)"').toString().trim(); } catch {}
console.log(tag, 'win', r.w + 'x' + r.h, 'longtasks', r.lt.length, 'max', Math.max(0, ...r.lt), 'sum', r.lt.reduce((a, c) => a + c, 0), 'built', r.built, 'jsHeapMB', r.heap, 'thisAppAllProcsMB', mem, 'csp', JSON.stringify(viol));
await p.screenshot({ path: `C:\\Users\\magnum\\quran-pw\\${tag}.png` });
child.kill();
try { execSync('taskkill /F /IM Quran.exe'); } catch {}
await b.close().catch(() => {});
process.exit(0);

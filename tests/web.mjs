import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve('web-dist'), errors = [], report = {};
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' };
    response.setHeader('Content-Type', mime[path.extname(file)] || 'text/plain'); response.end(await readFile(file));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = process.env.WAVE_TEST_URL || `http://127.0.0.1:${server.address().port}/`;
let browser, page;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--enable-usermedia-screen-capturing', '--allow-http-screen-capture', '--auto-select-tab-capture-source-by-title=Wave History Test Audio'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 940 } });
  page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '?test=1'); await page.waitForFunction(() => window.waveTest);
  assert.equal(await page.locator('.browser-help').isVisible(), true);
  assert.equal(await page.locator('#source-title').textContent(), 'Звук вкладки или экрана');
  await page.locator('#demo').click(); await page.waitForTimeout(400);
  await page.keyboard.press('h'); await page.waitForTimeout(150);
  const preview = await page.locator('canvas').screenshot({ path: 'artifacts/browser-preview.png' });
  if (process.env.WAVE_UPDATE_PREVIEW === '1') await writeFile('web/preview.png', preview);
  await page.keyboard.press('h'); await page.waitForTimeout(150);
  await page.screenshot({ path: 'artifacts/browser-desktop.png' });
  await page.locator('#demo').click();
  const audio = await context.newPage(); await audio.goto(base + 'example.html'); await audio.locator('#volume').fill('5'); await audio.locator('#sound').click();
  await audio.evaluate(() => { document.title = 'Wave History Test Audio'; });
  assert.equal(await audio.locator('#sound').getAttribute('aria-pressed'), 'true');
  await page.bringToFront(); await page.locator('#capture').click();
  await page.waitForFunction(() => !window.waveTest.snapshot().busy, null, { timeout: 20000 });
  assert.equal(await page.evaluate(() => window.waveTest.snapshot().mode), 'live', await page.locator('#message').textContent());
  await page.bringToFront();
  await page.waitForFunction(() => window.waveTest.snapshot().metrics.rms > .003 && window.waveTest.snapshot().count > 20, null, { timeout: 15000 });
  report.capture = await page.evaluate(() => window.waveTest.snapshot());
  assert.ok(report.capture.heights[0] > .2); assert.equal(report.capture.glError, 0);
  for (const interval of report.capture.metrics.intervals.slice(2)) assert.ok(Math.abs(interval - 50) < .1);
  await page.screenshot({ path: 'artifacts/browser-live-capture.png' });
  await audio.locator('#sound').click(); await page.bringToFront();
  await page.locator('#fullscreen').click(); await page.waitForFunction(() => document.fullscreenElement);
  assert.equal(await page.locator('aside').isVisible(), false);
  await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.fullscreenElement);
  await page.locator('#capture').click();
  assert.equal(await page.evaluate(() => window.waveTest.snapshot().audioState), 'closed');
  await audio.close();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#demo').click(); await page.waitForTimeout(350);
  report.mobile = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth, height: document.querySelector('canvas').clientHeight }));
  assert.ok(report.mobile.content <= report.mobile.width); assert.ok(report.mobile.height >= 400);
  await page.screenshot({ path: 'artifacts/browser-mobile.png', fullPage: true });
  await page.locator('#demo').click();
  await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 8;
    window.noAudioStream = canvas.captureStream(1);
    navigator.mediaDevices.getDisplayMedia = async () => window.noAudioStream;
  });
  await page.locator('#capture').click(); await page.waitForFunction(() => !window.waveTest.snapshot().busy);
  assert.match(await page.locator('#message').textContent(), /без звука/);
  assert.equal(await page.evaluate(() => window.noAudioStream.getTracks().every(t => t.readyState === 'ended')), true);
  await page.evaluate(() => { navigator.mediaDevices.getDisplayMedia = async () => { throw new DOMException('Cancelled', 'NotAllowedError'); }; });
  await page.locator('#capture').click(); await page.waitForFunction(() => !window.waveTest.snapshot().busy);
  assert.equal(await page.evaluate(() => window.waveTest.snapshot().mode), 'idle');
  assert.match(await page.locator('#message').textContent(), /Разрешение/);
  report.errorRecovery = true;
  assert.deepEqual(errors, []); report.result = 'passed';
} catch (error) {
  report.result = 'failed'; report.error = error.stack; process.exitCode = 1;
  if (page) { report.failureState = await page.evaluate(() => window.waveTest?.snapshot()).catch(() => null); await page.screenshot({ path: 'artifacts/browser-failure.png' }).catch(() => {}); }
}
finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); await writeFile('artifacts/browser-report.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify({ result: report.result, error: report.error, rms: report.capture?.metrics.rms, mobile: report.mobile, errors }, null, 2)); }

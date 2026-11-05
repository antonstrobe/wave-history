import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, copyFile, writeFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const artifacts = path.resolve('artifacts');
const isolated = await mkdtemp(path.join(artifacts, 'portable-smoke-'));
const exe = path.join(isolated, 'Wave History Portable.exe');
await copyFile('release/Wave History Portable.exe', exe);
const portServer = createServer();
await new Promise(resolve => portServer.listen(0, '127.0.0.1', resolve));
const port = portServer.address().port;
await new Promise(resolve => portServer.close(resolve));
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; delete env.PORTABLE_EXECUTABLE_DIR;
const report = {}, errors = []; let child, browser, page, exit;
try {
  child = spawn(exe, [`--remote-debugging-address=127.0.0.1`, `--remote-debugging-port=${port}`, '--test'], { cwd: isolated, env, windowsHide: true, stdio: 'ignore' });
  exit = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
  child.on('error', e => errors.push(e.message));
  const deadline = Date.now() + 60000;
  while (!browser && Date.now() < deadline && child.exitCode === null) {
    try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 1200 }); }
    catch { await delay(350); }
  }
  assert.ok(browser, 'The portable app did not expose a working window');
  const context = browser.contexts()[0];
  page = context.pages()[0] || await context.waitForEvent('page');
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.waitForFunction(() => window.waveTest, null, { timeout: 20000 });
  const snapshot = () => page.evaluate(() => window.waveTest.snapshot());
  assert.equal((await snapshot()).mode, 'idle');
  await page.locator('#demo').click(); await page.waitForTimeout(500);
  report.demo = await snapshot(); assert.ok(report.demo.heights[0] > 1);
  assert.equal(report.demo.view.propagation, 'radial'); assert.equal(report.demo.view.edgeFade, 0); assert.ok(report.demo.view.sourceHeight > .1);
  assert.equal(await page.locator('#visual-preset option:not([disabled])').count(), 7);
  assert.equal(report.demo.view.variationAmount, 6);
  await page.locator('#visual-preset').focus(); await page.keyboard.press('Space'); await page.keyboard.press('Escape');
  assert.equal((await snapshot()).paused, false, 'Using the preset dropdown must not toggle pause');
  await page.locator('#random-colors').check(); await page.locator('#mountains').check(); await page.locator('#flight').check();
  await page.waitForTimeout(600);
  report.effects = (await snapshot()).view;
  assert.ok(report.effects.colors && report.effects.mountains && report.effects.flightTime > .2);
  await page.locator('#fullscreen').click();
  await page.waitForFunction(() => document.fullscreenElement && document.body.classList.contains('immersive'));
  await page.screenshot({ path: 'artifacts/portable-fullscreen.png' });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.fullscreenElement);
  await page.locator('#flight').uncheck();
  await page.locator('#capture').click();
  await page.waitForFunction(() => !window.waveTest.snapshot().busy);
  assert.equal((await snapshot()).mode, 'live', await page.locator('#message').textContent());
  await page.waitForFunction(() => window.waveTest.snapshot().metrics.packets >= 20);
  report.live = await snapshot();
  assert.ok(report.live.tracks.some(t => t.kind === 'audio' && t.state === 'live'));
  for (const dt of report.live.metrics.intervals.slice(2)) assert.ok(Math.abs(dt - 50) < .05);
  await page.locator('#capture').click(); assert.equal((await snapshot()).audioState, 'closed');
  assert.equal((await snapshot()).glError, 0); assert.deepEqual(errors, []);
  assert.ok((await readdir(isolated)).includes('Wave History Data'), 'Profile must live beside the portable file');
  // Verify persistence through the regular interface, in this test's isolated portable profile.
  await page.goto('wave://app/index.html');
  await page.locator('#visual-preset').selectOption('stereo'); await page.reload();
  assert.equal(await page.locator('#visual-preset').inputValue(), 'stereo');
  await page.locator('#variation-amount').fill('5'); await page.reload();
  assert.equal(await page.locator('#visual-preset').inputValue(), 'custom');
  assert.equal(await page.locator('#variation-amount').inputValue(), '5');
  assert.equal(await page.locator('#mirror').isChecked(), true);
  report.preferencesRestored = true;
  await page.close(); page = null;
  report.exit = await Promise.race([exit, delay(15000).then(() => null)]);
  assert.equal(report.exit?.code, 0, 'Portable app must exit and clean up its extracted runtime');
  report.result = 'passed';
} catch (error) {
  report.result = 'failed'; report.error = error.stack; process.exitCode = 1;
  if (page) {
    await page.screenshot({ path: 'artifacts/portable-failure.png', timeout: 3000 }).catch(() => {});
    report.failureState = await page.evaluate(() => ({ snapshot: window.waveTest?.snapshot(), focus: document.activeElement?.id, fps: document.querySelector('#fps')?.textContent })).catch(() => null);
  }
}
finally {
  await page?.close().catch(() => {}); await browser?.close().catch(() => {});
  if (child && child.exitCode === null) {
    const closed = await Promise.race([exit, delay(3000).then(() => null)]);
    if (!closed) execFileSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' });
  }
  report.errors = errors;
  await writeFile('artifacts/portable-report.json', JSON.stringify(report, null, 2));
  // Only this test-created directory may be recursively removed.
  const safe = path.resolve(isolated);
  if (path.dirname(safe) !== artifacts || !path.basename(safe).startsWith('portable-smoke-')) throw new Error('Unsafe test cleanup path');
  await rm(safe, { recursive: true, force: true, maxRetries: 4, retryDelay: 300 });
  console.log(JSON.stringify({ result: report.result, error: report.error, exit: report.exit, errors }, null, 2));
}

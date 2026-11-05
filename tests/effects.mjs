import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BANDS, frequencyAt, spectrumIndex } from '../src/dsp.js';
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
let app; const report = {}, errors = [];
try {
  app = await electron.launch({ executablePath: path.resolve('node_modules/electron/dist/electron.exe'), args: ['.', '--test'], env });
  const page = await app.firstWindow();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.waitForFunction(() => window.waveTest);
  const snap = () => page.evaluate(() => window.waveTest.snapshot());
  // Separate channels enter the real worklet through a stereo merger, with no audible output.
  await page.evaluate(async () => {
    const ctx = window.stereoContext = new AudioContext();
    await ctx.audioWorklet.addModule('./audio-worklet.js');
    const merger = ctx.createChannelMerger(2);
    const l = ctx.createOscillator(), r = ctx.createOscillator();
    l.frequency.value = 220; r.frequency.value = 2000;
    l.connect(merger, 0, 0); r.connect(merger, 0, 1);
    const node = new AudioWorkletNode(ctx, 'history-processor', { channelCount: 2, channelCountMode: 'explicit' });
    const mute = ctx.createGain(); mute.gain.value = 0; merger.connect(node).connect(mute).connect(ctx.destination);
    window.stereoResults = [];
    node.port.onmessage = ({ data }) => window.stereoResults.push({ l: Array.from(data.leftBands), r: Array.from(data.rightBands) });
    l.start(); r.start(); await ctx.resume();
  });
  await page.waitForFunction(() => window.stereoResults.length > 10);
  const stereo = await page.evaluate(() => window.stereoResults.at(-1));
  await page.evaluate(() => window.stereoContext.close());
  const lPeak = stereo.l.indexOf(Math.max(...stereo.l)), rPeak = stereo.r.indexOf(Math.max(...stereo.r));
  report.channelFrequencies = { left: frequencyAt(lPeak), right: frequencyAt(rPeak) };
  assert.ok(Math.abs(report.channelFrequencies.left - 220) < 30);
  assert.ok(Math.abs(report.channelFrequencies.right - 2000) < 100);
  assert.ok(stereo.r[lPeak] < .2 && stereo.l[rPeak] < .2, 'Channel leakage');
  assert.equal(spectrumIndex(BANDS - 1, true), BANDS);
  assert.equal(spectrumIndex(BANDS, true), 2 * BANDS);
  assert.equal(spectrumIndex(0, true), BANDS * 2 - 1);
  assert.equal(spectrumIndex(2 * BANDS - 1, true), BANDS * 3 - 1);
  await page.locator('#demo').click(); await page.waitForTimeout(350);
  // The zero-radius source is still forming; trace the first complete emitted ring.
  const stamp = (await snap()).latestStamp - 1;
  const initialWave = await page.evaluate(stamp => window.waveTest.trace(stamp), stamp);
  await page.waitForTimeout(650);
  const travelingWave = await page.evaluate(stamp => window.waveTest.trace(stamp), stamp);
  assert.deepEqual(travelingWave.heights, initialWave.heights, 'Captured heights must not react to subsequent sound or position');
  assert.ok(travelingWave.radialOffsets.every((offset, i) => Math.abs(offset - initialWave.radialOffsets[i]) < .00001), 'The shape of each ring must stay attached to its audio frame');
  assert.ok(travelingWave.radius > initialWave.radius);
  assert.ok(travelingWave.fade < initialWave.fade);
  report.wavePreserved = true;
  await page.locator('#pause').click();
  report.shaping = (await snap()).view;
  assert.equal(report.shaping.propagation, 'radial'); assert.equal(report.shaping.edgeFade, 0); assert.ok(report.shaping.sourceHeight > .1);
  assert.equal(await page.locator('#slices').textContent(), '✓ Волны');
  assert.equal(await page.locator('.axis').isVisible(), false);
  await page.locator('#taper').uncheck(); assert.equal((await snap()).view.edgeFade, 1);
  assert.deepEqual((await snap()).view.edgeHeights, report.shaping.edgeHeights);
  await page.locator('#taper').check(); assert.equal((await snap()).view.edgeFade, 0);
  report.presets = [];
  for (const id of ['original', 'transparent', 'stereo', 'hill', 'mountains', 'center', 'radial']) {
    const count = (await snap()).count;
    await page.locator('#visual-preset').selectOption(id);
    const state = await snap(); assert.equal(state.preset, id); assert.equal(state.count, count);
    if (id === 'hill') assert.deepEqual(state.view.edgeHeights, [0, 0]);
    if (id === 'original') assert.equal(state.view.propagation, 'ribbon');
    if (id === 'transparent') assert.equal(state.view.surfaceVisible, false);
    report.presets.push(id);
  }
  await page.locator('aside').evaluate(el => { el.scrollTop = 0; });
  await page.screenshot({ path: 'artifacts/radial-waves.png' });
  await page.locator('#variation').uncheck(); assert.equal(await page.locator('#variation-amount').isDisabled(), true);
  await page.locator('#variation').check(); await page.locator('#variation-amount').fill('3');
  assert.equal((await snap()).view.variationAmount, 3);
  await page.locator('#transparency').fill('0');
  await page.waitForTimeout(200);
  const solid = await page.locator('canvas').screenshot({ path: 'artifacts/surface-solid.png' });
  await page.locator('#transparency').fill('50'); await page.waitForTimeout(200);
  const half = await page.locator('canvas').screenshot({ path: 'artifacts/surface-half.png' });
  await page.locator('#transparency').fill('100'); await page.waitForTimeout(200);
  const clear = await page.locator('canvas').screenshot({ path: 'artifacts/surface-clear.png' });
  assert.ok(!solid.equals(half) && !half.equals(clear), 'Transparency must affect pixels');
  assert.equal((await snap()).view.surfaceVisible, false);
  await page.locator('#transparency').fill('35');
  await page.locator('#black-surface').uncheck(); assert.equal((await snap()).view.surfaceVisible, false);
  assert.equal(await page.locator('#transparency').isDisabled(), true);
  await page.locator('#black-surface').check(); assert.equal((await snap()).view.surfaceVisible, true);
  await page.locator('#mirror').uncheck(); assert.equal((await snap()).view.columns, BANDS);
  await page.locator('#mirror').check(); assert.equal((await snap()).view.columns, 2 * BANDS);
  // Keep a full demo history while restarting time effects.
  await page.locator('#demo').click(); await page.locator('#demo').click();
  await page.locator('#random-colors').check();
  const hue = (await snap()).view.hue;
  await page.waitForTimeout(1000); assert.notEqual((await snap()).view.hue, hue);
  await page.locator('#mountains').check(); await page.locator('#flight').check();
  await page.waitForTimeout(1400);
  report.flight = await snap();
  assert.ok(report.flight.view.flightTime > .5 && report.flight.view.mountainSurfaceVisible);
  await page.screenshot({ path: 'artifacts/mountains-controls.png' });
  await page.locator('#clean-fullscreen').click();
  await page.waitForFunction(() => document.fullscreenElement && document.body.classList.contains('immersive'));
  await page.waitForFunction(() => document.body.classList.contains('hide-cursor'), null, { timeout: 7000 });
  report.fullscreen = await page.evaluate(() => ({
    overlays: Array.from(document.querySelectorAll('.viewport>:not(#scene),aside,.topbar')).filter(el => el.getClientRects().length).length,
    canvasTitle: document.querySelector('canvas').title,
    canvas: { width: document.querySelector('canvas').clientWidth, height: document.querySelector('canvas').clientHeight },
    viewport: { width: innerWidth, height: innerHeight }, cursorHidden: document.body.classList.contains('hide-cursor')
  }));
  assert.equal(report.fullscreen.overlays, 0); assert.equal(report.fullscreen.canvasTitle, '');
  assert.deepEqual(report.fullscreen.canvas, report.fullscreen.viewport); assert.equal(report.fullscreen.cursorHidden, true);
  await page.screenshot({ path: 'artifacts/mountains-fullscreen.png' });
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  assert.equal((await snap()).immersive, false); assert.equal(await page.locator('aside').isVisible(), true);
  await page.locator('#flight').uncheck(); assert.equal((await snap()).view.flight, false);
  await page.locator('#mountains').uncheck(); await page.locator('#random-colors').uncheck();
  assert.equal((await snap()).view.colors, false);
  await page.locator('#demo').click(); await page.locator('#clear').click();
  assert.equal((await snap()).heights[0], 0);
  await page.locator('#mountains').check(); assert.equal((await snap()).heights[0], 0, 'Mountains must not invent data during silence');
  assert.equal((await snap()).glError, 0); assert.deepEqual(errors, []);
  report.result = 'passed';
} catch (error) { report.result = 'failed'; report.error = error.stack; process.exitCode = 1; }
finally { report.errors = errors; await writeFile('artifacts/effects-report.json', JSON.stringify(report, null, 2)); await app?.close(); console.log(JSON.stringify(report, null, 2)); }

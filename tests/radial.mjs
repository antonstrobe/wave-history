import { _electron as electron } from 'playwright';
import { build } from 'esbuild';
import { writeFile, rm } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';

const html = path.resolve('dist/radial-regression.html'), js = path.resolve('dist/radial-regression.js');
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
let app; const report = { cases: [] }, errors = [];
try {
  await build({ stdin: { contents: "export { Terrain } from './src/terrain.js'; export { HistoryBuffer, BANDS, HISTORY_BANDS } from './src/dsp.js';", resolveDir: process.cwd() }, outfile: js, bundle: true, format: 'esm' });
  await writeFile(html, '<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#060808}#scene{height:100vh}p{position:absolute;bottom:16px;left:25px;color:#9ba99f;font:14px Segoe UI;pointer-events:none}</style><div id="scene"></div><p>Тестовый сигнал: сильный бас и звуковые импульсы</p>');
  app = await electron.launch({ executablePath: path.resolve('node_modules/electron/dist/electron.exe'), args: ['.', '--test'], env });
  const page = await app.firstWindow(); page.on('pageerror', e => errors.push(e.message));
  await page.goto('wave://app/radial-regression.html');
  await page.evaluate(async () => {
    const { Terrain, HistoryBuffer, BANDS, HISTORY_BANDS } = await import('./radial-regression.js');
    const terrain = new Terrain(document.querySelector('#scene')), history = new HistoryBuffer(240, HISTORY_BANDS);
    terrain.variationSeed = 1.37;
    for (let r = 0; r < history.rows; r++) {
      const t = r * .05, kick = .15 + .85 * Math.exp(-(t % .5) / .09), row = new Float32Array(HISTORY_BANDS);
      for (let c = 0; c < 3; c++) for (let b = 0; b < BANDS; b++) row[c * BANDS + b] = Math.min(1, kick * Math.exp(-((b / 62) ** 2)) + .37 * Math.exp(-(((b - 110 - 18 * Math.sin(t + c * .2)) / 22) ** 2)));
      history.push(row, 1 + kick * .65);
    }
    const loud = new Float32Array(HISTORY_BANDS);
    for (let c = 0; c < 3; c++) for (let b = 0; b < BANDS; b++) loud[c * BANDS + b] = b < 60 ? .98 : .25 + .18 * Math.sin(b * .05 + c * .2) ** 2;
    history.push(loud, 1.65);
    terrain.allocate(history.rows); terrain.setMode('slices'); terrain.update(history, 1.5);
    terrain.camera.position.set(0, 19, 33); terrain.controls.target.set(0, 1.5, -4); terrain.controls.update();
    window.radialCheck = { terrain, history };
    const render = () => { terrain.render(); requestAnimationFrame(render); }; render();
  });
  for (const gain of [1.5, 3]) {
    const sample = await page.evaluate(gain => {
      const { terrain: t, history: h } = window.radialCheck; t.update(h, gain); t.render();
      const source = t.columns * 3;
      let minRadius = Infinity, maxSlope = 0;
      for (let b = 0; b < t.columns; b++) {
        const i = source + b * 3;
        const radius = Math.hypot(t.positions[i], t.positions[i + 2]);
        minRadius = Math.min(minRadius, radius);
        maxSlope = Math.max(maxSlope, Math.abs(t.positions[i + 1] - t.sourceHeight) / radius);
      }
      return { gain, centerHeight: t.sourceHeight, sourceProfilePeak: t.sourceProfilePeak, minWidth: minRadius * 2, maxSlope, maxHeight: t.maxHeight, rows: t.meshRows, historyRows: h.rows, glError: t.renderer.getContext().getError() };
    }, gain);
    assert.ok(sample.centerHeight <= sample.sourceProfilePeak, 'The center must not amplify bass separately from the outgoing wave');
    assert.equal(sample.rows, sample.historyRows, 'All rings must belong to audio history, with no stationary cap');
    assert.ok(sample.maxSlope < 2, 'The center must join the traveling wave without a vertical wall');
    assert.ok(sample.maxHeight <= 3.8 * Math.sqrt(gain) * 1.03);
    assert.equal(sample.glError, 0); report.cases.push(sample);
    await page.screenshot({ path: `artifacts/radial-strong-bass-${gain}.png` });
  }
  await page.evaluate(() => { const { terrain, history } = window.radialCheck; history.clear(); terrain.update(history, 3); });
  assert.equal(await page.evaluate(() => window.radialCheck.terrain.maxHeight), 0);
  assert.deepEqual(errors, []); report.result = 'passed';
} catch (error) { report.result = 'failed'; report.error = error.stack; process.exitCode = 1; }
finally {
  await app?.close();
  // Remove only these two files created by this regression test; they must not enter the EXE.
  await rm(html, { force: true }); await rm(js, { force: true });
  await writeFile('artifacts/radial-report.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
}

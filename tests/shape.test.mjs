import test from 'node:test';
import assert from 'node:assert/strict';
import { historyFade, hillEnvelope, stereoVariation, RhythmTracker, radialShape } from '../src/shape.js';
import { HistoryBuffer } from '../src/dsp.js';
test('fresh waves are fully visible and older waves only lose opacity', () => {
  const rows = 241;
  assert.equal(historyFade(0, rows), 1); assert.equal(historyFade(rows - 1, rows), 0);
  for (let age = 1; age < rows; age++) assert.ok(historyFade(age, rows) < historyFade(age - 1, rows));
  // The previous positional envelope is retained only for the named historical preset.
  assert.equal(hillEnvelope(0, rows), 0); assert.equal(hillEnvelope(120, rows), 1); assert.equal(hillEnvelope(240, rows), 0);
});
test('rhythm reacts to a real level rise, settles on a steady tone and preserves captured accents', () => {
  const tracker = new RhythmTracker(), quiet = new Float32Array(192).fill(.3), loud = new Float32Array(192).fill(.8);
  let settled;
  for (let i = 0; i < 60; i++) settled = tracker.capture(quiet, .04);
  assert.ok(settled < 1.01);
  const hit = tracker.capture(loud, .25); assert.ok(hit > 1.5);
  const h = new HistoryBuffer(10, 1); h.push(Float32Array.of(.8), hit); const captured = h.accent(0);
  for (let i = 0; i < 5; i++) h.push(Float32Array.of(.3), tracker.capture(quiet, .04));
  assert.equal(h.accent(5), captured);
  assert.equal(tracker.capture(new Float32Array(192), 0), 1);
});
test('stereo variation is bounded and smooth, keeps silence, and can be completely disabled', () => {
  for (let t = 0; t < 1000; t++) for (const c of [0, 1]) {
    const v = stereoVariation(t, 50, c, 1.2, 4);
    assert.ok(v >= .96 && v <= 1.04);
    assert.ok(Math.abs(v - stereoVariation(t + 1, 50, c, 1.2, 4)) < .001);
    assert.equal(0 * v, 0); assert.equal(stereoVariation(t, 50, c, 1.2, 0), 1);
  }
  assert.notEqual(stereoVariation(10, 50, 0, 1.2, 4), stereoVariation(10, 50, 1, 1.2, 4));
});
test('variation stays attached to the same audio row across a history ring wrap', () => {
  const h = new HistoryBuffer(4, 1);
  for (let i = 0; i < 4; i++) h.push(Float32Array.of(i));
  const stamp = h.stamp(0), value = stereoVariation(stamp, 50, 1, 2, 4);
  h.push(Float32Array.of(4));
  assert.equal(h.stamp(1), stamp); assert.equal(stereoVariation(h.stamp(1), 50, 1, 2, 4), value);
});

test('circular waves close without a seam, preserve silence and vary smoothly between captures', () => {
  const levels = [[.8, .45, .2], [.7, .3, .25]], seed = 1.37;
  const first = radialShape(levels, 0, 10, seed, 6, 1.5, 1.4);
  const last = radialShape(levels, 2 * Math.PI, 10, seed, 6, 1.5, 1.4);
  assert.ok(Math.abs(first.height - last.height) < 1e-10);
  assert.ok(Math.abs(first.offset - last.offset) < 1e-10);
  assert.deepEqual(first, radialShape(levels, 0, 10, seed, 6, 1.5, 1.4));
  const next = radialShape(levels, 0, 11, seed, 6, 1.5, 1.4);
  assert.notDeepEqual(first, next);
  assert.ok(Math.abs(first.height - next.height) < .02);
  assert.ok(Math.abs(first.offset - next.offset) < .01);
  for (let angle = 0; angle < 2 * Math.PI; angle += .1) {
    const silent = radialShape([[0, 0, 0], [0, 0, 0]], angle, 100, seed, 8, 3, 1.65);
    assert.equal(silent.height, 0); assert.equal(Math.abs(silent.offset), 0);
  }
});

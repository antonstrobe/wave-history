import test from 'node:test';
import assert from 'node:assert/strict';
import { SpectrumAnalyzer, HopClock, HistoryBuffer, FFT_SIZE, BANDS, frequencyAt } from '../src/dsp.js';
test('FFT finds a calibrated sine and silence stays flat', () => {
  const fft = new SpectrumAnalyzer(48000);
  const frequency = 1000;
  const input = Float32Array.from({ length: FFT_SIZE }, (_, i) => .5 * Math.sin(2 * Math.PI * frequency * i / 48000));
  const power = fft.transform(input, 0);
  const peak = power.indexOf(Math.max(...power));
  assert.ok(Math.abs(peak * 48000 / FFT_SIZE - frequency) < 48000 / FFT_SIZE);
  const bands = fft.bandsFromPower(power);
  const peakHz = frequencyAt(bands.indexOf(Math.max(...bands)));
  assert.ok(Math.abs(peakHz - frequency) < 65);
  assert.ok(Math.max(...bands) > .85);
  assert.equal(Math.max(...fft.bandsFromPower(fft.transform(new Float32Array(FFT_SIZE), 0))), 0);
});
test('50 ms cadence does not drift over one minute at common sample rates', () => {
  for (const rate of [44100, 48000, 96000]) {
    const clock = new HopClock(rate, 50); let count = 0, last = 0;
    for (let i = 0; i < rate * 60; i++) if (clock.tick()) { assert.equal(clock.position - last, rate * .05); last = clock.position; count++; }
    assert.equal(count, 1200);
  }
});
test('history keeps newest data first and overwrites only the oldest', () => {
  const buffer = new HistoryBuffer(3, 2);
  for (let i = 1; i <= 5; i++) buffer.push(Float32Array.of(i, i * 2));
  assert.deepEqual([buffer.at(0, 0), buffer.at(1, 0), buffer.at(2, 0)], [5, 4, 3]);
  buffer.clear(); assert.equal(buffer.count, 0); assert.equal(buffer.at(0, 1), 0);
});
test('stereo power preserves a signal with opposite channel phases', () => {
  const fft = new SpectrumAnalyzer(48000);
  const left = Float32Array.from({ length: FFT_SIZE }, (_, i) => .2 * Math.sin(i * .14));
  const leftPower = Float64Array.from(fft.transform(left, 0));
  const rightPower = fft.transform(left.map(x => -x), 0);
  const combined = leftPower.map((p, i) => (p + rightPower[i]) / 2);
  assert.ok(Math.max(...fft.bandsFromPower(combined)) > .75);
  assert.equal(fft.bandsFromPower(combined).length, BANDS);
});

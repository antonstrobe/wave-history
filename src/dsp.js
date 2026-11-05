export const FFT_SIZE = 4096;
export const BANDS = 192;
export const HISTORY_BANDS = BANDS * 3;
// Row layout: the power mix, then independent left and right channel spectra.
export function packSpectrum(mix, left = mix, right = left, output = new Float32Array(HISTORY_BANDS)) {
  output.set(mix, 0); output.set(left, BANDS); output.set(right, BANDS * 2); return output;
}
export function spectrumIndex(column, mirrored) {
  if (!mirrored) return column;
  return column < BANDS ? BANDS + (BANDS - 1 - column) : BANDS * 2 + (column - BANDS);
}
export const MIN_HZ = 35;
export const MAX_HZ = 16000;
export const frequencyAt = (i, count = BANDS) => MIN_HZ * (MAX_HZ / MIN_HZ) ** (i / (count - 1));

// Reusable radix-2 FFT buffers, Hann window, calibrated single-sided amplitude.
export class SpectrumAnalyzer {
  constructor(sampleRate, size = FFT_SIZE) {
    this.size = size;
    this.sampleRate = sampleRate;
    this.real = new Float64Array(size);
    this.imag = new Float64Array(size);
    this.window = Float64Array.from({ length: size }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (size - 1)));
    this.windowSum = this.window.reduce((sum, v) => sum + v, 0);
    this.reverse = new Uint32Array(size);
    const bits = Math.log2(size);
    for (let i = 0; i < size; i++) {
      let v = i, rev = 0;
      for (let j = 0; j < bits; j++) { rev = (rev << 1) | (v & 1); v >>= 1; }
      this.reverse[i] = rev;
    }
    this.power = new Float64Array(size / 2);
  }
  transform(ring, nextWrite) {
    const { size, real, imag, reverse, window } = this;
    for (let i = 0; i < size; i++) { real[reverse[i]] = ring[(nextWrite + i) % size] * window[i]; imag[reverse[i]] = 0; }
    for (let len = 2; len <= size; len *= 2) {
      const a = -2 * Math.PI / len;
      const cr = Math.cos(a), ci = Math.sin(a);
      for (let offset = 0; offset < size; offset += len) {
        let wr = 1, wi = 0;
        for (let j = 0; j < len / 2; j++) {
          const p = offset + j, q = p + len / 2;
          const tr = wr * real[q] - wi * imag[q], ti = wr * imag[q] + wi * real[q];
          real[q] = real[p] - tr; imag[q] = imag[p] - ti;
          real[p] += tr; imag[p] += ti;
          const nr = wr * cr - wi * ci; wi = wr * ci + wi * cr; wr = nr;
        }
      }
    }
    const scale = 4 / (this.windowSum ** 2);
    for (let i = 0; i < size / 2; i++) this.power[i] = (real[i] ** 2 + imag[i] ** 2) * scale;
    return this.power;
  }
  bandsFromPower(power, output = new Float32Array(BANDS)) {
    const binHz = this.sampleRate / this.size;
    for (let i = 0; i < BANDS; i++) {
      const center = frequencyAt(i);
      const low = Math.max(1, Math.floor((i ? Math.sqrt(frequencyAt(i - 1) * center) : MIN_HZ) / binHz));
      const high = Math.min(power.length - 1, Math.max(low, Math.ceil((i < BANDS - 1 ? Math.sqrt(center * frequencyAt(i + 1)) : MAX_HZ) / binHz)));
      let peak = 0;
      for (let b = low; b <= high; b++) peak = Math.max(peak, power[b]);
      const db = 10 * Math.log10(Math.max(1e-12, peak));
      output[i] = Math.min(1, Math.max(0, (db + 80) / 80));
    }
    return output;
  }
}

// Boundaries are scheduled by sample count, never by the UI/render timer.
export class HopClock {
  constructor(sampleRate, intervalMs = 50) { this.rate = sampleRate; this.position = 0; this.setInterval(intervalMs); }
  setInterval(ms) { this.hop = Math.max(1, Math.round(this.rate * ms / 1000)); this.next = this.position + this.hop; }
  tick() { this.position++; if (this.position < this.next) return false; this.next += this.hop; return true; }
}

export class HistoryBuffer {
  constructor(rows, bands = BANDS) { this.rows = rows; this.bands = bands; this.data = new Float32Array(rows * bands); this.ids = new Float64Array(rows); this.accents = new Float32Array(rows); this.sequence = 0; this.clear(); }
  clear() { this.data.fill(0); this.ids.fill(0); this.accents.fill(1); this.head = -1; this.count = 0; }
  push(row, accent = 1) { this.head = (this.head + 1) % this.rows; this.data.set(row, this.head * this.bands); this.ids[this.head] = ++this.sequence; this.accents[this.head] = accent; this.count = Math.min(this.rows, this.count + 1); }
  at(age, band) { if (age >= this.count) return 0; return this.data[((this.head - age + this.rows) % this.rows) * this.bands + band]; }
  stamp(age) { return age >= this.count ? 0 : this.ids[(this.head - age + this.rows) % this.rows]; }
  accent(age) { return age >= this.count ? 1 : this.accents[(this.head - age + this.rows) % this.rows]; }
}

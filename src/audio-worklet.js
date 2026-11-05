import { FFT_SIZE, BANDS, SpectrumAnalyzer, HopClock } from './dsp.js';
class HistoryProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.left = new Float32Array(FFT_SIZE); this.right = new Float32Array(FFT_SIZE);
    this.fft = new SpectrumAnalyzer(sampleRate); this.clock = new HopClock(sampleRate);
    this.power = new Float64Array(FFT_SIZE / 2); this.write = 0; this.sum = 0; this.samples = 0; this.sequence = 0;
    this.port.onmessage = ({ data }) => { if (data.interval) { this.clock.setInterval(data.interval); this.sum = 0; this.samples = 0; } };
  }
  process(inputs, outputs) {
    const input = inputs[0];
    const count = outputs[0]?.[0]?.length || 128;
    for (let i = 0; i < count; i++) {
      const l = input[0]?.[i] || 0, r = input[1]?.[i] ?? l;
      this.left[this.write] = l; this.right[this.write] = r;
      this.write = (this.write + 1) % FFT_SIZE;
      this.sum += (l * l + r * r) / 2; this.samples++;
      if (this.clock.tick()) {
        this.power.set(this.fft.transform(this.left, this.write));
        const leftBands = this.fft.bandsFromPower(this.power);
        const rightPower = this.fft.transform(this.right, this.write);
        const rightBands = this.fft.bandsFromPower(rightPower);
        for (let b = 0; b < this.power.length; b++) this.power[b] = (this.power[b] + rightPower[b]) / 2;
        const bands = this.fft.bandsFromPower(this.power, new Float32Array(BANDS));
        this.port.postMessage({ bands, leftBands, rightBands, rms: Math.sqrt(this.sum / this.samples), time: (currentFrame + i + 1) / sampleRate, sequence: ++this.sequence }, [bands.buffer, leftBands.buffer, rightBands.buffer]);
        this.sum = 0; this.samples = 0;
      }
    }
    // The output remains zero: never route captured system audio to the speakers.
    return true;
  }
}
registerProcessor('history-processor', HistoryProcessor);

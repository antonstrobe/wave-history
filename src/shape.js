// History fades optically. Its captured vertical shape must never change with age.
export function historyFade(age, rows) {
  return Math.max(0, 1 - age / Math.max(1, rows - 1)) ** 1.7;
}
export function hillEnvelope(age, rows) {
  if (rows < 2 || age <= 0 || age >= rows - 1) return 0;
  return Math.sin(Math.PI * age / (rows - 1)) ** 1.5;
}
export class RhythmTracker {
  constructor() { this.reset(); }
  reset() { this.baseline = 0; this.previousEnergy = 0; this.previousBass = 0; this.pulse = 0; }
  capture(bands, rms, seconds = .05) {
    const energy = rms * rms;
    let bass = 0;
    for (let i = 0; i < Math.min(60, bands.length); i++) bass += bands[i];
    bass /= Math.min(60, bands.length) || 1;
    const ratioRise = Math.max(0, (energy - this.previousEnergy) / Math.max(.00001, this.baseline));
    const spectralRise = Math.max(0, bass - this.previousBass) / .12;
    const onset = rms > .00003 ? Math.min(1, ratioRise * .35 + spectralRise * .5) : 0;
    this.pulse = rms > .00003 ? Math.max(onset, this.pulse * Math.exp(-seconds / .12)) : 0;
    this.baseline += (energy - this.baseline) * (1 - Math.exp(-seconds / .8));
    this.previousEnergy = energy; this.previousBass = bass;
    return 1 + this.pulse * .65;
  }
}
export function stereoVariation(stamp, band, channel, seed, percent) {
  const phase = seed + channel * 2.17;
  const noise = .6 * Math.sin(stamp * .017 + band * .039 + phase) + .4 * Math.sin(stamp * .006 - band * .017 + phase * 1.7);
  return 1 + noise * percent / 100;
}
export function stereoDrift(stamp, band, channel, seed, percent) {
  return Math.sin(stamp * .008 + band * .015 + seed + channel * 1.7) * .025 * percent;
}
export function radialLevels(history, age, bands) {
  const levels = [];
  levels.profiles = []; levels.bass = 0;
  for (let channel = 1; channel <= 2; channel++) {
    const sums = [0, 0, 0];
    let bassPower = 0, bassPeak = 0;
    for (let i = 0; i < bands; i++) {
      const value = history.at(age, channel * bands + i);
      sums[i < 50 ? 0 : i < 130 ? 1 : 2] += value;
      if (i < 50) { bassPower += value * value; bassPeak = Math.max(bassPeak, value); }
    }
    levels.push([sums[0] / 50, sums[1] / 80, sums[2] / (bands - 130)]);
    levels.bass += (.7 * Math.sqrt(bassPower / 50) + .3 * bassPeak) / 2;
    const profile = new Float32Array(48);
    for (let i = 0; i < profile.length; i++) {
      const band = Math.round(i / (profile.length - 1) * (bands - 1));
      let sum = 0, weights = 0;
      for (let k = -5; k <= 5; k++) {
        const weight = 6 - Math.abs(k);
        sum += history.at(age, channel * bands + Math.min(bands - 1, Math.max(0, band + k))) * weight; weights += weight;
      }
      profile[i] = sum / weights;
    }
    levels.profiles.push(profile);
  }
  return levels;
}
export function radialRadius(age, rows) {
  return 22.5 * (Math.max(0, age) / Math.max(1, rows - 1)) ** .35;
}
export function radialShape(levels, angle, stamp, seed, amount, gain, accent) {
  const right = (Math.cos(angle) + 1) / 2;
  const bass = levels[0][0] * (1 - right) + levels[1][0] * right;
  const mid = levels[0][1] * (1 - right) + levels[1][1] * right;
  const high = levels[0][2] * (1 - right) + levels[1][2] * right;
  const energy = bass * .48 + mid * .36 + high * .16;
  const a = amount > 0 ? seed + stamp * .013 : 0;
  const detail = .16 * mid * Math.sin(3 * angle + a) + .12 * high * Math.cos(5 * angle - a * .71);
  const noise = amount / 100 * (.6 * Math.sin(2 * angle + a * .7) + .4 * Math.sin(4 * angle - a));
  let spectrum = energy;
  if (levels.profiles) {
    const phase = angle + amount / 100 * 2.5 * Math.sin(3 * angle + a);
    const index = (Math.sin(phase) + 1) * .5 * (levels.profiles[0].length - 1);
    const lo = Math.floor(index), hi = Math.min(lo + 1, levels.profiles[0].length - 1), f = index - lo;
    const smooth = f * f * (3 - 2 * f);
    const l = levels.profiles[0][lo] * (1 - smooth) + levels.profiles[0][hi] * smooth;
    const r = levels.profiles[1][lo] * (1 - smooth) + levels.profiles[1][hi] * smooth;
    spectrum = l * (1 - right) + r * right;
  }
  // Bass belongs to each captured wave, with the same range as the rest of the spectrum.
  const raw = (.18 * energy + .62 * spectrum + .20 * (levels.bass ?? bass)) ** 1.55 * gain * 5 * accent * (1 + detail + noise);
  const limit = 3.8 * Math.sqrt(gain);
  const height = limit * -Math.expm1(-raw / limit);
  return { height, offset: (spectrum - energy) * .35 + energy * (detail * .7 + noise * 3) };
}

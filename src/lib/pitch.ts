/** Real-time pitch frame. Pure math — the same autocorrelation path as D8R Metronome & Tuner. */

export type PitchFrame = {
  rms: number;
  frequency: number | null;
  clarity: number;
  flatness: number;
  harmonicity: number;
  tonal: boolean;
};

export type PitchGate = {
  rmsMin: number;
  clarityMin: number;
  flatnessMax: number;
  harmonicityMin: number;
};

/** Phone-like gate. Matches the metronome tuner thresholds. */
export const PHONE_GATE: PitchGate = {
  rmsMin: 0.008,
  clarityMin: 0.45,
  flatnessMax: 0.42,
  harmonicityMin: 0.18,
};

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/**
 * 0 is the strict phone gate. 1 is the loose iPad gate.
 * iPad mics barely hear an acoustic piano, so the default there is high.
 */
export function gateForSensitivity(sensitivity: number): PitchGate {
  const t = Math.min(1, Math.max(0, sensitivity));
  return {
    rmsMin: lerp(0.012, 0.0022, t),
    clarityMin: lerp(0.5, 0.28, t),
    flatnessMax: lerp(0.36, 0.62, t),
    harmonicityMin: lerp(0.22, 0.08, t),
  };
}

export function stableFramesForSensitivity(sensitivity: number) {
  return sensitivity >= 0.6 ? 2 : 4;
}

const FFT = 8192;
const SIGNAL = 4096;

const re = new Float64Array(FFT);
const im = new Float64Array(FFT);
const mags = new Float64Array(FFT / 2);

function transform(inverse: boolean) {
  const n = FFT;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }
  const sign = inverse ? 1 : -1;
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (sign * 2 * Math.PI) / len;
    const wlenRe = Math.cos(ang);
    const wlenIm = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let wRe = 1;
      let wIm = 0;
      for (let j = 0; j < half; j++) {
        const k = i + j + half;
        const vRe = re[k] * wRe - im[k] * wIm;
        const vIm = re[k] * wIm + im[k] * wRe;
        const uRe = re[i + j];
        const uIm = im[i + j];
        re[i + j] = uRe + vRe;
        im[i + j] = uIm + vIm;
        re[k] = uRe - vRe;
        im[k] = uIm - vIm;
        const nRe = wRe * wlenRe - wIm * wlenIm;
        wIm = wRe * wlenIm + wIm * wlenRe;
        wRe = nRe;
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < n; i++) {
      re[i] /= n;
      im[i] /= n;
    }
  }
}

function isPeak(lag: number, limit: number) {
  if (lag <= 1 || lag >= limit - 1) return false;
  return re[lag] >= re[lag - 1] && re[lag] >= re[lag + 1];
}

function interpLag(i: number) {
  const a = re[i - 1];
  const b = re[i];
  const c = re[i + 1];
  const d = a - 2 * b + c;
  if (Math.abs(d) < 1e-12) return i;
  const delta = (0.5 * (a - c)) / d;
  if (delta < -1 || delta > 1) return i;
  return i + delta;
}

export function analyzePitch(samples: Float32Array<ArrayBufferLike>, sampleRate: number, gate: PitchGate = PHONE_GATE): PitchFrame {
  const len = Math.min(SIGNAL, samples.length);
  let sum = 0;
  let mean = 0;
  for (let i = 0; i < len; i++) mean += samples[i];
  mean /= len || 1;
  for (let i = 0; i < len; i++) {
    const v = samples[i] - mean;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / (len || 1));

  re.fill(0);
  im.fill(0);
  const denom = Math.max(1, len - 1);
  for (let i = 0; i < len; i++) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / denom));
    re[i] = (samples[i] - mean) * w;
  }

  transform(false);

  const binHz = sampleRate / FFT;
  for (let i = 0; i < FFT / 2; i++) mags[i] = Math.hypot(re[i], im[i]);

  let logSum = 0;
  let arith = 0;
  let count = 0;
  const lo = Math.max(1, Math.floor(80 / binHz));
  const hi = Math.min(FFT / 2 - 1, Math.floor(5000 / binHz));
  for (let b = lo; b <= hi; b++) {
    const m = mags[b] + 1e-12;
    logSum += Math.log(m);
    arith += m;
    count++;
  }
  const flatness = count > 0 && arith > 0 ? Math.exp(logSum / count) / (arith / count) : 1;

  for (let i = 0; i < FFT; i++) {
    re[i] = re[i] * re[i] + im[i] * im[i];
    im[i] = 0;
  }
  transform(true);

  const empty: PitchFrame = { rms, frequency: null, clarity: 0, flatness, harmonicity: 0, tonal: false };
  if (rms < gate.rmsMin || re[0] <= 1e-8) return empty;

  const minLag = Math.max(2, Math.floor(sampleRate / 4200));
  const maxLag = Math.min(len - 2, Math.floor(sampleRate / 40));
  let best = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (re[lag] > best && isPeak(lag, maxLag)) best = re[lag];
  }
  if (best <= 0) return empty;

  let bestLag = -1;
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (re[lag] >= best * 0.9 && isPeak(lag, maxLag)) {
      bestLag = lag;
      break;
    }
  }
  if (bestLag < 0) return empty;

  const precise = interpLag(bestLag);
  const frequency = sampleRate / precise;
  const clarity = re[bestLag] / re[0];

  let harm = 0;
  let total = 0;
  const harmHi = Math.min(FFT / 2 - 1, Math.floor(8000 / binHz));
  for (let b = 1; b <= harmHi; b++) total += mags[b];
  const spacing = frequency / binHz;
  const win = spacing < 4 ? 0 : 1;
  for (let k = 1; k <= 8; k++) {
    const b = Math.round((k * frequency) / binHz);
    if (b <= 1 || b >= FFT / 2 - 1) break;
    for (let d = -win; d <= win; d++) harm += mags[b + d];
  }
  const harmonicity = total > 0 ? Math.min(1, harm / total) : 0;

  const tonal =
    frequency > 40 &&
    frequency < 4200 &&
    clarity >= gate.clarityMin &&
    flatness <= gate.flatnessMax &&
    harmonicity >= gate.harmonicityMin &&
    rms >= gate.rmsMin;

  return { rms, frequency, clarity, flatness, harmonicity, tonal };
}

/** Median of recent tonal frames, or null when the pitch is wandering. */
export function stablePitch(history: number[], minFrames = 4): number | null {
  if (history.length < minFrames) return null;
  const sorted = [...history].sort((a, b) => a - b);
  const median = sorted[sorted.length >> 1];
  if (!median || median <= 0) return null;
  const close = history.filter((f) => Math.abs(1200 * Math.log2(f / median)) <= 40);
  if (close.length < minFrames) return null;
  let acc = 0;
  for (const f of close) acc += f;
  return acc / close.length;
}

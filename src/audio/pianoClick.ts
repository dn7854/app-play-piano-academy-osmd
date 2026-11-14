/**
 * Woodblock count-in from the website's `lib/piano-click.ts`.
 * Same partials, same decays, same peaks (about 0.55 accent / 0.38 beat).
 * No Tone.js here: the buffer is the whole sound, played back at unity gain.
 */

export type ClickKind = "accent" | "beat";

/** Renders one click. Peak stays inside the website's body gain plus the stick noise. */
export function renderClick(sampleRate: number, kind: ClickKind | boolean): Float32Array {
  const accent = kind === true || kind === "accent";
  const duration = accent ? 0.14 : 0.1;
  const length = Math.max(64, Math.floor(sampleRate * duration));
  const data = new Float32Array(length);

  const bodyGain = accent ? 0.55 : 0.38;
  const f1 = accent ? 1250 : 1050;
  const tau1 = 0.014;
  const f2 = accent ? 520 : 470;
  const tau2 = 0.05;
  const tau3 = accent ? 0.09 : 0.07;
  const noiseLen = Math.floor(sampleRate * 0.004);

  let phase1 = 0;
  let phase2 = 0;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const slide = Math.max(0, 1 - t / 0.03);
    phase1 += (2 * Math.PI * (f1 * (0.75 + 0.25 * slide))) / sampleRate;
    phase2 += (2 * Math.PI * f2) / sampleRate;
    const wood = Math.sin(phase1) * Math.exp(-t / tau1);
    const knock = Math.sin(phase2) * Math.exp(-t / tau2);
    let value = (wood * 0.7 + knock * 0.45) * bodyGain * Math.exp(-t / tau3);
    if (i < noiseLen) {
      value += (Math.random() * 2 - 1) * 0.35 * bodyGain * Math.exp(-t / 0.0012);
    }
    data[i] = value;
  }

  const fadeIn = Math.max(1, Math.floor(sampleRate * 0.003));
  for (let i = 0; i < fadeIn; i++) data[i] *= i / fadeIn;
  const fadeOut = Math.min(64, length);
  for (let i = length - fadeOut; i < length; i++) {
    data[i] *= (length - 1 - i) / fadeOut;
  }
  return data;
}

export function clickWavBytes(samples: Float32Array, sampleRate: number): Uint8Array {
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  writeText(view, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeText(view, 8, "WAVE");
  writeText(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(view, 36, "data");
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return new Uint8Array(buffer);
}

function writeText(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
}

export function bytesToBase64(bytes: Uint8Array): string {
  const table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;
    out += table[(triple >> 18) & 63];
    out += table[(triple >> 12) & 63];
    out += i + 1 < bytes.length ? table[(triple >> 6) & 63] : "=";
    out += i + 2 < bytes.length ? table[triple & 63] : "=";
  }
  return out;
}

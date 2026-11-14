import { AudioContext } from "react-native-audio-api";
import { diagnosticText, recordDiagnostic } from "../lib/diagnostics";
import { setAudioSession } from "./session";

let ctx: InstanceType<typeof AudioContext> | null = null;
let clickGain: any = null;

async function prepare() {
  await setAudioSession("playback");
  if (!ctx) ctx = new AudioContext({ sampleRate: 44100 });
  const c = ctx as any;
  if (c.state === "suspended") await c.resume?.();
  if (!clickGain) {
    const gain = c.createGain();
    gain.gain.value = 0.9;
    gain.connect(c.destination);
    clickGain = gain;
  }
}

function env(out: any, time: number, peak: number, decay: number) {
  const c = ctx as any;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), time + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, time + decay);
  g.connect(out);
  return g;
}

/** The same woodblock click as D8R Metronome & Tuner ("wood" sound). */
function wood(time: number, strong: number, sub: boolean) {
  const c = ctx as any;
  const out = clickGain;
  if (!c || !out) return;
  const osc = c.createOscillator();
  const body = env(out, time, 0.28 * strong, sub ? 0.045 : 0.07);
  osc.type = "sine";
  const startF = sub ? 760 : strong > 0.9 ? 640 : 540;
  osc.frequency.setValueAtTime(startF, time);
  osc.frequency.exponentialRampToValueAtTime(sub ? 280 : 170, time + 0.06);
  osc.connect(body);
  osc.start(time);
  osc.stop(time + 0.09);

  const noise = c.createBufferSource();
  const len = Math.floor(c.sampleRate * 0.018);
  const buffer = c.createBuffer(1, len, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  noise.buffer = buffer;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = sub ? 2400 : 1800;
  bp.Q.value = 5;
  const ng = env(out, time, 0.55 * strong, 0.03);
  noise.connect(bp);
  bp.connect(ng);
  noise.start(time);
  noise.stop(time + 0.03);
}

/** Accented woodblock knock on beat 1, lighter knock on the other beats. */
export async function playClick(accent: boolean) {
  recordDiagnostic("play", `count-in click accent=${accent}`);
  try {
    await prepare();
    const time = (ctx as any).currentTime + 0.02;
    wood(time, accent ? 1 : 0.72, false);
  } catch (error) {
    recordDiagnostic("play", `count-in click failed ${diagnosticText(error)}`);
  }
}

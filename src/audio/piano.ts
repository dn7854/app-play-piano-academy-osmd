import { AudioContext } from "react-native-audio-api";
import { PIANO_SAMPLES } from "./pianoSamples";
import { setAudioSession } from "./session";

type Voice = { source: any; gain: any; endsAt: number };

const MAX_BUFFERS = 48;
const buffers = new Map<number, any>();
const pending = new Map<number, Promise<any>>();
let ctx: any = null;
let master: any = null;
let voices: Voice[] = [];

async function context() {
  if (!ctx) {
    await setAudioSession("playback");
    ctx = new AudioContext({ sampleRate: 44100 });
  }
  if (ctx.state === "suspended") await ctx.resume?.();
  if (!master) {
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  }
  return ctx;
}

function remember(midi: number, buffer: any) {
  buffers.delete(midi);
  buffers.set(midi, buffer);
  while (buffers.size > MAX_BUFFERS) {
    const oldest = buffers.keys().next().value;
    if (oldest === undefined) break;
    buffers.delete(oldest);
  }
}

async function load(midi: number) {
  const audio = await context();
  const cached = buffers.get(midi);
  if (cached) {
    remember(midi, cached);
    return cached;
  }
  const source = PIANO_SAMPLES[midi];
  if (source == null) return null;
  let job = pending.get(midi);
  if (!job) {
    job = (audio.decodeAudioData(source) as Promise<any>)
      .then((buffer) => {
        remember(midi, buffer);
        return buffer;
      })
      .catch(() => null)
      .finally(() => pending.delete(midi));
    pending.set(midi, job);
  }
  return job;
}

export async function preloadPiano(midis: number[]) {
  for (const midi of midis) {
    try {
      await load(midi);
    } catch {
      return;
    }
  }
}

export async function playMidiNote(midi: number, velocity = 100, seconds = 0.7) {
  const note = Math.max(21, Math.min(108, Math.round(midi)));
  try {
    const audio = await context();
    const buffer = await load(note);
    if (!buffer || !master) return;
    const now = audio.currentTime;
    voices = voices.filter((voice) => voice.endsAt > now);
    const source = audio.createBufferSource();
    const gain = audio.createGain();
    source.buffer = buffer;
    const level = (0.28 + 0.62 * (Math.max(1, Math.min(127, velocity)) / 127)) * 0.9;
    const end = now + Math.max(0.18, Math.min(3.5, seconds));
    gain.gain.setValueAtTime(level, now);
    gain.gain.setTargetAtTime(0.0001, Math.max(now + 0.05, end - 0.18), 0.05);
    source.connect(gain);
    gain.connect(master);
    source.start(now);
    source.stop(end + 0.08);
    voices.push({ source, gain, endsAt: end + 0.2 });
    if (voices.length > 24) voices.splice(0, voices.length - 24);
  } catch {
    // The sampler is unavailable in Expo Go until a development build is installed.
  }
}

export async function playClick(accent: boolean) {
  try {
    const audio = await context();
    if (!master) return;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "square";
    osc.frequency.value = accent ? 1568 : 1174;
    const now = audio.currentTime;
    gain.gain.setValueAtTime(accent ? 0.12 : 0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.07);
  } catch {
    // Visual count-in still runs.
  }
}

export function stopPiano() {
  voices = [];
}

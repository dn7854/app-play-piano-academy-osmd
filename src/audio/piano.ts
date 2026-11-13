import { AudioContext } from "react-native-audio-api";
import { deviceSampleRate, setAudioSession } from "./session";

let ctx: AudioContext | null = null;
let master: ReturnType<AudioContext["createGain"]> | null = null;

async function context() {
  if (!ctx) {
    await setAudioSession("playback");
    const rate = deviceSampleRate();
    try {
      ctx = rate ? new AudioContext({ sampleRate: rate }) : new AudioContext();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") {
    try {
      await ctx.resume?.();
    } catch {
      // The click can still be scheduled if the context is running.
    }
  }
  if (!master) {
    try {
      master = ctx.createGain();
      master.gain.value = 0.4;
      master.connect(ctx.destination);
    } catch {
      master = null;
      return null;
    }
  }
  return ctx;
}

export async function playClick(accent: boolean) {
  try {
    const audio = await context();
    if (!audio || !master) return;
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
    // The count-in still shows its numbers.
  }
}

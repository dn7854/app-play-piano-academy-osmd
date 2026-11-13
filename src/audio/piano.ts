import { AudioContext } from "react-native-audio-api";
import { diagnosticText, recordDiagnostic } from "../lib/diagnostics";
import { deviceSampleRate, setAudioSession } from "./session";

let ctx: AudioContext | null = null;
let master: ReturnType<AudioContext["createGain"]> | null = null;

async function context() {
  if (!ctx) {
    await setAudioSession("playback");
    const rate = deviceSampleRate();
    try {
      ctx = rate ? new AudioContext({ sampleRate: rate }) : new AudioContext();
    } catch (error) {
      recordDiagnostic("audio", `AudioContext ${diagnosticText(error)}`);
      return null;
    }
  }
  if (ctx.state === "suspended") {
    try {
      await ctx.resume?.();
    } catch (error) {
      recordDiagnostic("audio", `AudioContext resume ${diagnosticText(error)}`);
    }
  }
  if (!master) {
    try {
      master = ctx.createGain();
      master.gain.value = 0.4;
      master.connect(ctx.destination);
    } catch (error) {
      recordDiagnostic("audio", `AudioContext gain ${diagnosticText(error)}`);
      master = null;
      return null;
    }
  }
  return ctx;
}

export async function playClick(accent: boolean) {
  recordDiagnostic("play", `count-in click accent=${accent}`);
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
  } catch (error) {
    recordDiagnostic("play", `count-in click failed ${diagnosticText(error)}`);
  }
}

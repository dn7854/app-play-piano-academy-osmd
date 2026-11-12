import { AudioContext } from "react-native-audio-api";
import { setAudioSession } from "./session";

let ctx: any = null;
let master: any = null;

async function context() {
  if (!ctx) {
    await setAudioSession("playback");
    ctx = new AudioContext({ sampleRate: 44100 });
  }
  if (ctx.state === "suspended") await ctx.resume?.();
  if (!master) {
    master = ctx.createGain();
    master.gain.value = 0.4;
    master.connect(ctx.destination);
  }
  return ctx;
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
    // The count-in still shows its numbers.
  }
}

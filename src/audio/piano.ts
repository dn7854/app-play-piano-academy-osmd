import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { diagnosticText, recordDiagnostic } from "../lib/diagnostics";
import { setAudioSession } from "./session";

const sources = {
  accent: require("../../assets/audio/count-in/accent.wav") as number,
  tick: require("../../assets/audio/count-in/tick.wav") as number,
};

let players: { accent: AudioPlayer; tick: AudioPlayer } | null = null;

function clicks() {
  if (!players) {
    players = {
      accent: createAudioPlayer(sources.accent, { keepAudioSessionActive: true }),
      tick: createAudioPlayer(sources.tick, { keepAudioSessionActive: true }),
    };
  }
  return players;
}

/** Accented wood knock on beat 1, lighter woodblock tick on the other beats. */
export async function playClick(accent: boolean) {
  recordDiagnostic("play", `count-in click accent=${accent}`);
  try {
    await setAudioSession("playback");
    const player = clicks()[accent ? "accent" : "tick"];
    player.volume = accent ? 1 : 0.72;
    await player.seekTo(0);
    player.play();
  } catch (error) {
    recordDiagnostic("play", `count-in click failed ${diagnosticText(error)}`);
  }
}

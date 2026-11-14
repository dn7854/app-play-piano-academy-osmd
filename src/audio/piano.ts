import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { diagnosticText, recordDiagnostic } from "../lib/diagnostics";
import { setAudioSession } from "./session";
import { bytesToBase64, clickWavBytes, renderClick, type ClickKind } from "./pianoClick";

const SAMPLE_RATE = 44100;
const VOICES = 4;

let ready: Promise<{ accent: AudioPlayer[]; beat: AudioPlayer[]; next: number } | null> | null = null;

async function writeClick(kind: ClickKind): Promise<string | null> {
  const root = FileSystem.cacheDirectory;
  if (!root) return null;
  const path = `${root}d8r-count-in-${kind}.wav`;
  const wav = clickWavBytes(renderClick(SAMPLE_RATE, kind), SAMPLE_RATE);
  await FileSystem.writeAsStringAsync(path, bytesToBase64(wav), {
    encoding: FileSystem.EncodingType.Base64,
  });
  return path;
}

function buildClicks() {
  if (!ready) {
    ready = (async () => {
      try {
        const [accentUri, beatUri] = await Promise.all([writeClick("accent"), writeClick("beat")]);
        if (!accentUri || !beatUri) return null;
        const voice = (uri: string) =>
          Array.from({ length: VOICES }, () => createAudioPlayer({ uri }, { keepAudioSessionActive: true }));
        return { accent: voice(accentUri), beat: voice(beatUri), next: 0 };
      } catch (error) {
        recordDiagnostic("play", `count-in prepare ${diagnosticText(error)}`);
        ready = null;
        return null;
      }
    })();
  }
  return ready;
}

void buildClicks();

/**
 * Accented wood knock on beat 1, lighter knock on the other beats.
 * The buffer already has the website's gain, so playback stays at unity.
 */
export async function playClick(accent: boolean) {
  recordDiagnostic("play", `count-in click accent=${accent}`);
  try {
    await setAudioSession("playback");
    const players = await buildClicks();
    if (!players) return;
    const list = players[accent ? "accent" : "beat"];
    const player = list[players.next % list.length];
    players.next += 1;
    player.volume = 1;
    await player.seekTo(0);
    player.play();
  } catch (error) {
    recordDiagnostic("play", `count-in click failed ${diagnosticText(error)}`);
  }
}

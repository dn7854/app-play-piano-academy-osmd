import { Platform } from "react-native";
import { setAudioModeAsync } from "expo-audio";
import { AudioManager } from "react-native-audio-api";
import { diagnosticText, recordDiagnostic } from "../lib/diagnostics";
import { sessionAttempts, type SessionKind, type SessionProfile } from "./sessionProfile";

let tail: Promise<void> = Promise.resolve();
let recordHolds = 0;
let appliedKey: string | null = null;

function profileKey(profile: SessionProfile) {
  return `${profile.iosCategory}|${profile.iosMode}|${profile.allowsRecording ? 1 : 0}|${profile.iosOptions.join(",")}`;
}

function enqueue(task: () => Promise<void>): Promise<void> {
  const run = tail.then(task, task);
  tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function iosPad() {
  return Platform.OS === "ios" && Platform.isPad === true;
}

async function applyProfile(profile: SessionProfile): Promise<boolean> {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: profile.allowsRecording,
      interruptionMode: "mixWithOthers",
      shouldPlayInBackground: true,
    });
  } catch (error) {
    recordDiagnostic("audio", `setAudioModeAsync ${diagnosticText(error)}`);
  }
  const options = profile.iosOptions.join("+") || "none";
  recordDiagnostic("audio", `setAudioSessionOptions ${profile.iosCategory}/${profile.iosMode}/${options}`);
  try {
    AudioManager.setAudioSessionOptions({
      iosCategory: profile.iosCategory,
      iosMode: profile.iosMode,
      iosOptions: profile.iosOptions,
    });
    await AudioManager.setAudioSessionActivity(true);
    return true;
  } catch (error) {
    recordDiagnostic("audio", `setAudioSession ${profile.iosCategory}/${profile.iosMode} ${diagnosticText(error)}`);
    return false;
  }
}

async function applyKind(kind: SessionKind): Promise<void> {
  for (const profile of sessionAttempts(kind, iosPad())) {
    const key = profileKey(profile);
    if (key === appliedKey) return;
    if (await applyProfile(profile)) {
      appliedKey = key;
      return;
    }
  }
}

/** Hardware rate when the session knows it. Null means "let the device choose". */
export function deviceSampleRate(): number | null {
  try {
    const rate = AudioManager.getDevicePreferredSampleRate();
    if (typeof rate === "number" && Number.isFinite(rate) && rate >= 8000 && rate <= 192000) return Math.round(rate);
  } catch (error) {
    recordDiagnostic("audio", `getDevicePreferredSampleRate ${diagnosticText(error)}`);
  }
  return null;
}

/**
 * One in-flight chain. A record hold wins over playback so a metronome click
 * cannot knock the microphone back to a playback-only category.
 * Hold counts change synchronously so a restart does not briefly apply playback.
 */
export function setAudioSession(kind: SessionKind): Promise<void> {
  if (kind === "record") recordHolds += 1;
  return enqueue(() => applyKind(recordHolds > 0 ? "record" : "playback"));
}

export function releaseAudioSession(kind: SessionKind): Promise<void> {
  if (kind !== "record") return Promise.resolve();
  recordHolds = Math.max(0, recordHolds - 1);
  return enqueue(() => applyKind(recordHolds > 0 ? "record" : "playback"));
}

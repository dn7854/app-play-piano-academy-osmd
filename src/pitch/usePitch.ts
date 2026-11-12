import { useEffect, useState } from "react";
import { AudioManager, AudioRecorder } from "react-native-audio-api";
import { analyzePitch, gateForSensitivity, stablePitch } from "../lib/pitch";

export type PitchStatus = "idle" | "requesting" | "denied" | "missing" | "listening";

export type PitchReading = {
  status: PitchStatus;
  message: string | null;
  rms: number;
  hz: number | null;
  liveHz: number | null;
};

const empty: PitchReading = { status: "idle", message: null, rms: 0, hz: null, liveHz: null };
const WINDOW = 4096;
const REQUESTED_RATE = 44100;

let recorder: AudioRecorder | null = null;

function getRecorder() {
  if (!recorder) recorder = new AudioRecorder();
  return recorder;
}

function granted(status: unknown) {
  return String(status).toLowerCase() === "granted";
}

async function openMic(): Promise<"ok" | "denied"> {
  AudioManager.setAudioSessionOptions({
    iosCategory: "playAndRecord",
    iosMode: "measurement",
    iosOptions: ["defaultToSpeaker", "allowBluetoothA2DP"],
  });
  await AudioManager.setAudioSessionActivity(true);
  let status: unknown = await AudioManager.requestRecordingPermissions();
  const check = (AudioManager as { checkRecordingPermissions?: () => Promise<unknown> }).checkRecordingPermissions;
  if (!granted(status) && check) status = await check();
  return granted(status) ? "ok" : "denied";
}

function takeFrame(
  stash: Float32Array<ArrayBufferLike>,
  chunk: Float32Array<ArrayBufferLike>,
): { stash: Float32Array<ArrayBufferLike>; frame: Float32Array<ArrayBufferLike> | null } {
  if (chunk.length >= WINDOW && stash.length === 0) {
    return { frame: chunk.slice(0, WINDOW), stash: chunk.slice(WINDOW) };
  }
  const merged = new Float32Array(stash.length + chunk.length);
  merged.set(stash);
  merged.set(chunk, stash.length);
  if (merged.length < WINDOW) return { frame: null, stash: merged };
  return { frame: merged.slice(0, WINDOW), stash: merged.slice(WINDOW) };
}

export function usePitch(enabled: boolean, sensitivity: number): PitchReading {
  const [reading, setReading] = useState<PitchReading>(empty);
  const framesNeeded = sensitivity >= 0.6 ? 2 : 4;

  useEffect(() => {
    if (!enabled) {
      setReading(empty);
      return;
    }

    let cancelled = false;
    let stash: Float32Array<ArrayBufferLike> = new Float32Array(0);
    const history: number[] = [];
    let misses = 0;
    let streak = 0;
    const rec = getRecorder();
    const gate = gateForSensitivity(sensitivity);

    setReading({ status: "requesting", message: null, rms: 0, hz: null, liveHz: null });

    rec.onAudioReady({ sampleRate: REQUESTED_RATE, bufferLength: WINDOW, channelCount: 1 }, ({ buffer }) => {
      if (cancelled) return;
      const channel = buffer.getChannelData(0);
      const next = takeFrame(stash, channel);
      stash = next.stash;
      if (!next.frame) return;
      const rate = (buffer as { sampleRate?: number }).sampleRate ?? REQUESTED_RATE;
      const frame = analyzePitch(next.frame, rate, gate);
      if (frame.tonal && frame.frequency) {
        history.push(frame.frequency);
        if (history.length > 6) history.shift();
        misses = 0;
        streak += 1;
      } else {
        misses += 1;
        streak = 0;
        if (misses > 2) history.length = 0;
      }
      const hz = stablePitch(history, framesNeeded);
      const liveHz = frame.tonal && frame.frequency && (streak >= 2 || hz != null) ? frame.frequency : hz;
      setReading({
        status: "listening",
        message: null,
        rms: Math.min(1, frame.rms * 4),
        hz,
        liveHz,
      });
    });

    void (async () => {
      try {
        const permission = await openMic();
        if (cancelled) return;
        if (permission !== "ok") {
          setReading({
            status: "denied",
            message: "Microphone is blocked. Allow it in Settings, then try again.",
            rms: 0,
            hz: null,
            liveHz: null,
          });
          return;
        }
        try {
          rec.disableFileOutput();
        } catch {
          // already off
        }
        await rec.start();
        if (cancelled && rec.isRecording()) void rec.stop();
      } catch {
        if (cancelled) return;
        setReading({
          status: "missing",
          message: "The microphone could not start.",
          rms: 0,
          hz: null,
          liveHz: null,
        });
      }
    })();

    return () => {
      cancelled = true;
      try {
        rec.clearOnAudioReady();
      } catch {
        // ignore
      }
      if (rec.isRecording()) void rec.stop();
    };
  }, [enabled, framesNeeded, sensitivity]);

  return reading;
}

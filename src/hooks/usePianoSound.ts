// src/hooks/usePianoSound.ts
// Piano audio using expo-audio (same pattern as simple-magic-piano).
// 88 samples loaded on-demand to avoid Android AudioPlayer crash.

import { Platform } from "react-native";
import { createAudioPlayer } from "expo-audio";
import type { AudioPlayer } from "expo-audio";
import { useRef, useCallback, useEffect, useState } from "react";
import { getSampleDetails } from "../lib/sampleMapper";

const players = new Map<number, AudioPlayer>();
let globalReady = false;
let volumePct = 80;

async function initPiano(): Promise<void> {
  if (Platform.OS === "web" || globalReady) return;
  for (const m of [60, 64, 67, 72, 48, 55, 52, 36, 40, 43]) {
    const { source } = getSampleDetails(m);
    if (source && !players.has(m)) {
      try {
        players.set(m, createAudioPlayer(source, { keepAudioSessionActive: true }));
        await new Promise((r) => setTimeout(r, 15));
      } catch (_) {}
    }
  }
  globalReady = true;
}

async function ensure(midi: number): Promise<void> {
  if (players.has(midi)) return;
  const { source } = getSampleDetails(midi);
  if (!source) return;
  try {
    players.set(midi, createAudioPlayer(source, { keepAudioSessionActive: true }));
    await new Promise((r) => setTimeout(r, 10));
  } catch (_) {}
}

async function playNoteRaw(midi: number, velocity = 1): Promise<void> {
  if (Platform.OS === "web") return;
  if (!globalReady) await initPiano();
  await ensure(midi);
  const p = players.get(midi);
  if (!p) return;
  try {
    const maxVol = Math.max(0, Math.min(1, velocity)) * (volumePct / 100);
    p.volume = maxVol;
    await p.seekTo(0);
    await p.play();
    setTimeout(() => {
      const start = Date.now();
      const vol = p.volume;
      const iv = setInterval(() => {
        const e = (Date.now() - start) / 1000;
        const v = vol * Math.max(0, 1 - e / 0.5);
        if (v <= 0.01) {
          clearInterval(iv);
          try { p.pause(); } catch (_) {}
          p.volume = 0;
        } else {
          p.volume = v;
        }
      }, 50);
    }, 1000);
  } catch (_) {}
}

/** Velocity is 0–1, matching the old sampler. */
export function playPianoNote(midi: number, velocity = 0.8) {
  void playNoteRaw(Math.round(midi), velocity);
}

export function usePianoSound() {
  const [ready, setReady] = useState(globalReady);

  useEffect(() => {
    if (!globalReady) {
      initPiano().then(() => setReady(true));
    }
    return () => {};
  }, []);

  const playNote = useCallback(
    (midi: number, velocity: number = 0.8) => {
      if (!ready) return;
      playNoteRaw(midi, velocity);
    },
    [ready]
  );

  const registerKey = useCallback((_midi: number, _player: any) => {}, []);

  return { playNote, registerKey };
}

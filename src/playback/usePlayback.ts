import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { playClick, playMidiNote, preloadPiano } from "../audio/piano";
import { config } from "../config";
import { nextEventTime, soundingNotes, waitingNotes, type TimedNote } from "../lib/notes";
import { backingPlaybackRate, countIn, tempoRatio } from "../lib/tempo";

export type BackingTrack = { uri: string; bpm: number | null };

type Snap = {
  scoreTime: number;
  playing: boolean;
  countdown: number | null;
  active: number[];
  waiting: number[];
  success: number[];
  wrong: number[];
  ended: boolean;
};

const empty: Snap = {
  scoreTime: 0,
  playing: false,
  countdown: null,
  active: [],
  waiting: [],
  success: [],
  wrong: [],
  ended: false,
};

export function usePlayback({
  notes,
  pieceBpm,
  duration,
  timeSignature,
  backing,
  playMode,
  waitMode,
  selectedBpm,
  gated,
  onPaywall,
}: {
  notes: TimedNote[];
  pieceBpm: number;
  duration: number;
  timeSignature: string | null;
  backing: BackingTrack | null;
  playMode: boolean;
  waitMode: boolean;
  selectedBpm: number;
  gated: boolean;
  onPaywall: () => void;
}) {
  const [snap, setSnap] = useState<Snap>(empty);
  const snapRef = useRef(snap);
  snapRef.current = snap;
  const notesRef = useRef(notes);
  const live = useRef({
    pieceBpm,
    duration,
    backing,
    playMode,
    waitMode,
    selectedBpm,
    gated,
  });
  live.current = { pieceBpm, duration, backing, playMode, waitMode, selectedBpm, gated };
  const onPaywallRef = useRef(onPaywall);
  onPaywallRef.current = onPaywall;
  const triggered = useRef(new Set<number>());
  const playingRef = useRef(false);
  const scoreRef = useRef(0);
  const lastWall = useRef(0);
  const lastNudge = useRef(0);
  const lastPublish = useRef(0);
  const paywallLatch = useRef(false);
  const advanceLock = useRef(0);
  const playerRef = useRef<AudioPlayer | null>(null);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const frame = useRef(0);

  const player = useCallback(() => {
    if (playerRef.current) return playerRef.current;
    try {
      playerRef.current = createAudioPlayer(null);
      playerRef.current.shouldCorrectPitch = true;
    } catch {
      return null;
    }
    return playerRef.current;
  }, []);

  const publish = useCallback((patch: Partial<Snap>, force = false) => {
    const next = { ...snapRef.current, ...patch, scoreTime: scoreRef.current };
    snapRef.current = next;
    const now = Date.now();
    if (!force && now - lastPublish.current < 70) return;
    lastPublish.current = now;
    setSnap(next);
  }, []);

  const pauseBacking = useCallback(() => {
    try {
      playerRef.current?.pause();
    } catch {
      // already stopped
    }
  }, []);

  const syncBacking = useCallback(
    (seconds: number, resume: boolean) => {
      const track = live.current.backing;
      const audio = playerRef.current;
      if (!track || !audio) return;
      const trackBpm = track.bpm || live.current.pieceBpm || 1;
      const fileTime = seconds * (live.current.pieceBpm / trackBpm);
      audio.playbackRate = backingPlaybackRate(live.current.selectedBpm, track.bpm);
      void audio.seekTo(Math.max(0, fileTime)).catch(() => undefined);
      if (resume && !live.current.waitMode) audio.play();
    },
    [],
  );

  const stop = useCallback(() => {
    playingRef.current = false;
    for (const id of timers.current) clearTimeout(id);
    timers.current = [];
    pauseBacking();
    publish({ playing: false, countdown: null, active: [], waiting: [] }, true);
  }, [pauseBacking, publish]);

  const arm = useCallback(
    (seconds: number) => {
      scoreRef.current = seconds;
      lastWall.current = performance.now();
      playingRef.current = true;
      const waiting = live.current.waitMode ? waitingNotes(notesRef.current, seconds) : [];
      if (live.current.backing && waiting.length === 0) {
        const audio = player();
        if (audio) {
          audio.playbackRate = backingPlaybackRate(live.current.selectedBpm, live.current.backing.bpm);
          syncBacking(seconds, true);
        }
      }
      publish(
        {
          playing: true,
          countdown: null,
          ended: false,
          waiting,
          active: soundingNotes(notesRef.current, seconds),
        },
        true,
      );
    },
    [player, publish, syncBacking],
  );

  const seek = useCallback(
    (seconds: number, resume = playingRef.current) => {
      const limit = live.current.gated ? Math.min(live.current.duration, config.previewSeconds) : live.current.duration;
      let next = Math.max(0, Math.min(limit, seconds));
      if (live.current.gated && seconds > config.previewSeconds + 0.01) {
        next = config.previewSeconds;
        paywallLatch.current = true;
        onPaywallRef.current();
      }
      if (next < config.previewSeconds - 0.4) paywallLatch.current = false;
      scoreRef.current = next;
      triggered.current = new Set(notesRef.current.map((note, index) => (note.time < next - 0.03 ? index : -1)).filter((index) => index >= 0));
      syncBacking(next, resume && !live.current.waitMode);
      const waiting = live.current.waitMode && resume ? waitingNotes(notesRef.current, next) : [];
      publish(
        {
          playing: resume,
          waiting,
          active: soundingNotes(notesRef.current, next),
          ended: live.current.duration > 0 && next >= live.current.duration - 0.05,
        },
        true,
      );
    },
    [publish, syncBacking],
  );

  const begin = useCallback(
    (fromStart: boolean) => {
      for (const id of timers.current) clearTimeout(id);
      timers.current = [];
      if (!fromStart) {
        arm(scoreRef.current);
        return;
      }
      const [clicks, quarters] = countIn(timeSignature);
      const gap = ((60 / Math.max(1, live.current.selectedBpm)) * quarters) * 1000;
      playingRef.current = false;
      let left = clicks;
      const tick = () => {
        if (left <= 0) {
          arm(0);
          return;
        }
        publish({ countdown: left, playing: false }, true);
        void playClick(left === clicks);
        left -= 1;
        timers.current.push(setTimeout(tick, gap));
      };
      tick();
    },
    [arm, publish, timeSignature],
  );

  const toggle = useCallback(() => {
    if (playingRef.current || snapRef.current.countdown != null) {
      stop();
      return;
    }
    if (live.current.gated && scoreRef.current >= config.previewSeconds - 0.05) {
      onPaywallRef.current();
      return;
    }
    begin(scoreRef.current < 0.05);
  }, [begin, stop]);

  const onNote = useCallback(
    (midi: number, source: "key" | "midi" | "mic") => {
      if (source !== "mic") void playMidiNote(midi, source === "midi" ? 110 : 92, 0.55);
      const now = Date.now();
      if (!playingRef.current || !live.current.waitMode) {
        publish({ success: [], wrong: [] }, true);
        return;
      }
      const expected = waitingNotes(notesRef.current, scoreRef.current);
      if (!expected.includes(midi)) {
        publish({ wrong: [midi], success: [] }, true);
        timers.current.push(setTimeout(() => publish({ wrong: [] }, true), 360));
        return;
      }
      if (now - advanceLock.current < 280) return;
      advanceLock.current = now;
      const next = nextEventTime(notesRef.current, scoreRef.current, live.current.duration);
      publish({ success: [midi], wrong: [] }, true);
      timers.current.push(setTimeout(() => publish({ success: [] }, true), 420));
      if (next >= live.current.duration - 0.05) {
        scoreRef.current = live.current.duration;
        stop();
        publish({ ended: true }, true);
        return;
      }
      seek(next, true);
    },
    [publish, seek, stop],
  );

  useEffect(() => {
    notesRef.current = notes;
    triggered.current = new Set(
      notes.map((note, index) => (note.time < scoreRef.current - 0.03 ? index : -1)).filter((index) => index >= 0),
    );
    const unique = [...new Set(notes.map((note) => note.note))].slice(0, 36);
    void preloadPiano(unique);
  }, [notes]);

  useEffect(() => {
    const audio = player();
    if (!audio) return;
    if (!backing) {
      audio.pause();
      return;
    }
    audio.replace(backing.uri);
    audio.shouldCorrectPitch = true;
    audio.playbackRate = backingPlaybackRate(selectedBpm, backing.bpm);
    if (playingRef.current && !live.current.waitMode) {
      syncBacking(scoreRef.current, true);
    }
  }, [backing?.uri, player, syncBacking]);

  useEffect(() => {
    if (playerRef.current && backing) {
      playerRef.current.playbackRate = backingPlaybackRate(selectedBpm, backing.bpm);
    }
  }, [selectedBpm, backing]);

  useEffect(() => {
    let alive = true;
    const loop = () => {
      if (!alive) return;
      frame.current = requestAnimationFrame(loop);
      if (!playingRef.current) return;
      const state = live.current;
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastWall.current) / 1000);
      lastWall.current = now;
      const list = notesRef.current;
      if (state.waitMode) {
        const waiting = waitingNotes(list, scoreRef.current);
        if (waiting.length) {
          pauseBacking();
          publish({ waiting, active: waiting, playing: true });
          return;
        }
      }
      scoreRef.current += dt * tempoRatio(state.pieceBpm, state.selectedBpm);
      if (state.gated && scoreRef.current >= config.previewSeconds) {
        scoreRef.current = config.previewSeconds;
        if (!paywallLatch.current) {
          paywallLatch.current = true;
          onPaywallRef.current();
        }
        stop();
        return;
      }
      if (state.duration > 0 && scoreRef.current >= state.duration - 0.04) {
        scoreRef.current = state.duration;
        stop();
        publish({ ended: true }, true);
        return;
      }
      if (state.playMode) {
        list.forEach((note, index) => {
          if (triggered.current.has(index)) return;
          if (note.time <= scoreRef.current && note.time > scoreRef.current - 0.12) {
            triggered.current.add(index);
            void playMidiNote(note.note, 100, note.duration / Math.max(0.45, tempoRatio(state.pieceBpm, state.selectedBpm)));
          } else if (note.time < scoreRef.current - 0.12) {
            triggered.current.add(index);
          }
        });
      }
      const audio = playerRef.current;
      if (state.backing && audio && now - lastNudge.current > 1500 && audio.isLoaded) {
        lastNudge.current = now;
        const trackBpm = state.backing.bpm || state.pieceBpm || 1;
        const expected = scoreRef.current * (state.pieceBpm / trackBpm);
        if (Math.abs(audio.currentTime - expected) > 0.45) {
          void audio.seekTo(Math.max(0, expected)).catch(() => undefined);
        }
        if (!audio.playing) audio.play();
      }
      publish({
        playing: true,
        waiting: [],
        active: soundingNotes(list, scoreRef.current),
        ended: false,
      });
    };
    frame.current = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(frame.current);
    };
  }, [pauseBacking, publish, stop]);

  useEffect(() => {
    return () => {
      stop();
      playerRef.current?.remove();
      playerRef.current = null;
    };
  }, [stop]);

  return { ...snap, duration, seek, toggle, onNote, stop };
}

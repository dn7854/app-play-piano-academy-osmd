/** Tempo is chosen from 55% to 100% of the piece's written BPM, matching academy-studio. */
export function tempoBounds(pieceBpm: number) {
  const max = Math.max(1, Math.round(pieceBpm || 1));
  const min = Math.min(max, Math.max(1, Math.ceil(pieceBpm * 0.55 - 1e-9)));
  return { min, max };
}

export function clampTempo(pieceBpm: number, bpm: number) {
  const { min, max } = tempoBounds(pieceBpm);
  return Math.min(max, Math.max(min, Math.round(bpm)));
}

export function tempoRatio(pieceBpm: number, selectedBpm: number) {
  if (pieceBpm <= 0) return 1;
  return clampTempo(pieceBpm, selectedBpm) / pieceBpm;
}

/** HTML/audio playbackRate, clamped the way the website clamps backing tracks. */
export function backingPlaybackRate(selectedBpm: number, trackBpm: number | null) {
  if (!trackBpm || trackBpm <= 0) return tempoRatio(selectedBpm, selectedBpm);
  return Math.min(1.5, Math.max(0.4, selectedBpm / trackBpm));
}

const COUNT_IN: Record<string, [number, number]> = {
  "4/4": [4, 1],
  "3/4": [3, 1],
  "2/4": [4, 0.5],
  "6/8": [6, 0.5],
  "3/8": [6, 0.25],
  "6/4": [3, 2],
};

/** Clicks and the length of one click in quarter-notes. */
export function countIn(timeSignature: string | null) {
  return COUNT_IN[timeSignature || "4/4"] ?? [4, 1];
}

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

/**
 * Index into backing groups. -1 is "None", and only when the piece has no track.
 * A single track is selected even if its label is Piano.
 */
export function defaultBackingIndex(labels: string[]) {
  if (labels.length === 0) return -1;
  const orchestra = labels.findIndex((label) => !/piano/i.test(label));
  return orchestra >= 0 ? orchestra : 0;
}

/** HTML/audio playbackRate, clamped the way the website clamps backing tracks. */
export function backingPlaybackRate(selectedBpm: number, trackBpm: number | null) {
  if (!trackBpm || trackBpm <= 0) return tempoRatio(selectedBpm, selectedBpm);
  return Math.min(1.5, Math.max(0.4, selectedBpm / trackBpm));
}

/**
 * Clicks, and the length of one click in quarter notes.
 * The click is always the denominator: /4 a quarter, /8 an eighth, /2 a half.
 * The count is one bar of those clicks. 2/4 is the exception and counts four quarters,
 * because one bar is too short to lead in.
 */
export function countIn(timeSignature: string | null): [number, number] {
  const match = /^(\d+)\s*\/\s*(\d+)$/.exec((timeSignature || "4/4").trim());
  if (!match) return [4, 1];
  const beats = Number(match[1]);
  const division = Number(match[2]);
  if (beats <= 0 || division <= 0) return [4, 1];
  const quarters = 4 / division;
  if (beats === 2 && division === 4) return [4, quarters];
  return [beats, quarters];
}

export type TimedNote = {
  time: number;
  duration: number;
  note: number;
  measure?: number;
};

/** The chord the player must hit: every note that starts together. Any one of them advances. */
export function waitingNotes(notes: TimedNote[], scoreTime: number): number[] {
  let group = notes.filter((note) => note.time >= scoreTime - 0.01 && note.time <= scoreTime + 0.05);
  if (!group.length) {
    const next = notes.find((note) => note.time > scoreTime + 0.01);
    if (next) group = notes.filter((note) => Math.abs(note.time - next.time) < 0.02);
  }
  return [...new Set(group.map((note) => note.note))];
}

export function nextEventTime(notes: TimedNote[], scoreTime: number, duration: number) {
  const next = notes.find((note) => note.time > scoreTime + 0.06);
  return next ? next.time : duration;
}

export function soundingNotes(notes: TimedNote[], scoreTime: number): number[] {
  const midis = notes.filter((note) => scoreTime >= note.time && scoreTime <= note.time + note.duration).map((note) => note.note);
  return [...new Set(midis)];
}

export function nearestMidi(hz: number) {
  return Math.round(69 + 12 * Math.log2(hz / 440));
}

/** Advance when any expected pitch is heard, within `cents` of that note. No full-chord check. */
export function matchAnyExpected(hz: number | null, expected: number[], cents = 50): number | null {
  if (hz == null || hz < 40 || hz > 4200 || !expected.length) return null;
  const midi = nearestMidi(hz);
  if (!expected.includes(midi)) return null;
  const target = 440 * 2 ** ((midi - 69) / 12);
  const off = Math.abs(1200 * Math.log2(hz / target));
  return off <= cents ? midi : null;
}

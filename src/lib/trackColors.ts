/**
 * Hand colors from academy-studio `track-colors.ts`.
 * The website paints MIDI track 0 sky and track 1 indigo, and it labels
 * MIDI channel 0 as the right hand and channel 1 as the left hand.
 */

export const TRACK_PALETTE = [
  "#38bdf8",
  "#6366f1",
  "#34d399",
  "#f472b6",
  "#fbbf24",
  "#fb7185",
  "#22d3ee",
  "#fb923c",
] as const;

/** Right hand, the website's first track color (sky). */
export const RIGHT_HAND_COLOR = TRACK_PALETTE[0];

/** Left hand, indigo — the website's second track color. */
export const LEFT_HAND_COLOR = TRACK_PALETTE[1];

export function trackColor(trackIndex: number) {
  const index = Number.isFinite(trackIndex) ? Math.abs(Math.trunc(trackIndex)) : 0;
  return TRACK_PALETTE[index % TRACK_PALETTE.length];
}

export type HandSource = {
  channel?: number;
  staff?: number;
  track?: number;
};

/**
 * A MIDI track uses the website palette (track 0 sky, track 1 indigo).
 * Without a track, channel 0 / the upper staff is the right hand and
 * channel 1 / a lower staff is the left hand.
 */
export function performanceColor(note: HandSource | null | undefined): string {
  if (!note) return RIGHT_HAND_COLOR;
  if (typeof note.track === "number") return trackColor(note.track);
  if (note.channel === 1 || (note.staff != null && note.staff >= 2)) return LEFT_HAND_COLOR;
  return RIGHT_HAND_COLOR;
}

type Paintable = HandSource & { time: number; note: number };

/**
 * Copy MIDI channel/track onto the notes the screen already draws, so the
 * waterfall and the keys use the file's hands when the score steps have none.
 */
export function paintHands<T extends Paintable, M extends Paintable>(
  display: readonly T[],
  midi: readonly M[],
): Array<T & HandSource> {
  if (!midi.length) return display.map((note) => note);
  return display.map((note) => {
    if (note.channel != null || note.track != null) return note;
    const match = midi.find((event) => event.note === note.note && Math.abs(event.time - note.time) < 0.08);
    if (!match || (match.channel == null && match.track == null)) return note;
    return { ...note, channel: match.channel, track: match.track };
  });
}

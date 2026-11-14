/**
 * Inbound messages from the Academy embed.
 * Command types live in academy-embed-protocol.ts, copied from the website.
 */
import type { TimedNote } from "./notes";
import {
  ACADEMY_EMBED_PROTOCOL_VERSION,
  type EmbedMeasure,
  type EmbedNote,
} from "./academy-embed-protocol";

export {
  ACADEMY_EMBED_PROTOCOL_VERSION as PROTOCOL_VERSION,
  wholeToSeconds,
  clampEmbedZoom,
  parseEmbedCommand,
  type EmbedCommand,
  type EmbedCursorColor,
  type EmbedEvent,
  type EmbedLayoutName,
  type EmbedMeasure,
  type EmbedNote,
  type EmbedPitch,
} from "./academy-embed-protocol";

export function protocolCompatible(version: unknown) {
  return version === ACADEMY_EMBED_PROTOCOL_VERSION;
}

export type LoadedScore = {
  pieceId: string | null;
  bpm: number;
  timeSignature: string;
  keySignature: string;
  measuresPerSystem: number | null;
  pageCount: number;
  measures: EmbedMeasure[];
  notes: EmbedNote[];
};

export type NoteTapped = {
  time: number;
  noteIndex: number | null;
  measureIndex: number;
  whole: number;
};

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function pitchesOf(value: unknown): EmbedNote["pitches"] {
  if (!Array.isArray(value)) return [];
  const pitches: EmbedNote["pitches"] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const midi = num(row.midi);
    if (midi == null) continue;
    pitches.push({ midi, staff: num(row.staff) ?? 1 });
  }
  return pitches;
}

function notesOf(value: unknown): EmbedNote[] {
  if (!Array.isArray(value)) return [];
  const notes: EmbedNote[] = [];
  value.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const row = item as Record<string, unknown>;
    notes.push({
      index: num(row.index) ?? index,
      measureIndex: num(row.measureIndex) ?? 0,
      whole: num(row.whole) ?? 0,
      seconds: num(row.seconds) ?? 0,
      pitches: pitchesOf(row.pitches),
    });
  });
  return notes;
}

function measuresOf(value: unknown): EmbedMeasure[] {
  if (!Array.isArray(value)) return [];
  const measures: EmbedMeasure[] = [];
  value.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const row = item as Record<string, unknown>;
    measures.push({
      index: num(row.index) ?? index,
      number: num(row.number) ?? index + 1,
      startWhole: num(row.startWhole) ?? 0,
      durationWhole: num(row.durationWhole) ?? 0,
      startSeconds: num(row.startSeconds) ?? 0,
      timeSignature: typeof row.timeSignature === "string" ? row.timeSignature : null,
    });
  });
  return measures;
}

export function parseEmbedEvent(data: string):
  | { kind: "ready"; protocolVersion: number }
  | { kind: "loaded"; score: LoadedScore }
  | { kind: "noteTapped"; tap: NoteTapped }
  | { kind: "error"; message: string; code: string }
  | null {
  let body: unknown;
  try {
    body = JSON.parse(data);
  } catch {
    return null;
  }
  if (!body || typeof body !== "object") return null;
  const row = body as Record<string, unknown>;
  if (row.type === "ready") {
    return { kind: "ready", protocolVersion: num(row.protocolVersion) ?? -1 };
  }
  if (row.type === "error") {
    return {
      kind: "error",
      message: typeof row.message === "string" ? row.message : "The score view failed.",
      code: typeof row.code === "string" ? row.code : "load_failed",
    };
  }
  if (row.type === "noteTapped") {
    const time = num(row.time);
    if (time == null) return null;
    return {
      kind: "noteTapped",
      tap: {
        time,
        noteIndex: num(row.noteIndex),
        measureIndex: num(row.measureIndex) ?? 0,
        whole: num(row.whole) ?? 0,
      },
    };
  }
  if (row.type === "loaded") {
    return {
      kind: "loaded",
      score: {
        pieceId: typeof row.pieceId === "string" ? row.pieceId : null,
        bpm: num(row.bpm) ?? 120,
        timeSignature: typeof row.timeSignature === "string" ? row.timeSignature : "4/4",
        keySignature: typeof row.keySignature === "string" ? row.keySignature : "C",
        measuresPerSystem: row.measuresPerSystem == null ? null : num(row.measuresPerSystem),
        pageCount: num(row.pageCount) ?? 1,
        measures: measuresOf(row.measures),
        notes: notesOf(row.notes),
      },
    };
  }
  return null;
}

/**
 * OSMD `halfTone` uses the MusicXML octave as-is (C4 = 48). Piano keys and MIDI
 * files use C4 = 60. The embed sends the OSMD number in `pitches[].midi`.
 */
export function osmdHalfToneToMidi(halfTone: number): number {
  const midi = Math.round(halfTone) + 12;
  return Math.min(108, Math.max(21, midi));
}

/** One sounding note per pitch in each cursor step. Duration runs until the next step. */
export function notesFromEmbed(notes: EmbedNote[]): TimedNote[] {
  const out: TimedNote[] = [];
  notes.forEach((step, index) => {
    const next = notes[index + 1];
    const duration = next ? Math.max(0.05, next.seconds - step.seconds) : 0.45;
    for (const pitch of step.pitches) {
      out.push({
        time: step.seconds,
        duration,
        note: osmdHalfToneToMidi(pitch.midi),
        measure: step.measureIndex,
        staff: pitch.staff,
      });
    }
  });
  return out;
}

/**
 * Academy embed protocol version 1.
 *
 * The hosted page at /academy-studio/embed/{pieceId} and the bundled
 * public/academy-embed/index.html speak the same messages.
 *
 * Embed → app
 *   { type: "ready", protocolVersion: 1 }
 *   { type: "loaded", protocolVersion: 1, bpm, measures, steps }
 *   { type: "error", message }
 *
 * App → embed
 *   { type: "load", musicXmlUrl }
 *   { type: "transport", seconds, whole, bpm, playing, waitMode }
 *   { type: "viewport", orientation, device, playing }
 *
 * seconds = whole * 240 / bpm, with `whole` in OSMD whole-note units.
 */

export const PROTOCOL_VERSION = 1;

export function protocolCompatible(version: unknown) {
  return version === PROTOCOL_VERSION;
}

export function secondsFromWhole(whole: number, bpm: number) {
  if (!Number.isFinite(whole) || !Number.isFinite(bpm) || bpm <= 0) return 0;
  return (whole * 240) / bpm;
}

export function wholeFromSeconds(seconds: number, bpm: number) {
  if (!Number.isFinite(seconds) || !Number.isFinite(bpm) || bpm <= 0) return 0;
  return (seconds * bpm) / 240;
}

export type ScoreMeasure = {
  number: number;
  whole: number;
  seconds: number;
};

export type ScoreNote = {
  midi: number;
  whole: number;
  seconds: number;
  durationWhole: number;
  durationSeconds: number;
  measure: number;
  staff: number | null;
};

export type ScoreStep = {
  whole: number;
  seconds: number;
  durationWhole: number;
  durationSeconds: number;
  measure: number;
  notes: ScoreNote[];
};

export type LoadedScore = {
  bpm: number;
  measures: ScoreMeasure[];
  steps: ScoreStep[];
};

export type ReadyMessage = { type: "ready"; protocolVersion: number };
export type ErrorMessage = { type: "error"; message: string };
export type LoadedMessage = { type: "loaded" } & LoadedScore & { protocolVersion?: number };

export type EmbedToApp = ReadyMessage | ErrorMessage | (LoadedMessage & { raw?: unknown });

export type LoadMessage = { type: "load"; musicXmlUrl: string };
export type TransportMessage = {
  type: "transport";
  seconds: number;
  whole: number;
  bpm: number;
  playing: boolean;
  waitMode: boolean;
};
export type ViewportMessage = {
  type: "viewport";
  orientation: "portrait" | "landscape";
  device: "phone" | "tablet";
  playing: boolean;
};

export type AppToEmbed = LoadMessage | TransportMessage | ViewportMessage;

function num(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function measuresOf(value: unknown, bpm: number): ScoreMeasure[] {
  if (!Array.isArray(value)) return [];
  const out: ScoreMeasure[] = [];
  value.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const row = item as Record<string, unknown>;
    const whole = num(row.whole) ?? 0;
    out.push({
      number: num(row.number) ?? num(row.index) ?? num(row.measure) ?? index + 1,
      whole,
      seconds: num(row.seconds) ?? secondsFromWhole(whole, bpm),
    });
  });
  return out;
}

function noteOf(row: Record<string, unknown>, bpm: number, measure: number): ScoreNote | null {
  const midi = num(row.midi) ?? num(row.note) ?? num(row.noteNumber);
  if (midi == null) return null;
  const whole = num(row.whole) ?? 0;
  const durationWhole = num(row.durationWhole) ?? num(row.duration) ?? 0.25;
  const staff = num(row.staff);
  return {
    midi,
    whole,
    seconds: num(row.seconds) ?? secondsFromWhole(whole, bpm),
    durationWhole,
    durationSeconds: num(row.durationSeconds) ?? secondsFromWhole(durationWhole, bpm),
    measure: num(row.measure) ?? measure,
    staff,
  };
}

function stepsOf(value: unknown, bpm: number): ScoreStep[] {
  if (!Array.isArray(value)) return [];
  const steps: ScoreStep[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const whole = num(row.whole) ?? 0;
    const measure = num(row.measure) ?? num(row.measureNumber) ?? 1;
    const seconds = num(row.seconds) ?? secondsFromWhole(whole, bpm);
    if (Array.isArray(row.notes)) {
      const notes = row.notes
        .map((note) => (note && typeof note === "object" ? noteOf(note as Record<string, unknown>, bpm, measure) : null))
        .filter((note): note is ScoreNote => note != null)
        .map((note) => ({ ...note, whole: note.whole || whole, seconds: note.seconds || seconds, measure }));
      if (!notes.length) continue;
      const durationWhole = num(row.durationWhole) ?? Math.max(...notes.map((note) => note.durationWhole));
      steps.push({
        whole,
        seconds,
        durationWhole,
        durationSeconds: num(row.durationSeconds) ?? secondsFromWhole(durationWhole, bpm),
        measure,
        notes,
      });
      continue;
    }
    const flat = noteOf(row, bpm, measure);
    if (!flat) continue;
    const last = steps[steps.length - 1];
    if (last && Math.abs(last.whole - flat.whole) < 0.0001) {
      last.notes.push(flat);
      last.durationWhole = Math.max(last.durationWhole, flat.durationWhole);
      last.durationSeconds = Math.max(last.durationSeconds, flat.durationSeconds);
    } else {
      steps.push({
        whole: flat.whole,
        seconds: flat.seconds,
        durationWhole: flat.durationWhole,
        durationSeconds: flat.durationSeconds,
        measure: flat.measure,
        notes: [flat],
      });
    }
  }
  return steps;
}

export function parseEmbedMessage(data: string): { kind: "ready"; protocolVersion: number } | { kind: "loaded"; score: LoadedScore } | { kind: "error"; message: string } | null {
  let body: unknown;
  try {
    body = JSON.parse(data);
  } catch {
    return null;
  }
  if (!body || typeof body !== "object") return null;
  const row = body as Record<string, unknown>;
  if (row.type === "ready" || row.type === "hello") {
    return { kind: "ready", protocolVersion: num(row.protocolVersion) ?? -1 };
  }
  if (row.type === "error") {
    return { kind: "error", message: typeof row.message === "string" ? row.message : "The score view failed." };
  }
  if (row.type === "loaded" || row.type === "score") {
    const bpm = num(row.bpm) ?? num(row.tempo) ?? 120;
    const steps = stepsOf(row.steps ?? row.noteSteps ?? row.notes, bpm);
    return {
      kind: "loaded",
      score: {
        bpm,
        measures: measuresOf(row.measures, bpm),
        steps,
      },
    };
  }
  return null;
}

export function flattenSteps(steps: ScoreStep[]) {
  return steps.flatMap((step) =>
    step.notes.map((note) => ({
      time: note.seconds || step.seconds,
      duration: note.durationSeconds || step.durationSeconds,
      note: note.midi,
      measure: note.measure,
    })),
  );
}

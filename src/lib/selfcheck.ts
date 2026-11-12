import { parseMidi } from "./midi";
import { flattenSteps, parseEmbedMessage, protocolCompatible, secondsFromWhole, wholeFromSeconds, PROTOCOL_VERSION } from "./protocol";
import { matchAnyExpected, nextEventTime, waitingNotes } from "./notes";
import { clampTempo, tempoBounds } from "./tempo";
import { gateForSensitivity } from "./pitch";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function midiBytes() {
  const bytes: number[] = [];
  const push = (...values: number[]) => bytes.push(...values);
  const vlq = (value: number) => {
    bytes.push(value & 0x7f);
  };
  push(0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0x01, 0xe0);
  const track: number[] = [];
  const add = (...values: number[]) => track.push(...values);
  add(0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20);
  add(0x00, 0x90, 60, 100);
  add(0x83, 0x60, 0x80, 60, 0);
  add(0x00, 0xff, 0x2f, 0x00);
  push(0x4d, 0x54, 0x72, 0x6b, (track.length >> 24) & 0xff, (track.length >> 16) & 0xff, (track.length >> 8) & 0xff, track.length & 0xff, ...track);
  void vlq;
  return Uint8Array.from(bytes);
}

const parsed = parseMidi(midiBytes(), 120);
assert(parsed.notes.length === 1, "midi note count");
assert(Math.abs(parsed.notes[0].time) < 0.02, "midi start");
assert(Math.abs(parsed.notes[0].duration - 0.5) < 0.05, `midi duration ${parsed.notes[0].duration}`);
assert(parsed.notes[0].note === 60, "midi pitch");

assert(Math.abs(secondsFromWhole(1, 60) - 4) < 1e-9, "whole note at 60");
assert(Math.abs(secondsFromWhole(0.25, 50) - 1.2) < 1e-9, "quarter at 50");
assert(Math.abs(wholeFromSeconds(1.2, 50) - 0.25) < 1e-9, "inverse");

const bounds = tempoBounds(100);
assert(bounds.min === 55 && bounds.max === 100, "tempo bounds");
assert(clampTempo(80, 10) === 44, "tempo floor");
assert(clampTempo(80, 90) === 80, "tempo ceiling");

assert(protocolCompatible(PROTOCOL_VERSION), "protocol 1");
assert(!protocolCompatible(2), "protocol reject");

const loaded = parseEmbedMessage(
  JSON.stringify({
    type: "loaded",
    protocolVersion: 1,
    bpm: 60,
    measures: [{ number: 1, whole: 0, seconds: 0 }],
    steps: [
      {
        whole: 0,
        seconds: 0,
        durationWhole: 0.25,
        durationSeconds: 1,
        measure: 1,
        notes: [
          { midi: 60, whole: 0, seconds: 0, durationWhole: 0.25, durationSeconds: 1, measure: 1, staff: 1 },
          { midi: 64, whole: 0, seconds: 0, durationWhole: 0.25, durationSeconds: 1, measure: 1, staff: 1 },
        ],
      },
    ],
  }),
);
assert(loaded?.kind === "loaded", "loaded kind");
if (loaded?.kind === "loaded") {
  const flat = flattenSteps(loaded.score.steps);
  assert(flat.length === 2, "two notes");
  assert(waitingNotes(flat, 0).sort().join() === "60,64", "waiting chord");
  assert(matchAnyExpected(329.6, [60, 64]) === 64, "any note of the chord");
  assert(matchAnyExpected(440, [60, 64]) == null, "wrong pitch");
  assert(nextEventTime(flat, 0, 4) === 4, "advance to the end when nothing follows");
}

const ipad = gateForSensitivity(0.78);
const phone = gateForSensitivity(0.22);
assert(ipad.rmsMin < phone.rmsMin, "ipad hears quieter notes");
assert(ipad.clarityMin < phone.clarityMin, "ipad gate is looser");

console.log("selfcheck ok");

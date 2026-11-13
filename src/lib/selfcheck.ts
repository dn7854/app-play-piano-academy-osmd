import { ApiError, flowEndpointMissing, normalizeFlow } from "../api/client";
import { parseMidi } from "./midi";
import { notesFromEmbed, parseEmbedCommand, parseEmbedEvent, protocolCompatible, PROTOCOL_VERSION, wholeToSeconds } from "./protocol";
import { matchAnyExpected, waitingNotes } from "./notes";
import { clampTempo, tempoBounds } from "./tempo";
import { gateForSensitivity } from "./pitch";
import { sessionAttempts } from "../audio/sessionProfile";
import { parseStudioView, showsKeyboard, showsScore } from "./studioView";
import { isPreviewLocked, PREVIEW_SECONDS } from "./preview-limit";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function midiBytes() {
  const bytes: number[] = [];
  const push = (...values: number[]) => bytes.push(...values);
  push(0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0x01, 0xe0);
  const track: number[] = [];
  const add = (...values: number[]) => track.push(...values);
  add(0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20);
  add(0x00, 0x90, 60, 100);
  add(0x83, 0x60, 0x80, 60, 0);
  add(0x00, 0xff, 0x2f, 0x00);
  push(0x4d, 0x54, 0x72, 0x6b, (track.length >> 24) & 0xff, (track.length >> 16) & 0xff, (track.length >> 8) & 0xff, track.length & 0xff, ...track);
  return Uint8Array.from(bytes);
}

const parsed = parseMidi(midiBytes(), 120);
assert(parsed.notes.length === 1, "midi note count");
assert(Math.abs(parsed.notes[0].time) < 0.02, "midi start");
assert(Math.abs(parsed.notes[0].duration - 0.5) < 0.05, `midi duration ${parsed.notes[0].duration}`);
assert(parsed.notes[0].note === 60, "midi pitch");

assert(Math.abs(wholeToSeconds(1, 60) - 4) < 1e-9, "whole note at 60");
assert(Math.abs(wholeToSeconds(0.25, 50) - 1.2) < 1e-9, "quarter at 50");

const bounds = tempoBounds(100);
assert(bounds.min === 55 && bounds.max === 100, "tempo bounds");
assert(clampTempo(80, 10) === 44, "tempo floor");
assert(clampTempo(80, 90) === 80, "tempo ceiling");

assert(protocolCompatible(PROTOCOL_VERSION), "protocol 1");
assert(!protocolCompatible(2), "protocol reject");
assert(parseEmbedCommand({ type: "setLayout", layout: "landscape-phone" })?.type === "setLayout", "setLayout");
assert(parseEmbedCommand({ type: "cursor", time: 1.2, color: "green" })?.type === "cursor", "cursor");
assert(parseEmbedCommand({ type: "seek", time: 2 })?.type === "seek", "seek");
assert(parseEmbedCommand({ type: "setPlaybackActive", active: true })?.type === "setPlaybackActive", "playback");
assert(parseEmbedCommand({ type: "setZoom", zoom: 9 })?.type === "setZoom", "zoom");
assert(parseEmbedCommand({ type: "load", musicXmlUrl: "data:application/xml,hi" }) == null, "data url rejected");
assert(parseEmbedCommand({ type: "transport" }) == null, "old transport rejected");

const loaded = parseEmbedEvent(
  JSON.stringify({
    type: "loaded",
    protocolVersion: 1,
    pieceId: "piece",
    bpm: 60,
    timeSignature: "4/4",
    keySignature: "C",
    measuresPerSystem: null,
    pageCount: 1,
    measures: [{ index: 0, number: 1, startWhole: 0, durationWhole: 1, startSeconds: 0, timeSignature: "4/4" }],
    notes: [
      { index: 0, measureIndex: 0, whole: 0, seconds: 0, pitches: [{ midi: 60, staff: 1 }, { midi: 64, staff: 1 }] },
      { index: 1, measureIndex: 0, whole: 0.25, seconds: 1, pitches: [{ midi: 67, staff: 1 }] },
    ],
  }),
);
assert(loaded?.kind === "loaded", "loaded kind");
if (loaded?.kind === "loaded") {
  const flat = notesFromEmbed(loaded.score.notes);
  assert(flat.length === 3, "three pitches");
  assert(waitingNotes(flat, 0).sort().join() === "60,64", "waiting chord");
  assert(matchAnyExpected(329.6, [60, 64]) === 64, "any note of the chord");
  assert(flat[2].time === 1, "next step time");
}

assert(isPreviewLocked(true, PREVIEW_SECONDS), "preview locks at 20");
assert(!isPreviewLocked(false, 30), "free piece");
assert(!isPreviewLocked(true, 19.9), "still inside the preview");

const ipad = gateForSensitivity(0.78);
const phone = gateForSensitivity(0.22);
assert(ipad.rmsMin < phone.rmsMin, "ipad hears quieter notes");

const padRecord = sessionAttempts("record", true);
const phoneRecord = sessionAttempts("record", false);
const playback = sessionAttempts("playback", true);
assert(padRecord[0].iosMode === "measurement", "ipad record prefers measurement");
assert(!padRecord[0].iosOptions.includes("defaultToSpeaker"), "measurement skips defaultToSpeaker");
assert(phoneRecord[0].iosMode === "default" && phoneRecord[0].iosOptions.includes("defaultToSpeaker"), "iphone record uses the speaker");
assert(phoneRecord.every((profile) => profile.iosCategory === "playAndRecord"), "record stays playAndRecord");
assert(!phoneRecord.some((profile) => profile.iosMode === "measurement" && profile.iosOptions.includes("defaultToSpeaker")), "no measurement plus speaker");
assert(playback[0].iosCategory === "playback" && playback[0].iosOptions.join() === "mixWithOthers", "playback mixes");
assert(!playback.some((profile) => profile.iosOptions.includes("allowBluetoothA2DP") || profile.allowsRecording), "playback stays playback");

assert(parseStudioView(null) === "score", "view defaults to keys");
assert(parseStudioView("nope") === "score", "unknown view falls back");
assert(showsScore("view") && !showsKeyboard("view"), "score-only hides the keyboard");
assert(showsScore("score") && showsKeyboard("score"), "keys mode keeps the score");
assert(!showsScore("waterfall") && showsKeyboard("waterfall"), "waterfall replaces the score");

const flow = normalizeFlow({
  sections: [
    {
      id: "level-2",
      title: "Level 2",
      description: "Next",
      position: 1,
      tiles: [
        {
          id: "placement-b",
          position: 0,
          piece: {
            id: "piece-b",
            slug: "minuet",
            title: "Minuet in G",
            composer: "Christian Petzold",
            difficulty: "Beginner",
            tempo: 108,
            timeSignature: "3/4",
            imageUrl: null,
            isPremium: false,
            hasPdf: false,
          },
        },
      ],
    },
    {
      id: "level-1",
      title: "Level 1",
      description: "First scores on the path.",
      position: 0,
      tiles: [
        {
          id: "placement-late",
          position: 1,
          piece: {
            id: "piece-a",
            slug: "fur-elise",
            title: "Für Elise",
            composer: "Ludwig van Beethoven",
            difficulty: "nope",
            tempo: "120",
            timeSignature: "3/8",
            imageUrl: "/covers/elise.jpg",
            isPremium: true,
            hasPdf: true,
          },
        },
        { id: "placement-bad", position: 2, piece: { title: "Missing id" } },
        {
          id: "placement-early",
          position: 0,
          piece: {
            id: "piece-c",
            slug: "ode",
            title: "Ode to Joy",
            composer: null,
            difficulty: null,
            imageUrl: "https://cdn.example/ode.jpg",
            isPremium: "true",
          },
        },
      ],
    },
    { id: "empty-level", title: "Empty", position: 2, tiles: [] },
  ],
});
assert(flow.map((section) => section.id).join() === "level-1,level-2", "flow section order");
assert(flow[0].tiles.map((tile) => tile.id).join() === "placement-early,placement-late", "flow tile order");
assert(flow[0].tiles[0].id !== flow[0].tiles[0].piece.id, "tile id is the placement");
assert(flow[0].tiles[0].piece.imageUrl === "https://cdn.example/ode.jpg", "absolute cover kept");
assert(flow[0].tiles[1].piece.imageUrl === null, "relative cover dropped");
assert(flow[0].tiles[1].piece.difficulty === null, "unknown difficulty");
assert(flow[0].tiles[1].piece.isPremium === true, "premium flag");
assert(flow[0].tiles[1].piece.tempo === 120, "tempo number");
assert(normalizeFlow({ sections: [] }).length === 0, "empty flow");
assert(normalizeFlow(null).length === 0, "missing flow");
assert(flowEndpointMissing(new ApiError("missing", 404, "http")), "404 hides flow");
assert(flowEndpointMissing(new ApiError("signin", 302, "unavailable")), "signin hides flow");
assert(!flowEndpointMissing(new ApiError("down", 500, "http")), "500 keeps flow");
assert(!flowEndpointMissing(new ApiError("offline", null, "network")), "network is not a missing route");

console.log("selfcheck ok");

import { clickWavBytes, renderClick } from "../audio/pianoClick";
import { ApiError, flowEndpointMissing, normalizeFlow } from "../api/client";
import { resolveBackingIndex } from "./backing";
import { pieceCoverUrl } from "./covers";
import { pageContainScale, LANDSCAPE_SCORE_ZOOM, PORTRAIT_SCORE_ZOOM } from "./embedScale";
import { parseMidi } from "./midi";
import { matchAnyExpected, openingAnchor, waitingNotes } from "./notes";
import { notesFromEmbed, osmdHalfToneToMidi, parseEmbedCommand, parseEmbedEvent, protocolCompatible, PROTOCOL_VERSION, wholeToSeconds } from "./protocol";
import { SUCCESS_GAP_MS, SUCCESS_PHRASES } from "./praise";
import { LEFT_HAND_COLOR, RIGHT_HAND_COLOR, paintHands, performanceColor, trackColor } from "./trackColors";
import { waterfallBar, waterfallHitY } from "./waterfall";
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
assert(parsed.notes[0].channel === 0 && parsed.notes[0].track === 0, "midi channel");

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
      { index: 0, measureIndex: 0, whole: 0, seconds: 0, pitches: [{ midi: 48, staff: 1 }, { midi: 52, staff: 1 }] },
      { index: 1, measureIndex: 0, whole: 0.25, seconds: 1, pitches: [{ midi: 55, staff: 1 }] },
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
  assert(flat[0].note === 60 && flat[2].note === 67, "osmd halfTone becomes midi");
  assert(flat[0].staff === 1, "staff is kept for hand color");
  assert(openingAnchor(flat) === 64, "opening anchor is the highest note of the first chord");
}

assert(osmdHalfToneToMidi(48) === 60, "middle C");
assert(osmdHalfToneToMidi(9) === 21, "A0");
assert(osmdHalfToneToMidi(96) === 108, "C8");
assert(osmdHalfToneToMidi(200) === 108, "midi ceiling");
assert(osmdHalfToneToMidi(-40) === 21, "midi floor");

const naturalH = 1152 * 297 / 210;
const byHeight = pageContainScale(800, 400, 1152, naturalH, 1);
assert(byHeight != null && Math.abs(byHeight - 400 / naturalH) < 1e-9, "page fits the slot height");
const byWidth = pageContainScale(400, 2000, 1152, naturalH, 1);
assert(byWidth != null && Math.abs(byWidth - 400 / 1152) < 1e-9, "page fits the slot width");
const grown = pageContainScale(2304, 4000, 1152, naturalH, 1);
assert(grown != null && Math.abs(grown - 2) < 1e-9, "page can grow to fill a large slot");
const zoomed = pageContainScale(800, 400, 1152, naturalH, 2);
assert(zoomed != null && byHeight != null && Math.abs(zoomed - byHeight * 2) < 1e-9, "page keeps the zoom");
assert(pageContainScale(10, 400, 1152, naturalH, 1) == null, "page ignores a tiny slot");

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
            pdfThumbnailUrl: "/thumbs/minuet.jpg",
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
            pdfThumbnailUrl: "https://cdn.example/elise-p1.jpg",
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
            pdfThumbnailUrl: "https://cdn.example/ode-p1.jpg",
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
assert(flow[0].tiles[1].piece.pdfThumbnailUrl === "https://cdn.example/elise-p1.jpg", "pdf thumbnail kept");
assert(flow[1].tiles[0].piece.pdfThumbnailUrl === null, "relative pdf thumbnail dropped");
assert(pieceCoverUrl(flow[0].tiles[0].piece) === "https://cdn.example/ode.jpg", "cover prefers imageUrl");
assert(pieceCoverUrl(flow[0].tiles[1].piece) === "https://cdn.example/elise-p1.jpg", "cover uses the pdf thumbnail");
assert(
  pieceCoverUrl(flow[0].tiles[0].piece, "https://cdn.example/ode.jpg") === "https://cdn.example/ode-p1.jpg",
  "failed cover falls through",
);
assert(pieceCoverUrl({ imageUrl: null, pdfThumbnailUrl: null }) === null, "cover placeholder");
assert(flow[0].tiles[1].piece.difficulty === null, "unknown difficulty");
assert(flow[0].tiles[1].piece.isPremium === true, "premium flag");
assert(flow[0].tiles[1].piece.tempo === 120, "tempo number");
assert(normalizeFlow({ sections: [] }).length === 0, "empty flow");
assert(normalizeFlow(null).length === 0, "missing flow");
assert(flowEndpointMissing(new ApiError("missing", 404, "http")), "404 hides flow");
assert(flowEndpointMissing(new ApiError("signin", 302, "unavailable")), "signin hides flow");
assert(!flowEndpointMissing(new ApiError("down", 500, "http")), "500 keeps flow");
assert(!flowEndpointMissing(new ApiError("offline", null, "network")), "network is not a missing route");

assert(PORTRAIT_SCORE_ZOOM === 1, "portrait zoom stays fitted");
assert(LANDSCAPE_SCORE_ZOOM === 1.85, "landscape zoom fills the width");
assert(RIGHT_HAND_COLOR === "#38bdf8" && trackColor(0) === RIGHT_HAND_COLOR, "right hand is sky");
assert(LEFT_HAND_COLOR === "#6366f1" && trackColor(1) === LEFT_HAND_COLOR, "left hand is indigo");
assert(performanceColor({ channel: 0 }) === RIGHT_HAND_COLOR, "channel 0 is the right hand");
assert(performanceColor({ channel: 1 }) === LEFT_HAND_COLOR, "channel 1 is the left hand");
assert(performanceColor({ staff: 2 }) === LEFT_HAND_COLOR, "lower staff is the left hand");
assert(performanceColor({ channel: 0, track: 1 }) === LEFT_HAND_COLOR, "track color wins, matching the website");
assert(trackColor(2) === "#34d399", "later tracks keep the website palette");
const painted = paintHands(
  [{ time: 0, duration: 1, note: 60, staff: 1 }],
  [{ time: 0.02, duration: 0.4, note: 60, channel: 1, track: 1 }],
);
assert(painted[0].channel === 1 && performanceColor(painted[0]) === LEFT_HAND_COLOR, "midi hand paints the score note");

assert(resolveBackingIndex([], null) === -1, "no tracks stays empty");
assert(resolveBackingIndex(["Piano grand"], null) === 0, "a piano track is selected");
assert(resolveBackingIndex(["Piano grand"], "none") === 0, "saved none falls back to a track");
assert(resolveBackingIndex(["Piano", "Orchestra"], null) === 1, "a non-piano track wins");
assert(resolveBackingIndex(["Orchestra", "Piano"], "Piano") === 1, "saved label wins");
assert(resolveBackingIndex(["Piano grand"], "Orchestra") === 0, "unknown label falls back");

const hit = waterfallHitY(200);
const crossed = waterfallBar({ time: 0.5, duration: 1 }, 1, 200, 100, hit);
assert(crossed != null && crossed.top + crossed.height === hit, "a late note ends on the saber");
const early = waterfallBar({ time: 1.5, duration: 0.2 }, 1, 200, 100, hit);
assert(early != null && early.top + early.height < hit, "an approaching note stays above the saber");

assert(SUCCESS_GAP_MS === 800, "success phrase matches the website gap");
assert(SUCCESS_PHRASES.length === 5, "success phrases");
const accent = renderClick(8000, "accent");
const beat = renderClick(8000, "beat");
assert(accent.length > beat.length, "accent click is longer");
assert(accent[0] === 0 && beat[0] === 0, "clicks fade in");
let accentPeak = 0;
let beatPeak = 0;
for (const sample of accent) accentPeak = Math.max(accentPeak, Math.abs(sample));
for (const sample of beat) beatPeak = Math.max(beatPeak, Math.abs(sample));
assert(accentPeak <= 1 && beatPeak <= 1 && accentPeak > beatPeak, "accent is louder and stays in range");
const wav = clickWavBytes(beat, 8000);
assert(String.fromCharCode(wav[0], wav[1], wav[2], wav[3]) === "RIFF", "count-in wav");
assert(wav.length === 44 + beat.length * 2, "count-in wav length");

console.log("selfcheck ok");

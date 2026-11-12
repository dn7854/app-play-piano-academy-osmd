// lib/academy-embed-protocol.ts
//
// Messages between the Academy OSMD embed and the Expo WebView.
// protocolVersion starts at 1. The native app should ignore a document whose
// ready message reports a different version.

export const ACADEMY_EMBED_PROTOCOL_VERSION = 1;

export type EmbedLayoutName = "portrait" | "landscape-phone" | "landscape-tablet";
export type EmbedCursorColor = "sky" | "green";

export type EmbedCommand =
  | { type: "hello" }
  | {
      type: "load";
      musicXmlUrl: string;
      pieceId?: string | null;
      bpm?: number;
      timeSignature?: string;
      keySignature?: string;
      measuresPerSystem?: number | null;
    }
  | { type: "setLayout"; layout: EmbedLayoutName }
  | { type: "cursor"; time?: number; noteIndex?: number; color?: EmbedCursorColor }
  | { type: "seek"; time: number }
  | { type: "setPlaybackActive"; active: boolean }
  | { type: "setZoom"; zoom: number };

export interface EmbedPitch {
  midi: number;
  staff: number;
}

export interface EmbedMeasure {
  index: number;
  number: number;
  startWhole: number;
  durationWhole: number;
  startSeconds: number;
  timeSignature: string | null;
}

export interface EmbedNote {
  index: number;
  measureIndex: number;
  whole: number;
  seconds: number;
  pitches: EmbedPitch[];
}

export type EmbedEvent =
  | { type: "ready" }
  | {
      type: "loaded";
      pieceId: string | null;
      bpm: number;
      timeSignature: string;
      keySignature: string;
      measuresPerSystem: number | null;
      pageCount: number;
      measures: EmbedMeasure[];
      notes: EmbedNote[];
    }
  | {
      type: "noteTapped";
      time: number;
      noteIndex: number | null;
      measureIndex: number;
      whole: number;
    }
  | { type: "error"; message: string; code: string };

export type EmbedOutbound = EmbedEvent & { protocolVersion: typeof ACADEMY_EMBED_PROTOCOL_VERSION };

const LAYOUTS: readonly EmbedLayoutName[] = ["portrait", "landscape-phone", "landscape-tablet"];

export function wholeToSeconds(whole: number, bpm: number): number {
  const tempo = bpm > 0 ? bpm : 120;
  return Math.round((whole * 240 / tempo) * 1000) / 1000;
}

export function clampEmbedZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(3, Math.max(0.5, zoom));
}

/** Accepts an object or a JSON string. Returns null when the message is not a command. */
export function parseEmbedCommand(data: unknown): EmbedCommand | null {
  let value = data;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const message = value as Record<string, unknown>;
  switch (message.type) {
    case "hello":
      return { type: "hello" };
    case "load": {
      if (typeof message.musicXmlUrl !== "string" || !isFetchableUrl(message.musicXmlUrl)) return null;
      return {
        type: "load",
        musicXmlUrl: message.musicXmlUrl,
        pieceId: typeof message.pieceId === "string" ? message.pieceId : null,
        bpm: finiteNumber(message.bpm),
        timeSignature: typeof message.timeSignature === "string" ? message.timeSignature : undefined,
        keySignature: typeof message.keySignature === "string" ? message.keySignature : undefined,
        measuresPerSystem: message.measuresPerSystem == null
          ? null
          : finiteNumber(message.measuresPerSystem) ?? null,
      };
    }
    case "setLayout":
      return typeof message.layout === "string" && LAYOUTS.includes(message.layout as EmbedLayoutName)
        ? { type: "setLayout", layout: message.layout as EmbedLayoutName }
        : null;
    case "cursor":
      return {
        type: "cursor",
        time: finiteNumber(message.time),
        noteIndex: finiteNumber(message.noteIndex),
        color: message.color === "green" ? "green" : message.color === "sky" ? "sky" : undefined,
      };
    case "seek": {
      const time = finiteNumber(message.time);
      return time == null ? null : { type: "seek", time };
    }
    case "setPlaybackActive":
      return typeof message.active === "boolean" ? { type: "setPlaybackActive", active: message.active } : null;
    case "setZoom": {
      const zoom = finiteNumber(message.zoom);
      return zoom == null ? null : { type: "setZoom", zoom: clampEmbedZoom(zoom) };
    }
    default:
      return null;
  }
}

export function postEmbedMessage(message: EmbedEvent): void {
  const body: EmbedOutbound = { protocolVersion: ACADEMY_EMBED_PROTOCOL_VERSION, ...message };
  const json = JSON.stringify(body);
  const native = (window as Window & { ReactNativeWebView?: { postMessage: (payload: string) => void } }).ReactNativeWebView;
  if (native?.postMessage) native.postMessage(json);
  if (window.parent && window.parent !== window) window.parent.postMessage(body, "*");
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isFetchableUrl(value: string): boolean {
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" || url.protocol === "blob:";
  } catch {
    return false;
  }
}


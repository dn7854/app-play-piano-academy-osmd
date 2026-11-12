import * as FileSystem from "expo-file-system/legacy";
import { bytesFromBase64, parseMidi, type MidiNote } from "../lib/midi";
import type { PieceDetail } from "./types";

function root() {
  return `${FileSystem.cacheDirectory}academy-pieces/`;
}

function hash(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

export function cachePath(pieceId: string, kind: string, url: string) {
  const ext = (url.split("?")[0].split(".").pop() || "bin").toLowerCase();
  const safe = /^[a-z0-9]{1,5}$/.test(ext) ? ext : "bin";
  return `${root()}${pieceId}-${kind}-${hash(url)}.${safe}`;
}

async function ensureDir() {
  await FileSystem.makeDirectoryAsync(root(), { intermediates: true });
}

export async function ensureCached(pieceId: string, kind: string, url: string | null) {
  if (!url) return null;
  const path = cachePath(pieceId, kind, url);
  const info = await FileSystem.getInfoAsync(path);
  if (info.exists && !info.isDirectory && (info.size ?? 0) > 0) return info.uri;
  try {
    await ensureDir();
    const result = await FileSystem.downloadAsync(url, path);
    if (result.status && (result.status < 200 || result.status >= 300)) return null;
    return result.uri;
  } catch {
    const again = await FileSystem.getInfoAsync(path);
    return again.exists ? again.uri : null;
  }
}

export async function readTextFile(uri: string | null) {
  if (!uri) return null;
  try {
    return await FileSystem.readAsStringAsync(uri);
  } catch {
    return null;
  }
}

export type CachedPiece = {
  xmlText: string | null;
  midiNotes: MidiNote[];
  midiDuration: number;
  mp3: { label: string; remoteUrl: string; localUri: string | null; bpm: number | null }[];
};

export async function cachePiece(piece: PieceDetail): Promise<CachedPiece> {
  await savePieceMeta(piece);
  const [xmlUri, midiUri] = await Promise.all([
    ensureCached(piece.id, "xml", piece.musicXmlUrl),
    ensureCached(piece.id, "midi", piece.midiUrl),
  ]);
  const mp3 = await Promise.all(
    piece.mp3Files.map(async (file, index) => ({
      label: file.label,
      remoteUrl: file.url,
      bpm: file.bpm,
      localUri: await ensureCached(piece.id, `mp3-${index}`, file.url),
    })),
  );
  let midiNotes: MidiNote[] = [];
  let midiDuration = 0;
  if (midiUri) {
    try {
      const b64 = await FileSystem.readAsStringAsync(midiUri, { encoding: FileSystem.EncodingType.Base64 });
      const parsed = parseMidi(bytesFromBase64(b64), piece.tempo || 120);
      midiNotes = parsed.notes;
      midiDuration = parsed.duration;
    } catch {
      midiNotes = [];
    }
  }
  return {
    xmlText: await readTextFile(xmlUri),
    midiNotes,
    midiDuration,
    mp3,
  };
}

export async function savePieceMeta(piece: PieceDetail) {
  try {
    await ensureDir();
    const body = JSON.stringify(piece);
    await FileSystem.writeAsStringAsync(`${root()}${piece.id}.json`, body);
    if (piece.slug && piece.slug !== piece.id) {
      await FileSystem.writeAsStringAsync(`${root()}${piece.slug}.json`, body);
    }
  } catch {
    // The score can still play online without a saved card.
  }
}

export async function readPieceMeta(idOrSlug: string): Promise<PieceDetail | null> {
  try {
    const text = await FileSystem.readAsStringAsync(`${root()}${idOrSlug}.json`);
    return JSON.parse(text) as PieceDetail;
  } catch {
    return null;
  }
}

export async function rememberJson(name: string, value: unknown) {
  try {
    await ensureDir();
    await FileSystem.writeAsStringAsync(`${root()}catalog-${name}.json`, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export async function recallJson<T>(name: string): Promise<T | null> {
  try {
    const text = await FileSystem.readAsStringAsync(`${root()}catalog-${name}.json`);
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

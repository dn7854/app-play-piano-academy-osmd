import * as FileSystem from "expo-file-system/legacy";
import { config, resolveAssetUrl } from "../config";
import type { Collection, CollectionDetail, Mp3File, PieceDetail, PieceSummary } from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly kind: "network" | "unavailable" | "http" | "parse",
  ) {
    super(message);
  }
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function num(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function flag(value: unknown) {
  return value === true || value === "true" || value === 1;
}

function list(data: unknown, keys: string[]) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  const row = data as Record<string, unknown>;
  for (const key of keys) {
    if (Array.isArray(row[key])) return row[key] as unknown[];
  }
  return [];
}

function mp3Files(raw: Record<string, unknown>): Mp3File[] {
  const files = raw.mp3Files ?? raw.mp3s ?? raw.backingTracks;
  if (!Array.isArray(files)) return [];
  return files
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const url = str(row.url) ?? str(row.path);
      if (!url) return null;
      return { label: str(row.label) ?? str(row.name) ?? "Backing", url, bpm: num(row.bpm) };
    })
    .filter((item): item is Mp3File => item != null);
}

export function normalizeSummary(raw: unknown): PieceSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = str(row.id) ?? str(row.slug);
  const title = str(row.title) ?? str(row.name);
  if (!id || !title) return null;
  return {
    id,
    slug: str(row.slug) ?? id,
    title,
    composer: str(row.composer),
    level: str(row.level) ?? str(row.difficulty),
    isPremium: flag(row.isPremium) || flag(row.premium),
    tempo: num(row.tempo) ?? num(row.bpm),
  };
}

export function normalizePiece(raw: unknown): PieceDetail | null {
  const summary = normalizeSummary(raw);
  if (!summary || !raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  return {
    ...summary,
    tempo: summary.tempo ?? 120,
    description: str(row.description),
    timeSignature: str(row.timeSignature),
    keySignature: str(row.keySignature),
    measuresPerSystem: num(row.measuresPerSystem),
    musicXmlUrl: resolveAssetUrl(str(row.musicXmlUrl) ?? str(row.musicxmlUrl) ?? str(row.musicXml)),
    midiUrl: resolveAssetUrl(str(row.midiUrl) ?? str(row.midi)),
    pdfUrl: resolveAssetUrl(str(row.pdfUrl) ?? str(row.pdf)),
    hasPdf: flag(row.hasPdf) || Boolean(str(row.pdfUrl) ?? str(row.pdf)),
    hasMidi: flag(row.hasMidi) || Boolean(str(row.midiUrl) ?? str(row.midi)),
    mp3Files: mp3Files(row).map((file) => ({ ...file, url: resolveAssetUrl(file.url) ?? file.url })),
  };
}

export function normalizeCollection(raw: unknown, pieceCountHint?: number): Collection | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const slug = str(row.slug) ?? str(row.id);
  const title = str(row.title) ?? str(row.name);
  if (!slug || !title) return null;
  const nested = Array.isArray(row.pieces) ? row.pieces.length : null;
  return {
    id: str(row.id) ?? slug,
    slug,
    title,
    description: str(row.description),
    pieceCount: num(row.pieceCount) ?? num(row.piecesCount) ?? nested ?? pieceCountHint ?? 0,
  };
}

async function fetchJson(path: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${config.apiBase}${path}`, {
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new ApiError("You appear to be offline.", null, "network");
  }
  const text = await response.text();
  const trimmed = text.trim();
  const redirectedToSignIn = response.url.includes("sign-in") || response.url.includes("sign_in");
  if (trimmed.startsWith("<") || redirectedToSignIn) {
    throw new ApiError(
      "The score library isn't available yet. It will come from /api/mobile/academy-studio once that API is deployed.",
      response.status,
      "unavailable",
    );
  }
  if (!response.ok) {
    throw new ApiError(`The score library returned ${response.status}.`, response.status, "http");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError("The score library returned an unexpected response.", response.status, "parse");
  }
}

export async function fetchCollections(): Promise<Collection[]> {
  const data = await fetchJson("/api/mobile/academy-studio/collections");
  return list(data, ["collections", "items"])
    .map((item) => normalizeCollection(item))
    .filter((item): item is Collection => item != null);
}

export async function fetchCollection(idOrSlug: string): Promise<CollectionDetail> {
  const data = await fetchJson(`/api/mobile/academy-studio/collections/${encodeURIComponent(idOrSlug)}`);
  const row = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const pieces = list(row.pieces ? { pieces: row.pieces } : data, ["pieces", "items"])
    .map(normalizeSummary)
    .filter((item): item is PieceSummary => item != null);
  const collection = normalizeCollection(row.collection ?? row, pieces.length);
  if (!collection) throw new ApiError("That collection could not be read.", null, "parse");
  return { collection, pieces };
}

export async function fetchPieces(): Promise<PieceSummary[]> {
  const data = await fetchJson("/api/mobile/academy-studio/pieces");
  return list(data, ["pieces", "items"])
    .map(normalizeSummary)
    .filter((item): item is PieceSummary => item != null);
}

export async function fetchPiece(idOrSlug: string): Promise<PieceDetail> {
  const data = await fetchJson(`/api/mobile/academy-studio/pieces/${encodeURIComponent(idOrSlug)}`);
  const row = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const piece = normalizePiece(row.piece ?? data);
  if (!piece) throw new ApiError("That score could not be read.", null, "parse");
  return piece;
}

/**
 * GET /api/mobile/academy-studio/pieces/{id}/pdf
 * Premium pieces require the RevenueCat app user id.
 */
export async function downloadPiecePdf(pieceId: string, appUserId: string | null, destination: string) {
  const headers: Record<string, string> = { Accept: "application/pdf, application/json" };
  if (appUserId) headers["X-RevenueCat-App-User-Id"] = appUserId;
  const url = `${config.apiBase}/api/mobile/academy-studio/pieces/${encodeURIComponent(pieceId)}/pdf`;
  const dir = destination.slice(0, destination.lastIndexOf("/"));
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
  const result = await FileSystem.downloadAsync(url, destination, { headers });
  if (result.status === 401 || result.status === 403) {
    throw new ApiError("This PDF is part of Piano Academy Pro.", result.status, "http");
  }
  if (result.status < 200 || result.status >= 300) {
    throw new ApiError(`The PDF download returned ${result.status}.`, result.status, "http");
  }
  const type = `${result.headers["Content-Type"] ?? result.headers["content-type"] ?? ""}`;
  if (type.includes("json") || type.includes("text")) {
    const body = JSON.parse(await FileSystem.readAsStringAsync(result.uri)) as { url?: string; pdfUrl?: string };
    const fileUrl = resolveAssetUrl(body.url ?? body.pdfUrl ?? null);
    if (!fileUrl) throw new ApiError("The PDF link was empty.", result.status, "parse");
    const file = await FileSystem.downloadAsync(fileUrl, destination);
    if (file.status < 200 || file.status >= 300) {
      throw new ApiError(`The PDF file returned ${file.status}.`, file.status, "http");
    }
    return file.uri;
  }
  return result.uri;
}

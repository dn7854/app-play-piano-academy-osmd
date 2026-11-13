import { config } from "../config";
import type {
  CollectionDetail,
  CollectionSummary,
  Difficulty,
  FlowSection,
  FlowTile,
  Mp3File,
  PieceCollection,
  PieceDetail,
  PiecePdf,
  PieceSummary,
} from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly kind: "network" | "unavailable" | "http" | "parse" | "purchase",
    readonly code: string | null = null,
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

function difficultyOf(value: unknown): Difficulty {
  if (value === "Beginner" || value === "Intermediate" || value === "Advanced") return value;
  return null;
}

function absolute(value: unknown): string | null {
  const url = str(value);
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return null;
}

async function fetchJson(path: string, headers?: Record<string, string>): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${config.apiBase}${path}`, {
      headers: { Accept: "application/json", ...headers },
    });
  } catch {
    throw new ApiError("You appear to be offline.", null, "network");
  }
  const text = await response.text();
  const trimmed = text.trim();
  if (trimmed.startsWith("<") || response.url.includes("sign-in")) {
    throw new ApiError(
      "The score library isn't available yet. It will come from /api/mobile/academy-studio once that API is deployed.",
      response.status,
      "unavailable",
    );
  }
  let body: unknown = null;
  try {
    body = trimmed ? JSON.parse(text) : null;
  } catch {
    throw new ApiError("The score library returned an unexpected response.", response.status, "parse");
  }
  if (!response.ok) {
    const row = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const code = str(row.code);
    const message = str(row.error) ?? `The score library returned ${response.status}.`;
    const kind = code === "purchase_required" || code === "app_user_id_required" ? "purchase" : "http";
    throw new ApiError(message, response.status, kind, code);
  }
  return body;
}

export function normalizeSummary(raw: unknown): PieceSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = str(row.id);
  const title = str(row.title);
  if (!id || !title) return null;
  const collections = Array.isArray(row.collections)
    ? row.collections.map(normalizeCollectionLink).filter((item): item is PieceCollection => item != null)
    : undefined;
  return {
    id,
    slug: str(row.slug) ?? id,
    title,
    composer: str(row.composer),
    difficulty: difficultyOf(row.difficulty),
    tempo: num(row.tempo) ?? 120,
    timeSignature: str(row.timeSignature) ?? "4/4",
    imageUrl: absolute(row.imageUrl),
    isPremium: flag(row.isPremium),
    hasPdf: flag(row.hasPdf),
    position: num(row.position) ?? undefined,
    collections,
  };
}

function normalizeCollectionLink(raw: unknown): PieceCollection | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = str(row.id);
  const title = str(row.title);
  if (!id || !title) return null;
  return { id, slug: str(row.slug) ?? id, title, position: num(row.position) ?? 0 };
}

function mp3Files(raw: unknown): Mp3File[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const url = absolute(row.url);
      if (!url) return null;
      return {
        id: str(row.id) ?? url,
        label: str(row.label) ?? "Backing",
        bpm: num(row.bpm),
        url,
      };
    })
    .filter((item): item is Mp3File => item != null);
}

export function normalizePiece(raw: unknown): PieceDetail | null {
  const summary = normalizeSummary(raw);
  if (!summary || !raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const pdfRaw = row.pdf && typeof row.pdf === "object" ? (row.pdf as Record<string, unknown>) : {};
  const pdf: PiecePdf = {
    available: flag(pdfRaw.available) || summary.hasPdf,
    requiresPurchase: flag(pdfRaw.requiresPurchase) || summary.isPremium,
    productId: str(pdfRaw.productId) ?? config.productId,
    endpoint: absolute(pdfRaw.endpoint),
  };
  return {
    ...summary,
    description: str(row.description),
    keySignature: str(row.keySignature) ?? "C",
    measuresPerSystem: num(row.measuresPerSystem),
    musicXmlUrl: absolute(row.musicXmlUrl),
    midiUrl: absolute(row.midiUrl),
    hasMusicXml: flag(row.hasMusicXml) || Boolean(absolute(row.musicXmlUrl)),
    hasMidi: flag(row.hasMidi) || Boolean(absolute(row.midiUrl)),
    mp3Files: mp3Files(row.mp3Files),
    pdf,
    collections: summary.collections ?? [],
    updatedAt: str(row.updatedAt),
  };
}

export function normalizeCollection(raw: unknown): CollectionSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = str(row.id);
  const title = str(row.title);
  if (!id || !title) return null;
  const nested = Array.isArray(row.pieces) ? row.pieces.length : null;
  return {
    id,
    slug: str(row.slug) ?? id,
    title,
    description: str(row.description),
    imageUrl: absolute(row.imageUrl),
    pieceCount: num(row.pieceCount) ?? nested ?? 0,
  };
}

export async function fetchCollections(): Promise<CollectionSummary[]> {
  const data = await fetchJson("/api/mobile/academy-studio/collections");
  const row = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const list = Array.isArray(row.collections) ? row.collections : [];
  return list.map(normalizeCollection).filter((item): item is CollectionSummary => item != null);
}

export async function fetchCollection(idOrSlug: string): Promise<CollectionDetail> {
  const data = await fetchJson(`/api/mobile/academy-studio/collections/${encodeURIComponent(idOrSlug)}`);
  const row = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const collectionRaw = row.collection && typeof row.collection === "object" ? (row.collection as Record<string, unknown>) : row;
  const collection = normalizeCollection(collectionRaw);
  if (!collection) throw new ApiError("That collection could not be read.", null, "parse");
  const pieces = (Array.isArray(collectionRaw.pieces) ? collectionRaw.pieces : [])
    .map(normalizeSummary)
    .filter((item): item is PieceSummary => item != null);
  return { ...collection, pieces, pieceCount: collection.pieceCount || pieces.length };
}

function normalizeFlowTile(raw: unknown, index: number): FlowTile | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = str(row.id);
  const piece = normalizeSummary(row.piece);
  if (!id || !piece) return null;
  return { id, position: num(row.position) ?? index, piece };
}

function normalizeFlowSection(raw: unknown, index: number): FlowSection | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = str(row.id);
  const title = str(row.title);
  if (!id || !title) return null;
  const tiles = (Array.isArray(row.tiles) ? row.tiles : [])
    .map(normalizeFlowTile)
    .filter((item): item is FlowTile => item != null)
    .sort((a, b) => a.position - b.position);
  if (!tiles.length) return null;
  return {
    id,
    title,
    description: str(row.description),
    position: num(row.position) ?? index,
    tiles,
  };
}

/** Accepts the flow payload, or anything else, and returns sections in display order. */
export function normalizeFlow(data: unknown): FlowSection[] {
  const row = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const list = Array.isArray(row.sections) ? row.sections : [];
  return list
    .map(normalizeFlowSection)
    .filter((item): item is FlowSection => item != null)
    .sort((a, b) => a.position - b.position);
}

/**
 * The route is not deployed yet when the host answers 404 or sends the sign-in page
 * (the same HTML redirect the other catalog routes use before the API exists).
 */
export function flowEndpointMissing(error: unknown) {
  return error instanceof ApiError && (error.kind === "unavailable" || error.status === 404);
}

/** Published learning path. Uses the same API origin as the catalog. */
export async function fetchFlow(): Promise<FlowSection[]> {
  const data = await fetchJson("/api/mobile/academy-studio/flow");
  return normalizeFlow(data);
}

export async function fetchPieces(): Promise<PieceSummary[]> {
  const data = await fetchJson("/api/mobile/academy-studio/pieces");
  const row = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const list = Array.isArray(row.pieces) ? row.pieces : [];
  return list.map(normalizeSummary).filter((item): item is PieceSummary => item != null);
}

export async function fetchPiece(idOrSlug: string): Promise<PieceDetail> {
  const data = await fetchJson(`/api/mobile/academy-studio/pieces/${encodeURIComponent(idOrSlug)}`);
  const row = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const piece = normalizePiece(row.piece ?? data);
  if (!piece) throw new ApiError("That score could not be read.", null, "parse");
  return piece;
}

/** Premium PDFs need X-RevenueCat-App-User-Id. The body is { pdfUrl, productId }. */
export async function fetchPdfUrl(pieceId: string, appUserId: string | null) {
  const headers: Record<string, string> = {};
  if (appUserId) headers["X-RevenueCat-App-User-Id"] = appUserId;
  const data = await fetchJson(`/api/mobile/academy-studio/pieces/${encodeURIComponent(pieceId)}/pdf`, headers);
  const row = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const pdfUrl = absolute(row.pdfUrl);
  if (!pdfUrl) throw new ApiError("The PDF link was empty.", null, "parse");
  return pdfUrl;
}

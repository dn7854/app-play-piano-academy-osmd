/** Shapes from docs/mobile-academy-studio-api.md. Asset URLs are used as returned. */

export type Difficulty = "Beginner" | "Intermediate" | "Advanced" | null;

export type CollectionSummary = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  pieceCount: number;
};

export type PieceCollection = {
  id: string;
  slug: string;
  title: string;
  position: number;
};

export type PieceSummary = {
  id: string;
  slug: string;
  title: string;
  composer: string | null;
  difficulty: Difficulty;
  tempo: number;
  timeSignature: string;
  imageUrl: string | null;
  isPremium: boolean;
  hasPdf: boolean;
  position?: number;
  collections?: PieceCollection[];
};

export type Mp3File = {
  id: string;
  label: string;
  bpm: number | null;
  url: string;
};

export type PiecePdf = {
  available: boolean;
  requiresPurchase: boolean;
  productId: string;
  endpoint: string | null;
};

export type PieceDetail = PieceSummary & {
  description: string | null;
  keySignature: string;
  measuresPerSystem: number | null;
  musicXmlUrl: string | null;
  midiUrl: string | null;
  hasMusicXml: boolean;
  hasMidi: boolean;
  mp3Files: Mp3File[];
  pdf: PiecePdf;
  collections: PieceCollection[];
  updatedAt: string | null;
};

export type CollectionDetail = CollectionSummary & {
  pieces: PieceSummary[];
};

/** One score placed on the learning path. `id` is the placement, not the piece. */
export type FlowTile = {
  id: string;
  position: number;
  piece: PieceSummary;
};

/** A published section of the learning path. Tiles are already in display order. */
export type FlowSection = {
  id: string;
  title: string;
  description: string | null;
  position: number;
  tiles: FlowTile[];
};

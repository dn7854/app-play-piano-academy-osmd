/** JSON shapes for /api/mobile/academy-studio. Field names follow the academy-studio piece. */

export type Mp3File = {
  label: string;
  url: string;
  bpm: number | null;
};

export type PieceSummary = {
  id: string;
  slug: string;
  title: string;
  composer: string | null;
  level: string | null;
  isPremium: boolean;
  tempo: number | null;
};

export type PieceDetail = PieceSummary & {
  description: string | null;
  tempo: number;
  timeSignature: string | null;
  keySignature: string | null;
  measuresPerSystem: number | null;
  musicXmlUrl: string | null;
  midiUrl: string | null;
  pdfUrl: string | null;
  hasPdf: boolean;
  hasMidi: boolean;
  mp3Files: Mp3File[];
};

export type Collection = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  pieceCount: number;
};

export type CollectionDetail = {
  collection: Collection;
  pieces: PieceSummary[];
};

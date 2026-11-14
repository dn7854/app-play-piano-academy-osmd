export type CoverSource = {
  imageUrl?: string | null;
  pdfThumbnailUrl?: string | null;
};

/**
 * Cover for a library row or a flow tile.
 * `imageUrl` wins. A null cover falls through to the PDF first-page thumbnail.
 * `failed` is a URL that already failed to load, so the next candidate is used.
 */
export function pieceCoverUrl(piece: CoverSource, failed?: string | null): string | null {
  const image = piece.imageUrl || null;
  const thumb = piece.pdfThumbnailUrl || null;
  if (image && image !== failed) return image;
  if (thumb && thumb !== failed) return thumb;
  return null;
}

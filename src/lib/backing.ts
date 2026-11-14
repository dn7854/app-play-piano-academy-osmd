/** Saved side-panel choice. "none" and unknown labels are not used as a default. */
export const BACKING_TRACK_KEY = "d8r-backing-track";

/**
 * Pick a backing group. A saved label wins when this piece still has it.
 * "none", a missing save, or a label from another piece falls back to the
 * first non-piano group, then the first group. Empty stays at None.
 */
export function resolveBackingIndex(labels: readonly string[], saved: string | null | undefined): number {
  if (!labels.length) return -1;
  const wanted = saved?.trim();
  if (wanted && wanted.toLowerCase() !== "none") {
    const found = labels.findIndex((label) => label === wanted);
    if (found >= 0) return found;
  }
  const orchestra = labels.findIndex((label) => !/piano/i.test(label));
  return orchestra >= 0 ? orchestra : 0;
}

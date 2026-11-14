/** Height of the light-saber lane drawn above the keys. */
export const WATERFALL_SABER_PX = 12;

/** Y of the saber core inside a lane whose bottom edge sits on the keys. */
export function waterfallHitY(lane: number, saber = WATERFALL_SABER_PX) {
  if (!(lane > 0)) return 0;
  return Math.max(0, lane - saber / 2);
}

/**
 * Bar box in a lane whose y grows downward. The bottom is clamped to the
 * saber core so a note that has reached the keys never draws through the line.
 */
export function waterfallBar(
  note: { time: number; duration: number },
  scoreTime: number,
  lane: number,
  pixelsPerSecond: number,
  hitY: number,
): { top: number; height: number } | null {
  if (!(lane > 0) || !(hitY > 0) || !(pixelsPerSecond > 0)) return null;
  const rawBottom = lane - (note.time - scoreTime) * pixelsPerSecond;
  const rawHeight = Math.max(4, note.duration * pixelsPerSecond);
  const top = rawBottom - rawHeight;
  const bottom = Math.min(rawBottom, hitY);
  const height = bottom - top;
  if (!(height > 0) || !(bottom > 0)) return null;
  return { top, height };
}

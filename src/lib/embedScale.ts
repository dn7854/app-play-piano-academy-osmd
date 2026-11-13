/**
 * Turns the embed's fit-to-width scale into a scale that also fits the A4 page
 * inside the score slot (above the seek bar, and above the keyboard when it is open).
 * The WebView patch inlines `portraitPageScaleJs`. Keep this the only copy.
 */
export const portraitPageScaleJs = `function portraitPageScale(availW, availH, naturalW, naturalH, widthScale) {
  if (availW < 40 || availH < 40 || naturalW < 40 || !(widthScale > 0)) return null;
  var fitWidth = Math.min(1, availW / naturalW);
  var fitPage = Math.min(fitWidth, availH / naturalH);
  if (fitWidth < 0.05) return null;
  var zoom = widthScale / fitWidth;
  return Math.min(6, fitPage * zoom);
}`;

export function portraitPageScale(
  availW: number,
  availH: number,
  naturalW: number,
  naturalH: number,
  widthScale: number,
): number | null {
  const run = new Function(
    "availW",
    "availH",
    "naturalW",
    "naturalH",
    "widthScale",
    `${portraitPageScaleJs}; return portraitPageScale(availW, availH, naturalW, naturalH, widthScale);`,
  ) as (
    availW: number,
    availH: number,
    naturalW: number,
    naturalH: number,
    widthScale: number,
  ) => number | null;
  return run(availW, availH, naturalW, naturalH, widthScale);
}

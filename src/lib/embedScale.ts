/** Portrait keeps the page fitted to the slot. */
export const PORTRAIT_SCORE_ZOOM = 1;

/**
 * Landscape starts enlarged so the A4 page fills the width of the slot.
 * The slider still wins once the player moves it.
 */
export const LANDSCAPE_SCORE_ZOOM = 1.85;

/**
 * Largest A4 scale that fits the score slot (width and height) above the
 * seek bar and the keyboard. `zoom` is the studio slider (1 = fit the page).
 * The WebView patch inlines `pageContainScaleJs`. Keep this the only copy.
 */
export const pageContainScaleJs = `function pageContainScale(availW, availH, naturalW, naturalH, zoom) {
  if (availW < 40 || availH < 40 || naturalW < 40 || naturalH < 40) return null;
  var z = zoom > 0 ? zoom : 1;
  var fit = Math.min(availW / naturalW, availH / naturalH);
  if (!(fit > 0)) return null;
  return Math.min(6, fit * z);
}`;

export function pageContainScale(
  availW: number,
  availH: number,
  naturalW: number,
  naturalH: number,
  zoom: number,
): number | null {
  const run = new Function(
    "availW",
    "availH",
    "naturalW",
    "naturalH",
    "zoom",
    `${pageContainScaleJs}; return pageContainScale(availW, availH, naturalW, naturalH, zoom);`,
  ) as (
    availW: number,
    availH: number,
    naturalW: number,
    naturalH: number,
    zoom: number,
  ) => number | null;
  return run(availW, availH, naturalW, naturalH, zoom);
}

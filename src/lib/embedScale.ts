/**
 * Scale of one A4 page inside the score slot.
 * `zoom` 1 is the base for the current orientation: fit width in landscape,
 * fit height in portrait. Omit `fit` to contain the whole page (tests).
 * The WebView patch inlines `pageContainScaleJs`. Keep this the only copy.
 */
export const pageContainScaleJs = `function pageContainScale(availW, availH, naturalW, naturalH, zoom, fit) {
  if (availW < 40 || availH < 40 || naturalW < 40 || naturalH < 40) return null;
  var z = zoom > 0 ? zoom : 1;
  var byW = availW / naturalW;
  var byH = availH / naturalH;
  var base = fit === "width" ? byW : fit === "height" ? byH : Math.min(byW, byH);
  if (!(base > 0)) return null;
  return Math.min(6, base * z);
}`;

export type PageFit = "contain" | "width" | "height";

export function pageContainScale(
  availW: number,
  availH: number,
  naturalW: number,
  naturalH: number,
  zoom: number,
  fit: PageFit = "contain",
): number | null {
  const run = new Function(
    "availW",
    "availH",
    "naturalW",
    "naturalH",
    "zoom",
    "fit",
    `${pageContainScaleJs}; return pageContainScale(availW, availH, naturalW, naturalH, zoom, fit);`,
  ) as (
    availW: number,
    availH: number,
    naturalW: number,
    naturalH: number,
    zoom: number,
    fit: PageFit,
  ) => number | null;
  return run(availW, availH, naturalW, naturalH, zoom, fit);
}

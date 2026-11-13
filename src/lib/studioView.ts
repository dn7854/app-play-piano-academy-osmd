/** Same three studio views as academy-studio: score only, score plus keyboard, waterfall. */
export type StudioView = "view" | "score" | "waterfall";

export const STUDIO_VIEWS: { id: StudioView; label: string }[] = [
  { id: "view", label: "Score" },
  { id: "score", label: "Keys" },
  { id: "waterfall", label: "Waterfall" },
];

export function parseStudioView(value: string | null | undefined): StudioView {
  if (value === "view" || value === "score" || value === "waterfall") return value;
  return "score";
}

/** Score-only hides the on-screen keyboard. */
export function showsKeyboard(mode: StudioView) {
  return mode !== "view";
}

/** Waterfall replaces the engraved score with falling notes. */
export function showsScore(mode: StudioView) {
  return mode !== "waterfall";
}

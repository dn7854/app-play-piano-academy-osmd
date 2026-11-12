// lib/preview-limit.ts
//
// Free-preview rule for gated scores: audio may only play from the start of the
// track up to PREVIEW_SECONDS. The rule is purely position-based (the seekbar /
// playhead), so dismissing the paywall modal can never be used to keep playing.

export const PREVIEW_SECONDS = 20;

/** True when playback must be blocked: the score is gated and the playhead is
    at or past the end of the free preview window. */
export const isPreviewLocked = (gated: boolean, time: number): boolean =>
  gated && time >= PREVIEW_SECONDS;


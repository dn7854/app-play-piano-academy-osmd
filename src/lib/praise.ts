/** Same phrases and timing as academy-studio `use-academy-player.ts`. */
export const SUCCESS_PHRASES = ["Perfect!", "On Beat!", "Excellent!", "Bravo!", "Spot on!"] as const;

/** Minimum gap between success toasts. At a practice tempo this is every few notes. */
export const SUCCESS_GAP_MS = 800;

/** How long the green phrase stays on screen. */
export const SUCCESS_HOLD_MS = 700;

/** How long a tap or a microphone hit keeps its key green. MIDI stays green until note-off. */
export const SUCCESS_KEY_MS = 400;

/**
 * The daily check-in moods, and the valence scale Rhythm draws them on.
 *
 * Mood is an ordered sentiment scale, not a set of unrelated labels — swapping
 * "Heavy" and "Bright" would change what a chart means. So colour encodes
 * *valence* on a five-step diverging ramp (indigo ← neutral → amber) rather
 * than giving each of the six moods its own hue: six arbitrary hues in a grid
 * where any two cells can touch cannot be told apart under colour-vision
 * deficiency, and the ramp says something true about the data besides.
 *
 * Two moods share the +1 step. That is deliberate — "Calm" and "Focused" are
 * the same valence — and identity is never lost, because every cell is labelled
 * in its tooltip and every mood has its own row in the table view.
 */

export const MOODS = ["Calm", "Focused", "Tired", "Heavy", "Bright", "Unsure"] as const;

export type DailyMood = (typeof MOODS)[number];

export function isDailyMood(value: string): value is DailyMood {
  return (MOODS as readonly string[]).includes(value);
}

/** −2 (heaviest) … +2 (brightest). 0 is the neutral midpoint. */
export type MoodValence = -2 | -1 | 0 | 1 | 2;

export const MOOD_VALENCE: Record<DailyMood, MoodValence> = {
  Heavy: -2,
  Tired: -1,
  Unsure: 0,
  Calm: 1,
  Focused: 1,
  Bright: 2,
};

/** Moods ordered heaviest → brightest, for legends and the distribution bar. */
export const MOODS_BY_VALENCE: DailyMood[] = [...MOODS].sort(
  (a, b) => MOOD_VALENCE[a] - MOOD_VALENCE[b] || a.localeCompare(b)
);

/**
 * Each step maps to a CSS custom property rather than a literal, so the ramp
 * can be restepped per theme (a fill that reads on dark paper is invisible on
 * light). Both sets are validated for CVD separation and contrast against their
 * own surface — see the `--mood-v*` block in index.css.
 */
export function valenceVar(valence: MoodValence): string {
  return `var(--mood-v${valence < 0 ? "neg" + Math.abs(valence) : valence === 0 ? "0" : "pos" + valence})`;
}

export function moodColor(mood: DailyMood): string {
  return valenceVar(MOOD_VALENCE[mood]);
}

/** Plain-language gloss for the scale's ends, used in the legend. */
export const VALENCE_LABEL: Record<MoodValence, string> = {
  [-2]: "Heavy",
  [-1]: "Low",
  0: "Unsure",
  1: "Settled",
  2: "Bright",
};

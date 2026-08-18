/**
 * Visual mood for the notes workspace. The three blues share the amber accent
 * and differ only in atmosphere; Ember is the one that also moves the accent,
 * to a muted gold, since warmth is the whole point of it.
 */
export type NotesMood = "cobalt" | "midnight" | "harbor" | "ember";

export interface MoodOption {
  id: NotesMood;
  label: string;
  blurb: string;
  /** Solid masthead colour shown in the picker swatch. */
  swatch: string;
}

export const NOTES_MOODS: MoodOption[] = [
  {
    id: "cobalt",
    label: "Cobalt",
    blurb: "Clear blue bar, cool glass desk",
    swatch: "#1d4ed8",
  },
  {
    id: "midnight",
    label: "Midnight",
    blurb: "Deep ink with warmer amber glow",
    swatch: "#1e3a8a",
  },
  {
    id: "harbor",
    label: "Harbor",
    blurb: "Sea-slate glass, rich blue masthead",
    swatch: "#0f4c81",
  },
  {
    id: "ember",
    label: "Ember",
    blurb: "Cream paper, charcoal bar, gold accent",
    swatch: "#1c1c1e",
  },
];

export const DEFAULT_NOTES_MOOD: NotesMood = "cobalt";

export function isNotesMood(value: string | null): value is NotesMood {
  return NOTES_MOODS.some((mood) => mood.id === value);
}

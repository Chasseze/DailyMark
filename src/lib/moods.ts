/** Visual mood for the notes workspace. Amber accent + glass stay in all three. */
export type NotesMood = "cobalt" | "midnight" | "harbor";

export interface MoodOption {
  id: NotesMood;
  label: string;
  blurb: string;
  /** Solid masthead blue shown in the picker swatch. */
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
];

export const DEFAULT_NOTES_MOOD: NotesMood = "cobalt";

export function isNotesMood(value: string | null): value is NotesMood {
  return value === "cobalt" || value === "midnight" || value === "harbor";
}

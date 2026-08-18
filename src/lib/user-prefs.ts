/**
 * Account-backed UI prefs. Source of truth is profiles.prefs — never localStorage.
 */

import { isNotesMood, type NotesMood } from "./moods";
import type { Theme } from "./types";

export type UserPrefs = {
  version: 1;
  theme?: Theme;
  notesMood?: NotesMood;
  focus?: boolean;
  speech?: {
    voiceURI?: string | null;
    rate?: number;
    pitch?: number;
  };
  reminder?: {
    enabled?: boolean;
    time?: string;
  };
};

export const DEFAULT_PREFS: UserPrefs = { version: 1 };

export function normalizePrefs(raw: unknown): UserPrefs {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PREFS };
  const o = raw as Record<string, unknown>;
  const theme =
    o.theme === "dark" || o.theme === "light" || o.theme === "system" ? o.theme : undefined;
  // Validated through isNotesMood so adding a mood cannot leave this behind.
  const notesMood = typeof o.notesMood === "string" && isNotesMood(o.notesMood)
    ? o.notesMood
    : undefined;
  const speech =
    o.speech && typeof o.speech === "object"
      ? (o.speech as UserPrefs["speech"])
      : undefined;
  const reminder =
    o.reminder && typeof o.reminder === "object"
      ? (o.reminder as UserPrefs["reminder"])
      : undefined;
  return {
    version: 1,
    theme,
    notesMood,
    focus: typeof o.focus === "boolean" ? o.focus : undefined,
    speech,
    reminder,
  };
}

export function mergePrefs(base: UserPrefs, patch: Partial<UserPrefs>): UserPrefs {
  return {
    version: 1,
    theme: patch.theme ?? base.theme,
    notesMood: patch.notesMood ?? base.notesMood,
    focus: patch.focus ?? base.focus,
    speech: patch.speech ? { ...base.speech, ...patch.speech } : base.speech,
    reminder: patch.reminder ? { ...base.reminder, ...patch.reminder } : base.reminder,
  };
}

export async function loadUserPrefs(): Promise<UserPrefs> {
  try {
    const { requireSupabase } = await import("./supabase");
    const db = requireSupabase();
    const { data: auth } = await db.auth.getSession();
    if (!auth.session) return { ...DEFAULT_PREFS };
    const { data, error } = await db
      .from("profiles")
      .select("prefs")
      .eq("id", auth.session.user.id)
      .maybeSingle();
    if (error || !data) return { ...DEFAULT_PREFS };
    return normalizePrefs((data as { prefs?: unknown }).prefs);
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export async function saveUserPrefs(prefs: UserPrefs): Promise<void> {
  const { requireSupabase } = await import("./supabase");
  const db = requireSupabase();
  const { data: auth } = await db.auth.getSession();
  const uid = auth.session?.user.id;
  if (!uid) return;
  const prefsJson = prefs as unknown as Record<string, unknown>;
  // Update only prefs so an upsert cannot reset streak / last_visit defaults.
  const { data, error } = await db
    .from("profiles")
    .update({ prefs: prefsJson })
    .eq("id", uid)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (data) return;
  const { error: insertError } = await db.from("profiles").insert({
    id: uid,
    prefs: prefsJson,
  });
  if (insertError) throw insertError;
}

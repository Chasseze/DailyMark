import { requireSupabase } from "./supabase";
import type { NoteRow, NotebookRow, ThoughtSourceRow } from "./database.types";
export type Backup = {
  format: "dailymark";
  version: 1 | 2;
  createdAt: string;
  notebooks: NotebookRow[];
  notes: NoteRow[];
  thoughtSources?: ThoughtSourceRow[];
};
export function parseBackup(raw: string): Backup {
  const data = JSON.parse(raw) as Backup;
  if (
    data?.format !== "dailymark" ||
    ![1, 2].includes(data.version) ||
    !Array.isArray(data.notes) ||
    !Array.isArray(data.notebooks) ||
    data.notes.length > 100000
  )
    throw new Error("Unsupported DailyMark backup.");
  for (const n of data.notes)
    if (
      !n ||
      typeof n.title !== "string" ||
      typeof n.content !== "string" ||
      !Array.isArray(n.tags) ||
      n.tags.some((t) => typeof t !== "string") ||
      typeof n.id !== "string" ||
      (n.notebook_id !== null && typeof n.notebook_id !== "string") ||
      typeof n.is_pinned !== "boolean" ||
      (n.deleted_at !== null && !Number.isFinite(Date.parse(n.deleted_at))) ||
      (n.revisit_at !== null && !Number.isFinite(Date.parse(n.revisit_at)))
    )
      throw new Error("Invalid note in backup.");
  for (const n of data.notebooks)
    if (
      !n ||
      typeof n.id !== "string" ||
      typeof n.name !== "string" ||
      !n.name.trim() ||
      n.name.length > 100 ||
      !/^#[0-9a-f]{6}$/i.test(n.color)
    )
      throw new Error("Invalid notebook in backup.");
  if (
    new Set(data.notes.map((n) => n.id)).size !== data.notes.length ||
    new Set(data.notebooks.map((n) => n.id)).size !== data.notebooks.length
  )
    throw new Error("Duplicate IDs in backup.");
  const noteIds = new Set(data.notes.map((n) => n.id));
  const notebookIds = new Set(data.notebooks.map((n) => n.id));
  if (
    data.notes.some(
      (n) =>
        n.notebook_id && !notebookIds.has(n.notebook_id),
    )
  )
    throw new Error("A notebook is missing from this backup.");
  if (data.version === 2) {
    if (
      !Array.isArray(data.thoughtSources) ||
      data.thoughtSources.length > 100000
    )
      throw new Error("Missing or invalid thought sources.");
    const linkedNotes = new Set<string>();
    for (const s of data.thoughtSources) {
      const t = s?.snapshot;
      if (
        !s ||
        typeof s.thought_id !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.thought_id) ||
        typeof s.captured_at !== "string" ||
        !Number.isFinite(Date.parse(s.captured_at)) ||
        !t ||
        t.id !== s.thought_id ||
        [
          t.title,
          t.content,
          t.author,
          t.source_name,
          t.source_url,
          t.preview,
          t.collection,
          t.published_at,
          t.created_at,
        ].some((v) => typeof v !== "string") ||
        !Array.isArray(t.tags) ||
        t.tags.some((v) => typeof v !== "string") ||
        (s.note_id !== null &&
          (typeof s.note_id !== "string" ||
            !noteIds.has(s.note_id) ||
            linkedNotes.has(s.note_id)))
      )
        throw new Error("Invalid thought source or missing personal note.");
      if (s.note_id) linkedNotes.add(s.note_id);
    }
  }
  return data;
}
export async function exportBackup(
  progress: (text: string) => void,
): Promise<Backup> {
  progress("Preparing a consistent account backup…");
  const { data, error } = await requireSupabase().rpc("export_backup", {});
  if (error) throw error;
  // Validate before offering a download, not only when the file is restored.
  const backup = parseBackup(JSON.stringify(data));
  progress(`Read ${backup.notes.length} notes and their preserved sources.`);
  return backup;
}

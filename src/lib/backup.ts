import { requireSupabase } from "./supabase";
import { readAllPages } from "./pagination";
import type { NoteRow, NotebookRow } from "./database.types";
export type Backup = {
  format: "dailymark";
  version: 1;
  createdAt: string;
  notebooks: NotebookRow[];
  notes: NoteRow[];
};
export function parseBackup(raw: string): Backup {
  const data = JSON.parse(raw) as Backup;
  if (
    data?.format !== "dailymark" ||
    data.version !== 1 ||
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
  if (
    data.notes.some(
      (n) =>
        n.notebook_id && !data.notebooks.some((b) => b.id === n.notebook_id),
    )
  )
    throw new Error("A notebook is missing from this backup.");
  return data;
}
export async function exportBackup(
  progress: (text: string) => void,
): Promise<Backup> {
  const db = requireSupabase();
  progress("Reading notebooks…");
  const books = await readAllPages((a, b) =>
    db.from("notebooks").select("*").order("id").range(a, b),
  );
  if (books.error) throw books.error;
  let count = 0;
  const notes = await readAllPages(async (a, b) => {
    const r = await db.from("notes").select("*").order("id").range(a, b);
    count += r.data?.length ?? 0;
    progress(`Read ${count} notes…`);
    return r;
  }, 100);
  if (notes.error) throw notes.error;
  return {
    format: "dailymark",
    version: 1,
    createdAt: new Date().toISOString(),
    notebooks: books.data,
    notes: notes.data,
  };
}

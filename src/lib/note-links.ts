/**
 * Inbound half of the wiki-link graph.
 *
 * The outbound half is resolved in the browser — every note title is already in
 * memory — but the inbound half needs bodies, and the notes list only carries
 * previews. So this asks the database, via the note_backlinks() function in
 * 0014_linked_desk.sql.
 */

export interface Backlink {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
}

interface BacklinkRow {
  id: string;
  title: string | null;
  preview: string | null;
  updated_at: string;
}

/** Notes whose body links to this one. Empty when offline or unauthenticated. */
export async function listBacklinks(noteId: string): Promise<Backlink[]> {
  try {
    const { requireSupabase } = await import("./supabase");
    const db = requireSupabase();
    const { data: auth } = await db.auth.getSession();
    if (!auth.session) return [];

    const { data, error } = await db.rpc("note_backlinks", { p_note_id: noteId });
    if (error || !data) return [];

    return (data as BacklinkRow[]).map((row) => ({
      id: row.id,
      title: row.title?.trim() || "Untitled",
      preview: row.preview ?? "",
      updatedAt: row.updated_at,
    }));
  } catch {
    // Offline, or the migration has not been applied — the section stays hidden.
    return [];
  }
}

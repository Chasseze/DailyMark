import { requireSupabase } from "./supabase";

function randomToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createNoteShare(userId: string, noteId: string): Promise<string> {
  const db = requireSupabase();
  const token = randomToken();
  const { error } = await db.from("share_tokens").insert({
    user_id: userId,
    token,
    target_type: "note",
    note_id: noteId,
  });
  if (error) throw error;
  return token;
}

export async function createNotebookShare(userId: string, notebookId: string): Promise<string> {
  const db = requireSupabase();
  const token = randomToken();
  const { error } = await db.from("share_tokens").insert({
    user_id: userId,
    token,
    target_type: "notebook",
    notebook_id: notebookId,
  });
  if (error) throw error;
  return token;
}

export async function revokeShare(token: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db
    .from("share_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token", token)
    .is("revoked_at", null);
  if (error) throw error;
}

export type SharedPayload =
  | {
      type: "note";
      title: string;
      content: string;
      tags: string[];
      shared_at: string;
    }
  | {
      type: "notebook";
      title: string;
      shared_at: string;
      notes: Array<{
        title: string;
        content: string;
        tags: string[];
        updated_at: string;
      }>;
    };

export async function fetchSharedContent(token: string): Promise<SharedPayload | null> {
  const db = requireSupabase();
  const { data, error } = await db.rpc("get_shared_content", { p_token: token });
  if (error) throw error;
  if (!data) return null;
  return data as SharedPayload;
}

export function shareUrl(token: string): string {
  return `${window.location.origin}/s/${token}`;
}

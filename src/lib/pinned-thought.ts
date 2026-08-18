/**
 * The pinned "Thought of the week", on its own.
 *
 * ThoughtsContext already derives this, but it is scoped to /thoughts and
 * /daily on purpose — mounting it on the landing page would pull the whole
 * catalog (and the bundled fallback bank) onto the sign-in path, which is
 * exactly what ThoughtsRoutes exists to prevent. Two narrow queries instead.
 */

export interface PinnedThought {
  id: string;
  title: string;
}

export async function loadPinnedThought(): Promise<PinnedThought | null> {
  try {
    const { requireSupabase } = await import("./supabase");
    const db = requireSupabase();
    const { data: auth } = await db.auth.getSession();
    const uid = auth.session?.user.id;
    if (!uid) return null;

    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("pinned_thought_id")
      .eq("id", uid)
      .maybeSingle();
    const id = profileError ? null : profile?.pinned_thought_id ?? null;
    if (!id) return null;

    const { data, error } = await db
      .from("thoughts")
      .select("id,title")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    return { id: data.id, title: data.title };
  } catch {
    // Offline or unconfigured — the card simply does not render.
    return null;
  }
}

import { requireSupabase } from "./supabase";

export type LibraryKind = "thought" | "visual";

export interface LibraryCollection {
  id: string;
  user_id: string;
  name: string;
  kind: LibraryKind;
  created_at: string;
  itemIds: string[];
}

export async function listLibraryCollections(kind: LibraryKind): Promise<LibraryCollection[]> {
  const db = requireSupabase();
  const { data: auth } = await db.auth.getSession();
  if (!auth.session) return [];

  const { data: cols, error } = await db
    .from("library_collections")
    .select("id,user_id,name,kind,created_at")
    .eq("kind", kind)
    .order("created_at");
  if (error || !cols) return [];

  const ids = cols.map((c) => c.id);
  if (ids.length === 0) return [];

  const { data: items } = await db
    .from("library_collection_items")
    .select("collection_id,item_id")
    .in("collection_id", ids);

  const byCol = new Map<string, string[]>();
  for (const row of items ?? []) {
    const list = byCol.get(row.collection_id) ?? [];
    list.push(row.item_id);
    byCol.set(row.collection_id, list);
  }

  return cols.map((c) => ({
    ...c,
    kind: c.kind as LibraryKind,
    itemIds: byCol.get(c.id) ?? [],
  }));
}

export async function createLibraryCollection(
  kind: LibraryKind,
  name: string
): Promise<LibraryCollection> {
  const db = requireSupabase();
  const { data: auth } = await db.auth.getSession();
  const uid = auth.session?.user.id;
  if (!uid) throw new Error("Sign in to create a collection.");

  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name a collection.");

  const { data, error } = await db
    .from("library_collections")
    .insert({ user_id: uid, kind, name: trimmed })
    .select("id,user_id,name,kind,created_at")
    .single();
  if (error) throw error;
  return { ...data, kind: data.kind as LibraryKind, itemIds: [] };
}

export async function deleteLibraryCollection(id: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.from("library_collections").delete().eq("id", id);
  if (error) throw error;
}

export async function addToLibraryCollection(
  collectionId: string,
  itemId: string
): Promise<void> {
  const db = requireSupabase();
  const { error } = await db
    .from("library_collection_items")
    .upsert({ collection_id: collectionId, item_id: itemId });
  if (error) throw error;
}

export async function removeFromLibraryCollection(
  collectionId: string,
  itemId: string
): Promise<void> {
  const db = requireSupabase();
  const { error } = await db
    .from("library_collection_items")
    .delete()
    .eq("collection_id", collectionId)
    .eq("item_id", itemId);
  if (error) throw error;
}

import { useEffect, useState } from "react";
import {
  addToLibraryCollection,
  createLibraryCollection,
  listLibraryCollections,
  removeFromLibraryCollection,
  type LibraryCollection,
  type LibraryKind,
} from "../lib/library-collections";
import { errorMessage } from "../lib/supabase";

interface Props {
  kind: LibraryKind;
  itemId: string;
}

/** Quiet personal collections — shelves you name, synced to the account. */
export default function LibraryCollectionBar({ kind, itemId }: Props) {
  const [collections, setCollections] = useState<LibraryCollection[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    try {
      setCollections(await listLibraryCollections(kind));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  useEffect(() => {
    void reload();
  }, [kind]);

  const toggle = async (col: LibraryCollection) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (col.itemIds.includes(itemId)) {
        await removeFromLibraryCollection(col.id, itemId);
      } else {
        await addToLibraryCollection(col.id, itemId);
      }
      await reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (busy || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const col = await createLibraryCollection(kind, name);
      await addToLibraryCollection(col.id, itemId);
      setName("");
      await reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 border-t border-line pt-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">Your collections</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {collections.map((col) => {
          const on = col.itemIds.includes(itemId);
          return (
            <button
              key={col.id}
              type="button"
              disabled={busy}
              onClick={() => void toggle(col)}
              className={
                "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 " +
                (on
                  ? "bg-accent-soft text-accent-ink"
                  : "bg-surface-2 text-muted hover:text-ink-soft")
              }
            >
              {col.name}
              {on ? "" : " +"}
            </button>
          );
        })}
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="New collection…"
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-ink placeholder-faint focus:border-accent/50 focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink-soft disabled:opacity-50"
        >
          Add
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}

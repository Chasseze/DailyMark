import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listBacklinks, type Backlink } from "../lib/note-links";
import { findBrokenWikiLinks } from "../lib/wiki-links";

interface Props {
  noteId: string;
  /** Bodies are matched server-side; this is only for the outbound broken set. */
  content: string;
  title: string;
  notes: ReadonlyArray<{ title: string }>;
}

/**
 * The inbound side of `[[wiki links]]`, plus the links out of this note that
 * resolve to nothing. Both stay out of the way when there is nothing to say.
 */
export default function BacklinksSection({ noteId, content, title, notes }: Props) {
  const [backlinks, setBacklinks] = useState<Backlink[] | null>(null);

  // Re-runs when the title changes too: renaming a note changes which links
  // resolve to it, so the inbound list is stale the moment the title moves.
  useEffect(() => {
    let active = true;
    void listBacklinks(noteId).then((rows) => {
      if (active) setBacklinks(rows);
    });
    return () => {
      active = false;
    };
  }, [noteId, title]);

  const broken = findBrokenWikiLinks(content, notes);
  if (!backlinks?.length && !broken.length) return null;

  return (
    <div className="mt-8 border-t border-line pt-4">
      {backlinks && backlinks.length > 0 && (
        <>
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Linked from
          </p>
          <ul className="mt-2 space-y-1.5">
            {backlinks.map((link) => (
              <li key={link.id}>
                <Link
                  to={`/notes/${link.id}`}
                  className="block rounded-xl bg-surface-2 px-3 py-2 transition-colors hover:bg-surface-3"
                >
                  <span className="block truncate text-sm font-medium text-ink">
                    {link.title}
                  </span>
                  {link.preview.trim() && (
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      {link.preview}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {broken.length > 0 && (
        <div className={backlinks?.length ? "mt-4" : ""}>
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Links to nothing
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {broken.map((label) => (
              <span
                key={label.toLowerCase()}
                className="rounded-lg bg-danger-soft px-2.5 py-1 text-xs font-medium text-danger"
              >
                {label}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-faint">
            No note carries {broken.length === 1 ? "this title" : "these titles"}. Renaming a
            note breaks the links into it.
          </p>
        </div>
      )}
    </div>
  );
}

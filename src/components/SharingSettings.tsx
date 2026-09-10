import { useEffect, useState } from "react";
import { requireSupabase, errorMessage } from "../lib/supabase";
import { revokeShare, shareUrl } from "../lib/share";
import type { ShareTokenRow } from "../lib/database.types";
export default function SharingSettings() {
  const [rows, setRows] = useState<ShareTokenRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void requireSupabase()
      .from("share_tokens")
      .select("*")
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (active) {
          setRows(data ?? []);
          if (error) setError(error.message);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className="feature-panel glass mb-4 rounded-2xl p-4">
      <h2>Shared links</h2>
      <p className="my-2 text-sm text-muted">
        Anyone with a link can read it. Notebook links include current and
        future notes in that notebook. Revoking a link cannot recall copies
        already downloaded; attachment access expires within one minute.
      </p>
      {error && <p role="alert">{error}</p>}
      {!rows.length && <p className="text-sm">No active links.</p>}
      {rows.map((row) => (
        <div
          key={row.id}
          className="my-3 flex flex-wrap items-center gap-3 border-t border-line pt-3"
        >
          <span>
            {row.target_type} · {new Date(row.created_at).toLocaleDateString()}
          </span>
          <a href={shareUrl(row.token)} target="_blank" rel="noreferrer">
            Preview
          </a>
          <label>
            Expires{" "}
            <input
              aria-label="Link expiry"
              type="date"
              value={row.expires_at?.slice(0, 10) ?? ""}
              onChange={async (e) => {
                const value = e.target.value;
                try {
                  const expires_at = value
                    ? new Date(value + "T23:59:59").toISOString()
                    : null;
                  const { error } = await requireSupabase()
                    .from("share_tokens")
                    .update({ expires_at })
                    .eq("id", row.id);
                  if (error) throw error;
                  setRows((prev) =>
                    prev.map((r) =>
                      r.id === row.id ? { ...r, expires_at } : r,
                    ),
                  );
                } catch (e) {
                  setError(errorMessage(e));
                }
              }}
            />
          </label>
          <button
            type="button"
            onClick={async () => {
              try {
                await revokeShare(row.token);
                setRows((prev) => prev.filter((r) => r.id !== row.id));
              } catch (e) {
                setError(errorMessage(e));
              }
            }}
          >
            Revoke link
          </button>
        </div>
      ))}
    </section>
  );
}

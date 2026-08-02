import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Markdown from "../components/Markdown";
import { fetchSharedContent, type SharedPayload } from "../lib/share";
import { errorMessage } from "../lib/supabase";

export default function SharedView() {
  const { token } = useParams<{ token: string }>();
  const [payload, setPayload] = useState<SharedPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;
    void (async () => {
      try {
        const data = await fetchSharedContent(token);
        if (!active) return;
        if (!data) setError("This share link is missing or was revoked.");
        else setPayload(data);
      } catch (err) {
        if (active) setError(errorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="app-shell min-h-screen px-4 py-8 text-white light:text-slate-900">
      <div className="mx-auto w-full max-w-2xl">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-amber-400/80">
          DailyMark · Shared
        </p>

        {loading && <p className="mt-8 text-sm text-slate-500">Loading…</p>}
        {error && (
          <div className="glass mt-6 rounded-2xl p-5 text-sm text-red-300">{error}</div>
        )}

        {payload?.type === "note" && (
          <article className="note-view__article glass mt-4 rounded-2xl p-5">
            <h1 className="note-title mb-2 text-2xl">{payload.title || "Untitled"}</h1>
            {payload.tags?.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-1.5">
                {payload.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-400"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div className="text-sm leading-relaxed text-slate-300 light:text-slate-700">
              <Markdown>{payload.content}</Markdown>
            </div>
            <p className="mt-8 text-xs text-slate-500">
              Read-only shared note.{" "}
              <Link to="/login" className="text-amber-400 hover:text-amber-300">
                Sign in to DailyMark
              </Link>
            </p>
          </article>
        )}

        {payload?.type === "notebook" && (
          <div className="mt-4 space-y-4">
            <h1 className="page-title text-white light:text-slate-900">{payload.title}</h1>
            <p className="text-sm text-slate-400">Shared notebook · read only</p>
            {payload.notes.length === 0 ? (
              <p className="text-sm text-slate-500">No notes in this notebook.</p>
            ) : (
              payload.notes.map((note, i) => (
                <article key={i} className="note-view__article glass rounded-2xl p-5">
                  <h2 className="note-title mb-2 text-xl">{note.title || "Untitled"}</h2>
                  <div className="text-sm leading-relaxed text-slate-300 light:text-slate-700">
                    <Markdown>{note.content}</Markdown>
                  </div>
                </article>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

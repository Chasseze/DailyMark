import { Outlet, useParams } from "react-router-dom";
import ThoughtsSidebar from "../components/ThoughtsSidebar";

/**
 * Thoughts shell — same single-column list ↔ preview swap as Notes.
 */
export default function ThoughtsWorkspace() {
  const { id } = useParams<{ id?: string }>();
  const pane = id ? "preview" : "list";

  return (
    <div className="notes-workspace" data-pane={pane}>
      <ThoughtsSidebar />
      <section className="notes-preview-pane">
        <Outlet />
      </section>
    </div>
  );
}

export function ThoughtsEmptyPreview() {
  return (
    <div className="notes-empty-preview">
      <div className="glass mb-4 flex h-14 w-14 items-center justify-center rounded-2xl">
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6 text-amber-400"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.5 4.75h5a2 2 0 0 1 2 2v3.5a4.5 4.5 0 0 1-2.2 3.9L14 18.5l-2-.9-2 .9-.3-4.35A4.5 4.5 0 0 1 7.5 10.25v-3.5a2 2 0 0 1 2-2Z"
          />
          <path strokeLinecap="round" d="M10 8.5h4M10.5 11h3" />
        </svg>
      </div>
      <h2 className="text-xl font-bold tracking-tight text-white light:text-slate-900">
        Choose a thought
      </h2>
      <p className="mt-2 max-w-sm text-sm text-slate-400 light:text-slate-500">
        Fresh drops from around the web stay on Live for 2–3 days. Save a piece to
        keep it — it moves into Saved when you bookmark it.
      </p>
    </div>
  );
}

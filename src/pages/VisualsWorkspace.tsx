import { Outlet, useParams } from "react-router-dom";
import VisualsSidebar from "../components/VisualsSidebar";

/**
 * Visuals shell — same single-column list ↔ preview swap as Notes/Thoughts.
 */
export default function VisualsWorkspace() {
  const { id } = useParams<{ id?: string }>();
  const pane = id ? "preview" : "list";

  return (
    <div className="notes-workspace" data-pane={pane}>
      <VisualsSidebar />
      <section className="notes-preview-pane">
        <Outlet />
      </section>
    </div>
  );
}

export function VisualsEmptyPreview() {
  return (
    <div className="notes-empty-preview">
      <div className="glass mb-4 flex h-14 w-14 items-center justify-center rounded-2xl">
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6 text-accent-ink"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          aria-hidden="true"
        >
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <path strokeLinecap="round" strokeLinejoin="round" d="m5.5 16 4-4.2 3 3 3.5-4L18.5 16" />
          <circle cx="9" cy="9.5" r="1.35" />
        </svg>
      </div>
      <h2 className="text-xl font-bold tracking-tight text-ink">
        Choose a picture story
      </h2>
      <p className="mt-2 max-w-sm text-sm text-muted">
        Fresh drops from around the web stay on Live for 2–3 days. Save one to
        keep it — it moves into Saved when you bookmark it.
      </p>
    </div>
  );
}

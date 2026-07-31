import { Outlet, useLocation, useParams } from "react-router-dom";
import NotesSidebar from "../components/NotesSidebar";

/**
 * Notes shell in the same centered column as Daily / Settings.
 * List and preview swap in one column (same rhythm as the other tabs).
 */
export default function NotesWorkspace() {
  const { id } = useParams<{ id?: string }>();
  const location = useLocation();
  const isEditing = location.pathname.endsWith("/edit");
  const pane = id || isEditing ? "preview" : "list";

  return (
    <div className="notes-workspace" data-pane={pane}>
      <NotesSidebar />
      <section className="notes-preview-pane">
        <Outlet />
      </section>
    </div>
  );
}

export function NotesEmptyPreview() {
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
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 3.75h7.5L19 8.25v12a.75.75 0 0 1-.75.75H7.75A.75.75 0 0 1 7 20.25V3.75Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 3.75V8H19M9.5 12h5M9.5 15.5h5" />
        </svg>
      </div>
      <h2 className="text-xl font-bold tracking-tight text-white light:text-slate-900">
        Choose a note
      </h2>
      <p className="mt-2 max-w-sm text-sm text-slate-400 light:text-slate-500">
        Pick a note below to open it here.
      </p>
    </div>
  );
}

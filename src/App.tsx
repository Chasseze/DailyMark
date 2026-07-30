import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import RequireAuth from "./components/RequireAuth";
import SetupNotice from "./components/SetupNotice";
import { NotesProvider } from "./context/NotesContext";
import { isSupabaseConfigured } from "./lib/supabase";

// Route-level code splitting keeps the login shell small; markdown editor and
// notes pages only download when an authenticated session needs them.
const Login = lazy(() => import("./pages/Login"));
const Notes = lazy(() => import("./pages/Notes"));
const NoteView = lazy(() => import("./pages/NoteView"));
const NoteEdit = lazy(() => import("./pages/NoteEdit"));
const Daily = lazy(() => import("./pages/Daily"));
const Settings = lazy(() => import("./pages/Settings"));

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent">
      <span className="text-sm text-slate-500">Loading…</span>
    </div>
  );
}

export default function App() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* NotesProvider sits inside the guard so it only ever fetches with a
            session in hand, and unmounts (dropping its data) on sign-out. */}
        <Route element={<RequireAuth />}>
          <Route
            element={
              <NotesProvider>
                <Layout />
              </NotesProvider>
            }
          >
            <Route path="/" element={<Navigate to="/notes" replace />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/notes/:id" element={<NoteView />} />
            <Route path="/notes/:id/edit" element={<NoteEdit />} />
            <Route path="/daily" element={<Daily />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/notes" replace />} />
      </Routes>
    </Suspense>
  );
}

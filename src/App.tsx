import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import RequireAuth from "./components/RequireAuth";
import SetupNotice from "./components/SetupNotice";
import { FocusProvider } from "./context/FocusContext";
import { NotesProvider } from "./context/NotesContext";
import { isSupabaseConfigured } from "./lib/supabase";

// Route-level code splitting keeps the login shell small; markdown editor and
// notes pages only download when an authenticated session needs them.
const Login = lazy(() => import("./pages/Login"));
const NotesWorkspace = lazy(() => import("./pages/NotesWorkspace"));
const NotesEmptyPreview = lazy(() => import("./pages/NotesEmptyPreview"));
const NoteView = lazy(() => import("./pages/NoteView"));
const NoteEdit = lazy(() => import("./pages/NoteEdit"));
const ThoughtsRoutes = lazy(() => import("./pages/ThoughtsRoutes"));
const ThoughtsWorkspace = lazy(() => import("./pages/ThoughtsWorkspace"));
const ThoughtsEmptyPreview = lazy(() => import("./pages/ThoughtsEmptyPreview"));
const ThoughtView = lazy(() => import("./pages/ThoughtView"));
const Daily = lazy(() => import("./pages/Daily"));
const Rhythm = lazy(() => import("./pages/Rhythm"));
const Settings = lazy(() => import("./pages/Settings"));
const SharedView = lazy(() => import("./pages/SharedView"));

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent">
      <span className="text-sm text-muted">Loading…</span>
    </div>
  );
}

export default function App() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/s/:token" element={<SharedView />} />

        {/* Providers sit inside the guard so they only fetch with a session,
            and unmount (dropping data) on sign-out. */}
        <Route element={<RequireAuth />}>
          <Route
            element={
              <NotesProvider>
                <FocusProvider>
                  <Layout />
                </FocusProvider>
              </NotesProvider>
            }
          >
            <Route path="/" element={<Navigate to="/notes" replace />} />
            <Route path="/notes" element={<NotesWorkspace />}>
              <Route index element={<NotesEmptyPreview />} />
              <Route path=":id" element={<NoteView />} />
              <Route path=":id/edit" element={<NoteEdit />} />
            </Route>
            {/* The thoughts catalog only loads for the two routes that read
                it, instead of on every sign-in. */}
            <Route element={<ThoughtsRoutes />}>
              <Route path="/thoughts" element={<ThoughtsWorkspace />}>
                <Route index element={<ThoughtsEmptyPreview />} />
                <Route path=":id" element={<ThoughtView />} />
              </Route>
              <Route path="/daily" element={<Daily />} />
            </Route>
            <Route path="/rhythm" element={<Rhythm />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/notes" replace />} />
      </Routes>
    </Suspense>
  );
}

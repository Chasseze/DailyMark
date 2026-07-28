import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import RequireAuth from "./components/RequireAuth";
import SetupNotice from "./components/SetupNotice";
import { NotesProvider } from "./context/NotesContext";
import { isSupabaseConfigured } from "./lib/supabase";
import Login from "./pages/Login";
import Notes from "./pages/Notes";
import NoteView from "./pages/NoteView";
import NoteEdit from "./pages/NoteEdit";
import Daily from "./pages/Daily";
import Settings from "./pages/Settings";

export default function App() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  return (
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
  );
}

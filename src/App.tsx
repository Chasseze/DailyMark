import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Notes from "./pages/Notes";
import NoteView from "./pages/NoteView";
import NoteEdit from "./pages/NoteEdit";
import Daily from "./pages/Daily";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/notes" replace />} />
        <Route path="/notes" element={<Notes />} />
        <Route path="/notes/:id" element={<NoteView />} />
        <Route path="/notes/:id/edit" element={<NoteEdit />} />
        <Route path="/daily" element={<Daily />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

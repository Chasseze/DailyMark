const fs = require("fs");
const path = require("path");

const root = __dirname;

function write(relativePath, content) {
  const full = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content.trimStart(), "utf-8");
  console.log("  OK  " + relativePath);
}

// Clean up old starter CSS
const oldCss = path.join(root, "src", "App.css");
if (fs.existsSync(oldCss)) {
  fs.unlinkSync(oldCss);
  console.log("  DEL src/App.css");
}

console.log("");
console.log("Creating project...");
console.log("");

// ─── src/lib/types.ts ───
write("src/lib/types.ts", `
export interface Notebook {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  notebook_id: string | null;
  is_pinned: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface DailyPrompt {
  id: string;
  prompt_text: string;
  type: "quote" | "quiz";
  date: string;
  source: string | null;
  options?: string[];
  correct_answer?: string;
}

export type Theme = "dark" | "light" | "system";
`);

// ─── src/lib/supabase.ts ───
write("src/lib/supabase.ts", `
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const isSupabaseConfigured = () =>
  supabaseUrl.length > 0 && supabaseAnonKey.length > 0;
`);

// ─── src/context/ThemeContext.tsx ───
write("src/context/ThemeContext.tsx", `
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Theme } from "../lib/types";

interface ThemeContextType {
  theme: Theme;
  resolved: "dark" | "light";
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

function getSystemPreference(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem("theme") as Theme | null;
    return stored ?? "system";
  });

  const [systemPref, setSystemPref] = useState(getSystemPreference);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => setSystemPref(getSystemPreference());
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const resolved = theme === "system" ? systemPref : theme;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", resolved === "light");
    root.classList.toggle("dark", resolved === "dark");
  }, [resolved]);

  const setTheme = (t: Theme) => {
    localStorage.setItem("theme", t);
    setThemeState(t);
  };

  const toggle = () => {
    setTheme(resolved === "dark" ? "light" : "dark");
  };

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
`);

// ─── src/context/NotesContext.tsx ───
write("src/context/NotesContext.tsx", `
import {
  createContext, useContext, useState, useCallback, useEffect,
  type ReactNode,
} from "react";
import type { Note, Notebook } from "../lib/types";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

const DEFAULT_NOTEBOOKS: Notebook[] = [
  { id: "inbox", name: "Inbox", color: "#6b7280", created_at: new Date().toISOString() },
  { id: "ideas", name: "Ideas", color: "#f59e0b", created_at: new Date().toISOString() },
  { id: "journal", name: "Journal", color: "#3b82f6", created_at: new Date().toISOString() },
];

interface NotesContextType {
  notes: Note[];
  notebooks: Notebook[];
  addNote: (note: Omit<Note, "id" | "created_at" | "updated_at">) => Note;
  updateNote: (id: string, data: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  togglePin: (id: string) => void;
  addNotebook: (name: string, color: string) => Notebook;
}

const NotesContext = createContext<NotesContextType | null>(null);

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify(data));
}

export function NotesProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<Note[]>(() =>
    loadFromStorage<Note[]>("dailyMark_notes", [])
  );
  const [notebooks, setNotebooks] = useState<Notebook[]>(() =>
    loadFromStorage<Notebook[]>("dailyMark_notebooks", DEFAULT_NOTEBOOKS)
  );

  useEffect(() => { saveToStorage("dailyMark_notes", notes); }, [notes]);
  useEffect(() => { saveToStorage("dailyMark_notebooks", notebooks); }, [notebooks]);

  // Future: Supabase sync
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
  }, []);

  const addNote = useCallback(
    (note: Omit<Note, "id" | "created_at" | "updated_at">) => {
      const now = new Date().toISOString();
      const newNote: Note = { ...note, id: generateId(), created_at: now, updated_at: now };
      setNotes((prev) => [newNote, ...prev]);
      return newNote;
    },
    []
  );

  const updateNote = useCallback((id: string, data: Partial<Note>) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...data, updated_at: new Date().toISOString() } : n))
    );
  }, []);

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const togglePin = useCallback((id: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_pinned: !n.is_pinned } : n))
    );
  }, []);

  const addNotebook = useCallback((name: string, color: string) => {
    const nb: Notebook = { id: generateId(), name, color, created_at: new Date().toISOString() };
    setNotebooks((prev) => [...prev, nb]);
    return nb;
  }, []);

  return (
    <NotesContext.Provider
      value={{ notes, notebooks, addNote, updateNote, deleteNote, togglePin, addNotebook }}
    >
      {children}
    </NotesContext.Provider>
  );
}

export function useNotes() {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error("useNotes must be used within NotesProvider");
  return ctx;
}
`);

// ─── src/components/BottomNav.tsx ───
write("src/components/BottomNav.tsx", `
import { NavLink, useLocation } from "react-router-dom";

const tabs = [
  { to: "/notes", icon: "📝", label: "Notes" },
  { to: "/daily", icon: "✨", label: "Daily" },
  { to: "/settings", icon: "⚙️", label: "Settings" },
];

export default function BottomNav() {
  const location = useLocation();
  const isNoteDetail =
    location.pathname.startsWith("/notes/") && location.pathname !== "/notes";

  if (isNoteDetail) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-white/5">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
        {tabs.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              "flex flex-col items-center gap-0.5 rounded-xl px-5 py-2 text-xs font-medium transition-all duration-200 " +
              (isActive
                ? "text-amber-400 scale-105"
                : "text-slate-500 hover:text-slate-300")
            }
          >
            <span className="text-xl">{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
`);

// ─── src/components/Layout.tsx ───
write("src/components/Layout.tsx", `
import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";

export default function Layout() {
  return (
    <div className="mx-auto min-h-screen max-w-lg bg-slate-950 text-white dark:bg-slate-950 dark:text-white light:bg-white light:text-slate-900">
      <main className="animate-in pb-24">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
`);

// ─── src/components/NoteCard.tsx ───
write("src/components/NoteCard.tsx", `
import type { Note } from "../lib/types";
import { useNotes } from "../context/NotesContext";

interface Props {
  note: Note;
  onClick: () => void;
}

export default function NoteCard({ note, onClick }: Props) {
  const { togglePin, deleteNote } = useNotes();

  const preview = note.content
    .replace(/[#*\`>\\[\\]!\\-]/g, "")
    .slice(0, 120)
    .trim();

  const date = new Date(note.updated_at).toLocaleDateString(undefined, {
    month: "short", day: "numeric",
  });

  return (
    <div
      onClick={onClick}
      className="group glass rounded-2xl p-4 cursor-pointer transition-all duration-200 hover:scale-[1.01] hover:border-amber-500/20 active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-white light:text-slate-900">
            {note.title || "Untitled"}
          </h3>
          <p className="mt-1 line-clamp-2 text-xs text-slate-400 light:text-slate-500">
            {preview || "No content yet"}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] text-slate-500">{date}</span>
            {note.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400">
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={(e) => { e.stopPropagation(); togglePin(note.id); }}
            className={
              "rounded-lg p-1 text-sm transition-colors hover:bg-white/10 " +
              (note.is_pinned ? "text-amber-400" : "text-slate-500")
            }
            title={note.is_pinned ? "Unpin" : "Pin"}
          >
            📌
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); if (confirm("Delete this note?")) deleteNote(note.id); }}
            className="rounded-lg p-1 text-sm text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
            title="Delete"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
}
`);

// ─── src/components/MarkdownEditor.tsx ───
write("src/components/MarkdownEditor.tsx", `
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  content: string;
  onChange: (content: string) => void;
}

export default function MarkdownEditor({ content, onChange }: Props) {
  const [mode, setMode] = useState<"write" | "preview" | "split">("write");

  return (
    <div>
      <div className="mb-3 flex gap-1 rounded-xl bg-slate-800/50 p-1 light:bg-slate-100">
        {(["write", "preview", "split"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={
              "flex-1 rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-all " +
              (mode === m
                ? "bg-amber-500/20 text-amber-400"
                : "text-slate-400 hover:text-slate-200 light:hover:text-slate-700")
            }
          >
            {m}
          </button>
        ))}
      </div>

      <div className={mode === "split" ? "grid grid-cols-1 gap-4 md:grid-cols-2" : "block"}>
        {(mode === "write" || mode === "split") && (
          <div className={mode === "split" ? "min-h-[300px]" : ""}>
            <textarea
              value={content}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Start writing in Markdown..."
              className="editor-textarea w-full rounded-2xl border border-white/5 bg-slate-900/50 p-4 text-sm text-white placeholder-slate-500 focus:border-amber-500/30 focus:outline-none light:border-slate-200 light:bg-slate-50 light:text-slate-900 light:placeholder-slate-400"
            />
          </div>
        )}
        {(mode === "preview" || mode === "split") && (
          <div className="prose-custom rounded-2xl border border-white/5 bg-slate-900/30 p-4 text-sm text-slate-300 light:border-slate-200 light:bg-slate-50 light:text-slate-700">
            {content.trim() ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            ) : (
              <p className="text-slate-500 italic">Preview will appear here...</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
`);

// ─── src/pages/Notes.tsx ───
write("src/pages/Notes.tsx", `
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useNotes } from "../context/NotesContext";
import NoteCard from "../components/NoteCard";

const COLORS = ["#f59e0b", "#3b82f6", "#ef4444", "#10b981", "#8b5cf6", "#ec4899"];

export default function Notes() {
  const { notes, notebooks, addNote, addNotebook } = useNotes();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeNotebook, setActiveNotebook] = useState<string | null>(null);
  const [showNewNotebook, setShowNewNotebook] = useState(false);
  const [newNbName, setNewNbName] = useState("");
  const [newNbColor, setNewNbColor] = useState(COLORS[0]);

  const filtered = useMemo(() => {
    let list = notes;
    if (activeNotebook) list = list.filter((n) => n.notebook_id === activeNotebook);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return [...list].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [notes, activeNotebook, search]);

  const handleQuickNote = () => {
    const note = addNote({ title: "", content: "", notebook_id: activeNotebook, is_pinned: false, tags: [] });
    navigate("/notes/" + note.id + "/edit");
  };

  const handleCreateNotebook = () => {
    if (!newNbName.trim()) return;
    addNotebook(newNbName.trim(), newNbColor);
    setNewNbName("");
    setShowNewNotebook(false);
  };

  return (
    <div className="px-4 pt-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white light:text-slate-900">My Notes</h1>
        <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
          {notes.length} note{notes.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="relative mb-4">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notes..."
          className="w-full rounded-xl border border-white/5 bg-slate-900/50 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-amber-500/30 focus:outline-none light:border-slate-200 light:bg-slate-50 light:text-slate-900"
        />
      </div>

      <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveNotebook(null)}
          className={
            "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all " +
            (!activeNotebook
              ? "bg-amber-500/20 text-amber-400"
              : "bg-slate-800/50 text-slate-400 hover:text-slate-200 light:bg-slate-100 light:text-slate-500")
          }
        >
          All
        </button>
        {notebooks.map((nb) => (
          <button
            key={nb.id}
            onClick={() => setActiveNotebook(nb.id)}
            className={
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all " +
              (activeNotebook === nb.id
                ? "bg-amber-500/20 text-amber-400"
                : "bg-slate-800/50 text-slate-400 hover:text-slate-200 light:bg-slate-100 light:text-slate-500")
            }
          >
            <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: nb.color }} />
            {nb.name}
          </button>
        ))}
        <button
          onClick={() => setShowNewNotebook(!showNewNotebook)}
          className="shrink-0 rounded-full bg-slate-800/50 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 light:bg-slate-100 light:text-slate-500"
        >
          + Add
        </button>
      </div>

      {showNewNotebook && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-slate-800/30 p-3 light:bg-slate-100">
          <input
            type="text" value={newNbName} onChange={(e) => setNewNbName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateNotebook()}
            placeholder="Notebook name..."
            className="flex-1 rounded-lg border border-white/5 bg-slate-900/50 px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none light:border-slate-300 light:bg-white light:text-slate-900"
          />
          <div className="flex gap-1">
            {COLORS.map((c) => (
              <button
                key={c} onClick={() => setNewNbColor(c)}
                className={
                  "h-6 w-6 rounded-full border-2 transition-all " +
                  (newNbColor === c ? "border-white scale-110" : "border-transparent")
                }
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button onClick={handleCreateNotebook} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-black">
            Create
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="mt-12 text-center">
          <span className="text-4xl">📄</span>
          <p className="mt-3 text-sm text-slate-500">
            {search ? "No notes match your search" : "No notes yet"}
          </p>
          <button onClick={handleQuickNote} className="mt-3 rounded-full bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-400 hover:bg-amber-500/20">
            Create your first note
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((note) => (
            <NoteCard key={note.id} note={note} onClick={() => navigate("/notes/" + note.id)} />
          ))}
        </div>
      )}

      <button
        onClick={handleQuickNote}
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/20 transition-all hover:scale-105 active:scale-95 md:right-[calc(50%-28rem)]"
      >
        <span className="text-2xl">+</span>
      </button>
    </div>
  );
}
`);

// ─── src/pages/NoteView.tsx ───
write("src/pages/NoteView.tsx", `
import { useParams, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useNotes } from "../context/NotesContext";

export default function NoteView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { notes, deleteNote, togglePin } = useNotes();
  const note = notes.find((n) => n.id === id);

  if (!note) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <span className="text-4xl">🔍</span>
        <p className="mt-3 text-slate-400">Note not found</p>
        <button onClick={() => navigate("/notes")} className="mt-4 text-sm text-amber-400">
          ← Back to notes
        </button>
      </div>
    );
  }

  const date = new Date(note.updated_at).toLocaleDateString(undefined, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="animate-in px-4 pt-4">
      <div className="mb-4 flex items-center gap-2">
        <button onClick={() => navigate("/notes")}
          className="rounded-xl p-2 text-slate-400 hover:bg-slate-800/50 hover:text-white light:hover:bg-slate-100 light:hover:text-slate-900">
          ←
        </button>
        <div className="flex-1" />
        <button onClick={() => togglePin(note.id)}
          className={
            "rounded-xl p-2 text-sm transition-colors hover:bg-white/10 " +
            (note.is_pinned ? "text-amber-400" : "text-slate-500")
          }>
          📌
        </button>
        <button onClick={() => navigate("/notes/" + note.id + "/edit")}
          className="rounded-xl p-2 text-sm text-slate-400 hover:bg-slate-800/50 hover:text-white light:hover:bg-slate-100">
          ✏️
        </button>
        <button onClick={() => { if (confirm("Delete this note?")) { deleteNote(note.id); navigate("/notes"); } }}
          className="rounded-xl p-2 text-sm text-slate-500 hover:bg-red-500/10 hover:text-red-400">
          🗑️
        </button>
      </div>

      <article>
        <h1 className="mb-1 text-2xl font-bold text-white light:text-slate-900">
          {note.title || "Untitled"}
        </h1>
        <p className="mb-4 text-xs text-slate-500">{date}</p>

        {note.tags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {note.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-400">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="prose-custom mt-4 text-sm leading-relaxed text-slate-300 light:text-slate-700">
          {note.content.trim() ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content}</ReactMarkdown>
          ) : (
            <p className="italic text-slate-500">This note is empty. Tap edit to add content.</p>
          )}
        </div>
      </article>
    </div>
  );
}
`);

// ─── src/pages/NoteEdit.tsx ───
write("src/pages/NoteEdit.tsx", `
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useNotes } from "../context/NotesContext";
import MarkdownEditor from "../components/MarkdownEditor";

export default function NoteEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { notes, notebooks, updateNote } = useNotes();
  const note = notes.find((n) => n.id === id);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [notebookId, setNotebookId] = useState<string | null>(null);

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setTags(note.tags);
      setNotebookId(note.notebook_id);
    }
  }, [note]);

  if (!note) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-slate-400">Note not found</p>
      </div>
    );
  }

  const handleSave = () => {
    updateNote(note.id, { title, content, tags, notebook_id: notebookId });
    navigate("/notes/" + note.id);
  };

  const handleGoBack = () => {
    if (title.trim() || content.trim()) {
      handleSave();
    } else {
      navigate("/notes/" + note.id);
    }
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase().replace(/\\s+/g, "-");
    if (tag && !tags.includes(tag)) setTags([...tags, tag]);
    setTagInput("");
  };

  return (
    <div className="animate-in px-4 pt-4">
      <div className="mb-4 flex items-center gap-3">
        <button onClick={handleGoBack}
          className="rounded-xl p-2 text-slate-400 hover:bg-slate-800/50 hover:text-white light:hover:bg-slate-100 light:hover:text-slate-900">
          ←
        </button>
        <div className="flex-1" />
        <button onClick={handleSave}
          className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2 text-sm font-semibold text-black transition-all hover:scale-105 active:scale-95">
          Save
        </button>
      </div>

      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
        placeholder="Note title..."
        className="mb-3 w-full bg-transparent text-xl font-bold text-white placeholder-slate-600 focus:outline-none light:text-slate-900 light:placeholder-slate-300"
      />

      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs text-slate-500">Notebook:</span>
        <select value={notebookId ?? ""} onChange={(e) => setNotebookId(e.target.value || null)}
          className="rounded-lg border border-white/5 bg-slate-800/50 px-2 py-1 text-xs text-slate-300 focus:outline-none light:border-slate-200 light:bg-slate-100 light:text-slate-700">
          <option value="">None</option>
          {notebooks.map((nb) => (
            <option key={nb.id} value={nb.id}>{nb.name}</option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-400">
              {tag}
              <button onClick={() => setTags(tags.filter((t) => t !== tag))}
                className="ml-0.5 text-amber-500 hover:text-red-400">×</button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
            placeholder="Add tag..."
            className="flex-1 rounded-lg border border-white/5 bg-slate-800/50 px-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none light:border-slate-200 light:bg-slate-100 light:text-slate-900"
          />
          <button onClick={addTag}
            className="rounded-lg bg-slate-800/50 px-3 py-1 text-xs text-slate-400 hover:text-white light:bg-slate-100 light:hover:text-slate-900">
            Add
          </button>
        </div>
      </div>

      <MarkdownEditor content={content} onChange={setContent} />
    </div>
  );
}
`);

// ─── src/pages/Daily.tsx ───
write("src/pages/Daily.tsx", `
import { useState, useEffect, useMemo } from "react";

interface DailyItem {
  id: string;
  type: "quote" | "quiz";
  text: string;
  source: string;
  options?: string[];
  answer?: string;
}

const PROMPTS: DailyItem[] = [
  { id: "1", type: "quote", text: "The only way to do great work is to love what you do.", source: "Steve Jobs" },
  { id: "2", type: "quiz", text: "Which philosopher said 'I think, therefore I am'?", source: "Philosophy", options: ["Plato", "René Descartes", "Aristotle", "Socrates"], answer: "René Descartes" },
  { id: "3", type: "quote", text: "Simplicity is the ultimate sophistication.", source: "Leonardo da Vinci" },
  { id: "4", type: "quiz", text: "What is the capital of Japan?", source: "Geography", options: ["Seoul", "Beijing", "Tokyo", "Bangkok"], answer: "Tokyo" },
  { id: "5", type: "quote", text: "Stay hungry, stay foolish.", source: "Steve Jobs" },
  { id: "6", type: "quote", text: "The journey of a thousand miles begins with a single step.", source: "Lao Tzu" },
  { id: "7", type: "quiz", text: "In which year did World War II end?", source: "History", options: ["1943", "1944", "1945", "1946"], answer: "1945" },
];

function getTodayIndex(total: number) {
  return Math.floor((Date.now() - new Date(2026, 6, 1).getTime()) / 86400000) % total;
}

export default function Daily() {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [streak, setStreak] = useState(() => Number(localStorage.getItem("dailyMark_streak") ?? 0));

  const today = useMemo(() => PROMPTS[getTodayIndex(PROMPTS.length)], []);

  useEffect(() => { setSelectedAnswer(null); }, [today.id]);

  useEffect(() => {
    const todayDate = new Date().toDateString();
    const lastVisit = localStorage.getItem("dailyMark_lastVisit");
    if (lastVisit !== todayDate) {
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      const newStreak = lastVisit === yesterday ? streak + 1 : 1;
      localStorage.setItem("dailyMark_streak", String(newStreak));
      localStorage.setItem("dailyMark_lastVisit", todayDate);
      setStreak(newStreak);
    }
  }, []);

  const isCorrect = selectedAnswer === today.answer;

  return (
    <div className="animate-in px-4 pt-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white light:text-slate-900">Daily Spark</h1>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
            {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5">
          <span className="text-lg">🔥</span>
          <span className="text-sm font-bold text-amber-400">{streak}</span>
        </div>
      </div>

      <div className="glass rounded-3xl p-6">
        <span className="inline-block rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
          {today.type === "quote" ? "💬 Quote of the Day" : "🧠 Daily Quiz"}
        </span>
        <p className="mt-4 text-lg leading-relaxed text-white light:text-slate-900">{today.text}</p>

        {today.type === "quote" && (
          <p className="mt-3 text-sm text-slate-400">— {today.source}</p>
        )}

        {today.type === "quiz" && today.options && (
          <div className="mt-5 space-y-2">
            {today.options.map((opt) => {
              let cls = "w-full rounded-xl border px-4 py-3 text-left text-sm transition-all ";
              if (!selectedAnswer) {
                cls += "border-white/5 bg-slate-800/30 text-slate-300 hover:border-amber-500/30 hover:bg-slate-800/50 light:border-slate-200 light:bg-slate-50 light:text-slate-700";
              } else if (opt === today.answer) {
                cls += "border-green-500/30 bg-green-500/10 text-green-400";
              } else if (opt === selectedAnswer && !isCorrect) {
                cls += "border-red-500/30 bg-red-500/10 text-red-400";
              } else {
                cls += "border-white/5 bg-slate-800/20 text-slate-600 light:border-slate-200 light:bg-slate-50";
              }
              return (
                <button key={opt} onClick={() => !selectedAnswer && setSelectedAnswer(opt)}
                  disabled={!!selectedAnswer} className={cls}>
                  {opt}
                </button>
              );
            })}
          </div>
        )}

        {selectedAnswer && (
          <div className={
            "mt-4 rounded-xl p-3 text-sm font-medium " +
            (isCorrect ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400")
          }>
            {isCorrect ? "✅ Correct! Well done." : "❌ Not quite. The answer is: " + today.answer}
          </div>
        )}
      </div>

      {today.type === "quote" && (
        <div className="mt-4 glass rounded-2xl p-4">
          <p className="text-sm text-slate-400 light:text-slate-500">
            What does this quote mean to you? <span className="text-amber-400">Jot it down →</span>
          </p>
        </div>
      )}
    </div>
  );
}
`);

// ─── src/pages/Settings.tsx ───
write("src/pages/Settings.tsx", `
import { useTheme } from "../context/ThemeContext";
import { useNotes } from "../context/NotesContext";
import type { Theme } from "../lib/types";

export default function Settings() {
  const { theme, resolved, setTheme, toggle } = useTheme();
  const { notes, notebooks } = useNotes();

  return (
    <div className="animate-in px-4 pt-6">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-white light:text-slate-900">Settings</h1>

      <div className="glass mb-4 rounded-2xl p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-300 light:text-slate-700">Appearance</h2>
        <div className="flex gap-2">
          {(["dark", "light", "system"] as Theme[]).map((t) => (
            <button key={t} onClick={() => setTheme(t)}
              className={
                "flex-1 rounded-xl px-4 py-3 text-sm font-medium capitalize transition-all " +
                (theme === t
                  ? "bg-amber-500/20 text-amber-400"
                  : "bg-slate-800/30 text-slate-400 hover:text-slate-200 light:bg-slate-100 light:text-slate-500 light:hover:text-slate-700")
              }>
              {t === "dark" && "🌙 "}{t === "light" && "☀️ "}{t === "system" && "💻 "}{t}
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-slate-500">Quick toggle</span>
          <button onClick={toggle} className="relative h-7 w-12 rounded-full bg-slate-700 transition-colors light:bg-slate-300">
            <div className={
              "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all " +
              (resolved === "dark" ? "left-0.5" : "left-[calc(100%-1.625rem)]")
            } />
          </button>
        </div>
      </div>

      <div className="glass mb-4 rounded-2xl p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-300 light:text-slate-700">Stats</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-800/30 p-3 light:bg-slate-100">
            <p className="text-2xl font-bold text-white light:text-slate-900">{notes.length}</p>
            <p className="text-xs text-slate-500">Notes</p>
          </div>
          <div className="rounded-xl bg-slate-800/30 p-3 light:bg-slate-100">
            <p className="text-2xl font-bold text-white light:text-slate-900">{notebooks.length}</p>
            <p className="text-xs text-slate-500">Notebooks</p>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-300 light:text-slate-700">About</h2>
        <p className="text-xs leading-relaxed text-slate-500">
          DailyMark — A minimal note-taking app with daily prompts. Built with React, TailwindCSS, and Supabase.
        </p>
        <p className="mt-2 text-xs text-slate-600">v1.0.0</p>
      </div>
    </div>
  );
}
`);

// ─── src/main.tsx ───
write("src/main.tsx", `
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { NotesProvider } from "./context/NotesContext";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <NotesProvider>
          <App />
        </NotesProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);
`);

// ─── src/App.tsx ───
write("src/App.tsx", `
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
`);

// ─── src/index.css ───
write("src/index.css", `
@import "tailwindcss";

@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}

html {
  scroll-behavior: smooth;
  -webkit-tap-highlight-color: transparent;
}

::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: oklch(0.55 0.02 260 / 0.3);
  border-radius: 999px;
}

.glass {
  background: oklch(0.35 0.02 260 / 0.6);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid oklch(1 0 0 / 0.08);
}
:root.light .glass {
  background: oklch(1 0 0 / 0.7);
  border: 1px solid oklch(0 0 0 / 0.06);
}

.prose-custom h1 { font-size: 1.5rem; font-weight: 700; margin: 1.5rem 0 0.75rem; letter-spacing: -0.02em; }
.prose-custom h2 { font-size: 1.25rem; font-weight: 600; margin: 1.25rem 0 0.5rem; }
.prose-custom h3 { font-size: 1.1rem; font-weight: 600; margin: 1rem 0 0.5rem; }
.prose-custom p { margin-bottom: 0.75rem; line-height: 1.75; }
.prose-custom ul, .prose-custom ol { padding-left: 1.5rem; margin-bottom: 0.75rem; }
.prose-custom li { margin-bottom: 0.25rem; }
.prose-custom code {
  background: oklch(0.3 0.02 260 / 0.5);
  padding: 0.15rem 0.4rem; border-radius: 0.35rem; font-size: 0.875em;
}
:root.light .prose-custom code { background: oklch(0.95 0.01 260 / 0.8); }
.prose-custom pre {
  background: oklch(0.2 0.02 260 / 0.8);
  padding: 1rem; border-radius: 0.75rem; overflow-x: auto; margin-bottom: 1rem;
}
.prose-custom pre code { background: none; padding: 0; }
.prose-custom blockquote {
  border-left: 3px solid oklch(0.75 0.15 85);
  padding-left: 1rem; font-style: italic; margin: 1rem 0; color: oklch(0.7 0.02 260);
}
.prose-custom a { color: oklch(0.75 0.15 85); text-decoration: underline; }
.prose-custom hr { border: none; border-top: 1px solid oklch(0.4 0.02 260); margin: 1.5rem 0; }
.prose-custom table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
.prose-custom th, .prose-custom td {
  border: 1px solid oklch(0.4 0.02 260); padding: 0.5rem 0.75rem; text-align: left;
}
.prose-custom th { background: oklch(0.3 0.02 260 / 0.5); }

.editor-textarea { field-sizing: content; resize: none; min-height: 200px; }

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-in { animation: fadeInUp 0.3s ease-out; }

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 0 0 oklch(0.75 0.15 85 / 0.4); }
  50% { box-shadow: 0 0 0 8px oklch(0.75 0.15 85 / 0); }
}
.pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
`);

console.log("");
console.log("Done! All files written.");
console.log("Run: npm run dev");
console.log("");
import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../context/theme-context";
import { useMood } from "../context/mood-context";
import { useNotes } from "../context/notes-context";
import { useAuth } from "../context/auth-context";
import { useSpeechControls } from "../context/speech-context";
import { useStreak } from "../hooks/useStreak";
import {
  PITCH_MAX,
  PITCH_MIN,
  RATE_MAX,
  RATE_MIN,
  RATE_STEP,
  describeLanguage,
  normalizeLang,
  voiceLanguages,
  voicesForLanguage,
} from "../lib/speech";
import { NOTES_MOODS } from "../lib/moods";
import {
  downloadText,
  noteToMarkdown,
  parseImportedMarkdown,
  safeFilename,
} from "../lib/notes-io";
import {
  ensureNotificationPermission,
  loadReminderPrefs,
  saveReminderPrefs,
  type ReminderPrefs,
} from "../lib/reminders";
import { errorMessage } from "../lib/supabase";
import type { Theme } from "../lib/types";

const SAMPLE = "This is how DailyMark will sound when it reads your notes aloud.";

export default function Settings() {
  const { theme, resolved, setTheme, toggle } = useTheme();
  const { mood, setMood } = useMood();
  const { notes, trash, notebooks, addNote, ensureNote } = useNotes();
  const { user, signOut } = useAuth();
  const { streak } = useStreak();
  const speech = useSpeechControls();
  const [signingOut, setSigningOut] = useState(false);
  const [ioBusy, setIoBusy] = useState(false);
  const [ioMessage, setIoMessage] = useState<string | null>(null);
  const [ioError, setIoError] = useState<string | null>(null);
  const [reminder, setReminder] = useState<ReminderPrefs>(() => loadReminderPrefs());
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    saveReminderPrefs(reminder);
  }, [reminder]);

  const locale = typeof navigator !== "undefined" ? navigator.language : "en-US";
  const languages = useMemo(() => voiceLanguages(speech.voices, locale), [speech.voices, locale]);

  // Voices are picked language-first: a phone exposes a dozen, a Linux box with
  // espeak-ng exposes thousands, and one flat list is unusable at that size.
  const [pickedLang, setPickedLang] = useState<string | null>(null);
  const chosenVoice = speech.prefs.voiceURI
    ? speech.voices.find((voice) => voice.voiceURI === speech.prefs.voiceURI)
    : undefined;
  const language = chosenVoice
    ? normalizeLang(chosenVoice.lang)
    : pickedLang ?? languages[0] ?? "";
  const langVoices = useMemo(
    () => voicesForLanguage(speech.voices, language),
    [speech.voices, language]
  );

  const selectLanguage = (next: string) => {
    setPickedLang(next);
    // Landing on "System default" after choosing a language would ignore it, so
    // the first voice of that language is selected instead.
    speech.setVoiceURI(voicesForLanguage(speech.voices, next)[0]?.voiceURI ?? null);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      // The auth listener clears the session, which sends RequireAuth to
      // /login and unmounts NotesProvider along with its data.
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  const exportAll = async () => {
    setIoBusy(true);
    setIoError(null);
    setIoMessage(null);
    try {
      const parts: string[] = [];
      for (const note of notes) {
        const full = note.bodyLoaded ? note : await ensureNote(note.id);
        if (!full) continue;
        parts.push(noteToMarkdown(full));
        parts.push("\n\n---\n\n");
      }
      downloadText(
        `dailymark-notes-${new Date().toISOString().slice(0, 10)}.md`,
        parts.join("").trim() + "\n"
      );
      setIoMessage(`Exported ${notes.length} note${notes.length === 1 ? "" : "s"}.`);
    } catch (err) {
      setIoError(errorMessage(err));
    } finally {
      setIoBusy(false);
    }
  };

  const importFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setIoBusy(true);
    setIoError(null);
    setIoMessage(null);
    let count = 0;
    try {
      for (const file of [...files]) {
        const raw = await file.text();
        const fallback = file.name.replace(/\.md$/i, "") || "Imported note";
        const parsed = parseImportedMarkdown(raw, fallback);
        await addNote({
          title: parsed.title,
          content: parsed.content,
          notebook_id: null,
          is_pinned: false,
          tags: parsed.tags,
        });
        count += 1;
      }
      setIoMessage(`Imported ${count} note${count === 1 ? "" : "s"}.`);
    } catch (err) {
      setIoError(errorMessage(err));
    } finally {
      setIoBusy(false);
    }
  };

  const toggleReminder = async (enabled: boolean) => {
    if (enabled) {
      const permission = await ensureNotificationPermission();
      if (permission !== "granted") {
        setIoError("Notifications are blocked in this browser.");
        setReminder((prev) => ({ ...prev, enabled: false }));
        return;
      }
    }
    setReminder((prev) => ({ ...prev, enabled }));
  };

  return (
    <div className="animate-in px-4 pt-6">
      <h1 className="page-title mb-6 text-white light:text-slate-900">Settings</h1>

      <div className="glass mb-4 rounded-2xl p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-300 light:text-slate-700">Account</h2>
        <p className="truncate text-sm text-white light:text-slate-900">{user?.email}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Notes sync to Supabase and follow you across devices.
        </p>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="mt-3 w-full rounded-xl bg-slate-800/30 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50 light:bg-slate-100 light:text-slate-600"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>

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
              {t}
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

        <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Notes mood
        </h3>
        <p className="mb-2 text-[11px] leading-relaxed text-slate-500">
          Compare three palette directions — amber accent and glass stay in all of them.
        </p>
        <div className="space-y-2">
          {NOTES_MOODS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setMood(option.id)}
              className={
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors " +
                (mood === option.id
                  ? "bg-amber-500/15 text-amber-400"
                  : "bg-slate-800/30 text-slate-400 hover:text-slate-200 light:bg-slate-100 light:text-slate-600")
              }
            >
              <span
                className="h-8 w-8 shrink-0 rounded-lg shadow-inner ring-1 ring-white/15"
                style={{ backgroundColor: option.swatch }}
                aria-hidden="true"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-white light:text-slate-900">
                  {option.label}
                </span>
                <span className="block text-[11px] text-slate-500">{option.blurb}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="glass mb-4 rounded-2xl p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-300 light:text-slate-700">Read aloud</h2>
        {!speech.supported ? (
          <p className="text-xs leading-relaxed text-slate-500">
            This browser has no speech synthesis, so the listen buttons are hidden. Chrome, Edge and
            Safari can read notes aloud.
          </p>
        ) : (
          <>
            <p className="mb-3 text-xs text-slate-500">
              Notes are spoken by your device — no audio leaves the browser.
            </p>

            {speech.voices.length === 0 ? (
              <p className="text-[11px] text-slate-500">
                No voices are installed on this device yet — the system default is used.
              </p>
            ) : (
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <label className="block text-xs text-slate-500" htmlFor="speech-language">
                    Language
                  </label>
                  <select
                    id="speech-language"
                    value={language}
                    onChange={(e) => selectLanguage(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/5 bg-slate-800/50 px-3 py-2 text-sm text-slate-200 focus:border-amber-500/30 focus:outline-none light:border-slate-200 light:bg-slate-100 light:text-slate-700"
                  >
                    {languages.map((tag) => (
                      <option key={tag} value={tag}>
                        {describeLanguage(tag)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0 flex-1">
                  <label className="block text-xs text-slate-500" htmlFor="speech-voice">
                    Voice
                  </label>
                  <select
                    id="speech-voice"
                    value={speech.prefs.voiceURI ?? ""}
                    onChange={(e) => speech.setVoiceURI(e.target.value || null)}
                    className="mt-1 w-full rounded-xl border border-white/5 bg-slate-800/50 px-3 py-2 text-sm text-slate-200 focus:border-amber-500/30 focus:outline-none light:border-slate-200 light:bg-slate-100 light:text-slate-700"
                  >
                    <option value="">System default</option>
                    {langVoices.map((voice) => (
                      <option key={voice.voiceURI} value={voice.voiceURI}>
                        {voice.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <label htmlFor="rate">Speed</label>
              <span className="text-amber-400">{speech.prefs.rate.toFixed(2)}×</span>
            </div>
            <input
              id="rate"
              type="range"
              min={RATE_MIN}
              max={RATE_MAX}
              step={RATE_STEP}
              value={speech.prefs.rate}
              onChange={(e) => speech.setRate(Number(e.target.value))}
              className="speech-slider mt-1 w-full"
            />

            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <label htmlFor="pitch">Pitch</label>
              <span className="text-amber-400">{speech.prefs.pitch.toFixed(2)}</span>
            </div>
            <input
              id="pitch"
              type="range"
              min={PITCH_MIN}
              max={PITCH_MAX}
              step={0.05}
              value={speech.prefs.pitch}
              onChange={(e) => speech.setPitch(Number(e.target.value))}
              className="speech-slider mt-1 w-full"
            />

            <button
              type="button"
              onClick={() =>
                speech.speak({
                  id: "settings-sample",
                  label: "Voice preview",
                  text: SAMPLE,
                  markdown: false,
                })
              }
              className="mt-4 w-full rounded-xl bg-slate-800/30 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-amber-500/10 hover:text-amber-300 light:bg-slate-100 light:text-slate-600"
            >
              Hear a sample
            </button>
          </>
        )}
      </div>

      <div className="glass mb-4 rounded-2xl p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-300 light:text-slate-700">Stats</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-slate-800/30 p-3 light:bg-slate-100">
            <p className="note-title text-3xl text-white light:text-slate-900">{notes.length}</p>
            <p className="mt-1 text-xs text-slate-500">Notes</p>
          </div>
          <div className="rounded-xl bg-slate-800/30 p-3 light:bg-slate-100">
            <p className="note-title text-3xl text-white light:text-slate-900">{notebooks.length}</p>
            <p className="mt-1 text-xs text-slate-500">Notebooks</p>
          </div>
          <div className="rounded-xl bg-slate-800/30 p-3 light:bg-slate-100">
            <p className="note-title text-3xl text-white light:text-slate-900">{streak ?? "–"}</p>
            <p className="mt-1 text-xs text-slate-500">Day streak</p>
          </div>
        </div>
        {trash.length > 0 && (
          <p className="mt-3 text-xs text-slate-500">{trash.length} note{trash.length === 1 ? "" : "s"} in Trash</p>
        )}
      </div>

      <div className="glass mb-4 rounded-2xl p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-300 light:text-slate-700">
          Export &amp; import
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          Download your notes as Markdown, or import `.md` files into DailyMark.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void exportAll()}
            disabled={ioBusy || notes.length === 0}
            className="flex-1 rounded-xl bg-slate-800/30 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-amber-500/10 hover:text-amber-300 disabled:opacity-50 light:bg-slate-100 light:text-slate-600"
          >
            Export all Markdown
          </button>
          <button
            type="button"
            onClick={() => importRef.current?.click()}
            disabled={ioBusy}
            className="flex-1 rounded-xl bg-slate-800/30 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-amber-500/10 hover:text-amber-300 disabled:opacity-50 light:bg-slate-100 light:text-slate-600"
          >
            Import Markdown
          </button>
        </div>
        <input
          ref={importRef}
          type="file"
          accept=".md,text/markdown,text/plain"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = e.target.files;
            e.target.value = "";
            void importFiles(files);
          }}
        />
        {notes[0] && (
          <button
            type="button"
            onClick={async () => {
              const full = notes[0].bodyLoaded ? notes[0] : await ensureNote(notes[0].id);
              if (!full) return;
              downloadText(safeFilename(full.title), noteToMarkdown(full));
            }}
            className="mt-2 text-xs text-slate-500 hover:text-amber-400"
          >
            Or export the newest note only
          </button>
        )}
        {ioMessage && <p className="mt-2 text-xs text-amber-400">{ioMessage}</p>}
        {ioError && <p className="mt-2 text-xs text-red-400">{ioError}</p>}
      </div>

      <div className="glass mb-4 rounded-2xl p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-300 light:text-slate-700">
          Local reminder
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          A once-a-day nudge on this device — nothing leaves the browser.
        </p>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="reminder-enabled" className="text-sm text-slate-300 light:text-slate-700">
            Daily reminder
          </label>
          <button
            id="reminder-enabled"
            type="button"
            role="switch"
            aria-checked={reminder.enabled}
            onClick={() => void toggleReminder(!reminder.enabled)}
            className={
              "relative h-7 w-12 rounded-full transition-colors " +
              (reminder.enabled ? "bg-amber-500" : "bg-slate-700 light:bg-slate-300")
            }
          >
            <div
              className={
                "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all " +
                (reminder.enabled ? "left-[calc(100%-1.625rem)]" : "left-0.5")
              }
            />
          </button>
        </div>
        <label htmlFor="reminder-time" className="mt-3 block text-xs text-slate-500">
          Time
        </label>
        <input
          id="reminder-time"
          type="time"
          value={reminder.time}
          onChange={(e) => setReminder((prev) => ({ ...prev, time: e.target.value || "20:00" }))}
          disabled={!reminder.enabled}
          className="mt-1 rounded-xl border border-white/5 bg-slate-800/50 px-3 py-2 text-sm text-slate-200 focus:border-amber-500/30 focus:outline-none disabled:opacity-40 light:border-slate-200 light:bg-slate-100 light:text-slate-700"
        />
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

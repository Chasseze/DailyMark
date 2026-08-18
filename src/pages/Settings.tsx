import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/theme-context";
import { useMood } from "../context/mood-context";
import { useNotes } from "../context/notes-context";
import { useAuth } from "../context/auth-context";
import { useSpeechControls } from "../context/speech-context";
import { useStreak } from "../hooks/useStreak";
import { buildWeeklyReviewMarkdown } from "../lib/weekly-review";
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
  DEFAULT_REMINDER,
  ensureNotificationPermission,
  type ReminderPrefs,
} from "../lib/reminders";
import { usePrefs } from "../context/prefs-context";
import { clearDeviceCache, countOutbox } from "../lib/notes-offline";
import { errorMessage } from "../lib/supabase";
import type { Theme } from "../lib/types";

const SAMPLE = "This is how DailyMark will sound when it reads your notes aloud.";
const APP_VERSION = "2.0.0";

function reminderFromPrefs(
  reminder: { enabled?: boolean; time?: string } | undefined
): ReminderPrefs | null {
  if (!reminder) return null;
  return {
    enabled: Boolean(reminder.enabled),
    time:
      typeof reminder.time === "string" && /^\d{2}:\d{2}$/.test(reminder.time)
        ? reminder.time
        : DEFAULT_REMINDER.time,
  };
}

export default function Settings() {
  const navigate = useNavigate();
  const { theme, resolved, setTheme, toggle } = useTheme();
  const { mood, setMood } = useMood();
  const { notes, trash, notebooks, addNote, ensureNote, inboxId, dueNotes } = useNotes();
  const { user, signOut } = useAuth();
  const { prefs, patchPrefs } = usePrefs();
  const { streak } = useStreak();
  const speech = useSpeechControls();
  const [signingOut, setSigningOut] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [ioBusy, setIoBusy] = useState(false);
  const [ioMessage, setIoMessage] = useState<string | null>(null);
  const [ioError, setIoError] = useState<string | null>(null);
  // Read straight off the account row — PrefsProvider already mirrors it into
  // the reminder module on load and on every patch, so a local copy here would
  // only be a second thing to keep in step.
  const reminder = useMemo(
    () => reminderFromPrefs(prefs.reminder) ?? DEFAULT_REMINDER,
    [prefs.reminder]
  );
  const importRef = useRef<HTMLInputElement>(null);

  // The offline copy is the only app data this device holds; the button below
  // exists so it can be wiped without reaching for browser settings.
  const [cacheState, setCacheState] = useState({
    pending: 0,
    busy: false,
    message: null as string | null,
    error: null as string | null,
  });

  useEffect(() => {
    let active = true;
    void countOutbox().then((pending) => {
      if (active) setCacheState((prev) => ({ ...prev, pending }));
    });
    return () => {
      active = false;
    };
  }, []);

  const clearCache = async () => {
    const warning =
      cacheState.pending > 0
        ? `${cacheState.pending} edit${cacheState.pending === 1 ? " has" : "s have"} not reached your account yet and will be lost. Clear anyway?`
        : "Clear this device's offline copy? Your notes stay in your account.";
    if (!confirm(warning)) return;
    setCacheState((prev) => ({ ...prev, busy: true, message: null, error: null }));
    try {
      await clearDeviceCache();
      setCacheState({
        pending: 0,
        busy: false,
        message: "Cleared. Reload to refetch everything from your account.",
        error: null,
      });
    } catch (err) {
      setCacheState((prev) => ({ ...prev, busy: false, error: errorMessage(err) }));
    }
  };

  const applyReminder = (next: ReminderPrefs) => {
    void patchPrefs({ reminder: next });
  };

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
        applyReminder({ ...reminder, enabled: false });
        return;
      }
    }
    applyReminder({ ...reminder, enabled });
  };

  return (
    <div className="animate-in px-4 pt-6">
      <h1 className="page-title mb-6 text-ink">Settings</h1>

      <div className="glass mb-4 rounded-2xl p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink-soft">Account</h2>
        <p className="truncate text-sm text-ink">{user?.email}</p>
        <p className="mt-0.5 text-xs text-muted">
          Notes sync to Supabase and follow you across devices.
        </p>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="mt-3 w-full rounded-xl bg-surface px-4 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-50"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>

      <div className="glass mb-4 rounded-2xl p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink-soft">Appearance</h2>
        <div className="flex gap-2">
          {(["dark", "light", "system"] as Theme[]).map((t) => (
            <button key={t} onClick={() => setTheme(t)}
              className={
                "flex-1 rounded-xl px-4 py-3 text-sm font-medium capitalize transition-all " +
                (theme === t
                  ? "bg-accent-soft text-accent-ink"
                  : "bg-surface text-muted hover:text-ink-soft")
              }>
              {t}
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-muted">Quick toggle</span>
          <button onClick={toggle} className="relative h-7 w-12 rounded-full bg-surface-3 transition-colors">
            <div className={
              "absolute top-0.5 h-6 w-6 rounded-full bg-ink shadow transition-all " +
              (resolved === "dark" ? "left-0.5" : "left-[calc(100%-1.625rem)]")
            } />
          </button>
        </div>

        <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-muted">
          Notes mood
        </h3>
        <p className="mb-2 text-xs leading-relaxed text-muted">
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
                  ? "bg-accent-soft text-accent-ink"
                  : "bg-surface text-muted hover:text-ink-soft")
              }
            >
              <span
                className="h-8 w-8 shrink-0 rounded-lg shadow-inner ring-1 ring-line-strong"
                style={{ backgroundColor: option.swatch }}
                aria-hidden="true"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">
                  {option.label}
                </span>
                <span className="block text-xs text-muted">{option.blurb}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="glass mb-4 rounded-2xl p-4">
        <h2 className="mb-1 text-sm font-semibold text-ink-soft">Read aloud</h2>
        {!speech.supported ? (
          <p className="text-xs leading-relaxed text-muted">
            This browser has no speech synthesis, so the listen buttons are hidden. Chrome, Edge and
            Safari can read notes aloud.
          </p>
        ) : (
          <>
            <p className="mb-3 text-xs text-muted">
              Notes are spoken by your device — no audio leaves the browser.
            </p>

            {speech.voices.length === 0 ? (
              <p className="text-xs text-muted">
                No voices are installed on this device yet — the system default is used.
              </p>
            ) : (
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <label className="block text-xs text-muted" htmlFor="speech-language">
                    Language
                  </label>
                  <select
                    id="speech-language"
                    value={language}
                    onChange={(e) => selectLanguage(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-ink-soft focus:border-accent/50 focus:outline-none"
                  >
                    {languages.map((tag) => (
                      <option key={tag} value={tag}>
                        {describeLanguage(tag)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0 flex-1">
                  <label className="block text-xs text-muted" htmlFor="speech-voice">
                    Voice
                  </label>
                  <select
                    id="speech-voice"
                    value={speech.prefs.voiceURI ?? ""}
                    onChange={(e) => speech.setVoiceURI(e.target.value || null)}
                    className="mt-1 w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-ink-soft focus:border-accent/50 focus:outline-none"
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

            <div className="mt-3 flex items-center justify-between text-xs text-muted">
              <label htmlFor="rate">Speed</label>
              <span className="text-accent-ink">{speech.prefs.rate.toFixed(2)}×</span>
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

            <div className="mt-3 flex items-center justify-between text-xs text-muted">
              <label htmlFor="pitch">Pitch</label>
              <span className="text-accent-ink">{speech.prefs.pitch.toFixed(2)}</span>
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
              className="mt-4 w-full rounded-xl bg-surface px-4 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-accent-soft hover:text-accent"
            >
              Hear a sample
            </button>
          </>
        )}
      </div>

      <div className="glass mb-4 rounded-2xl p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink-soft">Stats</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-surface p-3">
            <p className="note-title text-3xl text-ink">{notes.length}</p>
            <p className="mt-1 text-xs text-muted">Notes</p>
          </div>
          <div className="rounded-xl bg-surface p-3">
            <p className="note-title text-3xl text-ink">{notebooks.length}</p>
            <p className="mt-1 text-xs text-muted">Notebooks</p>
          </div>
          <div className="rounded-xl bg-surface p-3">
            <p className="note-title text-3xl text-ink">{streak ?? "–"}</p>
            <p className="mt-1 text-xs text-muted">Day streak</p>
          </div>
        </div>
        {trash.length > 0 && (
          <p className="mt-3 text-xs text-muted">{trash.length} note{trash.length === 1 ? "" : "s"} in Trash</p>
        )}
        {dueNotes.length > 0 && (
          <p className="mt-2 text-xs text-accent-ink">
            {dueNotes.length} note{dueNotes.length === 1 ? "" : "s"} waiting for a revisit
          </p>
        )}
        <button
          type="button"
          disabled={reviewBusy}
          onClick={() => {
            void (async () => {
              setReviewBusy(true);
              setIoError(null);
              try {
                const draft = buildWeeklyReviewMarkdown({ notes, streak });
                const note = await addNote({
                  title: draft.title,
                  content: draft.content,
                  notebook_id: inboxId,
                  is_pinned: false,
                  tags: ["weekly-review"],
                });
                navigate("/notes/" + note.id + "/edit");
              } catch (err) {
                setIoError(errorMessage(err));
              } finally {
                setReviewBusy(false);
              }
            })();
          }}
          className="mt-4 w-full rounded-xl bg-surface px-4 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-accent-soft hover:text-accent disabled:opacity-50"
        >
          {reviewBusy ? "Opening review…" : "Start weekly review"}
        </button>
      </div>

      <div className="glass mb-4 rounded-2xl p-4">
        <h2 className="mb-1 text-sm font-semibold text-ink-soft">
          Export &amp; import
        </h2>
        <p className="mb-3 text-xs text-muted">
          Download your notes as Markdown, or import `.md` files into DailyMark.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void exportAll()}
            disabled={ioBusy || notes.length === 0}
            className="flex-1 rounded-xl bg-surface px-4 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-accent-soft hover:text-accent disabled:opacity-50"
          >
            Export all Markdown
          </button>
          <button
            type="button"
            onClick={() => importRef.current?.click()}
            disabled={ioBusy}
            className="flex-1 rounded-xl bg-surface px-4 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-accent-soft hover:text-accent disabled:opacity-50"
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
            className="mt-2 text-xs text-muted hover:text-accent"
          >
            Or export the newest note only
          </button>
        )}
        {ioMessage && <p className="mt-2 text-xs text-accent-ink">{ioMessage}</p>}
        {ioError && <p className="mt-2 text-xs text-danger">{ioError}</p>}
      </div>

      <div className="glass mb-4 rounded-2xl p-4">
        <h2 className="mb-1 text-sm font-semibold text-ink-soft">
          Daily reminder
        </h2>
        <p className="mb-3 text-xs text-muted">
          Settings sync with your account; the notification still fires on this device.
        </p>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="reminder-enabled" className="text-sm text-ink-soft">
            Enable reminder
          </label>
          <button
            id="reminder-enabled"
            type="button"
            role="switch"
            aria-checked={reminder.enabled}
            onClick={() => void toggleReminder(!reminder.enabled)}
            className={
              "relative h-7 w-12 rounded-full transition-colors " +
              (reminder.enabled ? "bg-accent" : "bg-surface-3")
            }
          >
            <div
              className={
                "absolute top-0.5 h-6 w-6 rounded-full bg-ink shadow transition-all " +
                (reminder.enabled ? "left-[calc(100%-1.625rem)]" : "left-0.5")
              }
            />
          </button>
        </div>
        <label htmlFor="reminder-time" className="mt-3 block text-xs text-muted">
          Time
        </label>
        <input
          id="reminder-time"
          type="time"
          value={reminder.time}
          onChange={(e) =>
            applyReminder({ ...reminder, time: e.target.value || DEFAULT_REMINDER.time })
          }
          disabled={!reminder.enabled}
          className="mt-1 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-ink-soft focus:border-accent/50 focus:outline-none disabled:opacity-40"
        />
      </div>

      <div className="glass mb-4 rounded-2xl p-4">
        <h2 className="mb-1 text-sm font-semibold text-ink-soft">This device</h2>
        <p className="text-xs leading-relaxed text-muted">
          Everything you write lives in your account. The only thing kept on this
          device is an offline copy of your notes, so you can read and edit them
          with no connection — it is rebuilt from the account on the next load.
        </p>
        {cacheState.pending > 0 && (
          <p className="mt-2 text-xs text-danger">
            {cacheState.pending} edit{cacheState.pending === 1 ? "" : "s"} still waiting to
            sync. Clearing now would discard {cacheState.pending === 1 ? "it" : "them"}.
          </p>
        )}
        <button
          type="button"
          onClick={() => void clearCache()}
          disabled={cacheState.busy}
          className="mt-3 w-full rounded-xl bg-surface px-4 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-50"
        >
          {cacheState.busy ? "Clearing…" : "Clear this device's offline copy"}
        </button>
        {cacheState.message && (
          <p className="mt-2 text-xs text-accent-ink">{cacheState.message}</p>
        )}
        {cacheState.error && <p className="mt-2 text-xs text-danger">{cacheState.error}</p>}
      </div>

      <div className="glass rounded-2xl p-4">
        <h2 className="mb-2 text-sm font-semibold text-ink-soft">About</h2>
        <p className="text-xs leading-relaxed text-muted">
          DailyMark v{APP_VERSION}
        </p>
        <p className="mt-2 text-xs text-muted">Account-synced desk</p>
      </div>
    </div>
  );
}

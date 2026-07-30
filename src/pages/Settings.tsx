import { useMemo, useState } from "react";
import { useTheme } from "../context/theme-context";
import { useNotes } from "../context/notes-context";
import { useAuth } from "../context/auth-context";
import { useSpeech } from "../context/speech-context";
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
import type { Theme } from "../lib/types";

const SAMPLE = "This is how DailyMark will sound when it reads your notes aloud.";

export default function Settings() {
  const { theme, resolved, setTheme, toggle } = useTheme();
  const { notes, notebooks } = useNotes();
  const { user, signOut } = useAuth();
  const speech = useSpeech();
  const [signingOut, setSigningOut] = useState(false);

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
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-800/30 p-3 light:bg-slate-100">
            <p className="note-title text-3xl text-white light:text-slate-900">{notes.length}</p>
            <p className="mt-1 text-xs text-slate-500">Notes</p>
          </div>
          <div className="rounded-xl bg-slate-800/30 p-3 light:bg-slate-100">
            <p className="note-title text-3xl text-white light:text-slate-900">{notebooks.length}</p>
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

import { Outlet, useLocation } from "react-router-dom";
import BottomNav from "./BottomNav";
import ReadAloudBar from "./ReadAloudBar";
import MoodPicker from "./MoodPicker";
import { useSpeechControls } from "../context/speech-context";
import { NOTES_MOODS } from "../lib/moods";
import { useMood } from "../context/mood-context";

export default function Layout() {
  const { status, error } = useSpeechControls();
  const location = useLocation();
  const { mood } = useMood();
  const moodMeta = NOTES_MOODS.find((m) => m.id === mood) ?? NOTES_MOODS[0];

  const playerVisible = status !== "idle" || error !== null;
  const isNotesRoute = location.pathname === "/notes" || location.pathname.startsWith("/notes/");
  const isEditing = /\/notes\/[^/]+\/edit\/?$/.test(location.pathname);
  const hideNav = isEditing;

  const sectionLabel = isNotesRoute
    ? "Notes"
    : location.pathname.startsWith("/daily")
      ? "Daily"
      : location.pathname.startsWith("/settings")
        ? "Settings"
        : "";

  return (
    <div className="app-shell min-h-screen w-full text-white light:text-slate-900">
      <header className="notes-masthead sticky top-0 z-40">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15">
                <div className="h-2.5 w-2.5 rounded-[3px] bg-white" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[1.15rem] font-bold tracking-tight text-white">
                  DailyMark
                </p>
                {sectionLabel && (
                  <p className="truncate text-[11px] text-white/70">
                    {sectionLabel}
                    <span className="hidden sm:inline"> · {moodMeta.blurb}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
          <MoodPicker />
        </div>
      </header>

      <main
        className={
          "mx-auto w-full max-w-2xl " +
          (hideNav
            ? playerVisible
              ? "pb-28"
              : "pb-6"
            : playerVisible
              ? "pb-48"
              : "pb-28")
        }
      >
        <Outlet />
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-50">
        <div className="mx-auto max-w-2xl">
          <ReadAloudBar />
          {!hideNav && <BottomNav />}
        </div>
      </div>
    </div>
  );
}

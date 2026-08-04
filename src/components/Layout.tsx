import { Outlet, useLocation } from "react-router-dom";
import BottomNav from "./BottomNav";
import SideNav from "./SideNav";
import ReadAloudBar from "./ReadAloudBar";
import MoodPicker from "./MoodPicker";
import { useSpeechControls } from "../context/speech-context";
import { useFocus } from "../context/focus-context";
import { NOTES_MOODS } from "../lib/moods";
import { useMood } from "../context/mood-context";

export default function Layout() {
  const { status, error } = useSpeechControls();
  const location = useLocation();
  const { mood } = useMood();
  const { focus, setFocus } = useFocus();
  const moodMeta = NOTES_MOODS.find((m) => m.id === mood) ?? NOTES_MOODS[0];

  const playerVisible = status !== "idle" || error !== null;
  const isNotesRoute = location.pathname === "/notes" || location.pathname.startsWith("/notes/");
  const isThoughtsRoute =
    location.pathname === "/thoughts" || location.pathname.startsWith("/thoughts/");
  const isEditing = /\/notes\/[^/]+\/edit\/?$/.test(location.pathname);
  const hideChrome = focus || isEditing;

  const sectionLabel = isNotesRoute
    ? "Notes"
    : isThoughtsRoute
      ? "Thoughts"
      : location.pathname.startsWith("/rhythm")
        ? "Rhythm"
        : location.pathname.startsWith("/daily")
          ? "Daily"
          : location.pathname.startsWith("/settings")
            ? "Settings"
            : "";

  return (
    <div
      className={
        "app-shell min-h-screen w-full text-ink " +
        (focus ? "focus-mode" : "")
      }
    >
      {!focus && (
        <header className="sticky top-0 z-40">
          <div className="app-container">
            {/* Full-bleed on a phone; from lg up it ends where the app ends,
                so the masthead reads as the top of a centred slab rather than
                a site-wide banner. */}
            <div className="notes-masthead flex items-center justify-between gap-3 px-4 py-3.5 lg:rounded-b-2xl">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15 lg:hidden">
                    <div className="h-2.5 w-2.5 rounded-[3px] bg-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold tracking-tight text-white lg:hidden">
                      DailyMark
                    </p>
                    {sectionLabel && (
                      <p className="truncate text-xs text-white/70 lg:text-sm lg:font-medium">
                        {sectionLabel}
                        <span className="hidden sm:inline"> · {moodMeta.blurb}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <MoodPicker />
            </div>
          </div>
        </header>
      )}

      {focus && (
        <div className="sticky top-0 z-40 flex justify-end px-4 py-2">
          <button
            type="button"
            onClick={() => setFocus(false)}
            className="rounded-xl bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-soft backdrop-blur"
          >
            Exit focus
          </button>
        </div>
      )}

      {/* The rail lives inside the same centred container as the content, so
          the whole app keeps its left and right margins instead of pinning
          itself to the viewport edges. */}
      <div className="app-container lg:flex lg:gap-6">
        {!focus && <SideNav />}

        <main
          className={
            "min-w-0 flex-1 " +
            // The tab bar is gone from lg up, so the column stops reserving
            // room for it there.
            (hideChrome
              ? playerVisible
                ? "pb-28"
                : "pb-6"
              : playerVisible
                ? "pb-48 lg:pb-24"
                : "pb-28 lg:pb-8")
          }
        >
          <Outlet />
        </main>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50">
        <div className="app-container">
          <ReadAloudBar />
          {!hideChrome && <BottomNav />}
        </div>
      </div>
    </div>
  );
}

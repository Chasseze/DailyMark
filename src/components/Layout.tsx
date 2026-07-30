import { Outlet, useLocation } from "react-router-dom";
import BottomNav from "./BottomNav";
import ReadAloudBar from "./ReadAloudBar";
import { useSpeech } from "../context/speech-context";

export default function Layout() {
  const { status, error } = useSpeech();
  const location = useLocation();
  // The playback strip stacks above the tab bar, so the page needs more room
  // underneath it while something is being read.
  const playerVisible = status !== "idle" || error !== null;
  const isNotesRoute = location.pathname === "/notes" || location.pathname.startsWith("/notes/");

  return (
    <div
      className={
        "app-shell min-h-screen text-white light:text-slate-900 " +
        (isNotesRoute ? "w-full" : "mx-auto max-w-lg")
      }
    >
      {!isNotesRoute && (
        <header className="notes-masthead sticky top-0 z-30 flex items-center gap-2.5 px-4 py-3.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15">
            <div className="h-2.5 w-2.5 rounded-[3px] bg-white" />
          </div>
          <span className="text-[1.05rem] font-bold tracking-tight text-white">DailyMark</span>
        </header>
      )}
      <main className={playerVisible ? "pb-48" : "pb-24"}>
        <Outlet />
      </main>
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <div className={isNotesRoute ? "w-full" : "mx-auto max-w-lg"}>
          <ReadAloudBar />
          <BottomNav />
        </div>
      </div>
    </div>
  );
}

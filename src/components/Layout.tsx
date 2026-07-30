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
  // Note view/edit have their own back-button header, so the masthead would
  // just duplicate chrome there — matches BottomNav's own hide condition.
  const isNoteDetail = location.pathname.startsWith("/notes/") && location.pathname !== "/notes";

  return (
    <div className="app-shell mx-auto min-h-screen max-w-lg text-white light:text-slate-900">
      {!isNoteDetail && (
        <header className="sticky top-0 z-30 flex items-center gap-2.5 bg-gradient-to-r from-[#2447e0] to-[#1e3fd6] px-4 py-3.5 shadow-lg shadow-blue-950/20">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15">
            <div className="h-2.5 w-2.5 rounded-[3px] bg-white" />
          </div>
          <span className="text-[1.05rem] font-bold tracking-tight text-white">DailyMark</span>
        </header>
      )}
      <main className={"animate-in " + (playerVisible ? "pb-48" : "pb-24")}>
        <Outlet />
      </main>
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <ReadAloudBar />
        <BottomNav />
      </div>
    </div>
  );
}

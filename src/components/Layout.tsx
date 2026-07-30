import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";
import ReadAloudBar from "./ReadAloudBar";
import { useSpeech } from "../context/speech-context";

export default function Layout() {
  const { status, error } = useSpeech();
  // The playback strip stacks above the tab bar, so the page needs more room
  // underneath it while something is being read.
  const playerVisible = status !== "idle" || error !== null;

  return (
    <div className="app-shell mx-auto min-h-screen max-w-lg text-white light:text-slate-900">
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

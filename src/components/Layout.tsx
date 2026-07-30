import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";

export default function Layout() {
  return (
    <div className="app-shell mx-auto min-h-screen max-w-lg text-white light:text-slate-900">
      <main className="animate-in pb-24">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}

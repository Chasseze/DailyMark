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

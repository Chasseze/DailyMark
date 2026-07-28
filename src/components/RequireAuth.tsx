import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/auth-context";

export default function RequireAuth() {
  const { session, loading } = useAuth();
  const location = useLocation();

  // Render nothing until the session lookup settles. Redirecting during the
  // check would bounce an already-signed-in user to /login on every reload.
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 light:bg-white">
        <span className="text-sm text-slate-500">Loading…</span>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

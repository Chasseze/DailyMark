import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/auth-context";

export default function RequireAuth() {
  const { session, loading, passwordRecovery } = useAuth();
  const location = useLocation();

  // Render nothing until the session lookup settles. Redirecting during the
  // check would bounce an already-signed-in user to /login on every reload.
  if (loading) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center">
        <span className="text-sm text-muted">Loading…</span>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // Recovery links mint a session before the new password is set — keep them
  // on /login so they finish the flow instead of landing in the app mid-reset.
  if (passwordRecovery) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

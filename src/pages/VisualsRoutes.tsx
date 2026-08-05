import { Outlet } from "react-router-dom";
import { VisualsProvider } from "../context/VisualsContext";

/**
 * Scopes the visuals catalog to the /visuals routes, same reasoning as
 * ThoughtsRoutes — a section many sessions never open shouldn't fire its
 * queries on every sign-in, and lazy-loading this module keeps the bundled
 * fallback bank out of the entry chunk.
 */
export default function VisualsRoutes() {
  return (
    <VisualsProvider>
      <Outlet />
    </VisualsProvider>
  );
}

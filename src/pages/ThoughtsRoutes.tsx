import { Outlet } from "react-router-dom";
import { ThoughtsProvider } from "../context/ThoughtsContext";

/**
 * Scopes the thoughts catalog to the routes that read it (/thoughts, /daily).
 *
 * The provider used to sit on the app layout, so signing in fired its three
 * queries — catalog, bookmarks, pinned profile row — before the notes list had
 * even painted, for a section many sessions never open. Lazy-loading this
 * module also keeps the bundled fallback bank out of the entry chunk.
 *
 * Both routes share this one element, so moving between Thoughts and Daily
 * keeps the provider mounted; only arriving from elsewhere refetches.
 */
export default function ThoughtsRoutes() {
  return (
    <ThoughtsProvider>
      <Outlet />
    </ThoughtsProvider>
  );
}

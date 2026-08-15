/**
 * After the signed-in shell is up, warm the other tab chunks while the
 * browser is idle so the first tap on Daily / Thoughts / Visuals does not
 * wait on a network round-trip. Notes is already the landing chunk.
 */
export function prefetchAppRoutes(): () => void {
  const warm = () => {
    void import("../pages/Daily");
    void import("../pages/ThoughtsRoutes");
    void import("../pages/VisualsRoutes");
    void import("../pages/Rhythm");
    void import("../pages/Settings");
  };

  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(warm, { timeout: 2500 });
    return () => window.cancelIdleCallback(id);
  }

  const timer = window.setTimeout(warm, 600);
  return () => window.clearTimeout(timer);
}

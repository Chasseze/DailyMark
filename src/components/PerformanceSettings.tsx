import { useEffect, useState } from "react";
import { getTimings } from "../lib/performance";
import { downloadText } from "../lib/notes-io";
export default function PerformanceSettings() {
  const [samples, setSamples] = useState(getTimings);
  useEffect(() => {
    const update = () => setSamples(getTimings());
    window.addEventListener("dailymark-timing", update);
    return () => window.removeEventListener("dailymark-timing", update);
  }, []);
  return (
    <section className="feature-panel glass mb-4 rounded-2xl p-4">
      <h2>Performance diagnostics</h2>
      <p className="my-2 text-sm text-muted">
        Recent timings from this session. No note text is collected or sent
        anywhere. Interactions slower than 40 ms are recorded when the browser
        supports them.
      </p>
      <p className="text-sm">
        {samples.length} samples ·{" "}
        {samples.filter((s) => s.event === "save-failure").length} save failures
      </p>
      <button
        disabled={!samples.length}
        onClick={() =>
          downloadText(
            "dailymark-performance.json",
            JSON.stringify(samples, null, 2),
            "application/json",
          )
        }
      >
        Download timings
      </button>
    </section>
  );
}

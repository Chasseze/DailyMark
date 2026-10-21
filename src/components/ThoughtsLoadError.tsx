import { useThoughts } from "../context/thoughts-context";

export default function ThoughtsLoadError() {
  const { error, refresh, refreshing } = useThoughts();
  if (!error) return null;
  return <div role="alert" className="mb-3 rounded-xl bg-danger-soft px-3 py-2 text-xs text-danger">
    <p>{error}</p>
    <button type="button" onClick={() => void refresh()} disabled={refreshing} className="mt-2 min-h-11 rounded-lg border border-current px-3 font-semibold disabled:opacity-50">
      {refreshing ? "Retrying…" : "Retry"}
    </button>
  </div>;
}

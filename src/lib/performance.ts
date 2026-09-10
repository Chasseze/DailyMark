export type Timing = {
  event: "note-open" | "note-save" | "save-failure" | "interaction";
  milliseconds: number;
  at: string;
};
const samples: Timing[] = [];
export function recordTiming(event: Timing["event"], milliseconds: number) {
  samples.push({
    event,
    milliseconds: Math.round(milliseconds),
    at: new Date().toISOString(),
  });
  if (samples.length > 200) samples.shift();
  window.dispatchEvent(new Event("dailymark-timing"));
}
export function getTimings() {
  return [...samples];
}
export function observeInteractions() {
  if (
    typeof PerformanceObserver === "undefined" ||
    !PerformanceObserver.supportedEntryTypes.includes("event")
  )
    return () => {};
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries())
      recordTiming("interaction", entry.duration);
  });
  observer.observe({
    type: "event",
    buffered: true,
    durationThreshold: 40,
  } as PerformanceObserverInit);
  return () => observer.disconnect();
}

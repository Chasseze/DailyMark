import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The round lives only in Supabase, so these cover the write path itself:
 * ordering, coalescing, and what happens when a write fails.
 */

const upsert = vi.fn();
const getSession = vi.fn();

vi.mock("./supabase", () => ({
  requireSupabase: () => ({
    auth: { getSession },
    from: () => ({ upsert }),
  }),
  supabaseRest: { url: "https://example.supabase.co", anonKey: "anon" },
  errorMessage: (e: unknown) => String(e),
}));

import {
  onProgressSaveState,
  progressSettled,
  saveProgress,
  type ProgressSaveState,
  type QuizProgress,
} from "./quiz";

function progress(index: number): QuizProgress {
  return {
    dateKey: "2026-08-18",
    attempt: 0,
    questionIds: ["a", "b", "c"],
    index,
    score: index,
    selected: null,
    phase: "question",
  };
}

const deferred = () => {
  let resolve!: (v: { error: null }) => void;
  const promise = new Promise<{ error: null }>((r) => { resolve = r; });
  return { promise, resolve };
};

beforeEach(async () => {
  await progressSettled();
  upsert.mockReset();
  getSession.mockReset();
  getSession.mockResolvedValue({ data: { session: { user: { id: "u1" }, access_token: "t" } } });
  upsert.mockResolvedValue({ error: null });
});

describe("saveProgress", () => {
  it("writes the round to the account", async () => {
    saveProgress(progress(1));
    await progressSettled();
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0]).toMatchObject({ user_id: "u1", index: 1, score: 1 });
  });

  it("never has two writes in flight at once", async () => {
    let concurrent = 0;
    let peak = 0;
    upsert.mockImplementation(async () => {
      concurrent += 1;
      peak = Math.max(peak, concurrent);
      await Promise.resolve();
      concurrent -= 1;
      return { error: null };
    });
    saveProgress(progress(1));
    saveProgress(progress(2));
    saveProgress(progress(3));
    await progressSettled();
    expect(peak).toBe(1);
  });

  it("lands on the newest state, not whichever response returns last", async () => {
    const first = deferred();
    upsert.mockImplementationOnce(() => first.promise);
    saveProgress(progress(1));      // starts, held open
    saveProgress(progress(2));      // queued
    saveProgress(progress(3));      // replaces the queued one
    first.resolve({ error: null });
    await progressSettled();
    const last = upsert.mock.calls[upsert.mock.calls.length - 1][0];
    expect(last.index).toBe(3);
  });

  it("coalesces a burst instead of one request per keystroke", async () => {
    const first = deferred();
    upsert.mockImplementationOnce(() => first.promise);
    saveProgress(progress(1));
    for (let i = 2; i <= 8; i++) saveProgress(progress(i));
    first.resolve({ error: null });
    await progressSettled();
    // The in-flight one, plus a single write carrying the latest state.
    expect(upsert).toHaveBeenCalledTimes(2);
  });

  it("reports a failed write instead of swallowing it", async () => {
    const seen: ProgressSaveState[] = [];
    const off = onProgressSaveState((s) => seen.push(s));
    upsert.mockResolvedValueOnce({ error: { message: "nope" } });
    saveProgress(progress(1));
    await progressSettled();
    off();
    expect(seen).toContain("error");
  });

  it("keeps the unsaved state so the next save retries it", async () => {
    upsert.mockResolvedValueOnce({ error: { message: "nope" } });
    saveProgress(progress(4));
    await progressSettled();
    upsert.mockResolvedValue({ error: null });
    saveProgress(progress(5));
    await progressSettled();
    const indexes = upsert.mock.calls.map((c) => c[0].index);
    expect(indexes).toContain(5);
  });

  it("returns to idle once the queue drains", async () => {
    const seen: ProgressSaveState[] = [];
    const off = onProgressSaveState((s) => seen.push(s));
    saveProgress(progress(2));
    await progressSettled();
    off();
    expect(seen[seen.length - 1]).toBe("idle");
  });

  it("does not spin when writes keep failing", async () => {
    // A first cut re-kicked the queue the instant a write failed, which ran as
    // fast as the network answered — hundreds of requests a second. One attempt
    // now, then a backoff timer; nothing more until the reader acts again.
    vi.useFakeTimers();
    upsert.mockResolvedValue({ error: { message: "down" } });
    saveProgress(progress(1));
    await vi.advanceTimersByTimeAsync(0);
    const afterFirst = upsert.mock.calls.length;
    expect(afterFirst).toBe(1);

    // Two seconds of nothing happening must not add a single request.
    await vi.advanceTimersByTimeAsync(2000);
    expect(upsert.mock.calls.length).toBe(afterFirst);

    // Past the backoff, exactly one more attempt.
    await vi.advanceTimersByTimeAsync(2000);
    expect(upsert.mock.calls.length).toBe(afterFirst + 1);

    upsert.mockResolvedValue({ error: null });
    await vi.advanceTimersByTimeAsync(120_000);
    vi.useRealTimers();
    await progressSettled();
  });

  it("does not write when nobody is signed in", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    saveProgress(progress(1));
    await progressSettled();
    expect(upsert).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from "vitest";
import type { Note } from "./types";
import {
  RETURN_MAX,
  appendReturnLine,
  buildReturnQueue,
  ensureReturnQueue,
  isDueNote,
  laterRevisitAt,
  markReturnDone,
  mergeReturnSessions,
  type ReturnSession,
} from "./return-queue";

function note(partial: Partial<Note>): Note {
  return {
    id: "n1",
    user_id: "u1",
    notebook_id: null,
    title: "Note",
    content: "",
    preview: "A line.",
    is_pinned: false,
    tags: [],
    deleted_at: null,
    revisit_at: null,
    created_at: "2026-07-01T09:00:00Z",
    updated_at: "2026-07-01T09:00:00Z",
    bodyLoaded: false,
    ...partial,
  };
}

const now = new Date(2026, 7, 15, 18, 0);

describe("isDueNote", () => {
  it("treats a revisit on or before local today as due", () => {
    expect(isDueNote(note({ revisit_at: "2026-08-15T08:00:00Z" }), now)).toBe(true);
    expect(isDueNote(note({ revisit_at: "2026-08-14T23:00:00Z" }), now)).toBe(true);
    expect(isDueNote(note({ revisit_at: "2026-08-16T12:00:00Z" }), now)).toBe(false);
    expect(isDueNote(note({ revisit_at: null }), now)).toBe(false);
  });
});

describe("buildReturnQueue", () => {
  it("seats due notes first, then the least-recently-updated older note", () => {
    const notes = [
      note({ id: "old", title: "Old", updated_at: "2026-01-01T09:00:00Z" }),
      note({ id: "mid", title: "Mid", updated_at: "2026-06-01T09:00:00Z" }),
      note({
        id: "due-a",
        title: "Due A",
        revisit_at: "2026-08-10T12:00:00Z",
        updated_at: "2026-08-10T12:00:00Z",
      }),
      note({
        id: "due-b",
        title: "Due B",
        revisit_at: "2026-08-12T12:00:00Z",
        updated_at: "2026-08-12T12:00:00Z",
      }),
      note({
        id: "due-c",
        title: "Due C",
        revisit_at: "2026-08-13T12:00:00Z",
        updated_at: "2026-08-13T12:00:00Z",
      }),
    ];
    const queue = buildReturnQueue(notes, [], now);
    expect(queue.map((item) => item.note.id)).toEqual(["due-a", "due-b", "old"]);
    expect(queue.map((item) => item.reason)).toEqual(["due", "due", "older"]);
  });

  it("fills with older notes when nothing is due", () => {
    const notes = [
      note({ id: "c", updated_at: "2026-03-01T09:00:00Z" }),
      note({ id: "a", updated_at: "2026-01-01T09:00:00Z" }),
      note({ id: "b", updated_at: "2026-02-01T09:00:00Z" }),
      note({ id: "d", updated_at: "2026-04-01T09:00:00Z" }),
    ];
    expect(buildReturnQueue(notes, [], now).map((item) => item.note.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("stops after three marks even if more notes are due", () => {
    const notes = [
      note({ id: "d1", revisit_at: "2026-08-01T12:00:00Z" }),
      note({ id: "d2", revisit_at: "2026-08-02T12:00:00Z" }),
    ];
    expect(buildReturnQueue(notes, ["x", "y", "z"], now)).toEqual([]);
  });

  it("skips blank older notes and finished ids", () => {
    const notes = [
      note({ id: "blank", title: "", preview: "", updated_at: "2026-01-01T09:00:00Z" }),
      note({ id: "keep", title: "Keep", updated_at: "2026-02-01T09:00:00Z" }),
      note({ id: "done", title: "Done", updated_at: "2026-01-15T09:00:00Z" }),
    ];
    expect(buildReturnQueue(notes, ["done"], now).map((item) => item.note.id)).toEqual([
      "keep",
    ]);
  });
});

describe("ensureReturnQueue", () => {
  it("freezes the day's ids so a later due note cannot slide in", () => {
    const first = [
      note({ id: "old", updated_at: "2026-01-01T09:00:00Z" }),
      note({
        id: "due",
        revisit_at: "2026-08-10T12:00:00Z",
        updated_at: "2026-08-10T12:00:00Z",
      }),
    ];
    const pinned = ensureReturnQueue(
      { dateKey: "2026-08-15", queuedIds: [], reasons: [], doneIds: [] },
      first,
      now
    );
    expect(pinned.queuedIds).toEqual(["due", "old"]);

    const moreDue = [
      ...first,
      note({
        id: "new-due",
        revisit_at: "2026-08-14T12:00:00Z",
        updated_at: "2026-08-14T12:00:00Z",
      }),
    ];
    const again = ensureReturnQueue(pinned, moreDue, now);
    expect(again.queuedIds).toEqual(["due", "old"]);
  });
});

describe("laterRevisitAt", () => {
  it("lands at local noon a week out", () => {
    const iso = laterRevisitAt(now, 7);
    const d = new Date(iso);
    expect(d.getDate()).toBe(22);
    expect(d.getMonth()).toBe(7);
    expect(d.getHours()).toBe(12);
  });
});

describe("appendReturnLine", () => {
  it("appends a dated pull-quote and ignores blank lines", () => {
    expect(appendReturnLine("Body.", "  still true  ", now)).toBe(
      "Body.\n\n> Return · Aug 15, 2026\n> still true\n"
    );
    expect(appendReturnLine("Body.", "   ", now)).toBe("Body.");
  });
});

describe("markReturnDone", () => {
  it("appends once", () => {
    const session: ReturnSession = {
      dateKey: "2026-08-15",
      queuedIds: ["a"],
      reasons: ["due"],
      doneIds: [],
    };
    const next = markReturnDone(session, "a");
    expect(next.doneIds).toEqual(["a"]);
    expect(markReturnDone(next, "a").doneIds).toEqual(["a"]);
    expect(RETURN_MAX).toBe(3);
  });
});

describe("mergeReturnSessions", () => {
  const day = "2026-08-15";

  it("takes the remote freeze when local has not pinned yet", () => {
    const local: ReturnSession = { dateKey: day, queuedIds: [], reasons: [], doneIds: [] };
    const remote: ReturnSession = {
      dateKey: day,
      queuedIds: ["a", "b", "c"],
      reasons: ["due", "due", "older"],
      doneIds: ["a"],
    };
    expect(mergeReturnSessions(local, remote)).toEqual(remote);
  });

  it("unions Keep/Later marks onto the same frozen pile", () => {
    const local: ReturnSession = {
      dateKey: day,
      queuedIds: ["a", "b", "c"],
      reasons: ["due", "due", "older"],
      doneIds: ["a"],
    };
    const remote: ReturnSession = {
      dateKey: day,
      queuedIds: ["a", "b", "c"],
      reasons: ["due", "due", "older"],
      doneIds: ["b"],
    };
    expect(mergeReturnSessions(local, remote).doneIds).toEqual(["a", "b"]);
  });

  it("keeps the pile with more marks when two browsers froze different ids", () => {
    const local: ReturnSession = {
      dateKey: day,
      queuedIds: ["x", "y"],
      reasons: ["due", "older"],
      doneIds: ["x", "y"],
    };
    const remote: ReturnSession = {
      dateKey: day,
      queuedIds: ["a", "b", "c"],
      reasons: ["due", "due", "older"],
      doneIds: ["a"],
    };
    const merged = mergeReturnSessions(local, remote);
    expect(merged.queuedIds).toEqual(["x", "y"]);
    expect(merged.doneIds).toEqual(["x", "y"]);
  });
});

import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearOutbox,
  enqueueOutbox,
  isOnline,
  listOutbox,
  loadNotesSnapshot,
  newClientId,
  removeOutbox,
  saveNotesSnapshot,
} from "./notes-offline";
import type { Note } from "./types";

function note(partial: Partial<Note> = {}): Note {
  return {
    id: newClientId(),
    user_id: "u1",
    notebook_id: null,
    title: "Offline draft",
    content: "body text",
    preview: "body text",
    is_pinned: false,
    tags: [],
    deleted_at: null,
    revisit_at: null,
    created_at: "2026-08-16T00:00:00Z",
    updated_at: "2026-08-16T00:00:00Z",
    bodyLoaded: true,
    ...partial,
  };
}

describe("notes-offline", () => {
  beforeEach(async () => {
    await clearOutbox();
  });

  it("reports navigator online state", () => {
    expect(typeof isOnline()).toBe("boolean");
  });

  it("round-trips a notes snapshot", async () => {
    const n = note({ title: "Cached note" });
    await saveNotesSnapshot({
      userId: "u1",
      notes: [n],
      trash: [],
      notebooks: [
        {
          id: "nb1",
          user_id: "u1",
          name: "Inbox",
          color: "#abc",
          created_at: "2026-08-16T00:00:00Z",
        },
      ],
      savedAt: "2026-08-16T01:00:00Z",
    });

    const snap = await loadNotesSnapshot("u1");
    expect(snap?.notes[0]?.title).toBe("Cached note");
    expect(snap?.notebooks[0]?.name).toBe("Inbox");
    expect(await loadNotesSnapshot("missing")).toBeNull();
  });

  it("enqueues, lists, and removes outbox ops in order", async () => {
    const n = note();
    const id1 = `1-${newClientId()}`;
    const id2 = `2-${newClientId()}`;
    await enqueueOutbox({ id: id1, type: "insert", note: n });
    await enqueueOutbox({ id: id2, type: "patch", noteId: n.id, data: { title: "Updated" } });

    const ops = (await listOutbox()).slice().sort((a, b) => a.id.localeCompare(b.id));
    expect(ops.map((o) => o.type)).toEqual(["insert", "patch"]);

    await removeOutbox(id1);
    const remaining = await listOutbox();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.type).toBe("patch");
  });
});

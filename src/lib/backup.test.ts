import { describe, it, expect } from "vitest";
import { parseBackup } from "./backup";
const note = {
  id: "1",
  title: "One",
  content: "# Heading\n\n---\n\n# Another heading",
  tags: ["a"],
  notebook_id: null,
  is_pinned: false,
  deleted_at: null,
  revisit_at: null,
};
const backup = {
  format: "dailymark",
  version: 1,
  notebooks: [],
  notes: [note, { ...note, id: "2", title: "Two" }],
};
describe("backup format", () => {
  it("round trips separate notes, Markdown boundaries, and tags", () => {
    expect(parseBackup(JSON.stringify(backup))).toEqual(backup);
  });
  it("rejects unsupported versions", () => {
    expect(() =>
      parseBackup(JSON.stringify({ ...backup, version: 2 })),
    ).toThrow();
  });
  it("rejects duplicate notes before creating data", () => {
    expect(() =>
      parseBackup(JSON.stringify({ ...backup, notes: [note, note] })),
    ).toThrow();
  });
  it("rejects missing notebook references", () => {
    expect(() =>
      parseBackup(
        JSON.stringify({
          ...backup,
          notes: [{ ...note, notebook_id: "missing" }],
        }),
      ),
    ).toThrow();
  });
});

import { describe, expect, it } from "vitest";
import { isAdapted, sourceCredit, sourceWebUrl } from "./thought-source";
import { noteToMarkdown } from "./notes-io";
import { parseBackup } from "./backup";
import type { ThoughtSourceRow } from "./database.types";

const source: ThoughtSourceRow = {
  id: "source",
  user_id: "owner",
  thought_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  note_id: "note",
  captured_at: "2026-10-20T10:00:00Z",
  origin: "catalog",
  snapshot: {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    title: "Source title",
    content: "Original saved body",
    author: "Author",
    source_name: "Publication",
    source_url: "https://example.com/article",
    tags: [],
    preview: "Original saved body",
    collection: "",
    published_at: "2026-10-20T10:00:00Z",
    created_at: "2026-10-20T10:00:00Z",
  },
};
describe("personal thought provenance", () => {
  it("labels only title or body changes, and recognizes a full reversion", () => {
    expect(
      isAdapted(source.snapshot.title, source.snapshot.content, source),
    ).toBe(false);
    expect(isAdapted("My title", source.snapshot.content, source)).toBe(true);
    expect(isAdapted(source.snapshot.title, "My reflection", source)).toBe(
      true,
    );
  });
  it("exports credit and the preserved source after the entire body is rewritten", () => {
    const markdown = noteToMarkdown({
      title: "My title",
      content: "Entirely new writing",
      tags: ["reflection"],
      thoughtSource: source,
    });
    for (const text of [
      "Personal adaptation",
      "Author · Publication",
      "https://example.com/article",
      "Original saved body",
      "Entirely new writing",
    ])
      expect(markdown).toContain(text);
    expect(sourceCredit(source)).toBe("Author · Publication");
  });
  it("does not turn unsafe imported URLs into links", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,test",
      "/relative",
    ])
      expect(sourceWebUrl(url)).toBeNull();
    expect(sourceWebUrl("https://example.com/article")).toBe(
      "https://example.com/article",
    );
  });
  const note = {
    id: "note",
    title: "My version",
    content: "Personal body",
    tags: [],
    notebook_id: null,
    is_pinned: false,
    deleted_at: null,
    revisit_at: null,
  };
  const backup = {
    format: "dailymark",
    version: 2,
    notebooks: [],
    notes: [note],
    thoughtSources: [source],
  };
  it("round trips the preserved source and personal version together", () => {
    expect(parseBackup(JSON.stringify(backup))).toEqual(backup);
  });
  it("rejects missing, malformed and multiply linked source records", () => {
    expect(() =>
      parseBackup(JSON.stringify({ ...backup, thoughtSources: undefined })),
    ).toThrow();
    expect(() =>
      parseBackup(
        JSON.stringify({
          ...backup,
          thoughtSources: [{ ...source, note_id: "missing" }],
        }),
      ),
    ).toThrow();
    expect(() =>
      parseBackup(
        JSON.stringify({ ...backup, thoughtSources: [source, source] }),
      ),
    ).toThrow();
    expect(() =>
      parseBackup(
        JSON.stringify({
          ...backup,
          thoughtSources: [
            { ...source, snapshot: { ...source.snapshot, title: null } },
          ],
        }),
      ),
    ).toThrow();
  });
});

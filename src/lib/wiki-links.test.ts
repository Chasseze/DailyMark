import { describe, expect, it } from "vitest";
import { expandWikiLinks, isInternalNoteHref } from "./wiki-links";

describe("expandWikiLinks", () => {
  const notes = [{ id: "11111111-1111-4111-8111-111111111111", title: "Inbox dump" }];

  it("links matching titles", () => {
    expect(expandWikiLinks("See [[Inbox dump]] today", notes)).toBe(
      "See [Inbox dump](/notes/11111111-1111-4111-8111-111111111111) today"
    );
  });

  it("marks missing titles", () => {
    expect(expandWikiLinks("See [[Nope]]", notes)).toBe("See [Nope](#missing-note)");
  });
});

describe("isInternalNoteHref", () => {
  it("accepts note paths", () => {
    expect(isInternalNoteHref("/notes/11111111-1111-4111-8111-111111111111")).toBe(true);
  });

  it("rejects external urls", () => {
    expect(isInternalNoteHref("https://example.com")).toBe(false);
  });
});

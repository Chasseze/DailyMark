import { describe, expect, it } from "vitest";
import {
  expandWikiLinks,
  findBrokenWikiLinks,
  findWikiLinks,
  isInternalNoteHref,
  wikiLinkKey,
} from "./wiki-links";

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

describe("findWikiLinks", () => {
  it("finds every distinct label in first-seen order", () => {
    expect(findWikiLinks("See [[Alpha]] then [[Beta]] and [[Alpha]] again")).toEqual([
      "Alpha",
      "Beta",
    ]);
  });

  it("trims labels and treats casing as the same link", () => {
    expect(findWikiLinks("[[  Alpha  ]] and [[alpha]]")).toEqual(["Alpha"]);
  });

  it("ignores empty brackets", () => {
    expect(findWikiLinks("nothing [[]] here")).toEqual([]);
  });

  it("returns nothing for prose without links", () => {
    expect(findWikiLinks("Just a sentence mentioning Alpha.")).toEqual([]);
  });
});

describe("findBrokenWikiLinks", () => {
  const notes = [{ title: "Inbox dump" }, { title: "" }];

  it("reports links that point at no note", () => {
    expect(findBrokenWikiLinks("See [[Inbox dump]] and [[Ghost note]]", notes)).toEqual([
      "Ghost note",
    ]);
  });

  it("counts a blank-titled note as Untitled", () => {
    expect(findBrokenWikiLinks("See [[Untitled]]", notes)).toEqual([]);
  });

  it("is quiet when every link resolves", () => {
    expect(findBrokenWikiLinks("See [[inbox DUMP]]", notes)).toEqual([]);
  });

  it("agrees with expandWikiLinks about what is missing", () => {
    const source = "See [[Inbox dump]] and [[Ghost note]]";
    const expanded = expandWikiLinks(source, [
      { id: "11111111-1111-4111-8111-111111111111", title: "Inbox dump" },
    ]);
    const broken = findBrokenWikiLinks(source, notes);
    // One rendered as #missing-note, and exactly that one is reported broken.
    expect(expanded.match(/#missing-note/g) ?? []).toHaveLength(broken.length);
  });
});

describe("wikiLinkKey", () => {
  it("normalises casing and padding", () => {
    expect(wikiLinkKey("  Alpha  ")).toBe(wikiLinkKey("alpha"));
  });

  it("maps a blank title onto Untitled", () => {
    expect(wikiLinkKey("   ")).toBe("untitled");
  });
});

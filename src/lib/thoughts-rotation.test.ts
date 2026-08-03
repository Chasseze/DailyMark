import { describe, expect, it } from "vitest";
import {
  DROP_CADENCE_DAYS,
  LIVE_MAX_AGE_DAYS,
  isWithinLiveWindow,
  liveExpiresAt,
  liveFeedLabel,
  pickLiveThoughts,
  withDropCadenceDates,
} from "./thoughts-rotation";
import type { Thought } from "./types";

function stub(id: string, publishedAt: string): Thought {
  return {
    id,
    title: id,
    content: "body",
    preview: "body",
    author: "A",
    source_name: "S",
    source_url: "https://example.com",
    collection: "General",
    tags: [],
    published_at: publishedAt,
    created_at: publishedAt,
  };
}

describe("isWithinLiveWindow", () => {
  const now = new Date("2026-08-03T12:00:00Z");

  it("keeps pieces younger than LIVE_MAX_AGE_DAYS", () => {
    expect(
      isWithinLiveWindow(stub("fresh", "2026-08-01T12:00:00Z"), now)
    ).toBe(true);
  });

  it("drops pieces at or past LIVE_MAX_AGE_DAYS", () => {
    expect(
      isWithinLiveWindow(stub("stale", "2026-07-31T12:00:00Z"), now)
    ).toBe(false);
  });

  it("rejects future publish dates", () => {
    expect(
      isWithinLiveWindow(stub("future", "2026-08-04T12:00:00Z"), now)
    ).toBe(false);
  });
});

describe("pickLiveThoughts", () => {
  const now = new Date("2026-08-03T12:00:00Z");
  const catalog = [
    stub("old", "2026-07-28T10:00:00Z"),
    stub("mid", "2026-08-01T10:00:00Z"),
    stub("new", "2026-08-03T10:00:00Z"),
  ];

  it("returns only in-window pieces, newest first", () => {
    expect(pickLiveThoughts(catalog, now).map((t) => t.id)).toEqual(["new", "mid"]);
  });

  it("excludes saved/bookmarked ids from Live", () => {
    expect(
      pickLiveThoughts(catalog, now, new Set(["new"])).map((t) => t.id)
    ).toEqual(["mid"]);
  });

  it("returns empty when everything expired or saved", () => {
    expect(pickLiveThoughts(catalog, now, new Set(["new", "mid"]))).toEqual([]);
  });
});

describe("liveExpiresAt", () => {
  it("is published_at plus LIVE_MAX_AGE_DAYS", () => {
    const thought = stub("a", "2026-08-01T10:00:00Z");
    const exp = liveExpiresAt(thought);
    expect(exp.toISOString()).toBe(
      new Date(
        new Date(thought.published_at).getTime() + LIVE_MAX_AGE_DAYS * 86_400_000
      ).toISOString()
    );
  });
});

describe("liveFeedLabel", () => {
  it("hints when the shelf is empty", () => {
    expect(liveFeedLabel([], new Date("2026-08-03T12:00:00Z"))).toMatch(/drop/i);
  });

  it("mentions the live window when pieces remain", () => {
    const live = [stub("new", "2026-08-03T10:00:00Z")];
    expect(liveFeedLabel(live, new Date("2026-08-03T12:00:00Z"))).toContain(
      String(LIVE_MAX_AGE_DAYS)
    );
  });
});

describe("withDropCadenceDates", () => {
  it("stages catalog onto a DROP_CADENCE_DAYS cadence ending at now", () => {
    const bank = [
      stub("a", "2020-01-01T00:00:00Z"),
      stub("b", "2020-01-02T00:00:00Z"),
      stub("c", "2020-01-03T00:00:00Z"),
    ];
    const now = new Date("2026-08-03T15:00:00Z");
    const staged = withDropCadenceDates(bank, now);
    expect(staged.map((t) => t.id)).toEqual(["a", "b", "c"]);

    const newest = new Date(staged[2].published_at);
    const middle = new Date(staged[1].published_at);
    expect(newest.getTime()).toBe(now.getTime());
    expect(
      (newest.getTime() - middle.getTime()) / 86_400_000
    ).toBe(DROP_CADENCE_DAYS);
  });

  it("keeps the newest drop inside the live window immediately", () => {
    const bank = [
      stub("a", "2020-01-01T00:00:00Z"),
      stub("b", "2020-01-02T00:00:00Z"),
    ];
    const now = new Date("2026-08-03T03:00:00Z");
    const staged = withDropCadenceDates(bank, now);
    expect(pickLiveThoughts(staged, now).map((t) => t.id)).toEqual(["b", "a"]);
  });
});

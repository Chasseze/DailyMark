import { describe, expect, it } from "vitest";
import {
  FEATURED_COUNT,
  ROTATION_DAYS,
  nextRotationAt,
  pickRotatingThoughts,
  rotationWindow,
  seededOrder,
} from "./thoughts-rotation";
import type { Thought } from "./types";

function stub(id: string): Thought {
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
    published_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
  };
}

describe("rotationWindow", () => {
  it("advances every ROTATION_DAYS", () => {
    const a = rotationWindow(new Date(Date.UTC(2026, 0, 1)));
    const b = rotationWindow(new Date(Date.UTC(2026, 0, 1 + ROTATION_DAYS)));
    expect(b).toBe(a + 1);
  });

  it("stays stable within a window", () => {
    const start = rotationWindow(new Date(Date.UTC(2026, 0, 1)));
    expect(rotationWindow(new Date(Date.UTC(2026, 0, ROTATION_DAYS)))).toBe(start);
  });
});

describe("pickRotatingThoughts", () => {
  const catalog = ["a", "b", "c", "d", "e", "f"].map(stub);

  it("returns FEATURED_COUNT items", () => {
    const picked = pickRotatingThoughts(catalog, new Date(Date.UTC(2026, 6, 1)));
    expect(picked).toHaveLength(FEATURED_COUNT);
  });

  it("is identical for every client in the same window", () => {
    const day = new Date(Date.UTC(2026, 6, 2));
    expect(pickRotatingThoughts(catalog, day).map((t) => t.id)).toEqual(
      pickRotatingThoughts(catalog, day).map((t) => t.id)
    );
  });

  it("changes set across windows", () => {
    const w0 = pickRotatingThoughts(catalog, new Date(Date.UTC(2026, 0, 1))).map((t) => t.id);
    const w1 = pickRotatingThoughts(
      catalog,
      new Date(Date.UTC(2026, 0, 1 + ROTATION_DAYS))
    ).map((t) => t.id);
    expect(w0).not.toEqual(w1);
  });
});

describe("seededOrder", () => {
  it("is deterministic", () => {
    expect(seededOrder([1, 2, 3, 4], 9)).toEqual(seededOrder([1, 2, 3, 4], 9));
  });
});

describe("nextRotationAt", () => {
  it("lands on a future UTC midnight boundary", () => {
    const now = new Date(Date.UTC(2026, 0, 1, 15));
    const next = nextRotationAt(now);
    expect(next.getTime()).toBeGreaterThan(now.getTime());
    expect(next.getUTCHours()).toBe(0);
  });
});

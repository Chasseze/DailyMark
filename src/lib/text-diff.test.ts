import { describe, expect, it } from "vitest";
import { compareText } from "./text-diff";

describe("source comparison", () => {
  for (const [name, original, current] of [
    ["unchanged", "One\nTwo\n", "One\nTwo\n"],
    ["addition", "One\n", "One\nAdded\n"],
    ["removal", "One\nRemoved\n", "One\n"],
    ["rewrite", "Old body", "New body"],
    ["empty source", "", "A new idea"],
    ["empty version", "Source body", ""],
    ["repeated lines", "A\nB\nA\n", "A\nA\nB\n"],
    ["newline change", "One", "One\n"],
    ["unicode", "An idea 🌱\n", "An idea 🌳\n"],
    ["large rewrite", "First\n" + "Old\n".repeat(600) + "Last\n", "First\n" + "New\n".repeat(600) + "Last\n"],
  ]) it(`reconstructs both exact texts after ${name}`, () => {
    const diff = compareText(original, current);
    expect(diff.filter((p) => p.kind !== "added").map((p) => p.text).join("")).toBe(original);
    expect(diff.filter((p) => p.kind !== "removed").map((p) => p.text).join("")).toBe(current);
    if (original === current) expect(diff.every((p) => p.kind === "same")).toBe(true);
    else expect(diff.some((p) => p.kind !== "same")).toBe(true);
  });
  it("keeps common context around an edited line", () => {
    expect(compareText("First\nOld\nLast\n", "First\nNew\nLast\n")).toEqual([
      { kind: "same", text: "First\n" }, { kind: "removed", text: "Old\n" },
      { kind: "added", text: "New\n" }, { kind: "same", text: "Last\n" },
    ]);
  });
});

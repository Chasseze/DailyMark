import { describe, it, expect } from "vitest";
import { readAllPages } from "./pagination";
describe("paged libraries", () => {
  it("reads beyond 1000 records without duplicates", async () => {
    const source = Array.from({ length: 1201 }, (_, i) => i);
    const result = await readAllPages(async (a, b) => ({
      data: source.slice(a, b + 1),
      error: null,
    }));
    expect(result.data).toEqual(source);
  });
  it("propagates page errors instead of claiming a complete library", async () => {
    const result = await readAllPages(
      async (a) =>
        a
          ? { data: null, error: new Error("offline") }
          : { data: [1, 2], error: null },
      2,
    );
    expect(result.error).toBeInstanceOf(Error);
  });
});

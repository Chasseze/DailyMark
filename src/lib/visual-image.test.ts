import { describe, expect, it } from "vitest";
import { visualImageUrl } from "./visual-image";

describe("visualImageUrl", () => {
  it("rewrites a Wikimedia FilePath width for list thumbs", () => {
    const src =
      "https://commons.wikimedia.org/wiki/Special:FilePath/NASA-Apollo8-Dec24-Earthrise.jpg?width=1600";
    expect(visualImageUrl(src, 400)).toBe(
      "https://commons.wikimedia.org/wiki/Special:FilePath/NASA-Apollo8-Dec24-Earthrise.jpg?width=400"
    );
  });

  it("leaves URLs without a width param unchanged", () => {
    const src = "https://example.com/photo.jpg";
    expect(visualImageUrl(src, 400)).toBe(src);
  });

  it("returns the original string when the URL cannot be parsed", () => {
    expect(visualImageUrl("not a url", 400)).toBe("not a url");
  });

  it("returns the original string for a non-positive width", () => {
    const src = "https://commons.wikimedia.org/wiki/Special:FilePath/x.jpg?width=1600";
    expect(visualImageUrl(src, 0)).toBe(src);
  });
});

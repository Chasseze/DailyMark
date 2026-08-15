import { describe, expect, it } from "vitest";
import { fileFromBlob, fitContain, isLikelyImage } from "./note-images";

describe("fitContain", () => {
  it("leaves already-small images alone", () => {
    expect(fitContain(800, 600, 1600)).toEqual({ width: 800, height: 600, scale: 1 });
  });

  it("scales a wide image by the long edge", () => {
    expect(fitContain(3200, 1800, 1600)).toEqual({ width: 1600, height: 900, scale: 0.5 });
  });

  it("scales a tall image by the long edge", () => {
    const next = fitContain(900, 3600, 1600);
    expect(next.width).toBe(400);
    expect(next.height).toBe(1600);
    expect(next.scale).toBeCloseTo(1600 / 3600);
  });

  it("handles zero dimensions", () => {
    expect(fitContain(0, 100, 1600)).toEqual({ width: 0, height: 0, scale: 0 });
  });
});

describe("isLikelyImage", () => {
  it("accepts the usual upload types", () => {
    expect(isLikelyImage(new File([], "shot.jpg", { type: "image/jpeg" }))).toBe(true);
    expect(isLikelyImage(new File([], "shot.webp", { type: "image/webp" }))).toBe(true);
  });

  it("accepts camera HEIC dumps and typeless files with an image name", () => {
    expect(isLikelyImage(new File([], "IMG_0001.HEIC", { type: "image/heic" }))).toBe(true);
    expect(isLikelyImage(new File([], "scan.jpg", { type: "" }))).toBe(true);
    expect(isLikelyImage(new File([], "scan.jpg", { type: "application/octet-stream" }))).toBe(true);
  });

  it("rejects non-images", () => {
    expect(isLikelyImage(new File([], "notes.pdf", { type: "application/pdf" }))).toBe(false);
    expect(isLikelyImage(new File([], "notes", { type: "" }))).toBe(false);
  });
});

describe("fileFromBlob", () => {
  it("names a JPEG camera frame as scan.jpg", () => {
    const file = fileFromBlob(new Blob(["x"], { type: "image/jpeg" }), "scan");
    expect(file.name).toBe("scan.jpg");
    expect(file.type).toBe("image/jpeg");
  });

  it("strips an existing extension from the basename", () => {
    const file = fileFromBlob(new Blob(["x"], { type: "image/webp" }), "page.png");
    expect(file.name).toBe("page.webp");
  });
});

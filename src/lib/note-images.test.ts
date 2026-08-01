import { describe, expect, it } from "vitest";
import { fitContain } from "./note-images";

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

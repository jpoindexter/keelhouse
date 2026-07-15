import { describe, expect, it } from "vitest";

import { nextCommandPaletteIndex } from "./useCommandPalette";

describe("command palette navigation", () => {
  it("wraps in both directions", () => {
    expect(nextCommandPaletteIndex(2, 3, 1)).toBe(0);
    expect(nextCommandPaletteIndex(0, 3, -1)).toBe(2);
  });

  it("holds at zero when no commands are visible", () => {
    expect(nextCommandPaletteIndex(4, 0, 1)).toBe(0);
  });
});

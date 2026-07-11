import { describe, expect, it } from "vitest";

import { nextTerminalFindIndex, terminalFindCountLabel, terminalFindHitLabel } from "./terminalFind";

describe("terminal find helpers", () => {
  it("collapses whitespace and caps hit labels", () => {
    expect(terminalFindHitLabel({ row: 0, col: 0, text: "  npm   run  build  " })).toBe("npm run build");
    const long = "x".repeat(200);
    expect(terminalFindHitLabel({ row: 0, col: 0, text: long })).toHaveLength(96);
    expect(terminalFindHitLabel({ row: 0, col: 0, text: long }).endsWith("…")).toBe(true);
  });

  it("wraps navigation in both directions and handles empty results", () => {
    expect(nextTerminalFindIndex(null, 0, 1)).toBeNull();
    expect(nextTerminalFindIndex(null, 3, 1)).toBe(0);
    expect(nextTerminalFindIndex(null, 3, -1)).toBe(2);
    expect(nextTerminalFindIndex(2, 3, 1)).toBe(0);
    expect(nextTerminalFindIndex(0, 3, -1)).toBe(2);
  });

  it("labels the match position", () => {
    expect(terminalFindCountLabel(null, 0)).toBe("No matches");
    expect(terminalFindCountLabel(1, 5)).toBe("2 of 5");
  });
});

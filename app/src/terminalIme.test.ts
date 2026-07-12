import { describe, expect, it } from "vitest";

import { imeCaretStyle } from "./terminalIme";

describe("imeCaretStyle", () => {
  it("scales the cursor cell to a pixel transform and cell-sized box", () => {
    expect(imeCaretStyle(0, 0, 8, 16)).toEqual({
      transform: "translate(0px, 0px)",
      width: "8px",
      height: "16px",
    });
    expect(imeCaretStyle(10, 3, 8.4, 17)).toEqual({
      transform: "translate(84px, 51px)",
      width: "8.4px",
      height: "17px",
    });
  });
});

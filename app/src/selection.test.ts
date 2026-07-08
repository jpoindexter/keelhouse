import { describe, expect, it } from "vitest";
import { normalizeSelection, pointFromMouse, selectionToText } from "./selection";
import type { Cell, SelectionRange } from "./selection";

const textCells = (rows: string[]): Cell[] =>
  rows.flatMap((row) => [...row].map((t) => ({ t })));

describe("terminal selection", () => {
  it("normalizes backward drags into document order", () => {
    expect(normalizeSelection({ start: { x: 5, y: 2 }, end: { x: 1, y: 1 } })).toEqual({
      start: { x: 1, y: 1 },
      end: { x: 5, y: 2 },
    });
  });

  it("extracts linear selected rows and trims line-end padding", () => {
    const selection: SelectionRange = { start: { x: 1, y: 0 }, end: { x: 3, y: 1 } };
    const cells = textCells(["abcde", "fg   ", "klmno"]);

    expect(selectionToText(cells, 5, selection)).toBe("bcde\nfg");
  });

  it("maps mouse coordinates to clamped terminal cells", () => {
    expect(pointFromMouse({ left: 10, top: 20 }, 9, 18, 5, 3, 74, 71)).toEqual({ x: 4, y: 2 });
  });
});

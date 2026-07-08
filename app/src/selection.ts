export type Cell = { t: string };
export type SelectionPoint = { x: number; y: number };
export type SelectionRange = { start: SelectionPoint; end: SelectionPoint };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function normalizeSelection(selection: SelectionRange): SelectionRange {
  const a = selection.start;
  const b = selection.end;
  if (a.y < b.y || (a.y === b.y && a.x <= b.x)) {
    return selection;
  }
  return { start: b, end: a };
}

export function pointFromMouse(
  rect: Pick<DOMRect, "left" | "top">,
  cellWidth: number,
  cellHeight: number,
  cols: number,
  rows: number,
  clientX: number,
  clientY: number,
): SelectionPoint {
  return {
    x: clamp(Math.floor((clientX - rect.left) / cellWidth), 0, cols - 1),
    y: clamp(Math.floor((clientY - rect.top) / cellHeight), 0, rows - 1),
  };
}

export function isCellSelected(x: number, y: number, selection: SelectionRange | null): boolean {
  if (!selection) return false;
  const { start, end } = normalizeSelection(selection);
  if (y < start.y || y > end.y) return false;
  if (start.y === end.y) return x >= start.x && x <= end.x;
  if (y === start.y) return x >= start.x;
  if (y === end.y) return x <= end.x;
  return true;
}

export function selectionToText(cells: Cell[], cols: number, selection: SelectionRange): string {
  const { start, end } = normalizeSelection(selection);
  const lines: string[] = [];

  for (let y = start.y; y <= end.y; y++) {
    const x0 = y === start.y ? start.x : 0;
    const x1 = y === end.y ? end.x : cols - 1;
    let line = "";
    for (let x = x0; x <= x1; x++) {
      line += cells[y * cols + x]?.t ?? " ";
    }
    lines.push(line.trimEnd());
  }

  return lines.join("\n");
}

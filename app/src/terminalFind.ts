export type TerminalFindHit = {
  row: number;
  col: number;
  text: string;
};

const MAX_LABEL_CHARS = 96;

export const terminalFindHitLabel = (hit: TerminalFindHit): string => {
  const collapsed = hit.text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= MAX_LABEL_CHARS) return collapsed;
  return `${collapsed.slice(0, MAX_LABEL_CHARS - 1)}…`;
};

export const nextTerminalFindIndex = (
  current: number | null,
  count: number,
  direction: 1 | -1,
): number | null => {
  if (count <= 0) return null;
  if (current == null) return direction === 1 ? 0 : count - 1;
  return (current + direction + count) % count;
};

export const terminalFindCountLabel = (current: number | null, count: number): string => {
  if (count === 0) return "No matches";
  return `${(current ?? 0) + 1} of ${count}`;
};

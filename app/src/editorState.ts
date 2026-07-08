export type EditorViewState = {
  anchor: number;
  head: number;
  scrollTop: number;
};

export type TreePathNode = {
  path: string;
  children?: TreePathNode[];
};

export type CursorPosition = {
  line: number;
  column: number;
};

const basename = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() ?? path;

export const clampEditorViewState = (
  state: EditorViewState | undefined,
  docLength: number,
): EditorViewState | null => {
  if (!state) return null;
  const max = Math.max(0, docLength);
  return {
    anchor: Math.min(Math.max(0, state.anchor), max),
    head: Math.min(Math.max(0, state.head), max),
    scrollTop: Math.max(0, state.scrollTop),
  };
};

export const cursorFromText = (content: string, offset: number): CursorPosition => {
  const head = Math.min(Math.max(0, offset), content.length);
  let line = 1;
  let lineStart = 0;
  for (let index = 0; index < head; index += 1) {
    if (content.charCodeAt(index) === 10) {
      line += 1;
      lineStart = index + 1;
    }
  }
  return { line, column: head - lineStart + 1 };
};

export const pathBreadcrumbs = (root: string | null, path: string): string[] => {
  if (!path) return [];
  if (!root || !path.startsWith(root)) return [basename(path)];
  const relative = path.slice(root.length).replace(/^[/\\]+/, "");
  return [basename(root), ...relative.split(/[\\/]/).filter(Boolean)];
};

export const fileTreeContainsPath = (nodes: TreePathNode[], path: string): boolean =>
  nodes.some((node) => node.path === path || fileTreeContainsPath(node.children ?? [], path));

export const findFileTreeNode = <T extends TreePathNode>(nodes: T[], path: string): T | null => {
  for (const node of nodes) {
    if (node.path === path) return node;
    const found = findFileTreeNode((node.children ?? []) as T[], path);
    if (found) return found;
  }
  return null;
};

export const reconcileActiveFileNode = <T extends TreePathNode>(nodes: T[], selected: T | null): T | null => {
  if (!selected) return null;
  return findFileTreeNode(nodes, selected.path) ?? selected;
};

export const languageLabelForPath = (path: string): string => {
  const ext = basename(path).split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "ts":
      return "TypeScript";
    case "tsx":
      return "TSX";
    case "js":
      return "JavaScript";
    case "jsx":
      return "JSX";
    case "md":
    case "markdown":
      return "Markdown";
    default:
      return ext ? ext.toUpperCase() : "Plain text";
  }
};

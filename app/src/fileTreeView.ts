import type { FileTreeNode } from "./fileTreeTypes";

export const markDirtyFiles = (
  nodes: FileTreeNode[],
  dirtyPaths: Set<string>,
): FileTreeNode[] => {
  if (dirtyPaths.size === 0) return nodes;
  return nodes.map((node) => ({
    ...node,
    dirty: dirtyPaths.has(node.path),
    children: node.children ? markDirtyFiles(node.children, dirtyPaths) : undefined,
  }));
};

export const flattenFileTree = (nodes: FileTreeNode[]): FileTreeNode[] =>
  nodes.flatMap((node) => [
    ...(node.kind === "file" ? [node] : []),
    ...(node.children ? flattenFileTree(node.children) : []),
  ]);

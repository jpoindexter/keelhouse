export type GitStatusFile = { path: string; index: string; worktree: string };

export type FileGitStatusCode = "modified" | "untracked" | "added" | "deleted" | "renamed" | "staged";

export type FileGitStatus = {
  code: FileGitStatusCode;
  token: string;
  label: string;
  relativePath: string;
  index: string;
  worktree: string;
};

export type FileTreeStatusNode = {
  id: string;
  name: string;
  path: string;
  kind: "directory" | "file";
  dirty?: boolean;
  gitStatus?: FileGitStatus;
  children?: FileTreeStatusNode[];
};

const normalizeRoot = (root: string) => root.replace(/[\\/]+$/, "");

export const gitStatusForFile = (file: GitStatusFile): FileGitStatus => {
  if (file.index === "?") {
    return { code: "untracked", token: "U", label: "Untracked", relativePath: file.path, index: file.index, worktree: file.worktree };
  }
  if (file.index === "D" || file.worktree === "D") {
    return { code: "deleted", token: "D", label: "Deleted", relativePath: file.path, index: file.index, worktree: file.worktree };
  }
  if (file.index === "R") {
    return { code: "renamed", token: "R", label: "Renamed", relativePath: file.path, index: file.index, worktree: file.worktree };
  }
  if (file.index === "A") {
    return { code: "added", token: "A", label: "Added", relativePath: file.path, index: file.index, worktree: file.worktree };
  }
  if (file.worktree !== " ") {
    return { code: "modified", token: "M", label: "Modified", relativePath: file.path, index: file.index, worktree: file.worktree };
  }
  return { code: "staged", token: "S", label: "Staged", relativePath: file.path, index: file.index, worktree: file.worktree };
};

export const gitStatusLabel = (file: GitStatusFile) => gitStatusForFile(file).label;

export const absolutePathForGitFile = (root: string, filePath: string) => `${normalizeRoot(root)}/${filePath.replace(/^[/\\]+/, "")}`;

const basename = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() ?? path;

const dirname = (path: string) => path.replace(/[\\/][^\\/]*$/, "") || path;

const cloneWithGitStatus = <T extends FileTreeStatusNode>(
  node: T,
  statusByPath: Map<string, FileGitStatus>,
  seenPaths: Set<string>,
): T => {
  const status = statusByPath.get(node.path);
  seenPaths.add(node.path);
  const nextChildren = node.children?.map((child) => cloneWithGitStatus(child, statusByPath, seenPaths));
  return {
    ...node,
    gitStatus: status,
    children: nextChildren,
  };
};

const insertVirtualDeletedNode = <T extends FileTreeStatusNode>(
  nodes: T[],
  root: string,
  absolutePath: string,
  status: FileGitStatus,
): T[] => {
  const parentPath = dirname(absolutePath);
  const nextNodes = nodes.map((node) => {
    if (node.kind !== "directory") return node;
    if (node.path === parentPath) {
      const children = node.children ?? [];
      if (children.some((child) => child.path === absolutePath)) return node;
      return {
        ...node,
        children: [
          ...children,
          {
            id: absolutePath,
            name: basename(absolutePath),
            path: absolutePath,
            kind: "file",
            gitStatus: status,
          } as T,
        ],
      };
    }
    if (absolutePath.startsWith(`${node.path}/`)) {
      return {
        ...node,
        children: insertVirtualDeletedNode((node.children ?? []) as T[], root, absolutePath, status),
      };
    }
    return node;
  });

  if (parentPath === normalizeRoot(root) && !nextNodes.some((node) => node.path === absolutePath)) {
    return [
      ...nextNodes,
      {
        id: absolutePath,
        name: basename(absolutePath),
        path: absolutePath,
        kind: "file",
        gitStatus: status,
      } as T,
    ];
  }
  return nextNodes;
};

export const decorateFileTreeWithGitStatus = <T extends FileTreeStatusNode>(
  root: string | null,
  nodes: T[],
  files: GitStatusFile[],
): T[] => {
  if (!root || files.length === 0) return nodes.map((node) => ({ ...node, gitStatus: undefined }));
  const statusByPath = new Map<string, FileGitStatus>();
  for (const file of files) {
    statusByPath.set(absolutePathForGitFile(root, file.path), gitStatusForFile(file));
  }
  const seenPaths = new Set<string>();
  let nextNodes = nodes.map((node) => cloneWithGitStatus(node, statusByPath, seenPaths));
  for (const [absolutePath, status] of statusByPath) {
    if (status.code === "deleted" && !seenPaths.has(absolutePath)) {
      nextNodes = insertVirtualDeletedNode(nextNodes, root, absolutePath, status);
    }
  }
  return nextNodes;
};

export type WorktreeRecord = {
  paneId: string;
  projectRoot: string;
  path: string;
  branch: string;
  label: string;
  createdAt: number;
};

export const addWorktree = (current: WorktreeRecord[], record: WorktreeRecord): WorktreeRecord[] => [
  ...current.filter((entry) => entry.paneId !== record.paneId),
  record,
];

export const removeWorktreeByPaneId = (current: WorktreeRecord[], paneId: string): WorktreeRecord[] =>
  current.filter((entry) => entry.paneId !== paneId);

export const worktreeForPaneId = (current: WorktreeRecord[], paneId: string | null): WorktreeRecord | null =>
  paneId == null ? null : (current.find((entry) => entry.paneId === paneId) ?? null);

export const worktreesForProject = (current: WorktreeRecord[], projectRoot: string): WorktreeRecord[] =>
  current.filter((entry) => entry.projectRoot === projectRoot);

export const normalizeWorktrees = (value: unknown): WorktreeRecord[] => {
  if (!Array.isArray(value)) return [];
  const cleaned: WorktreeRecord[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item == null) continue;
    const t = item as Record<string, unknown>;
    if (
      typeof t.paneId === "string" &&
      typeof t.projectRoot === "string" &&
      typeof t.path === "string" &&
      typeof t.branch === "string" &&
      typeof t.label === "string" &&
      typeof t.createdAt === "number"
    ) {
      cleaned.push(t as unknown as WorktreeRecord);
    }
  }
  return cleaned;
};

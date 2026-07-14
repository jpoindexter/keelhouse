import type { AgentApprovalMode } from "./agentSessionHandle";
import type { ChatProvider } from "./chatConversation";

export const MIN_ORCHESTRATION_CHILDREN = 2;
export const MAX_ORCHESTRATION_CHILDREN = 8;
export const MAX_CONCURRENT_CHAT_RUNS = 8;
export const MIN_CHILD_BUDGET_SECONDS = 30;
export const MAX_CHILD_BUDGET_SECONDS = 3600;

export type OrchestrationWorktreeMode = "shared" | "isolated";

export type OrchestrationChildDraft = {
  id: string;
  title: string;
  task: string;
  targetFiles: string;
  provider: ChatProvider;
  model: string;
  approvalMode: AgentApprovalMode;
  budgetSeconds: number;
  worktreeMode: OrchestrationWorktreeMode;
};

export type OrchestrationPreview = {
  children: OrchestrationChildDraft[];
  errors: string[];
  warnings: string[];
  totalBudgetSeconds: number;
};

const normalizeTarget = (value: string) => value.trim().replace(/^\.\//, "").replace(/\\/g, "/");

export const orchestrationTargets = (value: string): string[] => Array.from(new Set(
  value.split(/[\n,]/).map(normalizeTarget).filter(Boolean),
));

export const newOrchestrationChild = (
  index: number,
  provider: ChatProvider,
  approvalMode: AgentApprovalMode,
  id = `child-${crypto.randomUUID()}`,
): OrchestrationChildDraft => ({
  id,
  title: `Agent ${index + 1}`,
  task: "",
  targetFiles: "",
  provider,
  model: "",
  approvalMode,
  budgetSeconds: 900,
  worktreeMode: "shared",
});

export const buildOrchestrationPreview = (
  children: OrchestrationChildDraft[],
  activeRunCount: number,
): OrchestrationPreview => {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (children.length < MIN_ORCHESTRATION_CHILDREN || children.length > MAX_ORCHESTRATION_CHILDREN) {
    errors.push(`Choose ${MIN_ORCHESTRATION_CHILDREN}-${MAX_ORCHESTRATION_CHILDREN} child chats.`);
  }
  if (activeRunCount + children.length > MAX_CONCURRENT_CHAT_RUNS) {
    errors.push(`This launch would exceed the ${MAX_CONCURRENT_CHAT_RUNS}-run concurrency limit.`);
  }

  const sharedTargets = new Map<string, string[]>();
  children.forEach((child, index) => {
    const label = child.title.trim() || `Agent ${index + 1}`;
    if (!child.task.trim()) errors.push(`${label} needs a task.`);
    if (child.title.trim().length > 80) errors.push(`${label} has a title longer than 80 characters.`);
    if (child.model.length > 128 || child.model.split("").some((character) => character < " ")) {
      errors.push(`${label} has an invalid model override.`);
    }
    if (!Number.isInteger(child.budgetSeconds)
      || child.budgetSeconds < MIN_CHILD_BUDGET_SECONDS
      || child.budgetSeconds > MAX_CHILD_BUDGET_SECONDS) {
      errors.push(`${label} needs a ${MIN_CHILD_BUDGET_SECONDS}-${MAX_CHILD_BUDGET_SECONDS} second budget.`);
    }
    if (child.worktreeMode === "shared") {
      for (const target of orchestrationTargets(child.targetFiles)) {
        const owners = sharedTargets.get(target) ?? [];
        owners.push(label);
        sharedTargets.set(target, owners);
      }
    }
  });
  for (const [target, owners] of sharedTargets) {
    if (owners.length > 1) warnings.push(`${target} is assigned to ${owners.join(" and ")} in the shared workspace.`);
  }
  if (children.filter((child) => child.worktreeMode === "shared" && orchestrationTargets(child.targetFiles).length === 0).length > 1) {
    warnings.push("Multiple shared-workspace children have no file boundary; they may edit the same files.");
  }
  return {
    children: children.map((child) => ({ ...child, title: child.title.trim(), task: child.task.trim(), model: child.model.trim() })),
    errors,
    warnings,
    totalBudgetSeconds: children.reduce((total, child) => total + (Number.isFinite(child.budgetSeconds) ? child.budgetSeconds : 0), 0),
  };
};

export const childPrompt = (
  child: OrchestrationChildDraft,
  index: number,
  count: number,
  parentTitle: string,
): string => {
  const targets = orchestrationTargets(child.targetFiles);
  return [
    child.task.trim(),
    "",
    "Keelhouse child-chat contract:",
    `- Parent chat: ${parentTitle}`,
    `- Child: ${index + 1} of ${count}`,
    `- Time budget: ${child.budgetSeconds} seconds`,
    `- Workspace: ${child.worktreeMode === "isolated" ? "isolated Git worktree" : "shared project"}`,
    targets.length > 0 ? `- Intended files: ${targets.join(", ")}` : "- Intended files: not specified; inspect before editing",
    "- Return a concise result with changed files, verification, and unresolved risks.",
  ].join("\n");
};

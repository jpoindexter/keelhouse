import { describe, expect, it } from "vitest";

import {
  buildOrchestrationPreview,
  childPrompt,
  newOrchestrationChild,
  orchestrationTargets,
} from "./chatOrchestration";

describe("chat orchestration", () => {
  it("creates stable unique child ids", () => {
    const first = newOrchestrationChild(0, "codex", "ask");
    const second = newOrchestrationChild(0, "codex", "ask");
    expect(first.id).not.toBe(second.id);
  });

  it("accepts a bounded two-child plan and preserves explicit controls", () => {
    const children = [0, 1].map((index) => ({
      ...newOrchestrationChild(index, index === 0 ? "codex" : "claude", "ask"),
      task: `Task ${index + 1}`,
      model: index === 0 ? "gpt-5.5" : "sonnet",
      budgetSeconds: 300,
      worktreeMode: index === 0 ? "shared" as const : "isolated" as const,
    }));
    const preview = buildOrchestrationPreview(children, 1);
    expect(preview.errors).toEqual([]);
    expect(preview.totalBudgetSeconds).toBe(600);
    expect(preview.children.map((child) => child.provider)).toEqual(["codex", "claude"]);
  });

  it("blocks invalid counts, resource overflow, empty tasks, and invalid budgets", () => {
    const child = { ...newOrchestrationChild(0, "codex", "ask"), budgetSeconds: 5 };
    const preview = buildOrchestrationPreview([child], 8);
    expect(preview.errors).toEqual(expect.arrayContaining([
      "Choose 2-8 child chats.",
      "This launch would exceed the 8-run concurrency limit.",
      "Agent 1 needs a task.",
      "Agent 1 needs a 30-3600 second budget.",
    ]));
  });

  it("warns when shared children claim the same file or have no boundary", () => {
    const first = { ...newOrchestrationChild(0, "codex", "ask"), task: "One", targetFiles: "src/App.tsx" };
    const second = { ...newOrchestrationChild(1, "codex", "ask"), task: "Two", targetFiles: "./src/App.tsx" };
    const overlap = buildOrchestrationPreview([first, second], 0);
    expect(overlap.warnings[0]).toContain("src/App.tsx is assigned");

    const unbounded = buildOrchestrationPreview([
      { ...first, targetFiles: "" },
      { ...second, targetFiles: "" },
    ], 0);
    expect(unbounded.warnings).toContain("Multiple shared-workspace children have no file boundary; they may edit the same files.");
  });

  it("normalizes target lists and builds an attributed child prompt", () => {
    expect(orchestrationTargets("./src/A.ts, src/B.ts\nsrc/A.ts")).toEqual(["src/A.ts", "src/B.ts"]);
    const prompt = childPrompt({
      ...newOrchestrationChild(1, "claude", "approveSafe"),
      task: "Review auth",
      targetFiles: "src/auth.ts",
      budgetSeconds: 120,
      worktreeMode: "isolated",
    }, 1, 3, "Parent work");
    expect(prompt).toContain("Child: 2 of 3");
    expect(prompt).toContain("isolated Git worktree");
    expect(prompt).toContain("src/auth.ts");
  });
});

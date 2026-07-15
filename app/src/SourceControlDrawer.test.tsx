import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { SourceControlDrawer } from "./SourceControlDrawer";

describe("SourceControlDrawer", () => {
  it("renders repository summary and changed files", () => {
    const html = renderToStaticMarkup(<SourceControlDrawer error={null} hasWorkspace loading={false} status={{ isRepository: true, branch: "main", ahead: 1, behind: 0, staged: 1, untracked: 0, files: [{ index: "M", worktree: " ", path: "src/App.tsx" }] }} onOpenDiff={vi.fn()} onRefresh={vi.fn()} />);
    expect(html).toContain("main");
    expect(html).toContain("App.tsx");
    expect(html).toContain("Review diff");
  });

  it("renders non-repository state", () => {
    const html = renderToStaticMarkup(<SourceControlDrawer error={null} hasWorkspace loading={false} status={{ isRepository: false, branch: null, ahead: 0, behind: 0, staged: 0, untracked: 0, files: [] }} onOpenDiff={vi.fn()} onRefresh={vi.fn()} />);
    expect(html).toContain("not a Git repository");
  });
});

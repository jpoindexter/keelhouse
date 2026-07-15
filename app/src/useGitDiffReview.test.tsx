// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { resolveAppAction } from "./appActions";
import type { GitStatusFile } from "./fileGitStatus";
import { useGitDiffReview, type GitDiffReviewServices } from "./useGitDiffReview";

const file: GitStatusFile = { index: " ", path: "src/App.tsx", worktree: "M" };
const response = { diff: "@@ -1 +1 @@\n-old\n+new\n", path: file.path, source: "worktree" };
const status = {
  ahead: 0, behind: 0, branch: "main", files: [file], isRepository: true,
  staged: 0, unstaged: 1, untracked: 0,
};

const setup = (overrides: Partial<GitDiffReviewServices> = {}) => {
  const services: GitDiffReviewServices = {
    copyText: vi.fn().mockResolvedValue(undefined),
    readDiff: vi.fn().mockResolvedValue(response),
    runFileAction: vi.fn().mockResolvedValue(status),
    ...overrides,
  };
  const gateAction = vi.fn((action) => resolveAppAction(action, "fullAccess"));
  const onStatus = vi.fn();
  const hook = renderHook(() => useGitDiffReview({
    gateAction, getRoot: () => "/workspace", hasUnsaved: () => false,
    onRefreshFiles: vi.fn(), onStatus, services,
  }));
  return { ...hook, gateAction, onStatus, services };
};

describe("useGitDiffReview", () => {
  it("loads and parses an approved diff", async () => {
    const { result, services } = setup();
    await act(() => result.current.open(file));

    expect(services.readDiff).toHaveBeenCalledWith("/workspace", file.path);
    expect(result.current.review?.parsed.additions).toBe(1);
    expect(result.current.review?.absolutePath).toBe("/workspace/src/App.tsx");
    expect(result.current.error).toBeNull();
  });

  it("blocks discard when the editor has an unsaved buffer", async () => {
    const services: GitDiffReviewServices = {
      copyText: vi.fn(), readDiff: vi.fn(), runFileAction: vi.fn(),
    };
    const { result } = renderHook(() => useGitDiffReview({
      gateAction: vi.fn(), getRoot: () => "/workspace", hasUnsaved: () => true,
      onRefreshFiles: vi.fn(), onStatus: vi.fn(), services,
    }));
    await act(() => result.current.runFileAction("discard", file));

    expect(result.current.error).toMatch(/unsaved editor draft/i);
    expect(services.runFileAction).not.toHaveBeenCalled();
  });

  it("copies the currently shown diff", async () => {
    const { result, services } = setup();
    await act(() => result.current.open(file));
    await act(() => result.current.copy());

    expect(services.copyText).toHaveBeenCalledWith(response.diff);
  });
});

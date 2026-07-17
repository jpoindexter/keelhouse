// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorktreeLabelDialog } from "./WorktreeLabelDialog";

afterEach(cleanup);

describe("WorktreeLabelDialog", () => {
  it("submits a trimmed worktree label and disables empty submission", () => {
    const onSubmit = vi.fn();
    const { rerender } = render(<WorktreeLabelDialog open value="" onCancel={vi.fn()} onChange={vi.fn()} onSubmit={onSubmit} />);
    expect(screen.getByRole("button", { name: "Create worktree" }).hasAttribute("disabled")).toBe(true);

    rerender(<WorktreeLabelDialog open value="  native qa  " onCancel={vi.fn()} onChange={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: "Create worktree" }));
    expect(onSubmit).toHaveBeenCalledWith("native qa");
  });

  it("cancels with Escape and returns focus to the invoking control", async () => {
    const onCancel = vi.fn();
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    const { unmount } = render(<WorktreeLabelDialog open value="qa" onCancel={onCancel} onChange={vi.fn()} onSubmit={vi.fn()} />);

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Worktree label" })));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledOnce();
    unmount();
    expect(document.activeElement).toBe(trigger);
  });
});

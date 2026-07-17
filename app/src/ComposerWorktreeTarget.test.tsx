// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ComposerWorktreeTarget } from "./ComposerWorktreeTarget";

const worktree = { paneId: "8", projectRoot: "/repo", path: "/repo/.worktrees/api", branch: "worktree/api", label: "API", createdAt: 1 };
const props = (overrides = {}) => ({
  activePaneId: null as number | null,
  onLocal: vi.fn(), onNew: vi.fn(), onSelect: vi.fn(), worktrees: [worktree], ...overrides,
});

afterEach(cleanup);

describe("ComposerWorktreeTarget", () => {
  it("shows local, project worktrees, and the real new-worktree action", () => {
    const input = props();
    const { getByRole } = render(<ComposerWorktreeTarget {...input} />);

    fireEvent.click(getByRole("button", { name: "Choose execution target, Local" }));
    fireEvent.click(getByRole("menuitemradio", { name: "API, worktree/api" }));
    expect(input.onSelect).toHaveBeenCalledWith(8);

    fireEvent.click(getByRole("button", { name: "Choose execution target, Local" }));
    fireEvent.click(getByRole("menuitem", { name: "New worktree…" }));
    expect(input.onNew).toHaveBeenCalledOnce();
  });

  it("marks the active target and returns focus on Escape", () => {
    const { getByRole } = render(<ComposerWorktreeTarget {...props({ activePaneId: 8 })} />);
    const trigger = getByRole("button", { name: "Choose execution target, API" });

    fireEvent.click(trigger);
    expect(getByRole("menuitemradio", { name: "API, worktree/api" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.keyDown(getByRole("menu", { name: "Execution target" }), { key: "Escape" });

    expect(document.activeElement).toBe(trigger);
  });

  it("uses Arrow keys and Enter to choose local execution", () => {
    const input = props({ activePaneId: 8 });
    const { getByRole } = render(<ComposerWorktreeTarget {...input} />);

    fireEvent.click(getByRole("button", { name: "Choose execution target, API" }));
    const menu = getByRole("menu", { name: "Execution target" });
    fireEvent.keyDown(menu, { key: "ArrowUp" });
    fireEvent.keyDown(menu, { key: "Enter" });

    expect(input.onLocal).toHaveBeenCalledOnce();
  });
});

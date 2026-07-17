// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProjectSwitcher, projectSwitcherItems } from "./ProjectSwitcher";

afterEach(cleanup);

const createProps = () => ({
  activeProjectPath: "/repo/beta",
  open: true,
  openProjects: [
    { path: "/repo/alpha", status: "running" as const },
    { path: "/repo/beta", status: "exited" as const },
  ],
  recentProjects: ["/repo/beta", "/repo/gamma", "/repo/alpha/"],
  onClose: vi.fn(),
  onNewProject: vi.fn(),
  onOpenProject: vi.fn(),
  onSelectProject: vi.fn(),
});

describe("ProjectSwitcher", () => {
  it("combines open and recent projects without duplicate canonical paths", () => {
    const items = projectSwitcherItems(
      createProps().openProjects,
      createProps().recentProjects,
      "/repo/beta",
    );

    expect(items.map((item) => item.path)).toEqual(["/repo/alpha", "/repo/beta", "/repo/gamma"]);
    expect(items.find((item) => item.path === "/repo/beta")?.current).toBe(true);
    expect(items.find((item) => item.path === "/repo/gamma")?.open).toBe(false);
  });

  it("searches by project name or path and marks the current project", () => {
    render(<ProjectSwitcher {...createProps()} />);
    expect(screen.getByRole("option", { name: /Current project beta/ }).getAttribute("aria-selected")).toBe("true");

    fireEvent.change(screen.getByRole("searchbox", { name: "Search projects" }), {
      target: { value: "gamma" },
    });

    expect(screen.getByRole("option", { name: /Switch to project gamma/ })).not.toBeNull();
    expect(screen.queryByRole("option", { name: /alpha/ })).toBeNull();
  });

  it("supports arrow navigation, Enter selection, and closes after selection", async () => {
    const props = createProps();
    render(<ProjectSwitcher {...props} />);
    const search = screen.getByRole("searchbox", { name: "Search projects" });

    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "Enter" });

    await waitFor(() => expect(props.onSelectProject).toHaveBeenCalledWith("/repo/gamma"));
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it("routes New Project and Open Project through shared footer actions", () => {
    const props = createProps();
    const { rerender } = render(<ProjectSwitcher {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "New Project…" }));
    expect(props.onNewProject).toHaveBeenCalledOnce();
    expect(props.onClose).toHaveBeenCalledOnce();

    props.onClose.mockClear();
    rerender(<ProjectSwitcher {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Project…" }));
    expect(props.onOpenProject).toHaveBeenCalledOnce();
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it("closes on Escape and restores focus to the trigger", () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Projects";
    document.body.append(trigger);
    trigger.focus();
    const props = createProps();
    const { rerender } = render(<ProjectSwitcher {...props} />);

    fireEvent.keyDown(screen.getByRole("searchbox", { name: "Search projects" }), { key: "Escape" });
    expect(props.onClose).toHaveBeenCalledOnce();
    rerender(<ProjectSwitcher {...props} open={false} />);

    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});

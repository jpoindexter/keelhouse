// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProjectThreadsDrawer, type ProjectThreadsDrawerProps } from "./ProjectThreadsDrawer";

const props = (overrides: Partial<ProjectThreadsDrawerProps> = {}): ProjectThreadsDrawerProps => ({
  activeProjectPath: "/repo", activeSessionId: "one", backgroundExits: [], expandedProjects: {},
  projects: [{ path: "/repo", status: "exited" }], recentProjects: ["/recent"], newTaskShortcut: "Cmd+N", sessionsByProject: { "/repo": [{ id: "one", title: "Current work", status: "exited", updatedAt: Date.now() }] },
  switcherOpen: false,
  showArchived: false, projectStatus: () => "exited", sessionStatus: () => "exited",
  onNewProject: vi.fn(), onNewTask: vi.fn(), onOpenProject: vi.fn(), onProjectContextMenu: vi.fn(), onSelectProject: vi.fn(), onSelectSession: vi.fn(),
  onSwitcherOpenChange: vi.fn(),
  onSessionContextMenu: vi.fn(), onToggleArchived: vi.fn(), onToggleExpanded: vi.fn(), ...overrides,
});

describe("ProjectThreadsDrawer", () => {
  it("renders the active project and chat", () => {
    const html = renderToStaticMarkup(<ProjectThreadsDrawer {...props()} />);
    expect(html).toContain('aria-label="Switch project"');
    expect(html).toContain('aria-label="New Task (Cmd+N)"');
    expect(html).toContain("Cmd+N");
    expect(html).toContain("Active project repo, Idle");
    expect(html).toContain("Active chat Current work, Idle");
  });

  it("renders actionable first-use project entry", () => {
    const input = props({ activeProjectPath: null, projects: [], recentProjects: [] });
    const { getByRole, getByText } = render(<ProjectThreadsDrawer {...input} />);
    expect(getByText("Start with a project")).toBeTruthy();
    fireEvent.click(getByRole("button", { name: "Open Project…" }));
    fireEvent.click(getByRole("button", { name: "New Project…" }));
    expect(input.onOpenProject).toHaveBeenCalledOnce();
    expect(input.onNewProject).toHaveBeenCalledOnce();
  });

  it("keeps a cleared project list neutral", () => {
    const { getByText } = render(<ProjectThreadsDrawer {...props({ activeProjectPath: null, projects: [], recentProjects: ["/recent"] })} />);
    expect(getByText("No projects are open")).toBeTruthy();
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ProjectThreadsDrawer, type ProjectThreadsDrawerProps } from "./ProjectThreadsDrawer";

const props = (overrides: Partial<ProjectThreadsDrawerProps> = {}): ProjectThreadsDrawerProps => ({
  activeProjectPath: "/repo", activeSessionId: "one", backgroundExits: [], expandedProjects: {},
  projects: [{ path: "/repo", status: "exited" }], recentProjects: ["/recent"], sessionsByProject: { "/repo": [{ id: "one", title: "Current work", status: "exited", updatedAt: Date.now() }] },
  showArchived: false, projectStatus: () => "exited", sessionStatus: () => "exited",
  onNewProject: vi.fn(), onOpenProject: vi.fn(), onProjectContextMenu: vi.fn(), onSelectProject: vi.fn(), onSelectSession: vi.fn(),
  onSessionContextMenu: vi.fn(), onToggleArchived: vi.fn(), onToggleExpanded: vi.fn(), ...overrides,
});

describe("ProjectThreadsDrawer", () => {
  it("renders the active project and chat", () => {
    const html = renderToStaticMarkup(<ProjectThreadsDrawer {...props()} />);
    expect(html).toContain('aria-label="Switch project"');
    expect(html).toContain("Active project repo, Idle");
    expect(html).toContain("Active chat Current work, Idle");
  });

  it("renders the empty workspace prompt", () => {
    const html = renderToStaticMarkup(<ProjectThreadsDrawer {...props({ projects: [] })} />);
    expect(html).toContain("Open or create a project to start a chat");
  });
});

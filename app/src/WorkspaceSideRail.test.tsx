import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { WorkspaceSideRail, type WorkspaceSideRailProps } from "./WorkspaceSideRail";

const props = (overrides: Partial<WorkspaceSideRailProps> = {}): WorkspaceSideRailProps => ({
  activeTitle: "Files",
  browser: {
    address: "http://localhost:3000", canGoBack: false, canGoForward: false,
    detectedPaneLabel: null, detectedUrl: null, error: null, url: "http://localhost:3000",
    onAddressChange: vi.fn(), onBack: vi.fn(), onForward: vi.fn(), onOpenDetected: vi.fn(),
    onOpenExternal: vi.fn(), onReload: vi.fn(), onShow: vi.fn(), onSubmit: vi.fn(),
  },
  collapsed: false,
  files: {
    fileOpError: null, fileTree: [], fileTreeError: null, fileTreeLoading: false,
    fileTreeTruncated: false, railBodyRef: { current: null }, railHeight: 400,
    treeRef: { current: null }, visibleFileTree: [], workspaceName: null, workspacePath: null,
    onCreateFile: vi.fn(), onCreateFolder: vi.fn(), onOpenFile: vi.fn(),
    onOpenFolder: vi.fn(), onWorkspaceContextMenu: vi.fn(),
  },
  git: {
    error: null, hasWorkspace: false, loading: false, status: null,
    onOpenDiff: vi.fn(), onRefresh: vi.fn(),
  },
  mode: "projects",
  onOpenSettings: vi.fn(),
  onSelectMode: vi.fn(),
  projects: {
    activeProjectPath: null, activeSessionId: null, backgroundExits: [],
    expandedProjects: {}, projects: [], recentProjects: [], newTaskShortcut: "Cmd+N", sessionsByProject: {}, showArchived: false, switcherOpen: false,
    projectStatus: () => "running" as const, sessionStatus: () => "running" as const,
    onNewProject: vi.fn(), onNewTask: vi.fn(), onOpenProject: vi.fn(), onProjectContextMenu: vi.fn(), onSelectProject: vi.fn(), onSelectSession: vi.fn(),
    onSessionContextMenu: vi.fn(), onSwitcherOpenChange: vi.fn(), onToggleArchived: vi.fn(), onToggleExpanded: vi.fn(),
  },
  settings: {
    approvalMode: "ask", canSetApproval: false, hasWorkspace: false,
    launchProfile: { id: "zsh", label: "zsh", command: "zsh", args: [], useLoginShell: true },
    launchProfileChanging: false, launchProfiles: [], terminalOpen: false,
    toolMode: "files", workbenchLayout: "right",
    onApprovalChange: vi.fn(), onBottomTrayChange: vi.fn(), onLayoutChange: vi.fn(),
    onOpenFolder: vi.fn(), onProfileChange: vi.fn(), onRefreshFiles: vi.fn(),
    onToolModeChange: vi.fn(),
  },
  ...overrides,
});

describe("WorkspaceSideRail", () => {
  it("renders the mode switcher tabs with the active tab selected", () => {
    const html = renderToStaticMarkup(<WorkspaceSideRail {...props()} />);
    for (const label of ["Projects", "Files", "Git", "Browser", "Settings"]) {
      expect(html).toContain(label);
    }
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain("Threads");
  });

  it("renders the active drawer body when expanded", () => {
    const html = renderToStaticMarkup(<WorkspaceSideRail {...props()} />);
    expect(html).toContain("Start with a project");
    expect(html).toContain("Open Project…");
    expect(html).toContain("New Project…");
  });

  it("hides drawer bodies when collapsed", () => {
    const html = renderToStaticMarkup(<WorkspaceSideRail {...props({ collapsed: true })} />);
    expect(html).toContain("file-rail--collapsed");
    expect(html).not.toContain("Open or create a project to start a chat");
  });

  it("titles the toolbar with the active drawer name outside projects mode", () => {
    const html = renderToStaticMarkup(<WorkspaceSideRail {...props({ activeTitle: "Git", mode: "git" })} />);
    expect(html).not.toContain("Threads");
    expect(html).toContain("Open a folder to read source control");
  });
});

import { describe, expect, it } from "vitest";
import { appTitlebarPropsFrom, nextToolsLayout } from "./appTitlebarHost";
import { vi } from "vitest";

describe("nextToolsLayout", () => {
  it("hides visible tools", () => {
    expect(nextToolsLayout("right", "right")).toBe("hidden");
    expect(nextToolsLayout("left", "left")).toBe("hidden");
  });

  it("restores the stored dock side when tools are hidden", () => {
    expect(nextToolsLayout("hidden", "left")).toBe("left");
    expect(nextToolsLayout("hidden", "right")).toBe("right");
  });

  it("falls back to the right dock when no side was ever stored", () => {
    expect(nextToolsLayout("hidden", "hidden")).toBe("right");
  });
});

describe("appTitlebarPropsFrom", () => {
  const createInput = () => ({
    activeSessionTitle: "Chat",
    createSession: vi.fn(async () => {}),
    openCommandPalette: vi.fn(),
    openSettings: vi.fn(),
    openWorkspaceFolder: vi.fn(async () => {}),
    renderedLayout: "hidden" as const,
    resetInterface: vi.fn(),
    setLayout: vi.fn(),
    setToolMode: vi.fn(),
    sideDrawerCollapsed: true,
    storedLayout: "left" as const,
    surfaceLabel: "Codex",
    surfaceState: "running" as const,
    surfaceStatusLabel: "Running",
    terminalOpen: false,
    toggleRawTerminal: vi.fn(async () => {}),
    toggleSideDrawer: vi.fn(),
    toolMode: "files" as const,
    workspacePath: "/repo" as string | null,
  });

  it("derives workspace, drawer, and tools visibility flags", () => {
    const props = appTitlebarPropsFrom(createInput());
    expect(props.hasWorkspace).toBe(true);
    expect(props.sideDrawerOpen).toBe(false);
    expect(props.toolsOpen).toBe(false);
    expect(props.primarySurfaceLabel).toBe("Codex");
  });

  it("guards chat creation and workspace opening on an active workspace", () => {
    const input = { ...createInput(), workspacePath: null };
    const props = appTitlebarPropsFrom(input);
    props.onCreateChat();
    props.onOpenWorkspace();
    expect(input.createSession).not.toHaveBeenCalled();
    expect(input.openWorkspaceFolder).not.toHaveBeenCalled();

    const active = createInput();
    const activeProps = appTitlebarPropsFrom(active);
    activeProps.onCreateChat();
    activeProps.onOpenWorkspace();
    expect(active.createSession).toHaveBeenCalledWith("/repo");
    expect(active.openWorkspaceFolder).toHaveBeenCalledWith("/repo");
  });

  it("toggles tools through the stored dock side", () => {
    const input = createInput();
    const props = appTitlebarPropsFrom(input);
    props.onToggleTools();
    expect(input.setLayout).toHaveBeenCalledWith("left");
    props.onToggleTerminal();
    expect(input.toggleRawTerminal).toHaveBeenCalled();
  });
});

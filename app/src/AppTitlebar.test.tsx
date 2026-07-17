import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AppTitlebar, type AppTitlebarProps } from "./AppTitlebar";

const props = (overrides: Partial<AppTitlebarProps> = {}): AppTitlebarProps => ({
  activeSessionTitle: "Chrome quality pass", hasWorkspace: true, layout: "right",
  primarySurfaceLabel: "Codex", primarySurfaceState: "idle", primarySurfaceStatusLabel: "Ready",
  sideDrawerOpen: true, terminalOpen: false, toolMode: "files", toolsOpen: true,
  onCreateChat: vi.fn(), onLayoutChange: vi.fn(), onOpenCommandPalette: vi.fn(),
  onOpenSettings: vi.fn(), onOpenWorkspace: vi.fn(), onResetInterface: vi.fn(),
  onToggleSideDrawer: vi.fn(), onToggleTerminal: vi.fn(), onToggleTools: vi.fn(),
  onToolModeChange: vi.fn(), ...overrides,
});

describe("AppTitlebar", () => {
  it("renders the three chrome control groups", () => {
    const html = renderToStaticMarkup(<AppTitlebar {...props()} />);
    expect(html).toContain("Toggle Threads");
    expect(html).toContain("Chrome quality pass");
    expect(html).toContain("Toggle Terminal tray");
    expect(html).toContain("Codex");
  });

  it("keeps New Task available while disabling project-only actions", () => {
    const html = renderToStaticMarkup(<AppTitlebar {...props({ hasWorkspace: false })} />);
    expect(html).toContain('aria-label="New Task"');
    expect(html).not.toContain('aria-label="New Task" disabled=""');
    expect(html).toContain('aria-label="Open workspace externally" disabled=""');
  });
});

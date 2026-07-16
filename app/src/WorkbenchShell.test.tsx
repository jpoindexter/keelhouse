import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { WorkbenchShell, type WorkbenchShellProps } from "./WorkbenchShell";

const props = (overrides: Partial<WorkbenchShellProps["layout"]> = {}): WorkbenchShellProps => ({
  handlers: {
    beginSideDrawerResize: vi.fn(),
    hideTools: vi.fn(),
    nudgeSideDrawerResize: vi.fn(),
    setToolTrayMode: vi.fn(),
  },
  layout: {
    appShellStyle: {},
    renderedWorkbenchLayout: "right",
    settingsOpen: false,
    sideDrawerCollapsed: false,
    surfaceMode: "chat",
    toolTrayMode: "files",
    utilityTrayHeight: 200,
    workbenchStyle: {},
    ...overrides,
  },
  refs: { workbenchRef: { current: null } },
  slots: {
    main: <div data-testid="slot-main" />,
    overlays: <div data-testid="slot-overlays" />,
    rail: <div data-testid="slot-rail" />,
    titlebar: <div data-testid="slot-titlebar" />,
  },
});

describe("WorkbenchShell", () => {
  it("renders every slot inside the shell scaffolding", () => {
    const html = renderToStaticMarkup(<WorkbenchShell {...props()} />);

    for (const slot of ["titlebar", "rail", "main", "overlays"]) {
      expect(html).toContain(`slot-${slot}`);
    }
    expect(html).toContain("side-drawer-resizer");
    expect(html).toContain("workbench workbench--drawer-right workbench--tools-files");
    expect(html).toContain("--utility-tray-height:42px");
  });

  it("collapses chrome for drawer, tools, and open terminal tray", () => {
    const html = renderToStaticMarkup(<WorkbenchShell {...props({
      renderedWorkbenchLayout: "hidden",
      sideDrawerCollapsed: true,
      surfaceMode: "terminal",
    })} />);

    expect(html).toContain("app-shell--side-drawer-collapsed");
    expect(html).toContain("app-shell--tools-hidden");
    expect(html).not.toContain("side-drawer-resizer");
    expect(html).toContain("workbench--utility-open");
    expect(html).toContain("--utility-tray-height:200px");
  });
});

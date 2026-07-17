import { describe, expect, it } from "vitest";

import {
  DEFAULT_SIDE_DRAWER_WIDTH,
  DEFAULT_TOOL_TRAY_MODE,
  DEFAULT_WORKBENCH_LAYOUT,
  DEFAULT_WORKBENCH_SIZING,
  effectiveWorkbenchLayout,
  normalizeStoredSideDrawerWidth,
  runColumnWidth,
  usableAgentWidth,
} from "./workbenchLayout";

describe("workbench layout contract", () => {
  it("opens agent-first with the files dock on the right", () => {
    expect(DEFAULT_WORKBENCH_LAYOUT).toBe("right");
    expect(DEFAULT_TOOL_TRAY_MODE).toBe("files");
    expect(DEFAULT_SIDE_DRAWER_WIDTH).toBe(332);
  });

  it("hides side-docked tools at the demo breakpoint before they squeeze the thread", () => {
    expect(effectiveWorkbenchLayout("right", 1024)).toBe("hidden");
    expect(effectiveWorkbenchLayout("left", 1024)).toBe("hidden");
    expect(effectiveWorkbenchLayout("right", 1120)).toBe("hidden");
    expect(effectiveWorkbenchLayout("right", 1180)).toBe("hidden");
    expect(effectiveWorkbenchLayout("right", 1360)).toBe("hidden");
    expect(effectiveWorkbenchLayout("right", 1361)).toBe("right");
    expect(effectiveWorkbenchLayout("right", 1440)).toBe("right");
    expect(effectiveWorkbenchLayout("hidden", 800)).toBe("hidden");
  });

  it("allows an explicit icon click to reopen a panel at narrow widths", () => {
    expect(effectiveWorkbenchLayout("right", 1024, true)).toBe("right");
    expect(effectiveWorkbenchLayout("left", 1232, true)).toBe("left");
  });

  it("keeps a readable agent surface at the supported minimum window width", () => {
    expect(
      usableAgentWidth({
        viewportWidth: 900,
        drawerWidth: 240,
        drawerCollapsed: false,
        layout: effectiveWorkbenchLayout("right", 900),
        trayPercent: DEFAULT_WORKBENCH_SIZING.trayPercent,
      }),
    ).toBeGreaterThanOrEqual(600);
  });

  it("returns the drawer width to the agent surface when Threads is hidden", () => {
    expect(
      usableAgentWidth({
        viewportWidth: 900,
        drawerWidth: 332,
        drawerCollapsed: true,
        layout: "hidden",
        trayPercent: DEFAULT_WORKBENCH_SIZING.trayPercent,
      }),
    ).toBe(900);
  });

  it("keeps the centered run column at or above the 600px legibility floor at 900px", () => {
    const agentWidth = usableAgentWidth({
      viewportWidth: 900,
      drawerWidth: 240,
      drawerCollapsed: false,
      layout: effectiveWorkbenchLayout("right", 900),
      trayPercent: DEFAULT_WORKBENCH_SIZING.trayPercent,
    });
    expect(runColumnWidth(agentWidth)).toBeGreaterThanOrEqual(600);
    // Wide windows keep the demo's 860px cap and 56px breathing room.
    expect(runColumnWidth(1400)).toBe(860);
  });
});

describe("normalizeStoredSideDrawerWidth", () => {
  it("uses the product default when no stored width exists", () => {
    expect(normalizeStoredSideDrawerWidth(null)).toBe(DEFAULT_SIDE_DRAWER_WIDTH);
    expect(normalizeStoredSideDrawerWidth("")).toBe(DEFAULT_SIDE_DRAWER_WIDTH);
    expect(normalizeStoredSideDrawerWidth("not-a-number")).toBe(DEFAULT_SIDE_DRAWER_WIDTH);
  });

  it("restores valid widths and clamps stale values", () => {
    expect(normalizeStoredSideDrawerWidth("300")).toBe(300);
    expect(normalizeStoredSideDrawerWidth("100")).toBe(220);
    expect(normalizeStoredSideDrawerWidth("500")).toBe(420);
  });
});

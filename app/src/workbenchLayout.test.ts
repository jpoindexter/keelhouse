import { describe, expect, it } from "vitest";

import {
  DEFAULT_SIDE_DRAWER_WIDTH,
  DEFAULT_TOOL_TRAY_MODE,
  DEFAULT_WORKBENCH_LAYOUT,
  DEFAULT_WORKBENCH_SIZING,
  effectiveWorkbenchLayout,
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
    expect(effectiveWorkbenchLayout("right", 1180)).toBe("right");
    expect(effectiveWorkbenchLayout("right", 1440)).toBe("right");
    expect(effectiveWorkbenchLayout("hidden", 800)).toBe("hidden");
  });

  it("allows an explicit icon click to reopen a panel at narrow widths", () => {
    expect(effectiveWorkbenchLayout("right", 1024, true)).toBe("right");
    expect(effectiveWorkbenchLayout("left", 900, true)).toBe("left");
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

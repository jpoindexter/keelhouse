import { describe, expect, it } from "vitest";
import { normalizeTerminalPaneLabel, terminalPaneCwdLabel, terminalPaneDisplayName, terminalPaneLabelForDisplay, terminalPaneProjectStatus, terminalPaneStateLabel } from "./terminalPane";

describe("terminal pane metadata", () => {
  it("formats lifecycle state for the terminal header", () => {
    expect(terminalPaneStateLabel("idle", null)).toBe("No pane");
    expect(terminalPaneStateLabel("starting", null)).toBe("Starting");
    expect(terminalPaneStateLabel("running", null)).toBe("Running");
    expect(terminalPaneStateLabel("exited", 130)).toBe("Exited 130");
    expect(terminalPaneStateLabel("error", null)).toBe("Error");
  });

  it("formats cwd compactly without losing the full path title", () => {
    expect(terminalPaneCwdLabel(null)).toBe("No cwd");
    expect(terminalPaneCwdLabel("/Users/jasonpoindexter/Documents/GitHub/apps/agent cli")).toBe("agent cli");
  });

  it("labels panes by profile and one-based index", () => {
    expect(terminalPaneDisplayName("Claude", 0)).toBe("Claude 1");
    expect(terminalPaneDisplayName("Shell", 2)).toBe("Shell 3");
  });

  it("normalizes custom pane labels and falls back to profile labels", () => {
    expect(normalizeTerminalPaneLabel("  docs   agent  ")).toBe("docs agent");
    expect(normalizeTerminalPaneLabel("")).toBeNull();
    expect(terminalPaneLabelForDisplay("review pass", "Claude", 0)).toBe("review pass");
    expect(terminalPaneLabelForDisplay(" ", "Claude", 0)).toBe("Claude 1");
  });

  it("aggregates project status from all panes", () => {
    expect(terminalPaneProjectStatus([{ state: "running" }, { state: "exited" }])).toBe("running");
    expect(terminalPaneProjectStatus([{ state: "starting" }])).toBe("running");
    expect(terminalPaneProjectStatus([{ state: "exited" }, { state: "exited" }])).toBe("exited");
    expect(terminalPaneProjectStatus([])).toBe("attention");
    expect(terminalPaneProjectStatus([{ state: "error" }])).toBe("attention");
  });
});

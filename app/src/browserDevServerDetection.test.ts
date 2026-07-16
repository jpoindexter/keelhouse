import { describe, expect, it } from "vitest";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import { resolveBrowserDevServerDetection } from "./browserDevServerDetection";

const pane: ManagedTerminalPane = {
  createdAt: 10,
  cwd: "/repo",
  exitCode: null,
  id: 7,
  label: "Dev",
  profile: { args: [], command: "/bin/zsh", id: "shell", label: "Shell", useLoginShell: false },
  slot: 0,
  state: "running",
};

const createInput = () => ({
  approvalMode: () => "approveSafe" as const,
  context: null,
  fallbackPanes: [pane],
  fallbackRoot: "/repo",
  fallbackSessionId: () => "session-1",
  now: () => 200,
  paneId: 7,
  previous: null,
  text: "VITE ready\nLocal: http://localhost:5173/",
});

describe("resolveBrowserDevServerDetection", () => {
  it("resolves a detected URL into scoped server and activity metadata", () => {
    const result = resolveBrowserDevServerDetection(createInput());

    expect(result?.server).toEqual({
      detectedAt: 200,
      paneId: 7,
      paneLabel: "Dev",
      projectId: "/repo",
      projectSessionId: "session-1",
      url: "http://localhost:5173/",
    });
    expect(result?.handle).toMatchObject({
      approvalMode: "approveSafe",
      paneId: 7,
      projectId: "/repo",
      projectSessionId: "session-1",
    });
  });

  it("prefers pane context and ignores duplicate detections", () => {
    const initial = resolveBrowserDevServerDetection({
      ...createInput(),
      context: { panes: [pane], projectRoot: "/worktree", sessionId: "session-2" },
    });

    expect(initial?.server.projectId).toBe("/worktree");
    expect(resolveBrowserDevServerDetection({
      ...createInput(), previous: initial?.server ?? null,
      context: { panes: [pane], projectRoot: "/worktree", sessionId: "session-2" },
    })).toBeNull();
  });

  it("returns null without a local URL or matching pane context", () => {
    expect(resolveBrowserDevServerDetection({ ...createInput(), text: "server ready" })).toBeNull();
    expect(resolveBrowserDevServerDetection({ ...createInput(), fallbackPanes: [] })).toBeNull();
  });
});

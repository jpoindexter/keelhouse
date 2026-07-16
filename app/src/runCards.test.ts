import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { AgentActivityEvent } from "./agentActivity";
import type { ChatMessage } from "./chatConversation";
import { runCardFromActivityEvent, runCardFromChatMessage } from "./runCards";

describe("run card provenance", () => {
  it("rejects tool-looking text without explicit provenance", () => {
    const fabricated = {
      id: "fake",
      role: "tool",
      title: "Edited files",
      text: "terminal said: edited src/App.tsx",
      itemId: "terminal-line-1",
      status: "complete",
      timestamp: 1,
    } satisfies ChatMessage;
    expect(runCardFromChatMessage(fabricated)).toBeNull();
  });

  it("accepts typed provider and hook events", () => {
    const provider = {
      id: "provider-file",
      role: "tool",
      title: "Edited files",
      text: "src/App.tsx",
      status: "complete",
      timestamp: 1,
      provenance: "provider",
      runCardKind: "file",
      targets: ["src/App.tsx"],
    } satisfies ChatMessage;
    expect(runCardFromChatMessage(provider)?.targets).toEqual(["src/App.tsx"]);

    const hook = {
      id: "hook-plan",
      projectId: "/repo",
      projectSessionId: "chat",
      paneId: "hook",
      kind: "tool",
      label: "Working plan",
      detail: "Run tests",
      status: "running",
      timestamp: 2,
      provenance: "agent-hook",
      runCardKind: "plan",
      targets: [],
    } satisfies AgentActivityEvent;
    expect(runCardFromActivityEvent(hook)?.kind).toBe("plan");
  });

  it("keeps the renderer on typed adapters instead of terminal snapshots", () => {
    const source = [
      readFileSync(new URL("./ChatToolMessage.tsx", import.meta.url), "utf8"),
      readFileSync(new URL("./AgentActivityTimeline.tsx", import.meta.url), "utf8"),
    ].join("\n");
    expect(source).toContain("runCardFromChatMessage");
    expect(source).toContain("runCardFromActivityEvent");
    expect(source).not.toContain("terminalSnapshotText");
    expect(source).not.toContain("paneTranscripts");
  });

  it("reveals the editor tray after Review opens a file or diff", () => {
    const source = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
    const reviewAction = source.slice(
      source.indexOf("const editorSurface"), source.indexOf("const gitActionLabel"),
    );

    expect(reviewAction).toContain('setToolTrayMode("editor")');
    expect(reviewAction).toContain('setWorkbenchLayout("right")');

    const navigation = readFileSync(new URL("./editorReviewNavigation.ts", import.meta.url), "utf8");
    expect(navigation).toContain("options.revealEditorTools()");
  });

  it("binds hook status cards to the durable chat handle", () => {
    const source = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
    const hookHandler = source.slice(source.indexOf("useAgentHookRequests({"), source.indexOf("const continuePendingNavigation"));

    expect(hookHandler).toContain("agentActivityHook.recordAgentActivity(agentActivityHook.activeChatActivityHandle()");
    expect(hookHandler).not.toContain("recordAgentActivity(activeAgentActivityHandle()");
  });
});

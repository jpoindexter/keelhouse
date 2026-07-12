import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AgentRunSurface } from "./AgentRunSurface";

describe("AgentRunSurface", () => {
  it("combines live output and activity provenance in one thread", () => {
    const html = renderToStaticMarkup(
      <AgentRunSurface
        events={[{
          id: "event-1",
          projectId: "/repo",
          projectSessionId: "session-1",
          paneId: "pane:1",
          kind: "file",
          label: "Edited a file",
          detail: "App.tsx",
          status: "complete",
          timestamp: 100,
        }]}
        hasPane
        transcript="Agent response"
      />,
    );

    expect(html).toContain("Agent response");
    expect(html).toContain("Edited a file");
    expect(html).toContain("App.tsx");
    expect(html).not.toContain(">Activity<");
    expect(html).not.toContain(">Clear<");
  });
});

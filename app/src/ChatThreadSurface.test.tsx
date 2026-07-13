import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ChatThreadSurface } from "./ChatThreadSurface";

describe("ChatThreadSurface", () => {
  it("renders independent user, assistant, and structured tool messages", () => {
    const html = renderToStaticMarkup(
      <ChatThreadSurface
        conversation={{
          provider: "codex",
          providerThreadId: "thread-1",
          updatedAt: 4,
          messages: [
            { id: "user-1", role: "user", text: "Inspect the repo", timestamp: 1 },
            { id: "tool-1", role: "tool", title: "Ran command", text: "git status\n\nclean", status: "complete", timestamp: 2 },
            { id: "assistant-1", role: "assistant", text: "The repo is clean.", timestamp: 3 },
          ],
        }}
        events={[]}
        onSuggestion={() => {}}
      />,
    );

    expect(html).toContain("You");
    expect(html).toContain("Inspect the repo");
    expect(html).toContain("Ran command");
    expect(html).toContain("The repo is clean.");
    expect(html).not.toContain("Terminal-backed");
  });

  it("offers concrete prompts in a new chat", () => {
    const html = renderToStaticMarkup(
      <ChatThreadSurface
        conversation={{ provider: "codex", messages: [], updatedAt: 0 }}
        events={[]}
        onSuggestion={() => {}}
      />,
    );
    expect(html).toContain("Start a new Codex chat");
    expect(html).toContain("Run the relevant tests");
  });
});

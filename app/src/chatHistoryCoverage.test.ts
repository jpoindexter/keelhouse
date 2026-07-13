import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const thread = readFileSync(new URL("./ChatThreadSurface.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("./App.css", import.meta.url), "utf8");

describe("chat history discovery production wiring", () => {
  it("searches durable history and opens stable message targets", () => {
    expect(app).toContain("searchDurableChatMessages");
    expect(app).toContain("openChatSearchResult(result)");
    expect(app).toContain('setFocusedChatMessageId(result.messageId ?? null)');
    expect(thread).toContain('data-message-id={message.id}');
    expect(thread).toContain('focusMessageId === message.id ? " chat-message--focused"');
  });

  it("exposes bookmark, pin, and archived-chat discovery controls", () => {
    expect(app).toContain("chatSearchBookmarksOnly");
    expect(app).toContain("toggleChatMessageBookmark");
    expect(app).toContain("pinProjectSession(projectPath, session, !session.pinnedAt)");
    expect(app).toContain('result.archived ? " · Archived" : ""');
    expect(thread).toContain('aria-label={message.bookmarked ? "Remove bookmark" : "Bookmark message"}');
  });

  it("keeps discovery controls flat and three-scoped", () => {
    expect(css).toMatch(/\.search-scope-tabs\s*\{[^}]*repeat\(3,/s);
    expect(css).toMatch(/\.chat-search-filter button\s*\{[^}]*border-radius:\s*0;/s);
    expect(css).toContain(".session-row__state > .session-row__pin");
    expect(css).toContain(".chat-message--focused");
  });
});

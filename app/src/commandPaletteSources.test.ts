import { describe, expect, it } from "vitest";

import {
  DEFAULT_COMMAND_PALETTE_SOURCES,
  normalizeCommandPaletteSources,
} from "./commandPaletteSources";

describe("command palette sources", () => {
  it("enables every real source by default", () => {
    expect(normalizeCommandPaletteSources(null)).toEqual(DEFAULT_COMMAND_PALETTE_SOURCES);
  });

  it("preserves known switches and enables newly added sources", () => {
    expect(normalizeCommandPaletteSources({ commands: false, files: true })).toEqual({
      chats: true,
      commands: false,
      files: true,
      tabs: true,
      worktrees: true,
    });
  });
});

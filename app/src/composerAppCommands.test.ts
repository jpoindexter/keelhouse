import { describe, expect, it } from "vitest";
import { composerAppAction } from "./composerAppCommands";

describe("composer app actions", () => {
  it("maps commands to attributed app actions", () => {
    expect(composerAppAction("save", "/repo/file.ts").kind).toBe("save-file");
    expect(composerAppAction("find", "/repo/file.ts").risk).toBe("low");
    expect(composerAppAction("open-folder").kind).toBe("open-folder");
    expect(composerAppAction("clear-terminal", "Shell 1").target).toBe("Shell 1");
  });
});

import { describe, expect, it } from "vitest";
import { prepareChatContext } from "./chatContext";
import { createComposerAttachment, defaultComposerHarnessState } from "./composerHarness";

describe("chat context", () => {
  it("builds inspectable file and image inputs from preflighted attachments", async () => {
    const state = {
      ...defaultComposerHarnessState(),
      goal: "Fix the regression",
      attachments: [
        createComposerAttachment({ kind: "file", label: "App.tsx", target: "/repo/App.tsx" }, 1),
        createComposerAttachment({ kind: "image", label: "failure.png", target: "/tmp/failure.png" }, 2),
        createComposerAttachment({ kind: "browser", label: "Preview", target: "http://localhost:3000" }, 3),
      ],
    };
    const result = await prepareChatContext("Investigate this", state, {
      readFile: async () => ({ path: "/repo/App.tsx", content: "export const ok = false;", bytes: 24 }),
      inspectImage: async () => ({ path: "/tmp/failure.png", bytes: 42, mimeType: "image/png" }),
    });
    expect(result.images).toEqual(["/tmp/failure.png"]);
    expect(result.prompt).toContain("Goal:\nFix the regression");
    expect(result.prompt).toContain("File: App.tsx (/repo/App.tsx, 24 bytes)\n\nexport const ok = false;");
    expect(result.prompt).toContain("Reference: Preview (http://localhost:3000)");
    expect(result.preview).toBe(result.prompt);
  });

  it("fails before composing a prompt when attachment preflight fails", async () => {
    const state = {
      ...defaultComposerHarnessState(),
      attachments: [createComposerAttachment({ kind: "file", label: ".env", target: "/repo/.env" }, 1)],
    };
    await expect(prepareChatContext("Send it", state, {
      readFile: async () => { throw new Error("Sensitive file cannot be attached to chat"); },
      inspectImage: async () => { throw new Error("unused"); },
    })).rejects.toThrow("Sensitive file");
  });
});

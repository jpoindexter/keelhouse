import { describe, expect, it } from "vitest";
import { browserQaFixture, createBrowserQaIpcHandler } from "./browserQa";

describe("browser QA IPC fixture", () => {
  it("restores a populated project and chat without a native backend", async () => {
    const invoke = createBrowserQaIpcHandler();

    await expect(invoke("resolve_workspace", { path: browserQaFixture.root })).resolves.toEqual({ root: browserQaFixture.root });
    await expect(invoke("list_workspace_tree")).resolves.toMatchObject({
      root: browserQaFixture.root,
      truncated: false,
    });
    await expect(invoke("load_chat_conversations")).resolves.toEqual({
      [browserQaFixture.chatId]: browserQaFixture.conversation,
    });
    await expect(invoke("take_agent_hook_requests")).resolves.toEqual([]);
  });

  it("implements the store resource contract used during startup", async () => {
    const invoke = createBrowserQaIpcHandler();

    await expect(invoke("plugin:store|load")).resolves.toBe(1);
    await expect(invoke("plugin:store|get", { key: "folder" })).resolves.toEqual([browserQaFixture.root, true]);
    await invoke("plugin:store|set", { key: "qa-test", value: "saved" });
    await expect(invoke("plugin:store|get", { key: "qa-test" })).resolves.toEqual(["saved", true]);
    await invoke("plugin:store|delete", { key: "qa-test" });
  });
});

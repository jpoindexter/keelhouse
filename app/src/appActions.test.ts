import { describe, expect, it } from "vitest";
import {
  appActionAuditLabel,
  appActionNeedsApproval,
  createAppAction,
  resolveAppAction,
} from "./appActions";

describe("app action gate", () => {
  it("auto-approves low-risk user actions", async () => {
    const action = createAppAction({
      kind: "open-file",
      label: "Open file",
      target: "App.tsx",
      risk: "low",
      requestedBy: "user",
    }, 100);
    expect(appActionNeedsApproval(action, "ask")).toBe(false);
    await expect(resolveAppAction(action, "ask", () => false, 101)).resolves.toMatchObject({
      actionId: "open-file:100",
      decision: "approved",
      prompted: false,
      timestamp: 101,
    });
  });

  it("prompts for composer mutations in ask mode", async () => {
    const action = createAppAction({
      kind: "create-pane",
      label: "Create pane",
      risk: "medium",
      requestedBy: "composer",
      undoHint: "Close the pane.",
    }, 200);
    expect(appActionNeedsApproval(action, "ask")).toBe(true);
    const audit = await resolveAppAction(action, "ask", () => true, 201);
    expect(audit).toMatchObject({
      decision: "approved",
      prompted: true,
      undoHint: "Close the pane.",
    });
    expect(appActionAuditLabel(audit)).toBe("Action approved");
  });

  it("blocks out-of-scope actions without prompting", async () => {
    const action = createAppAction({
      kind: "open-diff",
      label: "Open diff",
      risk: "blocked",
      requestedBy: "agent",
    }, 300);
    const audit = await resolveAppAction(action, "fullAccess", () => true, 301);
    expect(audit).toMatchObject({
      decision: "blocked",
      prompted: false,
      reason: "Action is outside the current app-owned surface.",
    });
    expect(appActionAuditLabel(audit)).toBe("Action blocked");
  });
});

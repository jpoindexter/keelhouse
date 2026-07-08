import { describe, expect, it } from "vitest";
import {
  DRAFT_SAVE_FAILURE_MESSAGE,
  discardDraftAndContinueNavigation,
  saveDraftAndContinueNavigation,
  shouldPromptForDirtyDraft,
} from "./draftProtection";

describe("dirty draft navigation protection", () => {
  it("does not interrupt clean navigation", () => {
    expect(shouldPromptForDirtyDraft(false, "/work/src/App.tsx", { kind: "file", path: "/work/src/Other.tsx" })).toBe(false);
    expect(shouldPromptForDirtyDraft(false, "/work/src/App.tsx", { kind: "workspace", path: "/other" })).toBe(false);
  });

  it("does not interrupt refocusing the same dirty file", () => {
    expect(shouldPromptForDirtyDraft(true, "/work/src/App.tsx", { kind: "file", path: "/work/src/App.tsx" })).toBe(false);
  });

  it("requires a decision before replacing a dirty file or workspace", () => {
    expect(shouldPromptForDirtyDraft(true, "/work/src/App.tsx", { kind: "file", path: "/work/src/Other.tsx" })).toBe(true);
    expect(shouldPromptForDirtyDraft(true, "/work/src/App.tsx", { kind: "workspace", path: "/other" })).toBe(true);
  });

  it("keeps the pending navigation and draft when saving fails", async () => {
    const events: string[] = [];
    let pending: string | null = "other-file";
    let error: string | null = null;

    const continued = await saveDraftAndContinueNavigation({
      pendingNavigation: pending,
      saveEditorFile: async () => false,
      continuePendingNavigation: async (navigation) => {
        events.push(`continue:${navigation}`);
      },
      setPendingNavigation: (navigation) => {
        pending = navigation;
        events.push(`pending:${navigation ?? "none"}`);
      },
      setDraftDialogError: (message) => {
        error = message;
        events.push(`error:${message ?? "none"}`);
      },
    });

    expect(continued).toBe(false);
    expect(pending).toBe("other-file");
    expect(error).toBe(DRAFT_SAVE_FAILURE_MESSAGE);
    expect(events).toEqual(["error:none", `error:${DRAFT_SAVE_FAILURE_MESSAGE}`]);
  });

  it("saves before continuing and clears the modal only after save succeeds", async () => {
    const events: string[] = [];
    let pending: string | null = "other-file";

    const continued = await saveDraftAndContinueNavigation({
      pendingNavigation: pending,
      saveEditorFile: async () => {
        events.push("save");
        return true;
      },
      continuePendingNavigation: async (navigation) => {
        events.push(`continue:${navigation}`);
      },
      setPendingNavigation: (navigation) => {
        pending = navigation;
        events.push(`pending:${navigation ?? "none"}`);
      },
      setDraftDialogError: (message) => events.push(`error:${message ?? "none"}`),
    });

    expect(continued).toBe(true);
    expect(pending).toBeNull();
    expect(events).toEqual(["error:none", "save", "pending:none", "continue:other-file"]);
  });

  it("discard continues without saving and clears the modal", async () => {
    const events: string[] = [];
    let pending: string | null = "other-file";

    const continued = await discardDraftAndContinueNavigation({
      pendingNavigation: pending,
      continuePendingNavigation: async (navigation) => {
        events.push(`continue:${navigation}`);
      },
      setPendingNavigation: (navigation) => {
        pending = navigation;
        events.push(`pending:${navigation ?? "none"}`);
      },
      setDraftDialogError: (message) => events.push(`error:${message ?? "none"}`),
    });

    expect(continued).toBe(true);
    expect(pending).toBeNull();
    expect(events).toEqual(["pending:none", "error:none", "continue:other-file"]);
  });

  it("does nothing when there is no pending navigation", async () => {
    const events: string[] = [];

    await expect(
      saveDraftAndContinueNavigation({
        pendingNavigation: null,
        saveEditorFile: async () => {
          events.push("save");
          return true;
        },
        continuePendingNavigation: async () => {
          events.push("continue");
        },
        setPendingNavigation: () => events.push("pending"),
        setDraftDialogError: () => events.push("error"),
      }),
    ).resolves.toBe(false);

    expect(events).toEqual([]);
  });
});

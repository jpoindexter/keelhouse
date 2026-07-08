import { describe, expect, it } from "vitest";
import {
  composerHistoryAfterSubmit,
  composerHistoryAt,
  nextComposerHistoryIndex,
  previousComposerHistoryIndex,
  routeComposerDraft,
} from "./agentComposer";

describe("agent composer routing", () => {
  it("routes blank drafts nowhere", () => {
    expect(routeComposerDraft("   \n")).toEqual({ kind: "empty" });
  });

  it("routes normal drafts to the pty without trimming the payload", () => {
    expect(routeComposerDraft("  explain this file\nwith bullets  ")).toEqual({
      kind: "pty",
      text: "  explain this file\nwith bullets  ",
    });
  });

  it("routes app command aliases", () => {
    expect(routeComposerDraft(">save")).toEqual({ kind: "app", command: "save" });
    expect(routeComposerDraft(">find")).toEqual({ kind: "app", command: "find" });
    expect(routeComposerDraft(">open")).toEqual({ kind: "app", command: "open-folder" });
    expect(routeComposerDraft(">clear")).toEqual({ kind: "app", command: "clear-terminal" });
  });

  it("keeps bounded de-duplicated history", () => {
    expect(composerHistoryAfterSubmit(["one", "two"], "one")).toEqual(["two", "one"]);
    expect(composerHistoryAfterSubmit(["a", "b", "c"], "d", 3)).toEqual(["b", "c", "d"]);
    expect(composerHistoryAfterSubmit(["a"], "   ")).toEqual(["a"]);
  });

  it("navigates history by index", () => {
    const history = ["one", "two", "three"];
    expect(previousComposerHistoryIndex(history, null)).toBe(2);
    expect(previousComposerHistoryIndex(history, 2)).toBe(1);
    expect(previousComposerHistoryIndex(history, 0)).toBe(0);
    expect(composerHistoryAt(history, 1)).toBe("two");
    expect(nextComposerHistoryIndex(history, 1)).toBe(2);
    expect(nextComposerHistoryIndex(history, 2)).toBeNull();
  });
});

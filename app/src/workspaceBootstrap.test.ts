import { describe, expect, it } from "vitest";
import { normalizePaneLabelsBySession } from "./workspaceBootstrap";

describe("normalizePaneLabelsBySession", () => {
  it("keeps valid labels and removes invalid session records", () => {
    expect(normalizePaneLabelsBySession({
      "project\nsession": [
        { slot: 1, label: "  Build shell  ", updatedAt: 42 },
        { slot: -1, label: "Invalid" },
        { slot: 2, label: "" },
      ],
      empty: [],
      invalid: "nope",
    })).toEqual({
      "project\nsession": [{ slot: 1, label: "Build shell", updatedAt: 42 }],
    });
  });
});

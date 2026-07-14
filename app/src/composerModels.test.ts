import { describe, expect, it } from "vitest";

import { composerModelChoices, filterComposerModels } from "./composerModels";

describe("composer model catalog", () => {
  it("groups provider defaults with configured and current models without duplicates", () => {
    const choices = composerModelChoices({ codex: "gpt-5.6-sol", claude: "sonnet" }, "codex", "gpt-5.6-sol");
    expect(choices.filter((choice) => choice.provider === "codex" && choice.id === "gpt-5.6-sol")).toHaveLength(1);
    expect(choices.filter((choice) => choice.id === "")).toHaveLength(2);
  });

  it("searches provider names, model IDs, and metadata", () => {
    const choices = composerModelChoices({}, "codex", "");
    expect(filterComposerModels(choices, "claude").every((choice) => choice.provider === "claude")).toBe(true);
    expect(filterComposerModels(choices, "5.6").map((choice) => choice.id)).toContain("gpt-5.6-sol");
    expect(filterComposerModels(choices, "suggested").length).toBeGreaterThan(0);
  });
});

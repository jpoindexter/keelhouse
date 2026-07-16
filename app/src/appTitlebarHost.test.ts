import { describe, expect, it } from "vitest";
import { nextToolsLayout } from "./appTitlebarHost";

describe("nextToolsLayout", () => {
  it("hides visible tools", () => {
    expect(nextToolsLayout("right", "right")).toBe("hidden");
    expect(nextToolsLayout("left", "left")).toBe("hidden");
  });

  it("restores the stored dock side when tools are hidden", () => {
    expect(nextToolsLayout("hidden", "left")).toBe("left");
    expect(nextToolsLayout("hidden", "right")).toBe("right");
  });

  it("falls back to the right dock when no side was ever stored", () => {
    expect(nextToolsLayout("hidden", "hidden")).toBe("right");
  });
});

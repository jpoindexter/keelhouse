import { describe, expect, it, vi } from "vitest";

import { closeOtherOpenComposerMenus, type ComposerMenuElement } from "./composerMenus";

const menu = (open: boolean): ComposerMenuElement => ({ open, removeAttribute: vi.fn() });

describe("composer menu coordination", () => {
  it("closes every other open composer menu", () => {
    const current = menu(true);
    const other = menu(true);
    const closed = menu(false);

    closeOtherOpenComposerMenus(current, [current, other, closed]);

    expect(other.removeAttribute).toHaveBeenCalledWith("open");
    expect(closed.removeAttribute).not.toHaveBeenCalled();
  });

  it("does nothing when the toggled menu is closing", () => {
    const current = menu(false);
    const other = menu(true);

    closeOtherOpenComposerMenus(current, [current, other]);

    expect(other.removeAttribute).not.toHaveBeenCalled();
  });
});

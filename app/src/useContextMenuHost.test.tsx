// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ContextMenuItem } from "./ContextMenu";
import { useContextMenuHost } from "./useContextMenuHost";

const item = (id: string): ContextMenuItem => ({ id, label: id, onSelect: vi.fn() });

const createOptions = () => ({
  buildFileNodeItems: vi.fn(() => [item("file.open")]),
  onActionError: vi.fn(),
});

describe("useContextMenuHost", () => {
  it("opens a menu at the pointer location and dismisses it", () => {
    const options = createOptions();
    const { result } = renderHook(() => useContextMenuHost(options));

    const event = {
      clientX: 12, clientY: 34,
      preventDefault: vi.fn(), stopPropagation: vi.fn(),
    };
    act(() => {
      result.current.openContextMenu(event as never, [item("pane.focus")]);
    });

    expect(event.preventDefault).toHaveBeenCalled();
    expect(result.current.contextMenu).toEqual({
      items: [expect.objectContaining({ id: "pane.focus" })], x: 12, y: 34,
    });

    act(() => { result.current.setContextMenu(null); });
    expect(result.current.contextMenu).toBeNull();
  });

  it("opens the file-tree menu from the window custom event", () => {
    const options = createOptions();
    const { result } = renderHook(() => useContextMenuHost(options));

    act(() => {
      window.dispatchEvent(new CustomEvent("file-tree-context-menu", {
        detail: { node: { id: "n", kind: "file", name: "a.ts", path: "/a.ts" }, x: 5, y: 6 },
      }));
    });

    expect(options.buildFileNodeItems).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/a.ts" }),
    );
    expect(result.current.contextMenu).toEqual({
      items: [expect.objectContaining({ id: "file.open" })], x: 5, y: 6,
    });
  });

  it("ignores custom events without a node payload", () => {
    const options = createOptions();
    const { result } = renderHook(() => useContextMenuHost(options));

    act(() => {
      window.dispatchEvent(new CustomEvent("file-tree-context-menu", { detail: {} }));
    });

    expect(result.current.contextMenu).toBeNull();
  });
});

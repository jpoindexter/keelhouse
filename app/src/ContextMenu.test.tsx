// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ContextMenu, contextMenuPosition, type ContextMenuState } from "./ContextMenu";

const state = (overrides: Partial<ContextMenuState> = {}): ContextMenuState => ({
  x: 20,
  y: 30,
  items: [
    { id: "disabled", label: "Disabled", disabled: true, onSelect: vi.fn() },
    { id: "working", label: "Working", onSelect: vi.fn() },
  ],
  ...overrides,
});

describe("ContextMenu", () => {
  it("executes enabled async actions once and dismisses the menu", async () => {
    const onSelect = vi.fn(async () => {});
    const onDismiss = vi.fn();
    render(<ContextMenu state={state({ items: [{ id: "run", label: "Run", onSelect }] })} onDismiss={onDismiss} onActionError={() => {}} />);
    fireEvent.click(screen.getByRole("menuitem", { name: "Run" }));
    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("does not execute disabled actions and styles them as disabled", () => {
    const onSelect = vi.fn();
    render(<ContextMenu state={state({ items: [{ id: "close", label: "Close", danger: true, disabled: true, onSelect }] })} onDismiss={() => {}} onActionError={() => {}} />);
    const item = screen.getByRole("menuitem", { name: "Close" });
    expect(item.getAttribute("disabled")).not.toBeNull();
    fireEvent.click(item);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("reports rejected actions instead of dropping their errors", async () => {
    const error = new Error("no access");
    const onActionError = vi.fn();
    render(<ContextMenu state={state({ items: [{ id: "fail", label: "Fail", onSelect: async () => { throw error; } }] })} onDismiss={() => {}} onActionError={onActionError} />);
    fireEvent.click(screen.getByRole("menuitem", { name: "Fail" }));
    await waitFor(() => expect(onActionError).toHaveBeenCalledWith(expect.objectContaining({ id: "fail" }), error));
  });

  it("keeps long menus inside the viewport", () => {
    expect(contextMenuPosition(state({ x: 790, y: 590, items: Array.from({ length: 10 }, (_, index) => ({ id: String(index), label: String(index), onSelect: () => {} })) }), { width: 800, height: 600 })).toEqual({ left: 540, top: 300 });
  });
});

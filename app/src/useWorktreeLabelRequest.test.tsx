// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useWorktreeLabelRequest } from "./useWorktreeLabelRequest";

describe("useWorktreeLabelRequest", () => {
  it("resolves submit and cancellation without opening duplicate requests", async () => {
    const { result } = renderHook(() => useWorktreeLabelRequest());
    let first!: Promise<string | null>;
    let duplicate!: Promise<string | null>;
    act(() => {
      first = result.current.requestLabel();
      duplicate = result.current.requestLabel();
    });
    expect(result.current.dialog.open).toBe(true);
    await expect(duplicate).resolves.toBeNull();

    act(() => result.current.dialog.onSubmit("native qa"));
    await expect(first).resolves.toBe("native qa");
    expect(result.current.dialog.open).toBe(false);

    let cancelled!: Promise<string | null>;
    act(() => { cancelled = result.current.requestLabel(); });
    act(() => result.current.dialog.onCancel());
    await expect(cancelled).resolves.toBeNull();
  });
});

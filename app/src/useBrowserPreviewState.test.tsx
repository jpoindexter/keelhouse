// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useBrowserPreviewState } from "./useBrowserPreviewState";

describe("useBrowserPreviewState", () => {
  it("navigates backward through pushed locations", () => {
    const onUrlChange = vi.fn();
    const { result } = renderHook(() => useBrowserPreviewState(onUrlChange));

    act(() => result.current.setLocation("http://first.test/"));
    act(() => result.current.setLocation("http://second.test/"));
    act(() => result.current.goHistory(-1));

    expect(result.current.url).toBe("http://first.test/");
    expect(result.current.address).toBe("http://first.test/");
    expect(result.current.canGoForward).toBe(true);
    expect(onUrlChange).toHaveBeenLastCalledWith("http://first.test/");
  });

  it("restores one location and requests a reload", () => {
    const { result } = renderHook(() => useBrowserPreviewState(vi.fn()));
    act(() => result.current.setError("Previous error"));
    act(() => result.current.restore("http://restored.test/"));

    expect(result.current.url).toBe("http://restored.test/");
    expect(result.current.error).toBeNull();
    expect(result.current.reloadNonce).toBe(1);
    expect(result.current.canGoBack).toBe(false);
  });
});

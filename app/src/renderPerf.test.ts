import { describe, expect, it } from "vitest";

import {
  buildSnapshot,
  computeStats,
  createRenderPerfState,
  jankRate,
  recordFrameTime,
  recordIpcPayloadBytes,
} from "./renderPerf";

describe("computeStats", () => {
  it("returns zeroed stats for no samples", () => {
    expect(computeStats([])).toEqual({ count: 0, avg: 0, p95: 0, max: 0 });
  });

  it("computes avg/p95/max over samples", () => {
    const samples = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
    const stats = computeStats(samples);
    expect(stats.count).toBe(100);
    expect(stats.avg).toBeCloseTo(50.5, 5);
    expect(stats.max).toBe(100);
    expect(stats.p95).toBe(96);
  });
});

describe("jankRate", () => {
  it("is zero with no samples or all frames under budget", () => {
    expect(jankRate([])).toBe(0);
    expect(jankRate([8, 10, 12, 16])).toBe(0);
  });

  it("counts the fraction of frames over the 16.7ms budget", () => {
    expect(jankRate([8, 20, 8, 20])).toBe(0.5);
  });

  it("respects a custom budget", () => {
    expect(jankRate([10, 20], 5)).toBe(1);
  });
});

describe("recordFrameTime / recordIpcPayloadBytes", () => {
  it("caps the rolling buffer at 300 samples", () => {
    const state = createRenderPerfState();
    for (let i = 0; i < 350; i++) recordFrameTime(state, i);
    expect(state.frameTimesMs).toHaveLength(300);
    expect(state.frameTimesMs[0]).toBe(50); // oldest 50 dropped
    expect(state.frameTimesMs[299]).toBe(349);
  });

  it("tracks IPC payload byte samples independently", () => {
    const state = createRenderPerfState();
    recordIpcPayloadBytes(state, 128);
    recordIpcPayloadBytes(state, 256);
    expect(state.ipcPayloadBytes).toEqual([128, 256]);
    expect(state.frameTimesMs).toEqual([]);
  });
});

describe("buildSnapshot", () => {
  it("assembles a snapshot from current state", () => {
    const state = createRenderPerfState();
    recordFrameTime(state, 8);
    recordFrameTime(state, 20);
    recordIpcPayloadBytes(state, 100);
    const snapshot = buildSnapshot(state, 2, "2026-07-12T00:00:00.000Z");
    expect(snapshot.paneCount).toBe(2);
    expect(snapshot.capturedAt).toBe("2026-07-12T00:00:00.000Z");
    expect(snapshot.frameTime.count).toBe(2);
    expect(snapshot.jankRate).toBe(0.5);
    expect(snapshot.ipcPayload.count).toBe(1);
  });
});

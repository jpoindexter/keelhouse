import { describe, expect, it, vi } from "vitest";
import { createRenderPerfState } from "./renderPerf";
import { createRenderPerfExport } from "./renderPerfExport";

const createOptions = () => ({
  createFile: vi.fn(async () => {}),
  getPaneCount: vi.fn(() => 2),
  getPerfState: vi.fn(() => createRenderPerfState()),
  getRoot: vi.fn(() => "/repo" as string | null),
  now: () => "2026-07-16T10:00:00.000Z",
  setError: vi.fn(),
  writeFile: vi.fn(async (_root: string, _path: string, _content: string, _expectedModifiedMs: number | null) => {}),
});

describe("createRenderPerfExport", () => {
  it("creates the budget file location and writes the snapshot json", async () => {
    const options = createOptions();
    const exportSnapshot = createRenderPerfExport(options);

    await exportSnapshot();

    expect(options.createFile).toHaveBeenCalledWith(
      "/repo", "/repo/docs/qa/perf-budget", "render-perf-live.json",
    );
    const [root, path, content] = options.writeFile.mock.calls[0];
    expect(root).toBe("/repo");
    expect(path).toBe("/repo/docs/qa/perf-budget/render-perf-live.json");
    expect(JSON.parse(content)).toMatchObject({
      capturedAt: "2026-07-16T10:00:00.000Z", paneCount: 2,
    });
  });

  it("does nothing without a workspace and keeps going past create errors", async () => {
    const options = createOptions();
    options.getRoot.mockReturnValue(null);
    const exportSnapshot = createRenderPerfExport(options);
    await exportSnapshot();
    expect(options.writeFile).not.toHaveBeenCalled();

    options.getRoot.mockReturnValue("/repo");
    options.createFile.mockRejectedValue("Path already exists");
    await exportSnapshot();
    expect(options.writeFile).toHaveBeenCalled();
    expect(options.setError).not.toHaveBeenCalled();
  });

  it("surfaces write failures as a launch error", async () => {
    const options = createOptions();
    options.writeFile.mockRejectedValue("EACCES");
    const exportSnapshot = createRenderPerfExport(options);

    await exportSnapshot();

    expect(options.setError).toHaveBeenCalledWith("Render perf snapshot failed: EACCES");
  });
});

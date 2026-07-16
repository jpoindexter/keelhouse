import { describe, expect, it, vi } from "vitest";
import { createComposerHarnessEventLog } from "./composerHarnessEvents";

const descriptor = { id: "pane:1" } as never;

const createOptions = () => ({
  getDescriptor: vi.fn(() => descriptor),
  recordActivity: vi.fn(),
});

describe("createComposerHarnessEventLog", () => {
  it("records an app event against the active descriptor with a complete default", () => {
    const options = createOptions();
    const log = createComposerHarnessEventLog(options);

    log("Attached file", "notes.md");

    expect(options.recordActivity).toHaveBeenCalledWith(descriptor, {
      detail: "notes.md", kind: "app", label: "Attached file", status: "complete",
    });
  });

  it("passes explicit statuses through", () => {
    const options = createOptions();
    const log = createComposerHarnessEventLog(options);

    log("Reviewing context", "3 files", "running");

    expect(options.recordActivity).toHaveBeenCalledWith(
      descriptor, expect.objectContaining({ status: "running" }),
    );
  });
});

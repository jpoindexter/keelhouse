import { describe, expect, it, vi } from "vitest";
import { createTerminalResize } from "./terminalResize";

const createOptions = () => ({
  getCellMetrics: () => ({ ch: 20, cw: 10 }),
  getHostRect: vi.fn(() => ({ height: 400, width: 805 }) as { height: number; width: number } | undefined),
  getWindowSize: () => ({ height: 900, width: 1440 }),
  resize: vi.fn(async () => {}),
});

describe("createTerminalResize", () => {
  it("sizes the pty from the host rect in whole cells", () => {
    const options = createOptions();
    const send = createTerminalResize(options);

    send();

    expect(options.resize).toHaveBeenCalledWith(80, 20);
  });

  it("falls back to the window when the host has no size", () => {
    const options = createOptions();
    options.getHostRect.mockReturnValue({ height: 0, width: 0 });
    const send = createTerminalResize(options);

    send();

    expect(options.resize).toHaveBeenCalledWith(144, 45);
  });

  it("never sends fewer than two columns or rows", () => {
    const options = createOptions();
    options.getHostRect.mockReturnValue({ height: 5, width: 5 });
    const send = createTerminalResize(options);

    send();

    expect(options.resize).toHaveBeenCalledWith(2, 2);
  });
});

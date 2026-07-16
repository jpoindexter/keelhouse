const MIN_TERMINAL_CELLS = 2;

type TerminalResizeOptions = {
  getCellMetrics: () => { ch: number; cw: number };
  getHostRect: () => { height: number; width: number } | undefined;
  getWindowSize: () => { height: number; width: number };
  resize: (cols: number, rows: number) => Promise<unknown>;
};

const terminalSize = (options: TerminalResizeOptions) => {
  const rect = options.getHostRect();
  if (rect && rect.width > 0 && rect.height > 0) {
    return { width: rect.width, height: rect.height };
  }
  return options.getWindowSize();
};

export const createTerminalResize = (options: TerminalResizeOptions) => () => {
  const { cw, ch } = options.getCellMetrics();
  const { width, height } = terminalSize(options);
  const cols = Math.max(MIN_TERMINAL_CELLS, Math.floor(width / cw));
  const rows = Math.max(MIN_TERMINAL_CELLS, Math.floor(height / ch));
  options.resize(cols, rows).catch(() => {});
};

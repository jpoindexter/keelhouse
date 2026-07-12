const MAX_SAMPLES = 300;

export type RenderPerfState = {
  frameTimesMs: number[];
  ipcPayloadBytes: number[];
};

export const createRenderPerfState = (): RenderPerfState => ({
  frameTimesMs: [],
  ipcPayloadBytes: [],
});

const pushSample = (samples: number[], value: number) => {
  samples.push(value);
  if (samples.length > MAX_SAMPLES) samples.shift();
};

export const recordFrameTime = (state: RenderPerfState, ms: number): void => {
  pushSample(state.frameTimesMs, ms);
};

export const recordIpcPayloadBytes = (state: RenderPerfState, bytes: number): void => {
  pushSample(state.ipcPayloadBytes, bytes);
};

export type SampleStats = {
  count: number;
  avg: number;
  p95: number;
  max: number;
};

export const computeStats = (samples: number[]): SampleStats => {
  if (samples.length === 0) return { count: 0, avg: 0, p95: 0, max: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((total, value) => total + value, 0);
  const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return {
    count: sorted.length,
    avg: sum / sorted.length,
    p95: sorted[p95Index],
    max: sorted[sorted.length - 1],
  };
};

/** Fraction of frames that missed a 60fps budget (16.7ms). */
export const jankRate = (frameTimesMs: number[], budgetMs = 16.7): number => {
  if (frameTimesMs.length === 0) return 0;
  const dropped = frameTimesMs.filter((ms) => ms > budgetMs).length;
  return dropped / frameTimesMs.length;
};

export type RenderPerfSnapshot = {
  capturedAt: string;
  paneCount: number;
  frameTime: SampleStats;
  jankRate: number;
  ipcPayload: SampleStats;
};

export const buildSnapshot = (state: RenderPerfState, paneCount: number, capturedAt: string): RenderPerfSnapshot => ({
  capturedAt,
  paneCount,
  frameTime: computeStats(state.frameTimesMs),
  jankRate: jankRate(state.frameTimesMs),
  ipcPayload: computeStats(state.ipcPayloadBytes),
});

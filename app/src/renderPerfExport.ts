import { buildSnapshot, type RenderPerfState } from "./renderPerf";

const PERF_BUDGET_DIR = "docs/qa/perf-budget";
const PERF_SNAPSHOT_NAME = "render-perf-live.json";

type RenderPerfExportOptions = {
  createFile: (root: string, parent: string, name: string) => Promise<unknown>;
  getPaneCount: (root: string) => number;
  getPerfState: () => RenderPerfState;
  getRoot: () => string | null;
  now: () => string;
  setError: (error: string | null) => void;
  writeFile: (
    root: string, path: string, content: string, expectedModifiedMs: number | null,
  ) => Promise<unknown>;
};

export const createRenderPerfExport = (options: RenderPerfExportOptions) => async () => {
  const root = options.getRoot();
  if (!root) return;
  const snapshot = buildSnapshot(options.getPerfState(), options.getPaneCount(root), options.now());
  const parent = `${root}/${PERF_BUDGET_DIR}`;
  const absolutePath = `${parent}/${PERF_SNAPSHOT_NAME}`;
  // The write path requires the target to already exist (it reads metadata for the
  // editor's optimistic-concurrency check) — create first; "already exists" is expected.
  await options.createFile(root, parent, PERF_SNAPSHOT_NAME).catch(() => {});
  await options.writeFile(root, absolutePath, `${JSON.stringify(snapshot, null, 2)}\n`, null)
    .catch((err) => options.setError(`Render perf snapshot failed: ${String(err)}`));
};

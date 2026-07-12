#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "docs/qa/perf-budget");
const rel = (file) => path.join(root, file);
const exists = (file) => fs.existsSync(rel(file));
const read = (file) => fs.readFileSync(rel(file), "utf8");
const statSize = (file) => exists(file) ? fs.statSync(rel(file)).size : 0;

const git = (args) => {
  try {
    return execSync(`git ${args}`, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
};

const bytes = (value) => `${(value / 1024).toFixed(1)} KiB`;
const passFail = (pass) => pass ? "PASS" : "FAIL";
const warnPass = (pass) => pass ? "PASS" : "WARN";

const assetDir = rel("app/dist/assets");
const assets = fs.existsSync(assetDir)
  ? fs.readdirSync(assetDir).sort().map((file) => ({
      file: `app/dist/assets/${file}`,
      bytes: statSize(`app/dist/assets/${file}`),
      ext: path.extname(file),
    }))
  : [];

const sum = (items) => items.reduce((total, item) => total + item.bytes, 0);
const jsAssets = assets.filter((asset) => asset.ext === ".js");
const cssAssets = assets.filter((asset) => asset.ext === ".css");
const largestJsBytes = Math.max(0, ...jsAssets.map((asset) => asset.bytes));
const totalJsBytes = sum(jsAssets);
const totalCssBytes = sum(cssAssets);

const packageJson = exists("app/package.json") ? JSON.parse(read("app/package.json")) : {};
const dependencies = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
};

const dailyDriver = exists("docs/qa/daily-driver/latest.json")
  ? JSON.parse(read("docs/qa/daily-driver/latest.json"))
  : null;

const sourceCheck = (id, label, file, pattern) => ({
  id,
  label,
  file,
  pattern,
  pass: exists(file) && read(file).includes(pattern),
});

const fileCheck = (id, label, file, minBytes) => {
  const size = statSize(file);
  return {
    id,
    label,
    file,
    bytes: size,
    minBytes,
    pass: size >= minBytes,
  };
};

const hardBudgets = [
  {
    id: "total-js-assets",
    label: "Total built JS assets",
    actualBytes: totalJsBytes,
    limitBytes: 1_400_000,
    pass: totalJsBytes > 0 && totalJsBytes <= 1_400_000,
  },
  {
    id: "total-css-assets",
    label: "Total built CSS assets",
    actualBytes: totalCssBytes,
    limitBytes: 90_000,
    pass: totalCssBytes > 0 && totalCssBytes <= 90_000,
  },
];

const softBudgets = [
  {
    id: "largest-js-vite-warning",
    label: "Largest JS chunk stays below Vite warning size",
    actualBytes: largestJsBytes,
    limitBytes: 500_000,
    pass: largestJsBytes <= 500_000,
    note: "Warning only for now because CodeMirror language packages already exceed Vite's default chunk warning.",
  },
];

const sourceChecks = [
  sourceCheck(
    "codemirror-not-monaco",
    "Editor stack uses CodeMirror instead of Monaco/VS Code workbench",
    "app/package.json",
    "@uiw/react-codemirror"
  ),
  {
    id: "no-monaco",
    label: "No Monaco dependency is present",
    file: "app/package.json",
    pattern: "monaco-editor",
    pass: !dependencies["monaco-editor"] && !read("app/package.json").includes("monaco-editor"),
  },
  sourceCheck(
    "frame-coalesced-terminal",
    "Terminal paint path is frame-coalesced",
    "app/src/App.tsx",
    "requestAnimationFrame(paint)"
  ),
  sourceCheck(
    "terminal-snapshots",
    "Terminal snapshots are cached by pane",
    "app/src/App.tsx",
    "terminalSnapshotsRef"
  ),
  sourceCheck(
    "browser-detection",
    "Dev-server detection is output driven, not browser-heavy",
    "app/src/browserPreview.ts",
    "detectLocalDevServerUrl"
  ),
  {
    id: "daily-driver-ready",
    label: "Daily-driver readiness gate has passed",
    file: "docs/qa/daily-driver/latest.json",
    pattern: "implementation-ready-for-live-runs",
    pass: dailyDriver?.status === "implementation-ready-for-live-runs",
  },
  sourceCheck(
    "render-perf-instrumented",
    "Canvas paint path records frame time for the render-perf gate",
    "app/src/renderPerf.ts",
    "recordFrameTime"
  ),
];

const artifactChecks = [
  fileCheck("chrome-first-open", "Actual app first-open screenshot", "docs/qa/app-shell/first-open-1440.png", 1024),
  fileCheck("chrome-narrow", "Actual app narrow screenshot", "docs/qa/app-shell/first-open-900.png", 1024),
  fileCheck("native-run", "Native Tauri run screenshot", "docs/qa/app-shell/native-run.png", 1024),
  fileCheck("editor-selected", "Editor selected-state screenshot", "docs/qa/editor-parity/selected.png", 1024),
  fileCheck("daily-driver-report", "Daily-driver report", "docs/qa/daily-driver/latest.md", 1024),
  fileCheck("render-perf-live", "Live-captured render-perf snapshot (frame time/IPC payload/jank)", "docs/qa/perf-budget/render-perf-live.json", 50),
  fileCheck("render-perf-two-pane", "Packaged two-pane render-perf snapshot", "docs/qa/perf-budget/render-perf-2-pane.json", 50),
  fileCheck("render-perf-four-pane", "Packaged four-pane render-perf snapshot", "docs/qa/perf-budget/render-perf-4-pane.json", 50),
  fileCheck("runtime-comparison", "Process-tree runtime comparison", "docs/qa/perf-budget/runtime-comparison.json", 100),
  fileCheck("gemini-tui", "Packaged Gemini TUI screenshot", "docs/qa/daily-driver/gemini-tui.png", 1024),
];

const headCommit = git("rev-parse --short HEAD");
const dirtySuffix = git("status --short") ? "+dirty" : "";
const hardFailures = [
  ...hardBudgets.filter((budget) => !budget.pass),
  ...sourceChecks.filter((check) => !check.pass),
  ...artifactChecks.filter((check) => !check.pass),
];

const result = {
  generatedAt: new Date().toISOString(),
  commit: headCommit ? `${headCommit}${dirtySuffix}` : null,
  branch: git("branch --show-current"),
  status: hardFailures.length === 0 ? "baseline-ready" : "missing-budget-evidence",
  northStar: "daily-driver workflow runs completed without opening VS Code",
  hardBudgets,
  softBudgets,
  sourceChecks,
  artifactChecks,
  metrics: {
    assets,
    totals: {
      totalJsBytes,
      totalCssBytes,
      largestJsBytes,
    },
  },
  nextLiveMeasurements: [
    "Measure Keelhouse memory, CPU, and responsiveness for one-project edit+agent in the packaged Tauri app.",
    "Measure two-agent same-project pane focus/restart/close with terminal output under load.",
    "Measure three-project switch/relaunch with restored sessions and previews.",
    "Measure equivalent VS Code windows/extensions workflow and record the delta, not just Keelhouse alone.",
  ],
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "latest.json"), `${JSON.stringify(result, null, 2)}\n`);

const lines = [
  "# Performance Budget",
  "",
  `Generated: ${result.generatedAt}`,
  `Commit: ${result.commit ?? "unknown"}`,
  `Status: ${result.status}`,
  "",
  "## Hard Budgets",
  "",
];

for (const budget of hardBudgets) {
  lines.push(`- ${passFail(budget.pass)} ${budget.label}: ${bytes(budget.actualBytes)} / ${bytes(budget.limitBytes)}`);
}

lines.push("", "## Soft Budgets", "");
for (const budget of softBudgets) {
  lines.push(`- ${warnPass(budget.pass)} ${budget.label}: ${bytes(budget.actualBytes)} / ${bytes(budget.limitBytes)}`);
  if (budget.note) lines.push(`  - ${budget.note}`);
}

lines.push("", "## Source Checks", "");
for (const check of sourceChecks) {
  lines.push(`- ${passFail(check.pass)} ${check.label} - ${check.file}`);
}

lines.push("", "## Artifact Checks", "");
for (const check of artifactChecks) {
  lines.push(`- ${passFail(check.pass)} ${check.label} - ${check.file} (${bytes(check.bytes)})`);
}

lines.push("", "## Next Live Measurements", "");
for (const measurement of result.nextLiveMeasurements) lines.push(`- ${measurement}`);
lines.push("");

fs.writeFileSync(path.join(outDir, "latest.md"), `${lines.join("\n")}\n`);

if (result.status !== "baseline-ready") {
  console.error(`perf budget failed: ${result.status}`);
  process.exit(1);
}

console.log(`perf budget ok: ${path.relative(root, path.join(outDir, "latest.json"))}`);

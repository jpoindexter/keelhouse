#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "docs/qa/perf-budget");
const sampleCount = 5;
const sampleDelayMs = 500;
const controlled = process.env.KEELHOUSE_PERF_CONTROLLED === "1";
const vscodeProcessMarker = process.env.KEELHOUSE_PERF_VSCODE_MARKER?.trim() ?? "";
const controlledScenario = {
  id: "one-project-explorer-editor-shell",
  keelhouse: "Open the controlled fixture; show its file explorer; open README.md; open one blank shell; run printf 'PERF_CONTROLLED_OK\\n'.",
  vscode: "Open the controlled fixture; show its file explorer; open README.md; open one blank shell; run printf 'PERF_CONTROLLED_OK\\n'.",
};

if (controlled && !vscodeProcessMarker) {
  console.error("Controlled capture requires KEELHOUSE_PERF_VSCODE_MARKER for the isolated VS Code --user-data-dir.");
  process.exit(2);
}

const sleep = (milliseconds) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
const processRows = () => execFileSync("ps", ["-axo", "pid=,ppid=,rss=,%cpu=,command="], { encoding: "utf8" })
  .trim()
  .split("\n")
  .map((line) => {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)\s+(.*)$/);
    return match ? {
      pid: Number(match[1]),
      ppid: Number(match[2]),
      rssKb: Number(match[3]),
      cpuPercent: Number(match[4]),
      command: match[5],
    } : null;
  })
  .filter(Boolean);

const descendants = (rows, rootPid) => {
  const ids = new Set([rootPid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of rows) {
      if (ids.has(row.ppid) && !ids.has(row.pid)) {
        ids.add(row.pid);
        changed = true;
      }
    }
  }
  return rows.filter((row) => ids.has(row.pid));
};

const targets = [
  {
    id: "keelhouse",
    label: "Packaged Keelhouse",
    find: (row) => row.command.includes("/Keelhouse.app/Contents/MacOS/agent-cli"),
    workload: controlled
      ? controlledScenario.keelhouse
      : "Three restored projects; five panes in the active project (three shells, one exited Codex, one Gemini at the trust prompt).",
  },
  {
    id: "vscode",
    label: controlled ? "Isolated VS Code" : "Current VS Code workload",
    find: controlled
      ? (row) => row.command.includes("/Visual Studio Code.app/Contents/MacOS/Code") && row.command.includes(vscodeProcessMarker)
      : (row) => row.command === "/Applications/Visual Studio Code.app/Contents/MacOS/Code",
    workload: controlled
      ? controlledScenario.vscode
      : "Existing long-running user workload with extensions and multiple windows; observational baseline only, not a controlled equivalent run.",
  },
];

const samples = [];
for (let index = 0; index < sampleCount; index += 1) {
  const rows = processRows();
  samples.push(Object.fromEntries(targets.map((target) => {
    const rootProcess = rows.find(target.find);
    if (!rootProcess) return [target.id, null];
    const tree = descendants(rows, rootProcess.pid);
    return [target.id, {
      rootPid: rootProcess.pid,
      processCount: tree.length,
      rssKb: tree.reduce((sum, row) => sum + row.rssKb, 0),
      cpuPercent: tree.reduce((sum, row) => sum + row.cpuPercent, 0),
    }];
  })));
  if (index < sampleCount - 1) sleep(sampleDelayMs);
}

const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const summary = Object.fromEntries(targets.map((target) => {
  const readings = samples.map((sample) => sample[target.id]).filter(Boolean);
  return [target.id, readings.length === 0 ? null : {
    label: target.label,
    workload: target.workload,
    samples: readings.length,
    processCountAverage: average(readings.map((reading) => reading.processCount)),
    rssMbAverage: average(readings.map((reading) => reading.rssKb)) / 1024,
    cpuPercentAverage: average(readings.map((reading) => reading.cpuPercent)),
  }];
}));

const result = {
  capturedAt: new Date().toISOString(),
  status: summary.keelhouse && summary.vscode
    ? controlled ? "controlled-equivalent" : "observational-comparison"
    : "missing-process",
  caveat: controlled
    ? "Both apps were prepared with the same named explorer/editor/shell scenario before process-tree sampling. This compares the specified idle-ready state, not startup energy or long-running agent load."
    : "This captures current real workloads. It does not prove the equivalent-workflow North Star until VS Code and Keelhouse run the same controlled scenario.",
  ...(controlled ? { scenario: controlledScenario } : {}),
  sampleCount,
  sampleDelayMs,
  summary,
  samples,
};

fs.mkdirSync(outDir, { recursive: true });
const outputStem = controlled ? "runtime-comparison-controlled" : "runtime-comparison";
fs.writeFileSync(path.join(outDir, `${outputStem}.json`), `${JSON.stringify(result, null, 2)}\n`);
const lines = [
  "# Runtime Comparison",
  "",
  `Captured: ${result.capturedAt}`,
  `Status: ${result.status}`,
  "",
  result.caveat,
  "",
  "## Samples",
  "",
  ...targets.map((target) => {
    const value = summary[target.id];
    return value
      ? `- ${value.label}: ${value.rssMbAverage.toFixed(1)} MB RSS, ${value.cpuPercentAverage.toFixed(1)}% CPU, ${value.processCountAverage.toFixed(1)} processes (${value.samples} samples). ${value.workload}`
      : `- ${target.label}: process not found.`;
  }),
  "",
  "## Remaining Proof",
  "",
  "Run the same one-project, two-agent, and three-project workflows in both apps from comparable cold starts, then record elapsed time and process-tree deltas.",
  "",
];
fs.writeFileSync(path.join(outDir, `${outputStem}.md`), `${lines.join("\n")}\n`);

const expectedStatus = controlled ? "controlled-equivalent" : "observational-comparison";
if (result.status !== expectedStatus) process.exitCode = 1;
else console.log(`${controlled ? "controlled" : "observational"} runtime comparison captured`);

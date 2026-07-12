#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "docs/qa/perf-budget");
const sampleCount = 5;
const sampleDelayMs = 500;

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
    workload: "Three restored projects; five panes in the active project (three shells, one exited Codex, one Gemini at the trust prompt).",
  },
  {
    id: "vscode",
    label: "Current VS Code workload",
    find: (row) => row.command === "/Applications/Visual Studio Code.app/Contents/MacOS/Code",
    workload: "Existing long-running user workload with extensions and multiple windows; observational baseline only, not a controlled equivalent run.",
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
  status: summary.keelhouse && summary.vscode ? "observational-comparison" : "missing-process",
  caveat: "This captures current real workloads. It does not prove the equivalent-workflow North Star until VS Code and Keelhouse run the same controlled scenario.",
  sampleCount,
  sampleDelayMs,
  summary,
  samples,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "runtime-comparison.json"), `${JSON.stringify(result, null, 2)}\n`);
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
fs.writeFileSync(path.join(outDir, "runtime-comparison.md"), `${lines.join("\n")}\n`);

if (result.status !== "observational-comparison") process.exitCode = 1;
else console.log("runtime comparison captured");

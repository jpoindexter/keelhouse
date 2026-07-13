#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "docs/qa/daily-driver");
const rel = (file) => path.join(root, file);
const read = (file) => fs.readFileSync(rel(file), "utf8");
const exists = (file) => fs.existsSync(rel(file));
const statSize = (file) => exists(file) ? fs.statSync(rel(file)).size : 0;

const git = (args) => {
  try {
    return execSync(`git ${args}`, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
};

const sourceContains = (file, pattern, label) => {
  const pass = exists(file) && read(file).includes(pattern);
  return { label, file, pass, evidence: pattern };
};

const fileExists = (file, label, minBytes = 1) => {
  const bytes = statSize(file);
  return { label, file, pass: bytes >= minBytes, bytes };
};

const scenarios = [
  {
    id: "one-project-edit-agent-preview",
    title: "One project: talk, edit, preview",
    goal: "A single project can keep the agent conversation primary while exposing editor save and browser preview surfaces.",
    checks: [
      sourceContains("app/src/App.tsx", 'aria-label="Agent conversation"', "structured agent conversation surface"),
      sourceContains("app/src/App.tsx", "write_text_file", "real editor save path"),
      sourceContains("app/src/composerHarness.ts", "composerPromptPayload", "composer routes prompts with context"),
      sourceContains("app/src/browserPreview.ts", "detectLocalDevServerUrl", "terminal-output dev-server detection"),
      fileExists("docs/qa/app-shell/first-open-1440.png", "actual app shell at 1440x900", 1024),
      fileExists("docs/qa/app-shell/first-open-900.png", "actual app shell at 900x640", 1024),
      fileExists("docs/qa/app-shell/native-run.png", "native Tauri run with live pty output", 1024),
    ],
  },
  {
    id: "two-agents-same-project",
    title: "Two structured chats: same project",
    goal: "One project can own multiple independent provider-backed chats with separate messages, run state, cancellation, and persisted provider identity.",
    checks: [
      sourceContains("app/src/chatConversation.ts", "ChatConversationRecords", "chat records are keyed independently"),
      sourceContains("app/src/chatConversation.ts", "providerThreadId", "provider identity persists per chat"),
      sourceContains("app/src-tauri/src/chat_harness.rs", "ChatRunState", "backend owns multiple live runs by id"),
      sourceContains("app/src-tauri/src/chat_harness.rs", "process_group(0)", "each chat run owns an isolated process group"),
      sourceContains("app/src/ChatThreadSurface.tsx", "ChatThreadSurface", "structured messages render separately from raw terminal"),
      fileExists("docs/qa/daily-driver/codex-multi-chat.md", "executed packaged multi-chat record", 1024),
      fileExists("docs/qa/daily-driver/codex-multi-chat-native.png", "packaged multi-chat screenshot", 1024),
    ],
  },
  {
    id: "three-project-switch-relaunch",
    title: "Three projects: switch and relaunch",
    goal: "The project rail can replace separate VS Code windows by preserving projects, sessions, editor state, panes, and preview URLs.",
    checks: [
      sourceContains("app/src/workspaceState.ts", "normalizeOpenProjects", "open project rail persistence"),
      sourceContains("app/src/workspaceState.ts", "ProjectSessionsByProject", "project sessions persistence"),
      sourceContains("app/src/sessionRestore.ts", "normalizeSessionEditorSnapshots", "editor session restore"),
      sourceContains("app/src/App.tsx", "browserPreviewBySession", "browser preview persists by session"),
      fileExists("docs/project-rail.md", "project rail doc", 1024),
      fileExists("docs/session-restore.md", "session restore doc", 1024),
    ],
  },
];

const assetSizes = fs.existsSync(rel("app/dist/assets"))
  ? fs.readdirSync(rel("app/dist/assets")).sort().map((file) => ({
      file: `app/dist/assets/${file}`,
      bytes: statSize(`app/dist/assets/${file}`),
    }))
  : [];

const screenshotSizes = [
  "docs/qa/app-shell/first-open-1440.png",
  "docs/qa/app-shell/first-open-1024.png",
  "docs/qa/app-shell/first-open-900.png",
  "docs/qa/app-shell/native-run.png",
  "docs/qa/editor-parity/selected.png",
  "docs/qa/editor-parity/narrow-composer.png",
  "docs/qa/editor-parity/diff-review.png",
  "docs/qa/editor-parity/chrome-states.png",
].map((file) => ({ file, bytes: statSize(file) }));

const evaluated = scenarios.map((scenario) => {
  const passed = scenario.checks.filter((check) => check.pass).length;
  return {
    ...scenario,
    passed,
    total: scenario.checks.length,
    status: passed === scenario.checks.length ? "implementation-ready" : "missing-evidence",
  };
});

const headCommit = git("rev-parse --short HEAD");
const dirtySuffix = git("status --short") ? "+dirty" : "";

const result = {
  generatedAt: new Date().toISOString(),
  commit: headCommit ? `${headCommit}${dirtySuffix}` : null,
  branch: git("branch --show-current"),
  northStar: "daily-driver workflow runs completed without opening VS Code",
  status: evaluated.every((scenario) => scenario.status === "implementation-ready")
    ? "implementation-ready-for-live-runs"
    : "missing-evidence",
  scenarios: evaluated,
  metrics: {
    assetSizes,
    screenshotSizes,
  },
  nextManualRuns: [
    "Time one-project edit + agent + detected preview without opening VS Code.",
    "Repeat two-chat same-project latency capture with exact send/switch/stop timestamps.",
    "Time three-project switch/relaunch run with restored sessions and previews.",
    "Run a real Gemini prompt/response in Raw terminal after accepting the project trust prompt.",
  ],
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "latest.json"), `${JSON.stringify(result, null, 2)}\n`);

const lines = [
  "# Daily Driver Metrics",
  "",
  `Generated: ${result.generatedAt}`,
  `Commit: ${result.commit ?? "unknown"}`,
  `Status: ${result.status}`,
  "",
  "## Scenarios",
  "",
];

for (const scenario of evaluated) {
  lines.push(`### ${scenario.title}`);
  lines.push("");
  lines.push(`Goal: ${scenario.goal}`);
  lines.push(`Status: ${scenario.status} (${scenario.passed}/${scenario.total})`);
  lines.push("");
  for (const check of scenario.checks) {
    lines.push(`- ${check.pass ? "PASS" : "FAIL"} ${check.label} — ${check.file}`);
  }
  lines.push("");
}

lines.push("## Next Manual Runs", "");
for (const run of result.nextManualRuns) lines.push(`- ${run}`);
lines.push("");
fs.writeFileSync(path.join(outDir, "latest.md"), `${lines.join("\n")}\n`);

if (result.status !== "implementation-ready-for-live-runs") {
  console.error(`daily-driver metrics failed: ${result.status}`);
  process.exit(1);
}

console.log(`daily-driver metrics ok: ${path.relative(root, path.join(outDir, "latest.json"))}`);

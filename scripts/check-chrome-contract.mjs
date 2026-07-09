#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const fail = [];

const assert = (condition, message) => {
  if (!condition) fail.push(message);
};

const appCss = read("app/src/App.css");
const appTsx = read("app/src/App.tsx");
const demo = read("demo/keelhouse-chrome-demo.html");

const rejectedWarmAccent = /#e07a4f|#251b16|#d9a079|var\(--orange\)|orange accent|warm accent dominance/i;
const checkedText = [
  ["app/src/App.css", appCss],
  ["app/src/App.tsx", appTsx],
  ["demo/keelhouse-chrome-demo.html", demo],
];

for (const [file, text] of checkedText) {
  assert(!rejectedWarmAccent.test(text), `${file} contains rejected warm/orange accent tokens`);
  assert(!/You ·|Keelhouse ·|msg-icon/.test(text), `${file} contains rejected chat avatar/identity markers`);
}

assert(appCss.includes("--steel-cyan-500: #67c3d1;"), "App CSS must define steel-cyan primary accent #67c3d1");
assert(appCss.includes("--steel-cyan-400: #9bd9e3;"), "App CSS must define steel-cyan strong accent #9bd9e3");
assert(appCss.includes("--steel-cyan-900: #162c33;"), "App CSS must define steel-cyan muted surface #162c33");
assert(appCss.includes("--color-accent-border: var(--blue-500);"), "App accent border must flow through the semantic accent token");
assert(appCss.includes(".agent-thread-event"), "App CSS must include thread-style agent event cards");
assert(appTsx.includes("agent-thread-event"), "App surface must render thread-style agent event cards");
assert(appTsx.includes("agent-activity-log__title\">Thread"), "Agent activity surface must label the center feed as Thread");
assert(demo.includes("--accent: #67c3d1;"), "Accepted chrome demo must use steel-cyan #67c3d1");
assert(demo.includes("--accent-strong: #9bd9e3;"), "Accepted chrome demo must use steel-cyan strong #9bd9e3");
assert(demo.includes("--accent-soft: #162c33;"), "Accepted chrome demo must use steel-cyan soft #162c33");
assert(/\.thread-row\.active\s*\{[^}]*box-shadow: inset 3px 0 0 var\(--accent\);/s.test(demo), "Accepted demo active thread row must use flat left accent rule");
assert(!/\.thread-row\.active\s*\{[^}]*border-radius/s.test(demo), "Accepted demo active thread row must stay flat, not rounded");

const requiredScreenshots = [
  "docs/qa/chrome-demo/first-open.png",
  "docs/qa/chrome-demo/create-menu.png",
  "docs/qa/chrome-demo/settings.png",
  "docs/qa/chrome-demo/palette.png",
  "docs/qa/chrome-demo/narrow.png",
];

for (const file of requiredScreenshots) {
  const absolute = path.join(root, file);
  assert(fs.existsSync(absolute), `Missing chrome QA screenshot ${file}`);
  if (fs.existsSync(absolute)) {
    assert(fs.statSync(absolute).size > 1024, `Chrome QA screenshot ${file} looks empty`);
  }
}

if (fail.length > 0) {
  console.error("Chrome contract check failed:");
  for (const message of fail) console.error(`- ${message}`);
  process.exit(1);
}

console.log("chrome contract ok");

import { readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appRoot = path.join(root, "app");
const sourceRoot = path.join(appRoot, "src");
const baselinePath = path.join(root, "docs", "qa", "module-size-baseline.json");
const require = createRequire(path.join(appRoot, "package.json"));
const ts = require("typescript");

const limits = { file: 300, component: 200, function: 50 };
const sourceExtensions = new Set([".ts", ".tsx", ".css"]);
const isTest = (file) => /(?:\.test|\.spec)\.[^.]+$/.test(file);

const collectFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(target);
    return sourceExtensions.has(path.extname(target)) && !isTest(target) ? [target] : [];
  }));
  return nested.flat();
};

const lineCount = (text) => text.split(/\r?\n/).length;

const functionStats = (file, text) => {
  if (!/\.tsx?$/.test(file)) return { longFunctions: 0, maxFunctionLines: 0 };
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const lengths = [];
  const visit = (node) => {
    if (ts.isFunctionLike(node) && node.body) {
      const start = source.getLineAndCharacterOfPosition(node.getStart(source)).line;
      const end = source.getLineAndCharacterOfPosition(node.end).line;
      lengths.push(end - start + 1);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return {
    longFunctions: lengths.filter((length) => length > limits.function).length,
    maxFunctionLines: Math.max(0, ...lengths),
  };
};

const inspect = async (file) => {
  const text = await readFile(file, "utf8");
  const lines = lineCount(text);
  const relative = path.relative(root, file);
  const componentLimit = file.endsWith(".tsx") ? limits.component : limits.file;
  return { file: relative, lines, componentLimit, ...functionStats(file, text) };
};

const files = await collectFiles(sourceRoot);
const results = await Promise.all(files.map(inspect));
const violations = Object.fromEntries(results
  .filter((result) => result.lines > result.componentLimit || result.longFunctions > 0)
  .map(({ file, lines, longFunctions, maxFunctionLines }) => [file, { lines, longFunctions, maxFunctionLines }]));

if (process.argv.includes("--print-baseline")) {
  process.stdout.write(`${JSON.stringify({ limits, violations }, null, 2)}\n`);
  process.exit(0);
}

const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
const failures = [];
for (const [file, current] of Object.entries(violations)) {
  const allowed = baseline.violations[file];
  if (!allowed) {
    failures.push(`${file}: new size violation (${current.lines} lines, ${current.longFunctions} long functions)`);
    continue;
  }
  if (current.lines > allowed.lines) failures.push(`${file}: grew from ${allowed.lines} to ${current.lines} lines`);
  if (current.longFunctions > allowed.longFunctions) failures.push(`${file}: added a >50-line function`);
  if (current.maxFunctionLines > allowed.maxFunctionLines) failures.push(`${file}: longest function grew to ${current.maxFunctionLines} lines`);
}

if (failures.length > 0) {
  console.error(`300/200/50 module-size check failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(`300/200/50 module-size ratchet passed (${Object.keys(violations).length} legacy debt files).`);

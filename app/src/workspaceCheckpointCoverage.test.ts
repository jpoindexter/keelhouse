import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const backend = readFileSync(new URL("../src-tauri/src/workspace_checkpoints.rs", import.meta.url), "utf8");
const productionBackend = backend.split("#[cfg(test)]")[0];

describe("safe workspace checkpoint production wiring", () => {
  it("previews, protects dirty buffers, and preserves a recovery path", () => {
    expect(app).toContain("previewWorkspaceCheckpoint(projectPath, checkpointId)");
    expect(app).toContain("protectedDirtyPath");
    expect(app).toContain("recoveryCheckpointId: result.recoveryCheckpointId");
    expect(backend).toContain("preview.preview_token != preview_token");
    expect(backend).toContain("Recovery before checkpoint restore");
  });

  it("never stages, resets, cleans, or applies a patch during checkpoint work", () => {
    expect(productionBackend).not.toContain("git add");
    expect(productionBackend).not.toContain("reset --hard");
    expect(productionBackend).not.toContain("clean -fd");
    expect(productionBackend).not.toContain("git apply");
    expect(productionBackend).not.toContain('"add"');
    expect(productionBackend).not.toContain('"reset"');
    expect(productionBackend).not.toContain('"clean"');
    expect(productionBackend).not.toContain('"apply"');
  });
});

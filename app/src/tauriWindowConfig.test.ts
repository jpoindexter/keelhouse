import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type WindowConfig = {
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  center?: boolean;
};

describe("native first-open window", () => {
  it("opens as a workbench instead of a small utility window", () => {
    const config = JSON.parse(readFileSync(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8")) as {
      app: { windows: WindowConfig[] };
    };
    const window = config.app.windows[0];

    expect(window.width).toBeGreaterThanOrEqual(1280);
    expect(window.height).toBeGreaterThanOrEqual(800);
    expect(window.minWidth).toBeGreaterThanOrEqual(900);
    expect(window.minHeight).toBeGreaterThanOrEqual(640);
    expect(window.center).toBe(true);
  });

  it("allows the native confirmation dialog used by guarded actions", () => {
    const capability = JSON.parse(readFileSync(new URL("../src-tauri/capabilities/default.json", import.meta.url), "utf8")) as {
      permissions: string[];
    };

    expect(capability.permissions).toContain("dialog:allow-confirm");
  });

  it("awaits the official Tauri confirmation API instead of the injected window shim", () => {
    const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

    expect(app).toContain('confirm as confirmDialog');
    expect(app).not.toContain("window.confirm(");
  });
});

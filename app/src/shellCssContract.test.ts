import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./App.css", import.meta.url), "utf8");

describe("responsive shell CSS contract", () => {
  it("keeps chat primary and the bottom tray available in every dock position", () => {
    const convergence = css.slice(css.indexOf("Chrome convergence:"));
    expect(convergence).toMatch(/\.workbench\.workbench--drawer-right\s*\{[^}]*grid-template-rows:\s*38px minmax\(0,\s*1fr\) 6px var\(--utility-tray-height, 42px\);[^}]*"utilitysplit utilitysplit utilitysplit"[^}]*"utility utility utility";/s);
    expect(convergence).toMatch(/\.workbench\.workbench--drawer-left\s*\{[^}]*grid-template-rows:\s*38px minmax\(0,\s*1fr\) 6px var\(--utility-tray-height, 42px\);[^}]*"utilitysplit utilitysplit utilitysplit"[^}]*"utility utility utility";/s);
    expect(convergence).toMatch(/\.workbench\.workbench--drawer-bottom\s*\{[^}]*grid-template-rows:[^}]*var\(--utility-tray-height, 42px\);[^}]*"utilitysplit"[^}]*"utility";/s);
    expect(convergence).toMatch(/\.workbench\.workbench--drawer-hidden\s*\{[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\) 6px var\(--utility-tray-height, 42px\);[^}]*"utilitysplit"[^}]*"utility";/s);
    expect(convergence).toMatch(/\.agent-surface--terminal \.agent-chat-surface\s*\{[^}]*display:\s*flex;/s);
  });
});

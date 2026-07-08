import { describe, expect, it } from "vitest";
import { hasLanguageModeForPath } from "./editorLanguages";

describe("editor language modes", () => {
  it("enables first-class language modes for supported project file types", () => {
    [
      "src/App.tsx",
      "src/app.ts",
      "src/main.jsx",
      "src/main.js",
      "README.md",
      "index.html",
      "style.css",
      "src/main.rs",
      "package.json",
      "Cargo.toml",
      "config.yaml",
      "config.yml",
      "scripts/smoke.sh",
      "scripts/bootstrap.zsh",
      ".zshrc",
    ].forEach((path) => expect(hasLanguageModeForPath(path), path).toBe(true));
  });

  it("leaves unknown files as plain text plus editor search support", () => {
    expect(hasLanguageModeForPath("notes.unknown")).toBe(false);
  });
});

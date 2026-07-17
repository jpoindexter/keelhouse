import { describe, expect, it } from "vitest";

import { readCssSource } from "./readCssSource";

const css = readCssSource(new URL("./composerContextMetadata.css", import.meta.url));

describe("composer context metadata CSS", () => {
  it("responds to composer width and keeps project targets ahead of secondary metadata", () => {
    expect(css).toMatch(/\.agent-composer\s*\{[^}]*container-name:\s*agent-composer;[^}]*container-type:\s*inline-size;/s);
    expect(css).toMatch(/@container agent-composer \(max-width:\s*560px\)[\s\S]*\.composer-context-metadata > div:nth-child\(n \+ 4\)\s*\{[^}]*display:\s*none;/s);
  });
});

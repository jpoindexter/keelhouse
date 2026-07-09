import { describe, expect, it } from "vitest";
import { filterWorkspaceFiles } from "./workspaceSearch";

const files = [
  { name: "App.tsx", path: "/repo/app/src/App.tsx" },
  { name: "browserPreview.ts", path: "/repo/app/src/browserPreview.ts" },
  { name: "ROADMAP.md", path: "/repo/ROADMAP.md" },
];

describe("workspace file search", () => {
  it("returns the bounded default list for empty queries", () => {
    expect(filterWorkspaceFiles(files, "", 2).map((file) => file.name)).toEqual(["App.tsx", "browserPreview.ts"]);
  });

  it("matches file names and paths by all query terms", () => {
    expect(filterWorkspaceFiles(files, "app tsx").map((file) => file.name)).toEqual(["App.tsx"]);
    expect(filterWorkspaceFiles(files, "src browser").map((file) => file.name)).toEqual(["browserPreview.ts"]);
    expect(filterWorkspaceFiles(files, "missing")).toEqual([]);
  });
});

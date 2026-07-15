import { describe, expect, it } from "vitest";
import type { FileTreeNode } from "./fileTreeTypes";
import { flattenFileTree, markDirtyFiles } from "./fileTreeView";

const tree: FileTreeNode[] = [{
  children: [{
    id: "/repo/src/App.tsx",
    kind: "file",
    name: "App.tsx",
    path: "/repo/src/App.tsx",
  }],
  id: "/repo/src",
  kind: "directory",
  name: "src",
  path: "/repo/src",
}, {
  id: "/repo/README.md",
  kind: "file",
  name: "README.md",
  path: "/repo/README.md",
}];

describe("file tree view transforms", () => {
  it("propagates dirty state through nested nodes without changing the input", () => {
    const marked = markDirtyFiles(tree, new Set(["/repo/src/App.tsx"]));

    expect(marked[0].children?.[0].dirty).toBe(true);
    expect(marked[1].dirty).toBe(false);
    expect(tree[0].children?.[0].dirty).toBeUndefined();
  });

  it("flattens files in visible tree order while omitting directories", () => {
    expect(flattenFileTree(tree).map((node) => node.name)).toEqual(["App.tsx", "README.md"]);
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { WorkbenchDockPanels, type WorkbenchDockPanelsProps } from "./WorkbenchDockPanels";
import type { FileTreeNode } from "./fileTreeTypes";

const file = (path: string): FileTreeNode => ({
  id: path, kind: "file", name: path.split("/").pop() ?? path, path,
});

const props = (overrides: Partial<WorkbenchDockPanelsProps> = {}): WorkbenchDockPanelsProps => ({
  files: {
    error: null, loading: false, query: "",
    results: [file("/repo/match.ts")], searchable: [file("/repo/all.ts")],
    selectedFilePath: null,
  },
  git: { error: null, loading: false, status: null },
  handlers: {
    createFile: vi.fn(), createFolder: vi.fn(), gitFileContextMenu: vi.fn(),
    openDiff: vi.fn(), openFile: vi.fn(), refreshFiles: vi.fn(),
    refreshGit: vi.fn(), setQuery: vi.fn(),
  },
  workspacePath: "/repo",
  ...overrides,
});

describe("WorkbenchDockPanels", () => {
  it("lists all searchable files while the query is empty", () => {
    const html = renderToStaticMarkup(<WorkbenchDockPanels {...props()} />);

    expect(html).toContain("all.ts");
    expect(html).not.toContain("match.ts");
  });

  it("switches to search results when a query is set", () => {
    const html = renderToStaticMarkup(
      <WorkbenchDockPanels {...props({
        files: {
          error: null, loading: false, query: "match",
          results: [file("/repo/match.ts")], searchable: [file("/repo/all.ts")],
          selectedFilePath: null,
        },
      })} />,
    );

    expect(html).toContain("match.ts");
    expect(html).not.toContain("all.ts");
  });
});

import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { QuickOpenDialog } from "./QuickOpenDialog";
import type { QuickOpenController } from "./useQuickOpen";

const controller = (overrides: Partial<QuickOpenController> = {}): QuickOpenController => ({
  activeIndex: 0,
  close: vi.fn(),
  inputRef: createRef<HTMLInputElement>(),
  open: true,
  openDialog: vi.fn(),
  query: "app",
  results: [{ id: "/repo/src/App.tsx", name: "App.tsx", path: "/repo/src/App.tsx", kind: "file" }],
  setActiveIndex: vi.fn(),
  setQuery: vi.fn(),
  ...overrides,
});

describe("QuickOpenDialog", () => {
  it("renders matching files with workspace-relative breadcrumbs", () => {
    const html = renderToStaticMarkup(<QuickOpenDialog controller={controller()} onOpenFile={vi.fn()} shortcut="Cmd+P" workspacePath="/repo" />);
    expect(html).toContain("App.tsx");
    expect(html).toContain("repo / src / App.tsx");
    expect(html).toContain("Cmd+P");
  });

  it("renders the workspace prerequisite", () => {
    const html = renderToStaticMarkup(<QuickOpenDialog controller={controller({ results: [] })} onOpenFile={vi.fn()} shortcut="Cmd+P" workspacePath={null} />);
    expect(html).toContain("Open a folder before quick open");
  });
});

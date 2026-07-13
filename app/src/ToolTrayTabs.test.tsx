import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ToolTrayTabs, toolTraySelection } from "./ToolTrayTabs";

const noop = () => {};

describe("ToolTrayTabs", () => {
  it("closes an active panel and switches to an inactive panel", () => {
    expect(toolTraySelection("files", "files")).toBeNull();
    expect(toolTraySelection("files", "browser")).toBe("browser");
  });

  it("provides the approved four-surface dock and marks one active tab", () => {
    const html = renderToStaticMarkup(<ToolTrayTabs mode="files" onModeChange={noop} onClose={noop} />);

    expect(html).toContain("Files");
    expect(html).toContain("Editor");
    expect(html).toContain("Browser");
    expect(html).toContain("Git");
    expect(html.match(/tool-tray-tabs__tab--active/g)).toHaveLength(1);
  });

  it("marks editor and browser active when split is restored from settings", () => {
    const html = renderToStaticMarkup(<ToolTrayTabs mode="split" onModeChange={noop} onClose={noop} />);

    expect(html.match(/tool-tray-tabs__tab--active/g)).toHaveLength(2);
  });

  it("exposes accessible names for the icon-only controls", () => {
    const html = renderToStaticMarkup(<ToolTrayTabs mode="browser" onModeChange={noop} onClose={noop} />);

    expect(html).toContain('title="Show Files panel"');
    expect(html).toContain('title="Hide Browser panel"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-label="Hide tool tray"');
  });
});

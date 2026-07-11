import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ToolTrayTabs } from "./ToolTrayTabs";

const noop = () => {};

describe("ToolTrayTabs", () => {
  it("marks the active surface tab with the underline-active class", () => {
    const html = renderToStaticMarkup(<ToolTrayTabs mode="editor" onModeChange={noop} onClose={noop} />);

    expect(html).toContain("Editor");
    expect(html).toContain("Browser");
    expect(html.match(/tool-tray-tabs__tab--active/g)).toHaveLength(1);
  });

  it("marks both surface tabs active in split mode", () => {
    const html = renderToStaticMarkup(<ToolTrayTabs mode="split" onModeChange={noop} onClose={noop} />);

    expect(html.match(/tool-tray-tabs__tab--active/g)).toHaveLength(2);
    expect(html).toContain("tool-tray-tabs__icon--active");
  });

  it("exposes accessible names for the icon-only controls", () => {
    const html = renderToStaticMarkup(<ToolTrayTabs mode="browser" onModeChange={noop} onClose={noop} />);

    expect(html).toContain('aria-label="Split editor and browser"');
    expect(html).toContain('aria-label="Hide tool tray"');
  });
});

import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { BottomUtilityTray } from "./BottomUtilityTray";
import { defaultTerminalLaunchProfile } from "./launchProfiles";

describe("BottomUtilityTray", () => {
  it("renders collapsed tabs and a raw-shell empty state", () => {
    const profile = defaultTerminalLaunchProfile();
    const fn = vi.fn();
    const html = renderToStaticMarkup(<BottomUtilityTray
      activePane={null} activePaneId={null} activeProfileLabel={profile.label} canClose={false}
      canvasRef={createRef()} events={[]} find={{ busy: false, close: fn, error: null, hits: [], index: null, lastQuery: "", open: false, query: "", run: async () => {}, setOpen: fn, setQuery: fn, step: fn, toggle: fn }}
      hasWorkspace={false} imeInputRef={createRef()} launchProfile={profile} launchProfileChanging={false}
      launchProfiles={[profile]} mode="terminal" open={false} panes={[]} terminalHostRef={createRef()}
      onClose={fn} onCreate={fn} onFocus={fn} onKill={fn} onOpenFolder={fn} onOpenTab={fn}
      onPaneContextMenu={fn} onPaste={fn} onProfileChange={fn} onRename={fn} onResizeStart={fn}
      onRestart={fn} onStartShell={fn} onTabContextMenu={fn} onTerminalContextMenu={fn} onToggleVisibility={fn}
    />);
    expect(html).toContain("utility-tray--collapsed");
    expect(html).toContain("Open a folder to start a terminal");
    expect(html).toContain("Utility tray surfaces");
  });
});

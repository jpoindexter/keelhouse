import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { QuickSettingsDrawer } from "./QuickSettingsDrawer";

const shell = { id: "shell", label: "Shell", command: "/bin/zsh", args: ["-l"], useLoginShell: false };

describe("QuickSettingsDrawer", () => {
  it("renders agent and layout controls", () => {
    const html = renderToStaticMarkup(<QuickSettingsDrawer approvalMode="ask" canSetApproval hasWorkspace launchProfile={shell} launchProfileChanging={false} launchProfiles={[shell]} terminalOpen={false} toolMode="files" workbenchLayout="right" onApprovalChange={vi.fn()} onBottomTrayChange={vi.fn()} onLayoutChange={vi.fn()} onOpenFolder={vi.fn()} onProfileChange={vi.fn()} onRefreshFiles={vi.fn()} onToolModeChange={vi.fn()} />);
    expect(html).toContain("New terminal pane profile");
    expect(html).toContain("Permission mode");
    expect(html).toContain("Bottom tray");
    expect(html).toContain("Tray tabs");
  });
});

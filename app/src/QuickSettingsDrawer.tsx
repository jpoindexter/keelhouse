import type { AgentApprovalMode } from "./agentSessionHandle";
import { AppIcon } from "./icons";
import type { LaunchProfile } from "./launchProfiles";
import type { ToolTrayMode, WorkbenchLayoutMode } from "./workbenchLayout";

export type QuickSettingsDrawerProps = {
  approvalMode: AgentApprovalMode;
  canSetApproval: boolean;
  hasWorkspace: boolean;
  launchProfile: LaunchProfile;
  launchProfileChanging: boolean;
  launchProfiles: LaunchProfile[];
  terminalOpen: boolean;
  toolMode: ToolTrayMode;
  workbenchLayout: WorkbenchLayoutMode;
  onApprovalChange: (mode: AgentApprovalMode) => void;
  onBottomTrayChange: (open: boolean) => void;
  onLayoutChange: (layout: WorkbenchLayoutMode) => void;
  onOpenFolder: () => void;
  onProfileChange: (profileId: string) => void;
  onRefreshFiles: () => void;
  onToolModeChange: (mode: ToolTrayMode) => void;
};

const AgentSettings = (props: Pick<QuickSettingsDrawerProps, "approvalMode" | "canSetApproval" | "launchProfile" | "launchProfileChanging" | "launchProfiles" | "onApprovalChange" | "onProfileChange">) => (
  <>
    <label className="drawer-field"><span>New terminal pane profile</span><select value={props.launchProfile.id} disabled={props.launchProfileChanging} onChange={(event) => props.onProfileChange(event.currentTarget.value)}>{props.launchProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}</select></label>
    <label className="drawer-field"><span>Permission mode</span><select value={props.approvalMode} disabled={!props.canSetApproval} onChange={(event) => props.onApprovalChange(event.currentTarget.value as AgentApprovalMode)}><option value="ask">Ask</option><option value="approveSafe">Approve safe</option><option value="fullAccess">Full access</option></select></label>
  </>
);

const LayoutSettings = (props: Pick<QuickSettingsDrawerProps, "terminalOpen" | "toolMode" | "workbenchLayout" | "onBottomTrayChange" | "onLayoutChange" | "onToolModeChange">) => (
  <>
    <label className="drawer-field"><span>Bottom tray</span><select value={props.terminalOpen ? "terminal" : "chat"} onChange={(event) => props.onBottomTrayChange(event.currentTarget.value === "terminal")}><option value="chat">Collapsed</option><option value="terminal">Terminal open</option></select></label>
    <label className="drawer-field"><span>Tool tray</span><select value={props.workbenchLayout} onChange={(event) => props.onLayoutChange(event.currentTarget.value as WorkbenchLayoutMode)}><option value="left">Left</option><option value="right">Right</option><option value="bottom">Bottom</option><option value="hidden">Hidden</option></select></label>
    <label className="drawer-field"><span>Tray tabs</span><select value={props.toolMode} onChange={(event) => props.onToolModeChange(event.currentTarget.value as ToolTrayMode)}><option value="files">Files</option><option value="split">Split editor + browser</option><option value="editor">Editor only</option><option value="browser">Browser only</option><option value="git">Git</option></select></label>
  </>
);

export const QuickSettingsDrawer = (props: QuickSettingsDrawerProps) => (
  <section className="drawer-panel" aria-label="Settings">
    <div className="panel-title">Settings</div>
    <AgentSettings {...props} />
    <LayoutSettings {...props} />
    <div className="drawer-action-grid">
      <button className="rail-open-button" type="button" onClick={props.onOpenFolder}><AppIcon name="folderOpen" /><span>Open Folder</span></button>
      <button className="rail-open-button" type="button" disabled={!props.hasWorkspace} onClick={props.onRefreshFiles}><AppIcon name="reload" /><span>Refresh Files</span></button>
    </div>
  </section>
);

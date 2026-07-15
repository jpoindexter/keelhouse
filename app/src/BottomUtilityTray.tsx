import type { MouseEvent, PointerEvent, RefObject } from "react";

import type { AgentActivityEvent } from "./agentActivity";
import { BottomUtilityTabs, type UtilityTrayMode } from "./BottomUtilityTabs";
import type { LaunchProfile } from "./launchProfiles";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import { TerminalFindBar } from "./TerminalFindBar";
import type { TerminalFindController } from "./useTerminalFind";
import { TerminalPaneControls } from "./TerminalPaneControls";
import { TerminalViewport } from "./TerminalViewport";
import { UtilityTrayLogs, UtilityTrayProcesses } from "./UtilityTrayViews";

type BottomUtilityTrayProps = {
  activePane: ManagedTerminalPane | null; activePaneId: number | null; activeProfileLabel: string;
  canClose: boolean; canvasRef: RefObject<HTMLCanvasElement | null>; events: AgentActivityEvent[];
  find: TerminalFindController; hasWorkspace: boolean; imeInputRef: RefObject<HTMLTextAreaElement | null>;
  launchProfile: LaunchProfile; launchProfileChanging: boolean; launchProfiles: LaunchProfile[];
  mode: UtilityTrayMode; open: boolean; panes: ManagedTerminalPane[];
  terminalHostRef: RefObject<HTMLDivElement | null>;
  onClose: () => void; onCreate: (profile: LaunchProfile) => void; onFocus: (paneId: number) => void;
  onKill: () => void; onOpenFolder: () => void; onOpenTab: (mode: UtilityTrayMode) => void;
  onPaneContextMenu: (event: MouseEvent<HTMLButtonElement>, pane: ManagedTerminalPane) => void;
  onPaste: (text: string) => void; onProfileChange: (profileId: string) => void;
  onRename: (pane: ManagedTerminalPane) => void; onResizeStart: (event: PointerEvent<HTMLButtonElement>) => void;
  onRestart: () => void; onStartShell: () => void;
  onTabContextMenu: (event: MouseEvent<HTMLButtonElement>, mode: UtilityTrayMode) => void;
  onTerminalContextMenu: (event: MouseEvent<HTMLDivElement>) => void; onToggleVisibility: () => void;
};

export const BottomUtilityTray = (props: BottomUtilityTrayProps) => (
  <>
    <button className="utility-tray-resizer" type="button" aria-label="Resize bottom utility tray" title="Resize bottom utility tray" onPointerDown={props.onResizeStart} />
    <section className={`utility-tray ${props.open ? "utility-tray--open" : "utility-tray--collapsed"}`} aria-label="Bottom utility tray">
      <BottomUtilityTabs mode={props.mode} open={props.open} onContextMenu={props.onTabContextMenu} onOpen={props.onOpenTab} onToggleVisibility={props.onToggleVisibility} />
      <div className={`utility-tray__body utility-tray__body--${props.mode}`}>
        <TerminalPaneControls
          activePane={props.activePane} activePaneId={props.activePaneId} canClose={props.canClose}
          hasWorkspace={props.hasWorkspace} launchProfile={props.launchProfile}
          launchProfileChanging={props.launchProfileChanging} launchProfiles={props.launchProfiles}
          panes={props.panes} onClose={props.onClose} onContextMenu={props.onPaneContextMenu}
          onCreate={props.onCreate} onFind={props.find.toggle} onFocus={props.onFocus} onKill={props.onKill}
          onProfileChange={props.onProfileChange} onRename={props.onRename} onRestart={props.onRestart}
        />
        <TerminalFindBar controller={props.find} />
        <TerminalViewport
          activeProfileLabel={props.activeProfileLabel} canvasRef={props.canvasRef}
          imeInputRef={props.imeInputRef} paneCount={props.panes.length} terminalHostRef={props.terminalHostRef}
          workspaceOpen={props.hasWorkspace} onContextMenu={props.onTerminalContextMenu}
          onOpenFolder={props.onOpenFolder} onPaste={props.onPaste} onStartShell={props.onStartShell}
        />
        <UtilityTrayProcesses panes={props.panes} onFocus={props.onFocus} />
        <UtilityTrayLogs events={props.events} />
      </div>
    </section>
  </>
);

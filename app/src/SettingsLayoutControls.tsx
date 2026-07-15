import type { ToolTrayMode, WorkbenchLayoutMode } from "./workbenchLayout";
import type { SettingsRowDef } from "./settingsModalData";
import type { SettingsModalProps } from "./settingsModalTypes";

type LayoutControlProps = { row: SettingsRowDef; props: SettingsModalProps; browserDraft: string; commitBrowserUrl: () => void; setBrowserDraft: (value: string) => void };

export function SettingsLayoutControl({ row, props, browserDraft, commitBrowserUrl, setBrowserDraft }: LayoutControlProps) {
  if (row.id === "layout.dock") return <select className="settings-modal__select" aria-label="Tool tray position" value={props.layout} onChange={(event) => props.onLayoutChange(event.currentTarget.value as WorkbenchLayoutMode)}>
    <option value="right">Right</option><option value="left">Left</option><option value="bottom">Bottom</option><option value="hidden">Hidden</option>
  </select>;
  if (row.id === "layout.tray") return <select className="settings-modal__select" aria-label="Tray surfaces" value={props.trayMode} onChange={(event) => props.onTrayModeChange(event.currentTarget.value as ToolTrayMode)}>
    <option value="files">Files</option><option value="editor">Editor</option><option value="browser">Browser</option><option value="git">Git</option><option value="split">Split</option>
  </select>;
  if (row.id === "layout.reset") return <button className="settings-modal__action" type="button" onClick={props.onResetLayout}>Reset to demo default</button>;
  if (row.id === "browser.url") return <input className="settings-modal__input" aria-label="Browser preview URL" value={browserDraft} onChange={(event) => setBrowserDraft(event.currentTarget.value)} onBlur={commitBrowserUrl} onKeyDown={(event) => {
    if (event.key === "Enter") { event.preventDefault(); commitBrowserUrl(); }
  }} />;
  return null;
}

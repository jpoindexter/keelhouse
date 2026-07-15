import type { ScopedSettingView, SettingsScope } from "./scopedSettings";
import type { SettingsRowDef } from "./settingsModalData";
import type { SettingsModalProps } from "./settingsModalTypes";
import { resolutionAt, settingsScopeLabel } from "./useSettingsWorkspaceState";

type SettingsScopeEditorProps = {
  row: SettingsRowDef; props: SettingsModalProps; selectedScope: (row: SettingsRowDef) => SettingsScope;
  setScope: (rowId: string, scope: SettingsScope) => void;
};

const scopedViewForRow = (row: SettingsRowDef, props: SettingsModalProps): ScopedSettingView<unknown> | null => {
  if (row.id === "agents.profile") return props.profileSetting;
  if (row.id === "agents.permission") return props.approvalSetting;
  if (row.id === "browser.url") return props.browserSetting;
  return null;
};

export function SettingsScopeEditor({ row, props, selectedScope, setScope }: SettingsScopeEditorProps) {
  const workspaceName = props.workspaceName ?? "Current project";
  const sessionTitle = props.sessionTitle ?? "Current chat";
  const view = scopedViewForRow(row, props);
  if (!view) return <small className="settings-workspace__scope">{settingsScopeLabel(row.scope, workspaceName, sessionTitle)}</small>;
  const scope = selectedScope(row);
  const resolution = resolutionAt(view, scope);
  const sourceLabel = settingsScopeLabel(resolution.source, workspaceName, sessionTitle);
  const status = scope === "global" ? "Global default" : resolution.overridden ? `${scope === "project" ? "Project" : "Chat"} override` : `Inherited from ${sourceLabel}`;
  return <div className="settings-workspace__scope-editor">
    <select className="settings-workspace__scope-select" aria-label={`${row.label} scope`} value={scope} onChange={(event) => setScope(row.id, event.currentTarget.value as SettingsScope)}>
      <option value="global">Global</option>
      <option value="project" disabled={!view.project}>Project</option>
      <option value="chat" disabled={!view.chat}>Chat</option>
    </select>
    <small className="settings-workspace__scope">{status}</small>
    {scope !== "global" && resolution.overridden ? <button className="settings-workspace__scope-reset" type="button" onClick={() => props.onScopedSettingReset(row.id as "agents.profile" | "agents.permission" | "browser.url", scope)}>Reset override</button> : null}
  </div>;
}

import { AppIcon } from "./icons";
import type { SettingsScope } from "./scopedSettings";
import type { SettingsCategory, SettingsRowDef } from "./settingsModalData";
import type { SettingsModalProps } from "./settingsModalTypes";
import { SettingsRowControl } from "./SettingsRowControl";
import { SettingsScopeEditor } from "./SettingsScopeEditor";
import { SettingsShortcutTable } from "./SettingsShortcutTable";
import { settingsScopeLabel } from "./useSettingsWorkspaceState";

type SettingsContentProps = {
  activeCategory: SettingsCategory; browserDraft: string; query: string; searching: boolean;
  visibleRows: SettingsRowDef[]; props: SettingsModalProps;
  selectedScope: (row: SettingsRowDef) => SettingsScope; setBrowserDraft: (value: string) => void;
  setScope: (rowId: string, scope: SettingsScope) => void; commitBrowserUrl: () => void;
};

function SettingsContentHeader({ activeCategory, query, searching, count }: Pick<SettingsContentProps, "activeCategory" | "query" | "searching"> & { count: number }) {
  const icon = searching ? "search" : activeCategory.icon;
  return <header className="settings-workspace__content-header"><AppIcon name={icon} /><div>
    <h1>{searching ? "Search results" : activeCategory.label}</h1>
    <p>{searching ? `${count} setting${count === 1 ? "" : "s"} match “${query.trim()}”.` : activeCategory.description}</p>
  </div></header>;
}

function SettingsRow({ row, content }: { row: SettingsRowDef; content: SettingsContentProps }) {
  const workspaceName = content.props.workspaceName ?? "Current project";
  const sessionTitle = content.props.sessionTitle ?? "Current chat";
  if (row.id === "shortcuts.reference") return <div className="settings-modal__row settings-modal__row--block">
    <div className="settings-modal__copy"><strong>{row.label}</strong><span>{row.hint}</span><small className="settings-workspace__scope">{settingsScopeLabel(row.scope, workspaceName, sessionTitle)}</small></div>
    <SettingsShortcutTable keybindingOverrides={content.props.keybindingOverrides ?? {}} onKeybindingOverrideChange={content.props.onKeybindingOverrideChange} />
  </div>;
  const scoped = ["agents.profile", "agents.permission", "browser.url"].includes(row.id);
  return <div className="settings-modal__row">
    <div className="settings-modal__copy"><strong>{row.label}</strong><span>{row.hint}</span></div>
    <div className="settings-workspace__row-control">
      <SettingsRowControl row={row} props={content.props} scope={content.selectedScope(row)} browserDraft={content.browserDraft} commitBrowserUrl={content.commitBrowserUrl} setBrowserDraft={content.setBrowserDraft} />
      {scoped ? <SettingsScopeEditor row={row} props={content.props} selectedScope={content.selectedScope} setScope={content.setScope} /> : <small className="settings-workspace__scope">{settingsScopeLabel(row.scope, workspaceName, sessionTitle)}</small>}
    </div>
  </div>;
}

export function SettingsContent(content: SettingsContentProps) {
  return <main className="settings-workspace__content">
    <SettingsContentHeader activeCategory={content.activeCategory} query={content.query} searching={content.searching} count={content.visibleRows.length} />
    <div className="settings-workspace__rows">
      {content.visibleRows.length === 0 ? <div className="settings-modal__empty">No settings match “{content.query.trim()}”.</div>
        : content.visibleRows.map((row) => <SettingsRow content={content} key={row.id} row={row} />)}
    </div>
  </main>;
}

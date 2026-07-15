import { AppIcon } from "./icons";
import type { SettingsScope } from "./scopedSettings";
import { SettingsContent } from "./SettingsContent";
import { SettingsNavigation } from "./SettingsNavigation";
import type { SettingsModalProps } from "./settingsModalTypes";
import { useSettingsWorkspaceState } from "./useSettingsWorkspaceState";

export type { SettingsModalProps } from "./settingsModalTypes";

export function SettingsModal(props: SettingsModalProps) {
  const state = useSettingsWorkspaceState(props);
  const changeCategory = (category: typeof state.category) => {
    state.setQuery("");
    state.setCategory(category);
  };
  const setScope = (rowId: string, scope: SettingsScope) =>
    state.setScopeByRow((current) => ({ ...current, [rowId]: scope }));
  return <section className="settings-workspace" aria-label="Settings" onKeyDown={(event) => {
    if (event.key === "Escape") { event.preventDefault(); props.onClose(); }
  }}>
    <header className="settings-workspace__header" data-tauri-drag-region>
      <button className="settings-workspace__back" type="button" onClick={props.onClose}><AppIcon name="back" /><span>Back to app</span></button>
      <strong className="settings-workspace__title">Settings</strong>
      <div className="settings-workspace__search-wrap"><AppIcon name="search" /><input ref={state.searchRef} className="settings-workspace__search" aria-label="Search settings" placeholder="Search settings…" value={state.query} onChange={(event) => state.setQuery(event.currentTarget.value)} /></div>
    </header>
    <div className="settings-workspace__body">
      <SettingsNavigation category={state.category} searching={state.searching} onCategoryChange={changeCategory} />
      <SettingsContent
        activeCategory={state.activeCategory}
        browserDraft={state.browserDraft}
        commitBrowserUrl={state.commitBrowserUrl}
        props={props}
        query={state.query}
        searching={state.searching}
        selectedScope={state.selectedScope}
        setBrowserDraft={state.setBrowserDraft}
        setScope={setScope}
        visibleRows={state.visibleRows}
      />
    </div>
  </section>;
}

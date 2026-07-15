import { useEffect, useRef, useState } from "react";

import type { ScopedSettingView, SettingsScope } from "./scopedSettings";
import { filterSettingsRows, SETTINGS_CATEGORIES, SETTINGS_ROWS, settingsRowsForCategory, type SettingsCategoryId, type SettingsRowDef } from "./settingsModalData";
import type { SettingsModalProps } from "./settingsModalTypes";

export const resolutionAt = <T,>(view: ScopedSettingView<T>, scope: SettingsScope) => view[scope] ?? view.global;
export const settingsScopeLabel = (scope: SettingsScope, workspaceName: string, sessionTitle: string) => {
  if (scope === "project") return `Project · ${workspaceName}`;
  if (scope === "chat") return `Chat · ${sessionTitle}`;
  return "Global";
};

export function useSettingsWorkspaceState(props: SettingsModalProps) {
  const [category, setCategory] = useState<SettingsCategoryId>(props.initialCategory ?? "general");
  const [query, setQuery] = useState(props.initialQuery ?? "");
  const [scopeByRow, setScopeByRow] = useState<Partial<Record<string, SettingsScope>>>({});
  const initialBrowser = props.browserSetting.chat?.value ?? props.browserSetting.project?.value ?? props.browserSetting.global.value;
  const [browserDraft, setBrowserDraft] = useState(initialBrowser);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const searching = query.trim().length > 0;
  const visibleRows = searching ? filterSettingsRows(SETTINGS_ROWS, query) : settingsRowsForCategory(SETTINGS_ROWS, category);
  const selectedScope = (row: SettingsRowDef): SettingsScope => scopeByRow[row.id] ?? row.scope;
  const browserRow = SETTINGS_ROWS.find((row) => row.id === "browser.url")!;
  const browserResolution = resolutionAt(props.browserSetting, selectedScope(browserRow));
  useEffect(() => { searchRef.current?.focus(); }, []);
  useEffect(() => { setBrowserDraft(browserResolution.value); }, [browserResolution.value, scopeByRow["browser.url"]]);
  const commitBrowserUrl = () => {
    const next = browserDraft.trim();
    if (next && next !== browserResolution.value) props.onBrowserUrlCommit(selectedScope(browserRow), next);
  };
  return {
    activeCategory: SETTINGS_CATEGORIES.find((entry) => entry.id === category) ?? SETTINGS_CATEGORIES[0],
    browserDraft, category, commitBrowserUrl, query, scopeByRow, searchRef, searching, selectedScope,
    setBrowserDraft, setCategory, setQuery, setScopeByRow, visibleRows,
  };
}

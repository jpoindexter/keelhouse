import { useEffect, useRef, useState } from "react";

import { AppIcon } from "./icons";
import type { AgentApprovalMode } from "./agentSessionHandle";
import type { ToolTrayMode, WorkbenchLayoutMode } from "./workbenchLayout";
import {
  filterSettingsRows,
  IGNORED_FOLDERS,
  SETTINGS_CATEGORIES,
  SETTINGS_ROWS,
  settingsRowsForCategory,
  type SettingsCategoryId,
  type SettingsRowDef,
} from "./settingsModalData";
import {
  eventToCombo,
  findKeybindingConflicts,
  resolveShortcutKeys,
  SHORTCUTS,
  type KeybindingOverrides,
} from "./shortcuts";

type SettingsProfileOption = { id: string; label: string };

type SettingsModalProps = {
  approvalMode: AgentApprovalMode;
  browserUrl: string;
  gitBranch: string | null;
  gitChangeCount: number | null;
  initialCategory?: SettingsCategoryId;
  initialQuery?: string;
  keybindingOverrides?: KeybindingOverrides;
  layout: WorkbenchLayoutMode;
  profileId: string;
  profiles: SettingsProfileOption[];
  trayMode: ToolTrayMode;
  onApprovalModeChange: (mode: AgentApprovalMode) => void;
  onBrowserUrlCommit: (url: string) => void;
  onClose: () => void;
  onKeybindingOverrideChange?: (id: string, keys: string[] | null) => void;
  onLayoutChange: (layout: WorkbenchLayoutMode) => void;
  onProfileChange: (profileId: string) => void;
  onResetLayout: () => void;
  onTrayModeChange: (mode: ToolTrayMode) => void;
};

export function SettingsModal({
  approvalMode,
  browserUrl,
  gitBranch,
  gitChangeCount,
  initialCategory = "general",
  initialQuery = "",
  keybindingOverrides = {},
  layout,
  profileId,
  profiles,
  trayMode,
  onApprovalModeChange,
  onBrowserUrlCommit,
  onClose,
  onKeybindingOverrideChange,
  onLayoutChange,
  onProfileChange,
  onResetLayout,
  onTrayModeChange,
}: SettingsModalProps) {
  const [category, setCategory] = useState<SettingsCategoryId>(initialCategory);
  const [query, setQuery] = useState(initialQuery);
  const [browserDraft, setBrowserDraft] = useState(browserUrl);
  const [capturingId, setCapturingId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const conflicts = findKeybindingConflicts();

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const searching = query.trim().length > 0;
  const visibleRows = searching
    ? filterSettingsRows(SETTINGS_ROWS, query)
    : settingsRowsForCategory(SETTINGS_ROWS, category);

  const commitBrowserUrl = () => {
    const next = browserDraft.trim();
    if (next && next !== browserUrl) onBrowserUrlCommit(next);
  };

  const control = (row: SettingsRowDef) => {
    if (row.id === "general.profile") {
      return (
        <select
          className="settings-modal__select"
          aria-label="Default agent profile"
          value={profileId}
          onChange={(event) => onProfileChange(event.currentTarget.value)}
        >
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>{profile.label}</option>
          ))}
        </select>
      );
    }
    if (row.id === "general.permission") {
      return (
        <select
          className="settings-modal__select"
          aria-label="Permission mode"
          value={approvalMode}
          onChange={(event) => onApprovalModeChange(event.currentTarget.value as AgentApprovalMode)}
        >
          <option value="ask">Ask</option>
          <option value="approveSafe">Approve safe</option>
          <option value="fullAccess">Full access</option>
        </select>
      );
    }
    if (row.id === "layout.dock") {
      return (
        <select
          className="settings-modal__select"
          aria-label="Tool tray position"
          value={layout}
          onChange={(event) => onLayoutChange(event.currentTarget.value as WorkbenchLayoutMode)}
        >
          <option value="right">Right</option>
          <option value="left">Left</option>
          <option value="bottom">Bottom</option>
          <option value="hidden">Hidden</option>
        </select>
      );
    }
    if (row.id === "layout.tray") {
      return (
        <select
          className="settings-modal__select"
          aria-label="Tray surfaces"
          value={trayMode}
          onChange={(event) => onTrayModeChange(event.currentTarget.value as ToolTrayMode)}
        >
          <option value="editor">Editor</option>
          <option value="browser">Browser</option>
          <option value="split">Split</option>
        </select>
      );
    }
    if (row.id === "layout.reset") {
      return (
        <button className="settings-modal__action" type="button" onClick={onResetLayout}>
          Reset to demo default
        </button>
      );
    }
    if (row.id === "browser.url") {
      return (
        <input
          className="settings-modal__input"
          aria-label="Browser preview URL"
          value={browserDraft}
          onChange={(event) => setBrowserDraft(event.currentTarget.value)}
          onBlur={commitBrowserUrl}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitBrowserUrl();
            }
          }}
        />
      );
    }
    if (row.id === "git.health") {
      return (
        <span className="settings-modal__value">
          {gitBranch
            ? `⎇ ${gitBranch}${gitChangeCount != null ? ` · ${gitChangeCount} change${gitChangeCount === 1 ? "" : "s"}` : ""}`
            : "No repository detected"}
        </span>
      );
    }
    if (row.id === "app.ignored") {
      return <span className="settings-modal__value">{IGNORED_FOLDERS.join("  ")}</span>;
    }
    if (row.id === "app.theme") {
      return <span className="settings-modal__value">Graphite · steel-cyan · Inter</span>;
    }
    return null;
  };

  const shortcutTable = (
    <>
      {conflicts.length > 0 ? (
        <div className="settings-modal__conflict" role="alert">
          {conflicts
            .map((conflict) => `${conflict.keys} is bound to ${conflict.ids.join(" and ")}`)
            .join("; ")}
          . Rebind one of them.
        </div>
      ) : null}
      <table className="settings-modal__shortcuts">
        <thead>
          <tr>
            <th scope="col">Action</th>
            <th scope="col">Keys</th>
            <th scope="col">Scope</th>
            <th scope="col"><span className="settings-modal__sr">Edit</span></th>
          </tr>
        </thead>
        <tbody>
          {SHORTCUTS.filter((shortcut) => shortcut.status === "active" || shortcut.status === "native").map((shortcut) => {
            const overridden = Boolean(keybindingOverrides[shortcut.id]);
            const editable = shortcut.status === "active" && Boolean(onKeybindingOverrideChange);
            return (
              <tr key={shortcut.id}>
                <td>{shortcut.label}</td>
                <td>
                  {capturingId === shortcut.id ? (
                    <input
                      className="settings-modal__capture"
                      aria-label={`Press new keys for ${shortcut.label}`}
                      placeholder="Press keys…"
                      autoFocus
                      readOnly
                      onKeyDown={(event) => {
                        event.preventDefault();
                        if (event.key === "Escape") {
                          setCapturingId(null);
                          return;
                        }
                        const combo = eventToCombo(event);
                        if (!combo) return;
                        onKeybindingOverrideChange?.(shortcut.id, [combo]);
                        setCapturingId(null);
                      }}
                      onBlur={() => setCapturingId(null)}
                    />
                  ) : (
                    <>
                      {resolveShortcutKeys(shortcut.id).join(" / ")}
                      {overridden ? <span className="settings-modal__overridden"> (custom)</span> : null}
                    </>
                  )}
                </td>
                <td>{shortcut.scope}</td>
                <td>
                  {editable ? (
                    <span className="settings-modal__shortcut-actions">
                      <button className="settings-modal__action" type="button" onClick={() => setCapturingId(shortcut.id)}>
                        Rebind
                      </button>
                      {overridden ? (
                        <button
                          className="settings-modal__action"
                          type="button"
                          onClick={() => onKeybindingOverrideChange?.(shortcut.id, null)}
                        >
                          Reset
                        </button>
                      ) : null}
                    </span>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );

  return (
    <div
      className="command-palette-backdrop"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <div className="settings-modal" role="dialog" aria-modal="true" aria-label="Settings">
        <header className="settings-modal__head">
          <strong>Settings</strong>
          <input
            ref={searchRef}
            className="settings-modal__search"
            aria-label="Search settings"
            placeholder="Search settings"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
          <button className="settings-modal__close" type="button" aria-label="Close settings" onClick={onClose}>
            <AppIcon name="close" />
          </button>
        </header>
        <div className="settings-modal__grid">
          <nav className="settings-modal__nav" aria-label="Settings categories">
            {SETTINGS_CATEGORIES.map((entry) => (
              <button
                key={entry.id}
                className={`settings-modal__nav-row ${!searching && entry.id === category ? "settings-modal__nav-row--active" : ""}`}
                type="button"
                aria-current={!searching && entry.id === category ? "true" : undefined}
                onClick={() => {
                  setQuery("");
                  setCategory(entry.id);
                }}
              >
                <AppIcon name={entry.icon} />
                <span>{entry.label}</span>
              </button>
            ))}
          </nav>
          <div className="settings-modal__content">
            {visibleRows.length === 0 ? (
              <div className="settings-modal__empty">No settings match “{query.trim()}”.</div>
            ) : (
              visibleRows.map((row) =>
                row.id === "shortcuts.reference" ? (
                  <div className="settings-modal__row settings-modal__row--block" key={row.id}>
                    <div className="settings-modal__copy">
                      <strong>{row.label}</strong>
                      <span>{row.hint}</span>
                    </div>
                    {shortcutTable}
                  </div>
                ) : (
                  <div className="settings-modal__row" key={row.id}>
                    <div className="settings-modal__copy">
                      <strong>{row.label}</strong>
                      <span>{row.hint}</span>
                    </div>
                    {control(row)}
                  </div>
                ),
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

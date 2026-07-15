import { COMMAND_PALETTE_SOURCE_OPTIONS, DEFAULT_COMMAND_PALETTE_SOURCES } from "./commandPaletteSources";
import { DEFAULT_AI_CONNECTION_SETTINGS } from "./connectionSettings";
import { ConnectionSettingsPanel } from "./ConnectionSettingsPanel";
import type { SettingsScope } from "./scopedSettings";
import type { SettingsRowDef } from "./settingsModalData";
import type { SettingsModalProps } from "./settingsModalTypes";
import { SettingsAgentControl } from "./SettingsAgentControls";
import { SettingsAppControl } from "./SettingsAppControls";
import { SettingsLayoutControl } from "./SettingsLayoutControls";
import { SettingsSourceControl } from "./SettingsSourceControl";

type SettingsRowControlProps = {
  row: SettingsRowDef; props: SettingsModalProps; scope: SettingsScope; browserDraft: string;
  commitBrowserUrl: () => void; setBrowserDraft: (value: string) => void;
};

function ConnectionControl({ props }: { props: SettingsModalProps }) {
  return <ConnectionSettingsPanel
    settings={props.aiConnectionSettings ?? DEFAULT_AI_CONNECTION_SETTINGS}
    workspacePath={props.workspacePath ?? ""}
    secretPresence={props.connectionSecretPresence ?? {}}
    onChange={(next) => props.onAiConnectionSettingsChange?.(next)}
    onDeleteSecret={props.onDeleteConnectionSecret ?? (async () => {})}
    onSaveSecret={props.onSaveConnectionSecret ?? (async () => {})}
    onValidateTarget={props.onValidateConnectionTarget ?? (async () => ({ ok: false, message: "Validation unavailable." }))}
    onBeginOAuth={props.onBeginMcpOAuth ?? (async () => { throw new Error("OAuth authorization unavailable."); })}
    onDisconnectOAuth={props.onDisconnectMcpOAuth ?? (async () => { throw new Error("OAuth disconnect unavailable."); })}
    oauthStatuses={props.mcpOAuthStatuses ?? {}}
  />;
}

function PaletteSourcesControl({ props }: { props: SettingsModalProps }) {
  const sources = props.commandPaletteSources ?? DEFAULT_COMMAND_PALETTE_SOURCES;
  return <div className="settings-workspace__source-list" role="group" aria-label="Command palette sources">
    {COMMAND_PALETTE_SOURCE_OPTIONS.map((source) => <label className="settings-workspace__source-row" key={source.id}>
      <input type="checkbox" aria-label={`Toggle ${source.label} command palette source`} checked={sources[source.id]} onChange={(event) => props.onCommandPaletteSourceChange?.(source.id, event.currentTarget.checked)} />
      <span><strong>{source.label}</strong><small>{source.description}</small></span>
    </label>)}
  </div>;
}

export function SettingsRowControl({ row, props, scope, browserDraft, commitBrowserUrl, setBrowserDraft }: SettingsRowControlProps) {
  if (row.id.startsWith("agents.")) return <SettingsAgentControl row={row} props={props} scope={scope} />;
  if (row.id === "connections.manage") return <ConnectionControl props={props} />;
  if (row.id === "shortcuts.palette-sources") return <PaletteSourcesControl props={props} />;
  if (row.id.startsWith("layout.") || row.id === "browser.url") return <SettingsLayoutControl row={row} props={props} browserDraft={browserDraft} commitBrowserUrl={commitBrowserUrl} setBrowserDraft={setBrowserDraft} />;
  if (row.id.startsWith("git.")) return <SettingsSourceControl row={row} props={props} />;
  if (row.id.startsWith("app.")) return <SettingsAppControl row={row} props={props} />;
  return null;
}

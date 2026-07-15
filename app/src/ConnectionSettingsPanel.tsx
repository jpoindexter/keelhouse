import { useState } from "react";

import type {
  AiConnectionSettings,
  ConnectionTargetStatus,
  McpOAuthStart,
  McpOAuthStatus,
  McpServerConfig,
} from "./connectionSettings";
import { ConnectionProviderSettings } from "./ConnectionProviderSettings";
import { McpServerSettings } from "./McpServerSettings";
import { ProjectEnvironmentSettings } from "./ProjectEnvironmentSettings";

type ConnectionSettingsPanelProps = {
  settings: AiConnectionSettings;
  workspacePath: string;
  secretPresence: Record<string, boolean>;
  onChange: (settings: AiConnectionSettings) => void;
  onDeleteSecret: (key: string) => Promise<void>;
  onSaveSecret: (key: string, value: string) => Promise<void>;
  onValidateTarget: (server: McpServerConfig) => Promise<ConnectionTargetStatus>;
  onBeginOAuth: (server: McpServerConfig) => Promise<McpOAuthStart>;
  onDisconnectOAuth: (server: McpServerConfig) => Promise<McpOAuthStatus>;
  oauthStatuses: Record<string, McpOAuthStatus>;
};

export function ConnectionSettingsPanel(props: ConnectionSettingsPanelProps) {
  const [formError, setFormError] = useState("");
  const shared = { settings: props.settings, onChange: props.onChange, onError: setFormError };
  return <div className="connection-settings">
    <ConnectionProviderSettings {...shared} secretPresence={props.secretPresence} onDeleteSecret={props.onDeleteSecret} onSaveSecret={props.onSaveSecret} />
    <ProjectEnvironmentSettings {...shared} workspacePath={props.workspacePath} secretPresence={props.secretPresence} onDeleteSecret={props.onDeleteSecret} onSaveSecret={props.onSaveSecret} />
    <McpServerSettings {...shared} secretPresence={props.secretPresence} onDeleteSecret={props.onDeleteSecret} onSaveSecret={props.onSaveSecret} onValidateTarget={props.onValidateTarget} onBeginOAuth={props.onBeginOAuth} onDisconnectOAuth={props.onDisconnectOAuth} oauthStatuses={props.oauthStatuses} />
    {formError ? <p className="connection-settings__error" role="alert">{formError}</p> : null}
  </div>;
}

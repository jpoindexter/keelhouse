import { useState } from "react";

import {
  CONNECTION_PROVIDER_IDS,
  providerSecretKey,
  type AiConnectionSettings,
  type ConnectionProviderId,
} from "./connectionSettings";
import { connectionErrorText } from "./connectionSettingsPanelHelpers";

const LABELS: Record<ConnectionProviderId, string> = { codex: "Codex", gemini: "Gemini", claude: "Claude" };

type ProviderRowProps = {
  provider: ConnectionProviderId;
  settings: AiConnectionSettings;
  secretPresent: boolean;
  onChange: (settings: AiConnectionSettings) => void;
  onDeleteSecret: (key: string) => Promise<void>;
  onSaveSecret: (key: string, value: string) => Promise<void>;
  onError: (message: string) => void;
};

function ProviderRow({ provider, settings, secretPresent, onChange, onDeleteSecret, onSaveSecret, onError }: ProviderRowProps) {
  const [secret, setSecret] = useState("");
  const label = LABELS[provider];
  const key = providerSecretKey(provider);
  const save = async () => {
    try {
      await onSaveSecret(key, secret);
      setSecret("");
      onError("");
    } catch (error) {
      onError(connectionErrorText(error));
    }
  };
  const clear = async () => {
    try {
      await onDeleteSecret(key);
      onError("");
    } catch (error) {
      onError(connectionErrorText(error));
    }
  };
  return <div className="connection-settings__provider">
    <strong>{label}</strong>
    <label><span>Default model</span><input aria-label={`${label} default model`} value={settings.providerModels[provider]} onChange={(event) => onChange({ ...settings, providerModels: { ...settings.providerModels, [provider]: event.currentTarget.value.slice(0, 128) } })} placeholder="Provider default" /></label>
    <label><span>API key</span><input aria-label={`${label} API key`} type="password" autoComplete="off" value={secret} onChange={(event) => setSecret(event.currentTarget.value)} placeholder={secretPresent ? "Stored in Keychain" : "Not configured"} /></label>
    <div className="connection-settings__actions">
      <span>{secretPresent ? "Keychain: configured" : "Keychain: empty"}</span>
      <button type="button" disabled={!secret} onClick={() => void save()}>Save key</button>
      <button type="button" disabled={!secretPresent} onClick={() => void clear()}>Clear</button>
    </div>
  </div>;
}

type ProviderSettingsProps = Omit<ProviderRowProps, "provider" | "secretPresent"> & {
  secretPresence: Record<string, boolean>;
};

export function ConnectionProviderSettings(props: ProviderSettingsProps) {
  return <section aria-labelledby="connection-provider-heading">
    <h3 id="connection-provider-heading">Provider defaults</h3>
    <p>Models are stored locally. API keys are write-only in macOS Keychain.</p>
    {CONNECTION_PROVIDER_IDS.map((provider) => <ProviderRow
      {...props}
      provider={provider}
      secretPresent={Boolean(props.secretPresence[providerSecretKey(provider)])}
      key={provider}
    />)}
  </section>;
}

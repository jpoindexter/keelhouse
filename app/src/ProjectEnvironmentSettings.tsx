import { environmentSecretKey, type AiConnectionSettings } from "./connectionSettings";
import { useProjectEnvironmentSettings } from "./useProjectEnvironmentSettings";

type ProjectEnvironmentSettingsProps = {
  settings: AiConnectionSettings;
  workspacePath: string;
  secretPresence: Record<string, boolean>;
  onChange: (settings: AiConnectionSettings) => void;
  onDeleteSecret: (key: string) => Promise<void>;
  onSaveSecret: (key: string, value: string) => Promise<void>;
  onError: (message: string) => void;
};

export function ProjectEnvironmentSettings(props: ProjectEnvironmentSettingsProps) {
  const form = useProjectEnvironmentSettings(props);
  return <section aria-labelledby="connection-environment-heading">
    <h3 id="connection-environment-heading">Project environment</h3>
    <p>{props.workspacePath || "No project open"}. Secret values stay in Keychain and are never displayed again.</p>
    <div className="connection-settings__list">
      {form.environment.map((variable) => <div className="connection-settings__list-row" key={variable.id}>
        <span><strong>{variable.name}</strong><small>{variable.secret ? (props.secretPresence[environmentSecretKey(variable.id)] ? "Secret · Keychain configured" : "Secret · missing") : variable.value}</small></span>
        <button type="button" onClick={() => void form.remove(variable.id, variable.secret)}>Remove</button>
      </div>)}
    </div>
    <div className="connection-settings__form connection-settings__form--environment">
      <input aria-label="Environment variable name" value={form.draft.name} onChange={(event) => form.setDraft({ ...form.draft, name: event.currentTarget.value })} placeholder="VARIABLE_NAME" />
      <input aria-label="Environment variable value" type={form.draft.secret ? "password" : "text"} value={form.draft.value} onChange={(event) => form.setDraft({ ...form.draft, value: event.currentTarget.value })} placeholder="Value" />
      <label className="connection-settings__check"><input aria-label="Secret" type="checkbox" checked={form.draft.secret} onChange={(event) => form.setDraft({ ...form.draft, secret: event.currentTarget.checked })} /> Secret</label>
      <button type="button" disabled={!props.workspacePath} onClick={() => void form.add()}>Add</button>
    </div>
  </section>;
}

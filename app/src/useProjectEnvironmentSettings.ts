import { useState } from "react";

import {
  environmentSecretKey,
  environmentVariablesForProject,
  type AiConnectionSettings,
} from "./connectionSettings";
import { connectionErrorText } from "./connectionSettingsPanelHelpers";

type EnvironmentDraft = { name: string; value: string; secret: boolean };
const EMPTY_DRAFT: EnvironmentDraft = { name: "", value: "", secret: false };

type EnvironmentParams = {
  settings: AiConnectionSettings;
  workspacePath: string;
  onChange: (settings: AiConnectionSettings) => void;
  onDeleteSecret: (key: string) => Promise<void>;
  onSaveSecret: (key: string, value: string) => Promise<void>;
  onError: (message: string) => void;
};

export const useProjectEnvironmentSettings = (params: EnvironmentParams) => {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const environment = environmentVariablesForProject(params.settings, params.workspacePath);
  const add = async () => {
    const name = draft.name.trim().toUpperCase();
    if (!/^[A-Z_][A-Z0-9_]*$/.test(name)) return params.onError("Environment name must use letters, numbers, and underscores and cannot start with a number.");
    if (environment.some((variable) => variable.name === name)) return params.onError(`${name} already exists for this project.`);
    if (!draft.value) return params.onError("Environment value is required.");
    const id = crypto.randomUUID();
    try {
      if (draft.secret) await params.onSaveSecret(environmentSecretKey(id), draft.value);
    } catch (error) {
      return params.onError(connectionErrorText(error));
    }
    params.onChange({
      ...params.settings,
      environmentByProject: {
        ...params.settings.environmentByProject,
        [params.workspacePath]: [...environment, { id, name, value: draft.secret ? "" : draft.value, secret: draft.secret }],
      },
    });
    setDraft(EMPTY_DRAFT);
    params.onError("");
  };
  const remove = async (id: string, secret: boolean) => {
    try {
      if (secret) await params.onDeleteSecret(environmentSecretKey(id));
    } catch (error) {
      return params.onError(connectionErrorText(error));
    }
    params.onChange({ ...params.settings, environmentByProject: {
      ...params.settings.environmentByProject,
      [params.workspacePath]: environment.filter((variable) => variable.id !== id),
    } });
  };
  return { add, draft, environment, remove, setDraft };
};

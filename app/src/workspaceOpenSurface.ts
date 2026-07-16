import { invoke } from "@tauri-apps/api/core";
import { confirm as confirmDialog } from "@tauri-apps/plugin-dialog";
import {
  connectionEnvironmentInputs,
  type AiConnectionSettings,
  type ConnectionEnvironmentInput,
} from "./connectionSettings";
import { defaultTerminalLaunchProfile, type LaunchProfile } from "./launchProfiles";
import { createWorkspaceOpenActions } from "./workspaceOpenActions";
import {
  createWorkspaceOpenLifecycleController,
  type WorkspaceOpenStore,
} from "./workspaceOpenLifecycleController";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import {
  createWorkspaceOpenTargetController,
  type OpenedWorkspaceTarget,
} from "./workspaceOpenTargetController";

type Ref<T> = { current: T };

type TargetInput<TSnapshot> = Omit<
  Parameters<typeof createWorkspaceOpenTargetController<TSnapshot, ConnectionEnvironmentInput[]>>[0],
  "createPane" | "defaultProfileId" | "focusPane" | "getEnvironment" | "openWorkspace" | "resolveWorkspace"
>;

type LifecycleInput<TConversation, TEditorSnapshot, THarness, TPaneLayout> = Omit<
  Parameters<typeof createWorkspaceOpenLifecycleController<TConversation, TEditorSnapshot, THarness, TPaneLayout>>[0],
  "logHealthEvent"
>;

type ActionsInput = Omit<
  Parameters<typeof createWorkspaceOpenActions<
    OpenedWorkspaceTarget, LaunchProfile, ManagedTerminalPane[], WorkspaceOpenStore | null
  >>[0],
  "applyOpened" | "completeOpened" | "confirmDiscard" | "handleError" | "openTarget"
>;

type WorkspaceOpenSurfaceInput<
  TSnapshot, TConversation, TEditorSnapshot, THarness, TPaneLayout,
> = {
  actions: ActionsInput;
  connectionSettings: Ref<AiConnectionSettings>;
  lifecycle: LifecycleInput<TConversation, TEditorSnapshot, THarness, TPaneLayout>;
  target: TargetInput<TSnapshot>;
};

const wireTarget = <TSnapshot>(
  target: TargetInput<TSnapshot>,
  connectionSettings: Ref<AiConnectionSettings>,
) => createWorkspaceOpenTargetController<TSnapshot, ConnectionEnvironmentInput[]>({
  ...target,
  createPane: (path, profile, environment) =>
    invoke<{ paneId: number }>("create_pane", { path, profile, environment }),
  defaultProfileId: defaultTerminalLaunchProfile().id,
  focusPane: (paneId) => invoke("focus_pane", { paneId }),
  getEnvironment: (path) => connectionEnvironmentInputs(connectionSettings.current, path),
  openWorkspace: (path, profile, environment) =>
    invoke<{ paneId: number; root: string }>("open_workspace", { path, profile, environment }),
  resolveWorkspace: (path) => invoke<{ root: string }>("resolve_workspace", { path }),
});

export const createWorkspaceOpenSurface = <
  TSnapshot, TConversation, TEditorSnapshot, THarness, TPaneLayout,
>(
  input: WorkspaceOpenSurfaceInput<
    TSnapshot, TConversation, TEditorSnapshot, THarness, TPaneLayout
  >,
) => {
  const target = wireTarget(input.target, input.connectionSettings);
  const lifecycle = createWorkspaceOpenLifecycleController({
    ...input.lifecycle,
    logHealthEvent: (message: string) => invoke("log_health_event", { message }),
  });
  return createWorkspaceOpenActions({
    ...input.actions,
    applyOpened: target.applyOpenedWorkspaceTarget,
    completeOpened: lifecycle.completeOpenedWorkspace,
    confirmDiscard: (count) => confirmDialog(
      `Switch workspace and discard ${count} unsaved editor tabs?`,
    ),
    handleError: lifecycle.handleWorkspaceOpenError,
    openTarget: target.prepareAndOpenWorkspaceTarget,
  });
};

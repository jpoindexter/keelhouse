import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { normalizeAgentConnectionsStatus, type AgentConnectionsStatus } from "./agentConnections";
import { normalizeSourceControlStatus, type SourceControlStatus } from "./sourceControl";
import { parseRemoteUrl, type RepoLocation } from "./sourceControlLinks";

const useSourceControlHealth = (settingsOpen: boolean, workspacePath: string | null) => {
  const [status, setStatus] = useState<SourceControlStatus | null>(null);
  useEffect(() => {
    let cancelled = false;
    invoke<unknown>("source_control_status")
      .then((result) => { if (!cancelled) setStatus(normalizeSourceControlStatus(result)); })
      .catch(() => { if (!cancelled) setStatus(null); });
    return () => { cancelled = true; };
  }, [settingsOpen, workspacePath]);
  return status;
};

const useAgentConnectionHealth = (settingsOpen: boolean) => {
  const [status, setStatus] = useState<AgentConnectionsStatus | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(() => {
    setRefreshing(true);
    invoke<unknown>("agent_connections_status")
      .then((result) => setStatus(normalizeAgentConnectionsStatus(result)))
      .catch(() => setStatus(null))
      .finally(() => setRefreshing(false));
  }, []);
  useEffect(() => { if (settingsOpen) refresh(); }, [refresh, settingsOpen]);
  return { refreshing, refresh, status };
};

const useRepoLocation = (settingsOpen: boolean, workspacePath: string | null) => {
  const [location, setLocation] = useState<RepoLocation | null>(null);
  useEffect(() => {
    if (!workspacePath) { setLocation(null); return; }
    let cancelled = false;
    invoke<string | null>("git_remote_url", { root: workspacePath })
      .then((url) => { if (!cancelled) setLocation(url ? parseRemoteUrl(url) : null); })
      .catch(() => { if (!cancelled) setLocation(null); });
    return () => { cancelled = true; };
  }, [settingsOpen, workspacePath]);
  return location;
};

export const useSettingsRuntimeStatus = (settingsOpen: boolean, workspacePath: string | null) => {
  const agentConnections = useAgentConnectionHealth(settingsOpen);
  return {
    agentConnectionsRefreshing: agentConnections.refreshing,
    agentConnectionsStatus: agentConnections.status,
    refreshAgentConnections: agentConnections.refresh,
    repoLocation: useRepoLocation(settingsOpen, workspacePath),
    sourceControlStatus: useSourceControlHealth(settingsOpen, workspacePath),
  };
};

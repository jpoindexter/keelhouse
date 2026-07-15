import { formatCliToolStatus } from "./sourceControl";
import { buildIssuesUrl, buildPipelinesUrl, buildPullRequestsUrl, buildRepoUrl, isGitLabLocation } from "./sourceControlLinks";
import type { SettingsRowDef } from "./settingsModalData";
import type { SettingsModalProps } from "./settingsModalTypes";

function RemoteLinks({ props }: { props: SettingsModalProps }) {
  const location = props.repoLocation;
  if (!location) return <span className="settings-modal__value">No remote detected</span>;
  const open = (url: string) => props.onOpenSourceControlLink?.(url);
  return <span className="settings-modal__value">
    <button type="button" className="settings-modal__action" onClick={() => open(buildRepoUrl(location))}>Repo</button>
    <button type="button" className="settings-modal__action" onClick={() => open(buildPullRequestsUrl(location))}>{isGitLabLocation(location) ? "Merge requests" : "Pull requests"}</button>
    <button type="button" className="settings-modal__action" onClick={() => open(buildIssuesUrl(location))}>Issues</button>
    <button type="button" className="settings-modal__action" onClick={() => open(buildPipelinesUrl(location))}>{isGitLabLocation(location) ? "Pipelines" : "Actions"}</button>
  </span>;
}

export function SettingsSourceControl({ row, props }: { row: SettingsRowDef; props: SettingsModalProps }) {
  if (row.id === "git.health") return <span className="settings-modal__value">{props.gitBranch ? `⎇ ${props.gitBranch}${props.gitChangeCount != null ? ` · ${props.gitChangeCount} change${props.gitChangeCount === 1 ? "" : "s"}` : ""}` : "No repository detected"}</span>;
  if (row.id === "git.source-control") return <span className="settings-modal__value">{props.sourceControlStatus ? `git: ${formatCliToolStatus(props.sourceControlStatus.git)} · gh: ${formatCliToolStatus(props.sourceControlStatus.gh)} · glab: ${formatCliToolStatus(props.sourceControlStatus.glab)}` : "Detecting…"}</span>;
  if (row.id === "git.remote-links") return <RemoteLinks props={props} />;
  return null;
}

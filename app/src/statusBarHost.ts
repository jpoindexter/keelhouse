import { formatCliToolStatus, type SourceControlStatus } from "./sourceControl";
import {
  buildRepoUrl,
  sourceRepoStatusLabel,
  type RepoLocation,
} from "./sourceControlLinks";

export const statusBarRepoPropsFrom = (
  repoLocation: RepoLocation | null,
  openExternal: (url: string) => Promise<unknown>,
) => ({
  onOpenRepo: () => {
    if (repoLocation) void openExternal(buildRepoUrl(repoLocation)).catch(() => {});
  },
  repoLabel: repoLocation ? sourceRepoStatusLabel(repoLocation) : null,
});

export const sourceRepoStatusTitleFrom = (
  repoLocation: RepoLocation | null,
  status: SourceControlStatus | null | undefined,
): string => {
  if (!repoLocation) return "";
  const toolStatus = repoLocation.kind === "github" ? status?.gh : status?.glab;
  const toolLabel = toolStatus ? formatCliToolStatus(toolStatus) : "Checking authentication";
  return `${sourceRepoStatusLabel(repoLocation)} · ${toolLabel}`;
};

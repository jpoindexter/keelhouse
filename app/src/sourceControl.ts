export type CliToolStatus = {
  installed: boolean;
  authenticated: boolean | null;
  account: string | null;
};

export type SourceControlStatus = {
  git: CliToolStatus;
  gh: CliToolStatus;
  glab: CliToolStatus;
};

export const formatCliToolStatus = (status: CliToolStatus): string => {
  if (!status.installed) return "Not installed";
  if (status.authenticated == null) return "Installed";
  if (!status.authenticated) return "Not authenticated";
  return status.account ? `Authenticated as ${status.account}` : "Authenticated";
};

const isCliToolStatus = (value: unknown): value is CliToolStatus => {
  if (typeof value !== "object" || value == null) return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t.installed === "boolean" &&
    (t.authenticated === null || typeof t.authenticated === "boolean") &&
    (t.account === null || typeof t.account === "string")
  );
};

export const normalizeSourceControlStatus = (value: unknown): SourceControlStatus | null => {
  if (typeof value !== "object" || value == null) return null;
  const t = value as Record<string, unknown>;
  if (!isCliToolStatus(t.git) || !isCliToolStatus(t.gh) || !isCliToolStatus(t.glab)) return null;
  return { git: t.git, gh: t.gh, glab: t.glab };
};

export type LaunchProfile = {
  id: string;
  label: string;
  command: string;
  args: string[];
  useLoginShell: boolean;
};

export const DEFAULT_LAUNCH_PROFILE_ID = "codex";
export const DEFAULT_TERMINAL_LAUNCH_PROFILE_ID = "shell";

export const LAUNCH_PROFILES: LaunchProfile[] = [
  {
    id: "codex",
    label: "Codex",
    command: "codex",
    args: [],
    useLoginShell: true,
  },
  {
    id: "gemini",
    label: "Gemini",
    command: "gemini",
    args: [],
    useLoginShell: true,
  },
  {
    id: "claude",
    label: "Claude",
    command: "claude",
    args: [],
    useLoginShell: true,
  },
  {
    id: "shell",
    label: "Shell",
    command: "/bin/zsh",
    args: ["-l"],
    useLoginShell: false,
  },
];

const profileById = new Map(LAUNCH_PROFILES.map((profile) => [profile.id, profile]));

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value != null;

const normalizeArgs = (value: unknown) =>
  Array.isArray(value) ? value.filter((arg): arg is string => typeof arg === "string") : [];

const withKnownLabel = (profile: LaunchProfile): LaunchProfile => ({
  ...profile,
  label: profileById.get(profile.id)?.label ?? profile.label,
});

export const defaultLaunchProfile = () => LAUNCH_PROFILES[0];

export const defaultTerminalLaunchProfile = () =>
  profileById.get(DEFAULT_TERMINAL_LAUNCH_PROFILE_ID) ?? LAUNCH_PROFILES[LAUNCH_PROFILES.length - 1];

export const normalizeLaunchProfile = (value: unknown): LaunchProfile => {
  if (!isRecord(value)) return defaultLaunchProfile();
  const id = typeof value.id === "string" && value.id.trim() ? value.id : "";
  const known = profileById.get(id);
  if (known) return known;
  if (typeof value.command !== "string" || !value.command.trim()) return defaultLaunchProfile();
  return {
    id: id || value.command,
    label: typeof value.label === "string" && value.label.trim() ? value.label : value.command,
    command: value.command.trim(),
    args: normalizeArgs(value.args),
    useLoginShell: typeof value.useLoginShell === "boolean" ? value.useLoginShell : true,
  };
};

export const normalizeTerminalLaunchProfile = (value: unknown): LaunchProfile => {
  if (!isRecord(value)) return defaultTerminalLaunchProfile();
  const id = typeof value.id === "string" && value.id.trim() ? value.id : "";
  const known = profileById.get(id);
  if (known) return known;
  if (typeof value.command !== "string" || !value.command.trim()) return defaultTerminalLaunchProfile();
  return {
    id: id || value.command,
    label: typeof value.label === "string" && value.label.trim() ? value.label : value.command,
    command: value.command.trim(),
    args: normalizeArgs(value.args),
    useLoginShell: typeof value.useLoginShell === "boolean" ? value.useLoginShell : true,
  };
};

export const launchProfileById = (id: string) => profileById.get(id) ?? defaultLaunchProfile();

export const launchProfileCommandLine = (profile: LaunchProfile) => {
  const suffix = profile.args.length > 0 ? ` ${profile.args.join(" ")}` : "";
  return `${profile.command}${suffix}`;
};

export const launchProfileMode = (profile: LaunchProfile) =>
  profile.useLoginShell ? "login shell" : "direct";

export const launchProfileSummary = (profile: LaunchProfile) => {
  const normalized = withKnownLabel(profile);
  return `${normalized.label}: ${launchProfileCommandLine(normalized)} (${launchProfileMode(normalized)})`;
};

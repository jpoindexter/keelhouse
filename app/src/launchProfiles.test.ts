import { describe, expect, it } from "vitest";
import {
  LAUNCH_PROFILES,
  defaultTerminalLaunchProfile,
  launchProfileById,
  launchProfileCommandLine,
  launchProfileSummary,
  normalizeLaunchProfile,
  normalizeTerminalLaunchProfile,
} from "./launchProfiles";

describe("launch profiles", () => {
  it("defines Codex, Gemini, Claude, and shell profiles", () => {
    expect(LAUNCH_PROFILES.map((profile) => profile.id)).toEqual(["codex", "gemini", "claude", "shell"]);
    expect(launchProfileById("codex").command).toBe("codex");
    expect(launchProfileById("gemini").command).toBe("gemini");
    expect(launchProfileById("claude").command).toBe("claude");
    expect(launchProfileById("shell")).toMatchObject({ command: "/bin/zsh", args: ["-l"], useLoginShell: false });
  });

  it("normalizes known stored profile ids back to the built-in profile", () => {
    expect(normalizeLaunchProfile({ id: "codex", command: "stale-codex", args: ["bad"] })).toEqual(
      launchProfileById("codex"),
    );
  });

  it("falls back to Codex for missing or empty profile data", () => {
    expect(normalizeLaunchProfile(null)).toEqual(launchProfileById("codex"));
    expect(normalizeLaunchProfile({ id: "broken", command: "" })).toEqual(launchProfileById("codex"));
  });

  it("keeps the raw terminal blank by default", () => {
    expect(defaultTerminalLaunchProfile()).toEqual(launchProfileById("shell"));
    expect(normalizeTerminalLaunchProfile(null)).toEqual(launchProfileById("shell"));
    expect(normalizeTerminalLaunchProfile({ id: "broken", command: "" })).toEqual(launchProfileById("shell"));
  });

  it("preserves an explicitly selected terminal agent profile", () => {
    expect(normalizeTerminalLaunchProfile({ id: "gemini" })).toEqual(launchProfileById("gemini"));
  });

  it("keeps custom stored profiles valid for future settings", () => {
    expect(
      normalizeLaunchProfile({
        id: "custom",
        label: "Custom Agent",
        command: "custom-agent",
        args: ["--fast"],
        useLoginShell: false,
      }),
    ).toEqual({
      id: "custom",
      label: "Custom Agent",
      command: "custom-agent",
      args: ["--fast"],
      useLoginShell: false,
    });
  });

  it("formats visible command details", () => {
    expect(launchProfileCommandLine(launchProfileById("shell"))).toBe("/bin/zsh -l");
    expect(launchProfileSummary(launchProfileById("codex"))).toBe("Codex: codex (login shell)");
    expect(launchProfileSummary(launchProfileById("gemini"))).toBe("Gemini: gemini (login shell)");
  });
});

import { describe, expect, it } from "vitest";

import { formatCliToolStatus, normalizeSourceControlStatus, type CliToolStatus } from "./sourceControl";

const status = (overrides: Partial<CliToolStatus> = {}): CliToolStatus => ({
  installed: true,
  authenticated: true,
  account: "jpoindexter",
  ...overrides,
});

describe("formatCliToolStatus", () => {
  it("reports not installed", () => {
    expect(formatCliToolStatus(status({ installed: false, authenticated: null, account: null }))).toBe("Not installed");
  });

  it("reports installed with no auth concept (git)", () => {
    expect(formatCliToolStatus(status({ authenticated: null, account: null }))).toBe("Installed");
  });

  it("reports not authenticated", () => {
    expect(formatCliToolStatus(status({ authenticated: false, account: null }))).toBe("Not authenticated");
  });

  it("reports authenticated with and without an account name", () => {
    expect(formatCliToolStatus(status())).toBe("Authenticated as jpoindexter");
    expect(formatCliToolStatus(status({ account: null }))).toBe("Authenticated");
  });
});

describe("normalizeSourceControlStatus", () => {
  it("accepts a well-formed response", () => {
    const value = { git: status({ authenticated: null, account: null }), gh: status(), glab: status({ installed: false, authenticated: null, account: null }) };
    expect(normalizeSourceControlStatus(value)).toEqual(value);
  });

  it("rejects malformed or missing shapes", () => {
    expect(normalizeSourceControlStatus(null)).toBeNull();
    expect(normalizeSourceControlStatus({})).toBeNull();
    expect(normalizeSourceControlStatus({ git: status(), gh: status() })).toBeNull();
    expect(normalizeSourceControlStatus({ git: status(), gh: status(), glab: "bad" })).toBeNull();
  });
});

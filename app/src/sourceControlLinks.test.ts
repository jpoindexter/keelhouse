import { describe, expect, it } from "vitest";

import {
  buildIssuesUrl,
  buildPipelinesUrl,
  buildPullRequestsUrl,
  buildRepoUrl,
  parseRemoteUrl,
} from "./sourceControlLinks";

describe("parseRemoteUrl", () => {
  it("parses HTTPS GitHub and GitLab remotes", () => {
    expect(parseRemoteUrl("https://github.com/jpoindexter/keelhouse.git")).toEqual({
      host: "github.com",
      owner: "jpoindexter",
      repo: "keelhouse",
      kind: "github",
    });
    expect(parseRemoteUrl("https://gitlab.com/team/proj")).toEqual({
      host: "gitlab.com",
      owner: "team",
      repo: "proj",
      kind: "gitlab",
    });
  });

  it("parses SSH remotes and self-hosted hosts", () => {
    expect(parseRemoteUrl("git@github.com:jpoindexter/keelhouse.git")).toEqual({
      host: "github.com",
      owner: "jpoindexter",
      repo: "keelhouse",
      kind: "github",
    });
    expect(parseRemoteUrl("git@git.internal.corp:team/proj.git")).toEqual({
      host: "git.internal.corp",
      owner: "team",
      repo: "proj",
      kind: "unknown",
    });
  });

  it("returns null for unparseable input", () => {
    expect(parseRemoteUrl("not a url")).toBeNull();
    expect(parseRemoteUrl("")).toBeNull();
    expect(parseRemoteUrl("https://github.com/onlyowner")).toBeNull();
  });
});

describe("link builders", () => {
  const github = { host: "github.com", owner: "jpoindexter", repo: "keelhouse", kind: "github" as const };
  const gitlab = { host: "gitlab.com", owner: "team", repo: "proj", kind: "gitlab" as const };
  const selfHosted = { host: "git.internal.corp", owner: "team", repo: "proj", kind: "unknown" as const };

  it("builds GitHub-style links", () => {
    expect(buildRepoUrl(github)).toBe("https://github.com/jpoindexter/keelhouse");
    expect(buildPullRequestsUrl(github)).toBe("https://github.com/jpoindexter/keelhouse/pulls");
    expect(buildIssuesUrl(github)).toBe("https://github.com/jpoindexter/keelhouse/issues");
    expect(buildPipelinesUrl(github)).toBe("https://github.com/jpoindexter/keelhouse/actions");
  });

  it("builds GitLab-style links", () => {
    expect(buildPullRequestsUrl(gitlab)).toBe("https://gitlab.com/team/proj/-/merge_requests");
    expect(buildPipelinesUrl(gitlab)).toBe("https://gitlab.com/team/proj/-/pipelines");
  });

  it("falls back to a bare repo URL shape for unrecognized hosts", () => {
    expect(buildRepoUrl(selfHosted)).toBe("https://git.internal.corp/team/proj");
    expect(buildIssuesUrl(selfHosted)).toBe("https://git.internal.corp/team/proj/issues");
  });
});

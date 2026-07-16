import { describe, expect, it, vi } from "vitest";
import { sourceRepoStatusTitleFrom, statusBarRepoPropsFrom } from "./statusBarHost";
import type { RepoLocation } from "./sourceControlLinks";

const repo: RepoLocation = { host: "github.com", kind: "github", owner: "jp", repo: "keelhouse" };

describe("statusBarRepoPropsFrom", () => {
  it("labels the repo and opens its canonical url", () => {
    const openExternal = vi.fn(async () => {});
    const props = statusBarRepoPropsFrom(repo, openExternal);

    expect(props.repoLabel).toContain("jp/keelhouse");

    props.onOpenRepo();
    expect(openExternal).toHaveBeenCalledWith(expect.stringContaining("github.com/jp/keelhouse"));
  });

  it("hides the repo affordance without a repository", () => {
    const openExternal = vi.fn(async () => {});
    const props = statusBarRepoPropsFrom(null, openExternal);

    expect(props.repoLabel).toBeNull();
    props.onOpenRepo();
    expect(openExternal).not.toHaveBeenCalled();
  });
});

describe("sourceRepoStatusTitleFrom", () => {
  it("combines the repo label with the host tool status", () => {
    const title = sourceRepoStatusTitleFrom(repo, {
      gh: { account: "jp", authenticated: true, installed: true },
      git: { account: null, authenticated: null, installed: true },
      glab: { account: null, authenticated: null, installed: false },
    });

    expect(title).toContain("jp/keelhouse");
  });

  it("reports pending authentication and hides without a repo", () => {
    expect(sourceRepoStatusTitleFrom(repo, undefined)).toContain("Checking authentication");
    expect(sourceRepoStatusTitleFrom(null, undefined)).toBe("");
  });
});

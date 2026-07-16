import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ComposerContextMetadata } from "./ComposerContextMetadata";

describe("ComposerContextMetadata", () => {
  it("shows repository, git, provider, and measured context beneath the composer", () => {
    const html = renderToStaticMarkup(<ComposerContextMetadata
      branch="main"
      changedFiles={3}
      provider="codex"
      repositoryPath="/Users/jason/Keelhouse"
      usage={{ inputTokens: 1200, cachedInputTokens: 400, outputTokens: 80 }}
    />);

    expect(html).toContain('aria-label="Composer context metadata"');
    expect(html).toContain("Keelhouse");
    expect(html).toContain("main");
    expect(html).toContain("3 changes");
    expect(html).toContain("Codex");
    expect(html).toContain("1.3k tokens");
  });

  it("uses honest empty-state labels when repository data is unavailable", () => {
    const html = renderToStaticMarkup(<ComposerContextMetadata
      branch={null}
      changedFiles={0}
      provider={null}
      repositoryPath={null}
      usage={undefined}
    />);

    expect(html).toContain("No repository");
    expect(html).toContain("No branch");
    expect(html).toContain("Provider unavailable");
    expect(html).toContain("Context unavailable");
  });
});

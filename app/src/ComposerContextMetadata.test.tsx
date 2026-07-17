// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ComposerContextMetadata } from "./ComposerContextMetadata";

describe("ComposerContextMetadata", () => {
  it("shows repository, git, provider, and measured context beneath the composer", () => {
    const { container } = render(<ComposerContextMetadata
      branch="main"
      changedFiles={3}
      provider="codex"
      repositoryPath="/Users/jason/Keelhouse"
      usage={{ inputTokens: 1200, cachedInputTokens: 400, outputTokens: 80 }}
      onProjectSelect={vi.fn()}
    />);
    const html = container.innerHTML;

    expect(html).toContain('aria-label="Composer context metadata"');
    expect(html).toContain("Keelhouse");
    expect(html).toContain("main");
    expect(html).toContain("3 changes");
    expect(html).toContain("Codex");
    expect(html).toContain("1.3k tokens");
  });

  it("uses honest empty-state labels when repository data is unavailable", () => {
    const { container } = render(<ComposerContextMetadata
      branch={null}
      changedFiles={0}
      provider={null}
      repositoryPath={null}
      usage={undefined}
      onProjectSelect={vi.fn()}
    />);
    const html = container.innerHTML;

    expect(html).toContain("No repository");
    expect(html).toContain("No branch");
    expect(html).toContain("Provider unavailable");
    expect(html).toContain("Context unavailable");
  });

  it("opens the shared project chooser from the project control", () => {
    const onProjectSelect = vi.fn();
    const { getByRole } = render(<ComposerContextMetadata branch="main" changedFiles={0} provider="codex" repositoryPath="/repo" usage={undefined} onProjectSelect={onProjectSelect} />);

    fireEvent.click(getByRole("button", { name: "Switch project, repo" }));

    expect(onProjectSelect).toHaveBeenCalledOnce();
  });
});

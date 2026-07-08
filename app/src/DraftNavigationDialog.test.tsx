import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DraftNavigationDialog } from "./DraftNavigationDialog";
import { DRAFT_NAVIGATION_BODY, DRAFT_SAVE_FAILURE_MESSAGE } from "./draftProtection";

describe("DraftNavigationDialog", () => {
  it("names the dirty file, consequence, and available recovery actions", () => {
    const html = renderToStaticMarkup(
      <DraftNavigationDialog
        fileName="App.tsx"
        error={null}
        saving={false}
        onCancel={vi.fn()}
        onDiscard={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain("Save changes to App.tsx?");
    expect(html).toContain(DRAFT_NAVIGATION_BODY);
    expect(html).toContain("Cancel");
    expect(html).toContain("Discard");
    expect(html).toContain("Save");
  });

  it("shows save failure without hiding the recovery actions", () => {
    const html = renderToStaticMarkup(
      <DraftNavigationDialog
        fileName="App.tsx"
        error={DRAFT_SAVE_FAILURE_MESSAGE}
        saving={false}
        onCancel={vi.fn()}
        onDiscard={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(html).toContain(DRAFT_SAVE_FAILURE_MESSAGE);
    expect(html).toContain("Cancel");
    expect(html).toContain("Discard");
    expect(html).toContain("Save");
  });

  it("disables save while the real write is already running", () => {
    const html = renderToStaticMarkup(
      <DraftNavigationDialog
        fileName="App.tsx"
        error={null}
        saving={true}
        onCancel={vi.fn()}
        onDiscard={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(html).toContain("Saving");
    expect(html).toContain("disabled");
  });
});

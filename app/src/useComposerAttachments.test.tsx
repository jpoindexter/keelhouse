// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { resolveAppAction } from "./appActions";
import { defaultComposerHarnessState, type ComposerHarnessState } from "./composerHarness";
import { useComposerAttachments, type ComposerAttachmentServices } from "./useComposerAttachments";

const setup = (denyAction = false) => {
  let dropHandler: ((paths: string[]) => void) | null = null;
  const removeDropListener = vi.fn();
  const services: ComposerAttachmentServices = {
    cacheImage: vi.fn().mockResolvedValue({ bytes: 8, mimeType: "image/png", path: "/cache/drop.png" }),
    inspectImage: vi.fn(),
    pickFiles: vi.fn().mockResolvedValue([]),
    readClipboardImage: vi.fn(),
    readContextFile: vi.fn().mockResolvedValue({ bytes: 4, content: "test", path: "src/App.tsx" }),
    saveClipboardImage: vi.fn(),
    subscribeDrops: vi.fn(async (handler) => {
      dropHandler = handler;
      return removeDropListener;
    }),
  };
  let harness = defaultComposerHarnessState();
  const updateHarness = vi.fn(async (updater: (state: ComposerHarnessState) => ComposerHarnessState) => {
    harness = updater(harness);
    return harness;
  });
  const logEvent = vi.fn();
  const hook = renderHook(() => useComposerAttachments({
    active: true,
    activeHarness: harness,
    activeKey: "chat-1",
    draft: "Explain this",
    gateAction: async (action) => {
      const audit = await resolveAppAction(action, "fullAccess");
      return denyAction ? { ...audit, decision: "denied" as const } : audit;
    },
    getBrowserUrl: () => "http://localhost:5173",
    getRoot: () => "/workspace",
    logEvent,
    services,
    setError: vi.fn(),
    setNotice: vi.fn(),
    updateHarness,
  }));
  return { ...hook, getDropHandler: () => dropHandler, harness: () => harness, logEvent, removeDropListener, services, updateHarness };
};

describe("useComposerAttachments", () => {
  it("validates and stores an approved workspace file attachment", async () => {
    const subject = setup();
    await act(() => subject.result.current.attachWorkspaceFile({ name: "App.tsx", path: "src/App.tsx" }));

    expect(subject.services.readContextFile).toHaveBeenCalledWith("/workspace", "src/App.tsx");
    expect(subject.harness().attachments[0]).toMatchObject({ kind: "file", label: "App.tsx", target: "src/App.tsx" });
    expect(subject.logEvent).toHaveBeenCalledWith("Attachment added", "App.tsx");
  });

  it("does not store an attachment denied by the action gate", async () => {
    const subject = setup(true);
    await act(() => subject.result.current.attachPreview());

    expect(subject.updateHarness).not.toHaveBeenCalled();
    expect(subject.logEvent).not.toHaveBeenCalled();
  });

  it("caches dropped images while active and removes the listener on cleanup", async () => {
    const subject = setup();
    await act(async () => subject.getDropHandler()?.(["/tmp/drop.png", "/tmp/notes.txt"]));

    expect(subject.services.cacheImage).toHaveBeenCalledWith("/tmp/drop.png");
    expect(subject.harness().attachments[0]).toMatchObject({ kind: "image", target: "/cache/drop.png" });
    subject.unmount();
    expect(subject.removeDropListener).toHaveBeenCalledOnce();
  });
});

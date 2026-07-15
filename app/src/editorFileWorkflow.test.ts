import { describe, expect, it, vi } from "vitest";

import { resolveAppAction } from "./appActions";
import type { EditorFileBuffer, EditorFileLoadState } from "./editorFileLoadState";
import type { FileTreeNode } from "./fileTreeTypes";
import { createEditorFileWorkflow, type EditorFileWorkflowServices } from "./editorFileWorkflow";

const file: FileTreeNode = { id: "/workspace/App.tsx", kind: "file", name: "App.tsx", path: "/workspace/App.tsx" };
const buffer: EditorFileBuffer = {
  bytes: 4, error: null, modifiedMs: 1, recoveryError: null, savedText: "test", text: "test",
};

const setup = (cached = false, deny = false, activePath: string | null = null) => {
  const buffers = { current: cached ? { [file.path]: buffer } : {} as Record<string, EditorFileBuffer> };
  const services: EditorFileWorkflowServices = {
    readFile: vi.fn().mockResolvedValue({ bytes: 4, content: "test", modifiedMs: 1, path: file.path }),
    requestFrame: (callback) => callback(),
    writeFile: vi.fn().mockResolvedValue({ bytes: 7, content: "updated", modifiedMs: 2, path: file.path }),
  };
  const applyState = vi.fn<(state: EditorFileLoadState) => void>();
  const beginOpen = vi.fn();
  const persistActiveFile = vi.fn().mockResolvedValue(undefined);
  const focusEditor = vi.fn();
  const onCurrentFile = vi.fn();
  const workflow = createEditorFileWorkflow({
    applyState,
    beginOpen,
    buffers,
    bumpBufferRevision: vi.fn(),
    focusEditor,
    gateAction: async (action) => {
      const audit = await resolveAppAction(action, "fullAccess");
      return deny ? { ...audit, decision: "denied" as const } : audit;
    },
    getActiveFilePath: () => activePath,
    getRoot: () => "/workspace",
    getSaveState: () => ({
      bytes: 4, dirty: true, file, modifiedMs: 1, recoveryError: null,
      root: "/workspace", savedText: "test", saving: false, text: "updated",
    }),
    loadSequence: { current: 0 },
    onCurrentFile,
    onSaveError: vi.fn(),
    onSaveSuccess: vi.fn(),
    persistActiveFile,
    prepareSave: vi.fn(),
    prepareRead: vi.fn(),
    recordEdit: vi.fn(),
    services,
    setLoading: vi.fn(),
    setSaving: vi.fn(),
    viewStates: { current: {} },
  });
  return { applyState, beginOpen, buffers, focusEditor, onCurrentFile, persistActiveFile, services, workflow };
};

describe("createEditorFileWorkflow", () => {
  it("opens a cached buffer without reading from disk", async () => {
    const subject = setup(true);
    await subject.workflow.openDirect(file, { focusEditor: true });

    expect(subject.services.readFile).not.toHaveBeenCalled();
    expect(subject.applyState).toHaveBeenCalledWith(expect.objectContaining({ text: "test" }));
    expect(subject.persistActiveFile).toHaveBeenCalledWith("/workspace", file.path);
    expect(subject.focusEditor).toHaveBeenCalledOnce();
  });

  it("loads and stores a file that is not buffered", async () => {
    const subject = setup();
    await subject.workflow.openDirect(file);

    expect(subject.services.readFile).toHaveBeenCalledWith("/workspace", file.path);
    expect(subject.buffers.current[file.path]).toMatchObject({ text: "test", savedText: "test" });
    expect(subject.applyState).toHaveBeenCalledWith(expect.objectContaining({ bytes: 4 }));
  });

  it("does not open a file denied by the action gate", async () => {
    const subject = setup(false, true);
    const opened = await subject.workflow.requestOpen(file, {}, "agent");

    expect(opened).toBe(false);
    expect(subject.beginOpen).not.toHaveBeenCalled();
    expect(subject.services.readFile).not.toHaveBeenCalled();
  });

  it("focuses the already active file without reopening it", async () => {
    const subject = setup(false, false, file.path);
    const opened = await subject.workflow.requestOpen(file, { focusEditor: true });

    expect(opened).toBe(true);
    expect(subject.onCurrentFile).toHaveBeenCalledWith(true);
    expect(subject.beginOpen).not.toHaveBeenCalled();
  });

  it("saves the current editor text with optimistic concurrency", async () => {
    const subject = setup();
    const saved = await subject.workflow.save();

    expect(saved).toBe(true);
    expect(subject.services.writeFile).toHaveBeenCalledWith(
      "/workspace", file.path, "updated", 1,
    );
    expect(subject.buffers.current[file.path]).toMatchObject({ text: "updated", savedText: "updated" });
  });

  it("preserves the draft and reports a failed save", async () => {
    const subject = setup();
    vi.mocked(subject.services.writeFile).mockRejectedValueOnce(new Error("modified on disk"));
    const saved = await subject.workflow.save();

    expect(saved).toBe(false);
    expect(subject.buffers.current[file.path]).toMatchObject({ text: "updated", savedText: "test" });
  });
});

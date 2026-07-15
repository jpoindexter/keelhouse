import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { readImage } from "@tauri-apps/plugin-clipboard-manager";
import { open } from "@tauri-apps/plugin-dialog";
import { useEffect, useRef } from "react";

import { createAppAction, type AppActionAuditEvent, type AppActionDescriptor } from "./appActions";
import { prepareChatContext, type ChatContextFile, type ChatContextImage } from "./chatContext";
import {
  createComposerAttachment,
  removeComposerAttachment,
  upsertComposerAttachment,
  type ComposerAttachment,
  type ComposerHarnessState,
} from "./composerHarness";

type ClipboardImage = { height: number; rgba: number[]; width: number };
type ComposerFile = { name: string; path: string };
type ComposerStateSetter = (value: string | null) => void;
type HarnessUpdater = (updater: (state: ComposerHarnessState) => ComposerHarnessState) => Promise<ComposerHarnessState | null>;

export type ComposerAttachmentServices = {
  cacheImage: (path: string) => Promise<ChatContextImage>;
  inspectImage: (path: string) => Promise<ChatContextImage>;
  pickFiles: () => Promise<string[]>;
  readClipboardImage: () => Promise<ClipboardImage>;
  readContextFile: (root: string | null, path: string) => Promise<ChatContextFile>;
  saveClipboardImage: (image: ClipboardImage) => Promise<ChatContextImage>;
  subscribeDrops: (handler: (paths: string[]) => Promise<void>) => Promise<() => void>;
};

type ComposerAttachmentOptions = {
  active: boolean;
  activeHarness: ComposerHarnessState;
  activeKey: string | null;
  draft: string;
  gateAction: (action: AppActionDescriptor) => Promise<AppActionAuditEvent>;
  getBrowserUrl: () => string;
  getRoot: () => string | null;
  logEvent: (label: string, detail: string) => void;
  services?: ComposerAttachmentServices;
  setError: ComposerStateSetter;
  setNotice: ComposerStateSetter;
  updateHarness: HarnessUpdater;
};

type AttachmentContext = ComposerAttachmentOptions & { services: ComposerAttachmentServices };

const basename = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() ?? path;
const isImagePath = (path: string) => /\.(png|jpe?g|webp|gif)$/i.test(path);

const nativeServices: ComposerAttachmentServices = {
  cacheImage: (path) => invoke<ChatContextImage>("cache_chat_image", { path }),
  inspectImage: (path) => invoke<ChatContextImage>("inspect_chat_image", { path }),
  pickFiles: async () => {
    const picked = await open({ multiple: true });
    return Array.isArray(picked) ? picked : typeof picked === "string" ? [picked] : [];
  },
  readClipboardImage: async () => {
    const image = await readImage();
    const [{ width, height }, rgba] = await Promise.all([image.size(), image.rgba()]);
    return { height, rgba: Array.from(rgba), width };
  },
  readContextFile: (root, path) => invoke<ChatContextFile>("read_chat_context_file", { root, path }),
  saveClipboardImage: (image) => invoke<ChatContextImage>("save_chat_clipboard_image", image),
  subscribeDrops: async (handler) => getCurrentWebview().onDragDropEvent((event) => {
    if (event.payload.type === "drop") void handler(event.payload.paths);
  }),
};

const addAttachment = async (context: AttachmentContext, attachment: ComposerAttachment) => {
  const audit = await context.gateAction(createAppAction({
    kind: "attach-reference", label: "Attach reference", target: attachment.target,
    risk: "low", requestedBy: "user", undoHint: "Remove the attachment chip.",
  }));
  if (audit.decision !== "approved") return;
  await context.updateHarness((state) => ({
    ...state, attachments: upsertComposerAttachment(state.attachments, attachment),
  }));
  context.logEvent("Attachment added", attachment.label);
};

const attachImagePath = async (context: AttachmentContext, path: string) => {
  try {
    const image = await context.services.cacheImage(path);
    await addAttachment(context, createComposerAttachment({
      kind: "image", label: basename(image.path), target: image.path,
    }));
    context.setError(null);
  } catch (error) {
    context.setError(String(error));
  }
};

const attachWorkspaceFile = async (context: AttachmentContext, file: ComposerFile | null) => {
  if (!file) {
    context.setError("Open a file before attaching the current file.");
    return;
  }
  try {
    await context.services.readContextFile(context.getRoot(), file.path);
    await addAttachment(context, createComposerAttachment({
      kind: "file", label: file.name, target: file.path,
    }));
  } catch (error) {
    context.setError(String(error));
  }
};

const attachLocalFiles = async (context: AttachmentContext) => {
  const paths = await context.services.pickFiles();
  for (const path of paths.slice(0, 6)) {
    try {
      if (isImagePath(path)) await attachImagePath(context, path);
      else {
        await context.services.readContextFile(context.getRoot(), path);
        await addAttachment(context, createComposerAttachment({
          kind: "file", label: basename(path), target: path,
        }));
      }
    } catch (error) {
      context.setError(String(error));
    }
  }
};

const pasteImage = async (context: AttachmentContext) => {
  try {
    const clipboard = await context.services.readClipboardImage();
    const saved = await context.services.saveClipboardImage(clipboard);
    await addAttachment(context, createComposerAttachment({
      kind: "image", label: basename(saved.path), target: saved.path,
    }));
    context.setError(null);
  } catch (error) {
    context.setError(`Could not attach clipboard image: ${String(error)}`);
  }
};

const reviewContext = async (context: AttachmentContext) => {
  try {
    const prepared = await prepareChatContext(context.draft || "[No draft text]", context.activeHarness, {
      readFile: (attachment) => context.services.readContextFile(context.getRoot(), attachment.target),
      inspectImage: (attachment) => context.services.inspectImage(attachment.target),
    });
    context.setNotice(prepared.preview);
    context.setError(null);
  } catch (error) {
    context.setError(String(error));
  }
};

const removeAttachment = async (context: AttachmentContext, attachment: ComposerAttachment) => {
  await context.updateHarness((state) => ({
    ...state, attachments: removeComposerAttachment(state.attachments, attachment.id),
  }));
  context.logEvent("Attachment removed", attachment.label);
};

export function useComposerAttachments(options: ComposerAttachmentOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const context = (): AttachmentContext => ({
    ...optionsRef.current, services: optionsRef.current.services ?? nativeServices,
  });
  useEffect(() => {
    if (!options.active) return;
    let disposed = false;
    let remove: (() => void) | null = null;
    void context().services.subscribeDrops(async (paths) => {
      if (disposed) return;
      for (const path of paths.slice(0, 6)) {
        if (isImagePath(path)) await attachImagePath(context(), path);
      }
    }).then((unlisten) => { if (disposed) unlisten(); else remove = unlisten; });
    return () => { disposed = true; remove?.(); };
  }, [options.active, options.activeKey]);
  return {
    attachLocalFiles: () => attachLocalFiles(context()),
    attachPreview: () => addAttachment(context(), createComposerAttachment({
      kind: "screenshot", label: "Browser preview", target: context().getBrowserUrl(),
    })),
    attachWorkspaceFile: (file: ComposerFile | null) => attachWorkspaceFile(context(), file),
    pasteImage: () => pasteImage(context()),
    removeAttachment: (attachment: ComposerAttachment) => removeAttachment(context(), attachment),
    reviewContext: () => reviewContext(context()),
  };
}

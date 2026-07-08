export type DraftNavigationTarget =
  | { kind: "file"; path: string }
  | { kind: "workspace"; path: string };

export const DRAFT_NAVIGATION_BODY = "Switching now would replace the unsaved editor buffer for this file.";
export const DRAFT_SAVE_FAILURE_MESSAGE = "Save failed. The draft is still open; fix the save error before switching.";

export const shouldPromptForDirtyDraft = (
  editorDirty: boolean,
  currentFilePath: string | null,
  target: DraftNavigationTarget,
) => {
  if (!editorDirty) return false;
  return target.kind !== "file" || target.path !== currentFilePath;
};

export type DraftNavigationHandlers<TNavigation> = {
  pendingNavigation: TNavigation | null;
  saveEditorFile: () => Promise<boolean>;
  continuePendingNavigation: (navigation: TNavigation) => Promise<void>;
  setPendingNavigation: (navigation: TNavigation | null) => void;
  setDraftDialogError: (message: string | null) => void;
};

export const saveDraftAndContinueNavigation = async <TNavigation>({
  pendingNavigation,
  saveEditorFile,
  continuePendingNavigation,
  setPendingNavigation,
  setDraftDialogError,
}: DraftNavigationHandlers<TNavigation>) => {
  if (!pendingNavigation) return false;
  setDraftDialogError(null);
  const ok = await saveEditorFile();
  if (!ok) {
    setDraftDialogError(DRAFT_SAVE_FAILURE_MESSAGE);
    return false;
  }
  setPendingNavigation(null);
  await continuePendingNavigation(pendingNavigation);
  return true;
};

export const discardDraftAndContinueNavigation = async <TNavigation>({
  pendingNavigation,
  continuePendingNavigation,
  setPendingNavigation,
  setDraftDialogError,
}: Omit<DraftNavigationHandlers<TNavigation>, "saveEditorFile">) => {
  if (!pendingNavigation) return false;
  setPendingNavigation(null);
  setDraftDialogError(null);
  await continuePendingNavigation(pendingNavigation);
  return true;
};

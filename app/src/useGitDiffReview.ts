import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { useState, type Dispatch, type SetStateAction } from "react";

import { createAppAction, type AppActionAuditEvent, type AppActionDescriptor } from "./appActions";
import { parseUnifiedDiff, type ParsedDiff } from "./diffView";
import { absolutePathForGitFile, type GitStatusFile } from "./fileGitStatus";
import type { GitStatusResponse } from "./useGitStatus";

export type GitDiffResponse = { path: string; diff: string; source: string };
export type GitFileAction = "stage" | "unstage" | "discard";
export type ActiveDiffReview = {
  file: GitStatusFile;
  absolutePath: string;
  response: GitDiffResponse;
  parsed: ParsedDiff;
};
export type GitDiffReviewServices = {
  copyText: (text: string) => Promise<void>;
  readDiff: (root: string, path: string) => Promise<GitDiffResponse>;
  runFileAction: (root: string, path: string, action: GitFileAction) => Promise<GitStatusResponse>;
};
type GitDiffReviewOptions = {
  gateAction: (action: AppActionDescriptor) => Promise<AppActionAuditEvent>;
  getRoot: () => string | null;
  hasUnsaved: (absolutePath: string) => boolean;
  onRefreshFiles: () => void;
  onStatus: (status: GitStatusResponse, root: string) => void;
  services?: GitDiffReviewServices;
};
type ReviewState = {
  review: ActiveDiffReview | null;
  setError: Dispatch<SetStateAction<string | null>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setReview: Dispatch<SetStateAction<ActiveDiffReview | null>>;
};
type ReviewContext = GitDiffReviewOptions & ReviewState & { services: GitDiffReviewServices };

const nativeServices: GitDiffReviewServices = {
  copyText: (text) => writeText(text),
  readDiff: (root, path) => invoke<GitDiffResponse>("git_file_diff", { root, path }),
  runFileAction: (root, path, action) => invoke<GitStatusResponse>("git_file_action", { root, path, action }),
};
const actionLabel = (action: GitFileAction) => action === "stage"
  ? "Stage file" : action === "unstage" ? "Unstage file" : "Discard unstaged changes";
const actionKind = (action: GitFileAction) => action === "stage"
  ? "stage-file" as const : action === "unstage" ? "unstage-file" as const : "discard-file" as const;
const closeReview = (context: ReviewContext) => {
  context.setReview(null);
  context.setError(null);
};

const loadDiff = async (context: ReviewContext, file: GitStatusFile, gate = true) => {
  const root = context.getRoot();
  if (!root) return false;
  if (gate) {
    const audit = await context.gateAction(createAppAction({
      kind: "open-diff", label: "Open diff", target: file.path, risk: "low", requestedBy: "user",
    }));
    if (audit.decision !== "approved") return false;
  }
  context.setLoading(true);
  context.setError(null);
  context.setReview(null);
  try {
    const response = await context.services.readDiff(root, file.path);
    context.setReview({
      absolutePath: absolutePathForGitFile(root, file.path), file,
      parsed: parseUnifiedDiff(response.diff), response,
    });
    return true;
  } catch (error) {
    context.setError(String(error));
    return false;
  } finally {
    context.setLoading(false);
  }
};

const runAction = async (context: ReviewContext, action: GitFileAction, file: GitStatusFile) => {
  const root = context.getRoot();
  if (!root) return false;
  if (action === "discard" && context.hasUnsaved(absolutePathForGitFile(root, file.path))) {
    context.setError("Save or close the unsaved editor draft before discarding Git changes.");
    return false;
  }
  const audit = await context.gateAction(createAppAction({
    kind: actionKind(action), label: actionLabel(action), target: file.path,
    risk: action === "discard" ? "destructive" : "medium", requestedBy: "user",
    undoHint: action === "discard" ? "Use Git history or editor undo if available." : "Use the opposite Git action.",
  }));
  if (audit.decision !== "approved") return false;
  context.setLoading(true);
  context.setError(null);
  try {
    const status = await context.services.runFileAction(root, file.path, action);
    context.onStatus(status, root);
    context.onRefreshFiles();
    const nextFile = status.files.find((item) => item.path === file.path);
    if (nextFile) await loadDiff(context, nextFile, false);
    else closeReview(context);
    return true;
  } catch (error) {
    context.setError(String(error));
    return false;
  } finally {
    context.setLoading(false);
  }
};

const copyReview = async (context: ReviewContext) => {
  if (!context.review) return false;
  const audit = await context.gateAction(createAppAction({
    kind: "copy-diff", label: "Copy shown diff", target: context.review.response.path,
    risk: "low", requestedBy: "user",
  }));
  if (audit.decision !== "approved") return false;
  await context.services.copyText(context.review.response.diff);
  return true;
};

export function useGitDiffReview(options: GitDiffReviewOptions) {
  const [review, setReview] = useState<ActiveDiffReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const context: ReviewContext = {
    ...options, review, services: options.services ?? nativeServices, setError, setLoading, setReview,
  };
  return {
    close: () => closeReview(context), copy: () => copyReview(context), error, loading,
    open: (file: GitStatusFile) => loadDiff(context, file), review,
    runFileAction: (action: GitFileAction, file: GitStatusFile) => runAction(context, action, file),
  };
}

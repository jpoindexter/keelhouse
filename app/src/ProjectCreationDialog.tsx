import { useEffect, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";

import "./ProjectCreationDialog.css";

type CreatedProject = { path: string };

export type ProjectCreationDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreateProject: (parent: string, name: string) => Promise<CreatedProject>;
  onInitializeGit: (path: string) => Promise<unknown>;
  onOpenProject: (path: string) => Promise<unknown>;
  onPickParent: () => Promise<string | null>;
};

type Phase = "idle" | "creating" | "initializing" | "opening";
type DialogState = {
  createdPath: string | null;
  error: string | null;
  gitFailed: boolean;
  initializeGit: boolean;
  name: string;
  parent: string;
  phase: Phase;
};
type SetDialogState = Dispatch<SetStateAction<DialogState>>;

const initialState = (): DialogState => ({
  createdPath: null, error: null, gitFailed: false, initializeGit: true,
  name: "", parent: "", phase: "idle",
});
const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

const openCreatedProject = async (
  props: ProjectCreationDialogProps, setState: SetDialogState, path: string,
) => {
  setState((current) => ({ ...current, error: null, gitFailed: false, phase: "opening" }));
  try {
    await props.onOpenProject(path);
    props.onClose();
  } catch (error) {
    setState((current) => ({ ...current, createdPath: path, error: errorMessage(error), phase: "idle" }));
  }
};

const initializeAndOpen = async (
  props: ProjectCreationDialogProps, setState: SetDialogState, path: string,
) => {
  setState((current) => ({ ...current, error: null, phase: "initializing" }));
  try {
    await props.onInitializeGit(path);
  } catch (error) {
    setState((current) => ({ ...current, error: errorMessage(error), gitFailed: true, phase: "idle" }));
    return;
  }
  await openCreatedProject(props, setState, path);
};

const createProject = async (
  props: ProjectCreationDialogProps, state: DialogState, setState: SetDialogState,
) => {
  setState((current) => ({ ...current, error: null, phase: "creating" }));
  let created: CreatedProject;
  try {
    created = await props.onCreateProject(state.parent, state.name.trim());
    setState((current) => ({ ...current, createdPath: created.path }));
  } catch (error) {
    setState((current) => ({ ...current, error: errorMessage(error), phase: "idle" }));
    return;
  }
  if (state.initializeGit) await initializeAndOpen(props, setState, created.path);
  else await openCreatedProject(props, setState, created.path);
};

const useDialogState = (open: boolean) => {
  const [state, setState] = useState<DialogState>(initialState);
  useEffect(() => {
    if (open) setState(initialState());
  }, [open]);
  return { state, setState };
};

const useDialogFocus = (open: boolean, busy: boolean, onClose: () => void) => {
  const chooseButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const busyRef = useRef(busy);
  const closeRef = useRef(onClose);
  busyRef.current = busy;
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    chooseButtonRef.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || busyRef.current) return;
      event.preventDefault(); closeRef.current();
    };
    window.addEventListener("keydown", keydown);
    return () => { window.removeEventListener("keydown", keydown); returnFocusRef.current?.focus(); };
  }, [open]);
  return chooseButtonRef;
};

const ProjectCreationFields = ({ disabled, state, setState, onPickParent, chooseButtonRef }: {
  disabled: boolean; state: DialogState; setState: SetDialogState;
  onPickParent: () => void; chooseButtonRef: React.RefObject<HTMLButtonElement | null>;
}) => (
  <div className="project-create__fields">
    <label className="project-create__field"><span>Parent folder</span><div className="project-create__parent"><output title={state.parent}>{state.parent || "Choose where to create the project"}</output><button ref={chooseButtonRef} type="button" aria-label="Choose parent folder" disabled={disabled || Boolean(state.createdPath)} onClick={onPickParent}>Choose…</button></div></label>
    <label className="project-create__field"><span>Project name</span><input autoComplete="off" maxLength={80} value={state.name} disabled={disabled || Boolean(state.createdPath)} onChange={(event) => { const name = event.currentTarget.value; setState((current) => ({ ...current, name })); }} /></label>
    <label className="project-create__check"><input type="checkbox" checked={state.initializeGit} disabled={disabled || Boolean(state.createdPath)} onChange={(event) => { const initializeGit = event.currentTarget.checked; setState((current) => ({ ...current, initializeGit })); }} /><span>Initialize a Git repository</span></label>
  </div>
);

const ProjectCreationActions = ({ busy, canCreate, state, onClose, onRetryGit, onOpen }: {
  busy: boolean; canCreate: boolean; state: DialogState; onClose: () => void;
  onRetryGit: () => void; onOpen: () => void;
}) => (
  <footer className="project-create__actions">
    <button type="button" disabled={busy} onClick={onClose}>Cancel</button>
    {state.gitFailed ? <><button type="button" disabled={busy} onClick={onOpen}>Open without Git</button><button className="project-create__primary" type="button" disabled={busy} onClick={onRetryGit}>Retry Git initialization</button></> : state.createdPath && state.error ? <button className="project-create__primary" type="button" disabled={busy} onClick={onOpen}>Retry opening</button> : <button className="project-create__primary" type="submit" disabled={!canCreate || busy}>{state.phase === "creating" ? "Creating…" : state.phase === "initializing" ? "Initializing Git…" : state.phase === "opening" ? "Opening…" : "Create project"}</button>}
  </footer>
);

export function ProjectCreationDialog(props: ProjectCreationDialogProps) {
  const { state, setState } = useDialogState(props.open);
  const busy = state.phase !== "idle";
  const chooseButtonRef = useDialogFocus(props.open, busy, props.onClose);
  if (!props.open) return null;
  const pickParent = async () => {
    try {
      const parent = await props.onPickParent();
      if (parent) setState((current) => ({ ...current, error: null, parent }));
    } catch (error) { setState((current) => ({ ...current, error: errorMessage(error) })); }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!busy && state.parent && state.name.trim()) void createProject(props, state, setState);
  };
  const openCreated = () => state.createdPath && void openCreatedProject(props, setState, state.createdPath);
  return (
    <div className="project-create-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && props.onClose()}>
      <form className="project-create" role="dialog" aria-modal="true" aria-labelledby="project-create-title" onSubmit={submit}>
        <header><div><h2 id="project-create-title">Create a new project</h2><p>Start with a local folder and an optional Git repository.</p></div></header>
        <ProjectCreationFields disabled={busy} state={state} setState={setState} onPickParent={() => void pickParent()} chooseButtonRef={chooseButtonRef} />
        {state.createdPath ? <p className="project-create__path"><strong>Created folder</strong><span>{state.createdPath}</span></p> : null}
        {state.error ? <p className="project-create__error" role="alert">{state.error}</p> : null}
        <ProjectCreationActions busy={busy} canCreate={Boolean(state.parent && state.name.trim())} state={state} onClose={props.onClose} onRetryGit={() => state.createdPath && void initializeAndOpen(props, setState, state.createdPath)} onOpen={openCreated} />
      </form>
    </div>
  );
}

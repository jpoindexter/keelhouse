import { clampEditorViewState, type CursorPosition, type EditorViewState } from "./editorState";

type Ref<T> = { current: T };

type EditorViewLike = {
  dispatch: (spec: {
    scrollIntoView: boolean; selection: { anchor: number; head: number };
  }) => void;
  focus: () => void;
  hasFocus: boolean;
  scrollDOM: { scrollTop: number };
  state: { doc: { length: number } };
};

type EditorUpdateLike<TView extends EditorViewLike> = {
  state: {
    doc: { lineAt: (pos: number) => { from: number; number: number } };
    selection: { main: { anchor: number; head: number } };
  };
  view: TView;
};

type EditorViewLifecycleOptions<TView extends EditorViewLike> = {
  getSelectedFilePath: () => string | null;
  pendingFocus: Ref<boolean>;
  scheduleFrame: (callback: () => void) => void;
  setCursor: (cursor: CursorPosition) => void;
  setView: (view: TView) => void;
  viewStates: Ref<Record<string, EditorViewState>>;
};

const handleEditorUpdate = <TView extends EditorViewLike>(
  options: EditorViewLifecycleOptions<TView>,
  update: EditorUpdateLike<TView>,
) => {
  const path = options.getSelectedFilePath();
  if (!path) return;
  const { anchor, head } = update.state.selection.main;
  options.viewStates.current[path] = {
    anchor,
    head,
    scrollTop: update.view.scrollDOM.scrollTop,
    focused: update.view.hasFocus,
  };
  const line = update.state.doc.lineAt(head);
  options.setCursor({ line: line.number, column: head - line.from + 1 });
};

const restoreEditorView = <TView extends EditorViewLike>(
  options: EditorViewLifecycleOptions<TView>,
  view: TView,
) => {
  options.setView(view);
  const path = options.getSelectedFilePath();
  if (!path) return;
  const restored = clampEditorViewState(options.viewStates.current[path], view.state.doc.length);
  if (restored) {
    view.dispatch({
      selection: { anchor: restored.anchor, head: restored.head },
      scrollIntoView: false,
    });
  }
  options.scheduleFrame(() => {
    if (restored) view.scrollDOM.scrollTop = restored.scrollTop;
    if (options.pendingFocus.current || restored?.focused) view.focus();
    options.pendingFocus.current = false;
  });
};

export const createEditorViewLifecycle = <TView extends EditorViewLike>(
  options: EditorViewLifecycleOptions<TView>,
) => ({
  handleEditorUpdate: (update: EditorUpdateLike<TView>) => handleEditorUpdate(options, update),
  restoreEditorView: (view: TView) => restoreEditorView(options, view),
});

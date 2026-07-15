import type { KeyboardEvent, PointerEvent } from "react";

import type { FileTreeNode } from "./fileTreeTypes";
import { AppIcon } from "./icons";
import { pathBreadcrumbs } from "./editorState";
import type { QuickOpenController } from "./useQuickOpen";

type QuickOpenDialogProps = {
  controller: QuickOpenController;
  onOpenFile: (file: FileTreeNode) => void;
  shortcut: string;
  workspacePath: string | null;
};

const handleKeyDown = (
  event: KeyboardEvent<HTMLInputElement>,
  controller: QuickOpenController,
  openFile: (file: FileTreeNode) => void,
) => {
  if (event.key === "Escape") controller.close();
  else if (event.key === "ArrowDown") controller.setActiveIndex((index) => controller.results.length === 0 ? 0 : (index + 1) % controller.results.length);
  else if (event.key === "ArrowUp") controller.setActiveIndex((index) => controller.results.length === 0 ? 0 : (index - 1 + controller.results.length) % controller.results.length);
  else if (event.key === "Enter") {
    const file = controller.results[controller.activeIndex] ?? controller.results[0];
    if (file) openFile(file);
  } else return;
  event.preventDefault();
};

export const QuickOpenDialog = ({ controller, onOpenFile, shortcut, workspacePath }: QuickOpenDialogProps) => {
  if (!controller.open) return null;
  const openFile = (file: FileTreeNode) => {
    controller.close();
    onOpenFile(file);
  };
  return (
    <div className="command-palette-backdrop" role="presentation" onPointerDown={controller.close}>
      <section className="command-palette quick-open" aria-label="Quick open files" role="dialog" aria-modal="true" onPointerDown={(event: PointerEvent) => event.stopPropagation()}>
        <div className="command-palette__field">
          <AppIcon name="file" />
          <input ref={controller.inputRef} value={controller.query} aria-label="Quick open file" placeholder="Open file by name or path..." onChange={(event) => controller.setQuery(event.currentTarget.value)} onKeyDown={(event) => handleKeyDown(event, controller, openFile)} />
          <span>{shortcut}</span>
        </div>
        <div className="command-palette__list" role="listbox" aria-label="Files">
          {!workspacePath ? <div className="command-palette__empty">Open a folder before quick open</div> : null}
          {workspacePath ? controller.results.map((file, index) => (
            <button className={`command-palette__row ${index === controller.activeIndex ? "command-palette__row--active" : ""}`} type="button" role="option" aria-selected={index === controller.activeIndex} key={file.path} onPointerMove={() => controller.setActiveIndex(index)} onClick={() => openFile(file)}>
              <span className="command-palette__icon"><AppIcon name="file" /></span>
              <span className="command-palette__copy"><strong>{file.name}</strong><span>{pathBreadcrumbs(workspacePath, file.path).join(" / ")}</span></span>
            </button>
          )) : null}
          {workspacePath && controller.results.length === 0 ? <div className="command-palette__empty">No files match</div> : null}
        </div>
      </section>
    </div>
  );
};

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { ContextMenu, type ContextMenuItem, type ContextMenuState } from "./ContextMenu";
import type { FileTreeNode } from "./fileTreeTypes";

type ContextMenuHostOptions = {
  buildFileNodeItems: (node: FileTreeNode) => ContextMenuItem[];
  onActionError: (item: ContextMenuItem, error: unknown) => void;
};

export const useContextMenuHost = (options: ContextMenuHostOptions) => {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const buildFileNodeItemsRef = useRef(options.buildFileNodeItems);
  buildFileNodeItemsRef.current = options.buildFileNodeItems;

  useEffect(() => {
    const onContextMenu = (event: Event) => {
      const detail = (event as CustomEvent<{ node: FileTreeNode; x: number; y: number }>).detail;
      if (!detail?.node) return;
      setContextMenu({
        x: detail.x,
        y: detail.y,
        items: buildFileNodeItemsRef.current(detail.node),
      });
    };
    window.addEventListener("file-tree-context-menu", onContextMenu);
    return () => {
      window.removeEventListener("file-tree-context-menu", onContextMenu);
    };
  }, []);

  const openContextMenu = (event: ReactMouseEvent, items: ContextMenuItem[]) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, items });
  };

  const element = contextMenu ? (
    <ContextMenu
      state={contextMenu}
      onDismiss={() => setContextMenu(null)}
      onActionError={options.onActionError}
    />
  ) : null;

  return { contextMenu, element, openContextMenu, setContextMenu };
};

import { useEffect, useMemo, useRef, useState } from "react";

import type { FileTreeNode } from "./fileTreeTypes";
import { filterWorkspaceFiles } from "./workspaceSearch";

export type QuickOpenController = {
  activeIndex: number;
  close: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  open: boolean;
  openDialog: () => void;
  query: string;
  results: FileTreeNode[];
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
  setQuery: (query: string) => void;
};

export const useQuickOpen = (files: FileTreeNode[], onOpen: () => void): QuickOpenController => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQueryState] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const results = useMemo(() => filterWorkspaceFiles(files, query, 80), [files, query]);

  const close = () => {
    setOpen(false);
    setQueryState("");
    setActiveIndex(0);
  };
  const openDialog = () => {
    onOpen();
    setQueryState("");
    setActiveIndex(0);
    setOpen(true);
  };
  const setQuery = (nextQuery: string) => {
    setQueryState(nextQuery);
    setActiveIndex(0);
  };

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open, query]);

  return { activeIndex, close, inputRef, open, openDialog, query, results, setActiveIndex, setQuery };
};

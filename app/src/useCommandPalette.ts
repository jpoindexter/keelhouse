import type { KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";

import type { SearchDialogCommand } from "./SearchCommandDialog";

export const nextCommandPaletteIndex = (current: number, count: number, direction: 1 | -1) =>
  count === 0 ? 0 : (current + direction + count) % count;

export type CommandPaletteController = {
  activeIndex: number;
  close: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>, commands: SearchDialogCommand[]) => void;
  open: boolean;
  openDialog: () => void;
  query: string;
  run: (command: SearchDialogCommand | null) => void;
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
  setQuery: (query: string) => void;
};

export const useCommandPalette = (onOpen: () => void): CommandPaletteController => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQueryState] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
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
  const run = (command: SearchDialogCommand | null) => {
    if (!command || command.disabled) return;
    close();
    command.run();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>, commands: SearchDialogCommand[]) => {
    if (event.key === "Escape") close();
    else if (event.key === "ArrowDown") setActiveIndex((index) => nextCommandPaletteIndex(index, commands.length, 1));
    else if (event.key === "ArrowUp") setActiveIndex((index) => nextCommandPaletteIndex(index, commands.length, -1));
    else if (event.key === "Enter") run(commands[activeIndex] ?? commands[0] ?? null);
    else return;
    event.preventDefault();
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
  return { activeIndex, close, inputRef, onKeyDown, open, openDialog, query, run, setActiveIndex, setQuery };
};

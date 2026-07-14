import { useEffect, useMemo, useRef, useState } from "react";

import type { ChatProvider } from "./chatConversation";
import { composerModelChoices, filterComposerModels } from "./composerModels";

const usePickerDismissal = (
  open: boolean,
  rootRef: React.RefObject<HTMLDivElement | null>,
  searchRef: React.RefObject<HTMLInputElement | null>,
  close: (restoreFocus?: boolean) => void,
) => {
  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => searchRef.current?.focus());
    const dismiss = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) close(false); };
    document.addEventListener("mousedown", dismiss);
    return () => document.removeEventListener("mousedown", dismiss);
  }, [open]);
};

const pickerKeyHandler = (
  customMode: boolean,
  filtered: ReturnType<typeof filterComposerModels>,
  activeIndex: number,
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>,
  close: () => void,
  choose: (provider: ChatProvider, model: string) => void,
) => (event: React.KeyboardEvent) => {
  if (event.key === "Escape") { event.preventDefault(); close(); return; }
  if (customMode || filtered.length === 0) return;
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    setActiveIndex((index) => (index + direction + filtered.length) % filtered.length);
  } else if (event.key === "Enter" && filtered[activeIndex]) {
    event.preventDefault(); choose(filtered[activeIndex].provider, filtered[activeIndex].id);
  }
};

export function useComposerModelPicker({
  provider,
  model,
  configuredModels,
  onSelect,
}: {
  provider: ChatProvider;
  model: string;
  configuredModels: Partial<Record<ChatProvider, string>>;
  onSelect: (provider: ChatProvider, model: string) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [customMode, setCustomMode] = useState(false);
  const [customModel, setCustomModel] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const choices = useMemo(() => composerModelChoices(configuredModels, provider, model), [configuredModels, model, provider]);
  const filtered = useMemo(() => filterComposerModels(choices, query), [choices, query]);
  const close = (restoreFocus = true) => {
    setOpen(false); setQuery(""); setCustomMode(false); setActiveIndex(0);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };
  const choose = async (nextProvider: ChatProvider, nextModel: string) => {
    await onSelect(nextProvider, nextModel); close();
  };
  usePickerDismissal(open, rootRef, searchRef, close);
  useEffect(() => setActiveIndex((index) => Math.min(index, Math.max(0, filtered.length - 1))), [filtered.length]);
  const handleKeyDown = pickerKeyHandler(customMode, filtered, activeIndex, setActiveIndex, close, (nextProvider, nextModel) => void choose(nextProvider, nextModel));
  return {
    activeIndex, choose, close, customMode, customModel, filtered, handleKeyDown, open, query,
    rootRef, searchRef, setActiveIndex, setCustomMode, setCustomModel, setOpen, setQuery, triggerRef,
  };
}

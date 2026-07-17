import { useCallback, useEffect, useRef, useState } from "react";

type ResolveLabel = (value: string | null) => void;

export const useWorktreeLabelRequest = () => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const pendingRef = useRef<ResolveLabel | null>(null);
  const finish = useCallback((next: string | null) => {
    const resolve = pendingRef.current;
    if (!resolve) return;
    pendingRef.current = null;
    setOpen(false);
    resolve(next?.trim() || null);
  }, []);
  const requestLabel = useCallback(() => {
    if (pendingRef.current) return Promise.resolve(null);
    setValue("");
    setOpen(true);
    return new Promise<string | null>((resolve) => { pendingRef.current = resolve; });
  }, []);
  useEffect(() => () => {
    pendingRef.current?.(null);
    pendingRef.current = null;
  }, []);
  return {
    dialog: { open, value, onCancel: () => finish(null), onChange: setValue, onSubmit: finish },
    requestLabel,
  };
};

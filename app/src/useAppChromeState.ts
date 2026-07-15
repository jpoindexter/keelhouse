import { useEffect, useRef, useState } from "react";

import { composerPopoverPosition } from "./composerPopover";

export type AppTheme = "graphite" | "mono-ghost";

const useComposerPopoverRepositioning = () => useEffect(() => {
  const reposition = () => {
    document.querySelectorAll<HTMLDetailsElement>("details.agent-composer__menu[open]")
      .forEach(composerPopoverPosition);
  };
  window.addEventListener("resize", reposition);
  window.addEventListener("scroll", reposition, true);
  return () => {
    window.removeEventListener("resize", reposition);
    window.removeEventListener("scroll", reposition, true);
  };
}, []);

const useTimedNotice = (duration: number) => {
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), duration);
    return () => window.clearTimeout(timeout);
  }, [duration, notice]);
  return [notice, setNotice] as const;
};

const useTheme = () => {
  const [theme, setTheme] = useState<AppTheme>("graphite");
  useEffect(() => {
    if (theme === "mono-ghost") document.documentElement.dataset.theme = "mono-ghost";
    else delete document.documentElement.dataset.theme;
  }, [theme]);
  return [theme, setTheme] as const;
};

export const useAppChromeState = () => {
  useComposerPopoverRepositioning();
  const [crashNotice, setCrashNotice] = useTimedNotice(12_000);
  const [actionNotice, setActionNotice] = useTimedNotice(2600);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const notificationsEnabledRef = useRef(false);
  const [appTheme, setAppTheme] = useTheme();
  useEffect(() => { notificationsEnabledRef.current = notificationsEnabled; }, [notificationsEnabled]);
  return {
    actionNotice, appTheme, crashNotice, notificationsEnabled, notificationsEnabledRef,
    setActionNotice, setAppTheme, setCrashNotice, setNotificationsEnabled,
  };
};

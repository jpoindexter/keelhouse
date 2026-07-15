import { useRef, useState } from "react";

import {
  browserHistoryCanGoBack,
  browserHistoryCanGoForward,
  DEFAULT_BROWSER_PREVIEW_URL,
  pushBrowserHistory,
} from "./browserPreview";

export function useBrowserPreviewState(onUrlChange: (url: string) => void) {
  const [url, setUrl] = useState(DEFAULT_BROWSER_PREVIEW_URL);
  const [address, setAddress] = useState(DEFAULT_BROWSER_PREVIEW_URL);
  const [history, setHistory] = useState([DEFAULT_BROWSER_PREVIEW_URL]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const onUrlChangeRef = useRef(onUrlChange);
  onUrlChangeRef.current = onUrlChange;
  const setLocation = (nextUrl: string, options: { pushHistory?: boolean } = {}) => {
    onUrlChangeRef.current(nextUrl);
    setUrl(nextUrl);
    setAddress(nextUrl);
    setError(null);
    if (options.pushHistory ?? true) {
      const next = pushBrowserHistory(history, historyIndex, nextUrl);
      setHistory(next.history);
      setHistoryIndex(next.index);
    }
  };
  const restore = (nextUrl: string) => {
    onUrlChangeRef.current(nextUrl);
    setUrl(nextUrl);
    setAddress(nextUrl);
    setHistory([nextUrl]);
    setHistoryIndex(0);
    setError(null);
    setReloadNonce((value) => value + 1);
  };
  const goHistory = (direction: -1 | 1) => {
    const nextIndex = historyIndex + direction;
    const nextUrl = history[nextIndex];
    if (!nextUrl) return;
    setHistoryIndex(nextIndex);
    setLocation(nextUrl, { pushHistory: false });
  };
  return {
    address, canGoBack: browserHistoryCanGoBack(historyIndex),
    canGoForward: browserHistoryCanGoForward(history, historyIndex), error, goHistory,
    reload: () => setReloadNonce((value) => value + 1), reloadNonce, restore,
    setAddress, setError, setLocation, url,
  };
}

export const DEFAULT_BROWSER_PREVIEW_URL = "http://localhost:3000";
export const MAX_BROWSER_HISTORY = 25;

export type BrowserPreviewRecords = Record<string, string>;

const LOCAL_DEV_SERVER_PATTERN = /\b(?:https?:\/\/)?(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]):\d{2,5}(?:\/[^\s"'<>)]*)?/gi;

export const normalizeBrowserPreviewUrl = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) || trimmed.startsWith("file://")
    ? trimmed
    : `http://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (!["http:", "https:", "file:"].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
};

export const normalizeDetectedLocalDevServerUrl = (value: string): string | null => {
  const trimmed = value.trim().replace(/[.,;:]+$/, "");
  const normalized = normalizeBrowserPreviewUrl(trimmed);
  if (!normalized) return null;
  const url = new URL(normalized);
  if (!["http:", "https:"].includes(url.protocol)) return null;
  if (!["localhost", "127.0.0.1", "0.0.0.0", "[::1]"].includes(url.hostname)) return null;
  if (!url.port) return null;
  if (url.hostname === "0.0.0.0") url.hostname = "localhost";
  return url.toString();
};

export const detectLocalDevServerUrl = (text: string): string | null => {
  const matches = text.match(LOCAL_DEV_SERVER_PATTERN) ?? [];
  for (const match of matches.reverse()) {
    const normalized = normalizeDetectedLocalDevServerUrl(match);
    if (normalized) return normalized;
  }
  return null;
};

export const normalizeBrowserPreviewRecords = (value: unknown): BrowserPreviewRecords => {
  if (typeof value !== "object" || value == null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, url]) => {
        const normalized = typeof url === "string" ? normalizeBrowserPreviewUrl(url) : null;
        return key.trim().length > 0 && normalized ? [key, normalized] as const : null;
      })
      .filter((entry): entry is readonly [string, string] => entry != null),
  );
};

export const pushBrowserHistory = (
  history: string[],
  index: number,
  url: string,
): { history: string[]; index: number } => {
  if (history[index] === url) return { history, index };
  const next = [...history.slice(0, index + 1), url].slice(-MAX_BROWSER_HISTORY);
  return { history: next, index: next.length - 1 };
};

export const browserHistoryCanGoBack = (index: number) => index > 0;
export const browserHistoryCanGoForward = (history: string[], index: number) => index < history.length - 1;
